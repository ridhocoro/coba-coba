const fmtDoctorName = require('../utils/fmtDoctorName');
/**
 * routes/appointments.js — Janji Temu Offline
 */

const express  = require('express');
const router   = express.Router();
const { classifyKeluhan } = require('../utils/mlService');

const Appointment             = require('../models/Appointment');
const AppointmentAvailability = require('../models/AppointmentAvailability');
const DoctorAvailability      = require('../models/DoctorAvailability');
const { Doctor, User }        = require('../models/mysql');
const auth                    = require('../middleware/auth');
const doctorAuth              = require('../middleware/doctorAuth');
const { createNotification }  = require('../utils/notificationHelper');
const { populateFromMySQL }   = require('../utils/hybridJoin');
const { safeGet, safeSet }    = require('../config/redis');
const SickLetter              = require('../models/SickLetter');
const ReferralLetter          = require('../models/ReferralLetter');
const PDFDocument             = require('pdfkit');
const https                   = require('https');
const http                    = require('http');

// ── PDF Helpers for Appointment Letters ──────────────────────────────────────
const fetchImageBufferAppt = (fileUrl) => {
    return new Promise((resolve) => {
        if (!fileUrl) return resolve(null);
        try {
            const url  = new URL(fileUrl);
            const lib  = url.protocol === 'https:' ? https : http;
            const chunks = [];
            const req2 = lib.get(fileUrl, (r) => {
                if (r.statusCode !== 200) return resolve(null);
                r.on('data', c => chunks.push(c));
                r.on('end',  () => resolve(Buffer.concat(chunks)));
            });
            req2.on('error', () => resolve(null));
            req2.setTimeout(5000, () => { req2.destroy(); resolve(null); });
        } catch { resolve(null); }
    });
};
const parseAddressAppt = (fullAddress) => {
    if (!fullAddress) return { street: '', city_province: '' };
    const parts = fullAddress.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length <= 2) return { street: fullAddress, city_province: '' };
    return { street: parts.slice(0, -2).join(', '), city_province: parts.slice(-2).join(', ') };
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const WIB_OFFSET = 7 * 60 * 60 * 1000;

function toUtc(dateStr, timeStr) {
    const [y, mo, d] = dateStr.split('-').map(Number);
    const [hh, mm]   = timeStr.split(':').map(Number);
    const wibMs      = Date.UTC(y, mo - 1, d, hh, mm, 0, 0);
    return new Date(wibMs - WIB_OFFSET);
}

function toDayStr(date) {
    const d = new Date(date.getTime() + WIB_OFFSET);
    return d.toISOString().slice(0, 10);
}

function fmtTgl(date) {
    return new Date(date.getTime() + WIB_OFFSET)
        .toLocaleDateString('id-ID', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
        });
}

function canReschedule(scheduledAt) {
    return new Date(scheduledAt.getTime() - 24 * 60 * 60 * 1000) > new Date();
}

function canCancel(scheduledAt) {
    return new Date(scheduledAt.getTime() - 24 * 60 * 60 * 1000) > new Date();
}

function cancelDeadline(scheduledAt) {
    return new Date(new Date(scheduledAt).getTime() - 24 * 60 * 60 * 1000).toISOString();
}

