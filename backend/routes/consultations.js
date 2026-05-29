const fmtDoctorName = require('../utils/fmtDoctorName');
const express = require('express');
const { Doctor, User } = require('../models/mysql');
const router = express.Router();
const multer = require('multer');
const { cloudinary, createCloudinaryUpload } = require('../config/cloudinary'); // masih dipakai untuk attachment
const { uploadToB2, getDownloadUrl, deleteFromB2 } = require('../config/b2');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

const Consultation = require('../models/Consultation');
const SickLetter = require('../models/SickLetter');
const auth = require('../middleware/auth');
const doctorAuth = require('../middleware/doctorAuth');
const { createNotification } = require('../utils/notificationHelper');
const { populateFromMySQL } = require('../utils/hybridJoin');
const { classifyKeluhan } = require('../utils/mlService');

/**
 * Mengambil gambar dari URL (Cloudinary atau lokal) dan mengembalikan Buffer.
 * PDFKit bisa menerima Buffer langsung, sehingga tidak perlu file lokal.
 */
const fetchImageBuffer = async (fileUrl, fileType) => {
    if (!fileUrl) return null;
    try {
        // Jika URL adalah Cloudinary / remote HTTP
        if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
            const https = fileUrl.startsWith('https') ? require('https') : require('http');
            return await new Promise((resolve, reject) => {
                https.get(fileUrl, (res) => {
                    if (res.statusCode !== 200) {
                        res.resume();
                        return reject(new Error(`HTTP ${res.statusCode}`));
                    }
                    const chunks = [];
                    res.on('data', c => chunks.push(c));
                    res.on('end', () => resolve(Buffer.concat(chunks)));
                    res.on('error', reject);
                }).on('error', reject);
            });
        }
        // Fallback: path lokal
        const filePath = require('path').join(__dirname, '..', fileUrl.replace(/^\//, ''));
        if (require('fs').existsSync(filePath)) {
            return require('fs').readFileSync(filePath);
        }
        console.warn(`[pdf] ${fileType} tidak ditemukan di disk:`, filePath);
        return null;
    } catch (err) {
        console.warn(`[pdf] Gagal load ${fileType}:`, err.message);
        return null;
    }
};

const parseAddress = (fullAddress) => {
    if (!fullAddress || fullAddress.trim() === '') {
        return {
            street: 'Jln. Tanjung Kampus IPB Dramaga, Babakan, Dramaga,',
            city_province: 'Bogor Kota, Jawa Barat 16680'
        };
    }
    
    const parts = fullAddress.split(',').map(p => p.trim());
    
    if (parts.length === 1) {
        return {
            street: parts[0],
            city_province: ''
        };
    } else if (parts.length === 2) {
        return {
            street: parts[0],
            city_province: parts[1]
        };
    } else {
        // parts.length >= 3: "Jln. X, City, Province" etc
        return {
            street: parts.slice(0, -2).join(', ') + ',',
            city_province: parts.slice(-2).join(', ')
        };
    }
};

// ── Multer untuk upload foto chat — disimpan ke Cloudinary ──────────────────
const uploadChat = createCloudinaryUpload(
    'klinik-ipb/chat-images',
    ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    5
);

// ── Multer untuk upload file PDF chat — disimpan ke Cloudinary ───────────────
const uploadChatFile = createCloudinaryUpload(
    'klinik-ipb/chat-files',
    ['pdf'],
    10
);

// ── Multer untuk upload lampiran keluhan — disimpan ke Cloudinary ────────────
const uploadAttachment = createCloudinaryUpload(
    'klinik-ipb/attachments',
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx'],
    10
);


// ── Multer untuk upload video log — disimpan ke Backblaze B2 ────────────────
// Gunakan memoryStorage karena file akan diteruskan langsung ke B2 via SDK
const uploadVideoLog = multer({
    storage : multer.memoryStorage(),
    limits  : { fileSize: 600 * 1024 * 1024 }, // 600 MB max (sudah dikompress di frontend)
    fileFilter: (req, file, cb) => {
        const allowed = ['mp4', 'webm', 'mkv', 'mov', 'avi'];
        const ext = file.originalname.split('.').pop().toLowerCase();
        if (allowed.includes(ext)) return cb(null, true);
        cb(new Error('Format video tidak didukung. Gunakan: mp4, webm, mkv, mov, avi'));
    },
});

// ── Konfigurasi Multer untuk Upload Bukti Refund ─────────────────────────────
const uploadRefundProof = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const dir = 'uploads/refund-proofs';
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        },
        filename: (req, file, cb) => {
            cb(null, `refund-${Date.now()}-${Math.round(Math.random()*1e9)}${path.extname(file.originalname)}`);
        }
    }),
    limits: { fileSize: 5 * 1024 * 1024 }
});

// ── Helper: cek apakah user/dokter bisa akses konsultasi ──
const canAccess = async (consultation, userId, userRole) => {
    if (userRole === 'admin') return true;
    
    const patientId = consultation.userId?.id || consultation.userId;
    if (patientId?.toString() === userId) return true;
    
    if (userRole === 'doctor') {
        const doctor = await Doctor.findOne({ where: { userId: userId } });
        const consultDocId = consultation.doctorId?.id || consultation.doctorId;
        if (doctor && consultDocId?.toString() === doctor.id.toString()) return true;
    }
    
    return false;
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. ROUTE STATIS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/my-consultations', auth, async (req, res) => {
    try {
        const consultations = await Consultation.find({ userId: req.userId })
            .populate({ path: 'sickLetter', select: 'letterNumber diagnosis status startDate endDate issuedAt patientAge patientGender' })
            .sort('-createdAt');

        const CANCEL_DEADLINE_MS = 24 * 60 * 60 * 1000;
        const withDeadline = consultations.map(c => {
            const obj = c.toObject();
            if (c.scheduledAt) {
                obj.cancelDeadline = new Date(new Date(c.scheduledAt).getTime() - CANCEL_DEADLINE_MS).toISOString();
            }
            return obj;
        });

        res.json(withDeadline);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/doctor/pending', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ where: { userId: req.userId } });
        if (!doctor) return res.status(404).json({ success: false, message: 'Data dokter tidak ditemukan' });

        let consultations = await Consultation.find({
            doctorId: doctor.id,
            status: { $in: ['confirmed', 'in_progress'] }
        }).sort('scheduledAt').lean();

        consultations = await populateFromMySQL(
            consultations, 'userId', 'User', 'id name email phone'
        );

        res.json({ success: true, count: consultations.length, consultations });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

router.get('/doctor/history', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ where: { userId: req.userId } });
        if (!doctor) return res.status(404).json({ success: false, message: 'Data dokter tidak ditemukan' });

        let consultations = await Consultation.find({ doctorId: doctor.id }).sort('-createdAt').lean();

        consultations = await populateFromMySQL(
            consultations, 'userId', 'User', 'id name email phone'
        );

        res.json({ success: true, consultations });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.get('/doctor/all', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ where: { userId: req.userId } });
        if (!doctor) return res.status(404).json({ success: false, message: 'Data dokter tidak ditemukan' });

        let consultations = await Consultation.find({ doctorId: doctor.id })
            .populate({ path: 'sickLetter', select: 'status letterNumber diagnosis startDate endDate issuedAt patientAge patientGender patientWeight notes' })
            .sort('-createdAt')
            .lean();

        consultations = await populateFromMySQL(
            consultations, 'userId', 'User', 'id name email phone'
        );

        res.json({ success: true, consultations });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. BUAT KONSULTASI (DRAFT → PENDING_PAYMENT)
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/create', auth, uploadAttachment.array('attachments', 5), async (req, res) => {
    try {
        const { doctorId, consultationType, symptoms, medicalHistory, scheduledAt, scheduledEnd } = req.body;

        const doctor = await Doctor.findByPk(doctorId);
        if (!doctor || !doctor.isActive) {
            return res.status(404).json({ message: 'Dokter tidak ditemukan atau tidak aktif' });
        }

        const settings = doctor.consultationSettings || {};
        const typeAllowed = {
            chat: settings.allowChat !== false,
            video_call: settings.allowVideoCall !== false,
        };
        if (!typeAllowed[consultationType]) {
            return res.status(400).json({ message: `Dokter tidak mengaktifkan fitur ${consultationType === 'video_call' ? 'Video Call' : 'Chat'}` });
        }

        if (!scheduledAt || !scheduledEnd) {
            return res.status(400).json({ message: 'Slot jadwal (scheduledAt & scheduledEnd) wajib diisi' });
        }

        const slotStart = new Date(scheduledAt);
        const slotEnd = new Date(scheduledEnd);
        const now = new Date();

        const CONS_CUTOFF_MS = 20 * 60 * 1000;
        if (slotStart.getTime() - now.getTime() < CONS_CUTOFF_MS) {
            return res.status(400).json({ message: 'Pemesanan harus dilakukan maksimal 20 menit sebelum jadwal' });
        }

        const slotConflict = await Consultation.findOne({
            doctorId,
            scheduledAt: slotStart,
            status: { $in: ['pending_payment', 'waiting_verification', 'confirmed', 'in_progress'] }
        });
        if (slotConflict) {
            return res.status(409).json({ message: 'Slot ini baru saja diambil orang lain. Silakan pilih slot lain.' });
        }

        const DoctorAvailability = require('../models/DoctorAvailability');
        const avail = await DoctorAvailability.findOne({ doctorId: doctor.id });
        if (!avail || !avail.isActive) {
            return res.status(400).json({ message: 'Dokter belum mengatur jadwal praktik atau sedang tidak menerima konsultasi' });
        }
        if (!avail.isWeekActive()) {
            return res.status(400).json({ message: 'Dokter belum merilis jadwal untuk minggu ini. Silakan cek kembali beberapa saat lagi.' });
        }

        if (slotStart < avail.weekStart || slotStart > avail.weekEnd) {
            return res.status(400).json({ message: 'Slot di luar rentang jadwal minggu ini.' });
        }

        const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
        const slotWIB = new Date(slotStart.getTime() + WIB_OFFSET_MS);

        const dayOfWeek = slotWIB.getUTCDay();
        if (dayOfWeek === 0) {
            return res.status(400).json({ message: 'Konsultasi tidak tersedia hari Minggu.' });
        }
        const slotsForDay = avail.getSlotsForDay(dayOfWeek);
        if (!slotsForDay || slotsForDay.length === 0) {
            return res.status(400).json({ message: 'Dokter tidak praktik pada hari tersebut' });
        }

        const slotHHMM = `${String(slotWIB.getUTCHours()).padStart(2, '0')}:${String(slotWIB.getUTCMinutes()).padStart(2, '0')}`;

        if (!avail.isSlotActive(dayOfWeek, slotHHMM)) {
            return res.status(400).json({
                message: 'Slot waktu tidak valid. Pilih slot yang tersedia dari sistem.',
            });
        }

        const slotEndWIB = new Date(slotEnd.getTime() + WIB_OFFSET_MS);
        const slotEndHHMM = `${String(slotEndWIB.getUTCHours()).padStart(2, '0')}:${String(slotEndWIB.getUTCMinutes()).padStart(2, '0')}`;
        const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
        const SESSION_DURATION = 30;
        const expectedEndMin = (toMin(slotHHMM) + SESSION_DURATION) % 1440;
        if (toMin(slotEndHHMM) !== expectedEndMin) {
            return res.status(400).json({ message: 'Waktu selesai slot tidak sesuai' });
        }

        const paymentDeadline = new Date(Date.now() + 15 * 60 * 1000);

        // Cloudinary: URL file ada di f.path (sudah full URL)
        const attachmentUrls = (req.files || []).map(f => f.path || f.secure_url || f.url || `/uploads/attachments/${f.filename}`);

        const consultation = new Consultation({
            userId: req.userId,
            doctorId,
            consultationType: consultationType || 'chat',
            scheduleType: 'scheduled',
            scheduledAt: slotStart,
            scheduledEnd: slotEnd,
            slotLockExpires: paymentDeadline,
            symptoms,
            medicalHistory,
            attachmentUrls,
            amount: doctor.consultationFee,
            status: 'pending_payment',
            paymentDeadline
        });

        await consultation.save();

        // ── Klasifikasi penyakit ML (async, tidak blocking response) ──
       if (symptoms) {
            const { User } = require('../models/mysql');
            User.findOne({ where: { id: req.userId } })
                .then(u => classifyKeluhan(symptoms, u?.gender || null))
                .then(async (result) => {
                    if (result) {
                        await Consultation.findByIdAndUpdate(consultation._id, {
                            disease_category:    result.kategori,
                            category_confidence: result.confidence,
                            category_method:     result.metode,
                        });
                    }
                })
                .catch(err => console.error('[ML classify consultation]', err.message));
        }
        // ── End ML ────────────────────────────────────────────────────

        res.json({
            success: true,
            consultation,
            amount: doctor.consultationFee,
            paymentDeadline
        });
    } catch (err) {
        console.error('create consultation error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});


// ═══════════════════════════════════════════════════════════════════════════════
// 3. STATUS TRANSITIONS
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/:id/initiate-payment', auth, async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id);

        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });
        if (consultation.userId.toString() !== req.userId) return res.status(403).json({ message: 'Akses ditolak' });
        if (consultation.status !== 'pending_payment') {
            return res.status(400).json({ message: `Status saat ini: ${consultation.status}. Tidak bisa bayar.` });
        }

        if (consultation.paymentDeadline && consultation.paymentDeadline < new Date()) {
            consultation.status = 'expired';
            await consultation.save();
            return res.status(400).json({ message: 'Waktu pembayaran sudah habis. Silakan booking ulang.' });
        }

        const amount = consultation.doctorId?.consultationFee || req.body.amount;
        if (!amount) return res.status(400).json({ message: 'Biaya konsultasi tidak ditemukan' });

        const externalId = `INV-CONSULT-${consultation.id}-${Date.now()}`;

        const axios = require('axios');
        const XENDIT_SECRET_KEY = process.env.XENDIT_SECRET_KEY;
        const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

        const xenditRes = await axios.post(
            'https://api.xendit.co/v2/invoices',
            {
                external_id: externalId,
                amount,
                description: `Konsultasi Online – ${fmtDoctorName(consultation.doctorId)}`,
                invoice_duration: 900,
                success_redirect_url: `${FRONTEND_URL}/payment/success?external_id=${externalId}`,
                failure_redirect_url: `${FRONTEND_URL}/payment/failed?external_id=${externalId}`,
                currency: 'IDR',
                payment_methods: ['BCA', 'BNI', 'BRI', 'MANDIRI', 'PERMATA', 'OVO', 'DANA', 'SHOPEEPAY', 'LINKAJA', 'QRIS'],
            },
            {
                headers: {
                    Authorization: 'Basic ' + Buffer.from(XENDIT_SECRET_KEY + ':').toString('base64'),
                    'Content-Type': 'application/json',
                },
            }
        );

        const invoice = xenditRes.data;

        consultation.xenditInvoiceId = invoice.id;
        consultation.xenditExternalId = externalId;
        await consultation.save();

        res.json({
            success: true,
            invoiceUrl: invoice.invoice_url,
            externalId,
            invoiceId: invoice.id,
            amount,
            paymentDeadline: consultation.paymentDeadline,
        });
    } catch (err) {
        console.error('[initiate-payment]', err.response?.data || err.message);
        res.status(500).json({ message: 'Gagal membuat invoice pembayaran: ' + (err.response?.data?.message || err.message) });
    }
});

