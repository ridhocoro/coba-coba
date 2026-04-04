/**
 * routes/doctors.js
 *
 * Endpoint dokter:
 * GET  /my/profile        → profil dokter yang login
 * PUT  /my/profile        → update profil sendiri
 * POST /my/photo          → upload foto profil
 * GET  /my/stats          → statistik dashboard
 * GET  /my/schedule-today → jadwal gabungan hari ini
 * PUT  /my/settings       → update pengaturan konsultasi (dokter)
 * POST /admin/link-user   → hubungkan dokter ke akun user (admin)
 * GET  /                  → semua dokter aktif (public)
 * GET  /:id/schedule      → jadwal dokter (public)
 * GET  /:id               → detail dokter (public)
 * POST /                  → tambah dokter (admin)
 * PUT  /:id               → update dokter (admin)
 * PUT  /:id/schedule      → update jadwal (admin)
 * PUT  /:id/settings      → update pengaturan konsultasi (admin)
 * PUT  /:id/online-status → toggle online/offline (admin)
 * DELETE /:id             → nonaktifkan dokter (admin)
 *
 * Dependency: npm install multer
 */

const express    = require('express');
const router     = express.Router();
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');
const { Doctor, User, DoctorSchedule } = require('../models/mysql');
const Appointment   = require('../models/Appointment');
const Consultation  = require('../models/Consultation');
const auth          = require('../middleware/auth');
const doctorAuth    = require('../middleware/doctorAuth');

// ══════════════════════════════════════════════════════════════════
// KONFIGURASI MULTER
// ══════════════════════════════════════════════════════════════════

const uploadDir = path.join(__dirname, '../uploads/doctors');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const photoStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename:    (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `doctor-${req.userId}-${Date.now()}${ext}`);
    },
});

const photoUpload = multer({
    storage: photoStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Hanya file gambar (JPG, PNG, WEBP) yang diizinkan'), false);
    },
});

// ══════════════════════════════════════════════════════════════════
// HELPER TRANSLASI SCHEDULE (MySQL -> Mongoose Format)
// ══════════════════════════════════════════════════════════════════
const hariRevMap = { 0:'Minggu', 1:'Senin', 2:'Selasa', 3:'Rabu', 4:'Kamis', 5:'Jumat', 6:'Sabtu' };
const hariMap    = { Minggu:0, Senin:1, Selasa:2, Rabu:3, Kamis:4, Jumat:5, Sabtu:6,
                     Sunday:0, Monday:1, Tuesday:2, Wednesday:3, Thursday:4, Friday:5, Saturday:6 };

function buildAvailableDays(schedules) {
    if (!schedules || !schedules.length) return [];
    const grp = {};
    for (const s of schedules) {
        if (!grp[s.dayOfWeek]) grp[s.dayOfWeek] = { day: hariRevMap[s.dayOfWeek], slots: [] };
        // Potong detik pada startTime, endTime format HH:mm:ss -> HH:mm
        const st = s.startTime?.slice(0, 5) || s.startTime;
        const et = s.endTime?.slice(0, 5) || s.endTime;
        grp[s.dayOfWeek].slots.push({ startTime: st, endTime: et, isAvailable: s.isAvailable });
    }
    return Object.values(grp);
}

// ══════════════════════════════════════════════════════════════════
// ROUTE STATIS — HARUS di atas /:id agar tidak tertimpa
// ══════════════════════════════════════════════════════════════════

/**
 * GET /my/profile
 * Ambil profil dokter yang sedang login.
 */
