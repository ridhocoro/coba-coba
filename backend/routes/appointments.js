/**
 * routes/appointments.js — Janji Temu Offline
 *
 * Endpoint:
 *
 * PUBLIC / USER
 *   GET  /api/appointments/doctors-with-slots        — daftar dokter yang punya availability offline
 *   GET  /api/appointments/slots/:doctorId           — slot tersedia untuk tanggal tertentu
 *   POST /api/appointments/book                      — booking janji (auto-confirm → scheduled)
 *   GET  /api/appointments/my                        — daftar janji user
 *   PUT  /api/appointments/:id/cancel                — user cancel (h-2 jam)
 *   PUT  /api/appointments/:id/reschedule            — user reschedule (h-24 jam, dokter sama)
 *
 * DOCTOR
 *   GET  /api/appointments/doctor/availability       — baca setting availability offline
 *   PUT  /api/appointments/doctor/availability       — simpan/update availability offline
 *   GET  /api/appointments/doctor/list               — daftar janji dokter
 *   PUT  /api/appointments/doctor/:id/checkin        — check-in pasien
 *   PUT  /api/appointments/doctor/:id/complete       — selesaikan janji
 *   PUT  /api/appointments/doctor/:id/cancel         — dokter cancel
 *
 * ADMIN
 *   GET  /api/appointments/admin/list                — semua janji (filter/search)
 *   GET  /api/appointments/admin/today               — janji hari ini (sort by time)
 *   GET  /api/appointments/admin/report              — statistik (per hari, no-show rate)
 *   PUT  /api/appointments/admin/:id/checkin         — manual check-in oleh admin
 *   PUT  /api/appointments/admin/:id/override        — override status
 *   PUT  /api/appointments/admin/:id/cancel          — admin cancel
 */

const express  = require('express');
const router   = express.Router();

const Appointment             = require('../models/Appointment');
const AppointmentAvailability = require('../models/AppointmentAvailability');
const DoctorAvailability      = require('../models/DoctorAvailability');  // konsultasi online
const Doctor                  = require('../models/Doctor');
const User                    = require('../models/User');
const auth                    = require('../middleware/auth');
const doctorAuth              = require('../middleware/doctorAuth');
const { createNotification }  = require('../utils/notificationHelper');

// ── Helpers ───────────────────────────────────────────────────────────────────
const WIB_OFFSET = 7 * 60 * 60 * 1000;

/** Ubah "YYYY-MM-DD" + "HH:MM" (WIB) → Date UTC */
function toUtc(dateStr, timeStr) {
    const [y, mo, d]    = dateStr.split('-').map(Number);
    const [hh, mm]      = timeStr.split(':').map(Number);
    const wibMs         = Date.UTC(y, mo - 1, d, hh, mm, 0, 0);
    return new Date(wibMs - WIB_OFFSET);
}

/** Hari UTC → YYYY-MM-DD string */
function toDayStr(date) {
    const d = new Date(date.getTime() + WIB_OFFSET);
    return d.toISOString().slice(0, 10);
}

/** Apakah tanggal adalah Senin–Jumat (dalam WIB) */
function isWeekday(dateStr) {
    const [y, mo, d] = dateStr.split('-').map(Number);
    const dow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
    return dow >= 1 && dow <= 5;
}

/** Apakah dokter bisa dipilih hari itu (berdasarkan practiceDays) */
function isDoctorWorkDay(dateStr, practiceDays) {
    const [y, mo, d] = dateStr.split('-').map(Number);
    const dow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
    return practiceDays.includes(dow);
}

/** Format tampilan tanggal WIB */
function fmtTgl(date) {
    return new Date(date.getTime() + WIB_OFFSET)
        .toLocaleDateString('id-ID', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
        });
}

/** Batas reschedule: 24 jam sebelum scheduledAt */
function canReschedule(scheduledAt) {
    return new Date(scheduledAt.getTime() - 24 * 60 * 60 * 1000) > new Date();
}

/** Batas cancel: 24 jam sebelum scheduledAt (sama dengan reschedule) */
function canCancel(scheduledAt) {
    return new Date(scheduledAt.getTime() - 24 * 60 * 60 * 1000) > new Date();
}

/** Kembalikan datetime deadline (scheduledAt - 24 jam) sebagai ISO string */
function cancelDeadline(scheduledAt) {
    return new Date(new Date(scheduledAt).getTime() - 24 * 60 * 60 * 1000).toISOString();
}