router.post('/:id/upload-proof', auth, async (req, res) => {
    res.status(410).json({
        message: 'Pembayaran kini dilakukan otomatis via Xendit. Gunakan endpoint /initiate-payment.',
    });
});

router.put('/:id/cancel-by-doctor', auth, async (req, res) => {
    try {
        const isAdmin = req.userRole === 'admin';
        const isDoctor = req.userRole === 'doctor';
        if (!isAdmin && !isDoctor) return res.status(403).json({ message: 'Akses ditolak' });

        const consultation = await Consultation.findById(req.params.id);
        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });

        if (isDoctor) {
            const doctor = await Doctor.findOne({ where: { userId: req.userId } });
            if (!doctor || consultation.doctorId.toString() !== doctor.id.toString()) {
                return res.status(403).json({ message: 'Anda bukan dokter konsultasi ini' });
            }
        }

        const cancellableStatuses = ['confirmed', 'waiting_verification', 'pending_payment'];
        if (!cancellableStatuses.includes(consultation.status)) {
            return res.status(400).json({ message: `Tidak bisa batalkan dari status ${consultation.status}` });
        }

        consultation.status = 'cancelled_by_doctor';
        consultation.cancelledAt = new Date();
        consultation.cancelledBy = isDoctor ? 'doctor' : 'admin';
        consultation.cancelReason = req.body.reason || 'Dokter membatalkan konsultasi';
        await consultation.save();

        await createNotification({
            userId: consultation.userId,
            type: 'consultation_cancelled',
            title: 'Konsultasi Dibatalkan',
            message: `Konsultasi Anda dibatalkan oleh dokter. Anda dapat mengajukan refund.`,
            data: { consultationId: consultation.id },
            io: req.app.get('io')
        });

        res.json({ success: true, message: 'Konsultasi dibatalkan oleh dokter', consultation });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

router.put('/:id/start', auth, async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id);
        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });

        let isAuthorized = req.userRole === 'admin';
        if (req.userRole === 'doctor') {
            const doctor = await Doctor.findOne({ where: { userId: req.userId } });
            if (doctor && consultation.doctorId.toString() === doctor.id.toString()) {
                isAuthorized = true;
            }
        }

        if (!isAuthorized) {
            return res.status(403).json({ message: 'Hanya dokter yang bersangkutan yang dapat memulai' });
        }

        if (consultation.status === 'in_progress') {
            return res.json({ success: true, message: 'Konsultasi sudah berjalan', consultation });
        }

        if (consultation.status !== 'confirmed') {
            return res.status(400).json({ message: `Status harus confirmed, saat ini: ${consultation.status}` });
        }

        const now = new Date();
        const EARLY_GRACE_MS = 5 * 60 * 1000;
        if (consultation.scheduledAt) {
            const earliest = new Date(consultation.scheduledAt.getTime() - EARLY_GRACE_MS);
            if (now < earliest) {
                const menit = Math.ceil((earliest - now) / 60000);
                return res.status(400).json({
                    message: `Sesi belum bisa dimulai. Tunggu ${menit} menit lagi (jadwal: ${consultation.scheduledAt.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB)`,
                    scheduledAt: consultation.scheduledAt,
                    earliestStart: earliest
                });
            }
            if (consultation.scheduledEnd && now > consultation.scheduledEnd) {
                return res.status(400).json({ message: 'Waktu konsultasi sudah habis. Sesi tidak bisa dimulai.' });
            }
        }

        const updated = await Consultation.findOneAndUpdate(
            { _id: req.params.id, status: 'confirmed' },
            { $set: { status: 'in_progress', startTime: now } },
            { new: true }
        );

        if (!updated) {
            const fresh = await Consultation.findById(req.params.id);
            if (fresh?.status === 'in_progress') {
                return res.json({ success: true, message: 'Konsultasi sudah berjalan', consultation: fresh });
            }
            return res.status(409).json({ message: 'Status konsultasi sudah berubah, silakan refresh halaman.' });
        }

        await createNotification({
            userId: updated.userId,
            type: 'consultation_started',
            title: 'Konsultasi Dimulai 🩺',
            message: 'Dokter telah memulai sesi konsultasi Anda. Silakan mulai chat.',
            data: { consultationId: updated.id },
            io: req.app.get('io')
        });

        const io = req.app.get('io');
        if (io) {
            io.to(`user-${updated.userId}`).emit('consultation-status-update', {
                consultationId: updated.id.toString(),
                status: 'in_progress',
            });
        }

        res.json({ success: true, message: 'Konsultasi dimulai', consultation: updated });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

router.put('/:id/end', auth, async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id);
        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });

        let isAuthorized = req.userRole === 'admin';
        if (req.userRole === 'doctor') {
            const doctor = await Doctor.findOne({ where: { userId: req.userId } });
            if (doctor && consultation.doctorId.toString() === doctor.id.toString()) {
                isAuthorized = true;
            }
        }

        if (!isAuthorized) {
            return res.status(403).json({ message: 'Hanya dokter yang bersangkutan yang dapat mengakhiri' });
        }

        if (consultation.status !== 'in_progress') {
            return res.status(400).json({ message: `Status harus in_progress, saat ini: ${consultation.status}` });
        }

        const { assessment, plan, objectiveFindings, doctorNotes } = req.body;
        if (!assessment?.trim()) {
            return res.status(400).json({ message: 'Diagnosis (Assessment) wajib diisi sebelum mengakhiri sesi' });
        }
        if (!plan?.trim()) {
            return res.status(400).json({ message: 'Rencana Terapi (Plan) wajib diisi sebelum mengakhiri sesi' });
        }

        const userMessages = consultation.messages.filter(
            m => m.senderId?.toString() === consultation.userId?.toString()
        );
        const finalStatus = userMessages.length === 0 ? 'no_show' : 'completed';
        const now = new Date();

        const updated = await Consultation.findOneAndUpdate(
            { _id: req.params.id, status: 'in_progress' },
            {
                $set: {
                    status: finalStatus,
                    endTime: now,
                    diagnosis: assessment.trim(),
                    medicalRecord: {
                        objectiveFindings: objectiveFindings?.trim() || '',
                        assessment: assessment.trim(),
                        plan: plan.trim(),
                        doctorNotes: doctorNotes?.trim() || '',
                        isCompleted: true,
                        completedAt: now,
                    },
                },
            },
            { new: true }
        );

        if (!updated) {
            return res.status(409).json({ message: 'Status konsultasi sudah berubah, silakan refresh halaman.' });
        }

        await createNotification({
            userId: updated.userId,
            type: 'consultation_ended',
            title: finalStatus === 'no_show' ? 'Sesi Berakhir — Tidak Hadir' : 'Konsultasi Selesai ✅',
            message: finalStatus === 'no_show'
                ? 'Dokter telah mengakhiri sesi namun Anda tidak mengirim pesan. Status: Tidak Hadir.'
                : 'Konsultasi Anda telah selesai. Rekam medis tersedia. Silakan beri rating.',
            data: { consultationId: updated.id },
            io: req.app.get('io')
        });

        const io = req.app.get('io');
        if (io) {
            io.to(`user-${updated.userId}`).emit('consultation-status-update', {
                consultationId: updated.id.toString(),
                status: finalStatus,
            });
            io.to(`consultation-${updated.id}`).emit('medical-record-update', {
                medicalRecord: updated.medicalRecord,
            });
            if (finalStatus === 'completed') {
                io.to(`user-${updated.userId}`).emit('show-rating-modal', {
                    consultationId: updated.id.toString(),
                });
            }
        }

        res.json({ success: true, message: `Konsultasi ${finalStatus}`, consultation: updated });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

