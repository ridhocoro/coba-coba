const fmtDoctorName = require('../utils/fmtDoctorName');
/**
 * routes/doctors.js  ← VERSI LENGKAP dengan Redis caching
 *
 * Perubahan dari versi lama:
 *  + import getOrSet, invalidate, invalidateMany, invalidatePattern, CACHE_KEYS, TTL
 *  + GET /            → dibungkus getOrSet (cache 5 menit)
 *  + GET /:id/schedule → dibungkus getOrSet (cache 5 menit)
 *  + GET /:id         → dibungkus getOrSet (cache 5 menit)
 *  + POST /           → invalidate DOCTORS_ALL setelah create
 *  + PUT /:id         → invalidate DOCTORS_ALL + DOCTOR_DETAIL + DOCTOR_SCHEDULE
 *  + PUT /:id/schedule → invalidate DOCTORS_ALL + DOCTOR_SCHEDULE
 *  + PUT /:id/settings → invalidate DOCTORS_ALL + DOCTOR_DETAIL
 *  + PUT /:id/online-status → invalidate DOCTORS_ALL + DOCTOR_DETAIL
 *  + DELETE /:id      → invalidate DOCTORS_ALL + DOCTOR_DETAIL
 *  + PUT /my/profile  → invalidatePattern semua cache dokter
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
const { cloudinary, createCloudinaryUpload } = require('../config/cloudinary');

// ── Redis cache helpers ───────────────────────────────────────
const { getOrSet, invalidate, invalidateMany, invalidatePattern, CACHE_KEYS, TTL } = require('../utils/cache');

// ══════════════════════════════════════════════════════════════════
// KONFIGURASI MULTER
// ══════════════════════════════════════════════════════════════════

const photoUpload = createCloudinaryUpload('klinik-ipb/doctors', ['jpg','jpeg','png','webp'], 5);

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
        const st = s.startTime?.slice(0, 5) || s.startTime;
        const et = s.endTime?.slice(0, 5) || s.endTime;
        grp[s.dayOfWeek].slots.push({ startTime: st, endTime: et, isAvailable: s.isAvailable });
    }
    return Object.values(grp);
}

// ══════════════════════════════════════════════════════════════════
// ROUTE STATIS — HARUS di atas /:id agar tidak tertimpa
// ══════════════════════════════════════════════════════════════════

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
                strNumber:        doctor.strNumber       || '',
                alumnus:          doctor.alumnus         || '',
                practiceLocation: doctor.practiceLocation || '',
                titlePrefix:      doctor.titlePrefix     || '',
                titleSuffix:      doctor.titleSuffix     || '',
                consultationSettings: {
                    allowChat:      doctor.allowChat      ?? true,
                    allowVideoCall: doctor.allowVideoCall ?? true,
                },
                userId: doctor.userId,
            },
        });
    } catch (error) {
        console.error('GET /my/profile error:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
    }
});

router.put('/my/profile', auth, doctorAuth, async (req, res) => {
    try {
        const { name, specialization, gender, bio, experience,
                strNumber, alumnus, practiceLocation, titlePrefix, titleSuffix } = req.body;

        if (!name?.trim())           return res.status(400).json({ success: false, message: 'Nama wajib diisi' });
        if (!specialization?.trim()) return res.status(400).json({ success: false, message: 'Spesialisasi wajib diisi' });

        await Doctor.update(
            {
                name:             name.trim(),
                specialization:   specialization.trim(),
                gender:           gender                   || '',
                bio:              bio?.trim()              || '',
                experience:       experience ? Number(experience) : 0,
                strNumber:        strNumber?.trim()        || '',
                alumnus:          alumnus?.trim()          || '',
                practiceLocation: practiceLocation?.trim() || '',
                titlePrefix:      titlePrefix?.trim()      || '',
                titleSuffix:      titleSuffix?.trim()      || '',
            },
            { where: { userId: req.userId } }
        );
        const doctor = await Doctor.findOne({ where: { userId: req.userId } });

        if (!doctor) return res.status(404).json({ success: false, message: 'Profil dokter tidak ditemukan' });

        // Invalidasi semua cache dokter karena data berubah
        await invalidatePattern('cache:doctors:*');

        res.json({ success: true, message: 'Profil berhasil diperbarui', doctor });
    } catch (error) {
        console.error('PUT /my/profile error:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
    }
});

router.post('/my/photo', auth, doctorAuth, photoUpload.single('photo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'File foto tidak ditemukan' });

        const photoUrl = req.file.path || req.file.secure_url || req.file.url;

        await Doctor.update(
            { photo: photoUrl },
            { where: { userId: req.userId } }
        );
        const doctor = await Doctor.findOne({ where: { userId: req.userId } });

        if (!doctor) return res.status(404).json({ success: false, message: 'Profil dokter tidak ditemukan' });

        // Invalidasi cache karena foto berubah
        await invalidatePattern('cache:doctors:*');

        res.json({ success: true, message: 'Foto berhasil diupload', photoUrl, doctor });
    } catch (error) {
        console.error('POST /my/photo error:', error);
        if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, message: 'Ukuran file maksimal 5MB' });
        }
        res.status(500).json({ success: false, message: error.message || 'Terjadi kesalahan server' });
    }
});

router.post('/my/signature', auth, doctorAuth, photoUpload.single('signature'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'File tanda tangan diperlukan' });

        const signatureUrl = req.file.path || req.file.secure_url || req.file.url;

        await Doctor.update({ signatureUrl }, { where: { userId: req.userId } });
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
            apptTodayPatients, apptCompletedCount,
            consUniqueCancelled, apptUniqueCancelled, totalConsCompleted,
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
            Appointment.distinct('userId', {
                doctorId:        doctor.id,
                appointmentDate: { $gte: todayStart, $lte: todayEnd },
                status:          { $in: ['scheduled', 'checked_in', 'completed'] },
            }),
            Appointment.countDocuments({
                doctorId: doctor.id,
                status:   'completed',
            }),
            Consultation.countDocuments({
                doctorId: doctor.id,
                status:   { $in: ['cancelled_by_doctor', 'cancelled_by_user', 'expired'] },
            }),
            Appointment.countDocuments({
                doctorId: doctor.id,
                status:   { $in: ['cancelled_by_user', 'cancelled_by_doctor', 'cancelled_by_admin'] },
            }),
            Consultation.countDocuments({ doctorId: doctor.id, status: 'completed' }),
        ]);

        const uniquePatients = await Consultation.distinct('userId', {
            doctorId: doctor.id,
            userId:   { $exists: true, $ne: null },
        });

        const patientsConTodayIds = await Consultation.distinct('userId', {
            doctorId:    doctor.id,
            scheduledAt: { $gte: todayStart, $lte: todayEnd },
            status:      { $in: ['confirmed', 'in_progress', 'ongoing', 'completed'] },
            userId:      { $exists: true, $ne: null },
        });
        
        const allPatientsToday = [...new Set([...apptTodayPatients, ...patientsConTodayIds])];

        res.json({
            success: true,
            stats: {
                appointments: {
                    today:      apptToday,
                    upcoming:   apptUpcoming,
                    completed:  apptCompletedCount,
                    cancelled:  apptUniqueCancelled,
                },
                consultations: {
                    today:      consToday,
                    ongoing:    consOngoing,
                    completed:  totalConsCompleted,
                    upcoming:   consUpcoming,
                    cancelled:  consUniqueCancelled,
                },
                patients: {
                    unique:     uniquePatients.length,
                    todayCount: allPatientsToday.length,
                },
                patientsTodayCount:    allPatientsToday.length,
                apptToday:             apptToday,
                apptUpcoming:          apptUpcoming,
                apptCompleted:         apptCompletedCount,
                apptCancelled:         apptUniqueCancelled,
                consToday:             consToday,
                consCompleted:         totalConsCompleted,
                consUpcoming:          consUpcoming,
                consCancelled:         consUniqueCancelled,
                rating:                doctor.rating       || 0,
                totalReviews:          doctor.totalReviews  || 0,
            },
        });
    } catch (error) {
        console.error('GET /my/stats error:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
    }
});

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
        await invalidatePattern('cache:doctors:*');
        res.json({ success: true, consultationSettings: { allowChat: doctor.allowChat, allowVideoCall: doctor.allowVideoCall } });
    } catch (err) {
        console.error('PUT /my/settings error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ══════════════════════════════════════════════════════════════════
// ADMIN — STATIC ROUTES (sebelum /:id)
// ══════════════════════════════════════════════════════════════════

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
// ROUTE PUBLIK — dengan Redis caching
// ══════════════════════════════════════════════════════════════════

/**
 * GET /
 * Semua dokter aktif (public) — cache 5 menit.
 * Query ini berat karena gabung MySQL + MongoDB, sangat benefit dari caching.
 */
