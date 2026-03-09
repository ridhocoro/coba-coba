const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

const Consultation = require('../models/Consultation');
const Doctor = require('../models/Doctor');
const SickLetter = require('../models/SickLetter');
const User = require('../models/User');
const auth = require('../middleware/auth');
const doctorAuth = require('../middleware/doctorAuth');
const { createNotification } = require('../utils/notificationHelper');

// ── Multer untuk upload foto chat ─────────────────────────────────────────────
const chatStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/chat';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `chat-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`);
    }
});
const uploadChat = multer({ storage: chatStorage, limits: { fileSize: 5 * 1024 * 1024 } });

// Multer untuk upload lampiran keluhan
const attachStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/attachments';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `attach-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`);
    }
});
const uploadAttachment = multer({
    storage: attachStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB untuk PDF
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp|pdf|doc|docx/i;
        const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
        if (allowed.test(ext)) return cb(null, true);
        cb(new Error('File harus berupa gambar, PDF, atau dokumen Word'));
    }
});

// ── Helper: cek apakah user/dokter bisa akses konsultasi ─────────────────────
const canAccess = (consultation, userId, userRole) => {
    if (userRole === 'admin') return true;
    // User: cek userId
    const patientId = consultation.userId?._id || consultation.userId;
    if (patientId?.toString() === userId) return true;
    // Dokter: doctorId.userId (User._id) harus cocok dengan req.userId
    const docUserId = consultation.doctorId?.userId?._id || consultation.doctorId?.userId;
    if (docUserId?.toString() === userId) return true;
    return false;
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. ROUTE STATIS
// ═══════════════════════════════════════════════════════════════════════════════

// Daftar konsultasi user
router.get('/my-consultations', auth, async (req, res) => {
    try {
        const consultations = await Consultation.find({ userId: req.userId })
            .populate('doctorId', 'name specialization consultationFee rating photo isOnline')
            .populate('paymentId')
            .populate({ path: 'sickLetter', select: 'letterNumber diagnosis status startDate endDate issuedAt patientAge patientGender' })
            // medicalRecord & prescriptionData adalah embedded subdocument, tidak di-populate
            .sort('-createdAt');
        res.json(consultations);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Daftar konsultasi dokter (aktif: confirmed, in_progress)
router.get('/doctor/pending', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ userId: req.userId });
        if (!doctor) return res.status(404).json({ success: false, message: 'Data dokter tidak ditemukan' });

        const consultations = await Consultation.find({
            doctorId: doctor._id,
            status: { $in: ['confirmed', 'in_progress'] }
        })
            .populate('userId', 'name email phone')
            .sort('scheduledAt');

        res.json({ success: true, count: consultations.length, consultations });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

// Seluruh riwayat dokter (completed, etc)
router.get('/doctor/history', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ userId: req.userId });
        if (!doctor) return res.status(404).json({ success: false, message: 'Data dokter tidak ditemukan' });

        const consultations = await Consultation.find({ doctorId: doctor._id })
            .populate('userId', 'name email')
            .sort('-createdAt');

        res.json({ success: true, consultations });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Alias /doctor/all → semua konsultasi dokter dengan populate lengkap (backward compat)
router.get('/doctor/all', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ userId: req.userId });
        if (!doctor) return res.status(404).json({ success: false, message: 'Data dokter tidak ditemukan' });

        const consultations = await Consultation.find({ doctorId: doctor._id })
            .populate('userId', 'name email phone')
            .populate({ path: 'sickLetter', select: 'status letterNumber diagnosis' })
            .sort('-createdAt');

        res.json({ success: true, consultations });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. BUAT KONSULTASI (DRAFT → PENDING_PAYMENT)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/consultations/create
 * Body: { doctorId, consultationType, scheduleType, scheduledAt?, symptoms, medicalHistory }
 * Attachments: multipart/form-data field "attachments" (opsional, maks 5 file)
 */
router.post('/create', auth, uploadAttachment.array('attachments', 5), async (req, res) => {
    try {
        const { doctorId, consultationType, symptoms, medicalHistory, scheduledAt, scheduledEnd } = req.body;

        const doctor = await Doctor.findById(doctorId);
        if (!doctor || !doctor.isActive) {
            return res.status(404).json({ message: 'Dokter tidak ditemukan atau tidak aktif' });
        }

        // ── Backend re-validasi tipe konsultasi ────────────────────────────────
        const settings = doctor.consultationSettings || {};
        const typeAllowed = {
            chat:       settings.allowChat      !== false,
            video_call: settings.allowVideoCall !== false,
        };
        if (!typeAllowed[consultationType]) {
            return res.status(400).json({ message: `Dokter tidak mengaktifkan fitur ${consultationType === 'video_call' ? 'Video Call' : 'Chat'}` });
        }

        // ── Validasi scheduledAt wajib ─────────────────────────────────────────
        if (!scheduledAt || !scheduledEnd) {
            return res.status(400).json({ message: 'Slot jadwal (scheduledAt & scheduledEnd) wajib diisi' });
        }

        const slotStart = new Date(scheduledAt);
        const slotEnd   = new Date(scheduledEnd);
        const now = new Date();

        if (slotStart <= now) {
            return res.status(400).json({ message: 'Tidak bisa memesan slot yang sudah lewat' });
        }

        // Batas 7 hari ke depan
        const maxDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        if (slotStart > maxDate) {
            return res.status(400).json({ message: 'Pemesanan hanya tersedia hingga 7 hari ke depan' });
        }

        // ── Race condition check: slot locked ──────────────────────────────────
        // Cek apakah slot ini sudah dipesan orang lain (atomic dengan findOne)
        const slotConflict = await Consultation.findOne({
            doctorId,
            scheduledAt: slotStart,
            status: { $in: ['pending_payment', 'waiting_verification', 'confirmed', 'in_progress'] }
        });
        if (slotConflict) {
            return res.status(409).json({ message: 'Slot ini baru saja diambil orang lain. Silakan pilih slot lain.' });
        }

        // ── Validasi ulang availability rule (backend, tidak bisa bypass) ──────
        const DoctorAvailability = require('../models/DoctorAvailability');
        const avail = await DoctorAvailability.findOne({ doctorId: doctor._id });
        if (!avail || !avail.isActive) {
            return res.status(400).json({ message: 'Dokter belum mengatur jadwal praktik atau sedang tidak menerima konsultasi' });
        }

        // Konversi scheduledAt (UTC dari DB/frontend) → WIB untuk validasi
        const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
        const slotWIB = new Date(slotStart.getTime() + WIB_OFFSET_MS);

        // Cek hari praktik — gunakan schedule Map (key '1'–'5', Senin=1 ... Jumat=5)
        // slotWIB.getUTCDay() → 0=Minggu,1=Sen,...,6=Sab
        const dayOfWeek = slotWIB.getUTCDay(); // 1–5 untuk hari kerja
        const slotsForDay = avail.getSlotsForDay(dayOfWeek);
        if (!slotsForDay || slotsForDay.length === 0) {
            return res.status(400).json({ message: 'Dokter tidak praktik pada hari tersebut' });
        }

        // Jam WIB dari slot
        const slotHHMM = `${String(slotWIB.getUTCHours()).padStart(2,'0')}:${String(slotWIB.getUTCMinutes()).padStart(2,'0')}`;

        // Validasi strict: slot harus aktif pada hari tersebut
        if (!avail.isSlotActive(dayOfWeek, slotHHMM)) {
            return res.status(400).json({
                message: 'Slot waktu tidak valid. Pilih slot yang tersedia dari sistem.',
            });
        }

        // Validasi scheduledEnd: harus scheduledAt + 60 menit (1 sesi)
        const slotEndWIB  = new Date(slotEnd.getTime() + WIB_OFFSET_MS);
        const slotEndHHMM = `${String(slotEndWIB.getUTCHours()).padStart(2,'0')}:${String(slotEndWIB.getUTCMinutes()).padStart(2,'0')}`;
        const toMin = (hhmm) => { const [h,m] = hhmm.split(':').map(Number); return h*60+m; };
        const SESSION_DURATION = 60; // menit
        const expectedEndMin = toMin(slotHHMM) + SESSION_DURATION;
        if (toMin(slotEndHHMM) !== expectedEndMin) {
            return res.status(400).json({ message: 'Waktu selesai slot tidak sesuai' });
        }

        // ── Buat konsultasi + lock slot ────────────────────────────────────────
        const paymentDeadline = new Date(Date.now() + 15 * 60 * 1000); // 15 menit

        const attachmentUrls = (req.files || []).map(f => `/uploads/attachments/${f.filename}`);

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
            status: 'pending_payment',
            paymentDeadline
        });

        await consultation.save();

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

// ── POST /:id/initiate-payment → buat Xendit invoice untuk konsultasi ─────────
// Dipanggil frontend setelah user memilih slot. Returns invoiceUrl Xendit.
router.post('/:id/initiate-payment', auth, async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id)
            .populate('doctorId', 'name consultationFee');

        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });
        if (consultation.userId.toString() !== req.userId) return res.status(403).json({ message: 'Akses ditolak' });
        if (consultation.status !== 'pending_payment') {
            return res.status(400).json({ message: `Status saat ini: ${consultation.status}. Tidak bisa bayar.` });
        }

        // Cek deadline belum lewat
        if (consultation.paymentDeadline && consultation.paymentDeadline < new Date()) {
            consultation.status = 'expired';
            await consultation.save();
            return res.status(400).json({ message: 'Waktu pembayaran sudah habis. Silakan booking ulang.' });
        }

        const amount = consultation.doctorId?.consultationFee || req.body.amount;
        if (!amount) return res.status(400).json({ message: 'Biaya konsultasi tidak ditemukan' });

        const externalId = `INV-CONSULT-${consultation._id}-${Date.now()}`;

        // Buat Xendit invoice via axios (tidak perlu re-route ke /api/xendit untuk menghindari circular)
        const axios = require('axios');
        const XENDIT_SECRET_KEY = process.env.XENDIT_SECRET_KEY;
        const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

        const xenditRes = await axios.post(
            'https://api.xendit.co/v2/invoices',
            {
                external_id         : externalId,
                amount,
                description         : `Konsultasi Online – dr. ${consultation.doctorId?.name || ''}`,
                invoice_duration    : 900,
                success_redirect_url: `${FRONTEND_URL}/payment/success?external_id=${externalId}`,
                failure_redirect_url: `${FRONTEND_URL}/payment/failed?external_id=${externalId}`,
                currency            : 'IDR',
                payment_methods     : ['BCA','BNI','BRI','MANDIRI','PERMATA','OVO','DANA','SHOPEEPAY','LINKAJA','QRIS'],
            },
            {
                headers: {
                    Authorization : 'Basic ' + Buffer.from(XENDIT_SECRET_KEY + ':').toString('base64'),
                    'Content-Type': 'application/json',
                },
            }
        );

        const invoice = xenditRes.data;

        // Simpan xendit invoice id ke consultation
        consultation.xenditInvoiceId  = invoice.id;
        consultation.xenditExternalId = externalId;
        await consultation.save();

        res.json({
            success    : true,
            invoiceUrl : invoice.invoice_url,
            externalId,
            invoiceId  : invoice.id,
            amount,
            paymentDeadline: consultation.paymentDeadline,
        });
    } catch (err) {
        console.error('[initiate-payment]', err.response?.data || err.message);
        res.status(500).json({ message: 'Gagal membuat invoice pembayaran: ' + (err.response?.data?.message || err.message) });
    }
});