router.post('/:id/refund-request', auth, uploadRefundProof.single('proof'), async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id);
        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });
        if (consultation.userId.toString() !== req.userId) return res.status(403).json({ message: 'Akses ditolak' });

        const refundableStatuses = ['cancelled_by_doctor', 'doctor_no_show'];
        if (!refundableStatuses.includes(consultation.status)) {
            return res.status(400).json({ message: 'Refund hanya bisa diajukan untuk konsultasi yang dibatalkan dokter' });
        }

        const { bankCode, accountNumber, accountName } = req.body;
        if (!bankCode || !accountNumber || !accountName) {
            return res.status(400).json({ message: 'Data bank (kode bank, nomor rekening, atas nama) wajib diisi' });
        }

        const io = req.app.get('io');

        // Simpan bank info dulu
        consultation.refund = {
            bankCode,
            accountNumber,
            accountName,
            requestedAt: new Date(),
        };
        consultation.status = 'refund_requested';
        await consultation.save();

        // Langsung jalankan Xendit — tidak perlu tunggu admin
        try {
            await processRefundInternal(consultation.id.toString(), { bankCode, accountNumber, accountName }, io);

            const updated    = await Consultation.findById(consultation.id);
            const method     = updated?.refund?.method;
            const eta        = method === 'xendit_refund' ? 'beberapa menit' : '1×24 jam';

            await createNotification({
                userId : consultation.userId,
                type   : 'refund_processed',
                title  : '💰 Refund Sedang Diproses',
                message: `Refund konsultasi Anda telah diproses via Xendit. Dana akan masuk dalam ${eta}.`,
                data   : { consultationId: consultation.id },
                io,
            });

            return res.json({
                success    : true,
                message    : `Refund berhasil diproses. Dana akan masuk dalam ${eta}.`,
                method,
                consultation: updated,
            });

        } catch (refundErr) {
            // Jika Xendit gagal, status tetap refund_requested — admin bisa retry via process-refund
            console.error('[refund-request] Xendit gagal:', refundErr.message);
            await createNotification({
                userId : consultation.userId,
                type   : 'refund_processed',
                title  : '⏳ Refund Sedang Ditinjau',
                message: 'Permintaan refund Anda diterima. Ada kendala saat memproses otomatis, tim kami akan memproses dalam 1×24 jam.',
                data   : { consultationId: consultation.id },
                io,
            });

            return res.json({
                success: true,
                message: 'Pengajuan refund diterima. Akan diproses dalam 1×24 jam.',
                consultation,
            });
        }

    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

router.put('/:id/process-refund', auth, async (req, res) => {
    try {
        if (req.userRole !== 'admin') return res.status(403).json({ message: 'Akses ditolak' });

        const consultation = await Consultation.findById(req.params.id);
        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });
        if (consultation.status !== 'refund_requested') {
            return res.status(400).json({ message: 'Status harus refund_requested' });
        }

        const { action, failReason } = req.body;
        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({ message: 'action harus approve atau reject' });
        }

        const io = req.app.get('io');

        // ── REJECT ──────────────────────────────────────────────────────────
        if (action === 'reject') {
            consultation.status = 'refund_failed';
            consultation.refund.processedAt = new Date();
            consultation.refund.adminId     = req.userId;
            consultation.refund.failReason  = failReason || 'Refund ditolak oleh admin';
            await consultation.save();

            await createNotification({
                userId: consultation.userId,
                type  : 'refund_processed',
                title : '❌ Refund Ditolak',
                message: `Refund konsultasi ditolak: ${consultation.refund.failReason}`,
                data  : { consultationId: consultation.id },
                io,
            });
            return res.json({ success: true, message: 'Refund ditolak', consultation });
        }

        // ── APPROVE: langsung jalankan Xendit (processRefundInternal) ───────
        const bankInfo = {
            bankCode      : consultation.refund?.bankCode,
            accountNumber : consultation.refund?.accountNumber,
            accountName   : consultation.refund?.accountName,
        };

        try {
            await processRefundInternal(consultation.id.toString(), bankInfo, io);
        } catch (refundErr) {
            console.error('[process-refund] Xendit error:', refundErr.message);
            // Rollback status agar admin bisa coba lagi
            await Consultation.findByIdAndUpdate(consultation.id, { status: 'refund_requested' });
            return res.status(500).json({
                message: 'Gagal memproses refund via Xendit. Coba lagi atau hubungi tim teknis.',
                error  : refundErr.message,
            });
        }

        const updated = await Consultation.findById(consultation.id);
        const method  = updated?.refund?.method;
        const eta     = method === 'xendit_refund' ? 'beberapa menit' : '1×24 jam';

        await createNotification({
            userId : consultation.userId,
            type   : 'refund_processed',
            title  : '💰 Refund Disetujui & Diproses',
            message: `Refund konsultasi Anda telah disetujui dan langsung diproses via Xendit. Dana akan masuk dalam ${eta}.`,
            data   : { consultationId: consultation.id },
            io,
        });

        res.json({ success: true, message: `Refund diproses via Xendit (${method}). Dana masuk dalam ${eta}.`, consultation: updated });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

router.put('/:id/mark-paid', auth, async (req, res) => {
    return res.status(410).json({ message: 'Endpoint ini tidak digunakan lagi. Pembayaran ditangani otomatis oleh Xendit.' });
});

router.put('/:id/no-show', auth, async (req, res) => {
    return res.status(410).json({ message: 'No-show ditentukan otomatis oleh sistem' });
});