router.get('/my/profile', auth, doctorAuth, async (req, res) => {
    try {
        const docRecord = await Doctor.findOne({ 
            where: { userId: req.userId },
            include: [
                { model: User, as: 'user', attributes: ['id', 'name', 'email', 'phone'] },
                { model: DoctorSchedule, as: 'schedules' }
            ]
        });
        const doctor = docRecord ? docRecord.toJSON() : null;
        if (doctor) {
            doctor.userId = doctor.user;
            doctor.userId.id = doctor.user.id;
            doctor.availableDays = buildAvailableDays(doctor.schedules);
        }

        if (!doctor) {
            return res.status(404).json({
                success: false,
                needsProfile: true,
                message: 'Profil dokter belum terdaftar. Silakan hubungi admin.',
            });
        }

        res.json({
            success: true,
            doctor: {
                _id:              doctor.id,
                name:             doctor.name,
                specialization:   doctor.specialization,
                qualification:    doctor.qualification,
                gender:           doctor.gender,
                bio:              doctor.bio,
                experience:       doctor.experience,
                photo:            doctor.photo,
                signatureUrl:     doctor.signatureUrl || '',
                consultationFee:  doctor.consultationFee,
                isActive:         doctor.isActive,
                isOnline:         doctor.isOnline,
                rating:           doctor.rating,
                totalReviews:     doctor.totalReviews,
                consultationSettings: { allowChat: doctor.allowChat, allowVideoCall: doctor.allowVideoCall } || {
                    allowChat: true,
                    allowVideoCall: true,
                },
                userId: doctor.userId,
            },
        });
    } catch (error) {
        console.error('GET /my/profile error:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
    }
});

/**
 * PUT /my/profile
 * Update profil dokter sendiri — consultationFee TIDAK bisa diubah dokter, hanya admin.
 */
router.put('/my/profile', auth, doctorAuth, async (req, res) => {
    try {
        const { name, specialization, qualification, gender, bio, experience } = req.body;
        // consultationFee sengaja tidak diambil dari req.body

        if (!name?.trim())           return res.status(400).json({ success: false, message: 'Nama wajib diisi' });
        if (!specialization?.trim()) return res.status(400).json({ success: false, message: 'Spesialisasi wajib diisi' });

        await Doctor.update(
            {
                name:           name.trim(),
                specialization: specialization.trim(),
                qualification:  qualification?.trim()   || '',
                gender:         gender                  || '',
                bio:            bio?.trim()             || '',
                experience:     experience ? Number(experience) : 0,
            },
            { where: { userId: req.userId } }
        );
        const doctor = await Doctor.findOne({ where: { userId: req.userId } });

        if (!doctor) return res.status(404).json({ success: false, message: 'Profil dokter tidak ditemukan' });

        res.json({ success: true, message: 'Profil berhasil diperbarui', doctor });
    } catch (error) {
        console.error('PUT /my/profile error:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
    }
});

/**
 * POST /my/photo
 * Upload foto profil dokter (multipart/form-data, field: "photo").
 * Foto disimpan sebagai path relatif (/uploads/doctors/...) agar
 * tidak bergantung pada domain/port.
 */
router.post('/my/photo', auth, doctorAuth, photoUpload.single('photo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'File foto tidak ditemukan' });

        const photoUrl = `/uploads/doctors/${req.file.filename}`;

        // Hapus foto lama jika file lokal
        const existing = await Doctor.findOne({ where: { userId: req.userId }, attributes: ['photo'] });
        if (existing?.photo?.includes('/uploads/doctors/')) {
            const oldFilename = existing.photo.split('/uploads/doctors/').pop();
            const oldPath = path.join(uploadDir, oldFilename);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        await Doctor.update(
            { photo: photoUrl },
            { where: { userId: req.userId } }
        );
        const doctor = await Doctor.findOne({ where: { userId: req.userId } });

        if (!doctor) return res.status(404).json({ success: false, message: 'Profil dokter tidak ditemukan' });

        res.json({ success: true, message: 'Foto berhasil diupload', photoUrl, doctor });
    } catch (error) {
        console.error('POST /my/photo error:', error);
        if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, message: 'Ukuran file maksimal 5MB' });
        }
        res.status(500).json({ success: false, message: error.message || 'Terjadi kesalahan server' });
    }
});

/**
 * POST /my/signature
 * Upload tanda tangan dokter (dipakai di surat sakit PDF).
 * Field: "signature" (gambar JPG/PNG/WEBP, maks 5 MB).
 * Disarankan: gambar tanda tangan dengan background putih/transparan.
 */