// ── DEPRECATED: upload-proof → ditangani Xendit otomatis ─────────────────────
// Tetap ada sebagai fallback jika ada user yang belum migrasi
router.post('/:id/upload-proof', auth, async (req, res) => {
    res.status(410).json({
        message: 'Pembayaran kini dilakukan otomatis via Xendit. Gunakan endpoint /initiate-payment.',
    });
});

// ── verify-payment & reject-payment dihapus: pembayaran ditangani otomatis oleh Xendit webhook ──
// Lihat: /api/xendit/webhook → handleConsultationPaid() di xendit.js

// ── Admin: cancelled_by_doctor ────────────────────────────────────────────────
router.put('/:id/cancel-by-doctor', auth, async (req, res) => {
    try {
        if (req.userRole !== 'admin') return res.status(403).json({ message: 'Akses ditolak' });

        const consultation = await Consultation.findById(req.params.id);
        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });

        const cancellableStatuses = ['confirmed', 'waiting_verification', 'pending_payment'];
        if (!cancellableStatuses.includes(consultation.status)) {
            return res.status(400).json({ message: `Tidak bisa batalkan dari status ${consultation.status}` });
        }

        consultation.status = 'cancelled_by_doctor';
        consultation.cancelledAt = new Date();
        consultation.cancelledBy = 'admin';
        consultation.cancelReason = req.body.reason || 'Dokter membatalkan konsultasi';
        await consultation.save();

        await createNotification({
            userId: consultation.userId,
            type: 'consultation_cancelled',
            title: 'Konsultasi Dibatalkan',
            message: `Konsultasi Anda dibatalkan oleh dokter. Anda dapat mengajukan refund.`,
            data: { consultationId: consultation._id },
            io: req.app.get('io')
        });

        res.json({ success: true, message: 'Konsultasi dibatalkan oleh dokter', consultation });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// ── Dokter: Start → in_progress ──────────────────────────────────────────────
router.put('/:id/start', auth, async (req, res) => {
    try {
        // Ambil dulu untuk pengecekan hak akses & waktu
        const consultation = await Consultation.findById(req.params.id)
            .populate('doctorId', 'userId');

        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });

        const doctorUserId = consultation.doctorId?.userId?.toString();
        if (doctorUserId !== req.userId && req.userRole !== 'admin') {
            return res.status(403).json({ message: 'Hanya dokter yang bersangkutan yang dapat memulai' });
        }

        // Jika sudah in_progress (auto oleh cron), kembalikan saja
        if (consultation.status === 'in_progress') {
            return res.json({ success: true, message: 'Konsultasi sudah berjalan', consultation });
        }

        if (consultation.status !== 'confirmed') {
            return res.status(400).json({ message: `Status harus confirmed, saat ini: ${consultation.status}` });
        }

        // ── Cek waktu: boleh start 5 menit sebelum scheduledAt s/d scheduledEnd ──
        const now = new Date();
        const EARLY_GRACE_MS = 5 * 60 * 1000; // 5 menit sebelum boleh start
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

        // ── Atomic update: hanya update jika status masih 'confirmed' ──────────
        const updated = await Consultation.findOneAndUpdate(
            { _id: req.params.id, status: 'confirmed' },
            { $set: { status: 'in_progress', startTime: now } },
            { new: true }
        ).populate('doctorId', 'userId');

        if (!updated) {
            // Status sudah berubah (race condition atau cron mendahului)
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
            data: { consultationId: updated._id },
            io: req.app.get('io')
        });

        // Emit socket real-time
        const io = req.app.get('io');
        if (io) {
            io.to(`user-${updated.userId}`).emit('consultation-status-update', {
                consultationId: updated._id.toString(),
                status: 'in_progress',
            });
        }

        res.json({ success: true, message: 'Konsultasi dimulai', consultation: updated });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// ── Dokter: End → completed / no_show ────────────────────────────────────────
router.put('/:id/end', auth, async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id)
            .populate('doctorId', 'userId');

        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });

        const doctorUserId = consultation.doctorId?.userId?.toString();
        if (doctorUserId !== req.userId && req.userRole !== 'admin') {
            return res.status(403).json({ message: 'Hanya dokter yang bersangkutan yang dapat mengakhiri' });
        }
        if (consultation.status !== 'in_progress') {
            return res.status(400).json({ message: `Status harus in_progress, saat ini: ${consultation.status}` });
        }

        // Tentukan no_show: jika tidak ada satu pesan pun dari user
        const userMessages = consultation.messages.filter(
            m => m.senderId?.toString() === consultation.userId?.toString()
        );
        const finalStatus = userMessages.length === 0 ? 'no_show' : 'completed';
        const now = new Date();

        // ── Atomic update ──────────────────────────────────────────────────────
        const updated = await Consultation.findOneAndUpdate(
            { _id: req.params.id, status: 'in_progress' },
            { $set: { status: finalStatus, endTime: now } },
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
                : 'Konsultasi Anda telah selesai. Silakan beri rating.',
            data: { consultationId: updated._id },
            io: req.app.get('io')
        });

        const io = req.app.get('io');
        if (io) {
            io.to(`user-${updated.userId}`).emit('consultation-status-update', {
                consultationId: updated._id.toString(),
                status        : finalStatus,
            });
            // Emit event khusus agar frontend tampilkan rating modal
            if (finalStatus === 'completed') {
                io.to(`user-${updated.userId}`).emit('show-rating-modal', {
                    consultationId: updated._id.toString(),
                });
            }
        }

        res.json({ success: true, message: `Konsultasi ${finalStatus}`, consultation: updated });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// ── User: Ajukan refund (setelah cancelled_by_doctor atau doctor_no_show) ─────
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