router.put('/:id/cancel', auth, async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id);
        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });

        const CANCEL_DEADLINE_MS = 24 * 60 * 60 * 1000;
        const io = req.app.get('io');

        if (req.userRole === 'user' || req.userRole === 'mahasiswa') {
            if (consultation.userId.toString() !== req.userId)
                return res.status(403).json({ message: 'Akses ditolak' });

            if (consultation.status === 'pending_payment') {
                consultation.status = 'expired';
                consultation.cancelledBy = 'user';
                consultation.cancelledAt = new Date();
                await consultation.save();
                await createNotification({ userId: consultation.userId, type: 'consultation_cancelled',
                    title: 'Konsultasi Dibatalkan', message: 'Konsultasi Anda telah dibatalkan.',
                    data: { consultationId: consultation.id }, io });
                return res.json({ success: true, consultation });

            } else if (consultation.status === 'confirmed' || consultation.status === 'cancelled_by_user') {
                if (consultation.status === 'confirmed') {
                    if (!consultation.scheduledAt)
                        return res.status(400).json({ message: 'Data jadwal tidak ditemukan' });
                    const msUntil = new Date(consultation.scheduledAt).getTime() - Date.now();
                    if (msUntil < CANCEL_DEADLINE_MS) {
                        const dl = new Date(new Date(consultation.scheduledAt).getTime() - CANCEL_DEADLINE_MS);
                        return res.status(400).json({
                            message: `Batas pembatalan sudah lewat. Hanya bisa dibatalkan sebelum ${dl.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB.`,
                        });
                    }
                }

                if (consultation.status === 'confirmed') {
                    consultation.status = 'cancelled_by_user';
                    consultation.cancelledBy = 'user';
                    consultation.cancelledAt = new Date();
                    consultation.cancelReason = req.body.reason || 'Dibatalkan oleh pasien';
                    consultation.refund = { requestedAt: new Date(), notes: 'Pembatalan oleh pasien' };
                    await consultation.save();
                }

                const REFUND_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
                const paidAt = consultation.paidAt ? new Date(consultation.paidAt) : null;
                const within7d = paidAt && (Date.now() - paidAt.getTime()) < REFUND_WINDOW_MS;
                const hasBankInfo = req.body.bankCode && req.body.accountNumber && req.body.accountName;

                if (!within7d && !hasBankInfo) {
                    return res.status(200).json({
                        success: true, needsBankInfo: true, consultation,
                        message: 'Masukkan data rekening untuk menerima refund.',
                    });
                }

                try {
                    const refundPayload = {
                        bankCode: req.body.bankCode,
                        accountNumber: req.body.accountNumber,
                        accountName: req.body.accountName,
                    };
                    await processRefundInternal(consultation.id.toString(), refundPayload, io);
                } catch (refundErr) {
                    if (refundErr.message === 'NEED_BANK_INFO') {
                        return res.status(200).json({
                            success: true, needsBankInfo: true, consultation,
                            message: 'Masukkan data rekening untuk menerima refund.',
                        });
                    }
                    console.error('[cancel] refund failed:', refundErr.message);
                    await Consultation.findByIdAndUpdate(consultation.id, { status: 'refund_requested' });
                }

                await createNotification({ userId: consultation.userId, type: 'consultation_cancelled',
                    title: 'Konsultasi Dibatalkan',
                    message: 'Konsultasi Anda dibatalkan. Catatan: biaya layanan payment gateway tidak termasuk dalam refund. Refund akan diproses dalam 1x24 jam.',
                    data: { consultationId: consultation.id }, io });
                return res.json({ success: true, consultation: await Consultation.findById(consultation.id) });

            } else {
                return res.status(400).json({ message: `Tidak bisa membatalkan konsultasi dengan status: ${consultation.status}` });
            }

        } else if (req.userRole === 'admin') {
            const cancellable = ['confirmed', 'waiting_verification', 'pending_payment'];
            if (!cancellable.includes(consultation.status))
                return res.status(400).json({ message: `Tidak bisa batalkan dari status ${consultation.status}` });

            const wasPaid = consultation.status === 'confirmed' && consultation.paidAt;
            consultation.status = 'cancelled_by_admin';
            consultation.cancelledBy = 'admin';
            consultation.cancelledAt = new Date();
            consultation.cancelReason = req.body.reason || '';
            consultation.refund = { requestedAt: new Date(), notes: 'Dibatalkan oleh admin' };
            await consultation.save();

            if (wasPaid) {
                try { await processRefundInternal(consultation.id.toString(), {}, io); }
                catch (e) { console.error('[admin cancel] refund failed:', e.message); }
            }

            await createNotification({ userId: consultation.userId, type: 'consultation_cancelled',
                title: 'Konsultasi Dibatalkan oleh Admin',
                message: wasPaid ? 'Konsultasi Anda dibatalkan. Refund akan diproses dalam 1x24 jam.' : 'Konsultasi Anda telah dibatalkan.',
                data: { consultationId: consultation.id }, io });
            return res.json({ success: true, consultation });

        } else {
            return res.status(403).json({ message: 'Akses ditolak' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

router.put('/:id/reschedule', auth, async (req, res) => {
    try {
        const { scheduledAt, scheduledEnd } = req.body;
        if (!scheduledAt || !scheduledEnd)
            return res.status(400).json({ message: 'scheduledAt dan scheduledEnd wajib diisi' });

        const consultation = await Consultation.findById(req.params.id);
        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });
        if (consultation.userId.toString() !== req.userId)
            return res.status(403).json({ message: 'Akses ditolak' });

        const reschedulableFromUser = ['confirmed'];
        const reschedulableAfterCancel = ['doctor_no_show', 'cancelled_by_doctor', 'cancelled_by_admin'];
        const allReschedulable = [...reschedulableFromUser, ...reschedulableAfterCancel];

        if (!allReschedulable.includes(consultation.status))
            return res.status(400).json({ message: `Tidak bisa reschedule dari status: ${consultation.status}` });

        if (reschedulableFromUser.includes(consultation.status)) {
            if ((consultation.rescheduleHistory || []).length >= 1) {
                return res.status(400).json({ message: 'Reschedule hanya bisa dilakukan 1 kali.' });
            }
        }

        const newSlot = new Date(scheduledAt);
        const newSlotEnd = new Date(scheduledEnd);
        const now = new Date();

        if (reschedulableFromUser.includes(consultation.status)) {
            const msUntil = new Date(consultation.scheduledAt).getTime() - now.getTime();
            if (msUntil < 24 * 60 * 60 * 1000) {
                return res.status(400).json({ message: 'Reschedule hanya bisa dilakukan minimal 24 jam sebelum jadwal.' });
            }
        }

        if (newSlot.getTime() - now.getTime() < 20 * 60 * 1000)
            return res.status(400).json({ message: 'Slot baru harus minimal 20 menit dari sekarang.' });

        const DoctorAvailability = require('../models/DoctorAvailability');
        const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
        const avail = await DoctorAvailability.findOne({ doctorId: consultation.doctorId });
        if (!avail || !avail.isWeekActive())
            return res.status(400).json({ message: 'Dokter belum merilis jadwal untuk minggu ini.' });

        if (newSlot < avail.weekStart || newSlot > avail.weekEnd)
            return res.status(400).json({ message: 'Slot baru di luar rentang jadwal minggu ini.' });

        const slotWIB = new Date(newSlot.getTime() + WIB_OFFSET_MS);
        const dow = slotWIB.getUTCDay();
        const slotHHMM = `${String(slotWIB.getUTCHours()).padStart(2, '0')}:${String(slotWIB.getUTCMinutes()).padStart(2, '0')}`;
        if (dow === 0) return res.status(400).json({ message: 'Konsultasi tidak tersedia hari Minggu.' });
        if (!avail.isSlotActive(dow, slotHHMM))
            return res.status(400).json({ message: 'Slot tidak tersedia pada hari tersebut.' });

        const slotConflict = await Consultation.findOne({
            doctorId: consultation.doctorId,
            scheduledAt: newSlot,
            status: { $in: ['pending_payment', 'waiting_verification', 'confirmed', 'in_progress'] },
            _id: { $ne: consultation.id },
        });
        if (slotConflict) return res.status(409).json({ message: 'Slot ini baru saja diambil orang lain. Pilih slot lain.' });

        const io = req.app.get('io');
        const updated = await Consultation.findOneAndUpdate(
            { _id: consultation.id },
            {
                $set: { status: 'confirmed', scheduledAt: newSlot, scheduledEnd: newSlotEnd, postCancelChoice: 'reschedule' },
                $push: { rescheduleHistory: { from: { scheduledAt: consultation.scheduledAt, scheduledEnd: consultation.scheduledEnd }, to: { scheduledAt: newSlot, scheduledEnd: newSlotEnd } } },
            },
            { new: true }
        );

        await createNotification({ userId: consultation.userId, type: 'appointment_reminder',
            title: '🔄 Jadwal Konsultasi Diubah',
            message: `Konsultasi Anda dijadwalkan ulang ke ${_fmtWIB(newSlot)}.`,
            data: { consultationId: consultation.id }, io });

        const doctorData = await Doctor.findByPk(consultation.doctorId);
        if (doctorData?.userId) {
            await createNotification({ userId: doctorData.userId, type: 'appointment_reminder',
                title: '🔄 Pasien Reschedule', message: `Pasien mengubah jadwal konsultasi ke ${_fmtWIB(newSlot)}.`,
                data: { consultationId: consultation.id }, io });
        }
        if (io) io.to(`user-${consultation.userId}`).emit('consultation-status-update', { consultationId: consultation.id.toString(), status: 'confirmed' });

        res.json({ success: true, consultation: updated });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

function _fmtWIB(d) {
    return new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB';
}

async function processRefundInternal(consultationId, bankInfo = {}, io = null) {
    const axios = require('axios');
    const XENDIT_SECRET_KEY = process.env.XENDIT_SECRET_KEY;
    const headers = { Authorization: 'Basic ' + Buffer.from(XENDIT_SECRET_KEY + ':').toString('base64'), 'Content-Type': 'application/json' };
    const REFUND_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

    const consultation = await Consultation.findById(consultationId);
    if (!consultation) throw new Error('Konsultasi tidak ditemukan');

    let amount = consultation.amount;
    if (!amount) {
        const doctorData = await Doctor.findByPk(consultation.doctorId);
        amount = doctorData?.consultationFee;
    }

    if (!amount) throw new Error('Nominal refund tidak diketahui');

    const paidAt = consultation.paidAt ? new Date(consultation.paidAt) : null;
    const isWithin7d = consultation.xenditInvoiceId && (!paidAt || (Date.now() - paidAt.getTime()) < REFUND_WINDOW_MS);

    if (isWithin7d && consultation.xenditInvoiceId) {
        try {
            const r = await axios.post('https://api.xendit.co/refunds',
                { invoice_id: consultation.xenditInvoiceId, reason: 'CANCELLATION', amount },
                { headers: { ...headers, 'idempotency-key': `REFUND-${consultation.id}-${Date.now()}` } }
            );
            await Consultation.findByIdAndUpdate(consultationId, {
                status: 'refunded', 'refund.xenditRefundId': r.data.id, 'refund.method': 'xendit_refund', 'refund.processedAt': new Date(),
            });
        } catch (xenditErr) {
            const errCode = xenditErr.response?.data?.error_code;
            if (errCode === 'REFUND_NOT_SUPPORTED' || errCode === 'CHANNEL_NOT_SUPPORTED') {
                if (bankInfo.bankCode && bankInfo.accountNumber && bankInfo.accountName) {
                    const r2 = await axios.post('https://api.xendit.co/disbursements',
                        { external_id: `DISB-${consultation.id}-${Date.now()}`, bank_code: bankInfo.bankCode, account_holder_name: bankInfo.accountName, account_number: bankInfo.accountNumber, description: `Refund konsultasi`, amount },
                        { headers: { ...headers, 'X-IDEMPOTENCY-KEY': `DISB-${consultation.id}-${Date.now()}` } }
                    );
                    await Consultation.findByIdAndUpdate(consultationId, {
                        status: 'refunded', 'refund.xenditDisbursementId': r2.data.id, 'refund.method': 'xendit_disbursement',
                        'refund.bankCode': bankInfo.bankCode, 'refund.accountNumber': bankInfo.accountNumber, 'refund.accountName': bankInfo.accountName, 'refund.processedAt': new Date(),
                    });
                } else {
                    throw new Error('NEED_BANK_INFO');
                }
            } else {
                throw new Error(`Xendit Refund failed: ${JSON.stringify(xenditErr.response?.data || xenditErr.message)}`);
            }
        }
    } else if (bankInfo.bankCode && bankInfo.accountNumber && bankInfo.accountName) {
        const r = await axios.post('https://api.xendit.co/disbursements',
            { external_id: `DISB-${consultation.id}-${Date.now()}`, bank_code: bankInfo.bankCode, account_holder_name: bankInfo.accountName, account_number: bankInfo.accountNumber, description: `Refund konsultasi`, amount },
            { headers: { ...headers, 'X-IDEMPOTENCY-KEY': `DISB-${consultation.id}-${Date.now()}` } }
        );
        await Consultation.findByIdAndUpdate(consultationId, {
            status: 'refunded', 'refund.xenditDisbursementId': r.data.id, 'refund.method': 'xendit_disbursement',
            'refund.bankCode': bankInfo.bankCode, 'refund.accountNumber': bankInfo.accountNumber, 'refund.accountName': bankInfo.accountName, 'refund.processedAt': new Date(),
        });
    } else {
        throw new Error('NEED_BANK_INFO');
    }

    if (io) io.to(`user-${consultation.userId}`).emit('consultation-status-update', { consultationId: consultation.id.toString(), status: 'refunded' });
    await createNotification({ userId: consultation.userId, type: 'refund_processed', title: '💰 Refund Diproses',
        message: `Refund Rp ${amount.toLocaleString('id-ID')} sedang diproses dan akan masuk ke rekening Anda dalam 1x24 jam.`,
        data: { consultationId: consultation.id }, io });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. CHAT & UPLOAD FOTO
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/:id/messages', auth, async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id);
        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });

        if (!['confirmed', 'in_progress', 'paid', 'scheduled', 'ongoing'].includes(consultation.status)) {
            return res.status(403).json({ message: 'Konsultasi tidak aktif. Pesan hanya bisa dikirim saat konsultasi sedang berlangsung.' });
        }

        const patient = await User.findByPk(consultation.userId);
        const doctor = await Doctor.findByPk(consultation.doctorId);

        const isUser = patient && patient.id.toString() === req.userId;
        const isDrThis = doctor && doctor.userId.toString() === req.userId;

        if (!isUser && !isDrThis && req.userRole !== 'admin') {
            return res.status(403).json({ message: 'Anda bukan peserta konsultasi ini' });
        }

        const senderRole = isUser ? 'user' : 'doctor';
        const senderName = isUser ? patient.name : `${fmtDoctorName(doctor)}`;

        const msg = {
            senderId: req.userId,
            senderName,
            senderRole,
            message: req.body.message,
            timestamp: new Date()
        };

        consultation.messages.push(msg);
        await consultation.save();

        const recipientId = isUser ? doctor.userId : patient.id;
        await createNotification({
            userId: recipientId,
            type: 'new_message',
            title: 'Pesan Baru',
            message: `${senderName}: ${req.body.message?.substring(0, 60)}`,
            data: { consultationId: consultation.id },
            io: req.app.get('io')
        });

        res.json({ success: true, message: msg });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/:id/messages/image', auth, uploadChat.single('image'), async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id);
        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });
        if (!['confirmed', 'in_progress', 'paid', 'scheduled', 'ongoing'].includes(consultation.status)) {
            return res.status(403).json({ message: 'Konsultasi tidak aktif. Pesan hanya bisa dikirim saat konsultasi sedang berlangsung.' });
        }
        if (!req.file) return res.status(400).json({ message: 'File tidak ditemukan' });

        const patient = await User.findByPk(consultation.userId);
        const doctor = await Doctor.findByPk(consultation.doctorId);

        const isUser = patient && patient.id.toString() === req.userId;
        const isDrThis = doctor && doctor.userId.toString() === req.userId;

        if (!isUser && !isDrThis && req.userRole !== 'admin') {
            return res.status(403).json({ message: 'Anda bukan peserta konsultasi ini' });
        }

        const senderName = isUser ? patient.name : `${fmtDoctorName(doctor)}`;
        const imageUrl = req.file.path;

        const msg = {
            senderId: req.userId,
            senderName,
            senderRole: isUser ? 'user' : 'doctor',
            message: req.body.caption || '',
            imageUrl,
            timestamp: new Date()
        };

        consultation.messages.push(msg);
        await consultation.save();

        const io = req.app.get('io');
        if (io) {
            io.to(`consultation-${consultation.id}`).emit('receive-message', {
                ...msg,
                senderId: req.userId
            });
        }

        res.json({ success: true, message: msg });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ── POST /:id/messages/file — upload PDF ke chat ──────────────────────────────
router.post('/:id/messages/file', auth, uploadChatFile.single('file'), async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id);
        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });
        if (!['confirmed', 'in_progress', 'paid', 'scheduled', 'ongoing'].includes(consultation.status)) {
            return res.status(403).json({ message: 'Konsultasi tidak aktif.' });
        }
        if (!req.file) return res.status(400).json({ message: 'File tidak ditemukan' });

        const patient  = await User.findByPk(consultation.userId);
        const doctor   = await Doctor.findByPk(consultation.doctorId);
        const isUser   = patient && patient.id.toString() === req.userId;
        const isDrThis = doctor  && doctor.userId.toString() === req.userId;

        if (!isUser && !isDrThis && req.userRole !== 'admin') {
            return res.status(403).json({ message: 'Anda bukan peserta konsultasi ini' });
        }

        const senderName = isUser ? patient.name : `${fmtDoctorName(doctor)}`;
        const fileUrl    = req.file.path;
        const fileName   = req.file.originalname || 'dokumen.pdf';

        const msg = {
            senderId:   req.userId,
            senderName,
            senderRole: isUser ? 'user' : 'doctor',
            message:    req.body.caption || '',
            fileUrl,
            fileName,
            timestamp:  new Date(),
        };

        consultation.messages.push(msg);
        await consultation.save();

        const io = req.app.get('io');
        if (io) {
            io.to(`consultation-${consultation.id}`).emit('receive-message', {
                ...msg,
                senderId: req.userId,
            });
        }

        res.json({ success: true, message: msg });
    } catch (err) {
        console.error('[messages/file]', err.message);
        res.status(500).json({ message: 'Gagal upload file' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. RESEP DIGITAL TERSTRUKTUR (dokter)
// ═══════════════════════════════════════════════════════════════════════════════

router.put('/:id/prescription', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ where: { userId: req.userId } });
        if (!doctor) return res.status(404).json({ message: 'Data dokter tidak ditemukan' });

        const consultation = await Consultation.findById(req.params.id);
        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });
        if (consultation.doctorId.toString() !== doctor.id.toString()) {
            return res.status(403).json({ message: 'Anda bukan dokter konsultasi ini' });
        }
        const allowedStatuses = ['in_progress', 'ongoing', 'completed', 'no_show'];
        if (!allowedStatuses.includes(consultation.status)) {
            return res.status(400).json({ message: 'Resep hanya bisa dikirim saat konsultasi berlangsung atau selesai' });
        }

        if (req.body.medicines && Array.isArray(req.body.medicines)) {
            const count = await require('../models/Consultation').countDocuments({ 'prescriptionData.prescriptionNumber': { $exists: true } });
            const rxNum = 'RX-' + Date.now().toString().slice(-6) + '-' + (count + 1).toString().padStart(3, '0');
            const issuedAt = new Date();
            const validUntil = new Date(issuedAt.getTime() + 7 * 24 * 60 * 60 * 1000);

            consultation.prescriptionData = {
                prescriptionNumber: rxNum,
                issuedAt,
                validUntil,
                patientAge: req.body.patientAge || '',
                patientGender: req.body.patientGender || '',
                patientWeight: req.body.patientWeight || '',
                medicines: req.body.medicines,
                doctorNotes: req.body.doctorNotes || '',
                isUsed: false,
            };
            consultation.prescription = req.body.medicines.map((m, i) =>
                `${i + 1}. ${m.name}${m.dose ? ' ' + m.dose : ''} — ${m.frequency || ''} ${m.instructions ? '(' + m.instructions + ')' : ''}`
            ).join('\n');
        } else {
            consultation.prescription = req.body.prescription;
        }

        if (req.body.diagnosis) consultation.diagnosis = req.body.diagnosis;
        await consultation.save();

        await createNotification({
            userId: consultation.userId,
            type: 'prescription_sent',
            title: 'Resep Digital Diterbitkan 💊',
            message: `${fmtDoctorName(doctor)} telah menerbitkan resep untuk Anda. Berlaku 7 hari, 1x pembelian.`,
            data: { consultationId: consultation.id },
            io: req.app.get('io')
        });

        const io = req.app.get('io');
        if (io) {
            io.to(`consultation-${consultation.id}`).emit('prescription-update', {
                prescription: consultation.prescription,
                prescriptionData: consultation.prescriptionData,
                diagnosis: consultation.diagnosis
            });
        }

        res.json({ success: true, prescription: consultation.prescription, prescriptionData: consultation.prescriptionData });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