router.post('/my/signature', auth, doctorAuth, photoUpload.single('signature'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'File tanda tangan tidak ditemukan' });

        const signatureUrl = `/uploads/doctors/${req.file.filename}`;

        // Hapus tanda tangan lama
        const existing = await Doctor.findOne({ where: { userId: req.userId }, attributes: ['signatureUrl'] });
        if (existing?.signatureUrl?.includes('/uploads/doctors/')) {
            const oldFilename = existing.signatureUrl.split('/uploads/doctors/').pop();
            const oldPath = path.join(uploadDir, oldFilename);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }

        await Doctor.update(
            { signatureUrl },
            { where: { userId: req.userId } }
        );
        const doctor = await Doctor.findOne({ where: { userId: req.userId } });

        if (!doctor) return res.status(404).json({ success: false, message: 'Profil dokter tidak ditemukan' });

        res.json({ success: true, message: 'Tanda tangan berhasil diupload', signatureUrl, doctor });
    } catch (error) {
        console.error('POST /my/signature error:', error);
        if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, message: 'Ukuran file maksimal 5MB' });
        }
        res.status(500).json({ success: false, message: error.message || 'Terjadi kesalahan server' });
    }
});

/**
 * GET /my/stats
 * Statistik untuk dashboard beranda.
 *
 * Response menyertakan DUA format sekaligus:
 * - nested  (appointments.today, consultations.today, dst.)
 * - flat    (apptToday, consToday, dst.) — dipakai DoctorDashboard.jsx
 */
router.get('/my/stats', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ where: { userId: req.userId } });
        if (!doctor) return res.status(404).json({ success: false, message: 'Profil dokter tidak ditemukan' });

        const now      = new Date();
        const todayWIB = new Date(now.getTime() + 7 * 3600000);
        const y = todayWIB.getUTCFullYear();
        const m = todayWIB.getUTCMonth();
        const d = todayWIB.getUTCDate();
        const todayStart = new Date(Date.UTC(y, m, d)     - 7 * 3600000);
        const todayEnd   = new Date(Date.UTC(y, m, d + 1) - 7 * 3600000 - 1);

        const [
            apptToday, apptUpcoming, apptCompleted, apptCancelled,
            consToday, consOngoing, consCompleted, consUpcoming, consCancelled,
        ] = await Promise.all([
            Appointment.countDocuments({
                doctorId:        doctor.id,
                appointmentDate: { $gte: todayStart, $lte: todayEnd },
                status:          { $in: ['scheduled', 'checked_in', 'completed'] },
            }),
            Appointment.countDocuments({
                doctorId:        doctor.id,
                appointmentDate: { $gt: todayEnd },
                status:          'scheduled',
            }),
            Appointment.countDocuments({ doctorId: doctor.id, status: 'completed' }),
            Appointment.countDocuments({
                doctorId: doctor.id,
                status:   { $in: ['cancelled_by_user', 'cancelled_by_doctor', 'cancelled_by_admin'] },
            }),
            Consultation.countDocuments({
                doctorId:    doctor.id,
                scheduledAt: { $gte: todayStart, $lte: todayEnd },
                status:      { $in: ['confirmed', 'in_progress', 'ongoing', 'completed'] },
            }),
            Consultation.countDocuments({
                doctorId: doctor.id,
                status:   { $in: ['in_progress', 'ongoing'] },
            }),
            Consultation.countDocuments({ doctorId: doctor.id, status: 'completed' }),
            Consultation.countDocuments({
                doctorId:    doctor.id,
                scheduledAt: { $gt: todayEnd },
                status:      { $in: ['confirmed', 'paid', 'scheduled'] },
            }),
            Consultation.countDocuments({
                doctorId: doctor.id,
                status:   { $in: ['cancelled_by_doctor', 'cancelled_by_user', 'expired'] },
            }),
        ]);

        const uniquePatients = await Consultation.distinct('userId', {
            doctorId: doctor.id,
            userId:   { $exists: true, $ne: null },
        });

        res.json({
            success: true,
            stats: {
                // ── Format nested ─────────────────────────────────────
                appointments: {
                    today:     apptToday,
                    upcoming:  apptUpcoming,
                    completed: apptCompleted,
                    cancelled: apptCancelled,
                },
                consultations: {
                    today:     consToday,
                    ongoing:   consOngoing,
                    completed: consCompleted,
                    upcoming:  consUpcoming,
                    cancelled: consCancelled,
                },
                patients: {
                    unique: uniquePatients.length,
                },

                // ── Format flat — dipakai DoctorDashboard.jsx ─────────
                apptToday,
                apptUpcoming,
                apptCancelled,
                consToday,
                consCompleted,
                consUpcoming,
                consCancelled,
                rating:       doctor.rating       || 0,
                totalReviews: doctor.totalReviews  || 0,
            },
        });
    } catch (error) {
        console.error('GET /my/stats error:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
    }
});

