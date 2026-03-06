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
const uploadAttachment = multer({ storage: attachStorage, limits: { fileSize: 5 * 1024 * 1024 } });

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
            .populate({ path: 'sickLetter', select: 'letterNumber diagnosis status startDate endDate' })
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
            status: { $in: ['waiting_verification', 'confirmed', 'in_progress'] }
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

        // Cek hari praktik
        const dayOfWeek = slotWIB.getUTCDay();
        if (!avail.practiceDays.includes(dayOfWeek)) {
            return res.status(400).json({ message: 'Dokter tidak praktik pada hari tersebut' });
        }

        // Jam WIB dari slot
        const slotHHMM = `${String(slotWIB.getUTCHours()).padStart(2,'0')}:${String(slotWIB.getUTCMinutes()).padStart(2,'0')}`;

        // Validasi strict: slot harus ada di grid availability (cegah bypass frontend)
        if (!avail.isValidSlot(slotHHMM)) {
            return res.status(400).json({
                message: 'Slot waktu tidak valid. Pilih slot yang tersedia dari sistem.',
            });
        }

        // Validasi scheduledEnd: harus tepat = scheduledAt + sessionDuration
        const slotEndWIB  = new Date(slotEnd.getTime() + WIB_OFFSET_MS);
        const slotEndHHMM = `${String(slotEndWIB.getUTCHours()).padStart(2,'0')}:${String(slotEndWIB.getUTCMinutes()).padStart(2,'0')}`;
        const toMin = (hhmm) => { const [h,m] = hhmm.split(':').map(Number); return h*60+m; };
        const expectedEndMin = toMin(slotHHMM) + avail.sessionDuration;
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

// ── Admin: verifikasi pembayaran → confirmed ──────────────────────────────────
router.put('/:id/verify-payment', auth, async (req, res) => {
    try {
        if (req.userRole !== 'admin') return res.status(403).json({ message: 'Akses ditolak' });

        const consultation = await Consultation.findById(req.params.id)
            .populate('doctorId', 'userId name')
            .populate('userId', 'name');

        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });
        if (consultation.status !== 'waiting_verification') {
            return res.status(400).json({ message: `Status harus waiting_verification, saat ini: ${consultation.status}` });
        }

        consultation.status = 'confirmed';
        consultation.paymentVerified = true;
        consultation.verifiedAt = new Date();
        consultation.verifiedBy = req.userId;
        await consultation.save();

        // Notif user
        await createNotification({
            userId: consultation.userId._id,
            type: 'consultation_confirmed',
            title: 'Pembayaran Dikonfirmasi',
            message: `Pembayaran Anda telah diverifikasi. Konsultasi terjadwal pada ${new Date(consultation.scheduledAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`,
            data: { consultationId: consultation._id },
            io: req.app.get('io')
        });

        // Notif dokter
        if (consultation.doctorId?.userId) {
            await createNotification({
                userId: consultation.doctorId.userId,
                type: 'consultation_request',
                title: 'Konsultasi Baru Terkonfirmasi',
                message: `Pasien ${consultation.userId.name} akan konsultasi pada ${new Date(consultation.scheduledAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`,
                data: { consultationId: consultation._id },
                io: req.app.get('io')
            });
        }

        res.json({ success: true, message: 'Pembayaran berhasil diverifikasi', consultation });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// ── Admin: tolak pembayaran → kembali ke pending_payment atau expired ─────────
router.put('/:id/reject-payment', auth, async (req, res) => {
    try {
        if (req.userRole !== 'admin') return res.status(403).json({ message: 'Akses ditolak' });

        const consultation = await Consultation.findById(req.params.id);
        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });
        if (consultation.status !== 'waiting_verification') {
            return res.status(400).json({ message: 'Status harus waiting_verification' });
        }

        // Jika masih dalam window lock (slot belum expired), kembalikan ke pending_payment
        const now = new Date();
        const slotStillValid = consultation.scheduledAt > now;
        if (slotStillValid) {
            consultation.status = 'pending_payment';
            consultation.paymentProofUrl = null;
            consultation.paymentDeadline = new Date(now.getTime() + 15 * 60 * 1000); // extend 15 mnt lagi
        } else {
            consultation.status = 'expired';
        }
        consultation.rejectedAt = now;
        consultation.rejectionReason = req.body.reason || 'Bukti pembayaran tidak valid';
        await consultation.save();

        await createNotification({
            userId: consultation.userId,
            type: 'payment_rejected',
            title: 'Bukti Pembayaran Ditolak',
            message: req.body.reason || 'Bukti pembayaran tidak valid. Silakan upload ulang.',
            data: { consultationId: consultation._id },
            io: req.app.get('io')
        });

        res.json({ success: true, message: 'Pembayaran ditolak', consultation });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

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
        const consultation = await Consultation.findById(req.params.id)
            .populate('doctorId', 'userId');

        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });

        const doctorUserId = consultation.doctorId?.userId?.toString();
        if (doctorUserId !== req.userId && req.userRole !== 'admin') {
            return res.status(403).json({ message: 'Hanya dokter yang bersangkutan yang dapat memulai' });
        }

        // Izinkan dari confirmed ATAU in_progress (sudah di-auto-start oleh cron)
        if (!['confirmed', 'in_progress'].includes(consultation.status)) {
            return res.status(400).json({ message: `Status harus confirmed atau in_progress, saat ini: ${consultation.status}` });
        }

        // Jika sudah in_progress (auto oleh cron), kembalikan saja
        if (consultation.status === 'in_progress') {
            return res.json({ success: true, message: 'Konsultasi sudah berjalan', consultation });
        }

        consultation.status = 'in_progress';
        consultation.startTime = new Date();
        await consultation.save();

        await createNotification({
            userId: consultation.userId,
            type: 'consultation_started',
            title: 'Konsultasi Dimulai 🩺',
            message: 'Dokter telah memulai sesi konsultasi Anda. Silakan mulai chat.',
            data: { consultationId: consultation._id },
            io: req.app.get('io')
        });

        // Emit socket real-time
        const io = req.app.get('io');
        if (io) {
            io.to(`user-${consultation.userId}`).emit('consultation-status-update', {
                consultationId: consultation._id.toString(),
                status: 'in_progress',
            });
        }

        res.json({ success: true, message: 'Konsultasi dimulai', consultation });
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

        consultation.status = finalStatus;
        consultation.endTime = new Date();
        await consultation.save();

        await createNotification({
            userId: consultation.userId,
            type: 'consultation_ended',
            title: finalStatus === 'no_show' ? 'Sesi Berakhir — Tidak Hadir' : 'Konsultasi Selesai ✅',
            message: finalStatus === 'no_show'
                ? 'Dokter telah mengakhiri sesi namun Anda tidak mengirim pesan. Status: Tidak Hadir.'
                : 'Konsultasi Anda telah selesai. Silakan beri rating.',
            data: { consultationId: consultation._id },
            io: req.app.get('io')
        });

        const io = req.app.get('io');
        if (io) {
            io.to(`user-${consultation.userId}`).emit('consultation-status-update', {
                consultationId: consultation._id.toString(),
                status        : finalStatus,
            });
        }

        res.json({ success: true, message: `Konsultasi ${finalStatus}`, consultation });
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