router.get('/:id/prescription/pdf', auth, async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id);
        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });

        const isAuthorized = await canAccess(consultation, req.userId, req.userRole);
        if (!isAuthorized) return res.status(403).json({ message: 'Akses ditolak' });

        const rx = consultation.prescriptionData;
        if (!rx && !consultation.prescription) return res.status(404).json({ message: 'Resep tidak ditemukan' });

        const patient = await User.findByPk(consultation.userId);
        const doctor = await Doctor.findByPk(consultation.doctorId);

        const ClinicSettings = require('../models/ClinicSettings');
        const clinicSettings = await ClinicSettings.findOne({ key: 'main' }) || {};
        const clinicName = clinicSettings.clinicName || 'Klinik Pratama IPB';
        const clinicAddress = clinicSettings.clinicAddress || 'Bogor, Jawa Barat';
        const signLocation  = clinicSettings.signLocation  || 'Bogor';

        const logoBuf     = await fetchImageBuffer(clinicSettings.logoUrl, 'Logo klinik');
        const signatureBuf = await fetchImageBuffer(doctor?.signatureUrl, 'Tanda tangan dokter');

        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=resep-${rx?.prescriptionNumber || consultation.id}.pdf`);
        doc.on('error', (pdfErr) => {
            console.error('[prescription/pdf] PDFDocument error:', pdfErr);
            if (!res.headersSent) res.status(500).json({ message: 'Gagal generate PDF resep', error: pdfErr.message });
            else res.destroy();
        });
        doc.pipe(res);

        // ──────────────────────────────────────────────────────────────────────
        // HEADER
        // ──────────────────────────────────────────────────────────────────────
        const headerStartX = 50;
        const headerStartY = doc.y;
        const logoSize = 55;

        if (logoBuf) {
            try {
                doc.image(logoBuf, headerStartX, headerStartY, { height: logoSize, width: logoSize });
            } catch (imgErr) {
                console.warn('[prescription/pdf] Failed to load logo:', imgErr.message);
            }
        }

        const headerTextStartY = headerStartY;
        const addressParts = parseAddress(clinicAddress);
        const clinicPhoneDisplay = clinicSettings.clinicPhone || '(62251) 8422094';
        
        doc.font('Times-Bold').fontSize(14).text(clinicName, 50, headerTextStartY, { align: 'center', width: 500 });
        doc.font('Times-Roman').fontSize(10).text(addressParts.street, 50, headerTextStartY + 16, { align: 'center', width: 500 });
        if (addressParts.city_province) {
            doc.font('Times-Roman').fontSize(10).text(addressParts.city_province, 50, headerTextStartY + 28, { align: 'center', width: 500 });
        }
        doc.font('Times-Roman').fontSize(10).text(`Telp. ${clinicPhoneDisplay}`, 50, headerTextStartY + 40, { align: 'center', width: 500 });
        doc.fontSize(10).text(`${rx.prescriptionNumber}`, 50, doc.y, { align: 'center' });

        doc.y = headerStartY + logoSize + 5;
        doc.moveDown(0.2);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(0.6);

        // ──────────────────────────────────────────────────────────────────────
        // TITLE
        // ──────────────────────────────────────────────────────────────────────
        doc.font('Times-Bold').fontSize(12).text('RESEP DIGITAL', { align: 'center' });
        doc.moveDown(0.5);

        // ──────────────────────────────────────────────────────────────────────
        // PATIENT INFO
        // ──────────────────────────────────────────────────────────────────────
        const labelX = 50;
        const valueX = 130;
        doc.font('Times-Roman').fontSize(11);
        
        doc.text('Nama', labelX, doc.y, { width: 100 });
        doc.text(`: ${patient?.name || 'Pasien'}`, valueX, doc.y - 14);
        doc.moveDown(0.4);
        
        if (rx?.patientAge) {
            doc.text('Umur', labelX, doc.y, { width: 100 });
            doc.text(`: ${rx.patientAge}`, valueX, doc.y - 14);
            doc.moveDown(0.4);
        }
        
        if (rx?.patientGender) {
            doc.text('Jenis Kelamin', labelX, doc.y, { width: 100 });
            doc.text(`: ${rx.patientGender}`, valueX, doc.y - 14);
            doc.moveDown(0.4);
        }
        
        if (rx?.patientWeight) {
            doc.text('Berat Badan', labelX, doc.y, { width: 100 });
            doc.text(`: ${rx.patientWeight}`, valueX, doc.y - 14);
            doc.moveDown(0.4);
        }

        doc.moveDown(0.3);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(0.5);

        // ──────────────────────────────────────────────────────────────────────
        // MEDICINES - R/
        // ──────────────────────────────────────────────────────────────────────
        doc.font('Times-Bold').fontSize(11).text('R/', 50);
        doc.moveDown(0.3);

        if (rx?.medicines?.length > 0) {
            rx.medicines.forEach((m, i) => {
                // Nama obat - Times-Bold size 11
                doc.font('Times-Bold').fontSize(11).text(`${i + 1}. ${m.name}${m.dose ? ' ' + m.dose : ''}${m.form ? ' ' + m.form : ''}`, 50);
                
                // Dosis, Cara Pakai, Jumlah - SEJAJAR
                const dosisX = 70;
                const caraX = 250;
                const jumlahX = 430;
                let medicineY = doc.y;
                
                doc.font('Times-Roman').fontSize(10);
                if (m.frequency) {
                    doc.text('Dosis', dosisX, medicineY, { width: 170 });
                    if (m.instructions) doc.text('Cara Pakai', caraX, medicineY, { width: 170 });
                    if (m.quantity) doc.text('Jumlah', jumlahX, medicineY, { width: 100 });
                    medicineY += 12;
                    
                    doc.text(`: ${m.frequency}`, dosisX, medicineY, { width: 170 });
                    if (m.instructions) doc.text(`: ${m.instructions}`, caraX, medicineY, { width: 170 });
                    if (m.quantity) doc.text(`: ${m.quantity}`, jumlahX, medicineY, { width: 100 });
                } else {
                    if (m.instructions) doc.text('Cara Pakai', caraX, medicineY, { width: 170 });
                    if (m.quantity) doc.text('Jumlah', jumlahX, medicineY, { width: 100 });
                    medicineY += 12;
                    if (m.instructions) doc.text(`: ${m.instructions}`, caraX, medicineY, { width: 170 });
                    if (m.quantity) doc.text(`: ${m.quantity}`, jumlahX, medicineY, { width: 100 });
                }
                doc.moveDown(0.3);
            });
        } else if (consultation.prescription) {
            doc.font('Times-Roman').fontSize(11).text(consultation.prescription, 50, doc.y, { width: 500 });
        }

        doc.moveDown(0.4);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(0.4);

        // ──────────────────────────────────────────────────────────────────────
        // CATATAN DOKTER & DIAGNOSIS
        // Catatan Dokter: Rata KIRI, Times-Roman size 11 (TIDAK BOLD)
        // ──────────────────────────────────────────────────────────────────────
        // if (rx?.doctorNotes || consultation.diagnosis) {
        //     // Label "Catatan Dokter" - Rata kiri, Times-Roman (TIDAK BOLD)
        //     doc.font('Times-Roman').fontSize(11).text('Catatan Dokter', 50);
            
        //     // Diagnosis - Rata kiri, Times-Roman
        //     if (consultation.diagnosis) {
        //         doc.font('Times-Roman').fontSize(11).text(`Diagnosis: ${consultation.diagnosis}`, 50, doc.y, { width: 500 });
        //     }
            
        //     // Doctor Notes - Rata kiri, Times-Roman
        //     if (rx?.doctorNotes) {
        //         doc.font('Times-Roman').fontSize(11).text(rx.doctorNotes, 50, doc.y, { width: 500 });
        //     }
        //     doc.moveDown(0.4);
        // }

        doc.moveDown(1.5);

        // ──────────────────────────────────────────────────────────────────────
        // TANGGAL DAN TANDA TANGAN - GESER KE KANAN
        // ──────────────────────────────────────────────────────────────────────
        const tglResep = rx?.issuedAt ? new Date(rx.issuedAt) : new Date();
        const signatureX = 380;
        const signatureWidth = 160;
        
        doc.font('Times-Roman').fontSize(11);
        doc.text(`${signLocation}, ${tglResep.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 
            signatureX, doc.y, { width: signatureWidth, align: 'center' });
        doc.moveDown(1.6);

        const signY = doc.y;
        const imgSize = 65;

        if (signatureBuf) {
            try {
                const sigImgX = signatureX + (signatureWidth - imgSize) / 2;
                doc.image(signatureBuf, sigImgX, signY, { width: imgSize, height: imgSize });
                const nameY = signY + imgSize + 3;
                doc.fontSize(10).font('Times-Bold').text(`${fmtDoctorName(doctor)}`, signatureX, nameY, { width: signatureWidth, align: 'center' });
                // SPESIALISASI DOKTER DIHAPUS
                // if (doctor?.specialization) {
                //     doc.fontSize(9).font('Times-Roman').text(doctor.specialization, signatureX, nameY + 12, { width: signatureWidth, align: 'center' });
                // }
            } catch (imgErr) {
                console.warn('[prescription/pdf] Failed to load signature:', imgErr.message);
                doc.font('Times-Bold').fontSize(10).text(`${fmtDoctorName(doctor)}`, signatureX, signY, { width: signatureWidth, align: 'center' });
                // SPESIALISASI DOKTER DIHAPUS
                // if (doctor?.specialization) {
                //     doc.fontSize(9).font('Times-Roman').text(doctor.specialization, signatureX, signY + 14, { width: signatureWidth, align: 'center' });
                // }
            }
        } else {
            doc.font('Times-Bold').fontSize(10).text(`${fmtDoctorName(doctor)}`, signatureX, signY, { width: signatureWidth, align: 'center' });
            // SPESIALISASI DOKTER DIHAPUS
            // if (doctor?.specialization) {
            //     doc.fontSize(9).font('Times-Roman').text(doctor.specialization, signatureX, signY + 14, { width: signatureWidth, align: 'center' });
            // }
        }

        doc.moveDown(0.8);
        doc.fontSize(8).fillColor('#666').text('*Resep berlaku 7 hari dan hanya dapat digunakan 1x pembelian.', 50, doc.y, { width: 500, align: 'center' });

        doc.end();
    } catch (err) {
        console.error('[prescription/pdf] error:', err);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Gagal generate PDF resep', error: err.message });
        } else {
            res.destroy();
        }
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5b. REKAM MEDIS (SOAP)
// ═══════════════════════════════════════════════════════════════════════════════

