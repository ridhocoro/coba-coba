/**
 * routes/admin.js — Admin Dashboard API (rombak total)
 *
 * ENDPOINTS:
 * ── Analytics ──────────────────────────────────────────────────────
 * GET  /analytics/operational        → operasional harian
 * GET  /analytics/financial          → pendapatan & statistik
 * GET  /analytics/growth             → pertumbuhan pasien & dokter
 *
 * ── Dokter ─────────────────────────────────────────────────────────
 * GET  /doctors                      → list dokter (filter by spesialisasi)
 * GET  /doctors/:id                  → detail dokter + statistik rating
 * PUT  /doctors/:id                  → edit profil + fee
 * PUT  /doctors/:id/toggle-status    → aktif/nonaktif
 * POST /doctors/:id/photo            → upload foto dokter
 * GET  /doctors/:id/schedule         → jadwal konsultasi & janji temu
 * PUT  /doctors/:id/schedule/override → blokir hari (cuti/absen)
 * DELETE /doctors/:id/schedule/override/:date → hapus blokiran
 * GET  /doctors/:id/schedule/overrides → list blokiran aktif
 *
 * ── Pasien ─────────────────────────────────────────────────────────
 * GET  /users                        → list pasien (user + mahasiswa)
 * GET  /users/:id                    → detail + history transaksi
 * GET  /users/:id/quota              → kuota mahasiswa
 * PUT  /users/:id/quota              → reset/tambah kuota mahasiswa
 * PUT  /users/:id/toggle-status      → aktif/nonaktif (anti spam)
 *
 * ── Konsultasi ─────────────────────────────────────────────────────
 * GET  /consultations                → rekap (filter tanggal + dokter)
 *
 * ── Janji Temu ─────────────────────────────────────────────────────
 * GET  /appointments                 → rekap (filter tanggal + dokter)
 * PUT  /appointments/:id/check-in    → pasien check-in
 * PUT  /appointments/:id/cancel      → batalkan + notifikasi
 *
 * ── Farmasi ────────────────────────────────────────────────────────
 * GET  /pharmacy/low-stock           → obat di bawah minStock
 * GET  /pharmacy/best-sellers        → Top 5 terlaris
 * GET  /pharmacy/orders              → semua pesanan (filter status+tanggal)
 * PUT  /pharmacy/orders/:id/status   → update status pesanan
 *
 * ── Surat Sakit ────────────────────────────────────────────────────
 * GET  /sick-letters                 → semua surat sakit
 *
 * ── Laporan & Keuangan ─────────────────────────────────────────────
 * GET  /reports/revenue              → laporan pendapatan (export CSV/Excel)
 * GET  /reports/subsidi-mahasiswa    → laporan subsidi mahasiswa (export CSV/Excel)
 *
 * ── Chat Admin-Dokter ──────────────────────────────────────────────
 * GET  /chat/threads                 → list thread chat semua dokter
 * GET  /chat/:doctorId               → pesan di thread tertentu
 * POST /chat/:doctorId               → kirim pesan (text/file)
 * PUT  /chat/:doctorId/read          → tandai sudah dibaca
 */

const express   = require('express');
const router    = express.Router();
const multer    = require('multer');
const path      = require('path');
const fs        = require('fs');

const auth      = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const { createNotification } = require('../utils/notificationHelper');

const User         = require('../models/User');
const Doctor       = require('../models/Doctor');
const Consultation = require('../models/Consultation');
const Appointment  = require('../models/Appointment');
const Order        = require('../models/Order');
const Medicine     = require('../models/Medicine');
const SickLetter   = require('../models/SickLetter');
const AdminChat    = require('../models/AdminChat');
const DoctorScheduleOverride = require('../models/DoctorScheduleOverride');
const DoctorAvailability     = require('../models/DoctorAvailability');
const AppointmentAvailability = require('../models/AppointmentAvailability');

// ── Middleware shorthand ──────────────────────────────────────────────────────
const guard = [auth, adminAuth];