// ── Legacy: mark-paid (tetap ada untuk backward compat, redirect ke verify) ───
router.put('/:id/mark-paid', auth, async (req, res) => {
    return res.status(410).json({ message: 'Endpoint ini sudah diganti dengan /verify-payment (admin) dan /upload-proof (user)' });
});

router.put('/:id/no-show', auth, async (req, res) => {
    return res.status(410).json({ message: 'No-show ditentukan otomatis oleh sistem' });
});

router.put('/:id/cancel', auth, async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id);
        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });

        // User hanya bisa cancel saat pending_payment
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

// ── Admin: Verifikasi pembayaran manual → confirmed/scheduled ─────────────────
router.put('/:id/mark-paid', auth, async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id)
            .populate('userId', 'name')
            .populate('doctorId', 'name userId');

        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });
        if (req.userRole !== 'admin') return res.status(403).json({ message: 'Hanya admin' });
        if (consultation.status !== 'pending_payment') {
            return res.status(400).json({ message: `Status saat ini: ${consultation.status}` });
        }

        consultation.paymentVerified = true;
        consultation.verifiedAt = new Date();

        if (consultation.scheduleType === 'instant') {
            consultation.status = 'ongoing';
            consultation.startTime = new Date();
        } else {
            consultation.status = 'scheduled';
        }

        await consultation.save();

        // Notif user
        await createNotification({
            userId: consultation.userId._id,
            type: 'payment_verified',
            title: 'Pembayaran Terverifikasi',
            message: consultation.scheduleType === 'instant'
                ? 'Pembayaran dikonfirmasi, konsultasi Anda dimulai!'
                : `Pembayaran dikonfirmasi. Konsultasi dijadwalkan pada ${consultation.scheduledAt?.toLocaleString('id-ID') || '-'}`,
            data: { consultationId: consultation._id, url: `/consultations/${consultation._id}` },
            io: req.app.get('io')
        });

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

        // Hanya bisa chat jika paid/ongoing (access control)
        if (!['confirmed', 'in_progress', 'completed', 'paid', 'scheduled', 'ongoing'].includes(consultation.status)) {
            return res.status(403).json({ message: 'Konsultasi belum aktif' });
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
            data: { consultationId: consultation._id, url: `/consultations/${consultation._id}` },
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
        if (!['confirmed', 'in_progress', 'completed', 'paid', 'scheduled', 'ongoing'].includes(consultation.status)) {
            return res.status(403).json({ message: 'Konsultasi belum aktif' });
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
// 5. RESEP DIGITAL (dokter)
// ═══════════════════════════════════════════════════════════════════════════════

router.put('/:id/prescription', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ userId: req.userId });
        if (!doctor) return res.status(404).json({ message: 'Data dokter tidak ditemukan' });

        const consultation = await Consultation.findById(req.params.id);
        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });
        if (consultation.doctorId.toString() !== doctor._id.toString()) {
            return res.status(403).json({ message: 'Anda bukan dokter konsultasi ini' });
        }
        if (!['ongoing', 'completed'].includes(consultation.status)) {
            return res.status(400).json({ message: 'Resep hanya bisa dikirim saat konsultasi berlangsung atau selesai' });
        }

        consultation.prescription = req.body.prescription;
        if (req.body.diagnosis) consultation.diagnosis = req.body.diagnosis;
        await consultation.save();

        // Notif user
        await createNotification({
            userId: consultation.userId,
            type: 'prescription_sent',
            title: 'Resep Digital Dikirim',
            message: `dr. ${doctor.name} telah mengirimkan resep untuk Anda`,
            data: { consultationId: consultation._id, url: `/consultations/${consultation._id}` },
            io: req.app.get('io')
        });

        // Emit via socket
        const io = req.app.get('io');
        if (io) {
            io.to(`consultation-${consultation._id}`).emit('prescription-update', {
                prescription: consultation.prescription,
                diagnosis: consultation.diagnosis
            });
        }

        res.json({ success: true, prescription: consultation.prescription });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
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
        const { diagnosis, restDays, notes } = req.body;
        if (!diagnosis || !restDays) return res.status(400).json({ message: 'Diagnosis dan hari istirahat wajib diisi' });

        const consultation = await Consultation.findById(req.params.id)
            .populate('userId', 'name email')
            .populate('doctorId', 'name specialization consultationFee userId');

        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });
        if (!['ongoing', 'completed'].includes(consultation.status)) return res.status(400).json({ message: 'Konsultasi harus ongoing atau completed' });

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
            .populate('doctorId', 'name userId')
            .populate('sickLetter');

        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });

        // Hanya user/dokter terkait atau admin
        if (!canAccess(consultation, req.userId, req.userRole)) {
            return res.status(403).json({ message: 'Akses ditolak' });
        }

        const sickLetter = consultation.sickLetter;
        if (!sickLetter) return res.status(404).json({ message: 'Surat sakit tidak ditemukan' });

        const doc = new PDFDocument();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=sick-letter-${sickLetter.letterNumber || 'draft'}.pdf`);
        doc.pipe(res);

        doc.fontSize(18).text('SURAT KETERANGAN SAKIT', { align: 'center' });
        doc.moveDown();
        doc.fontSize(11).text(`Nomor: ${sickLetter.letterNumber || 'DRAFT'}`, { align: 'center' });
        doc.moveDown(2);
        doc.text(`Yang bertanda tangan di bawah ini menerangkan bahwa:`);
        doc.moveDown();
        doc.text(`Nama   : ${consultation.userId.name}`);
        doc.text(`Tanggal Konsultasi: ${new Date(consultation.createdAt).toLocaleDateString('id-ID')}`);
        doc.text(`Diagnosis: ${sickLetter.diagnosis}`);
        doc.moveDown();
        const days = Math.ceil((sickLetter.endDate - sickLetter.startDate) / (1000 * 60 * 60 * 24)) + 1;
        doc.text(`Dianjurkan istirahat selama ${days} hari (${sickLetter.startDate.toLocaleDateString('id-ID')} s/d ${sickLetter.endDate.toLocaleDateString('id-ID')}).`);
        if (sickLetter.notes) { doc.moveDown(); doc.text(`Catatan: ${sickLetter.notes}`); }
        doc.moveDown(3);
        doc.text(`Bogor, ${new Date().toLocaleDateString('id-ID')}`);
        doc.moveDown();
        doc.text(`Dokter,`);
        doc.moveDown(3);
        doc.text(`dr. ${consultation.doctorId.name}`);
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
            .populate({ path: 'sickLetter', select: 'letterNumber diagnosis status startDate endDate sickLeaveDays notes' });

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