router.put('/:id/medical-record', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ where: { userId: req.userId } });
        if (!doctor) return res.status(404).json({ message: 'Data dokter tidak ditemukan' });

        const consultation = await Consultation.findById(req.params.id);
        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });
        if (consultation.doctorId.toString() !== doctor.id.toString()) {
            return res.status(403).json({ message: 'Anda bukan dokter konsultasi ini' });
        }
        const allowedStatuses = ['in_progress', 'ongoing', 'completed', 'no_show'];
        if (!allowedStatuses.includes(consultation.status)) {
            return res.status(400).json({ message: 'Rekam medis hanya bisa diisi saat/setelah konsultasi berlangsung' });
        }

        const { objectiveFindings, assessment, plan, doctorNotes, markComplete } = req.body;

        consultation.medicalRecord = {
            objectiveFindings: objectiveFindings || '',
            assessment: assessment || '',
            plan: plan || '',
            doctorNotes: doctorNotes || '',
            isCompleted: markComplete === true || markComplete === 'true',
            completedAt: (markComplete === true || markComplete === 'true') ? new Date() : consultation.medicalRecord?.completedAt,
        };

        if (assessment) consultation.diagnosis = assessment;

        await consultation.save();

        const io = req.app.get('io');
        if (io) {
            io.to(`consultation-${consultation.id}`).emit('medical-record-update', {
                medicalRecord: consultation.medicalRecord
            });
        }

        res.json({ success: true, medicalRecord: consultation.medicalRecord });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

router.get('/:id/medical-record/pdf', auth, async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id);
        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });
 
        const isAuthorized = await canAccess(consultation, req.userId, req.userRole);
        if (!isAuthorized) return res.status(403).json({ message: 'Akses ditolak' });
 
        const mr = consultation.medicalRecord;
        if (!mr) return res.status(404).json({ message: 'Rekam medis belum dibuat' });
 
        const patient = await User.findByPk(consultation.userId);
        const doctor = await Doctor.findByPk(consultation.doctorId);
 
        const ClinicSettings = require('../models/ClinicSettings');
        const clinicSettings = await ClinicSettings.findOne({ key: 'main' }) || {};
        const clinicName = clinicSettings.clinicName || 'Klinik Pratama IPB';
        const clinicAddress = clinicSettings.clinicAddress || 'Bogor, Jawa Barat';
        const signLocation  = clinicSettings.signLocation  || 'Bogor';
 
        const logoBuf      = await fetchImageBuffer(clinicSettings.logoUrl, 'Logo klinik');
        const signatureBuf = await fetchImageBuffer(doctor?.signatureUrl, 'Tanda tangan dokter');
 
        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=rekam-medis-${consultation.id}.pdf`);
        doc.on('error', (pdfErr) => {
            console.error('[medical-record/pdf] PDFDocument error:', pdfErr);
            if (!res.headersSent) res.status(500).json({ message: 'Gagal generate PDF rekam medis', error: pdfErr.message });
            else res.destroy();
        });
        doc.pipe(res);
 
        // ──────────────────────────────────────────────────────────────────────
        // HEADER
        // ──────────────────────────────────────────────────────────────────────
        const headerStartX = 50;
        const headerStartY = doc.y;
        const logoSize = 55;
 
        if (logoBuf) {
            try {
                doc.image(logoBuf, headerStartX, headerStartY, { height: logoSize, width: logoSize });
            } catch (imgErr) {
                console.warn('[medical-record/pdf] Failed to load logo:', imgErr.message);
            }
        }
 
        const headerTextStartY = headerStartY;
        const addressParts = parseAddress(clinicAddress);
        const clinicPhone = clinicSettings.clinicPhone || '(62251) 8422094';
        
        doc.font('Times-Bold').fontSize(14).text(clinicName, 50, headerTextStartY, { align: 'center', width: 500 });
        doc.font('Times-Roman').fontSize(10).text(addressParts.street, 50, headerTextStartY + 16, { align: 'center', width: 500 });
        if (addressParts.city_province) {
            doc.font('Times-Roman').fontSize(10).text(addressParts.city_province, 50, headerTextStartY + 28, { align: 'center', width: 500 });
        }
        doc.font('Times-Roman').fontSize(10).text(`Telp. ${clinicPhone}`, 50, headerTextStartY + 40, { align: 'center', width: 500 });
 
        doc.y = headerStartY + logoSize + 5;
        
        doc.moveDown(0.2);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(0.6);
 
        // ──────────────────────────────────────────────────────────────────────
        // TITLE
        // ──────────────────────────────────────────────────────────────────────
        doc.font('Times-Bold').fontSize(12).text('REKAM MEDIS', { align: 'center' });
        doc.moveDown(0.5);
 
        const tgl = new Date(consultation.endTime || consultation.scheduledAt || consultation.createdAt)
            .toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
 
        // ──────────────────────────────────────────────────────────────────────
        // PATIENT INFO - ALL SIZE 11
        // ──────────────────────────────────────────────────────────────────────
        const labelX = 50;
        const valueX = 130;
        doc.font('Times-Roman').fontSize(11);
        
        doc.text('Pasien', labelX, doc.y, { width: 100 });
        doc.text(`: ${patient?.name || 'Pasien'}`, valueX, doc.y - 14);
        doc.moveDown(0.4);
        
        doc.text('ID Pasien', labelX, doc.y, { width: 100 });
        doc.text(`: ${consultation.userId.toString().slice(-8).toUpperCase()}`, valueX, doc.y - 14);
        doc.moveDown(0.4);
        
        doc.text('Tanggal', labelX, doc.y, { width: 100 });
        doc.text(`: ${tgl}`, valueX, doc.y - 14);
        doc.moveDown(0.4);
        
        doc.text('Dokter', labelX, doc.y, { width: 100 });
        doc.text(`: ${fmtDoctorName(doctor)}`, valueX, doc.y - 14);
        doc.moveDown(0.4);
        
        if (doctor?.specialization) {
            doc.text('Spesialisasi', labelX, doc.y, { width: 100 });
            doc.text(`: ${doctor.specialization}`, valueX, doc.y - 14);
            doc.moveDown(0.4);
        }
        
        doc.moveDown(0.3);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(0.5);
 
        // ──────────────────────────────────────────────────────────────────────
        // SOAP SECTIONS - CLEAN LABELS, ALL SIZE 11
        // Labels: Subjective, Objective, Assessment, Plan (tanpa prefix S/O/A/P)
        // ──────────────────────────────────────────────────────────────────────
        
        // SUBJECTIVE
        doc.font('Times-Bold').fontSize(11).text('Subjective', 50);
        doc.font('Times-Roman').fontSize(11).text(consultation.symptoms || '-', 50, doc.y, { width: 500 });
        doc.moveDown(0.4);
        
        if (consultation.medicalHistory) {
            doc.font('Times-Bold').fontSize(11).text('Riwayat Penyakit', 50);
            doc.font('Times-Roman').fontSize(11).text(consultation.medicalHistory, 50, doc.y, { width: 500 });
            doc.moveDown(0.4);
        }
        
        // OBJECTIVE
        doc.font('Times-Bold').fontSize(11).text('Objective', 50);
        doc.font('Times-Roman').fontSize(11).text(mr.objectiveFindings || '-', 50, doc.y, { width: 500 });
        doc.moveDown(0.4);
        
        // ASSESSMENT
        doc.font('Times-Bold').fontSize(11).text('Assessment', 50);
        doc.font('Times-Roman').fontSize(11).text(mr.assessment || '-', 50, doc.y, { width: 500 });
        doc.moveDown(0.4);
        
        // PLAN
        doc.font('Times-Bold').fontSize(11).text('Plan', 50);
        doc.font('Times-Roman').fontSize(11).text(mr.plan || '-', 50, doc.y, { width: 500 });
        doc.moveDown(0.4);
        
        // CATATAN DOKTER (Optional)
        if (mr.doctorNotes) {
            doc.font('Times-Bold').fontSize(11).text('Catatan Dokter', 50);
            doc.font('Times-Roman').fontSize(11).text(mr.doctorNotes, 50, doc.y, { width: 500 });
            doc.moveDown(0.4);
        }
 
        doc.moveDown(0.8);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(0.4);
        
        // ──────────────────────────────────────────────────────────────────────
        // TANGGAL DAN TANDA TANGAN - GESER KE KANAN
        // ──────────────────────────────────────────────────────────────────────
        const tglRekamMedis = mr.completedAt ? new Date(mr.completedAt) : new Date(consultation.endTime || consultation.scheduledAt || consultation.createdAt);        const signatureX = 380;
        const signatureWidth = 160;
        
        doc.font('Times-Roman').fontSize(11);
        doc.text(`${signLocation}, ${tglRekamMedis.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 
            signatureX, doc.y, { width: signatureWidth, align: 'center' });
        doc.moveDown(1.6);
 
        const signY = doc.y;
        const imgSize = 65;
 
        if (signatureBuf) {
            try {
                const sigImgX = signatureX + (signatureWidth - imgSize) / 2;
                doc.image(signatureBuf, sigImgX, signY, { width: imgSize, height: imgSize });
                const nameY = signY + imgSize + 3;
                doc.fontSize(10).font('Times-Bold').text(`${fmtDoctorName(doctor)}`, signatureX, nameY, { width: signatureWidth, align: 'center' });
                if (doctor?.specialization) {
                    doc.fontSize(9).font('Times-Roman').text(doctor.specialization, signatureX, nameY + 12, { width: signatureWidth, align: 'center' });
                }
            } catch (imgErr) {
                console.warn('[medical-record/pdf] Failed to load signature:', imgErr.message);
                doc.font('Times-Bold').fontSize(10).text(`${fmtDoctorName(doctor)}`, signatureX, signY, { width: signatureWidth, align: 'center' });
                if (doctor?.specialization) {
                    doc.fontSize(9).font('Times-Roman').text(doctor.specialization, signatureX, signY + 14, { width: signatureWidth, align: 'center' });
                }
            }
        } else {
            doc.font('Times-Bold').fontSize(10).text(`${fmtDoctorName(doctor)}`, signatureX, signY, { width: signatureWidth, align: 'center' });
            if (doctor?.specialization) {
                doc.fontSize(9).font('Times-Roman').text(doctor.specialization, signatureX, signY + 14, { width: signatureWidth, align: 'center' });
            }
        }
 
        doc.end();
    } catch (err) {
        console.error('[medical-record/pdf] error:', err);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Gagal generate PDF rekam medis', error: err.message });
        } else {
            res.destroy();
        }
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. RATING
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/:id/rating', auth, async (req, res) => {
    try {
        const { rating } = req.body;
        if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: 'Rating 1–5' });

        const consultation = await Consultation.findById(req.params.id);
        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });
        if (consultation.userId.toString() !== req.userId) return res.status(403).json({ message: 'Bukan konsultasi Anda' });

        // User tidak bisa rating jika status no_show (mereka tidak hadir)
        // Tapi dokter bisa rating user no_show (dokter hadir tapi user tidak)
        const ratableStatuses = ['completed', 'doctor_no_show', 'cancelled_by_doctor', 'cancelled_by_admin'];
        if (!ratableStatuses.includes(consultation.status))
            return res.status(400).json({ message: 'Rating hanya bisa diberikan untuk konsultasi selesai atau dibatalkan dokter.' });
        if (consultation.status === 'no_show')
            return res.status(400).json({ message: 'Anda tidak hadir pada konsultasi ini, sehingga tidak dapat memberikan rating.' });
        if (consultation.rating) return res.status(400).json({ message: 'Sudah pernah memberi rating' });

        consultation.rating = rating;
        consultation.ratedAt = new Date();
        await consultation.save();

        if (consultation.status === 'completed') {
            const doctor = await Doctor.findByPk(consultation.doctorId);
            if (doctor) {
                const prevTotal = doctor.totalReviews || 0;
                const prevRating = doctor.rating || 0;
                doctor.totalReviews = prevTotal + 1;
                doctor.rating = Math.round(((prevRating * prevTotal) + rating) / doctor.totalReviews * 10) / 10;
                await doctor.save();
            }
        }

        res.json({ success: true, message: 'Rating berhasil dikirim' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. SURAT SAKIT
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/:id/sick-letter', auth, doctorAuth, async (req, res) => {
    try {
        const { diagnosis, restDays, notes, patientAge, patientGender, patientWeight } = req.body;
        if (!diagnosis || !restDays) return res.status(400).json({ message: 'Diagnosis dan hari istirahat wajib diisi' });

        const consultation = await Consultation.findById(req.params.id);
        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });
        if (!['in_progress', 'ongoing', 'completed', 'no_show'].includes(consultation.status)) return res.status(400).json({ message: 'Konsultasi harus dalam status berlangsung atau selesai' });

        const doctor = await Doctor.findOne({ where: { userId: req.userId } });
        if (!doctor || consultation.doctorId.toString() !== doctor.id.toString()) {
            return res.status(403).json({ message: 'Anda bukan dokter konsultasi ini' });
        }

        const existing = await SickLetter.findOne({ consultationId: req.params.id });
        if (existing) return res.status(400).json({ message: 'Surat sakit sudah dibuat' });

        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + parseInt(restDays) - 1);

        const sickLetter = new SickLetter({
            consultationId: req.params.id,
            userId: consultation.userId,
            doctorId: doctor.id,
            diagnosis,
            notes: notes || '',
            patientAge: patientAge || '',
            patientGender: patientGender || '',
            patientWeight: patientWeight || '',
            startDate,
            endDate,
            status: 'draft'
        });

        await sickLetter.save();
        consultation.sickLetter = sickLetter.id;
        await consultation.save();

        await createNotification({
            userId: consultation.userId,
            type: 'sick_letter_draft',
            title: 'Surat Sakit Dibuat',
            message: 'Dokter telah membuat surat sakit untuk Anda',
            data: { consultationId: consultation.id },
            io: req.app.get('io')
        });

        res.json({ success: true, sickLetter });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