/**
 * GET /my/schedule-today
 * Jadwal gabungan hari ini (konsultasi online + janji temu), diurutkan by jam.
 */
router.get('/my/schedule-today', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ where: { userId: req.userId } });
        if (!doctor) return res.status(404).json({ success: false, message: 'Profil dokter tidak ditemukan' });

        const now      = new Date();
        const todayWIB = new Date(now.getTime() + 7 * 3600000);
        const y = todayWIB.getUTCFullYear();
        const m = todayWIB.getUTCMonth();
        const d = todayWIB.getUTCDate();
        const todayStart = new Date(Date.UTC(y, m, d)     - 7 * 3600000);
        const todayEnd   = new Date(Date.UTC(y, m, d + 1) - 7 * 3600000 - 1);

        const [appointments, consultations] = await Promise.all([
            Appointment.find({
                doctorId:        doctor.id,
                appointmentDate: { $gte: todayStart, $lte: todayEnd },
                status:          { $in: ['scheduled', 'checked_in'] },
            }).populate('userId', 'name phone').sort({ appointmentTime: 1 }).lean(),

            Consultation.find({
                doctorId:    doctor.id,
                scheduledAt: { $gte: todayStart, $lte: todayEnd },
                status:      { $in: ['confirmed', 'in_progress', 'ongoing', 'paid', 'scheduled'] },
            }).populate('userId', 'name phone').sort({ scheduledAt: 1 }).lean(),
        ]);

        const formattedAppointments = appointments.map(a => ({
            _id:          a.id,
            type:         'appointment',
            time:         a.appointmentTime,
            patientName:  a.userId?.name  || 'Pasien',
            patientPhone: a.userId?.phone || '-',
            status:       a.status,
            scheduledAt:  a.scheduledAt,
            isOnline:     false,
        }));

        const formattedConsultations = consultations.map(c => ({
            _id:             c.id,
            type:            'consultation',
            time:            c.scheduledAt
                ? new Date(c.scheduledAt).toLocaleTimeString('id-ID', {
                    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
                })
                : '--:--',
            patientName:      c.userId?.name  || 'Pasien',
            patientPhone:     c.userId?.phone || '-',
            status:           c.status,
            scheduledAt:      c.scheduledAt,
            consultationType: c.consultationType || 'chat',
            isOnline:         true,
        }));

        const schedule = [...formattedAppointments, ...formattedConsultations]
            .sort((a, b) => (a.time > b.time ? 1 : a.time < b.time ? -1 : 0));

        res.json({
            success: true,
            schedule,
            summary: {
                total:         schedule.length,
                appointments:  appointments.length,
                consultations: consultations.length,
            },
        });
    } catch (error) {
        console.error('GET /my/schedule-today error:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
    }
});

/**
 * PUT /my/settings
 * Update pengaturan konsultasi dokter sendiri (allowChat, allowVideoCall).
 */