router.post('/:id/refund-request', auth, uploadRefundProof.single('proof'), async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id);
        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });
        if (consultation.userId.toString() !== req.userId) return res.status(403).json({ message: 'Akses ditolak' });

        const refundableStatuses = ['cancelled_by_doctor', 'doctor_no_show'];
        if (!refundableStatuses.includes(consultation.status)) {
            return res.status(400).json({ message: 'Refund hanya bisa diajukan untuk konsultasi yang dibatalkan dokter' });
        }

        const { bankName, accountNumber, accountName } = req.body;
        if (!bankName || !accountNumber || !accountName) {
            return res.status(400).json({ message: 'Data bank (nama bank, nomor rekening, atas nama) wajib diisi' });
        }

        const proofUrl = req.file ? `/uploads/refund-proofs/${req.file.filename}` : null;

        consultation.status = 'refund_requested';
        consultation.refund = {
            bankName,
            accountNumber,
            accountName,
            proofUrl,
            requestedAt: new Date()
        };
        await consultation.save();

        // Notif admin
        const User = require('../models/User');
        const admins = await User.find({ role: 'admin' });
        for (const admin of admins) {
            await createNotification({
                userId: admin._id,
                type: 'refund_requested',
                title: 'Permintaan Refund Baru',
                message: `Ada permintaan refund konsultasi yang perlu diproses`,
                data: { consultationId: consultation._id },
                io: req.app.get('io')
            });
        }

        res.json({ success: true, message: 'Permintaan refund berhasil dikirim', consultation });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// ── Admin: Proses refund (refunded / refund_failed) ───────────────────────────