router.put('/:id/sick-letter/issue', auth, doctorAuth, async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id);
        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });

        const doctor = await Doctor.findOne({ where: { userId: req.userId } });
        if (!doctor || consultation.doctorId.toString() !== doctor.id.toString()) {
            return res.status(403).json({ message: 'Anda bukan dokter konsultasi ini' });
        }

        const sickLetter = await SickLetter.findOne({ consultationId: req.params.id });
        if (!sickLetter) return res.status(404).json({ message: 'Surat sakit tidak ditemukan' });

        sickLetter.status = 'issued';
        sickLetter.issuedAt = new Date();
        await sickLetter.save();

        await createNotification({
            userId: consultation.userId,
            type: 'sick_letter_issued',
            title: 'Surat Sakit Diterbitkan',
            message: `Surat sakit Anda telah diterbitkan oleh ${fmtDoctorName(doctor)}`,
            data: { consultationId: consultation.id },
            io: req.app.get('io')
        });

        res.json({ success: true, sickLetter });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * generateSickLetterPdf
 * Fungsi shared untuk generate PDF surat sakit berdasarkan consultationId.
 * Dipakai oleh route /:id/sick-letter/pdf (pasien/dokter) DAN
 * oleh route admin GET /admin/sick-letters/:id/pdf tanpa perlu router.handle().
 *
 * @param {string} consultationId  - MongoDB _id konsultasi
 * @param {object} res             - Express response object
 */
async function generateSickLetterPdf(consultationId, res) {
    try {
        const consultation = await Consultation.findById(consultationId).populate('sickLetter');
        if (!consultation) {
            return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });
        }

        const sickLetter = consultation.sickLetter;
        if (!sickLetter) {
            return res.status(404).json({ message: 'Surat sakit tidak ditemukan' });
        }

        const patient = await User.findByPk(consultation.userId);
        const doctor  = await Doctor.findByPk(consultation.doctorId);

        const ClinicSettings  = require('../models/ClinicSettings');
        const clinicSettings  = await ClinicSettings.findOne({ key: 'main' }) || {};
        const clinicName      = clinicSettings.clinicName    || 'Klinik Pratama IPB';
        const clinicAddress   = clinicSettings.clinicAddress || 'Bogor, Jawa Barat';
        const signLocation    = clinicSettings.signLocation  || 'Bogor';
        const clinicPhone     = clinicSettings.clinicPhone   || '(62251) 8422094';

        const logoBuf      = await fetchImageBuffer(clinicSettings.logoUrl,  'Logo klinik');
        const stampBuf     = await fetchImageBuffer(clinicSettings.stampUrl,  'Stempel klinik');
        const signatureBuf = await fetchImageBuffer(doctor?.signatureUrl,     'Tanda tangan dokter');

        const doc = new PDFDocument({ margin: 70, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=sick-letter-${sickLetter.letterNumber || 'draft'}.pdf`);
        doc.on('error', (pdfErr) => {
            console.error('[sick-letter/pdf] PDFDocument error:', pdfErr);
            if (!res.headersSent) res.status(500).json({ message: 'Gagal generate PDF', error: pdfErr.message });
            else res.destroy();
        });
        doc.pipe(res);

        const tglPemeriksaan = new Date(consultation.scheduledAt || consultation.createdAt)
            .toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

        const tglSurat = sickLetter.issuedAt ? new Date(sickLetter.issuedAt) : new Date();
        const tglBogor = tglSurat;

        const days     = Math.ceil((new Date(sickLetter.endDate) - new Date(sickLetter.startDate)) / (1000 * 60 * 60 * 24)) + 1;
        const daysWord = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh'][days] || days.toString();
        const tglMulai   = new Date(sickLetter.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        const tglSelesai = new Date(sickLetter.endDate).toLocaleDateString('id-ID',   { day: 'numeric', month: 'long', year: 'numeric' });

        const headerStartX = 50;
        const headerStartY = doc.y;
        const logoSize     = 55;

        if (logoBuf) {
            try {
                doc.image(logoBuf, headerStartX, headerStartY, { height: logoSize, width: logoSize });
            } catch (imgErr) {
                console.warn('[sick-letter/pdf] Failed to load logo:', imgErr.message);
            }
        }

        const headerTextStartY = headerStartY;
        const addressParts     = parseAddress(clinicAddress);

        doc.font('Times-Bold').fontSize(14).text(clinicName, 50, headerTextStartY, { align: 'center', width: 500 });
        doc.font('Times-Roman').fontSize(10).text(addressParts.street, 50, headerTextStartY + 16, { align: 'center', width: 500 });
        if (addressParts.city_province) {
            doc.font('Times-Roman').fontSize(10).text(addressParts.city_province, 50, headerTextStartY + 28, { align: 'center', width: 500 });
        }
        doc.font('Times-Roman').fontSize(10).text(`Telp. ${clinicPhone}`, 50, headerTextStartY + 40, { align: 'center', width: 500 });
        doc.font('Times-Bold').fontSize(10).text(`${sickLetter.letterNumber || 'DRAFT'}`, 50, headerTextStartY + 52, { align: 'center', width: 500 });
        doc.y = headerStartY + logoSize + 5;

        doc.moveDown(0.3);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(0.8);

        doc.font('Times-Bold').fontSize(12).text('SURAT KETERANGAN SAKIT', { align: 'center' });
        doc.moveDown(0.8);

        doc.font('Times-Roman').fontSize(11);
        doc.text('Yang bertanda tangan di bawah ini menerangkan bahwa:', { align: 'left' });
        doc.moveDown(0.5);

        const labelX   = 70;
        const valueX   = 180;
        let currentY   = doc.y;

        doc.fontSize(10);
        doc.text('Nama', labelX, currentY, { width: 100 });
        doc.text(`: ${patient?.name || '-'}`, valueX, currentY);
        currentY += 16;

        if (sickLetter.patientAge) {
            doc.text('Umur', labelX, currentY, { width: 100 });
            doc.text(`: ${sickLetter.patientAge} tahun`, valueX, currentY);
            currentY += 16;
        }

        if (sickLetter.patientGender) {
            doc.text('Jenis Kelamin', labelX, currentY, { width: 100 });
            doc.text(`: ${sickLetter.patientGender}`, valueX, currentY);
            currentY += 16;
        }

        doc.y = currentY;
        doc.moveDown(0.4);

        doc.font('Times-Roman').fontSize(10);
        const pemeriksaanText =
            `Berdasarkan hasil pemeriksaan pada tanggal ${tglPemeriksaan}. ` +
            `Pasien didiagnosis ${sickLetter.diagnosis}, dan memerlukan istirahat ${days} (${daysWord}) hari ` +
            `terhitung mulai tanggal ${tglMulai} sampai dengan ${tglSelesai}. ` +
            `Demikian surat keterangan ini dibuat untuk dapat dipergunakan sebagaimana mestinya.`;
        doc.text(pemeriksaanText, 50, doc.y, { align: 'left', width: 500 });

        doc.moveDown(1.5);

        const signY  = doc.y;
        const rightX = 360;
        const imgSize = 52;

        doc.font('Times-Roman').fontSize(10);
        doc.text(`${signLocation}, ${tglBogor.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, rightX, signY, { align: 'center', width: 200 });
        doc.moveDown(0.5);
        doc.text('Dokter yang memeriksa', rightX, doc.y, { align: 'center', width: 200 });
        doc.moveDown(0.7);

        const sigAndStampY = doc.y;
        const sigImgX      = rightX + (190 - imgSize) / 2;

        if (signatureBuf) {
            try {
                doc.image(signatureBuf, sigImgX, sigAndStampY, { width: imgSize, height: imgSize });
            } catch (imgErr) {
                console.warn('[sick-letter/pdf] Failed to load signature:', imgErr.message);
            }
        }

        if (stampBuf) {
            try {
                const stampSize = 40;
                const stampX    = sigImgX + (imgSize - stampSize) / 2;
                const stampY    = sigAndStampY + (imgSize * 0.45) - (stampSize / 2);
                doc.image(stampBuf, stampX, stampY, { width: stampSize, height: stampSize });
            } catch (imgErr) {
                console.warn('[sick-letter/pdf] Failed to load stamp:', imgErr.message);
            }
        }

        doc.moveDown(2.5);
        doc.font('Times-Bold').fontSize(10).text(`${fmtDoctorName(doctor)}`, rightX, doc.y, { align: 'center', width: 200 });
        doc.moveDown(1.2);
        doc.font('Times-Roman').fontSize(8).fillColor('#333333')
            .text('*Surat keterangan ini dibuat berdasarkan hasil pemeriksaan dan berlaku sesuai tanggal yang tertera.', 50, doc.y, { align: 'left', width: 500 });

        doc.end();
    } catch (err) {
        console.error('[sick-letter/pdf] error:', err);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Gagal generate PDF', error: err.message });
        } else {
            res.destroy();
        }
    }
}