router.get('/', async (req, res) => {
    try {
        const doctors = await getOrSet(CACHE_KEYS.DOCTORS_ALL, TTL.DOCTORS, async () => {
            const docsRecords = await Doctor.findAll({ 
                where: { isActive: true },
                attributes: ['id', 'name', 'specialization', 'consultationFee', 'rating', 'photo', 'bio', 'allowChat', 'allowVideoCall', 'isOnline', 'experience', 'strNumber', 'alumnus', 'practiceLocation', 'titlePrefix', 'titleSuffix'],
                include: [
                    { model: User, as: 'user', attributes: ['name'] },
                    { model: DoctorSchedule, as: 'schedules' }
                ]
            });

            const DoctorAvailability = require('../models/DoctorAvailability');
            const availList = await DoctorAvailability.find({ isActive: true });
            const availMap = {};
            
            availList.forEach(a => { 
                if (a && a.doctorId) {
                    availMap[a.doctorId.toString()] = a; 
                }
            });

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
                const wib = new Date(scheduledMs + 7 * 60 * 60 * 1000);
                const dateKey = wib.toISOString().slice(0, 10);
                const timeKey = `${String(wib.getUTCHours()).padStart(2,'0')}:${String(wib.getUTCMinutes()).padStart(2,'0')}`;
                consBookingsByDoctor[did].add(`${dateKey}|${timeKey}`);
            }

            return docsRecords.map(d => {
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
                    }
                }
                doc.isOffline = isOffline;

                if (avail && typeof avail.getSlotsForDay === 'function' && avail.isWeekActive()) {
                    const DAY_NAMES_WIB = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
                    const CUTOFF_MS     = 20 * 60 * 1000;
                    const bookedSet     = consBookingsByDoctor[docIdStr] || new Set();
                    const msPerDay      = 24 * 60 * 60 * 1000;
                    const consAvailableDays = [];
                    let   nextAvailableSlot = null;
                    let   totalSlots        = 0;
                    let   availableSlots    = 0;

                    let cursor = new Date(avail.weekStart.getTime());
                    while (cursor.getTime() <= avail.weekEnd.getTime()) {
                        const cursorWIB = new Date(cursor.getTime() + 7 * 60 * 60 * 1000);
                        const dow       = cursorWIB.getUTCDay();
                        if (dow === 0) { cursor = new Date(cursor.getTime() + msPerDay); continue; }

                        const activeSlots = avail.getSlotsForDay(dow);
                        const dateStr     = cursorWIB.toISOString().slice(0, 10);
                        const [y, mo, dy] = dateStr.split('-').map(Number);

                        const slotsForDay = activeSlots.map(s => {
                            const [sh, sm] = s.split(':').map(Number);
                            const slotUTC  = new Date(Date.UTC(y, mo - 1, dy, sh, sm, 0) - 7 * 60 * 60 * 1000);
                            const isPast   = (slotUTC.getTime() - CUTOFF_MS) <= nowUTC.getTime();
                            const isBooked = bookedSet.has(`${dateStr}|${s}`);
                            const isAvail  = !isPast && !isBooked;
                            totalSlots++;
                            if (isAvail) {
                                availableSlots++;
                                if (!nextAvailableSlot) {
                                    const dayName  = DAY_NAMES_WIB[dow];
                                    const bulan    = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][mo - 1];
                                    nextAvailableSlot = {
                                        date      : dateStr,
                                        dateLabel : `${dayName}, ${dy} ${bulan}`,
                                        startTime : s,
                                    };
                                }
                            }
                            return {
                                startTime : s,
                                endTime   : `${String(parseInt(s.split(':')[0]) + 1).padStart(2,'0')}:${s.split(':')[1]}`,
                                isAvailable: isAvail,
                            };
                        });

                        if (slotsForDay.length > 0) {
                            consAvailableDays.push({ day: DAY_NAMES_WIB[dow], dow, slots: slotsForDay });
                        }
                        cursor = new Date(cursor.getTime() + msPerDay);
                    }

                    doc.consAvailableDays   = consAvailableDays;
                    doc.nextAvailableSlot   = nextAvailableSlot;
                    doc.isFullyBooked       = totalSlots > 0 && availableSlots === 0;
                } else {
                    doc.consAvailableDays = [];
                    doc.nextAvailableSlot = null;
                    doc.isFullyBooked     = false;
                }

                return doc;
            });
        });

        res.json(doctors);
    } catch (error) {
        console.error('GET /doctors error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

/**
 * GET /:id/schedule — cache 5 menit
 */
router.get('/:id/schedule', async (req, res) => {
    try {
        const { id } = req.params;
        const doctor = await getOrSet(CACHE_KEYS.DOCTOR_SCHEDULE(id), TTL.DOCTORS, async () => {
            const docRecord = await Doctor.findByPk(id, {
                attributes: ['id', 'name', 'allowChat', 'allowVideoCall', 'isOnline'],
                include: [{ model: DoctorSchedule, as: 'schedules' }]
            });
            const doc = docRecord ? docRecord.toJSON() : null;
            if (doc) doc.availableDays = buildAvailableDays(doc.schedules);
            return doc;
        });

        if (!doctor) return res.status(404).json({ message: 'Dokter tidak ditemukan' });
        res.json(doctor);
    } catch (error) {
        console.error('GET /doctors/:id/schedule error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

/**
 * GET /:id — cache 5 menit
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const doctor = await getOrSet(CACHE_KEYS.DOCTOR_DETAIL(id), TTL.DOCTORS, async () => {
            const docRecord = await Doctor.findByPk(id, {
                include: [
                    { model: User, as: 'user', attributes: ['name', 'email'] },
                    { model: DoctorSchedule, as: 'schedules' }
                ]
            });
            const doc = docRecord ? docRecord.toJSON() : null;
            if (doc) {
                doc.userId = doc.user;
                doc.userId.id = doc.user.id;
                doc.availableDays = buildAvailableDays(doc.schedules);
            }
            return doc;
        });

        if (!doctor) return res.status(404).json({ message: 'Dokter tidak ditemukan' });
        res.json(doctor);
    } catch (error) {
        console.error('GET /doctors/:id error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ══════════════════════════════════════════════════════════════════
// ADMIN ROUTES — dengan invalidasi cache
// ══════════════════════════════════════════════════════════════════

router.post('/', auth, async (req, res) => {
    try {
        if (req.userRole !== 'admin') return res.status(403).json({ message: 'Akses ditolak' });
        const doctor = await Doctor.create(req.body);

        // Invalidasi list dokter
        await invalidate(CACHE_KEYS.DOCTORS_ALL);

        res.status(201).json({ success: true, message: 'Dokter berhasil ditambahkan', doctor });
    } catch (error) {
        console.error('POST /doctors error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.put('/:id', auth, async (req, res) => {
    try {
        if (req.userRole !== 'admin') return res.status(403).json({ message: 'Akses ditolak' });
        const { name, specialization, gender, bio, experience, consultationFee, isActive } = req.body;
        const update = {};
        if (name            !== undefined) update.name             = name;
        if (specialization  !== undefined) update.specialization   = specialization;
        if (gender          !== undefined) update.gender           = gender;
        if (bio             !== undefined) update.bio              = bio;
        if (experience      !== undefined) update.experience       = experience;
        if (consultationFee !== undefined) update.consultationFee  = consultationFee;
        if (isActive        !== undefined) update.isActive         = isActive;

        await Doctor.update(update, { where: { id: req.params.id } });
        const doctor = await Doctor.findByPk(req.params.id);
        if (!doctor) return res.status(404).json({ message: 'Dokter tidak ditemukan' });

        // Invalidasi list, detail, dan jadwal dokter ini
        await invalidateMany(
            CACHE_KEYS.DOCTORS_ALL,
            CACHE_KEYS.DOCTOR_DETAIL(req.params.id),
            CACHE_KEYS.DOCTOR_SCHEDULE(req.params.id),
        );

        res.json({ success: true, message: 'Dokter berhasil diperbarui', doctor });
    } catch (error) {
        console.error('PUT /doctors/:id error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

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

        // Invalidasi list dan jadwal dokter ini
        await invalidateMany(
            CACHE_KEYS.DOCTORS_ALL,
            CACHE_KEYS.DOCTOR_SCHEDULE(req.params.id),
        );

        res.json({ success: true, message: 'Jadwal berhasil diperbarui', schedule: buildAvailableDays(newSchedules) });
    } catch (error) {
        console.error('PUT /doctors/:id/schedule error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

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

        // Invalidasi list dan detail
        await invalidateMany(
            CACHE_KEYS.DOCTORS_ALL,
            CACHE_KEYS.DOCTOR_DETAIL(req.params.id),
        );

        res.json({ success: true, message: 'Pengaturan berhasil diperbarui', consultationSettings: { allowChat: doctor.allowChat, allowVideoCall: doctor.allowVideoCall } });
    } catch (error) {
        console.error('PUT /doctors/:id/settings error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.put('/:id/online-status', auth, async (req, res) => {
    try {
        if (req.userRole !== 'admin') return res.status(403).json({ message: 'Akses ditolak' });

        const doctor = await Doctor.findByPk(req.params.id);
        if (!doctor) return res.status(404).json({ message: 'Dokter tidak ditemukan' });

        const isOnline = req.body.isOnline !== undefined ? req.body.isOnline : !doctor.isOnline;
        await Doctor.update({ isOnline }, { where: { id: req.params.id } });
        doctor.isOnline = isOnline;

        // Invalidasi list dan detail
        await invalidateMany(
            CACHE_KEYS.DOCTORS_ALL,
            CACHE_KEYS.DOCTOR_DETAIL(req.params.id),
        );

        res.json({ success: true, message: isOnline ? 'Dokter online' : 'Dokter offline', isOnline: doctor.isOnline, doctor });
    } catch (error) {
        console.error('PUT /doctors/:id/online-status error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.delete('/:id', auth, async (req, res) => {
    try {
        if (req.userRole !== 'admin') return res.status(403).json({ message: 'Akses ditolak' });
        await Doctor.update({ isActive: false }, { where: { id: req.params.id } });
        const doctor = await Doctor.findByPk(req.params.id);
        if (!doctor) return res.status(404).json({ message: 'Dokter tidak ditemukan' });

        // Invalidasi list dan detail
        await invalidateMany(
            CACHE_KEYS.DOCTORS_ALL,
            CACHE_KEYS.DOCTOR_DETAIL(req.params.id),
        );

        res.json({ success: true, message: 'Dokter berhasil dinonaktifkan', doctor });
    } catch (error) {
        console.error('DELETE /doctors/:id error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ── Chat dokter ↔ admin ────────────────────────────────────────────────────────
const AdminChat    = require('../models/AdminChat');
const { createNotification } = require('../utils/notificationHelper');

const uploadChatFile = createCloudinaryUpload('klinik-ipb/admin-chat', ['jpg','jpeg','png','webp','pdf','doc','docx'], 10);

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

router.post('/my/chat', auth, doctorAuth, uploadChatFile.single('file'), async (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text?.trim() && !req.file) {
            return res.status(400).json({
                success: false,
                message: 'Pesan atau file wajib ada'
            });
        }
 
        const doctor = await Doctor.findOne({ where: { userId: req.userId } });
        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Dokter tidak ditemukan'
            });
        }
 
        let fileUrl = null, fileName = null, fileType = null;
        if (req.file) {
            fileUrl  = req.file.path || req.file.secure_url || req.file.url;
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
                $set : {
                    lastMessage: text?.trim() || `📎 ${fileName}`,
                    lastAt: new Date(),
                    doctorUserId: req.userId
                },
                $inc : { unreadAdmin: 1 },
            },
            { upsert: true, new: true }
        );
 
        const messageData = {
            _id: msg._id || new Date().getTime(),
            senderId: req.userId,
            senderRole: 'doctor',
            text: msg.text || '',
            fileUrl: msg.fileUrl || null,
            fileName: msg.fileName || null,
            fileType: msg.fileType || null,
            isRead: msg.isRead || false,
            createdAt: msg.createdAt,
        };
 
        const admins = await User.findAll({ where: { role: 'admin' } });
        const io = req.app.get('io');
 
        const doctorName = fmtDoctorName(doctor);
        const doctorId = doctor.id.toString();
 
        for (const admin of admins) {
            try {
                await createNotification({
                    userId : admin.id,
                    type   : 'new_message',
                    title  : `💬 Pesan dari ${doctorName}`,
                    message: text?.trim() || '📎 Dokter mengirimkan file',
                    data   : { doctorId: doctor.id },
                    io,
                });
 
                if (io) {
                    io.to(`user-${admin.id}`).emit('admin-chat-message', {
                        doctorId: doctorId,
                        doctorName: doctorName,
                        message: messageData
                    });
                }
            } catch (adminErr) {
                console.warn(`[POST /doctors/my/chat] Error emit to admin ${admin.id}:`, adminErr.message);
            }
        }
 
        res.json({
            success: true,
            message: messageData
        });
 
    } catch (err) {
        console.error('[POST /doctors/my/chat] Error:', {
            message: err.message,
            userId: req.userId,
            code: err.code,
            stack: err.stack
        });
 
        res.status(500).json({
            success: false,
            message: 'Gagal mengirim pesan ke admin'
        });
    }
});
 
router.put('/my/chat/read', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ where: { userId: req.userId } });
        if (!doctor) {
            return res.status(404).json({
                success: false,
                message: 'Dokter tidak ditemukan'
            });
        }
 
        const result = await AdminChat.findOneAndUpdate(
            { doctorId: doctor.id },
            { $set: { unreadDoctor: 0 } },
            { new: true }
        );
 
        res.json({
            success: true,
            data: result
        });
 
    } catch (err) {
        console.error('[PUT /doctors/my/chat/read] Error:', {
            message: err.message,
            userId: req.userId,
            stack: err.stack
        });
 
        res.status(500).json({
            success: false,
            message: 'Gagal update status baca pesan'
        });
    }
});

// ── Tren penyakit ML khusus dokter yang login ─────────────────────────────────
router.get('/my/disease-trend', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ where: { userId: req.userId } });
        if (!doctor) return res.status(404).json({ success: false, message: 'Data dokter tidak ditemukan' });

        const { period, year, month } = req.query;
        const now = new Date();
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        let start, end;
        if (period === 'month' && year && month) {
            const y = parseInt(year, 10);
            const m = parseInt(month, 10) - 1;
            start = new Date(y, m, 1, 0, 0, 0, 0);
            end   = new Date(y, m + 1, 0, 23, 59, 59, 999);
        } else if (period === '7d') {
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
            end   = todayEnd;
        } else if (period === '3m') {
            start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate(), 0, 0, 0, 0);
            end   = todayEnd;
        } else if (period === '6m') {
            start = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate(), 0, 0, 0, 0);
            end   = todayEnd;
        } else {
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0);
            end   = todayEnd;
        }

        const doctorIdStr = doctor.id.toString();

        const [consultResults, apptResults] = await Promise.all([
            Consultation.aggregate([
                {
                    $match: {
                        doctorId: doctorIdStr,
                        disease_category: { $ne: null },
                        scheduledAt: { $gte: start, $lte: end },
                    }
                },
                {
                    $group: {
                        _id: {
                            kategori: '$disease_category',
                            tanggal: {
                                $dateToString: {
                                    format: '%Y-%m-%d',
                                    date: { $dateAdd: { startDate: '$scheduledAt', unit: 'hour', amount: 7 } },
                                }
                            }
                        },
                        jumlah: { $sum: 1 }
                    }
                }
            ]),
            Appointment.aggregate([
                {
                    $match: {
                        doctorId: doctorIdStr,
                        disease_category: { $ne: null },
                        scheduledAt: { $gte: start, $lte: end },
                    }
                },
                {
                    $group: {
                        _id: {
                            kategori: '$disease_category',
                            tanggal: {
                                $dateToString: {
                                    format: '%Y-%m-%d',
                                    date: { $dateAdd: { startDate: '$scheduledAt', unit: 'hour', amount: 7 } },
                                }
                            }
                        },
                        jumlah: { $sum: 1 }
                    }
                }
            ])
        ]);

        const merged = {};
        [...consultResults, ...apptResults].forEach(r => {
            const { kategori, tanggal } = r._id;
            if (!merged[kategori]) merged[kategori] = [];
            const existing = merged[kategori].find(x => x.tanggal === tanggal);
            if (existing) existing.jumlah += r.jumlah;
            else merged[kategori].push({ tanggal, jumlah: r.jumlah });
        });

        Object.keys(merged).forEach(k => {
            merged[k].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
        });

        res.json({ success: true, data: merged });
    } catch (err) {
        console.error('[doctors] GET /my/disease-trend error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});


// ── Tren penyakit per Gender khusus dokter ───────────────────────────────────
router.get('/my/disease-trend-gender', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ where: { userId: req.userId } });
        if (!doctor) return res.status(404).json({ success: false, message: 'Data dokter tidak ditemukan' });
        const { period } = req.query;
        const gender = req.query.gender;
        const now = new Date();
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        let start, end;
        if (period === '7d') { start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0); end = todayEnd; }
        else if (period === '3m') { start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate(), 0, 0, 0, 0); end = todayEnd; }
        else if (period === '6m') { start = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate(), 0, 0, 0, 0); end = todayEnd; }
        else { start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0); end = todayEnd; }

        const doctorIdStr = doctor.id.toString();
        const buildPipeline = () => [
            { $match: { doctorId: doctorIdStr, disease_category: { $ne: null }, scheduledAt: { $gte: start, $lte: end } } },
            { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
            { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
            ...(gender ? [{ $match: { 'user.gender': gender === 'male' ? 'laki-laki' : 'perempuan' } }] : []),
            { $group: { _id: { kategori: '$disease_category', tanggal: { $dateToString: { format: '%Y-%m-%d', date: { $dateAdd: { startDate: '$scheduledAt', unit: 'hour', amount: 7 } } } } }, jumlah: { $sum: 1 } } },
        ];
        const [consultResults, apptResults] = await Promise.all([
            Consultation.aggregate(buildPipeline()),
            Appointment.aggregate(buildPipeline()),
        ]);
        const merged = {};
        [...consultResults, ...apptResults].forEach(r => {
            const { kategori, tanggal } = r._id;
            if (!merged[kategori]) merged[kategori] = [];
            const existing = merged[kategori].find(x => x.tanggal === tanggal);
            if (existing) existing.jumlah += r.jumlah;
            else merged[kategori].push({ tanggal, jumlah: r.jumlah });
        });
        Object.keys(merged).forEach(k => merged[k].sort((a, b) => a.tanggal.localeCompare(b.tanggal)));
        res.json({ success: true, data: merged, gender: gender || 'all' });
    } catch (err) {
        console.error('[doctors] GET /my/disease-trend-gender error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

// ── AI Insight khusus dokter (Groq) ─────────────────────────────────────────
router.post('/my/ai-insight', auth, doctorAuth, async (req, res) => {
    try {
        if (!process.env.GROQ_API_KEY) {
            return res.status(503).json({ success: false, message: 'GROQ_API_KEY belum di-set' });
        }
        const Groq = require('groq-sdk');
        const groqDoc = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
        const { diseaseData, period, gender } = req.body;
        if (!diseaseData || Object.keys(diseaseData).length === 0) {
            return res.json({ success: true, insight: null });
        }
        const topKategori = Object.entries(diseaseData)
            .map(([k, arr]) => ({ k, total: arr.reduce((s, r) => s + r.jumlah, 0) }))
            .sort((a, b) => b.total - a.total).slice(0, 8);
        const totalKasus = topKategori.reduce((s, x) => s + x.total, 0);
        const periodLabel = { '7d': '7 hari', '30d': '30 hari', '3m': '3 bulan', '6m': '6 bulan' }[period] || period;
        const genderLabel = gender === 'male' ? 'pasien laki-laki' : gender === 'female' ? 'pasien perempuan' : 'semua pasien';
        const summary = topKategori.map((x, i) => `${i+1}. ${x.k}: ${x.total} kasus`).join('\n');
        const prompt = `Kamu adalah analis kesehatan. Berikan insight singkat (3-4 kalimat) dalam Bahasa Indonesia untuk dokter berdasarkan data pasiennya:\n\nPeriode: ${periodLabel}\nFilter: ${genderLabel}\nTotal kasus: ${totalKasus}\n\nTop kategori penyakit:\n${summary}\n\nBerikan pola keluhan dan saran tindakan untuk dokter. Jawab langsung tanpa pembuka formal.`;
        const completion = await groqDoc.chat.completions.create({
            model: GROQ_MODEL, max_tokens: 300,
            messages: [{ role: 'user', content: prompt }],
        });
        res.json({ success: true, insight: completion.choices?.[0]?.message?.content?.trim() || null });
    } catch (err) {
        console.error('[doctors] POST /my/ai-insight error:', err);
        res.status(500).json({ success: false, message: 'Gagal generate insight', error: err.message });
    }
});

module.exports = router;