router.put('/:id/process-refund', auth, async (req, res) => {
    try {
        if (req.userRole !== 'admin') return res.status(403).json({ message: 'Akses ditolak' });

        const consultation = await Consultation.findById(req.params.id);
        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });
        if (consultation.status !== 'refund_requested') {
            return res.status(400).json({ message: 'Status harus refund_requested' });
        }

        const { action, failReason } = req.body; // action: 'approve' | 'reject'
        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({ message: 'action harus approve atau reject' });
        }

        consultation.status = action === 'approve' ? 'refunded' : 'refund_failed';
        consultation.refund.processedAt = new Date();
        consultation.refund.adminId = req.userId;
        if (action === 'reject') {
            consultation.refund.failReason = failReason || 'Refund ditolak oleh admin';
        }
        await consultation.save();

        await createNotification({
            userId: consultation.userId,
            type: 'refund_processed',
            title: action === 'approve' ? 'Refund Disetujui' : 'Refund Ditolak',
            message: action === 'approve'
                ? 'Dana Anda akan ditransfer dalam 1-3 hari kerja'
                : `Refund ditolak: ${failReason || 'Silakan hubungi admin'}`,
            data: { consultationId: consultation._id },
            io: req.app.get('io')
        });

        res.json({ success: true, message: `Refund ${action === 'approve' ? 'disetujui' : 'ditolak'}`, consultation });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// ── Legacy: mark-paid (tidak digunakan lagi) ──────────────────────────────────
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

        if (req.userRole === 'user') {
            if (consultation.userId.toString() !== req.userId) return res.status(403).json({ message: 'Akses ditolak' });
            if (consultation.status !== 'pending_payment') {
                return res.status(400).json({ message: 'Hanya bisa dibatalkan saat menunggu pembayaran' });
            }
            consultation.status = 'expired';
            consultation.cancelledBy = 'user';
            consultation.cancelledAt = new Date();
        } else if (req.userRole === 'admin') {
            consultation.status = 'cancelled_by_doctor';
            consultation.cancelledBy = 'admin';
            consultation.cancelledAt = new Date();
            consultation.cancelReason = req.body.reason || '';
        } else {
            return res.status(403).json({ message: 'Akses ditolak' });
        }

        await consultation.save();
        res.json({ success: true, consultation });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. CHAT & UPLOAD FOTO
// ═══════════════════════════════════════════════════════════════════════════════

// Kirim pesan (teks)
router.post('/:id/messages', auth, async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id)
            .populate('userId', 'name')
            .populate('doctorId', 'name userId');

        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });

        // Hanya bisa chat jika konsultasi sedang aktif (in_progress)
        // completed, no_show, dll → tidak boleh kirim pesan baru
        if (!['confirmed', 'in_progress', 'paid', 'scheduled', 'ongoing'].includes(consultation.status)) {
            return res.status(403).json({ message: 'Konsultasi tidak aktif. Pesan hanya bisa dikirim saat konsultasi sedang berlangsung.' });
        }

        const isUser = consultation.userId._id.toString() === req.userId;
        const senderRole = isUser ? 'user' : 'doctor';
        const senderName = isUser ? consultation.userId.name : `dr. ${consultation.doctorId.name}`;

        const msg = {
            senderId: req.userId,
            senderName,
            senderRole,
            message: req.body.message,
            timestamp: new Date()
        };

        consultation.messages.push(msg);
        await consultation.save();

        const recipientId = isUser ? consultation.doctorId.userId : consultation.userId._id;
        await createNotification({
            userId: recipientId,
            type: 'new_message',
            title: 'Pesan Baru',
            message: `${senderName}: ${req.body.message?.substring(0, 60)}`,
            data: { consultationId: consultation._id },
            io: req.app.get('io')
        });

        // Catatan: socket emit untuk pesan teks dihandle di socket/chat.js via event 'send-message'
        // REST endpoint ini hanya untuk persistensi & mengembalikan msg dengan _id yang valid
        res.json({ success: true, message: msg });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Upload foto dalam chat