router.put('/my/settings', auth, doctorAuth, async (req, res) => {
    try {
        const { allowChat, allowVideoCall } = req.body;

        if (!allowChat && !allowVideoCall) {
            return res.status(400).json({ message: 'Minimal satu fitur konsultasi harus diaktifkan' });
        }

        const doctor = await Doctor.findOne({ where: { userId: req.userId } });
        if (!doctor) return res.status(404).json({ message: 'Profil dokter tidak ditemukan' });

        doctor.consultationSettings = {
            allowChat:      allowChat      !== undefined ? allowChat      : true,
            allowVideoCall: allowVideoCall !== undefined ? allowVideoCall : true,
        };
        await doctor.save();

        res.json({ success: true, consultationSettings: { allowChat: doctor.allowChat, allowVideoCall: doctor.allowVideoCall } });
    } catch (err) {
        console.error('PUT /my/settings error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ══════════════════════════════════════════════════════════════════
// ADMIN — STATIC ROUTES (sebelum /:id)
// ══════════════════════════════════════════════════════════════════

/**
 * POST /admin/link-user
 * Hubungkan profil dokter ke akun user (admin).
 */
router.post('/admin/link-user', auth, async (req, res) => {
    try {
        if (req.userRole !== 'admin') {
            return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya untuk admin.' });
        }

        const { doctorId, userId } = req.body;
        if (!doctorId || !userId) {
            return res.status(400).json({ success: false, message: 'doctorId dan userId wajib diisi' });
        }

        const user = await User.findByPk(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
        if (user.role !== 'doctor') {
            return res.status(400).json({ success: false, message: 'User harus memiliki role doctor' });
        }

        const existing = await Doctor.findOne({ where: { userId } });
        if (existing && existing.id !== doctorId) {
            return res.status(400).json({ success: false, message: 'Akun user ini sudah terhubung ke dokter lain' });
        }

        await Doctor.update({ userId }, { where: { id: doctorId } });
        const docRecord = await Doctor.findByPk(doctorId, { include: [{ model: User, as: 'user', attributes: ['name', 'email', 'phone'] }] });
        const doctor = docRecord ? docRecord.toJSON() : null;
        if (doctor) {
            doctor.userId = doctor.user;
            doctor.userId.id = doctor.user.id;
        }

        if (!doctor) return res.status(404).json({ success: false, message: 'Dokter tidak ditemukan' });

        res.json({ success: true, message: 'Dokter berhasil dihubungkan ke akun user', doctor });
    } catch (error) {
        console.error('POST /admin/link-user error:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
    }
});

// ══════════════════════════════════════════════════════════════════
// ROUTE PUBLIK
// ══════════════════════════════════════════════════════════════════

/**
 * GET /
 * Semua dokter aktif (public).
 */
router.get('/', async (req, res) => {
    try {
        const docsRecords = await Doctor.findAll({ 
            where: { isActive: true },
            attributes: ['id', 'name', 'specialization', 'consultationFee', 'rating', 'photo', 'bio', 'allowChat', 'allowVideoCall', 'isOnline', 'experience'],
            include: [
                { model: User, as: 'user', attributes: ['name'] },
                { model: DoctorSchedule, as: 'schedules' }
            ]
        });

        // Ambil data jadwal konsultasi online dari MongoDB
        const DoctorAvailability = require('../models/DoctorAvailability');
        const availList = await DoctorAvailability.find({ isActive: true });
        const availMap = {};
        
        // Cek aman: pastikan doctorId ada
        availList.forEach(a => { 
            if (a && a.doctorId) {
                availMap[a.doctorId.toString()] = a; 
            }
        });

        // Ambil semua booking konsultasi aktif untuk cek slot penuh
        const nowUTC = new Date();
        const allConsBookings = await Consultation.find({
            $or: [
                { status: { $in: ['waiting_verification','confirmed','in_progress','completed','no_show'] } },
                { status: 'pending_payment', paymentDeadline: { $gt: nowUTC } },
            ],
        }).select('doctorId scheduledAt').lean();

        const consBookingsByDoctor = {};
        for (const c of allConsBookings) {
            const did = c.doctorId ? c.doctorId.toString() : null;
            if (!did || !c.scheduledAt) continue;
            const scheduledMs = new Date(c.scheduledAt).getTime();
            if (isNaN(scheduledMs)) continue;
            if (!consBookingsByDoctor[did]) consBookingsByDoctor[did] = new Set();
            // Simpan sebagai "YYYY-MM-DD|HH:MM" dalam WIB
            const wib = new Date(scheduledMs + 7 * 60 * 60 * 1000);
            const dateKey = wib.toISOString().slice(0, 10);
            const timeKey = `${String(wib.getUTCHours()).padStart(2,'0')}:${String(wib.getUTCMinutes()).padStart(2,'0')}`;
            consBookingsByDoctor[did].add(`${dateKey}|${timeKey}`);
        }

        const doctors = docsRecords.map(d => {
            const doc = d.toJSON();
            doc.userId = doc.user;
            if (doc.userId) doc.userId.id = doc.user.id;
            
            if (typeof buildAvailableDays === 'function') {
                doc.availableDays = buildAvailableDays(doc.schedules);
            } else {
                doc.availableDays = [];
            }
            
            const docIdStr = doc.id ? doc.id.toString() : '';
            const avail = availMap[docIdStr];
            
            // Dokter dianggap offline jika:
            // 1. Jadwal belum dibuat/expired, ATAU
            // 2. Semua slot yang ada sudah booked/lewat
            let isOffline = true;
            if (avail && typeof avail.isWeekActive === 'function' && avail.isWeekActive() && avail.weekStart && avail.weekEnd) {
                const CUTOFF_MS = 20 * 60 * 1000;
                const bookedSet = consBookingsByDoctor[docIdStr] || new Set();
                let hasAnyAvailable = false;
                const msPerDay = 24 * 60 * 60 * 1000;
                const weekStartMs = new Date(avail.weekStart).getTime();
                const weekEndMs   = new Date(avail.weekEnd).getTime();
                if (isNaN(weekStartMs) || isNaN(weekEndMs)) {
                    isOffline = true;
                } else {
                let cursor = new Date(weekStartMs);

                while (cursor.getTime() <= weekEndMs && !hasAnyAvailable) {
                    const cursorWIB = new Date(cursor.getTime() + 7 * 60 * 60 * 1000);
                    const dow = cursorWIB.getUTCDay();
                    if (dow !== 0) {
                        const activeSlots = typeof avail.getSlotsForDay === 'function' ? avail.getSlotsForDay(dow) : [];
                        const dateStr = cursorWIB.toISOString().slice(0, 10);
                        for (const slot of activeSlots) {
                            const [sh, sm] = slot.split(':').map(Number);
                            const [y, mo, dy] = dateStr.split('-').map(Number);
                            const slotUTC = new Date(Date.UTC(y, mo - 1, dy, sh, sm, 0) - 7 * 60 * 60 * 1000);
                            const isPast = (slotUTC.getTime() - CUTOFF_MS) <= nowUTC.getTime();
                            const isBooked = bookedSet.has(`${dateStr}|${slot}`);
                            if (!isPast && !isBooked) { hasAnyAvailable = true; break; }
                        }
                    }
                    cursor = new Date(cursor.getTime() + msPerDay);
                }
                isOffline = !hasAnyAvailable;
                } // end else isNaN guard
            }
            doc.isOffline = isOffline;
            
            return doc;
        });
        res.json(doctors);
    } catch (error) {
        console.error('GET /doctors error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

/**
 * GET /:id/schedule
 * Jadwal dokter (public) — harus sebelum /:id.
 */
router.get('/:id/schedule', async (req, res) => {
    try {
        const docRecord = await Doctor.findByPk(req.params.id, {
            attributes: ['id', 'name', 'allowChat', 'allowVideoCall', 'isOnline'],
            include: [{ model: DoctorSchedule, as: 'schedules' }]
        });
        const doctor = docRecord ? docRecord.toJSON() : null;
        if (doctor) doctor.availableDays = buildAvailableDays(doctor.schedules);
        if (!doctor) return res.status(404).json({ message: 'Dokter tidak ditemukan' });
        res.json(doctor);
    } catch (error) {
        console.error('GET /doctors/:id/schedule error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * GET /:id
 * Detail dokter (public).
 */
router.get('/:id', async (req, res) => {
    try {
        const docRecord = await Doctor.findByPk(req.params.id, {
            include: [
                { model: User, as: 'user', attributes: ['name', 'email'] },
                { model: DoctorSchedule, as: 'schedules' }
            ]
        });
        const doctor = docRecord ? docRecord.toJSON() : null;
        if (doctor) {
            doctor.userId = doctor.user;
            doctor.userId.id = doctor.user.id;
            doctor.availableDays = buildAvailableDays(doctor.schedules);
        }
        if (!doctor) return res.status(404).json({ message: 'Dokter tidak ditemukan' });
        res.json(doctor);
    } catch (error) {
        console.error('GET /doctors/:id error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ══════════════════════════════════════════════════════════════════
// ADMIN ROUTES — DYNAMIC
// ══════════════════════════════════════════════════════════════════

/**
 * POST /
 * Tambah dokter baru (admin).
 */
router.post('/', auth, async (req, res) => {
    try {
        if (req.userRole !== 'admin') return res.status(403).json({ message: 'Akses ditolak' });
        const doctor = await Doctor.create(req.body);
        res.status(201).json({ success: true, message: 'Dokter berhasil ditambahkan', doctor });
    } catch (error) {
        console.error('POST /doctors error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * PUT /:id
 * Update dokter (admin).
 */
router.put('/:id', auth, async (req, res) => {
    try {
        if (req.userRole !== 'admin') return res.status(403).json({ message: 'Akses ditolak' });
        // SEC-03 fix: whitelist updatable fields — prevent mass assignment of rating, userId, etc.
        const { name, specialization, qualification, gender, bio, experience, consultationFee, isActive } = req.body;
        const update = {};
        if (name            !== undefined) update.name             = name;
        if (specialization  !== undefined) update.specialization   = specialization;
        if (qualification   !== undefined) update.qualification    = qualification;
        if (gender          !== undefined) update.gender           = gender;
        if (bio             !== undefined) update.bio              = bio;
        if (experience      !== undefined) update.experience       = experience;
        if (consultationFee !== undefined) update.consultationFee  = consultationFee;
        if (isActive        !== undefined) update.isActive         = isActive;
        // Explicitly excluded: rating, totalReviews, userId, photo, signature
        await Doctor.update(update, { where: { id: req.params.id } });
        const doctor = await Doctor.findByPk(req.params.id);
        if (!doctor) return res.status(404).json({ message: 'Dokter tidak ditemukan' });
        res.json({ success: true, message: 'Dokter berhasil diperbarui', doctor });
    } catch (error) {
        console.error('PUT /doctors/:id error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * PUT /:id/schedule
 * Update jadwal dokter (admin).
 */
router.put('/:id/schedule', auth, async (req, res) => {
    try {
        if (req.userRole !== 'admin') return res.status(403).json({ message: 'Akses ditolak' });
        const doctor = await Doctor.findByPk(req.params.id);
        if (!doctor) return res.status(404).json({ message: 'Dokter tidak ditemukan' });

        await DoctorSchedule.destroy({ where: { doctorId: req.params.id } });
        
        const schedule = req.body.schedule || [];
        const newSchedules = [];
        for (const h of schedule) {
            const dayNum = hariMap[h.day];
            if (dayNum === undefined) continue;
            for (const slot of h.slots || []) {
                if (slot.startTime && slot.endTime) {
                    newSchedules.push({
                        doctorId: doctor.id,
                        dayOfWeek: dayNum,
                        startTime: slot.startTime,
                        endTime: slot.endTime,
                        isAvailable: slot.isAvailable !== false
                    });
                }
            }
        }
        if (newSchedules.length) {
            await DoctorSchedule.bulkCreate(newSchedules);
        }
        res.json({ success: true, message: 'Jadwal berhasil diperbarui', schedule: buildAvailableDays(newSchedules) });
    } catch (error) {
        console.error('PUT /doctors/:id/schedule error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * PUT /:id/settings
 * Update pengaturan konsultasi dokter tertentu (admin).
 */
router.put('/:id/settings', auth, async (req, res) => {
    try {
        if (req.userRole !== 'admin') return res.status(403).json({ message: 'Akses ditolak' });
        const { allowChat, allowVideoCall } = req.body;

        if (allowChat === false && allowVideoCall === false) {
            return res.status(400).json({ success: false, message: 'Minimal satu fitur konsultasi harus diaktifkan' });
        }

        await Doctor.update(
            { allowChat: allowChat ?? true, allowVideoCall: allowVideoCall ?? true },
            { where: { id: req.params.id } }
        );
        const doctor = await Doctor.findByPk(req.params.id);
        if (!doctor) return res.status(404).json({ message: 'Dokter tidak ditemukan' });
        res.json({ success: true, message: 'Pengaturan berhasil diperbarui', consultationSettings: { allowChat: doctor.allowChat, allowVideoCall: doctor.allowVideoCall } });
    } catch (error) {
        console.error('PUT /doctors/:id/settings error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * PUT /:id/online-status
 * Toggle status online/offline dokter (admin).
 */
router.put('/:id/online-status', auth, async (req, res) => {
    try {
        if (req.userRole !== 'admin') return res.status(403).json({ message: 'Akses ditolak' });

        const doctor = await Doctor.findByPk(req.params.id);
        if (!doctor) return res.status(404).json({ message: 'Dokter tidak ditemukan' });

        const isOnline = req.body.isOnline !== undefined ? req.body.isOnline : !doctor.isOnline;
        await Doctor.update({ isOnline }, { where: { id: req.params.id } });
        doctor.isOnline = isOnline;

        res.json({ success: true, message: isOnline ? 'Dokter online' : 'Dokter offline', isOnline: doctor.isOnline, doctor });
    } catch (error) {
        console.error('PUT /doctors/:id/online-status error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * DELETE /:id
 * Nonaktifkan dokter (admin).
 */
router.delete('/:id', auth, async (req, res) => {
    try {
        if (req.userRole !== 'admin') return res.status(403).json({ message: 'Akses ditolak' });
        await Doctor.update({ isActive: false }, { where: { id: req.params.id } });
        const doctor = await Doctor.findByPk(req.params.id);
        if (!doctor) return res.status(404).json({ message: 'Dokter tidak ditemukan' });
        res.json({ success: true, message: 'Dokter berhasil dinonaktifkan', doctor });
    } catch (error) {
        console.error('DELETE /doctors/:id error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ── Chat dokter ↔ admin (dokter bisa baca & balas) ────────────────────────────
const AdminChat    = require('../models/AdminChat');
const { createNotification } = require('../utils/notificationHelper');

const chatDir = path.join(__dirname, '../uploads/admin-chat');
if (!fs.existsSync(chatDir)) fs.mkdirSync(chatDir, { recursive: true });
const uploadChatFile = multer({
    storage: multer.diskStorage({
        destination: (_, __, cb) => cb(null, chatDir),
        filename: (_, file, cb) => cb(null, `chat-${Date.now()}-${file.originalname}`),
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
});

// GET /api/doctors/my/chat — baca pesan dari admin
router.get('/my/chat', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ where: { userId: req.userId } });
        if (!doctor) return res.status(404).json({ message: 'Dokter tidak ditemukan' });
        const thread = await AdminChat.findOne({ doctorId: doctor.id }).lean();
        res.json({ success: true, messages: thread?.messages || [], unreadDoctor: thread?.unreadDoctor || 0 });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/doctors/my/chat — balas pesan ke admin
router.post('/my/chat', auth, doctorAuth, uploadChatFile.single('file'), async (req, res) => {
    try {
        const { text } = req.body;
        if (!text?.trim() && !req.file) return res.status(400).json({ message: 'Pesan atau file wajib ada' });

        const doctor = await Doctor.findOne({ where: { userId: req.userId } });
        if (!doctor) return res.status(404).json({ message: 'Dokter tidak ditemukan' });

        let fileUrl = null, fileName = null, fileType = null;
        if (req.file) {
            fileUrl  = `/uploads/admin-chat/${req.file.filename}`;
            fileName = req.file.originalname;
            fileType = req.file.mimetype.startsWith('image/') ? 'image' : 'file';
        }

        const msg = {
            senderId  : req.userId,
            senderRole: 'doctor',
            text      : text?.trim() || '',
            fileUrl, fileName, fileType,
            isRead    : false,
            createdAt : new Date(),
        };

        const thread = await AdminChat.findOneAndUpdate(
            { doctorId: doctor.id },
            {
                $push: { messages: msg },
                $set : { lastMessage: text?.trim() || `📎 ${fileName}`, lastAt: new Date(), doctorUserId: req.userId },
                $inc : { unreadAdmin: 1 },
                $setOnInsert: { doctorUserId: req.userId },
            },
            { upsert: true, new: true }
        );

        // Notif ke semua admin
        const admins = await User.findAll({ where: { role: 'admin' } });
        const io = req.app.get('io');
        for (const admin of admins) {
            await createNotification({
                userId : admin.id,
                type   : 'new_message',
                title  : `💬 Pesan dari dr. ${doctor.name}`,
                message: text?.trim() || 'Dokter mengirimkan file',
                data   : { doctorId: doctor.id },
                io,
            });
            if (io) io.to(`user-${admin.id}`).emit('admin-chat-message', { doctorId: doctor.id.toString(), message: msg });
        }

        res.json({ success: true, message: msg });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT /api/doctors/my/chat/read — tandai sudah dibaca oleh dokter
router.put('/my/chat/read', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ where: { userId: req.userId } });
        if (!doctor) return res.status(404).json({ message: 'Dokter tidak ditemukan' });
        await AdminChat.findOneAndUpdate(
            { doctorId: doctor.id },
            { $set: { unreadDoctor: 0 } }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;