// ── Multer: foto dokter ───────────────────────────────────────────────────────
const photoDir = path.join(__dirname, '../uploads/doctors');
if (!fs.existsSync(photoDir)) fs.mkdirSync(photoDir, { recursive: true });
const uploadDoctorPhoto = multer({
    storage: multer.diskStorage({
        destination: (_, __, cb) => cb(null, photoDir),
        filename: (req, file, cb) =>
            cb(null, `doctor-${req.params.id}-${Date.now()}${path.extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_, file, cb) => {
        if (/image\/(jpeg|jpg|png|webp)/.test(file.mimetype)) cb(null, true);
        else cb(new Error('Hanya gambar JPG/PNG/WebP'));
    },
});

// ── Multer: file chat ─────────────────────────────────────────────────────────
const chatDir = path.join(__dirname, '../uploads/admin-chat');
if (!fs.existsSync(chatDir)) fs.mkdirSync(chatDir, { recursive: true });
const uploadChatFile = multer({
    storage: multer.diskStorage({
        destination: (_, __, cb) => cb(null, chatDir),
        filename: (_, file, cb) => cb(null, `chat-${Date.now()}-${file.originalname}`),
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const WIB = 7 * 60 * 60 * 1000;

function dateRange(period, from, to) {
    const WIB_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7
    const now = new Date();

    // Hitung awal & akhir hari WIB dalam UTC
    const nowWib       = new Date(now.getTime() + WIB_OFFSET_MS);
    const todayWibStr  = nowWib.toISOString().slice(0, 10); // 'YYYY-MM-DD'
    const todayStart   = new Date(todayWibStr + 'T00:00:00+07:00');
    const todayEnd     = new Date(todayWibStr + 'T23:59:59+07:00');

    if (period === 'today') return { start: todayStart, end: todayEnd };

    if (period === '7d') {
        const s = new Date(todayStart.getTime() - 6 * 86400000);
        return { start: s, end: todayEnd };
    }
    if (period === '30d') {
        const s = new Date(todayStart.getTime() - 29 * 86400000);
        return { start: s, end: todayEnd };
    }
    if (from && to) {
        return {
            start: new Date(from + 'T00:00:00+07:00'),
            end  : new Date(to   + 'T23:59:59+07:00'),
        };
    }
    // default: 30 hari
    const s = new Date(todayStart.getTime() - 29 * 86400000);
    return { start: s, end: todayEnd };
}

// ════════════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ════════════════════════════════════════════════════════════════════════════════

// GET /admin/analytics/operational
router.get('/analytics/operational', guard, async (req, res) => {
    try {
        const now          = new Date();
        const wibStr       = new Date(now.getTime() + 7*3600000).toISOString().slice(0,10);
        const todayStart   = new Date(wibStr + 'T00:00:00+07:00');
        const todayEnd     = new Date(wibStr + 'T23:59:59+07:00');

        const [
            pendingRx,
            paidOrders,
            pickupReady,
            todayAppt,
            todayConsult,
        ] = await Promise.all([
            Order.countDocuments({ status: 'waiting_prescription' }),
            Order.countDocuments({ status: 'paid' }),
            Order.countDocuments({ status: 'siap_diambil' }),
            Appointment.countDocuments({ scheduledAt: { $gte: todayStart, $lte: todayEnd }, status: { $in: ['scheduled','checked_in'] } }),
            Consultation.countDocuments({ scheduledAt: { $gte: todayStart, $lte: todayEnd }, status: { $in: ['confirmed','in_progress'] } }),
        ]);

        res.json({ pendingRx, paidOrders, pickupReady, todayAppt, todayConsult });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET /admin/analytics/financial?period=today|7d|30d&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/analytics/financial', guard, async (req, res) => {
    try {
        const { period, from, to } = req.query;
        const { start, end } = dateRange(period, from, to);

        const [consultations, orders, appointments] = await Promise.all([
            Consultation.find({ paidAt: { $gte: start, $lte: end }, status: { $in: ['confirmed','in_progress','completed','refunded'] } }).select('amount paidAt'),
            Order.find({ createdAt: { $gte: start, $lte: end }, status: { $in: ['paid','diproses','dikirim','terkirim','selesai','refunded'] } }).select('totalAmount shippingCost createdAt'),
            Appointment.find({ scheduledAt: { $gte: start, $lte: end }, status: { $in: ['checked_in','completed'] } }).select('scheduledAt'),
        ]);

        const revenueConsultation = consultations.reduce((s, c) => s + (c.amount || 0), 0);
        const revenuePharmacy     = orders.reduce((s, o) => s + (o.totalAmount || 0), 0);

        const completedConsultations = await Consultation.countDocuments({ status: 'completed', updatedAt: { $gte: start, $lte: end } });
        const completedOrders        = await Order.countDocuments({ status: 'selesai', completedAt: { $gte: start, $lte: end } });
        const completedAppointments  = await Appointment.countDocuments({ status: 'completed', updatedAt: { $gte: start, $lte: end } });

        // Rating rata-rata
        const ratingData = await Consultation.find({ rating: { $gt: 0 }, updatedAt: { $gte: start, $lte: end } }).select('rating');
        const avgRating  = ratingData.length > 0
            ? (ratingData.reduce((s, c) => s + c.rating, 0) / ratingData.length).toFixed(1)
            : 0;

        res.json({
            revenue: {
                total        : revenueConsultation + revenuePharmacy,
                consultation : revenueConsultation,
                pharmacy     : revenuePharmacy,
            },
            completed: {
                consultations: completedConsultations,
                orders       : completedOrders,
                appointments : completedAppointments,
            },
            avgRating: parseFloat(avgRating),
            period   : { start, end },
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET /admin/analytics/growth?period=30d&from=&to=
router.get('/analytics/growth', guard, async (req, res) => {
    try {
        const { period, from, to } = req.query;
        const { start, end } = dateRange(period, from, to);

        const [newPatients, totalPatients, totalDoctors, activeDoctors] = await Promise.all([
            User.countDocuments({ role: { $in: ['user','mahasiswa'] }, createdAt: { $gte: start, $lte: end } }),
            User.countDocuments({ role: { $in: ['user','mahasiswa'] } }),
            Doctor.countDocuments({}),
            Doctor.countDocuments({ isActive: true }),
        ]);

        // Rating per dokter
        const doctors = await Doctor.find({ isActive: true }).select('name rating totalReviews specialization');

        res.json({ newPatients, totalPatients, totalDoctors, activeDoctors, doctors, period: { start, end } });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// ════════════════════════════════════════════════════════════════════════════════
// DOKTER
// ════════════════════════════════════════════════════════════════════════════════

// GET /admin/doctors?specialization=
router.get('/doctors', guard, async (req, res) => {
    try {
        const filter = {};
        if (req.query.specialization) filter.specialization = req.query.specialization;
        const doctors = await Doctor.find(filter).populate('userId', 'name email phone isActive').lean();
        res.json({ success: true, doctors });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /admin/doctors — buat akun dokter baru
router.post('/doctors', guard, async (req, res) => {
    try {
        const { name, email, password, specialization, qualification, gender, consultationFee, bio, experience } = req.body;

        if (!name?.trim())           return res.status(400).json({ message: 'Nama wajib diisi' });
        if (!email?.trim())          return res.status(400).json({ message: 'Email wajib diisi' });
        if (!password || password.length < 6) return res.status(400).json({ message: 'Password minimal 6 karakter' });
        if (!specialization?.trim()) return res.status(400).json({ message: 'Spesialisasi wajib diisi' });

        // Cek email sudah ada
        const existing = await User.findOne({ email: email.toLowerCase().trim() });
        if (existing) return res.status(400).json({ message: 'Email sudah digunakan' });

        // Buat akun User dengan role doctor
        const user = new User({
            name    : name.trim(),
            email   : email.toLowerCase().trim(),
            password,           // pre-save hook akan hash
            role    : 'doctor',
            isVerified: true,   // langsung verified karena dibuat admin
        });
        await user.save();

        // Buat profil Doctor
        const doctor = new Doctor({
            userId          : user._id,
            name            : name.trim(),
            specialization  : specialization.trim(),
            qualification   : qualification?.trim() || '',
            gender          : gender || '',
            bio             : bio?.trim() || '',
            experience      : experience ? Number(experience) : 0,
            consultationFee : consultationFee ? Number(consultationFee) : 0,
            isActive        : true,
        });
        await doctor.save();

        // Populate untuk response
        const populated = await Doctor.findById(doctor._id).populate('userId', 'name email').lean();
        res.status(201).json({ success: true, message: 'Dokter berhasil ditambahkan', doctor: populated });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET /admin/doctors/:id
router.get('/doctors/:id', guard, async (req, res) => {
    try {
        const doctor = await Doctor.findById(req.params.id).populate('userId', 'name email phone isActive gender dateOfBirth').lean();
        if (!doctor) return res.status(404).json({ message: 'Dokter tidak ditemukan' });

        // Statistik rating
        const reviews = await Consultation.find({ doctorId: doctor._id, rating: { $gt: 0 } })
            .select('rating ratingComment ratedAt userId')
            .populate('userId', 'name')
            .sort('-ratedAt')
            .limit(10)
            .lean();

        const ratingDist = { 1:0, 2:0, 3:0, 4:0, 5:0 };
        reviews.forEach(r => { if (ratingDist[r.rating] !== undefined) ratingDist[r.rating]++; });

        res.json({ success: true, doctor, reviews, ratingDist });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /admin/doctors/:id
router.put('/doctors/:id', guard, async (req, res) => {
    try {
        const { name, specialization, consultationFee, bio, gender, consultationSettings } = req.body;
        const updates = {};
        if (name)               updates.name               = name;
        if (specialization)     updates.specialization     = specialization;
        if (consultationFee !== undefined) updates.consultationFee = Number(consultationFee);
        if (bio !== undefined)  updates.bio                = bio;
        if (gender)             updates.gender             = gender;
        if (consultationSettings) updates.consultationSettings = consultationSettings;

        const doctor = await Doctor.findByIdAndUpdate(req.params.id, updates, { new: true });
        if (!doctor) return res.status(404).json({ message: 'Dokter tidak ditemukan' });
        res.json({ success: true, doctor });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /admin/doctors/:id/toggle-status
router.put('/doctors/:id/toggle-status', guard, async (req, res) => {
    try {
        const doctor = await Doctor.findById(req.params.id).populate('userId');
        if (!doctor) return res.status(404).json({ message: 'Dokter tidak ditemukan' });
        doctor.isActive = !doctor.isActive;
        await doctor.save();
        if (doctor.userId) {
            await User.findByIdAndUpdate(doctor.userId._id, { isActive: doctor.isActive });
        }
        res.json({ success: true, isActive: doctor.isActive });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /admin/doctors/:id/photo
router.post('/doctors/:id/photo', guard, uploadDoctorPhoto.single('photo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'File tidak ada' });
        const photoUrl = `/uploads/doctors/${req.file.filename}`;
        const doctor   = await Doctor.findByIdAndUpdate(req.params.id, { photo: photoUrl }, { new: true });
        if (!doctor) return res.status(404).json({ message: 'Dokter tidak ditemukan' });
        res.json({ success: true, photoUrl });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /admin/doctors/:id/schedule — ambil jadwal + list override
router.get('/doctors/:id/schedule', guard, async (req, res) => {
    try {
        const [consultAvail, apptAvail, overrides] = await Promise.all([
            DoctorAvailability.findOne({ doctorId: req.params.id }).lean(),
            AppointmentAvailability.findOne({ doctorId: req.params.id }).lean(),
            DoctorScheduleOverride.find({ doctorId: req.params.id }).sort('date').lean(),
        ]);
        res.json({ success: true, consultAvail, apptAvail, overrides });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /admin/doctors/:id/schedule/override — blokir rentang tanggal
// Body: { dates: ['2025-04-07','2025-04-08'], reason }
router.put('/doctors/:id/schedule/override', guard, async (req, res) => {
    try {
        const { dates, reason } = req.body;
        if (!dates || !Array.isArray(dates) || dates.length === 0)
            return res.status(400).json({ message: 'dates wajib diisi (array YYYY-MM-DD)' });

        const results = [];
        for (const date of dates) {
            await DoctorScheduleOverride.findOneAndUpdate(
                { doctorId: req.params.id, date },
                { doctorId: req.params.id, date, reason: reason || '', blockedBy: req.userId },
                { upsert: true, new: true }
            );
            results.push(date);
        }

        // Batalkan semua appointment yang sudah ada di tanggal tersebut
        let cancelledCount = 0;
        for (const date of dates) {
            const dayStart = new Date(date + 'T00:00:00+07:00');
            const dayEnd   = new Date(date + 'T23:59:59+07:00');
            const toCancel = await Appointment.find({
                doctorId   : req.params.id,
                scheduledAt: { $gte: dayStart, $lte: dayEnd },
                status     : { $in: ['scheduled','checked_in'] },
            }).populate('userId', 'name');

            for (const appt of toCancel) {
                await Appointment.findByIdAndUpdate(appt._id, {
                    status     : 'cancelled_by_admin',
                    cancelledAt: new Date(),
                    cancelReason: reason || 'Dokter tidak hadir (override jadwal oleh admin)',
                });
                await createNotification({
                    userId : appt.userId._id,
                    type   : 'appointment_cancelled',
                    title  : 'Janji Temu Dibatalkan',
                    message: `Janji temu Anda pada ${date} dibatalkan. ${reason ? 'Alasan: ' + reason : 'Dokter tidak hadir.'}`,
                    data   : { appointmentId: appt._id },
                    io     : req.app.get('io'),
                });
                cancelledCount++;
            }
        }

        res.json({ success: true, blockedDates: results, cancelledAppointments: cancelledCount });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// DELETE /admin/doctors/:id/schedule/override/:date
router.delete('/doctors/:id/schedule/override/:date', guard, async (req, res) => {
    try {
        await DoctorScheduleOverride.findOneAndDelete({ doctorId: req.params.id, date: req.params.date });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ════════════════════════════════════════════════════════════════════════════════
// PASIEN / USER
// ════════════════════════════════════════════════════════════════════════════════

// GET /admin/users?role=&search=&page=&limit=
router.get('/users', guard, async (req, res) => {
    try {
        const { role, search, page = 1, limit = 30 } = req.query;
        const filter = { role: { $in: ['user','mahasiswa'] } };
        if (role && ['user','mahasiswa'].includes(role)) filter.role = role;
        if (search) filter.$or = [
            { name  : { $regex: search, $options: 'i' } },
            { email : { $regex: search, $options: 'i' } },
            { phone : { $regex: search, $options: 'i' } },
        ];
        const total = await User.countDocuments(filter);
        const users = await User.find(filter)
            .select('-password -emailOtp -resetPasswordToken')
            .sort('-createdAt')
            .skip((page - 1) * limit)
            .limit(Number(limit))
            .lean();
        res.json({ success: true, users, total, page: Number(page), pages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /admin/users/:id — detail + history transaksi
router.get('/users/:id', guard, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password -emailOtp -resetPasswordToken').lean();
        if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });

        const [consultations, appointments, orders] = await Promise.all([
            Consultation.find({ userId: req.params.id })
                .populate('doctorId', 'name specialization')
                .select('status scheduledAt amount paidAt createdAt consultationType')
                .sort('-createdAt').limit(20).lean(),
            Appointment.find({ userId: req.params.id })
                .populate('doctorId', 'name specialization')
                .select('status scheduledAt appointmentTime appointmentDate createdAt')
                .sort('-createdAt').limit(20).lean(),
            Order.find({ userId: req.params.id })
                .select('orderNumber status totalAmount createdAt completedAt deliveryMethod')
                .sort('-createdAt').limit(20).lean(),
        ]);

        res.json({ success: true, user, consultations, appointments, orders });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /admin/users/:id/quota — kuota mahasiswa
router.get('/users/:id/quota', guard, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).lean();
        if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });

        const STUDENT_MAX_PCS = 8;
        const now = new Date();
        const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        const orders = await Order.find({
            userId          : req.params.id,
            isStudentDiscount: true,
            studentFreeQty  : { $gt: 0 },
            status          : { $nin: ['cancelled','expired','prescription_rejected'] },
            createdAt       : { $gte: startMonth, $lte: endMonth },
        }).select('orderNumber studentFreeQty createdAt').lean();

        const used = orders.reduce((s, o) => s + (o.studentFreeQty || 0), 0);
        const manualExtra = user.quotaBonus || 0; // bonus manual dari admin
        const max  = STUDENT_MAX_PCS + manualExtra;

        res.json({ success: true, used, max, remaining: Math.max(0, max - used), manualExtra, orders, month: startMonth });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /admin/users/:id/quota — reset atau tambah kuota manual
// Body: { action: 'add'|'reset', amount? }
router.put('/users/:id/quota', guard, async (req, res) => {
    try {
        const { action, amount } = req.body;
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });
        if (user.role !== 'mahasiswa') return res.status(400).json({ message: 'Hanya untuk mahasiswa' });

        if (action === 'reset') {
            user.quotaBonus = 0;
        } else if (action === 'add') {
            user.quotaBonus = (user.quotaBonus || 0) + Number(amount || 0);
        } else {
            return res.status(400).json({ message: 'action harus add atau reset' });
        }

        await user.save();
        res.json({ success: true, quotaBonus: user.quotaBonus });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /admin/users/:id/toggle-status
router.put('/users/:id/toggle-status', guard, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });
        user.isActive = !user.isActive;
        await user.save();
        res.json({ success: true, isActive: user.isActive });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /admin/users/upgrade-mahasiswa
// Upgrade semua user dengan email @apps.ipb.ac.id ke role mahasiswa
router.post('/users/upgrade-mahasiswa', guard, async (req, res) => {
    try {
        const result = await User.updateMany(
            {
                email: { $regex: '@apps\.ipb\.ac\.id$', $options: 'i' },
                role : { $in: ['user'] }, // hanya upgrade dari role user
            },
            { $set: { role: 'mahasiswa' } }
        );
        res.json({
            success  : true,
            upgraded : result.modifiedCount,
            message  : `${result.modifiedCount} akun berhasil diupgrade ke mahasiswa`,
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});


// POST /admin/users/reset-quota-bonus — reset quotaBonus semua mahasiswa ke 0
router.post('/users/reset-quota-bonus', guard, async (req, res) => {
    try {
        const result = await User.updateMany(
            { role: 'mahasiswa', quotaBonus: { $gt: 0 } },
            { $set: { quotaBonus: 0 } }
        );
        res.json({ success: true, reset: result.modifiedCount, message: `Kuota bonus ${result.modifiedCount} mahasiswa berhasil direset ke 0` });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// ════════════════════════════════════════════════════════════════════════════════
// KONSULTASI
// ════════════════════════════════════════════════════════════════════════════════

// GET /admin/consultations?period=today|7d|30d&from=&to=&doctorId=&status=
router.get('/consultations', guard, async (req, res) => {
    try {
        const { period, from, to, doctorId, status, page = 1, limit = 50 } = req.query;
        const { start, end } = dateRange(period, from, to);

        // Filter by scheduledAt OR createdAt so bookings appear regardless of schedule time
        const filter = {
            $or: [
                { scheduledAt: { $gte: start, $lte: end } },
                { createdAt:   { $gte: start, $lte: end } },
            ]
        };
        if (doctorId) filter.doctorId = doctorId;
        if (status)   filter.status   = status;

        const total = await Consultation.countDocuments(filter);
        const consultations = await Consultation.find(filter)
            // PRIVASI: TIDAK populate messages atau medicalRecord
            .select('status scheduledAt scheduledEnd consultationType startTime endTime paidAt amount xenditExternalId doctorId userId createdAt')
            .populate('doctorId', 'name specialization')
            .populate('userId',   'name email')
            .sort('-scheduledAt')
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit))
            .lean();

        // Hitung durasi sesi
        const data = consultations.map(c => ({
            ...c,
            durationMin: c.startTime && c.endTime
                ? Math.round((new Date(c.endTime) - new Date(c.startTime)) / 60000)
                : null,
        }));

        res.json({ success: true, consultations: data, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ════════════════════════════════════════════════════════════════════════════════
// JANJI TEMU
// ════════════════════════════════════════════════════════════════════════════════

// GET /admin/appointments?period=today|7d|30d&from=&to=&doctorId=&status=
router.get('/appointments', guard, async (req, res) => {
    try {
        const { period, from, to, doctorId, status, page = 1, limit = 50 } = req.query;
        const { start, end } = dateRange(period, from, to);

        const filter = {
            $or: [
                { scheduledAt: { $gte: start, $lte: end } },
                { createdAt:   { $gte: start, $lte: end } },
            ]
        };
        if (doctorId) filter.doctorId = doctorId;
        if (status)   filter.status   = status;

        const total = await Appointment.countDocuments(filter);
        const appointments = await Appointment.find(filter)
            .select('status scheduledAt appointmentTime appointmentDate doctorId userId complaint cancelReason createdAt')
            .populate('doctorId', 'name specialization')
            .populate('userId',   'name email phone')
            .sort('-scheduledAt')
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit))
            .lean();

        res.json({ success: true, appointments, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /admin/appointments/:id/check-in
router.put('/appointments/:id/check-in', guard, async (req, res) => {
    try {
        const appt = await Appointment.findById(req.params.id).populate('userId', 'name').populate('doctorId', 'name userId');
        if (!appt) return res.status(404).json({ message: 'Janji temu tidak ditemukan' });
        if (appt.status !== 'scheduled') return res.status(400).json({ message: `Status harus scheduled, saat ini: ${appt.status}` });

        appt.status = 'checked_in';
        appt.checkedInAt = new Date();
        await appt.save();

        await createNotification({
            userId : appt.userId._id,
            type   : 'appointment_reminder',
            title  : '✅ Check-In Berhasil',
            message: `Anda telah check-in untuk janji temu dengan dr. ${appt.doctorId?.name}. Silakan menunggu.`,
            data   : { appointmentId: appt._id },
            io     : req.app.get('io'),
        });

        res.json({ success: true, appointment: appt });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /admin/appointments/:id/cancel
router.put('/appointments/:id/cancel', guard, async (req, res) => {
    try {
        const { reason, cancelledFor } = req.body; // cancelledFor: 'doctor'|'admin'
        if (!reason?.trim()) return res.status(400).json({ message: 'Alasan pembatalan wajib diisi' });

        const appt = await Appointment.findById(req.params.id)
            .populate('userId',   'name phone')
            .populate('doctorId', 'name userId');
        if (!appt) return res.status(404).json({ message: 'Janji temu tidak ditemukan' });
        if (!['scheduled','checked_in'].includes(appt.status))
            return res.status(400).json({ message: `Tidak bisa batalkan dari status: ${appt.status}` });

        appt.status      = cancelledFor === 'doctor' ? 'cancelled_by_doctor' : 'cancelled_by_admin';
        appt.cancelReason = reason;
        appt.cancelledAt  = new Date();
        await appt.save();

        const io = req.app.get('io');

        // Notifikasi ke pasien
        await createNotification({
            userId : appt.userId._id,
            type   : 'appointment_cancelled',
            title  : '❌ Janji Temu Dibatalkan',
            message: `Janji temu Anda dengan dr. ${appt.doctorId?.name} dibatalkan. Alasan: ${reason}`,
            data   : { appointmentId: appt._id },
            io,
        });

        // Notifikasi ke dokter jika pembatalan dari sisi admin/user
        if (appt.doctorId?.userId && cancelledFor !== 'doctor') {
            await createNotification({
                userId : appt.doctorId.userId,
                type   : 'appointment_cancelled',
                title  : '❌ Janji Temu Dibatalkan Admin',
                message: `Janji temu dengan pasien ${appt.userId?.name} dibatalkan. Alasan: ${reason}`,
                data   : { appointmentId: appt._id },
                io,
            });
        }

        res.json({ success: true, appointment: appt });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ════════════════════════════════════════════════════════════════════════════════
// FARMASI
// ════════════════════════════════════════════════════════════════════════════════

// GET /admin/pharmacy/low-stock
router.get('/pharmacy/low-stock', guard, async (req, res) => {
    try {
        const meds = await Medicine.find({ isActive: true }).lean();
        const lowStock = meds.filter(m => (m.stock - (m.lockedStock || 0)) <= (m.minStock ?? 10));
        res.json({ success: true, medicines: lowStock });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /admin/pharmacy/best-sellers?limit=5
router.get('/pharmacy/best-sellers', guard, async (req, res) => {
    try {
        const limitN = parseInt(req.query.limit) || 5;
        const result = await Order.aggregate([
            { $match: { status: { $in: ['selesai','terkirim','dikirim','diproses'] } } },
            { $unwind: '$items' },
            { $group: {
                _id    : '$items.medicineId',
                name   : { $first: '$items.name' },
                totalQty: { $sum: '$items.quantity' },
            }},
            { $sort: { totalQty: -1 } },
            { $limit: limitN },
        ]);
        res.json({ success: true, bestSellers: result });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ════════════════════════════════════════════════════════════════════════════════
// SURAT SAKIT
// ════════════════════════════════════════════════════════════════════════════════

// GET /admin/sick-letters?doctorId=&from=&to=&status=
router.get('/sick-letters', guard, async (req, res) => {
    try {
        const { doctorId, from, to, status, page = 1, limit = 30 } = req.query;
        const filter = {};
        if (doctorId) filter.doctorId = doctorId;
        if (status)   filter.status   = status;
        if (from || to) {
            filter.createdAt = {};
            if (from) filter.createdAt.$gte = new Date(from + 'T00:00:00');
            if (to)   filter.createdAt.$lte = new Date(to   + 'T23:59:59');
        }

        const total = await SickLetter.countDocuments(filter);
        const letters = await SickLetter.find(filter)
            .populate('userId',   'name email')
            .populate('doctorId', 'name specialization')
            .select('letterNumber status diagnosis startDate endDate issuedAt createdAt userId doctorId')
            .sort('-createdAt')
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit))
            .lean();

        res.json({ success: true, letters, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ════════════════════════════════════════════════════════════════════════════════
// LAPORAN & KEUANGAN
// ════════════════════════════════════════════════════════════════════════════════

// GET /admin/reports/revenue?period=&from=&to=&format=json|csv
router.get('/reports/revenue', guard, async (req, res) => {
    try {
        const { period, from, to, format = 'json' } = req.query;
        const { start, end } = dateRange(period, from, to);

        // BUG-30 fix: add limit to prevent OOM on large datasets in revenue report
        // 5000 rows is sufficient for any realistic report period; warn if truncated
        const REPORT_LIMIT = 5000;
        const consultations = await Consultation.find({
            paidAt: { $gte: start, $lte: end },
            status: { $nin: ['pending_payment','expired','cancelled','cancelled_by_user'] },
        })
        .limit(REPORT_LIMIT)
        .populate('userId',   'name email')
        .populate('doctorId', 'name')
        .select('paidAt amount xenditExternalId consultationType status userId doctorId')
        .lean();

        const orders = await Order.find({
            createdAt: { $gte: start, $lte: end },
            status   : { $nin: ['pending','expired','cancelled'] },
        })
        .limit(REPORT_LIMIT)
        .populate('userId', 'name email')
        .select('orderNumber createdAt totalAmount shippingCost xenditExternalId status userId deliveryMethod items')
        .lean();

        const appointments = await Appointment.find({
            scheduledAt: { $gte: start, $lte: end },
            status     : { $in: ['checked_in','completed'] },
        })
        .limit(REPORT_LIMIT)
        .populate('userId',   'name email')
        .populate('doctorId', 'name')
        .select('scheduledAt appointmentTime userId doctorId status')
        .lean();

        // Build rows for export
        const rows = [
            ...consultations.map(c => ({
                tanggal          : new Date(c.paidAt).toLocaleDateString('id-ID'),
                jenis            : 'Konsultasi',
                id_transaksi     : c.xenditExternalId || '-',
                nama_pasien      : c.userId?.name || '-',
                email_pasien     : c.userId?.email || '-',
                nama_dokter      : c.doctorId?.name || '-',
                nominal          : c.amount || 0,
                metode_bayar     : 'Xendit',
                ongkir           : 0,
                total_qty        : '-',
                status           : c.status,
            })),
            ...orders.map(o => ({
                tanggal          : new Date(o.createdAt).toLocaleDateString('id-ID'),
                jenis            : 'Farmasi',
                id_transaksi     : o.xenditExternalId || o.orderNumber || '-',
                nama_pasien      : o.userId?.name || '-',
                email_pasien     : o.userId?.email || '-',
                nama_dokter      : '-',
                nominal          : o.totalAmount || 0,
                metode_bayar     : 'Xendit',
                ongkir           : o.shippingCost || 0,
                total_qty        : (o.items || []).reduce((s, i) => s + (i.quantity || 0), 0),
                status           : o.status,
            })),
        ].sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

        if (format === 'csv') {
            const header = 'Tanggal,Jenis,ID Transaksi,Nama Pasien,Email Pasien,Nama Dokter,Nominal,Metode Bayar,Biaya Ongkir,Total Qty,Status\n';
            const csv = header + rows.map(r =>
                `"${r.tanggal}","${r.jenis}","${r.id_transaksi}","${r.nama_pasien}","${r.email_pasien}","${r.nama_dokter}",${r.nominal},"${r.metode_bayar}",${r.ongkir},"${r.total_qty}","${r.status}"`
            ).join('\n');
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="laporan-pendapatan-${from||'all'}-${to||'all'}.csv"`);
            return res.send(csv);
        }

        res.json({ success: true, rows, total: rows.reduce((s, r) => s + (r.nominal || 0), 0), period: { start, end } });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET /admin/reports/subsidi-mahasiswa?from=&to=&format=json|csv
router.get('/reports/subsidi-mahasiswa', guard, async (req, res) => {
    try {
        const { from, to, format = 'json' } = req.query;
        const start = from ? new Date(from + 'T00:00:00') : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const end   = to   ? new Date(to   + 'T23:59:59') : new Date();

        const orders = await Order.find({
            isStudentDiscount: true,
            status           : { $nin: ['cancelled','expired','prescription_rejected'] },
            createdAt        : { $gte: start, $lte: end },
        })
        .populate('userId', 'name email')
        .select('createdAt userId items studentFreeQty')
        .lean();

        const rows = [];
        for (const order of orders) {
            const freeItems = (order.items || []).filter(i => i.isFreeForStudent);
            for (const item of freeItems) {
                rows.push({
                    tanggal        : new Date(order.createdAt).toLocaleDateString('id-ID'),
                    email_mahasiswa: order.userId?.email || '-',
                    nama_mahasiswa : order.userId?.name  || '-',
                    nama_obat      : item.name     || '-',
                    qty            : item.quantity  || 0,
                    harga_satuan   : item.price     || 0,
                    total_subsidi  : (item.price || 0) * (item.quantity || 0),
                });
            }
        }

        const grandTotal = rows.reduce((s, r) => s + r.total_subsidi, 0);

        if (format === 'csv') {
            const header = 'Tanggal,Email Mahasiswa,Nama Mahasiswa,Nama Obat,Qty,Harga Satuan,Total Subsidi\n';
            const csv = header + rows.map(r =>
                `"${r.tanggal}","${r.email_mahasiswa}","${r.nama_mahasiswa}","${r.nama_obat}",${r.qty},${r.harga_satuan},${r.total_subsidi}`
            ).join('\n');
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="laporan-subsidi-mahasiswa-${from||'all'}-${to||'all'}.csv"`);
            return res.send(csv);
        }

        res.json({ success: true, rows, grandTotal, period: { start, end } });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// ════════════════════════════════════════════════════════════════════════════════
// CHAT ADMIN ↔ DOKTER
// ════════════════════════════════════════════════════════════════════════════════

// GET /admin/chat/threads — semua thread + unread count
router.get('/chat/threads', guard, async (req, res) => {
    try {
        const threads = await AdminChat.find()
            .populate('doctorId',     'name specialization photo')
            .populate('doctorUserId', 'name isOnline')
            .select('doctorId doctorUserId lastMessage lastAt unreadAdmin')
            .sort('-lastAt')
            .lean();
        res.json({ success: true, threads });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /admin/chat/:doctorId — ambil pesan di thread
router.get('/chat/:doctorId', guard, async (req, res) => {
    try {
        let thread = await AdminChat.findOne({ doctorId: req.params.doctorId }).lean();
        if (!thread) {
            // Thread belum ada — cari userId dokter
            const doctor = await Doctor.findById(req.params.doctorId);
            if (!doctor) return res.status(404).json({ message: 'Dokter tidak ditemukan' });
            thread = { doctorId: doctor._id, doctorUserId: doctor.userId, messages: [] };
        }
        res.json({ success: true, messages: thread.messages || [], doctorId: req.params.doctorId });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /admin/chat/:doctorId — kirim pesan (text atau file)
router.post('/chat/:doctorId', guard, uploadChatFile.single('file'), async (req, res) => {
    try {
        const { text } = req.body;
        if (!text?.trim() && !req.file) return res.status(400).json({ message: 'Pesan atau file wajib ada' });

        const doctor = await Doctor.findById(req.params.doctorId).populate('userId', 'name');
        if (!doctor) return res.status(404).json({ message: 'Dokter tidak ditemukan' });

        let fileUrl = null, fileName = null, fileType = null;
        if (req.file) {
            fileUrl  = `/uploads/admin-chat/${req.file.filename}`;
            fileName = req.file.originalname;
            fileType = req.file.mimetype.startsWith('image/') ? 'image' : 'file';
        }

        const msg = {
            senderId  : req.userId,
            senderRole: 'admin',
            text      : text?.trim() || '',
            fileUrl,
            fileName,
            fileType,
            isRead    : false,
            createdAt : new Date(),
        };

        const thread = await AdminChat.findOneAndUpdate(
            { doctorId: req.params.doctorId },
            {
                $push: { messages: msg },
                $set : { lastMessage: text?.trim() || `📎 ${fileName}`, lastAt: new Date(), adminId: req.userId },
                $inc : { unreadDoctor: 1 },
                $setOnInsert: { doctorUserId: doctor.userId._id },
            },
            { upsert: true, new: true }
        );

        // Notifikasi in-app ke dokter
        await createNotification({
            userId : doctor.userId._id,
            type   : 'new_message',
            title  : '💬 Pesan dari Admin',
            message: text?.trim() || 'Admin mengirimkan file',
            data   : { doctorId: doctor._id },
            io     : req.app.get('io'),
        });

        // Socket emit ke dokter
        const io = req.app.get('io');
        if (io) {
            io.to(`user-${doctor.userId._id}`).emit('admin-chat-message', {
                doctorId: req.params.doctorId,
                message : msg,
            });
        }

        res.json({ success: true, message: msg });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// PUT /admin/chat/:doctorId/read — tandai pesan sudah dibaca oleh admin
router.put('/chat/:doctorId/read', guard, async (req, res) => {
    try {
        await AdminChat.findOneAndUpdate(
            { doctorId: req.params.doctorId },
            { $set: { unreadAdmin: 0, 'messages.$[elem].isRead': true } },
            { arrayFilters: [{ 'elem.senderRole': 'doctor', 'elem.isRead': false }] }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;