router.post('/:id/messages/image', auth, uploadChat.single('image'), async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id)
            .populate('userId', 'name')
            .populate('doctorId', 'name userId');

        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });
        if (!['confirmed', 'in_progress', 'paid', 'scheduled', 'ongoing'].includes(consultation.status)) {
            return res.status(403).json({ message: 'Konsultasi tidak aktif. Pesan hanya bisa dikirim saat konsultasi sedang berlangsung.' });
        }
        if (!req.file) return res.status(400).json({ message: 'File tidak ditemukan' });

        const isUser = consultation.userId._id.toString() === req.userId;
        const senderName = isUser ? consultation.userId.name : `dr. ${consultation.doctorId.name}`;
        const imageUrl = `/uploads/chat/${req.file.filename}`;

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

        // Untuk gambar: emit ke semua di room termasuk pengirim (tidak ada optimistic update gambar)
        const io = req.app.get('io');
        if (io) {
            io.to(`consultation-${consultation._id}`).emit('receive-message', {
                ...msg,
                senderId: req.userId
            });
        }

        res.json({ success: true, message: msg });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. RESEP DIGITAL TERSTRUKTUR (dokter)
// ═══════════════════════════════════════════════════════════════════════════════

router.put('/:id/prescription', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ userId: req.userId });
        if (!doctor) return res.status(404).json({ message: 'Data dokter tidak ditemukan' });

        const consultation = await Consultation.findById(req.params.id)
            .populate('userId', 'name');
        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });
        if (consultation.doctorId.toString() !== doctor._id.toString()) {
            return res.status(403).json({ message: 'Anda bukan dokter konsultasi ini' });
        }
        const allowedStatuses = ['in_progress', 'ongoing', 'completed', 'no_show'];
        if (!allowedStatuses.includes(consultation.status)) {
            return res.status(400).json({ message: 'Resep hanya bisa dikirim saat konsultasi berlangsung atau selesai' });
        }

        // Terima format terstruktur (prescriptionData) atau plain text (legacy)
        if (req.body.medicines && Array.isArray(req.body.medicines)) {
            // Format terstruktur
            const count = await require('../models/Consultation').countDocuments({ 'prescriptionData.prescriptionNumber': { $exists: true } });
            const rxNum = 'RX-' + Date.now().toString().slice(-6) + '-' + (count + 1).toString().padStart(3, '0');
            const issuedAt  = new Date();
            const validUntil = new Date(issuedAt.getTime() + 7 * 24 * 60 * 60 * 1000);

            consultation.prescriptionData = {
                prescriptionNumber: rxNum,
                issuedAt,
                validUntil,
                patientAge:    req.body.patientAge    || '',
                patientGender: req.body.patientGender || '',
                patientWeight: req.body.patientWeight || '',
                medicines:     req.body.medicines,
                doctorNotes:   req.body.doctorNotes   || '',
                isUsed:        false,
            };
            // Juga update legacy field untuk backward compat
            consultation.prescription = req.body.medicines.map((m, i) =>
                `${i + 1}. ${m.name}${m.dose ? ' ' + m.dose : ''} — ${m.frequency || ''} ${m.instructions ? '(' + m.instructions + ')' : ''}`
            ).join('\n');
        } else {
            // Legacy plain text
            consultation.prescription = req.body.prescription;
        }

        if (req.body.diagnosis) consultation.diagnosis = req.body.diagnosis;
        await consultation.save();

        await createNotification({
            userId: consultation.userId,
            type: 'prescription_sent',
            title: 'Resep Digital Diterbitkan 💊',
            message: `dr. ${doctor.name} telah menerbitkan resep untuk Anda. Berlaku 7 hari, 1x pembelian.`,
            data: { consultationId: consultation._id },
            io: req.app.get('io')
        });

        const io = req.app.get('io');
        if (io) {
            io.to(`consultation-${consultation._id}`).emit('prescription-update', {
                prescription:     consultation.prescription,
                prescriptionData: consultation.prescriptionData,
                diagnosis:        consultation.diagnosis
            });
        }

        res.json({ success: true, prescription: consultation.prescription, prescriptionData: consultation.prescriptionData });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// ── GET /:id/prescription/pdf ─────────────────────────────────────────────────