/** Cek berapa booking aktif user dalam minggu (Sen–Sab) yang sama dengan targetDate */
async function countUserBookingsThisWeek(userId, targetDateStr) {
    const [y, mo, d] = targetDateStr.split('-').map(Number);
    const dow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay(); // 0=Min,1=Sen,...,6=Sab
    // Senin minggu itu (dow=0 Minggu → d+1, dow=1 Sen → d, dll)
    const daysFromMonday = dow === 0 ? -6 : dow - 1;
    const mondayUtc  = new Date(Date.UTC(y, mo - 1, d - daysFromMonday));
    const saturdayUtc = new Date(mondayUtc.getTime() + 5 * 24 * 60 * 60 * 1000);
    const saturdayEnd = new Date(saturdayUtc.getTime() + 24 * 60 * 60 * 1000);

    return Appointment.countDocuments({
        userId,
        appointmentDate : { $gte: mondayUtc, $lt: saturdayEnd },
        status          : { $in: ['scheduled', 'checked_in'] },
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// A. DOKTER — AVAILABILITY SETTING
// ═══════════════════════════════════════════════════════════════════════════════

const APPT_ALLOWED_SLOTS = AppointmentAvailability.ALLOWED_SLOTS;
const DAYS_LABEL         = { 1:'Senin', 2:'Selasa', 3:'Rabu', 4:'Kamis', 5:'Jumat', 6:'Sabtu' };

/**
 * Hitung weekStart (Senin terdekat) dan weekEnd (Sabtu 23:59:59 WIB).
 */
function calcApptWeekRange() {
    const nowWIB = new Date(Date.now() + WIB_OFFSET);
    const dowNum = nowWIB.getUTCDay(); // 0=Min,1=Sen,...,6=Sab

    const daysToMonday = dowNum === 0 ? 1 : (dowNum === 1 ? 0 : 8 - dowNum);
    const monWIB = new Date(nowWIB.getTime() + daysToMonday * 24 * 60 * 60 * 1000);
    const monDateStr = monWIB.toISOString().slice(0, 10);
    const [y, mo, d] = monDateStr.split('-').map(Number);
    const weekStart  = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0) - WIB_OFFSET);

    const satWIB     = new Date(monWIB.getTime() + 5 * 24 * 60 * 60 * 1000);
    const satDateStr = satWIB.toISOString().slice(0, 10);
    const [sy, smo, sd] = satDateStr.split('-').map(Number);
    const weekEnd    = new Date(Date.UTC(sy, smo - 1, sd, 23, 59, 59) - WIB_OFFSET);

    return { weekStart, weekEnd, monDateStr, satDateStr };
}

/**
 * Normalise schedule: key '1'–'6' (Senin–Sabtu). Buang '0' (Minggu).
 */
function normaliseApptSchedule(raw) {
    const result = { '1':[],'2':[],'3':[],'4':[],'5':[],'6':[] };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result;
    for (let d = 1; d <= 6; d++) {
        const key = String(d);
        const inc = Array.isArray(raw[key]) ? raw[key] : [];
        result[key] = inc.filter(s => APPT_ALLOWED_SLOTS.includes(s));
    }
    return result;
}

/** Konversi Mongoose Map → plain object per hari (Senin–Sabtu) */
function scheduleToObj(avail) {
    const obj = {};
    for (let d = 1; d <= 6; d++) obj[String(d)] = avail.getSlotsForDay(d);
    return obj;
}

/** GET availability offline dokter sendiri */
router.get('/doctor/availability', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ userId: req.userId });
        if (!doctor) return res.status(404).json({ message: 'Profil dokter tidak ditemukan' });

        const avail = await AppointmentAvailability.findOne({ doctorId: doctor._id });
        if (!avail) {
            return res.json({
                success: true,
                availability: {
                    schedule:     { '1':[],'2':[],'3':[],'4':[],'5':[],'6':[] },
                    isActive:     false,
                    allowedSlots: APPT_ALLOWED_SLOTS,
                    weekStart:    null,
                    weekEnd:      null,
                    isExpired:    true,
                    _isDefault:   true,
                },
            });
        }

        res.json({
            success: true,
            availability: {
                _id:          avail._id,
                schedule:     scheduleToObj(avail),
                isActive:     avail.isActive,
                allowedSlots: APPT_ALLOWED_SLOTS,
                weekStart:    avail.weekStart,
                weekEnd:      avail.weekEnd,
                isExpired:    !avail.isWeekActive(),
                updatedAt:    avail.updatedAt,
            },
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

/** PUT simpan/update availability janji temu offline — sistem mingguan */
router.put('/doctor/availability', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ userId: req.userId });
        if (!doctor) return res.status(404).json({ message: 'Profil dokter tidak ditemukan' });

        const { schedule, isActive } = req.body;

        if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) {
            return res.status(400).json({ message: 'Format schedule tidak valid.' });
        }

        // Tolak hari Minggu
        if (Array.isArray(schedule['0']) && schedule['0'].length > 0) {
            return res.status(400).json({ message: 'Hari Minggu tidak diizinkan sebagai hari praktik.' });
        }

        const cleanSchedule = normaliseApptSchedule(schedule);
        const totalSlots = Object.values(cleanSchedule).reduce((s, a) => s + a.length, 0);
        if (totalSlots === 0) {
            return res.status(400).json({ message: 'Pilih minimal satu slot pada salah satu hari' });
        }

        // Cek overlap dengan konsultasi online
        const onlineAvail = await DoctorAvailability.findOne({ doctorId: doctor._id });
        if (onlineAvail && onlineAvail.isWeekActive()) {
            const conflicts = [];
            for (let d = 1; d <= 6; d++) {
                const apptSlots   = cleanSchedule[String(d)] || [];
                const onlineSlots = onlineAvail.getSlotsForDay(d);
                const overlap     = apptSlots.filter(s => onlineSlots.includes(s));
                if (overlap.length > 0) conflicts.push(`${DAYS_LABEL[d]}: ${overlap.join(', ')}`);
            }
            if (conflicts.length > 0) {
                return res.status(400).json({
                    message: `Jadwal janji temu bentrok dengan konsultasi online di: ${conflicts.join(' | ')}`,
                    conflicts,
                });
            }
        }

        const { weekStart, weekEnd, monDateStr, satDateStr } = calcApptWeekRange();

        const avail = await AppointmentAvailability.findOneAndUpdate(
            { doctorId: doctor._id },
            { $set: { schedule: cleanSchedule, isActive: isActive !== false, weekStart, weekEnd, updatedAt: new Date() } },
            { new: true, upsert: true }
        );

        res.json({
            success:      true,
            message:      `Jadwal janji temu berhasil dirilis (berlaku ${monDateStr} s.d. ${satDateStr})`,
            availability: {
                schedule:     scheduleToObj(avail),
                isActive:     avail.isActive,
                allowedSlots: APPT_ALLOWED_SLOTS,
                weekStart:    avail.weekStart,
                weekEnd:      avail.weekEnd,
                isExpired:    false,
            },
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// B. PUBLIC — DAFTAR DOKTER & SLOT
// ═══════════════════════════════════════════════════════════════════════════════

/** GET daftar dokter yang punya availability offline aktif */
router.get('/doctors-with-slots', auth, async (req, res) => {
    try {
        const availList = await AppointmentAvailability.find({ isActive: true })
            .populate({ path: 'doctorId', select: 'name specialization photo rating isActive' });

        const doctors = availList
            .filter(a => a.doctorId && a.doctorId.isActive && a.isWeekActive())
            .map(a => {
                const scheduleObj = {};
                for (let d = 1; d <= 6; d++) scheduleObj[String(d)] = a.getSlotsForDay(d);
                return { doctor: a.doctorId, availability: { schedule: scheduleObj, allowedSlots: APPT_ALLOWED_SLOTS, weekStart: a.weekStart, weekEnd: a.weekEnd } };
            });

        res.json({ success: true, doctors });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

/**
 * GET /slots/:doctorId?date=YYYY-MM-DD
 * Returns slot tersedia. Slot lewat tetap ditampilkan (isPast:true, available:false).
 */
router.get('/slots/:doctorId', auth, async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) return res.status(400).json({ message: 'Parameter date wajib (YYYY-MM-DD)' });

        const doctor = await Doctor.findById(req.params.doctorId);
        if (!doctor || !doctor.isActive) return res.status(404).json({ message: 'Dokter tidak ditemukan' });

        const avail = await AppointmentAvailability.findOne({ doctorId: doctor._id, isActive: true });
        if (!avail || !avail.isWeekActive()) {
            return res.json({ success: true, slots: [], notReleased: true, message: 'Dokter belum merilis jadwal untuk minggu ini.' });
        }

        // Cek override admin (blokir hari cuti)
        const DoctorScheduleOverride = require('../models/DoctorScheduleOverride');
        const override = await DoctorScheduleOverride.findOne({ doctorId: doctor._id, date });
        if (override) {
            return res.json({ success: true, slots: [], isBlocked: true, blockReason: override.reason || 'Dokter tidak hadir', message: `Dokter tidak hadir pada tanggal ini. ${override.reason || ''}`.trim() });
        }

        const weekStartStr = new Date(avail.weekStart.getTime() + WIB_OFFSET).toISOString().slice(0, 10);
        const weekEndStr   = new Date(avail.weekEnd.getTime()   + WIB_OFFSET).toISOString().slice(0, 10);
        if (date < weekStartStr || date > weekEndStr) {
            return res.json({ success: true, slots: [], message: 'Tanggal di luar rentang jadwal minggu ini.' });
        }

        const [y, mo, d] = date.split('-').map(Number);
        const dow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
        if (dow === 0) return res.json({ success: true, slots: [], message: 'Tidak tersedia hari Minggu.' });

        const activeSlots = avail.getSlotsForDay(dow);
        if (!activeSlots.length) return res.json({ success: true, slots: [], message: 'Dokter tidak praktik pada hari tersebut.' });

        const nowWib   = new Date(Date.now() + WIB_OFFSET);
        const nowMin   = nowWib.getUTCHours() * 60 + nowWib.getUTCMinutes();
        const todayStr = nowWib.toISOString().slice(0, 10);
        const dayStart = new Date(Date.UTC(y, mo - 1, d));
        const dayEnd   = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

        const booked = await Appointment.find({
            doctorId        : doctor._id,
            appointmentDate : { $gte: dayStart, $lt: dayEnd },
            status          : { $in: ['scheduled', 'checked_in'] },
        }).select('appointmentTime');
        const bookedTimes = new Set(booked.map(b => b.appointmentTime));

        const slots = activeSlots.map(slot => {
            const [sh, sm] = slot.split(':').map(Number);
            const slotMin  = sh * 60 + sm;
            const slotUTC  = new Date(Date.UTC(y, mo - 1, d, sh, sm, 0) - WIB_OFFSET);
            const APPT_CUTOFF_MS = 30 * 60 * 1000; // 30 menit sebelum slot
            const isPast   = (slotUTC.getTime() - APPT_CUTOFF_MS) <= Date.now();
            const isBooked = bookedTimes.has(slot);
            const endMin   = slotMin + 30;
            const endTime  = `${String(Math.floor(endMin/60)).padStart(2,'0')}:${String(endMin%60).padStart(2,'0')}`;
            return { startTime: slot, endTime, available: !isPast && !isBooked, isPast, isBooked };
        });

        res.json({ success: true, slots, date });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// C. USER — BOOKING, LIST, CANCEL, RESCHEDULE
// ═══════════════════════════════════════════════════════════════════════════════

/** POST /book — user booking janji temu */
router.post('/book', auth, async (req, res) => {
    try {
        if (!['user', 'mahasiswa'].includes(req.userRole)) return res.status(403).json({ message: 'Hanya user/mahasiswa yang bisa booking' });

        const { doctorId, date, time, complaint } = req.body;
        if (!doctorId || !date || !time) {
            return res.status(400).json({ message: 'doctorId, date, dan time wajib diisi' });
        }

        // Validasi hari (Senin–Sabtu, tidak boleh Minggu)
        const [bdy, bdmo, bdd] = date.split('-').map(Number);
        const bdow = new Date(Date.UTC(bdy, bdmo - 1, bdd)).getUTCDay();
        if (bdow === 0) return res.status(400).json({ message: 'Janji temu tidak tersedia hari Minggu.' });

        const nowWib   = new Date(Date.now() + WIB_OFFSET);
        const todayStr = nowWib.toISOString().slice(0, 10);

        if (date < todayStr) return res.status(400).json({ message: 'Tidak bisa booking tanggal yang sudah lewat' });

        // Slot harus minimal 30 menit dari sekarang
        const [bsh, bsm] = time.split(':').map(Number);
        const slotUtcMs  = new Date(Date.UTC(...date.split('-').map(Number).map((v,i) => i===1 ? v-1 : v), bsh, bsm, 0) - WIB_OFFSET).getTime();
        if (slotUtcMs - Date.now() < 30 * 60 * 1000) {
            return res.status(400).json({ message: 'Pemesanan harus dilakukan minimal 30 menit sebelum jadwal' });
        }

        // Cek availability dokter
        const doctor = await Doctor.findById(doctorId);
        if (!doctor || !doctor.isActive) return res.status(404).json({ message: 'Dokter tidak ditemukan atau tidak aktif' });

        // Cek blokiran jadwal dari admin
        const DoctorScheduleOverride = require('../models/DoctorScheduleOverride');
        const override = await DoctorScheduleOverride.findOne({ doctorId: doctor._id, date });
        if (override) {
            return res.status(400).json({ message: `Dokter tidak hadir pada tanggal ini. ${override.reason || ''}`.trim() });
        }

        const avail = await AppointmentAvailability.findOne({ doctorId: doctor._id, isActive: true });
        if (!avail || !avail.isWeekActive()) {
            return res.status(400).json({ message: 'Dokter belum merilis jadwal untuk minggu ini.' });
        }

        // Validasi tanggal dalam rentang weekStart–weekEnd
        const weekStartStr = new Date(avail.weekStart.getTime() + WIB_OFFSET).toISOString().slice(0, 10);
        const weekEndStr   = new Date(avail.weekEnd.getTime()   + WIB_OFFSET).toISOString().slice(0, 10);
        if (date < weekStartStr || date > weekEndStr) {
            return res.status(400).json({ message: 'Tanggal di luar rentang jadwal minggu ini.' });
        }

        // Validasi hari + slot
        const [y2, mo2, d2] = date.split('-').map(Number);
        const dow2 = new Date(Date.UTC(y2, mo2 - 1, d2)).getUTCDay();
        if (!avail.isSlotActive(dow2, time)) {
            return res.status(400).json({ message: 'Slot waktu tidak tersedia pada hari tersebut. Silakan pilih dari slot yang tersedia.' });
        }

        // Batas 2x per minggu
        const weekCount = await countUserBookingsThisWeek(req.userId, date);
        if (weekCount >= 2) {
            return res.status(400).json({ message: 'Anda sudah memiliki 2 janji temu aktif minggu ini (batas maksimal)' });
        }

        // ── RACE CONDITION CHECK (atomic) ─────────────────────────────────────
        const [y, mo, d] = date.split('-').map(Number);
        const dayStart   = new Date(Date.UTC(y, mo - 1, d));
        const dayEnd     = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

        const conflict = await Appointment.findOne({
            doctorId        : doctor._id,
            appointmentDate : { $gte: dayStart, $lt: dayEnd },
            appointmentTime : time,
            status          : { $in: ['scheduled', 'checked_in'] },
        });
        if (conflict) {
            return res.status(409).json({ message: 'Slot ini baru saja diambil orang lain. Silakan pilih slot lain.' });
        }

        // Hitung endTime (30 menit)
        const [sh, sm]   = time.split(':').map(Number);
        const endMin     = sh * 60 + sm + 30;
        const endTime    = `${String(Math.floor(endMin / 60)).padStart(2,'0')}:${String(endMin % 60).padStart(2,'0')}`;
        const scheduledAt = toUtc(date, time);

        const appointment = new Appointment({
            userId          : req.userId,
            doctorId        : doctor._id,
            appointmentDate : dayStart,
            appointmentTime : time,
            endTime,
            scheduledAt,
            complaint       : complaint || '',
            status          : 'scheduled',
        });

        await appointment.save();

        // Notif user konfirmasi
        await createNotification({
            userId  : req.userId,
            type    : 'appointment_reminder',
            title   : '✅ Janji Temu Terkonfirmasi',
            message : `Janji temu Anda dengan dr. ${doctor.name} pada ${fmtTgl(scheduledAt)} pukul ${time} WIB berhasil dibuat.`,
            data    : { appointmentId: appointment._id },
            io      : req.app.get('io'),
        });

        // Notif dokter
        if (doctor.userId) {
            const user = await User.findById(req.userId).select('name');
            await createNotification({
                userId  : doctor.userId,
                type    : 'appointment_reminder',
                title   : '📅 Janji Temu Baru',
                message : `${user?.name || 'Pasien'} membuat janji temu pada ${fmtTgl(scheduledAt)} pukul ${time} WIB.`,
                data    : { appointmentId: appointment._id },
                io      : req.app.get('io'),
            });
        }

        const populated = await Appointment.findById(appointment._id)
            .populate('doctorId', 'name specialization photo')
            .populate('userId',   'name email');

        res.json({ success: true, appointment: populated });
    } catch (err) {
        console.error('[appointments/book]', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

/** GET /my — daftar janji user */
router.get('/my', auth, async (req, res) => {
    try {
        const appointments = await Appointment.find({ userId: req.userId })
            .populate('doctorId', 'name specialization photo')
            .sort({ scheduledAt: -1 });

        // Ambil availability dokter (weekStart/weekEnd) untuk reschedule modal
        const doctorIds = [...new Set(appointments.map(a => a.doctorId?._id?.toString()).filter(Boolean))];
        const availList = await AppointmentAvailability.find({ doctorId: { $in: doctorIds } })
            .select('doctorId schedule weekStart weekEnd isActive');
        const availMap = {};
        availList.forEach(av => {
            const schedObj = {};
            for (let d = 1; d <= 6; d++) schedObj[String(d)] = av.getSlotsForDay(d);
            availMap[av.doctorId.toString()] = {
                schedule: schedObj,
                weekStart: av.weekStart,
                weekEnd:   av.weekEnd,
                isActive:  av.isActive,
            };
        });

        const withDeadline = appointments.map(a => {
            const obj = a.toObject();
            if (a.scheduledAt) {
                obj.cancelDeadline = cancelDeadline(a.scheduledAt);
            }
            const docId = a.doctorId?._id?.toString();
            if (docId && availMap[docId]) {
                obj.doctorId = { ...obj.doctorId, availability: availMap[docId] };
            }
            return obj;
        });

        res.json({ success: true, appointments: withDeadline });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

/** PUT /:id/cancel — user cancel (wajib >2 jam sebelum jadwal) */
router.put('/:id/cancel', auth, async (req, res) => {
    try {
        const { reason } = req.body;
        if (!reason || reason.trim().length < 5) {
            return res.status(400).json({ message: 'Alasan pembatalan wajib diisi (minimal 5 karakter)' });
        }

        const appointment = await Appointment.findById(req.params.id)
            .populate('doctorId', 'name userId');
        if (!appointment) return res.status(404).json({ message: 'Janji tidak ditemukan' });
        if (appointment.userId.toString() !== req.userId) return res.status(403).json({ message: 'Akses ditolak' });
        if (appointment.status !== 'scheduled') return res.status(400).json({ message: `Tidak bisa dibatalkan — status saat ini: ${appointment.status}` });

        if (!canCancel(appointment.scheduledAt)) {
            return res.status(400).json({ message: 'Tidak bisa membatalkan janji kurang dari 24 jam sebelum jadwal' });
        }

        const updated = await Appointment.findOneAndUpdate(
            { _id: req.params.id, status: 'scheduled' },
            { $set: { status: 'cancelled_by_user', cancelReason: reason, cancelledBy: 'user', cancelledAt: new Date() } },
            { new: true }
        ).populate('doctorId', 'name userId');
        if (!updated) return res.status(409).json({ message: 'Status berubah, silakan refresh' });

        // Notif dokter
        if (updated.doctorId?.userId) {
            const user = await User.findById(req.userId).select('name');
            await createNotification({
                userId  : updated.doctorId.userId,
                type    : 'appointment_reminder',
                title   : '❌ Janji Temu Dibatalkan',
                message : `${user?.name || 'Pasien'} membatalkan janji pukul ${updated.appointmentTime} WIB. Alasan: ${reason}`,
                data    : { appointmentId: updated._id },
                io      : req.app.get('io'),
            });
        }

        res.json({ success: true, appointment: updated });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

/** PUT /:id/reschedule — user reschedule (wajib >24 jam, dokter sama) */
router.put('/:id/reschedule', auth, async (req, res) => {
    try {
        const { date, time } = req.body;
        if (!date || !time) return res.status(400).json({ message: 'date dan time baru wajib diisi' });

        const appointment = await Appointment.findById(req.params.id)
            .populate('doctorId', 'name userId');
        if (!appointment) return res.status(404).json({ message: 'Janji tidak ditemukan' });
        if (appointment.userId.toString() !== req.userId) return res.status(403).json({ message: 'Akses ditolak' });
        if (appointment.status !== 'scheduled') return res.status(400).json({ message: 'Hanya bisa reschedule janji dengan status scheduled' });

        if (!canReschedule(appointment.scheduledAt)) {
            return res.status(400).json({ message: 'Reschedule hanya bisa dilakukan minimal 24 jam sebelum jadwal' });
        }

        // Batas 1x reschedule
        if ((appointment.rescheduleCount || 0) >= 1) {
            return res.status(400).json({ message: 'Reschedule hanya bisa dilakukan 1 kali.' });
        }

        // Validasi hari (Senin–Sabtu, tidak boleh Minggu)
        const [rdy, rdmo, rdd] = date.split('-').map(Number);
        const rdow0 = new Date(Date.UTC(rdy, rdmo - 1, rdd)).getUTCDay();
        if (rdow0 === 0) return res.status(400).json({ message: 'Janji temu tidak tersedia hari Minggu.' });

        const nowWib   = new Date(Date.now() + WIB_OFFSET);
        const todayStr = nowWib.toISOString().slice(0, 10);
        if (date < todayStr) return res.status(400).json({ message: 'Tidak bisa memilih tanggal yang sudah lewat' });

        // Slot baru harus minimal 30 menit dari sekarang
        const [rsh, rsm] = time.split(':').map(Number);
        const rSlotUtcMs = new Date(Date.UTC(...date.split('-').map(Number).map((v,i) => i===1 ? v-1 : v), rsh, rsm, 0) - WIB_OFFSET).getTime();
        if (rSlotUtcMs - Date.now() < 30 * 60 * 1000) {
            return res.status(400).json({ message: 'Pemesanan harus dilakukan minimal 30 menit sebelum jadwal' });
        }

        const avail = await AppointmentAvailability.findOne({ doctorId: appointment.doctorId._id, isActive: true });
        if (!avail || !avail.isWeekActive()) {
            return res.status(400).json({ message: 'Dokter belum merilis jadwal untuk minggu ini.' });
        }

        // Validasi tanggal dalam rentang weekStart–weekEnd
        const weekStartStr = new Date(avail.weekStart.getTime() + WIB_OFFSET).toISOString().slice(0, 10);
        const weekEndStr   = new Date(avail.weekEnd.getTime()   + WIB_OFFSET).toISOString().slice(0, 10);
        if (date < weekStartStr || date > weekEndStr) {
            return res.status(400).json({ message: 'Tanggal di luar rentang jadwal minggu ini.' });
        }

        // Validasi hari + slot
        const [ry, rmo, rd] = date.split('-').map(Number);
        const rdow = new Date(Date.UTC(ry, rmo - 1, rd)).getUTCDay();
        if (!avail.isSlotActive(rdow, time)) {
            return res.status(400).json({ message: 'Slot tidak tersedia pada hari tersebut' });
        }

        // Race condition check slot baru
        const [y, mo, d] = date.split('-').map(Number);
        const dayStart   = new Date(Date.UTC(y, mo - 1, d));
        const dayEnd     = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        const conflict   = await Appointment.findOne({
            doctorId        : appointment.doctorId._id,
            appointmentDate : { $gte: dayStart, $lt: dayEnd },
            appointmentTime : time,
            status          : { $in: ['scheduled', 'checked_in'] },
            _id             : { $ne: appointment._id },
        });
        if (conflict) return res.status(409).json({ message: 'Slot baru sudah diambil orang lain' });

        // Hitung endTime baru (30 menit)
        const [sh, sm]    = time.split(':').map(Number);
        const endMin      = sh * 60 + sm + 30;
        const endTime     = `${String(Math.floor(endMin/60)).padStart(2,'0')}:${String(endMin%60).padStart(2,'0')}`;
        const scheduledAt = toUtc(date, time);

        const updated = await Appointment.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    appointmentDate   : dayStart,
                    appointmentTime   : time,
                    endTime,
                    scheduledAt,
                    reminderSent      : false,
                    rescheduledAt     : new Date(),
                    rescheduledFrom   : {
                        appointmentDate : appointment.appointmentDate,
                        appointmentTime : appointment.appointmentTime,
                        scheduledAt     : appointment.scheduledAt,
                    },
                },
                $inc: { rescheduleCount: 1 },
                $push: {
                    rescheduleHistory: {
                        from: {
                            appointmentDate : appointment.appointmentDate,
                            appointmentTime : appointment.appointmentTime,
                            scheduledAt     : appointment.scheduledAt,
                        },
                        to: {
                            appointmentDate : dayStart,
                            appointmentTime : time,
                            scheduledAt,
                        },
                        rescheduledAt : new Date(),
                    },
                },
            },
            { new: true }
        ).populate('doctorId', 'name userId');

        // Notif
        await createNotification({
            userId  : req.userId,
            type    : 'appointment_reminder',
            title   : '🔄 Jadwal Diubah',
            message : `Janji temu Anda dengan dr. ${updated.doctorId?.name} diubah ke ${fmtTgl(scheduledAt)} pukul ${time} WIB.`,
            data    : { appointmentId: updated._id },
            io      : req.app.get('io'),
        });
        if (updated.doctorId?.userId) {
            const user = await User.findById(req.userId).select('name');
            await createNotification({
                userId  : updated.doctorId.userId,
                type    : 'appointment_reminder',
                title   : '🔄 Pasien Reschedule',
                message : `${user?.name || 'Pasien'} mengubah jadwal ke ${fmtTgl(scheduledAt)} pukul ${time} WIB.`,
                data    : { appointmentId: updated._id },
                io      : req.app.get('io'),
            });
        }

        res.json({ success: true, appointment: updated });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// D. DOKTER — KELOLA JANJI
// ═══════════════════════════════════════════════════════════════════════════════

/** GET daftar janji dokter */
router.get('/doctor/list', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ userId: req.userId });
        if (!doctor) return res.status(404).json({ message: 'Profil dokter tidak ditemukan' });

        const { date, status } = req.query;
        const query = { doctorId: doctor._id };

        if (status && status !== 'all') query.status = status;
        if (date) {
            const [y, mo, d] = date.split('-').map(Number);
            const ds = new Date(Date.UTC(y, mo - 1, d));
            query.appointmentDate = { $gte: ds, $lt: new Date(ds.getTime() + 24*60*60*1000) };
        }

        const appointments = await Appointment.find(query)
            .populate('userId', 'name email phone')
            .sort({ scheduledAt: 1 });

        res.json({ success: true, appointments });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

/** PUT /doctor/:id/checkin — dokter check-in pasien */
router.put('/doctor/:id/checkin', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ userId: req.userId });
        if (!doctor) return res.status(404).json({ message: 'Profil dokter tidak ditemukan' });

        const appointment = await Appointment.findById(req.params.id).populate('userId', 'name');
        if (!appointment) return res.status(404).json({ message: 'Janji tidak ditemukan' });
        if (appointment.doctorId.toString() !== doctor._id.toString()) return res.status(403).json({ message: 'Akses ditolak' });
        if (appointment.status !== 'scheduled') return res.status(400).json({ message: `Status harus scheduled, saat ini: ${appointment.status}` });

        const updated = await Appointment.findOneAndUpdate(
            { _id: req.params.id, status: 'scheduled' },
            { $set: { status: 'checked_in', checkedInAt: new Date() } },
            { new: true }
        ).populate('userId', 'name email');
        if (!updated) return res.status(409).json({ message: 'Status berubah, silakan refresh' });

        await createNotification({
            userId  : appointment.userId._id,
            type    : 'appointment_reminder',
            title   : '✅ Check-in Berhasil',
            message : `Anda telah check-in untuk janji temu pukul ${appointment.appointmentTime} WIB. Silakan tunggu giliran Anda.`,
            data    : { appointmentId: appointment._id },
            io      : req.app.get('io'),
        });

        res.json({ success: true, appointment: updated });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

/** PUT /doctor/:id/complete — dokter selesaikan janji */
router.put('/doctor/:id/complete', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ userId: req.userId });
        if (!doctor) return res.status(404).json({ message: 'Profil dokter tidak ditemukan' });

        const appointment = await Appointment.findById(req.params.id).populate('userId', 'name');
        if (!appointment) return res.status(404).json({ message: 'Janji tidak ditemukan' });
        if (appointment.doctorId.toString() !== doctor._id.toString()) return res.status(403).json({ message: 'Akses ditolak' });
        if (appointment.status !== 'checked_in') return res.status(400).json({ message: `Status harus checked_in, saat ini: ${appointment.status}` });

        const { notes, assessment, plan, objectiveFindings } = req.body;

        // Rekam medis wajib: Assessment (A) dan Plan (P)
        if (!assessment?.trim()) {
            return res.status(400).json({ message: 'Diagnosis (Assessment) wajib diisi sebelum menyelesaikan janji' });
        }
        if (!plan?.trim()) {
            return res.status(400).json({ message: 'Rencana Terapi (Plan) wajib diisi sebelum menyelesaikan janji' });
        }

        const updated = await Appointment.findOneAndUpdate(
            { _id: req.params.id, status: 'checked_in' },
            {
                $set: {
                    status      : 'completed',
                    completedAt : new Date(),
                    doctorNotes : notes || assessment.trim(),
                    medicalRecord: {
                        objectiveFindings: objectiveFindings?.trim() || '',
                        assessment        : assessment.trim(),
                        plan              : plan.trim(),
                        doctorNotes       : notes?.trim() || '',
                        isCompleted       : true,
                        completedAt       : new Date(),
                    },
                },
            },
            { new: true }
        ).populate('userId', 'name email');
        if (!updated) return res.status(409).json({ message: 'Status berubah, silakan refresh' });

        await createNotification({
            userId  : appointment.userId._id,
            type    : 'appointment_reminder',
            title   : '✅ Janji Temu Selesai',
            message : `Janji temu Anda dengan dr. ${doctor.name} telah selesai. Rekam medis tersedia.`,
            data    : { appointmentId: appointment._id },
            io      : req.app.get('io'),
        });

        res.json({ success: true, appointment: updated });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

/** PUT /doctor/:id/cancel — dokter cancel */
router.put('/doctor/:id/cancel', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ userId: req.userId });
        if (!doctor) return res.status(404).json({ message: 'Profil dokter tidak ditemukan' });

        const { reason } = req.body;
        if (!reason || reason.trim().length < 5) return res.status(400).json({ message: 'Alasan pembatalan wajib diisi' });

        const appointment = await Appointment.findById(req.params.id).populate('userId', 'name');
        if (!appointment) return res.status(404).json({ message: 'Janji tidak ditemukan' });
        if (appointment.doctorId.toString() !== doctor._id.toString()) return res.status(403).json({ message: 'Akses ditolak' });
        if (appointment.status !== 'scheduled') return res.status(400).json({ message: 'Hanya bisa cancel janji berstatus scheduled' });

        if (!canCancel(appointment.scheduledAt)) {
            return res.status(400).json({ message: 'Tidak bisa membatalkan janji kurang dari 24 jam sebelum jadwal' });
        }

        const updated = await Appointment.findOneAndUpdate(
            { _id: req.params.id, status: 'scheduled' },
            { $set: { status: 'cancelled_by_doctor', cancelReason: reason, cancelledBy: 'doctor', cancelledAt: new Date() } },
            { new: true }
        ).populate('userId', 'name');
        if (!updated) return res.status(409).json({ message: 'Status berubah, silakan refresh' });

        await createNotification({
            userId  : appointment.userId._id,
            type    : 'appointment_reminder',
            title   : '❌ Janji Temu Dibatalkan Dokter',
            message : `Maaf, janji temu Anda dengan dr. ${doctor.name} pada pukul ${appointment.appointmentTime} WIB dibatalkan. Alasan: ${reason}`,
            data    : { appointmentId: appointment._id },
            io      : req.app.get('io'),
        });

        res.json({ success: true, appointment: updated });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// E. ADMIN
// ═══════════════════════════════════════════════════════════════════════════════

const adminOnly = (req, res, next) => {
    if (req.userRole !== 'admin') return res.status(403).json({ message: 'Akses ditolak — admin only' });
    next();
};

/** GET /admin/today — janji hari ini, sort by time */
router.get('/admin/today', auth, adminOnly, async (req, res) => {
    try {
        const nowWib   = new Date(Date.now() + WIB_OFFSET);
        const todayStr = nowWib.toISOString().slice(0, 10);
        const [y, mo, d] = todayStr.split('-').map(Number);
        const dayStart = new Date(Date.UTC(y, mo - 1, d));
        const dayEnd   = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

        const appointments = await Appointment.find({
            appointmentDate : { $gte: dayStart, $lt: dayEnd },
        })
        .populate('userId',   'name email phone')
        .populate('doctorId', 'name specialization')
        .sort({ appointmentTime: 1 });

        res.json({ success: true, appointments, date: todayStr });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

/** GET /admin/list — semua janji dengan filter/search/pagination */
router.get('/admin/list', auth, adminOnly, async (req, res) => {
    try {
        const { status, doctorId, date, search, page = 1, limit = 30 } = req.query;
        const query = {};

        if (status && status !== 'all') query.status = status;
        if (doctorId) query.doctorId = doctorId;
        if (date) {
            const [y, mo, d] = date.split('-').map(Number);
            const ds = new Date(Date.UTC(y, mo - 1, d));
            query.appointmentDate = { $gte: ds, $lt: new Date(ds.getTime() + 24*60*60*1000) };
        }

        // Jika ada search, ambil semua dulu lalu filter (search tidak bisa di-index)
        // Jika tidak ada search, gunakan skip+limit langsung di DB (efisien)
        let appointments, total;

        if (search) {
            const all = await Appointment.find(query)
                .populate('userId',   'name email phone')
                .populate('doctorId', 'name specialization')
                .sort({ scheduledAt: -1 });

            const s = search.toLowerCase();
            const filtered = all.filter(a =>
                a.userId?.name?.toLowerCase().includes(s) ||
                a.doctorId?.name?.toLowerCase().includes(s) ||
                a.userId?.phone?.includes(s)
            );
            total       = filtered.length;
            const start = (Number(page) - 1) * Number(limit);
            appointments = filtered.slice(start, start + Number(limit));
        } else {
            total = await Appointment.countDocuments(query);
            appointments = await Appointment.find(query)
                .populate('userId',   'name email phone')
                .populate('doctorId', 'name specialization')
                .sort({ scheduledAt: -1 })
                .skip((Number(page) - 1) * Number(limit))
                .limit(Number(limit));
        }

        res.json({ success: true, appointments, total, page: Number(page), limit: Number(limit) });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

/** GET /admin/report — statistik */
router.get('/admin/report', auth, adminOnly, async (req, res) => {
    try {
        const { from, to } = req.query;
        const nowWib = new Date(Date.now() + WIB_OFFSET);

        // Default: 7 hari terakhir
        const toDate   = to   ? new Date(to)   : new Date(nowWib.toISOString().slice(0,10));
        const fromDate = from ? new Date(from) : new Date(toDate.getTime() - 6 * 24 * 60 * 60 * 1000);

        const appointments = await Appointment.find({
            appointmentDate : { $gte: fromDate, $lte: new Date(toDate.getTime() + 24*60*60*1000) },
        })
        .populate('doctorId', 'name');

        // Ringkasan per hari
        const byDay = {};
        for (const a of appointments) {
            const dayStr = toDayStr(a.appointmentDate);
            if (!byDay[dayStr]) byDay[dayStr] = { total: 0, completed: 0, no_show: 0, cancelled: 0, scheduled: 0 };
            byDay[dayStr].total++;
            if (a.status === 'completed')                                               byDay[dayStr].completed++;
            else if (a.status === 'no_show')                                            byDay[dayStr].no_show++;
            else if (['cancelled_by_user','cancelled_by_doctor','cancelled_by_admin'].includes(a.status)) byDay[dayStr].cancelled++;
            else if (a.status === 'scheduled')                                          byDay[dayStr].scheduled++;
        }

        // Ringkasan per dokter
        const byDoctor = {};
        for (const a of appointments) {
            const name = a.doctorId?.name || 'Unknown';
            if (!byDoctor[name]) byDoctor[name] = { total: 0, completed: 0, no_show: 0 };
            byDoctor[name].total++;
            if (a.status === 'completed') byDoctor[name].completed++;
            if (a.status === 'no_show')   byDoctor[name].no_show++;
        }

        const total       = appointments.length;
        const completed   = appointments.filter(a => a.status === 'completed').length;
        const noShow      = appointments.filter(a => a.status === 'no_show').length;
        const noShowRate  = total > 0 ? Math.round((noShow / total) * 100) : 0;

        res.json({
            success : true,
            summary : { total, completed, no_show: noShow, noShowRate },
            byDay,
            byDoctor,
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

/** PUT /admin/:id/checkin — manual check-in oleh admin */
router.put('/admin/:id/checkin', auth, adminOnly, async (req, res) => {
    try {
        const appointment = await Appointment.findById(req.params.id).populate('userId', 'name');
        if (!appointment) return res.status(404).json({ message: 'Janji tidak ditemukan' });
        if (appointment.status !== 'scheduled') return res.status(400).json({ message: `Status harus scheduled, saat ini: ${appointment.status}` });

        const updated = await Appointment.findOneAndUpdate(
            { _id: req.params.id, status: 'scheduled' },
            { $set: { status: 'checked_in', checkedInAt: new Date() } },
            { new: true }
        ).populate('userId', 'name email').populate('doctorId', 'name');

        await createNotification({
            userId  : appointment.userId._id,
            type    : 'appointment_reminder',
            title   : '✅ Check-in oleh Admin',
            message : `Admin telah melakukan check-in untuk janji temu Anda pukul ${appointment.appointmentTime} WIB.`,
            data    : { appointmentId: appointment._id },
            io      : req.app.get('io'),
        });

        res.json({ success: true, appointment: updated });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

/** PUT /admin/:id/override — override status (kasus khusus) */
router.put('/admin/:id/override', auth, adminOnly, async (req, res) => {
    try {
        const { status, reason } = req.body;
        const allowed = ['scheduled','checked_in','completed','no_show','cancelled_by_admin'];
        if (!allowed.includes(status)) {
            return res.status(400).json({ message: `Status tidak valid. Pilih: ${allowed.join(', ')}` });
        }

        const update = { status };
        if (reason) update.cancelReason = reason;
        if (status === 'checked_in')  update.checkedInAt  = new Date();
        if (status === 'completed')   update.completedAt  = new Date();
        if (status === 'no_show')     update.noShowAt     = new Date();
        if (status === 'cancelled_by_admin') { update.cancelledBy = 'admin'; update.cancelledAt = new Date(); }

        const updated = await Appointment.findByIdAndUpdate(
            req.params.id,
            { $set: update },
            { new: true }
        ).populate('userId', 'name email').populate('doctorId', 'name');
        if (!updated) return res.status(404).json({ message: 'Janji tidak ditemukan' });

        res.json({ success: true, appointment: updated });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

/** PUT /admin/:id/cancel — admin cancel */
router.put('/admin/:id/cancel', auth, adminOnly, async (req, res) => {
    try {
        const { reason } = req.body;
        if (!reason || reason.trim().length < 5) return res.status(400).json({ message: 'Alasan pembatalan wajib diisi' });

        const appointment = await Appointment.findById(req.params.id).populate('userId', 'name').populate('doctorId', 'name userId');
        if (!appointment) return res.status(404).json({ message: 'Janji tidak ditemukan' });
        if (!['scheduled', 'checked_in'].includes(appointment.status)) {
            return res.status(400).json({ message: 'Hanya bisa cancel janji berstatus scheduled atau checked_in' });
        }

        const updated = await Appointment.findByIdAndUpdate(
            req.params.id,
            { $set: { status: 'cancelled_by_admin', cancelReason: reason, cancelledBy: 'admin', cancelledAt: new Date() } },
            { new: true }
        );

        // Notif user & dokter
        await createNotification({
            userId  : appointment.userId._id,
            type    : 'appointment_reminder',
            title   : '❌ Janji Temu Dibatalkan Admin',
            message : `Janji temu Anda pada pukul ${appointment.appointmentTime} WIB dibatalkan oleh admin. Alasan: ${reason}`,
            data    : { appointmentId: appointment._id },
            io      : req.app.get('io'),
        });
        if (appointment.doctorId?.userId) {
            await createNotification({
                userId  : appointment.doctorId.userId,
                type    : 'appointment_reminder',
                title   : '❌ Janji Temu Dibatalkan Admin',
                message : `Janji temu pasien ${appointment.userId?.name} pukul ${appointment.appointmentTime} WIB dibatalkan oleh admin. Alasan: ${reason}`,
                data    : { appointmentId: appointment._id },
                io      : req.app.get('io'),
            });
        }

        res.json({ success: true, appointment: updated });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// ── GET /:id — detail satu appointment ────────────────────────────────────────
router.get('/:id', auth, async (req, res) => {
    try {
        const appointment = await Appointment.findById(req.params.id)
            .populate('userId',   'name email phone')
            .populate('doctorId', 'name specialization photo userId');
        if (!appointment) return res.status(404).json({ message: 'Janji tidak ditemukan' });

        // Akses: user terkait, dokter terkait, atau admin
        const isOwner  = appointment.userId._id.toString() === req.userId;
        const isAdmin  = req.userRole === 'admin';
        const docUserId = appointment.doctorId?.userId?.toString();
        const isDocOwner = docUserId === req.userId;

        if (!isOwner && !isAdmin && !isDocOwner) return res.status(403).json({ message: 'Akses ditolak' });

        res.json({ success: true, appointment });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;