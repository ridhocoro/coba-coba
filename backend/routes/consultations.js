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

// Daftar konsultasi dokter (paid, scheduled, ongoing)
router.get('/doctor/pending', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ userId: req.userId });
        if (!doctor) return res.status(404).json({ success: false, message: 'Data dokter tidak ditemukan' });

        const consultations = await Consultation.find({
            doctorId: doctor._id,
            status: { $in: ['paid', 'scheduled', 'ongoing'] }
        })
            .populate('userId', 'name email phone')
            .sort('-createdAt');

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
        const { doctorId, consultationType, scheduleType, scheduledAt, symptoms, medicalHistory } = req.body;

        const doctor = await Doctor.findById(doctorId);
        if (!doctor || !doctor.isActive) {
            return res.status(404).json({ message: 'Dokter tidak ditemukan atau tidak aktif' });
        }

        // ── Validasi: instant hanya jika dokter online ─────────────────────
        if (scheduleType === 'instant' && !doctor.isOnline) {
            return res.status(400).json({
                message: 'Konsultasi langsung (instant) tidak tersedia. Dokter sedang offline. Pilih jadwal terjadwal.'
            });
        }

        // ── Validasi: tipe konsultasi harus diizinkan dokter ──────────────
        const settings = doctor.consultationSettings || {};
        const typeAllowed = {
            chat:       settings.allowChat      !== false,
            voice_call: settings.allowVoiceCall !== false,
            video_call: settings.allowVideoCall !== false,
        };
        if (!typeAllowed[consultationType]) {
            return res.status(400).json({
                message: `Dokter tidak mengaktifkan fitur ${consultationType === 'voice_call' ? 'Voice Call' : 'Video Call'}. Pilih jenis konsultasi lain.`
            });
        }

        // Validasi scheduled
        if (scheduleType === 'scheduled') {
            if (!scheduledAt) return res.status(400).json({ message: 'scheduledAt wajib diisi untuk konsultasi terjadwal' });
            if (new Date(scheduledAt) <= new Date()) return res.status(400).json({ message: 'Jadwal harus di masa mendatang' });
        }

        // Url lampiran keluhan
        const attachmentUrls = (req.files || []).map(f => `/uploads/attachments/${f.filename}`);

        const paymentDeadline = new Date(Date.now() + 15 * 60 * 1000); // 15 menit

        const consultation = new Consultation({
            userId: req.userId,
            doctorId,
            consultationType: consultationType || 'chat',
            scheduleType: scheduleType || 'instant',
            scheduledAt: scheduleType === 'scheduled' ? new Date(scheduledAt) : undefined,
            symptoms,
            medicalHistory,
            attachmentUrls,
            status: 'pending_payment',
            paymentDeadline
        });

        await consultation.save();

        // Notif admin/dokter
        const doctorUser = await User.findById(doctor.userId);
        if (doctorUser) {
            await createNotification({
                userId: doctorUser._id,
                type: 'consultation_request',
                title: 'Permintaan Konsultasi Baru',
                message: `Ada pasien baru yang meminta konsultasi dengan Anda`,
                data: { consultationId: consultation._id, url: `/consultations/${consultation._id}` },
                io: req.app.get('io')
            });
        }

        res.json({
            success: true,
            consultation,
            amount: doctor.consultationFee,
            paymentDeadline
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. STATUS TRANSITIONS
// ═══════════════════════════════════════════════════════════════════════════════

// PAID (dipanggil setelah admin verifikasi pembayaran, atau oleh webhook)
// Ini tetap dipakai oleh admin/payment route. Route ini mengubah pending_payment → paid
// dan otomatis ke ongoing (instant) atau scheduled (scheduled)
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

// REJECTED PAYMENT (admin)
router.put('/:id/reject-payment', auth, async (req, res) => {
    try {
        if (req.userRole !== 'admin') return res.status(403).json({ message: 'Hanya admin' });

        const consultation = await Consultation.findById(req.params.id);
        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });
        if (consultation.status !== 'pending_payment') {
            return res.status(400).json({ message: 'Hanya bisa reject di status pending_payment' });
        }

        consultation.status = 'rejected_payment';
        consultation.rejectedAt = new Date();
        consultation.rejectionReason = req.body.reason || '';
        await consultation.save();

        await createNotification({
            userId: consultation.userId,
            type: 'payment_rejected',
            title: 'Pembayaran Ditolak',
            message: `Pembayaran Anda ditolak. ${req.body.reason || 'Silakan hubungi admin.'}`,
            data: { consultationId: consultation._id },
            io: req.app.get('io')
        });

        res.json({ success: true, consultation });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// START (scheduled → ongoing, oleh dokter)
router.put('/:id/start', auth, async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id)
            .populate('userId', 'name')
            .populate('doctorId', 'name userId');

        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });

        // FIX: Verifikasi bahwa dokter yang request adalah dokter konsultasi ini
        if (req.userRole === 'doctor') {
            const doctor = await Doctor.findOne({ userId: req.userId });
            const isThisDoctor = doctor && consultation.doctorId._id.toString() === doctor._id.toString();
            if (!isThisDoctor) return res.status(403).json({ message: 'Anda bukan dokter konsultasi ini' });
        } else if (req.userRole !== 'admin') {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        if (!['paid', 'scheduled'].includes(consultation.status)) {
            return res.status(400).json({ message: `Tidak bisa mulai dari status ${consultation.status}` });
        }

        consultation.status = 'ongoing';
        consultation.startTime = new Date();
        await consultation.save();

        await createNotification({
            userId: consultation.userId._id,
            type: 'consultation_started',
            title: 'Konsultasi Dimulai',
            message: `dr. ${consultation.doctorId.name} telah bergabung. Konsultasi dimulai!`,
            data: { consultationId: consultation._id, url: `/consultations/${consultation._id}` },
            io: req.app.get('io')
        });

        res.json({ success: true, consultation });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// END (ongoing → completed, oleh dokter)
router.put('/:id/end', auth, async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id)
            .populate('userId', 'name')
            .populate('doctorId', 'name userId');

        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });
        if (consultation.status !== 'ongoing') return res.status(400).json({ message: 'Konsultasi belum berlangsung' });

        // Hanya dokter atau admin yang bisa end
        const doctor = await Doctor.findOne({ userId: req.userId });
        const isThisDoctor = doctor && consultation.doctorId._id.toString() === doctor._id.toString();
        if (!isThisDoctor && req.userRole !== 'admin') return res.status(403).json({ message: 'Unauthorized' });

        consultation.status = 'completed';
        consultation.endTime = new Date();
        await consultation.save();

        await createNotification({
            userId: consultation.userId._id,
            type: 'consultation_ended',
            title: 'Konsultasi Selesai',
            message: `Konsultasi dengan dr. ${consultation.doctorId.name} telah selesai. Jangan lupa beri rating!`,
            data: { consultationId: consultation._id, url: `/consultations/${consultation._id}` },
            io: req.app.get('io')
        });

        res.json({ success: true, consultation });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// NO_SHOW (scheduled → no_show, oleh admin/dokter)