router.get('/:id/prescription/pdf', auth, async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id)
            .populate('userId', 'name')
            .populate('doctorId', 'name specialization userId');

        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });
        if (!canAccess(consultation, req.userId, req.userRole)) return res.status(403).json({ message: 'Akses ditolak' });

        const rx = consultation.prescriptionData;
        if (!rx && !consultation.prescription) return res.status(404).json({ message: 'Resep tidak ditemukan' });

        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=resep-${rx?.prescriptionNumber || consultation._id}.pdf`);
        doc.pipe(res);

        // Header
        doc.fontSize(18).font('Helvetica-Bold').text('RESEP DIGITAL', { align: 'center' });
        doc.fontSize(11).font('Helvetica').text('Klinik Pratama IPB', { align: 'center' });
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(0.5);

        // Info resep
        if (rx) {
            doc.fontSize(10).text(`Nomor Resep : ${rx.prescriptionNumber || '-'}`);
            doc.text(`Tanggal     : ${rx.issuedAt ? new Date(rx.issuedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}`);
            doc.text(`Berlaku s/d : ${rx.validUntil ? new Date(rx.validUntil).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}`);
        } else {
            doc.fontSize(10).text(`Tanggal: ${new Date(consultation.createdAt).toLocaleDateString('id-ID')}`);
        }
        doc.moveDown(0.5);

        // Info pasien
        doc.font('Helvetica-Bold').text('Identitas Pasien');
        doc.font('Helvetica');
        doc.text(`Nama           : ${consultation.userId.name}`);
        if (rx?.patientAge)    doc.text(`Umur           : ${rx.patientAge}`);
        if (rx?.patientGender) doc.text(`Jenis Kelamin  : ${rx.patientGender}`);
        if (rx?.patientWeight) doc.text(`Berat Badan    : ${rx.patientWeight}`);
        doc.moveDown(0.5);

        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(0.5);
        doc.font('Helvetica-Bold').fontSize(12).text('R/');
        doc.font('Helvetica').fontSize(10);
        doc.moveDown(0.3);

        // Daftar obat
        if (rx?.medicines?.length > 0) {
            rx.medicines.forEach((m, i) => {
                doc.font('Helvetica-Bold').text(`${i + 1}. ${m.name}${m.dose ? ' ' + m.dose : ''}${m.form ? ' ' + m.form : ''}`);
                doc.font('Helvetica');
                if (m.frequency)    doc.text(`   Dosis      : ${m.frequency}`);
                if (m.instructions) doc.text(`   Cara Pakai : ${m.instructions}`);
                if (m.quantity)     doc.text(`   Jumlah     : ${m.quantity}`);
                doc.moveDown(0.3);
            });
        } else if (consultation.prescription) {
            doc.text(consultation.prescription);
        }

        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(0.5);

        if (rx?.doctorNotes || consultation.diagnosis) {
            doc.font('Helvetica-Bold').text('Catatan Dokter:');
            doc.font('Helvetica');
            if (consultation.diagnosis) doc.text(`Diagnosis: ${consultation.diagnosis}`);
            if (rx?.doctorNotes) doc.text(rx.doctorNotes);
            doc.moveDown(0.5);
        }

        // TTD dokter
        doc.moveDown(1);
        doc.text(`Bogor, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, { align: 'right' });
        doc.moveDown(2.5);
        doc.text(`dr. ${consultation.doctorId.name}`, { align: 'right' });
        if (consultation.doctorId.specialization) {
            doc.fontSize(9).text(consultation.doctorId.specialization, { align: 'right' });
        }

        doc.moveDown(1);
        doc.fontSize(8).fillColor('#666').text('*Resep berlaku 7 hari dan hanya dapat digunakan 1x pembelian.', { align: 'center' });

        doc.end();
    } catch (err) {
        res.status(500).json({ message: 'Gagal generate PDF resep', error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5b. REKAM MEDIS (SOAP) — dokter isi setelah/saat konsultasi
// ═══════════════════════════════════════════════════════════════════════════════

router.put('/:id/medical-record', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ userId: req.userId });
        if (!doctor) return res.status(404).json({ message: 'Data dokter tidak ditemukan' });

        const consultation = await Consultation.findById(req.params.id)
            .populate('userId', 'name');
        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });
        if (consultation.doctorId.toString() !== doctor._id.toString()) {
            return res.status(403).json({ message: 'Anda bukan dokter konsultasi ini' });
        }
        const allowedStatuses = ['in_progress', 'ongoing', 'completed', 'no_show'];
        if (!allowedStatuses.includes(consultation.status)) {
            return res.status(400).json({ message: 'Rekam medis hanya bisa diisi saat/setelah konsultasi berlangsung' });
        }

        const { objectiveFindings, assessment, plan, doctorNotes, markComplete } = req.body;

        consultation.medicalRecord = {
            objectiveFindings: objectiveFindings || '',
            assessment:        assessment       || '',
            plan:              plan             || '',
            doctorNotes:       doctorNotes      || '',
            isCompleted:       markComplete === true || markComplete === 'true',
            completedAt:       (markComplete === true || markComplete === 'true') ? new Date() : consultation.medicalRecord?.completedAt,
        };

        // Sync diagnosis ke field utama
        if (assessment) consultation.diagnosis = assessment;

        await consultation.save();

        const io = req.app.get('io');
        if (io) {
            io.to(`consultation-${consultation._id}`).emit('medical-record-update', {
                medicalRecord: consultation.medicalRecord
            });
        }

        res.json({ success: true, medicalRecord: consultation.medicalRecord });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// ── GET /:id/medical-record/pdf ───────────────────────────────────────────────