async function countUserBookingsThisWeek(userId, targetDateStr) {
    const [y, mo, d] = targetDateStr.split('-').map(Number);
    const dow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
    const daysFromMonday = dow === 0 ? -6 : dow - 1;
    const mondayUtc   = new Date(Date.UTC(y, mo - 1, d - daysFromMonday));
    const saturdayUtc = new Date(mondayUtc.getTime() + 5 * 24 * 60 * 60 * 1000);
    const saturdayEnd = new Date(saturdayUtc.getTime() + 24 * 60 * 60 * 1000);

    return Appointment.countDocuments({
        userId,
        appointmentDate : { $gte: mondayUtc, $lt: saturdayEnd },
        status          : { $in: ['scheduled', 'checked_in', 'completed', 'no_show'] },
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// A. DOKTER — AVAILABILITY SETTING
// ═══════════════════════════════════════════════════════════════════════════════

const APPT_ALLOWED_SLOTS = AppointmentAvailability.ALLOWED_SLOTS;
const DAYS_LABEL         = { 1:'Senin', 2:'Selasa', 3:'Rabu', 4:'Kamis', 5:'Jumat', 6:'Sabtu' };

function calcApptWeekRange() {
    const nowWIB = new Date(Date.now() + WIB_OFFSET);
    const dowNum = nowWIB.getUTCDay();

    // Pergantian minggu dilakukan pada hari MINGGU (0)
    const daysToMonday = dowNum === 0 ? 1 : (1 - dowNum);

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

function scheduleToObj(avail) {
    const obj = {};
    for (let d = 1; d <= 6; d++) obj[String(d)] = avail.getSlotsForDay(d);
    return obj;
}

router.get('/doctor/availability', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ where: { userId: req.userId } });
        if (!doctor) return res.status(404).json({ message: 'Profil dokter tidak ditemukan' });

        const avail = await AppointmentAvailability.findOne({ doctorId: doctor.id });
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
                _id:          avail.id,
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

router.put('/doctor/availability', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ where: { userId: req.userId } });
        if (!doctor) return res.status(404).json({ message: 'Profil dokter tidak ditemukan' });

        const { schedule, isActive } = req.body;

        if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) {
            return res.status(400).json({ message: 'Format schedule tidak valid.' });
        }

        if (Array.isArray(schedule['0']) && schedule['0'].length > 0) {
            return res.status(400).json({ message: 'Hari Minggu tidak diizinkan sebagai hari praktik.' });
        }

        const cleanSchedule = normaliseApptSchedule(schedule);
        const totalSlots = Object.values(cleanSchedule).reduce((s, a) => s + a.length, 0);
        if (totalSlots === 0) {
            return res.status(400).json({ message: 'Pilih minimal satu slot pada salah satu hari' });
        }

        const onlineAvail = await DoctorAvailability.findOne({ doctorId: doctor.id });
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
            { doctorId: doctor.id },
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

router.get('/doctors-with-slots', async (req, res) => {
    try {
        // ── Redis cache: 5 menit ──
        const CACHE_KEY = 'cache:doctors-with-slots';
        const cached = await safeGet(CACHE_KEY);
        if (cached) {
            return res.json({ success: true, doctors: JSON.parse(cached), fromCache: true });
        }

        // 1. Ambil SEMUA dokter yang aktif dari MySQL
        const activeDoctors = await Doctor.findAll({
            where: { isActive: true },
            attributes: ['id', 'name', 'specialization', 'photo', 'rating', 'experience',
                         'isActive', 'consultationFee', 'bio', 'totalReviews',
                         'strNumber', 'alumnus', 'practiceLocation', 'titlePrefix', 'titleSuffix'],
            include: [{ model: User, as: 'user', attributes: ['name'] }]
        });

        // 2. Ambil ketersediaan jadwal mingguan dari MongoDB
        const availList = await AppointmentAvailability.find({ isActive: true });
        const availMap = {};
        
        // Cek aman: pastikan doctorId ada sebelum diubah ke string
        availList.forEach(a => { 
            if (a && a.doctorId) {
                availMap[a.doctorId.toString()] = a; 
            }
        });

        // 3. Gabungkan data dan beri penanda (flag) isOffline
        // Ambil semua booking aktif minggu ini untuk cek slot penuh
        const nowUTC = new Date();
        const allBookings = await Appointment.find({
            status: { $in: ['scheduled', 'checked_in', 'completed', 'no_show'] },
        }).select('doctorId appointmentDate appointmentTime').lean();

        // Kelompokkan booking per doctorId
        const bookingsByDoctor = {};
        for (const b of allBookings) {
            const did = b.doctorId ? b.doctorId.toString() : null;
            if (!did) continue;
            if (!bookingsByDoctor[did]) bookingsByDoctor[did] = [];
            bookingsByDoctor[did].push(b);
        }

        const doctors = activeDoctors.map(docRecord => {
            const docData = docRecord.toJSON();
            const docIdStr = docData.id ? docData.id.toString() : '';
            const avail = availMap[docIdStr];
            
            // Dokter dianggap offline jika:
            // 1. Jadwal mingguannya belum dibuat/expired, ATAU
            // 2. Semua slot yang ada sudah booked/lewat/diblokir
            let isOffline = true;
            if (avail && typeof avail.isWeekActive === 'function' && avail.isWeekActive()) {
                // Jadwal masih berlaku — cek apakah masih ada slot available
                const APPT_CUTOFF_MS = 30 * 60 * 1000;
                const docBookings = bookingsByDoctor[docIdStr] || [];
                const bookedSet = new Set(docBookings.map(b => {
                    const dateKey = new Date(b.appointmentDate.getTime() + WIB_OFFSET).toISOString().slice(0, 10);
                    return `${dateKey}|${b.appointmentTime}`;
                }));

                let hasAnyAvailable = false;
                const msPerDay = 24 * 60 * 60 * 1000;
                let cursor = new Date(avail.weekStart.getTime());

                while (cursor <= avail.weekEnd && !hasAnyAvailable) {
                    const cursorWIB = new Date(cursor.getTime() + WIB_OFFSET);
                    const dow = cursorWIB.getUTCDay();
                    if (dow !== 0) {
                        const activeSlots = typeof avail.getSlotsForDay === 'function' ? avail.getSlotsForDay(dow) : [];
                        const dateStr = cursorWIB.toISOString().slice(0, 10);
                        for (const slot of activeSlots) {
                            const [sh, sm] = slot.split(':').map(Number);
                            const [y, mo, d] = dateStr.split('-').map(Number);
                            const slotUTC = new Date(Date.UTC(y, mo - 1, d, sh, sm, 0) - WIB_OFFSET);
                            const isPast = (slotUTC.getTime() - APPT_CUTOFF_MS) <= nowUTC.getTime();
                            const isBooked = bookedSet.has(`${dateStr}|${slot}`);
                            if (!isPast && !isBooked) { hasAnyAvailable = true; break; }
                        }
                    }
                    cursor = new Date(cursor.getTime() + msPerDay);
                }
                isOffline = !hasAnyAvailable;
            }

            const scheduleObj = {};
            if (avail && typeof avail.getSlotsForDay === 'function') {
                for (let d = 1; d <= 6; d++) {
                    scheduleObj[String(d)] = avail.getSlotsForDay(d);
                }
            }

            return {
                doctor: docData,
                availability: {
                    schedule: scheduleObj,
                    allowedSlots: typeof APPT_ALLOWED_SLOTS !== 'undefined' ? APPT_ALLOWED_SLOTS : [],
                    weekStart: avail ? avail.weekStart : null,
                    weekEnd: avail ? avail.weekEnd : null,
                },
                isOffline // ← Flag yang digunakan oleh Frontend
            };
        });

        // Simpan ke Redis 5 menit
        safeSet('cache:doctors-with-slots', JSON.stringify(doctors), 300).catch(() => {});

        res.json({ success: true, doctors });
    } catch (err) {
        console.error('[GET /doctors-with-slots] Error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

router.get('/slots/:doctorId', async (req, res) => {
    try {
        const { doctorId } = req.params;
        const { date } = req.query; // Parameter ini opsional

        const doctor = await Doctor.findByPk(doctorId);
        if (!doctor || !doctor.isActive) return res.status(404).json({ message: 'Dokter tidak ditemukan' });

        const avail = await AppointmentAvailability.findOne({ doctorId: doctor.id, isActive: true });
        if (!avail || !avail.isWeekActive()) {
            return res.json({ success: true, slots: [], notReleased: true, message: 'Dokter belum merilis jadwal untuk minggu ini.' });
        }

        const DoctorScheduleOverride = require('../models/DoctorScheduleOverride');
        const overrides = await DoctorScheduleOverride.find({ doctorId: doctor.id }).lean();
        const blockedDates = new Set(overrides.map(o => o.date));

        const nowUTC   = new Date();
        const msPerDay = 24 * 60 * 60 * 1000;
        const result   = [];

        // Ambil semua booking di minggu berjalan
        const weekBookings = await Appointment.find({
            doctorId        : doctor.id,
            appointmentDate : { $gte: avail.weekStart, $lte: avail.weekEnd },
            status          : { $in: ['scheduled', 'checked_in', 'completed', 'no_show'] },
        }).select('appointmentDate appointmentTime').lean();

        // Kelompokkan booking berdasarkan tanggal
        const bookedByDate = {};
        for (const b of weekBookings) {
            const dateKey = new Date(b.appointmentDate.getTime() + WIB_OFFSET).toISOString().slice(0, 10);
            if (!bookedByDate[dateKey]) bookedByDate[dateKey] = new Set();
            bookedByDate[dateKey].add(b.appointmentTime);
        }

        let cursor = new Date(avail.weekStart.getTime());

        // Looping dari Senin s.d Sabtu
        while (cursor <= avail.weekEnd) {
            const cursorWIB = new Date(cursor.getTime() + WIB_OFFSET);
            const dow       = cursorWIB.getUTCDay();

            if (dow === 0) { cursor = new Date(cursor.getTime() + msPerDay); continue; }

            const activeSlots = avail.getSlotsForDay(dow);
            if (!activeSlots.length) { cursor = new Date(cursor.getTime() + msPerDay); continue; }

            const dateStr = cursorWIB.toISOString().slice(0, 10);

            // Jika dipanggil dengan query ?date, abaikan tanggal yang lain
            if (date && date !== dateStr) {
                cursor = new Date(cursor.getTime() + msPerDay);
                continue;
            }

            const isBlocked = blockedDates.has(dateStr);
            const bookedSet = bookedByDate[dateStr] || new Set();

            for (const slot of activeSlots) {
                const [sh, sm] = slot.split(':').map(Number);
                const [y, mo, d] = dateStr.split('-').map(Number);
                const slotUTC  = new Date(Date.UTC(y, mo - 1, d, sh, sm, 0) - WIB_OFFSET);
                
                const APPT_CUTOFF_MS = 30 * 60 * 1000;
                const isPast   = (slotUTC.getTime() - APPT_CUTOFF_MS) <= nowUTC.getTime();
                const isBooked = bookedSet.has(slot);
                
                const endMin   = sh * 60 + sm + 30;
                const endTime  = `${String(Math.floor(endMin/60)).padStart(2,'0')}:${String(endMin%60).padStart(2,'0')}`;
                
                result.push({
                    date:      dateStr,
                    startTime: slot,
                    endTime:   endTime,
                    startUtc:  slotUTC.toISOString(),
                    available: !isPast && !isBooked && !isBlocked,
                    isPast,
                    isBooked,
                    isBlocked,
                    blockReason: isBlocked ? (overrides.find(o => o.date === dateStr)?.reason || 'Dokter tidak hadir') : undefined,
                });
            }

            cursor = new Date(cursor.getTime() + msPerDay);
        }

        // Jika frontend cari date spesifik tapi tidak ketemu (karena di luar range)
        if (date && result.length === 0) {
            const weekStartStr = new Date(avail.weekStart.getTime() + WIB_OFFSET).toISOString().slice(0, 10);
            const weekEndStr   = new Date(avail.weekEnd.getTime()   + WIB_OFFSET).toISOString().slice(0, 10);
            if (date < weekStartStr || date > weekEndStr) {
                 return res.json({ success: true, slots: [], message: 'Tanggal di luar rentang jadwal minggu ini.' });
            }
        }

        res.json({ success: true, slots: result, date });
    } catch (err) {
        console.error('[GET /appointments/slots]', err.message);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// C. USER — BOOKING, LIST, CANCEL, RESCHEDULE
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/book', auth, async (req, res) => {
    try {
        if (!['user', 'mahasiswa'].includes(req.userRole)) return res.status(403).json({ message: 'Hanya user/mahasiswa yang bisa booking' });

        const { doctorId, date, time, complaint } = req.body;
        if (!doctorId || !date || !time) {
            return res.status(400).json({ message: 'doctorId, date, dan time wajib diisi' });
        }

        const [bdy, bdmo, bdd] = date.split('-').map(Number);
        const bdow = new Date(Date.UTC(bdy, bdmo - 1, bdd)).getUTCDay();
        if (bdow === 0) return res.status(400).json({ message: 'Janji temu tidak tersedia hari Minggu.' });

        const nowWib   = new Date(Date.now() + WIB_OFFSET);
        const todayStr = nowWib.toISOString().slice(0, 10);

        if (date < todayStr) return res.status(400).json({ message: 'Tidak bisa booking tanggal yang sudah lewat' });

        const [bsh, bsm] = time.split(':').map(Number);
        const [bdy2, bdmo2, bdd2] = date.split('-').map(Number);
        const slotUtcMs = new Date(Date.UTC(bdy2, bdmo2 - 1, bdd2, bsh, bsm, 0) - WIB_OFFSET).getTime();
        if (slotUtcMs - Date.now() < 30 * 60 * 1000) {
            return res.status(400).json({ message: 'Pemesanan harus dilakukan minimal 30 menit sebelum jadwal' });
        }

        const doctor = await Doctor.findByPk(doctorId);
        if (!doctor || !doctor.isActive) return res.status(404).json({ message: 'Dokter tidak ditemukan atau tidak aktif' });

        const DoctorScheduleOverride = require('../models/DoctorScheduleOverride');
        const override = await DoctorScheduleOverride.findOne({ doctorId: doctor.id, date });
        if (override) {
            return res.status(400).json({ message: `Dokter tidak hadir pada tanggal ini. ${override.reason || ''}`.trim() });
        }

        const avail = await AppointmentAvailability.findOne({ doctorId: doctor.id, isActive: true });
        if (!avail || !avail.isWeekActive()) {
            return res.status(400).json({ message: 'Dokter belum merilis jadwal untuk minggu ini.' });
        }

        const weekStartStr = new Date(avail.weekStart.getTime() + WIB_OFFSET).toISOString().slice(0, 10);
        const weekEndStr   = new Date(avail.weekEnd.getTime()   + WIB_OFFSET).toISOString().slice(0, 10);
        if (date < weekStartStr || date > weekEndStr) {
            return res.status(400).json({ message: 'Tanggal di luar rentang jadwal minggu ini.' });
        }

        const [y2, mo2, d2] = date.split('-').map(Number);
        const dow2 = new Date(Date.UTC(y2, mo2 - 1, d2)).getUTCDay();
        if (!avail.isSlotActive(dow2, time)) {
            return res.status(400).json({ message: 'Slot waktu tidak tersedia pada hari tersebut. Silakan pilih dari slot yang tersedia.' });
        }

        const weekCount = await countUserBookingsThisWeek(req.userId, date);
        if (weekCount >= 2) {
            return res.status(400).json({ message: 'Anda sudah memiliki 2 janji temu aktif minggu ini (batas maksimal)' });
        }

        const [y, mo, d] = date.split('-').map(Number);
        const dayStart   = new Date(Date.UTC(y, mo - 1, d));
        const dayEnd     = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

        const conflict = await Appointment.findOne({
            doctorId        : doctor.id,
            appointmentDate : { $gte: dayStart, $lt: dayEnd },
            appointmentTime : time,
            status          : { $in: ['scheduled', 'checked_in', 'completed', 'no_show'] },
        });
        if (conflict) {
            return res.status(409).json({ message: 'Slot ini baru saja diambil orang lain. Silakan pilih slot lain.' });
        }

        const [sh, sm] = time.split(':').map(Number);
        const endMin   = sh * 60 + sm + 30;
        const endTime  = `${String(Math.floor(endMin / 60)).padStart(2,'0')}:${String(endMin % 60).padStart(2,'0')}`;
        const scheduledAt = toUtc(date, time);

        const appointment = new Appointment({
            userId          : req.userId,
            doctorId        : doctor.id,
            appointmentDate : dayStart,
            appointmentTime : time,
            endTime,
            scheduledAt,
            complaint       : complaint || '',
            status          : 'scheduled',
        });

        await appointment.save();

        // ── Klasifikasi penyakit ML (async, tidak blocking response) ──
       if (complaint) {
            const { User } = require('../models/mysql');
            User.findOne({ where: { id: req.userId } })
                .then(u => classifyKeluhan(complaint, u?.gender || null))
                .then(async (result) => {
                    if (result) {
                        await Appointment.findByIdAndUpdate(appointment._id, {
                            disease_category:    result.kategori,
                            category_confidence: result.confidence,
                            category_method:     result.metode,
                        });
                    }
                })
                .catch(err => console.error('[ML classify appointment]', err.message));
        }
        // ── End ML ────────────────────────────────────────────────────

        await createNotification({
            userId  : req.userId,
            type    : 'appointment_reminder',
            title   : '✅ Janji Temu Terkonfirmasi',
            message : `Janji temu Anda dengan ${fmtDoctorName(doctor)} pada ${fmtTgl(scheduledAt)} pukul ${time} WIB berhasil dibuat.`,
            data    : { appointmentId: appointment.id },
            io      : req.app.get('io'),
        });

        if (doctor.userId) {
            const user = await User.findByPk(req.userId, { attributes: ['id', 'name'] });
            await createNotification({
                userId  : doctor.userId,
                type    : 'appointment_reminder',
                title   : '📅 Janji Temu Baru',
                message : `${user?.name || 'Pasien'} membuat janji temu pada ${fmtTgl(scheduledAt)} pukul ${time} WIB.`,
                data    : { appointmentId: appointment.id },
                io      : req.app.get('io'),
            });
        }

        const apptObj = appointment.toObject();
        const populated = await populateFromMySQL(apptObj, 'doctorId', 'Doctor', 'name specialization photo userId titlePrefix titleSuffix');
        const populated2 = await populateFromMySQL(populated, 'userId', 'User', 'name email phone');

        // Invalidasi cache slot dokter setelah booking baru ─ supaya slot terpesan langsung terupdate
        safeSet('cache:doctors-with-slots', '', 1).catch(() => {});

        res.json({ success: true, appointment: populated2 });
    } catch (err) {
        console.error('[appointments/book]', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

const getMyAppointments = async (req, res) => {
    try {
        let appointments = await Appointment.find({ userId: req.userId })
            .sort({ scheduledAt: -1 })
            .populate({ path: 'sickLetter',     select: 'letterNumber diagnosis status startDate endDate issuedAt notes' })
            .populate({ path: 'referralLetter', select: 'letterNumber diagnosis status referralTo referralSpecialty referralReason notes issuedAt' })
            .lean();

        appointments = await populateFromMySQL(
            appointments, 'doctorId', 'Doctor', 'name specialization photo userId titlePrefix titleSuffix'
        );

        const doctorIds = [...new Set(
            appointments.map(a => {
                const docId = a.doctorId;
                if (docId && typeof docId === 'object') return docId.id?.toString();
                return docId?.toString();
            }).filter(Boolean)
        )];

        const availList = await AppointmentAvailability.find({ doctorId: { $in: doctorIds } })
            .select('doctorId schedule weekStart weekEnd isActive');

        const availMap = {};
        availList.forEach(av => {
            const schedObj = {};
            for (let d = 1; d <= 6; d++) schedObj[String(d)] = av.getSlotsForDay(d);
            availMap[av.doctorId.toString()] = {
                schedule  : schedObj,
                weekStart : av.weekStart,
                weekEnd   : av.weekEnd,
                isActive  : av.isActive,
            };
        });

        const withDeadline = appointments.map(a => {
            const obj = { ...a }; 
            if (a.scheduledAt) {
                obj.cancelDeadline = cancelDeadline(a.scheduledAt);
            }
            const docId = a.doctorId && typeof a.doctorId === 'object'
                ? a.doctorId.id?.toString()
                : a.doctorId?.toString();
            if (docId && availMap[docId]) {
                obj.doctorId = { ...obj.doctorId, availability: availMap[docId] };
            }
            return obj;
        });

        res.json({ success: true, appointments: withDeadline });
    } catch (err) {
        console.error('[appointments/my]', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

router.get('/my', auth, getMyAppointments);
router.get('/my-appointments', auth, getMyAppointments);

router.put('/:id/cancel', auth, async (req, res) => {
    try {
        const { reason } = req.body;
        if (!reason || reason.trim().length < 5) {
            return res.status(400).json({ message: 'Alasan pembatalan wajib diisi (minimal 5 karakter)' });
        }

        const apptLean = await Appointment.findById(req.params.id).lean();
        if (!apptLean) return res.status(404).json({ message: 'Janji tidak ditemukan' });

        const apptPopulated = await populateFromMySQL(
            { ...apptLean }, 'doctorId', 'Doctor', 'name specialization photo userId titlePrefix titleSuffix'
        );

        if (apptLean.userId?.toString() !== req.userId) return res.status(403).json({ message: 'Akses ditolak' });
        if (apptLean.status !== 'scheduled') return res.status(400).json({ message: `Tidak bisa dibatalkan — status saat ini: ${apptLean.status}` });

        if (!canCancel(apptLean.scheduledAt)) {
            return res.status(400).json({ message: 'Tidak bisa membatalkan janji kurang dari 24 jam sebelum jadwal' });
        }

        const updated = await Appointment.findOneAndUpdate(
            { _id: req.params.id, status: 'scheduled' },
            { $set: { status: 'cancelled_by_user', cancelReason: reason, cancelledBy: 'user', cancelledAt: new Date() } },
            { new: true }
        );
        if (!updated) return res.status(409).json({ message: 'Status berubah, silakan refresh' });

        const doctorInfo = apptPopulated.doctorId;
        if (doctorInfo?.userId) {
            const user = await User.findByPk(req.userId, { attributes: ['id', 'name'] });
            await createNotification({
                userId  : doctorInfo.userId,
                type    : 'appointment_reminder',
                title   : '❌ Janji Temu Dibatalkan',
                message : `${user?.name || 'Pasien'} membatalkan janji pukul ${apptLean.appointmentTime} WIB. Alasan: ${reason}`,
                data    : { appointmentId: updated.id },
                io      : req.app.get('io'),
            });
        }

        res.json({ success: true, appointment: updated });
    } catch (err) {
        console.error('[appointments/cancel]', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

router.put('/:id/reschedule', auth, async (req, res) => {
    try {
        const { date, time } = req.body;
        if (!date || !time) return res.status(400).json({ message: 'date dan time baru wajib diisi' });

        const apptLean = await Appointment.findById(req.params.id).lean();
        if (!apptLean) return res.status(404).json({ message: 'Janji tidak ditemukan' });

        const apptPopulated = await populateFromMySQL(
            { ...apptLean }, 'doctorId', 'Doctor', 'name specialization photo userId titlePrefix titleSuffix'
        );

        if (apptLean.userId?.toString() !== req.userId) return res.status(403).json({ message: 'Akses ditolak' });
        if (apptLean.status !== 'scheduled') return res.status(400).json({ message: 'Hanya bisa reschedule janji dengan status scheduled' });

        if (!canReschedule(apptLean.scheduledAt)) {
            return res.status(400).json({ message: 'Reschedule hanya bisa dilakukan minimal 24 jam sebelum jadwal' });
        }

        if ((apptLean.rescheduleCount || 0) >= 1) {
            return res.status(400).json({ message: 'Reschedule hanya bisa dilakukan 1 kali.' });
        }

        const [rdy, rdmo, rdd] = date.split('-').map(Number);
        const rdow0 = new Date(Date.UTC(rdy, rdmo - 1, rdd)).getUTCDay();
        if (rdow0 === 0) return res.status(400).json({ message: 'Janji temu tidak tersedia hari Minggu.' });

        const nowWib   = new Date(Date.now() + WIB_OFFSET);
        const todayStr = nowWib.toISOString().slice(0, 10);
        if (date < todayStr) return res.status(400).json({ message: 'Tidak bisa memilih tanggal yang sudah lewat' });

        const [rsh, rsm] = time.split(':').map(Number);
        const [rdy2, rdmo2, rdd2] = date.split('-').map(Number);
        const rSlotUtcMs = new Date(Date.UTC(rdy2, rdmo2 - 1, rdd2, rsh, rsm, 0) - WIB_OFFSET).getTime();
        if (rSlotUtcMs - Date.now() < 30 * 60 * 1000) {
            return res.status(400).json({ message: 'Pemesanan harus dilakukan minimal 30 menit sebelum jadwal' });
        }

        const doctorId = apptPopulated.doctorId?.id || apptLean.doctorId?.toString();

        const avail = await AppointmentAvailability.findOne({ doctorId, isActive: true });
        if (!avail || !avail.isWeekActive()) {
            return res.status(400).json({ message: 'Dokter belum merilis jadwal untuk minggu ini.' });
        }

        const weekStartStr = new Date(avail.weekStart.getTime() + WIB_OFFSET).toISOString().slice(0, 10);
        const weekEndStr   = new Date(avail.weekEnd.getTime()   + WIB_OFFSET).toISOString().slice(0, 10);
        if (date < weekStartStr || date > weekEndStr) {
            return res.status(400).json({ message: 'Tanggal di luar rentang jadwal minggu ini.' });
        }

        const [ry, rmo, rd] = date.split('-').map(Number);
        const rdow = new Date(Date.UTC(ry, rmo - 1, rd)).getUTCDay();
        if (!avail.isSlotActive(rdow, time)) {
            return res.status(400).json({ message: 'Slot tidak tersedia pada hari tersebut' });
        }

        const [y, mo, d] = date.split('-').map(Number);
        const dayStart   = new Date(Date.UTC(y, mo - 1, d));
        const dayEnd     = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        
        const conflict   = await Appointment.findOne({
            doctorId        : doctorId,
            appointmentDate : { $gte: dayStart, $lt: dayEnd },
            appointmentTime : time,
            status          : { $in: ['scheduled', 'checked_in', 'completed', 'no_show'] },
            _id             : { $ne: apptLean._id },
        });
        if (conflict) return res.status(409).json({ message: 'Slot baru sudah diambil orang lain' });

        const [sh, sm]  = time.split(':').map(Number);
        const endMin    = sh * 60 + sm + 30;
        const endTime   = `${String(Math.floor(endMin/60)).padStart(2,'0')}:${String(endMin%60).padStart(2,'0')}`;
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
                        appointmentDate : apptLean.appointmentDate,
                        appointmentTime : apptLean.appointmentTime,
                        scheduledAt     : apptLean.scheduledAt,
                    },
                },
                $inc: { rescheduleCount: 1 },
                $push: {
                    rescheduleHistory: {
                        from: {
                            appointmentDate : apptLean.appointmentDate,
                            appointmentTime : apptLean.appointmentTime,
                            scheduledAt     : apptLean.scheduledAt,
                        },
                        to: { appointmentDate: dayStart, appointmentTime: time, scheduledAt },
                        rescheduledAt : new Date(),
                    },
                },
            },
            { new: true }
        );

        const doctorInfo = apptPopulated.doctorId;
        await createNotification({
            userId  : req.userId,
            type    : 'appointment_reminder',
            title   : '🔄 Jadwal Diubah',
            message : `Janji temu Anda dengan ${fmtDoctorName(doctorInfo)} diubah ke ${fmtTgl(scheduledAt)} pukul ${time} WIB.`,
            data    : { appointmentId: updated.id },
            io      : req.app.get('io'),
        });
        if (doctorInfo?.userId) {
            const user = await User.findByPk(req.userId, { attributes: ['id', 'name'] });
            await createNotification({
                userId  : doctorInfo.userId,
                type    : 'appointment_reminder',
                title   : '🔄 Pasien Reschedule',
                message : `${user?.name || 'Pasien'} mengubah jadwal ke ${fmtTgl(scheduledAt)} pukul ${time} WIB.`,
                data    : { appointmentId: updated.id },
                io      : req.app.get('io'),
            });
        }

        res.json({ success: true, appointment: updated });
    } catch (err) {
        console.error('[appointments/reschedule]', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// D. DOKTER — KELOLA JANJI
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/doctor/list', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ where: { userId: req.userId } });
        if (!doctor) return res.status(404).json({ message: 'Profil dokter tidak ditemukan' });

        const { date, status } = req.query;
        const query = { doctorId: doctor.id };

        if (status && status !== 'all') query.status = status;
        if (date) {
            const [y, mo, d] = date.split('-').map(Number);
            const ds = new Date(Date.UTC(y, mo - 1, d));
            query.appointmentDate = { $gte: ds, $lt: new Date(ds.getTime() + 24*60*60*1000) };
        }

        let appointments = await Appointment.find(query).sort({ scheduledAt: 1 })
            .populate({ path: 'sickLetter',     select: 'letterNumber diagnosis status startDate endDate issuedAt patientAge patientGender patientWeight notes' })
            .populate({ path: 'referralLetter', select: 'letterNumber diagnosis status referralTo referralSpecialty referralReason notes issuedAt patientAge patientGender patientWeight' })
            .lean();
        appointments = await populateFromMySQL(appointments, 'userId', 'User', 'name email phone');

        res.json({ success: true, appointments });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.put('/doctor/:id/checkin', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ where: { userId: req.userId } });
        if (!doctor) return res.status(404).json({ message: 'Profil dokter tidak ditemukan' });

        const appointment = await Appointment.findById(req.params.id).lean();
        if (!appointment) return res.status(404).json({ message: 'Janji tidak ditemukan' });
        if (appointment.doctorId.toString() !== doctor.id.toString()) return res.status(403).json({ message: 'Akses ditolak' });
        if (appointment.status !== 'scheduled') return res.status(400).json({ message: `Status harus scheduled, saat ini: ${appointment.status}` });

        const updated = await Appointment.findOneAndUpdate(
            { _id: req.params.id, status: 'scheduled' },
            { $set: { status: 'checked_in', checkedInAt: new Date() } },
            { new: true }
        );
        if (!updated) return res.status(409).json({ message: 'Status berubah, silakan refresh' });

        await createNotification({
            userId  : appointment.userId.toString(),
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

router.put('/doctor/:id/complete', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ where: { userId: req.userId } });
        if (!doctor) return res.status(404).json({ message: 'Profil dokter tidak ditemukan' });

        const appointment = await Appointment.findById(req.params.id).lean();
        if (!appointment) return res.status(404).json({ message: 'Janji tidak ditemukan' });
        if (appointment.doctorId.toString() !== doctor.id.toString()) return res.status(403).json({ message: 'Akses ditolak' });
        if (appointment.status !== 'checked_in') return res.status(400).json({ message: `Status harus checked_in, saat ini: ${appointment.status}` });

        const { notes, assessment, plan, objectiveFindings } = req.body;

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
                    status        : 'completed',
                    completedAt   : new Date(),
                    doctorNotes   : notes || assessment.trim(),
                    medicalRecord : {
                        objectiveFindings : objectiveFindings?.trim() || '',
                        assessment        : assessment.trim(),
                        plan              : plan.trim(),
                        doctorNotes       : notes?.trim() || '',
                        isCompleted       : true,
                        completedAt       : new Date(),
                    },
                },
            },
            { new: true }
        );
        if (!updated) return res.status(409).json({ message: 'Status berubah, silakan refresh' });

        await createNotification({
            userId  : appointment.userId.toString(),
            type    : 'appointment_reminder',
            title   : '✅ Janji Temu Selesai',
            message : `Janji temu Anda dengan ${fmtDoctorName(doctor)} telah selesai. Rekam medis tersedia.`,
            data    : { appointmentId: appointment._id },
            io      : req.app.get('io'),
        });

        res.json({ success: true, appointment: updated });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

router.put('/doctor/:id/cancel', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ where: { userId: req.userId } });
        if (!doctor) return res.status(404).json({ message: 'Profil dokter tidak ditemukan' });

        const { reason } = req.body;
        if (!reason || reason.trim().length < 5) return res.status(400).json({ message: 'Alasan pembatalan wajib diisi' });

        const appointment = await Appointment.findById(req.params.id).lean();
        if (!appointment) return res.status(404).json({ message: 'Janji tidak ditemukan' });
        if (appointment.doctorId.toString() !== doctor.id.toString()) return res.status(403).json({ message: 'Akses ditolak' });
        if (appointment.status !== 'scheduled') return res.status(400).json({ message: 'Hanya bisa cancel janji berstatus scheduled' });

        if (!canCancel(appointment.scheduledAt)) {
            return res.status(400).json({ message: 'Tidak bisa membatalkan janji kurang dari 24 jam sebelum jadwal' });
        }

        const updated = await Appointment.findOneAndUpdate(
            { _id: req.params.id, status: 'scheduled' },
            { $set: { status: 'cancelled_by_doctor', cancelReason: reason, cancelledBy: 'doctor', cancelledAt: new Date() } },
            { new: true }
        );
        if (!updated) return res.status(409).json({ message: 'Status berubah, silakan refresh' });

        await createNotification({
            userId  : appointment.userId.toString(),
            type    : 'appointment_reminder',
            title   : '❌ Janji Temu Dibatalkan Dokter',
            message : `Maaf, janji temu Anda dengan ${fmtDoctorName(doctor)} pada pukul ${appointment.appointmentTime} WIB dibatalkan. Alasan: ${reason}`,
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

router.get('/admin/today', auth, adminOnly, async (req, res) => {
    try {
        const nowWib   = new Date(Date.now() + WIB_OFFSET);
        const todayStr = nowWib.toISOString().slice(0, 10);
        const [y, mo, d] = todayStr.split('-').map(Number);
        const dayStart = new Date(Date.UTC(y, mo - 1, d));
        const dayEnd   = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

        let appointments = await Appointment.find({
            appointmentDate : { $gte: dayStart, $lt: dayEnd },
        }).sort({ appointmentTime: 1 }).lean();

        appointments = await populateFromMySQL(appointments, 'userId',   'User',   'name email phone');
        appointments = await populateFromMySQL(appointments, 'doctorId', 'Doctor', 'name specialization titlePrefix titleSuffix');

        res.json({ success: true, appointments, date: todayStr });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

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

        let appointments, total;

        if (search) {
            let all = await Appointment.find(query).sort({ scheduledAt: -1 }).lean();
            all = await populateFromMySQL(all, 'doctorId', 'Doctor', 'name specialization photo userId titlePrefix titleSuffix');
            all = await populateFromMySQL(all, 'userId',   'User',   'name email phone');

            const s = search.toLowerCase();
            const filtered = all.filter(a =>
                a.userId?.name?.toLowerCase().includes(s) ||
                a.doctorId?.name?.toLowerCase().includes(s) ||
                a.userId?.phone?.includes(s)
            );
            total        = filtered.length;
            const start  = (Number(page) - 1) * Number(limit);
            appointments = filtered.slice(start, start + Number(limit));
        } else {
            total = await Appointment.countDocuments(query);
            appointments = await Appointment.find(query)
                .sort({ scheduledAt: -1 })
                .skip((Number(page) - 1) * Number(limit))
                .limit(Number(limit))
                .lean();
        }

        res.json({ success: true, appointments, total, page: Number(page), limit: Number(limit) });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

router.get('/admin/report', auth, adminOnly, async (req, res) => {
    try {
        const { from, to } = req.query;
        const nowWib = new Date(Date.now() + WIB_OFFSET);

        const toDate   = to   ? new Date(to)   : new Date(nowWib.toISOString().slice(0,10));
        const fromDate = from ? new Date(from) : new Date(toDate.getTime() - 6 * 24 * 60 * 60 * 1000);

        const appointments = await Appointment.find({
            appointmentDate : { $gte: fromDate, $lte: new Date(toDate.getTime() + 24*60*60*1000) },
        }).lean();

        const populated = await populateFromMySQL(appointments, 'doctorId', 'Doctor', 'name titlePrefix titleSuffix');

        const byDay = {};
        for (const a of populated) {
            const dayStr = toDayStr(a.appointmentDate);
            if (!byDay[dayStr]) byDay[dayStr] = { total: 0, completed: 0, no_show: 0, cancelled: 0, scheduled: 0 };
            byDay[dayStr].total++;
            if (a.status === 'completed') byDay[dayStr].completed++;
            else if (a.status === 'no_show') byDay[dayStr].no_show++;
            else if (['cancelled_by_user','cancelled_by_doctor','cancelled_by_admin'].includes(a.status)) byDay[dayStr].cancelled++;
            else if (a.status === 'scheduled') byDay[dayStr].scheduled++;
        }

        const byDoctor = {};
        for (const a of populated) {
            const name = a.doctorId?.name || 'Unknown';
            if (!byDoctor[name]) byDoctor[name] = { total: 0, completed: 0, no_show: 0 };
            byDoctor[name].total++;
            if (a.status === 'completed') byDoctor[name].completed++;
            if (a.status === 'no_show')   byDoctor[name].no_show++;
        }

        const total      = populated.length;
        const completed  = populated.filter(a => a.status === 'completed').length;
        const noShow     = populated.filter(a => a.status === 'no_show').length;
        const noShowRate = total > 0 ? Math.round((noShow / total) * 100) : 0;

        res.json({
            success : true,
            summary : { total, completed, no_show: noShow, noShowRate },
            byDay,
            byDoctor,
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.put('/admin/:id/checkin', auth, adminOnly, async (req, res) => {
    try {
        const appointment = await Appointment.findById(req.params.id).lean();
        if (!appointment) return res.status(404).json({ message: 'Janji tidak ditemukan' });
        if (appointment.status !== 'scheduled') return res.status(400).json({ message: `Status harus scheduled, saat ini: ${appointment.status}` });

        const updated = await Appointment.findOneAndUpdate(
            { _id: req.params.id, status: 'scheduled' },
            { $set: { status: 'checked_in', checkedInAt: new Date() } },
            { new: true }
        );

        await createNotification({
            userId  : appointment.userId.toString(),
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

router.put('/admin/:id/override', auth, adminOnly, async (req, res) => {
    try {
        const { status, reason } = req.body;
        const allowed = ['scheduled','checked_in','completed','no_show','cancelled_by_admin'];
        if (!allowed.includes(status)) {
            return res.status(400).json({ message: `Status tidak valid. Pilih: ${allowed.join(', ')}` });
        }

        const update = { status };
        if (reason) update.cancelReason = reason;
        if (status === 'checked_in')         update.checkedInAt  = new Date();
        if (status === 'completed')          update.completedAt  = new Date();
        if (status === 'no_show')            update.noShowAt     = new Date();
        if (status === 'cancelled_by_admin') { update.cancelledBy = 'admin'; update.cancelledAt = new Date(); }

        const updated = await Appointment.findByIdAndUpdate(
            req.params.id, { $set: update }, { new: true }
        );
        if (!updated) return res.status(404).json({ message: 'Janji tidak ditemukan' });

        res.json({ success: true, appointment: updated });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

router.put('/admin/:id/cancel', auth, adminOnly, async (req, res) => {
    try {
        const { reason } = req.body;
        if (!reason || reason.trim().length < 5) return res.status(400).json({ message: 'Alasan pembatalan wajib diisi' });

        const appointment = await Appointment.findById(req.params.id).lean();
        if (!appointment) return res.status(404).json({ message: 'Janji tidak ditemukan' });
        if (!['scheduled', 'checked_in'].includes(appointment.status)) {
            return res.status(400).json({ message: 'Hanya bisa cancel janji berstatus scheduled atau checked_in' });
        }

        const updated = await Appointment.findByIdAndUpdate(
            req.params.id,
            { $set: { status: 'cancelled_by_admin', cancelReason: reason, cancelledBy: 'admin', cancelledAt: new Date() } },
            { new: true }
        );

        await createNotification({
            userId  : appointment.userId.toString(),
            type    : 'appointment_reminder',
            title   : '❌ Janji Temu Dibatalkan Admin',
            message : `Janji temu Anda pada pukul ${appointment.appointmentTime} WIB dibatalkan oleh admin. Alasan: ${reason}`,
            data    : { appointmentId: appointment._id },
            io      : req.app.get('io'),
        });

        res.json({ success: true, appointment: updated });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// ── GET /:id — detail satu appointment ────────────────────────────────────────
router.get('/:id', auth, async (req, res) => {
    try {
        const apptLean = await Appointment.findById(req.params.id).lean();
        if (!apptLean) return res.status(404).json({ message: 'Janji tidak ditemukan' });

        const appt = await populateFromMySQL({ ...apptLean }, 'doctorId', 'Doctor', 'name specialization photo userId titlePrefix titleSuffix');
        await populateFromMySQL(appt, 'userId', 'User', 'name email phone');

        const isOwner    = appt.userId?.id?.toString() === req.userId || apptLean.userId?.toString() === req.userId;
        const isAdmin    = req.userRole === 'admin';
        const docUserId  = appt.doctorId?.userId?.toString();
        const isDocOwner = docUserId === req.userId;

        if (!isOwner && !isAdmin && !isDocOwner) return res.status(403).json({ message: 'Akses ditolak' });

        res.json({ success: true, appointment: appt });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});
// ── POST /:id/rating — Memberikan rating janji temu ──────────────────────────
router.post('/:id/rating', auth, async (req, res) => {
    try {
        const { rating } = req.body;
        
        // Validasi input rating (harus 1 sampai 5)
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ message: 'Rating harus berupa angka antara 1 dan 5' });
        }

        // Cari appointment di MongoDB
        const appointment = await Appointment.findById(req.params.id);
        if (!appointment) return res.status(404).json({ message: 'Janji tidak ditemukan' });

        // Pastikan hanya pasien yang bersangkutan yang bisa memberi rating
        if (appointment.userId.toString() !== req.userId) {
            return res.status(403).json({ message: 'Akses ditolak' });
        }

        // Pastikan statusnya valid untuk diberi rating
        const allowedStatus = ['completed', 'doctor_no_show', 'cancelled_by_doctor', 'cancelled_by_admin'];
        if (!allowedStatus.includes(appointment.status)) {
            return res.status(400).json({ message: 'Janji temu ini belum bisa diberikan rating' });
        }

        // Pastikan belum pernah diberi rating sebelumnya
        if (appointment.rating) {
            return res.status(400).json({ message: 'Anda sudah memberikan rating untuk janji temu ini' });
        }

        // 1. Simpan rating ke dokumen Appointment
        appointment.rating = rating;
        await appointment.save();

        // 2. Update rata-rata rating & total ulasan Dokter di MySQL
        const doc = await Doctor.findByPk(appointment.doctorId);
        if (doc) {
            const currentRating = parseFloat(doc.rating) || 0;
            const currentTotalReviews = parseInt(doc.totalReviews) || 0;
            
            const newTotalReviews = currentTotalReviews + 1;
            // Rumus incremental average
            const newRating = ((currentRating * currentTotalReviews) + rating) / newTotalReviews;

            doc.rating = newRating.toFixed(2); // Simpan 2 angka desimal
            doc.totalReviews = newTotalReviews;
            await doc.save();
        }

        res.json({ success: true, message: 'Rating berhasil disimpan', appointment });
    } catch (err) {
        console.error('[POST /appointments/:id/rating]', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});


// ═══════════════════════════════════════════════════════════════════════════════
// SURAT SAKIT — JANJI TEMU
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/appointments/doctor/:id/sick-letter
router.post('/doctor/:id/sick-letter', auth, doctorAuth, async (req, res) => {
    try {
        const { diagnosis, restDays, notes, patientAge, patientGender, patientWeight } = req.body;
        if (!diagnosis || !restDays) return res.status(400).json({ message: 'Diagnosis dan hari istirahat wajib diisi' });

        const doctor = await Doctor.findOne({ where: { userId: req.userId } });
        if (!doctor) return res.status(404).json({ message: 'Profil dokter tidak ditemukan' });

        const appt = await Appointment.findById(req.params.id);
        if (!appt) return res.status(404).json({ message: 'Janji temu tidak ditemukan' });
        if (appt.doctorId.toString() !== doctor.id.toString()) return res.status(403).json({ message: 'Akses ditolak' });
        if (!['checked_in', 'completed'].includes(appt.status)) return res.status(400).json({ message: 'Janji harus dalam status check-in atau selesai' });

        const existing = await SickLetter.findOne({ appointmentId: req.params.id });
        if (existing) return res.status(400).json({ message: 'Surat sakit sudah dibuat untuk janji ini' });

        const startDate = new Date();
        const endDate   = new Date();
        endDate.setDate(endDate.getDate() + parseInt(restDays) - 1);

        const sl = new SickLetter({
            appointmentId: req.params.id,
            consultationId: null,
            userId:        appt.userId,
            doctorId:      doctor.id,
            diagnosis,
            notes:         notes || '',
            patientAge:    patientAge    || '',
            patientGender: patientGender || '',
            patientWeight: patientWeight || '',
            startDate,
            endDate,
            status: 'draft',
        });
        await sl.save();

        appt.sickLetter = sl.id;
        await appt.save();

        await createNotification({
            userId:  appt.userId.toString(),
            type:    'sick_letter_draft',
            title:   'Surat Sakit Dibuat',
            message: 'Dokter telah membuat surat sakit untuk Anda',
            data:    { appointmentId: appt._id },
            io:      req.app.get('io'),
        });

        res.json({ success: true, sickLetter: sl });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// PUT /api/appointments/doctor/:id/sick-letter/issue
router.put('/doctor/:id/sick-letter/issue', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ where: { userId: req.userId } });
        if (!doctor) return res.status(404).json({ message: 'Profil dokter tidak ditemukan' });

        const appt = await Appointment.findById(req.params.id);
        if (!appt) return res.status(404).json({ message: 'Janji temu tidak ditemukan' });
        if (appt.doctorId.toString() !== doctor.id.toString()) return res.status(403).json({ message: 'Akses ditolak' });

        const sl = await SickLetter.findOne({ appointmentId: req.params.id });
        if (!sl) return res.status(404).json({ message: 'Surat sakit tidak ditemukan' });

        sl.status   = 'issued';
        sl.issuedAt = new Date();
        await sl.save();

        await createNotification({
            userId:  appt.userId.toString(),
            type:    'sick_letter_issued',
            title:   'Surat Sakit Diterbitkan',
            message: `Surat sakit Anda telah diterbitkan oleh ${fmtDoctorName(doctor)}`,
            data:    { appointmentId: appt._id },
            io:      req.app.get('io'),
        });

        res.json({ success: true, sickLetter: sl });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET /api/appointments/:id/sick-letter/pdf
router.get('/:id/sick-letter/pdf', auth, async (req, res) => {
    try {
        const appt = await Appointment.findById(req.params.id).populate('sickLetter');
        if (!appt) return res.status(404).json({ message: 'Janji temu tidak ditemukan' });

        const doctor = await Doctor.findOne({ where: { userId: req.userId } });
        const isPatient = appt.userId.toString() === req.userId;
        const isDoctor  = doctor && appt.doctorId.toString() === doctor.id.toString();
        if (!isPatient && !isDoctor) return res.status(403).json({ message: 'Akses ditolak' });

        await generateApptSickLetterPdf(req.params.id, res);
    } catch (err) {
        if (!res.headersSent) res.status(500).json({ message: 'Server error', error: err.message });
    }
});

async function generateApptSickLetterPdf(appointmentId, res) {
    try {
        const appt = await Appointment.findById(appointmentId).populate('sickLetter');
        if (!appt) return res.status(404).json({ message: 'Janji temu tidak ditemukan' });
        const sl = appt.sickLetter;
        if (!sl) return res.status(404).json({ message: 'Surat sakit tidak ditemukan' });

        const patient = await User.findByPk(appt.userId);
        const doctor  = await Doctor.findByPk(appt.doctorId);

        const ClinicSettings = require('../models/ClinicSettings');
        const clinicSettings = await ClinicSettings.findOne({ key: 'main' }) || {};
        const clinicName     = clinicSettings.clinicName    || 'Klinik Pratama IPB';
        const clinicAddress  = clinicSettings.clinicAddress || 'Bogor, Jawa Barat';
        const signLocation   = clinicSettings.signLocation  || 'Bogor';
        const clinicPhone    = clinicSettings.clinicPhone   || '(62251) 8422094';

        const logoBuf      = await fetchImageBufferAppt(clinicSettings.logoUrl);
        const stampBuf     = await fetchImageBufferAppt(clinicSettings.stampUrl);
        const signatureBuf = await fetchImageBufferAppt(doctor?.signatureUrl);

        const doc = new PDFDocument({ margin: 70, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=surat-sakit-${sl.letterNumber || 'draft'}.pdf`);
        doc.on('error', (pdfErr) => {
            console.error('[appt sick-letter/pdf] PDFDocument error:', pdfErr);
            if (!res.headersSent) res.status(500).json({ message: 'Gagal generate PDF', error: pdfErr.message });
            else res.destroy();
        });
        doc.pipe(res);

        const tglPemeriksaan = new Date(appt.scheduledAt || appt.appointmentDate)
            .toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        const tglSurat   = sl.issuedAt ? new Date(sl.issuedAt) : new Date();
        const days       = Math.ceil((new Date(sl.endDate) - new Date(sl.startDate)) / (1000 * 60 * 60 * 24)) + 1;
        const daysWord   = ['nol','satu','dua','tiga','empat','lima','enam','tujuh','delapan','sembilan','sepuluh'][days] || days.toString();
        const tglMulai   = new Date(sl.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        const tglSelesai = new Date(sl.endDate).toLocaleDateString('id-ID',   { day: 'numeric', month: 'long', year: 'numeric' });

        const headerStartX = 50;
        const headerStartY = doc.y;
        const logoSize     = 55;

        if (logoBuf) {
            try { doc.image(logoBuf, headerStartX, headerStartY, { height: logoSize, width: logoSize }); }
            catch (imgErr) { console.warn('[appt sick-letter/pdf] Failed to load logo:', imgErr.message); }
        }

        const headerTextStartY = headerStartY;
        const addressParts     = parseAddressAppt(clinicAddress);

        doc.font('Times-Bold').fontSize(14).text(clinicName, 50, headerTextStartY, { align: 'center', width: 500 });
        doc.font('Times-Roman').fontSize(10).text(addressParts.street, 50, headerTextStartY + 16, { align: 'center', width: 500 });
        if (addressParts.city_province) {
            doc.font('Times-Roman').fontSize(10).text(addressParts.city_province, 50, headerTextStartY + 28, { align: 'center', width: 500 });
        }
        doc.font('Times-Roman').fontSize(10).text(`Telp. ${clinicPhone}`, 50, headerTextStartY + 40, { align: 'center', width: 500 });
        doc.font('Times-Bold').fontSize(10).text(`${sl.letterNumber || 'DRAFT'}`, 50, headerTextStartY + 52, { align: 'center', width: 500 });
        doc.y = headerStartY + logoSize + 5;

        doc.moveDown(0.3);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(0.8);

        doc.font('Times-Bold').fontSize(12).text('SURAT KETERANGAN SAKIT', { align: 'center' });
        doc.moveDown(0.8);

        doc.font('Times-Roman').fontSize(11);
        doc.text('Yang bertanda tangan di bawah ini menerangkan bahwa:', { align: 'left' });
        doc.moveDown(0.5);

        const labelX = 70;
        const valueX = 180;
        let currentY = doc.y;

        doc.fontSize(10);
        doc.text('Nama', labelX, currentY, { width: 100 });
        doc.text(`: ${patient?.name || '-'}`, valueX, currentY);
        currentY += 16;

        if (sl.patientAge) {
            doc.text('Umur', labelX, currentY, { width: 100 });
            doc.text(`: ${sl.patientAge} tahun`, valueX, currentY);
            currentY += 16;
        }
        if (sl.patientGender) {
            doc.text('Jenis Kelamin', labelX, currentY, { width: 100 });
            doc.text(`: ${sl.patientGender}`, valueX, currentY);
            currentY += 16;
        }

        doc.y = currentY;
        doc.moveDown(0.4);

        doc.font('Times-Roman').fontSize(10);
        const pemeriksaanText =
            `Berdasarkan hasil pemeriksaan pada tanggal ${tglPemeriksaan}. ` +
            `Pasien didiagnosis ${sl.diagnosis}, dan memerlukan istirahat ${days} (${daysWord}) hari ` +
            `terhitung mulai tanggal ${tglMulai} sampai dengan ${tglSelesai}. ` +
            `Demikian surat keterangan ini dibuat untuk dapat dipergunakan sebagaimana mestinya.`;
        doc.text(pemeriksaanText, 50, doc.y, { align: 'left', width: 500 });

        doc.moveDown(1.5);

        const signY  = doc.y;
        const rightX = 360;
        const imgSize = 52;

        doc.font('Times-Roman').fontSize(10);
        doc.text(`${signLocation}, ${tglSurat.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, rightX, signY, { align: 'center', width: 200 });
        doc.moveDown(0.5);
        doc.text('Dokter yang memeriksa', rightX, doc.y, { align: 'center', width: 200 });
        doc.moveDown(0.7);

        const sigAndStampY = doc.y;
        const sigImgX      = rightX + (190 - imgSize) / 2;

        if (signatureBuf) {
            try { doc.image(signatureBuf, sigImgX, sigAndStampY, { width: imgSize, height: imgSize }); }
            catch (imgErr) { console.warn('[appt sick-letter/pdf] Failed to load signature:', imgErr.message); }
        }
        if (stampBuf) {
            try {
                const stampSize = 40;
                const stampX    = sigImgX + (imgSize - stampSize) / 2;
                const stampY    = sigAndStampY + (imgSize * 0.45) - (stampSize / 2);
                doc.image(stampBuf, stampX, stampY, { width: stampSize, height: stampSize });
            } catch (imgErr) { console.warn('[appt sick-letter/pdf] Failed to load stamp:', imgErr.message); }
        }

        doc.moveDown(2.5);
        doc.font('Times-Bold').fontSize(10).text(`${fmtDoctorName(doctor)}`, rightX, doc.y, { align: 'center', width: 200 });
        doc.moveDown(1.2);
        doc.font('Times-Roman').fontSize(8).fillColor('#333333')
            .text('*Surat keterangan ini dibuat berdasarkan hasil pemeriksaan dan berlaku sesuai tanggal yang tertera.', 50, doc.y, { align: 'left', width: 500 });

        doc.end();
    } catch (err) {
        console.error('[appt sick-letter/pdf] error:', err);
        if (!res.headersSent) res.status(500).json({ message: 'Gagal generate PDF', error: err.message });
        else res.destroy();
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SURAT RUJUKAN — JANJI TEMU
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/appointments/doctor/:id/referral-letter
router.post('/doctor/:id/referral-letter', auth, doctorAuth, async (req, res) => {
    try {
        const { diagnosis, referralReason, referralTo, referralSpecialty, notes, patientAge, patientGender, patientWeight } = req.body;
        if (!diagnosis || !referralReason || !referralTo) return res.status(400).json({ message: 'Diagnosis, alasan rujukan, dan tujuan rujukan wajib diisi' });

        const doctor = await Doctor.findOne({ where: { userId: req.userId } });
        if (!doctor) return res.status(404).json({ message: 'Profil dokter tidak ditemukan' });

        const appt = await Appointment.findById(req.params.id);
        if (!appt) return res.status(404).json({ message: 'Janji temu tidak ditemukan' });
        if (appt.doctorId.toString() !== doctor.id.toString()) return res.status(403).json({ message: 'Akses ditolak' });
        if (!['checked_in', 'completed'].includes(appt.status)) return res.status(400).json({ message: 'Janji harus dalam status check-in atau selesai' });

        const existing = await ReferralLetter.findOne({ appointmentId: req.params.id });
        if (existing) return res.status(400).json({ message: 'Surat rujukan sudah dibuat untuk janji ini' });

        const rl = new ReferralLetter({
            appointmentId:     req.params.id,
            consultationId:    null,
            userId:            appt.userId,
            doctorId:          doctor.id,
            diagnosis,
            referralReason,
            referralTo,
            referralSpecialty: referralSpecialty || '',
            notes:             notes || '',
            patientAge:        patientAge    || '',
            patientGender:     patientGender || '',
            patientWeight:     patientWeight || '',
            status: 'draft',
        });
        await rl.save();

        appt.referralLetter = rl.id;
        await appt.save();

        await createNotification({
            userId:  appt.userId.toString(),
            type:    'referral_letter_draft',
            title:   'Surat Rujukan Dibuat',
            message: 'Dokter telah membuat surat rujukan untuk Anda',
            data:    { appointmentId: appt._id },
            io:      req.app.get('io'),
        });

        res.json({ success: true, referralLetter: rl });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// PUT /api/appointments/doctor/:id/referral-letter/issue
router.put('/doctor/:id/referral-letter/issue', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ where: { userId: req.userId } });
        if (!doctor) return res.status(404).json({ message: 'Profil dokter tidak ditemukan' });

        const appt = await Appointment.findById(req.params.id);
        if (!appt) return res.status(404).json({ message: 'Janji temu tidak ditemukan' });
        if (appt.doctorId.toString() !== doctor.id.toString()) return res.status(403).json({ message: 'Akses ditolak' });

        const rl = await ReferralLetter.findOne({ appointmentId: req.params.id });
        if (!rl) return res.status(404).json({ message: 'Surat rujukan tidak ditemukan' });

        rl.status   = 'issued';
        rl.issuedAt = new Date();
        await rl.save();

        await createNotification({
            userId:  appt.userId.toString(),
            type:    'referral_letter_issued',
            title:   'Surat Rujukan Diterbitkan',
            message: `Surat rujukan Anda telah diterbitkan oleh ${fmtDoctorName(doctor)}`,
            data:    { appointmentId: appt._id },
            io:      req.app.get('io'),
        });

        res.json({ success: true, referralLetter: rl });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// GET /api/appointments/:id/referral-letter/pdf
router.get('/:id/referral-letter/pdf', auth, async (req, res) => {
    try {
        const appt = await Appointment.findById(req.params.id).populate('referralLetter');
        if (!appt) return res.status(404).json({ message: 'Janji temu tidak ditemukan' });

        const doctor = await Doctor.findOne({ where: { userId: req.userId } });
        const isPatient = appt.userId.toString() === req.userId;
        const isDoctor  = doctor && appt.doctorId.toString() === doctor.id.toString();
        if (!isPatient && !isDoctor) return res.status(403).json({ message: 'Akses ditolak' });

        await generateApptReferralPdf(req.params.id, res);
    } catch (err) {
        if (!res.headersSent) res.status(500).json({ message: 'Server error', error: err.message });
    }
});

async function generateApptReferralPdf(appointmentId, res) {
    try {
        const appt = await Appointment.findById(appointmentId).populate('referralLetter');
        if (!appt) return res.status(404).json({ message: 'Janji temu tidak ditemukan' });
        const rl = appt.referralLetter;
        if (!rl) return res.status(404).json({ message: 'Surat rujukan tidak ditemukan' });

        const patient = await User.findByPk(appt.userId);
        const doctor  = await Doctor.findByPk(appt.doctorId);

        const ClinicSettings = require('../models/ClinicSettings');
        const clinicSettings = await ClinicSettings.findOne({ key: 'main' }) || {};
        const clinicName     = clinicSettings.clinicName    || 'Klinik Pratama IPB';
        const clinicAddress  = clinicSettings.clinicAddress || 'Bogor, Jawa Barat';
        const signLocation   = clinicSettings.signLocation  || 'Bogor';
        const clinicPhone    = clinicSettings.clinicPhone   || '(62251) 8422094';

        const logoBuf      = await fetchImageBufferAppt(clinicSettings.logoUrl);
        const stampBuf     = await fetchImageBufferAppt(clinicSettings.stampUrl);
        const signatureBuf = await fetchImageBufferAppt(doctor?.signatureUrl);

        const doc = new PDFDocument({ margin: 70, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=surat-rujukan-${rl.letterNumber || 'draft'}.pdf`);
        doc.on('error', () => { if (!res.headersSent) res.status(500).json({ message: 'Gagal generate PDF' }); else res.destroy(); });
        doc.pipe(res);

        const tglPemeriksaan = new Date(appt.scheduledAt || appt.appointmentDate)
            .toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        const tglSurat = rl.issuedAt ? new Date(rl.issuedAt) : new Date();

        const hStartY = doc.y; const logoSize = 55;
        if (logoBuf) { try { doc.image(logoBuf, 50, hStartY, { height: logoSize, width: logoSize }); } catch {} }

        const addrParts = parseAddressAppt(clinicAddress);
        doc.font('Times-Bold').fontSize(14).text(clinicName, 50, hStartY, { align: 'center', width: 500 });
        doc.font('Times-Roman').fontSize(10).text(addrParts.street, 50, hStartY + 16, { align: 'center', width: 500 });
        if (addrParts.city_province) doc.font('Times-Roman').fontSize(10).text(addrParts.city_province, 50, hStartY + 28, { align: 'center', width: 500 });
        doc.font('Times-Roman').fontSize(10).text(`Telp. ${clinicPhone}`, 50, hStartY + 40, { align: 'center', width: 500 });
        doc.font('Times-Bold').fontSize(10).text(rl.letterNumber || 'DRAFT', 50, hStartY + 52, { align: 'center', width: 500 });
        doc.y = hStartY + logoSize + 5;
        doc.moveDown(0.3);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(0.8);

        doc.font('Times-Bold').fontSize(12).text('SURAT RUJUKAN', { align: 'center' });
        doc.moveDown(0.8);
        doc.font('Times-Roman').fontSize(11).text('Yang bertanda tangan di bawah ini menerangkan bahwa:');
        doc.moveDown(0.5);

        const labelX = 70; const valueX = 200; let curY = doc.y;
        doc.fontSize(10);
        doc.text('Nama Pasien',    labelX, curY); doc.text(`: ${patient?.name || '-'}`,  valueX, curY); curY += 16;
        if (rl.patientAge)    { doc.text('Umur',          labelX, curY); doc.text(`: ${rl.patientAge} tahun`, valueX, curY); curY += 16; }
        if (rl.patientGender) { doc.text('Jenis Kelamin', labelX, curY); doc.text(`: ${rl.patientGender}`,    valueX, curY); curY += 16; }
        doc.text('Diagnosis',      labelX, curY); doc.text(`: ${rl.diagnosis}`, valueX, curY, { width: 340 }); curY += 24;
        doc.y = curY;
        doc.moveDown(0.4);

        doc.text('Dengan hormat, kami merujuk pasien tersebut di atas kepada:');
        doc.moveDown(0.3);
        curY = doc.y;
        doc.text('Tujuan Rujukan', labelX, curY); doc.text(`: ${rl.referralTo}`, valueX, curY, { width: 340 }); curY += 16;
        if (rl.referralSpecialty) { doc.text('Spesialisasi', labelX, curY); doc.text(`: ${rl.referralSpecialty}`, valueX, curY); curY += 16; }
        doc.y = curY;
        doc.moveDown(0.5);

        doc.text('Alasan Rujukan:', 50, doc.y);
        doc.moveDown(0.3);
        doc.text(rl.referralReason, 70, doc.y, { align: 'left', width: 480 });
        doc.moveDown(0.5);

        if (rl.notes) {
            doc.text('Catatan Tambahan:', 50, doc.y);
            doc.moveDown(0.3);
            doc.text(rl.notes, 70, doc.y, { align: 'left', width: 480 });
            doc.moveDown(0.5);
        }

        doc.text(`Diperiksa pada tanggal ${tglPemeriksaan}. Demikian surat rujukan ini dibuat untuk dapat dipergunakan sebagaimana mestinya.`, 50, doc.y, { align: 'left', width: 500 });
        doc.moveDown(1.5);

        const signY = doc.y; const rightX = 360; const imgSize = 52;
        doc.text(`${signLocation}, ${tglSurat.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, rightX, signY, { align: 'center', width: 200 });
        doc.moveDown(0.5);
        doc.text('Dokter Perujuk', rightX, doc.y, { align: 'center', width: 200 });
        doc.moveDown(0.7);

        const sigStampY = doc.y; const sigImgX = rightX + (190 - imgSize) / 2;
        if (signatureBuf) { try { doc.image(signatureBuf, sigImgX, sigStampY, { width: imgSize, height: imgSize }); } catch {} }
        if (stampBuf) {
            try {
                const ss = 40; const sx = sigImgX + (imgSize - ss) / 2; const sy = sigStampY + (imgSize * 0.45) - (ss / 2);
                doc.image(stampBuf, sx, sy, { width: ss, height: ss });
            } catch {}
        }
        doc.moveDown(2.5);
        doc.font('Times-Bold').fontSize(10).text(fmtDoctorName(doctor), rightX, doc.y, { align: 'center', width: 200 });
        doc.moveDown(1.2);
        doc.font('Times-Roman').fontSize(8).fillColor('#333333').text('*Surat rujukan ini dibuat berdasarkan hasil pemeriksaan dan berlaku sesuai tanggal yang tertera.', 50, doc.y, { align: 'left', width: 500 });
        doc.end();
    } catch (err) {
        console.error('[appt referral pdf]', err);
        if (!res.headersSent) res.status(500).json({ message: 'Gagal generate PDF', error: err.message });
        else res.destroy();
    }
}

router.generateApptReferralPdf  = generateApptReferralPdf;
router.generateApptSickLetterPdf = generateApptSickLetterPdf;
module.exports = router;