router.put('/:id/no-show', auth, async (req, res) => {
    try {
        if (req.userRole !== 'admin' && req.userRole !== 'doctor') {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const consultation = await Consultation.findById(req.params.id);
        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });
        if (consultation.status !== 'scheduled') return res.status(400).json({ message: 'Hanya bisa dari status scheduled' });

        consultation.status = 'no_show';
        consultation.cancelledAt = new Date();
        consultation.cancelledBy = req.userRole;
        consultation.cancelReason = req.body.reason || 'Salah satu pihak tidak hadir';
        await consultation.save();

        await createNotification({
            userId: consultation.userId,
            type: 'consultation_no_show',
            title: 'Konsultasi Tidak Hadir',
            message: `Konsultasi Anda ditandai no-show. ${req.body.reason || ''}`,
            data: { consultationId: consultation._id },
            io: req.app.get('io')
        });

        res.json({ success: true, consultation });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// CANCEL (user, dengan batasan 1 hari sebelum jadwal jika scheduled)
router.put('/:id/cancel', auth, async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id)
            .populate('doctorId', 'name userId');

        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });

        // Hanya user pemilik atau admin
        if (consultation.userId.toString() !== req.userId && req.userRole !== 'admin') {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const allowedStatuses = ['pending_payment', 'paid', 'scheduled'];
        if (!allowedStatuses.includes(consultation.status)) {
            return res.status(400).json({ message: `Tidak bisa cancel dari status ${consultation.status}` });
        }

        // Jika scheduled: user hanya bisa cancel minimal 1 hari sebelum jadwal
        if (consultation.status === 'scheduled' && req.userRole !== 'admin') {
            const hoursBefore = (new Date(consultation.scheduledAt) - new Date()) / (1000 * 3600);
            if (hoursBefore < 24) {
                return res.status(400).json({ message: 'Pembatalan harus dilakukan minimal 1 hari sebelum jadwal konsultasi' });
            }
        }

        consultation.status = 'cancelled';
        consultation.cancelledAt = new Date();
        consultation.cancelledBy = req.userRole === 'admin' ? 'admin' : 'user';
        consultation.cancelReason = req.body.reason || '';
        await consultation.save();

        // Notif dokter
        if (consultation.doctorId?.userId) {
            await createNotification({
                userId: consultation.doctorId.userId,
                type: 'consultation_cancelled',
                title: 'Konsultasi Dibatalkan',
                message: `Pasien membatalkan konsultasi. ${req.body.reason || ''}`,
                data: { consultationId: consultation._id },
                io: req.app.get('io')
            });
        }

        res.json({ success: true, consultation });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
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
        if (!['paid', 'scheduled', 'ongoing'].includes(consultation.status)) {
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

        // Emit ke socket room
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

// Upload foto dalam chat
router.post('/:id/messages/image', auth, uploadChat.single('image'), async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id)
            .populate('userId', 'name')
            .populate('doctorId', 'name userId');

        if (!consultation) return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });
        if (!['paid', 'scheduled', 'ongoing'].includes(consultation.status)) {
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
        const paidStatuses = ['paid', 'scheduled', 'ongoing', 'completed'];
        const isOwnerOrDoctor = canAccess(consultation, req.userId, req.userRole);

        if (!isOwnerOrDoctor) return res.status(403).json({ message: 'Akses ditolak' });

        // Blokir akses chat jika belum bayar
        if (!paidStatuses.includes(consultation.status) && req.userRole !== 'admin') {
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