router.get('/:id/medical-record/pdf', auth, async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id)
            .populate('userId', 'name email')
            .populate('doctorId', 'name specialization userId');

        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });
        if (!canAccess(consultation, req.userId, req.userRole)) return res.status(403).json({ message: 'Akses ditolak' });

        const mr = consultation.medicalRecord;
        if (!mr) return res.status(404).json({ message: 'Rekam medis belum dibuat' });

        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=rekam-medis-${consultation._id}.pdf`);
        doc.pipe(res);

        // Header
        doc.fontSize(18).font('Helvetica-Bold').text('REKAM MEDIS', { align: 'center' });
        doc.fontSize(11).font('Helvetica').text('Klinik Pratama IPB', { align: 'center' });
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(0.5);

        const tgl = new Date(consultation.endTime || consultation.scheduledAt || consultation.createdAt)
            .toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

        doc.fontSize(10);
        doc.text(`Pasien         : ${consultation.userId.name}`);
        doc.text(`ID Pasien      : ${consultation.userId._id.toString().slice(-8).toUpperCase()}`);
        doc.text(`Tanggal        : ${tgl}`);
        doc.text(`Dokter         : dr. ${consultation.doctorId.name}`);
        if (consultation.doctorId.specialization) {
            doc.text(`Spesialisasi   : ${consultation.doctorId.specialization}`);
        }
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(0.5);

        // SOAP
        const section = (label, content) => {
            doc.font('Helvetica-Bold').text(label);
            doc.font('Helvetica').text(content || '-');
            doc.moveDown(0.5);
        };

        section('S — Keluhan (Subjective)', consultation.symptoms || '-');
        if (consultation.medicalHistory) {
            doc.font('Helvetica-Bold').text('Riwayat Penyakit');
            doc.font('Helvetica').text(consultation.medicalHistory);
            doc.moveDown(0.5);
        }
        section('O — Pemeriksaan (Objective)', mr.objectiveFindings);
        section('A — Diagnosis (Assessment)',  mr.assessment);
        section('P — Rencana (Plan)',          mr.plan);
        if (mr.doctorNotes) section('Catatan Dokter', mr.doctorNotes);

        doc.moveDown(1);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(0.5);
        doc.text(`Bogor, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, { align: 'right' });
        doc.moveDown(2.5);
        doc.font('Helvetica-Bold').text(`dr. ${consultation.doctorId.name}`, { align: 'right' });
        doc.font('Helvetica').fontSize(9).text(consultation.doctorId.specialization || '', { align: 'right' });

        doc.end();
    } catch (err) {
        res.status(500).json({ message: 'Gagal generate PDF rekam medis', error: err.message });
    }
});