router.get('/:id/sick-letter/pdf', auth, async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id).select('userId doctorId');
        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });

        const isAuthorized = await canAccess(consultation, req.userId, req.userRole);
        if (!isAuthorized) return res.status(403).json({ message: 'Akses ditolak' });

        await generateSickLetterPdf(req.params.id, res);
    } catch (err) {
        console.error('[sick-letter/pdf] route error:', err);
        if (!res.headersSent) res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. GET SINGLE
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/:id', auth, async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id)
            .populate({ path: 'sickLetter', select: 'letterNumber diagnosis status startDate endDate sickLeaveDays notes issuedAt patientAge patientGender patientWeight' });

        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });

        const isOwnerOrDoctor = await canAccess(consultation, req.userId, req.userRole);
        if (!isOwnerOrDoctor) return res.status(403).json({ message: 'Akses ditolak' });

        const populated = await populateFromMySQL(consultation.toObject(), [
            { field: 'userId', model: 'User', attributes: ['name', 'email', 'phone'] },
            { field: 'doctorId', model: 'Doctor', attributes: ['name', 'specialization', 'photo', 'userId', 'titlePrefix', 'titleSuffix', 'strNumber', 'alumnus', 'practiceLocation'] }
        ]);

        const chatAllowedStatuses = ['confirmed', 'in_progress', 'completed', 'no_show',
            'doctor_no_show', 'cancelled_by_doctor', 'cancelled_by_admin', 'cancelled_by_user',
            'refund_requested', 'refunded', 'refund_rejected',
            'paid', 'scheduled', 'ongoing'];

        if (!chatAllowedStatuses.includes(populated.status) && req.userRole !== 'admin') {
            populated.messages = [];
            return res.json({ ...populated, _accessRestricted: true });
        }

        res.json(populated);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.delete('/:id', auth, async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id);
        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });
        if (consultation.userId.toString() !== req.userId) return res.status(403).json({ message: 'Unauthorized' });
        if (!['draft', 'pending_payment'].includes(consultation.status)) {
            return res.status(400).json({ message: 'Tidak bisa hapus konsultasi yang sudah diproses' });
        }

        await Consultation.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Konsultasi dihapus' });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ── Video Log: Upload rekaman video call (dokter/admin) ke Backblaze B2 ──────
// POST /api/consultations/:id/video-log
// Hanya dokter yang terlibat atau admin yang boleh upload
router.post('/:id/video-log', auth, uploadVideoLog.single('video'), async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id).lean();
        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });
        if (consultation.consultationType !== 'video_call') {
            return res.status(400).json({ message: 'Hanya konsultasi video call yang bisa upload video log' });
        }

        // Cek akses: hanya dokter yang terlibat atau admin
        const isAdmin  = req.userRole === 'admin';
        const isDoctor = req.userRole === 'doctor';

        if (!isAdmin && !isDoctor) {
            return res.status(403).json({ message: 'Hanya dokter atau admin yang dapat mengupload video log' });
        }

        if (isDoctor) {
            const doctorRecord = await Doctor.findOne({ where: { userId: req.userId } });
            if (!doctorRecord || doctorRecord.id.toString() !== consultation.doctorId.toString()) {
                return res.status(403).json({ message: 'Anda bukan dokter pada konsultasi ini' });
            }
        }

        if (!req.file) return res.status(400).json({ message: 'File video tidak ditemukan' });

        // Hapus video lama di B2 jika ada (replace)
        if (consultation.videoLog?.b2Key) {
            try { await deleteFromB2(consultation.videoLog.b2Key); } catch (e) {
                console.warn('[video-log/upload] Gagal hapus file lama B2:', e.message);
            }
        }

        // Tentukan key unik di B2
        const ext      = req.file.originalname.split('.').pop().toLowerCase() || 'webm';
        const b2Key    = `video-logs/${req.params.id}-${Date.now()}.${ext}`;
        const mimeType = req.file.mimetype || 'video/webm';

        // Upload buffer ke Backblaze B2
        await uploadToB2(req.file.buffer, b2Key, mimeType);

        const uploadedAt = new Date();
        const expiresAt  = new Date(uploadedAt.getTime() + 24 * 60 * 60 * 1000); // +24 jam

        // Buat signed URL untuk download (berlaku 1 jam — akan di-refresh saat GET)
        const signedUrl = await getDownloadUrl(b2Key, 3600);

        const videoLog = {
            url        : signedUrl,   // pre-signed URL (1 jam), di-refresh saat GET
            b2Key,                    // key permanen di B2 untuk delete & re-sign
            uploadedAt,
            expiresAt,
            uploadedBy : req.userId,
            fileSizeMB : parseFloat((req.file.size / (1024 * 1024)).toFixed(2)),
        };

        await Consultation.findByIdAndUpdate(req.params.id, { $set: { videoLog } });

        res.json({
            success : true,
            message : 'Video log berhasil diupload ke Backblaze B2. Tersedia selama 24 jam.',
            expiresAt,
            url     : signedUrl,
        });
    } catch (err) {
        console.error('[video-log/upload]', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// ── Video Log: Cek status & URL untuk download ───────────────────────────────
// GET /api/consultations/:id/video-log
// Pasien, dokter yang terlibat, dan admin boleh akses
router.get('/:id/video-log', auth, async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id)
            .select('consultationType videoLog userId doctorId status')
            .lean();
        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });

        // Cek akses
        const isAdmin   = req.userRole === 'admin';
        const isPatient = consultation.userId?.toString() === req.userId;
        let   isDoctor  = false;
        if (req.userRole === 'doctor') {
            const doctorRecord = await Doctor.findOne({ where: { userId: req.userId } });
            isDoctor = doctorRecord && doctorRecord.id.toString() === consultation.doctorId?.toString();
        }

        if (!isAdmin && !isPatient && !isDoctor) {
            return res.status(403).json({ message: 'Akses ditolak' });
        }

        if (!consultation.videoLog?.url) {
            return res.json({ available: false, message: 'Video log tidak tersedia' });
        }

        const now = new Date();
        if (consultation.videoLog.expiresAt && new Date(consultation.videoLog.expiresAt) < now) {
            return res.json({ available: false, message: 'Video log sudah kadaluarsa (lebih dari 24 jam)' });
        }

        const msLeft        = new Date(consultation.videoLog.expiresAt) - now;
        const hoursLeft     = Math.floor(msLeft / (1000 * 60 * 60));
        const minutesLeft   = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60));

        // Re-generate signed URL (berlaku 1 jam) agar link tidak expired saat user buka
        let downloadUrl = consultation.videoLog.url;
        if (consultation.videoLog.b2Key) {
            try {
                downloadUrl = await getDownloadUrl(consultation.videoLog.b2Key, 3600);
                // Update URL terbaru di DB (opsional — untuk konsistensi)
                await Consultation.findByIdAndUpdate(req.params.id, {
                    $set: { 'videoLog.url': downloadUrl },
                });
            } catch (e) {
                console.warn('[video-log/get] Gagal re-sign URL B2:', e.message);
            }
        }

        res.json({
            available    : true,
            url          : downloadUrl,
            uploadedAt   : consultation.videoLog.uploadedAt,
            expiresAt    : consultation.videoLog.expiresAt,
            fileSizeMB   : consultation.videoLog.fileSizeMB,
            durationSec  : consultation.videoLog.durationSec,
            timeLeft     : `${hoursLeft} jam ${minutesLeft} menit`,
        });
    } catch (err) {
        console.error('[video-log/get]', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ── Video Log: Hapus manual (admin/dokter) ───────────────────────────────────
// DELETE /api/consultations/:id/video-log
router.delete('/:id/video-log', auth, async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id)
            .select('videoLog userId doctorId')
            .lean();
        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });

        const isAdmin  = req.userRole === 'admin';
        const isDoctor = req.userRole === 'doctor';

        if (!isAdmin && !isDoctor) {
            return res.status(403).json({ message: 'Hanya dokter atau admin yang dapat menghapus video log' });
        }

        if (!consultation.videoLog?.url) {
            return res.status(404).json({ message: 'Video log tidak ditemukan' });
        }

        // Hapus dari Backblaze B2
        if (consultation.videoLog.b2Key) {
            try {
                await deleteFromB2(consultation.videoLog.b2Key);
            } catch (e) {
                console.warn('[video-log/delete] B2 delete warning:', e.message);
            }
        }

        await Consultation.findByIdAndUpdate(req.params.id, { $unset: { videoLog: '' } });
        res.json({ success: true, message: 'Video log berhasil dihapus' });
    } catch (err) {
        console.error('[video-log/delete]', err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
module.exports.processRefundInternal  = processRefundInternal;
module.exports.generateSickLetterPdf  = generateSickLetterPdf;