// ═══════════════════════════════════════════════════════════════════════════════
// 6. RATING (pasien, setelah completed)
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/:id/rating', auth, async (req, res) => {
    try {
        const { rating, comment } = req.body;
        if (!rating || rating < 1 || rating > 5) return res.status(400).json({ message: 'Rating 1–5' });

        const consultation = await Consultation.findById(req.params.id)
            .populate('doctorId', 'name specialization consultationFee userId');
        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });
        if (consultation.userId.toString() !== req.userId) return res.status(403).json({ message: 'Bukan konsultasi Anda' });
        if (consultation.status !== 'completed') return res.status(400).json({ message: 'Konsultasi belum selesai' });
        if (consultation.rating) return res.status(400).json({ message: 'Sudah pernah memberi rating' });

        consultation.rating = rating;
        consultation.ratingComment = comment || '';
        consultation.ratedAt = new Date();
        await consultation.save();

        // Update rating dokter (fetch fresh Doctor agar bisa save)
        const doctor = await Doctor.findById(consultation.doctorId._id || consultation.doctorId);
        if (doctor) {
            const prevTotal = doctor.totalReviews || 0;
            const prevRating = doctor.rating || 0;
            doctor.totalReviews = prevTotal + 1;
            doctor.rating = Math.round(((prevRating * prevTotal) + rating) / doctor.totalReviews * 10) / 10;
            await doctor.save();
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

        const consultation = await Consultation.findById(req.params.id)
            .populate('userId', 'name email')
            .populate('doctorId', 'name specialization consultationFee userId');

        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });
        if (!['in_progress', 'ongoing', 'completed', 'no_show'].includes(consultation.status)) return res.status(400).json({ message: 'Konsultasi harus dalam status berlangsung atau selesai' });

        const doctor = await Doctor.findOne({ userId: req.userId });
        if (!doctor || consultation.doctorId._id.toString() !== doctor._id.toString()) {
            return res.status(403).json({ message: 'Anda bukan dokter konsultasi ini' });
        }

        const existing = await SickLetter.findOne({ consultationId: req.params.id });
        if (existing) return res.status(400).json({ message: 'Surat sakit sudah dibuat' });

        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + parseInt(restDays) - 1);

        const sickLetter = new SickLetter({
            consultationId: req.params.id,
            userId: consultation.userId._id,
            doctorId: doctor._id,
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
        consultation.sickLetter = sickLetter._id;
        await consultation.save();

        await createNotification({
            userId: consultation.userId._id,
            type: 'sick_letter_draft',
            title: 'Surat Sakit Dibuat',
            message: 'Dokter telah membuat surat sakit untuk Anda',
            data: { consultationId: consultation._id },
            io: req.app.get('io')
        });

        res.json({ success: true, sickLetter });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

router.put('/:id/sick-letter/issue', auth, doctorAuth, async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id)
            .populate('userId', 'name email')
            .populate('doctorId', 'name specialization consultationFee userId');

        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });

        const doctor = await Doctor.findOne({ userId: req.userId });
        if (!doctor || consultation.doctorId._id.toString() !== doctor._id.toString()) {
            return res.status(403).json({ message: 'Anda bukan dokter konsultasi ini' });
        }

        const sickLetter = await SickLetter.findOne({ consultationId: req.params.id });
        if (!sickLetter) return res.status(404).json({ message: 'Surat sakit tidak ditemukan' });

        sickLetter.status = 'issued';
        sickLetter.issuedAt = new Date();
        await sickLetter.save();

        await createNotification({
            userId: consultation.userId._id,
            type: 'sick_letter_issued',
            title: 'Surat Sakit Diterbitkan',
            message: `Surat sakit Anda telah diterbitkan oleh dr. ${consultation.doctorId.name}`,
            data: { consultationId: consultation._id },
            io: req.app.get('io')
        });

        res.json({ success: true, sickLetter });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/:id/sick-letter/pdf', auth, async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id)
            .populate('userId', 'name')
            .populate('doctorId', 'name specialization userId')
            .populate('sickLetter');

        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });

        // Hanya user/dokter terkait atau admin
        if (!canAccess(consultation, req.userId, req.userRole)) {
            return res.status(403).json({ message: 'Akses ditolak' });
        }

        const sickLetter = consultation.sickLetter;
        if (!sickLetter) return res.status(404).json({ message: 'Surat sakit tidak ditemukan' });

        const doc = new PDFDocument({ margin: 70, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=sick-letter-${sickLetter.letterNumber || 'draft'}.pdf`);
        doc.pipe(res);

        const tglPemeriksaan = new Date(consultation.scheduledAt || consultation.createdAt)
            .toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        const tglBogor = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

        const days = Math.ceil((new Date(sickLetter.endDate) - new Date(sickLetter.startDate)) / (1000 * 60 * 60 * 24)) + 1;
        const daysWord = ['nol','satu','dua','tiga','empat','lima','enam','tujuh','delapan','sembilan','sepuluh'][days] || days.toString();
        const tglMulai = new Date(sickLetter.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        const tglSelesai = new Date(sickLetter.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

        // ── Header ────────────────────────────────────────────────────────────────
        doc.fontSize(16).font('Helvetica-Bold').text('SURAT KETERANGAN SAKIT', { align: 'center' });
        doc.fontSize(11).font('Helvetica').text('Klinik Pratama IPB', { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(10).text(`Nomor : ${sickLetter.letterNumber || 'DRAFT'}`, { align: 'center' });
        doc.moveDown(0.8);
        doc.moveTo(70, doc.y).lineTo(525, doc.y).strokeColor('#cccccc').stroke();
        doc.moveDown(0.8);

        // ── Body ─────────────────────────────────────────────────────────────────
        doc.font('Helvetica').fontSize(11);
        doc.text('Yang bertanda tangan di bawah ini menerangkan bahwa:');
        doc.moveDown(0.8);

        // Identitas pasien (format tabel sederhana)
        const rowH = 18;
        const col1 = 70, col2 = 170;
        const rows = [
            ['Nama Pasien', `: ${consultation.userId.name}`],
            ...(sickLetter.patientAge ? [['Umur', `: ${sickLetter.patientAge}`]] : []),
            ...(sickLetter.patientGender ? [['Jenis Kelamin', `: ${sickLetter.patientGender}`]] : []),
        ];
        rows.forEach(([k, v]) => {
            doc.text(k, col1, doc.y, { continued: true, width: col2 - col1 });
            doc.text(v);
            doc.moveDown(0.2);
        });

        doc.moveDown(0.8);
        doc.text('Telah menjalani pemeriksaan pada:');
        doc.moveDown(0.4);
        doc.text('Tanggal', col1, doc.y, { continued: true, width: col2 - col1 });
        doc.text(`: ${tglPemeriksaan}`);
        doc.moveDown(0.8);

        doc.text(`Berdasarkan hasil pemeriksaan, yang bersangkutan didiagnosis mengalami:`);
        doc.moveDown(0.4);
        doc.font('Helvetica-Bold').text(`       ${sickLetter.diagnosis}`);
        doc.font('Helvetica').moveDown(0.8);

        doc.text('Sehubungan dengan hal tersebut, pasien disarankan untuk beristirahat selama:');
        doc.moveDown(0.4);
        doc.font('Helvetica-Bold').text(`       ${days} (${daysWord}) hari`);
        doc.font('Helvetica').text(`terhitung mulai tanggal ${tglMulai} sampai dengan ${tglSelesai}.`);
        doc.moveDown(0.8);

        if (sickLetter.notes) {
            doc.text(`Catatan: ${sickLetter.notes}`);
            doc.moveDown(0.8);
        }

        doc.text('Demikian surat keterangan ini dibuat untuk dapat dipergunakan sebagaimana mestinya.');
        doc.moveDown(2);

        // ── Tanda tangan ─────────────────────────────────────────────────────────
        doc.text(`Bogor, ${tglBogor}`, { align: 'right' });
        doc.moveDown(0.4);
        doc.text('Dokter', { align: 'right' });
        doc.moveDown(3);
        doc.font('Helvetica-Bold').text(`dr. ${consultation.doctorId.name}`, { align: 'right' });
        if (consultation.doctorId.specialization) {
            doc.font('Helvetica').fontSize(9).text(consultation.doctorId.specialization, { align: 'right' });
        }

        doc.end();
    } catch (err) {
        res.status(500).json({ message: 'Gagal generate PDF', error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. GET SINGLE (dengan access control ketat: hanya user/dokter terkait atau admin)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/:id', auth, async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id)
            .populate('userId', 'name email')
            .populate('doctorId', 'name specialization photo isOnline userId')
            .populate('paymentId')
            .populate({ path: 'sickLetter', select: 'letterNumber diagnosis status startDate endDate sickLeaveDays notes issuedAt patientAge patientGender patientWeight' });

        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });

        // ★ Akses room hanya jika paid / scheduled / ongoing / completed
        const chatAllowedStatuses = ['confirmed', 'in_progress', 'completed', 'no_show',
            // legacy
            'paid', 'scheduled', 'ongoing'];
        const isOwnerOrDoctor = canAccess(consultation, req.userId, req.userRole);

        if (!isOwnerOrDoctor) return res.status(403).json({ message: 'Akses ditolak' });

        // Blokir akses chat jika belum bayar
        if (!chatAllowedStatuses.includes(consultation.status) && req.userRole !== 'admin') {
            // Kembalikan data tapi tanpa messages
            const safe = consultation.toObject();
            safe.messages = [];
            return res.json({ ...safe, _accessRestricted: true });
        }

        res.json(consultation);
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// DELETE (hanya jika draft/pending_payment, oleh user sendiri)
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

module.exports = router;