/**
 * /api/availability — Jadwal Konsultasi Online Dokter
 *
 * GET  /my          → dokter lihat jadwal & status minggu berjalan
 * PUT  /my          → dokter simpan jadwal (otomatis hitung weekStart/weekEnd)
 * GET  /slots/:id   → user lihat slot tersedia
 *
 * Aturan mingguan:
 *   - Jadwal berlaku dari Senin s.d. Sabtu dalam 1 minggu kalender
 *   - weekStart = Senin terdekat ke depan, weekEnd = Sabtu 23:59:59 WIB
 *   - Jika weekEnd sudah lewat → expired → pasien tidak bisa booking
 *   - Dokter wajib set ulang setiap minggu
 *   - Hari Minggu (dow=0) tidak diizinkan
 */

const express            = require('express');
const router             = express.Router();
const auth               = require('../middleware/auth');
const doctorAuth         = require('../middleware/doctorAuth');
const Doctor             = require('../models/Doctor');
const DoctorAvailability = require('../models/DoctorAvailability');
const Consultation       = require('../models/Consultation');

const ALLOWED_SLOTS = DoctorAvailability.ALLOWED_SLOTS;
const WIB_OFFSET    = 7 * 60 * 60 * 1000;
const DAYS_LABEL    = { 1:'Senin', 2:'Selasa', 3:'Rabu', 4:'Kamis', 5:'Jumat', 6:'Sabtu' };

const nowAsWIB   = () => new Date(Date.now() + WIB_OFFSET);
const wibDateStr = (d) => d.toISOString().slice(0, 10);
const wibDay     = (d) => d.getUTCDay();

const wibToUtcDate = (dateStr, timeStr) => {
    const [y, mo, dd] = dateStr.split('-').map(Number);
    const [h,  m]     = timeStr.split(':').map(Number);
    return new Date(Date.UTC(y, mo - 1, dd, h, m, 0) - WIB_OFFSET);
};

const utcToWibHHMM = (utcDate) => {
    const w = new Date(utcDate.getTime() + WIB_OFFSET);
    return `${String(w.getUTCHours()).padStart(2,'0')}:${String(w.getUTCMinutes()).padStart(2,'0')}`;
};

/**
 * Hitung weekStart (Senin terdekat) dan weekEnd (Sabtu minggu itu 23:59:59 WIB).
 * Jika hari ini Minggu → weekStart = Senin besok.
 * Jika hari ini Senin–Sabtu → weekStart = Senin minggu ini.
 */
const calcWeekRange = () => {
    const nowWIB = nowAsWIB();
    const dow    = wibDay(nowWIB); // 0=Min,1=Sen,...,6=Sab

    // BUG-12 fix: 8-dow points to NEXT Monday for Tue-Sat; correct is 1-dow (negative = go back)
    const daysToMonday = dow === 0 ? 1 : (1 - dow);

    const monWIB     = new Date(nowWIB.getTime() + daysToMonday * 24 * 60 * 60 * 1000);
    const monDateStr = wibDateStr(monWIB);
    const weekStart  = wibToUtcDate(monDateStr, '00:00');

    const satWIB     = new Date(monWIB.getTime() + 5 * 24 * 60 * 60 * 1000);
    const satDateStr = wibDateStr(satWIB);
    // weekEnd = Sabtu 23:59:59 WIB
    const weekEnd    = new Date(wibToUtcDate(satDateStr, '23:59').getTime() + 59 * 1000);

    return { weekStart, weekEnd, monDateStr, satDateStr };
};

/** Normalise schedule: key '1'–'6' saja, buang key '0' (Minggu) */
const normaliseSchedule = (raw) => {
    const result = { '1':[],'2':[],'3':[],'4':[],'5':[],'6':[] };
    if (!raw || typeof raw !== 'object') return result;
    for (let d = 1; d <= 6; d++) {
        const key      = String(d);
        const incoming = Array.isArray(raw[key]) ? raw[key] : [];
        result[key]    = incoming.filter(s => ALLOWED_SLOTS.includes(s));
    }
    return result;
};

// ── GET /my ───────────────────────────────────────────────────────────────────
router.get('/my', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ userId: req.userId });
        if (!doctor) return res.status(404).json({ message: 'Data dokter tidak ditemukan' });

        const avail = await DoctorAvailability.findOne({ doctorId: doctor._id });
        const defaultSchedule = { '1':[],'2':[],'3':[],'4':[],'5':[],'6':[] };

        if (!avail) {
            return res.json({
                success:      true,
                availability: {
                    schedule:     defaultSchedule,
                    isActive:     false,
                    allowedSlots: ALLOWED_SLOTS,
                    weekStart:    null,
                    weekEnd:      null,
                    isExpired:    true,
                    _isDefault:   true,
                },
            });
        }

        const scheduleObj = {};
        for (let d = 1; d <= 6; d++) scheduleObj[String(d)] = avail.getSlotsForDay(d);

        res.json({
            success:      true,
            availability: {
                _id:          avail._id,
                schedule:     scheduleObj,
                isActive:     avail.isActive,
                allowedSlots: ALLOWED_SLOTS,
                weekStart:    avail.weekStart,
                weekEnd:      avail.weekEnd,
                isExpired:    !avail.isWeekActive(),
                updatedAt:    avail.updatedAt,
            },
        });
    } catch (err) {
        console.error('[GET /availability/my]', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

// ── PUT /my ───────────────────────────────────────────────────────────────────
router.put('/my', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ userId: req.userId });
        if (!doctor) return res.status(404).json({ message: 'Data dokter tidak ditemukan' });

        const { schedule, isActive } = req.body;

        if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) {
            return res.status(400).json({ message: 'Format schedule tidak valid.' });
        }

        // Tolak hari Minggu
        if (Array.isArray(schedule['0']) && schedule['0'].length > 0) {
            return res.status(400).json({ message: 'Hari Minggu tidak diizinkan sebagai hari praktik.' });
        }

        const cleanSchedule = normaliseSchedule(schedule);
        const totalSlots = Object.values(cleanSchedule).reduce((sum, arr) => sum + arr.length, 0);
        if (totalSlots === 0) {
            return res.status(400).json({ message: 'Pilih minimal satu slot pada salah satu hari' });
        }

        // Cek overlap dengan janji temu offline (hanya jika jadwal janji temu masih aktif)
        const AppointmentAvailability = require('../models/AppointmentAvailability');
        const offlineAvail = await AppointmentAvailability.findOne({ doctorId: doctor._id });
        if (offlineAvail && offlineAvail.isWeekActive()) {
            const conflicts = [];
            for (let d = 1; d <= 6; d++) {
                const onlineSlots  = cleanSchedule[String(d)] || [];
                const offlineSlots = offlineAvail.getSlotsForDay(d);
                const overlap      = onlineSlots.filter(s => offlineSlots.includes(s));
                if (overlap.length > 0) conflicts.push(`${DAYS_LABEL[d]}: ${overlap.join(', ')}`);
            }
            if (conflicts.length > 0) {
                return res.status(400).json({
                    message: `Jadwal konsultasi online bentrok dengan janji temu di: ${conflicts.join(' | ')}`,
                    conflicts,
                });
            }
        }

        const { weekStart, weekEnd, monDateStr, satDateStr } = calcWeekRange();

        const avail = await DoctorAvailability.findOneAndUpdate(
            { doctorId: doctor._id },
            { $set: { schedule: cleanSchedule, isActive: isActive !== false, weekStart, weekEnd, updatedAt: new Date() } },
            { upsert: true, new: true }
        );

        const scheduleObj = {};
        for (let d = 1; d <= 6; d++) scheduleObj[String(d)] = avail.getSlotsForDay(d);

        res.json({
            success:      true,
            message:      `Jadwal konsultasi online berhasil dirilis (berlaku ${monDateStr} s.d. ${satDateStr})`,
            availability: { schedule: scheduleObj, isActive: avail.isActive, allowedSlots: ALLOWED_SLOTS, weekStart: avail.weekStart, weekEnd: avail.weekEnd, isExpired: false },
        });
    } catch (err) {
        console.error('[PUT /availability/my]', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

// ── GET /slots/:doctorId ──────────────────────────────────────────────────────
router.get('/slots/:doctorId', async (req, res) => {
    try {
        const { doctorId } = req.params;
        const DoctorScheduleOverride = require('../models/DoctorScheduleOverride');

        const doctor = await Doctor.findById(doctorId);
        if (!doctor || !doctor.isActive)
            return res.status(404).json({ message: 'Dokter tidak ditemukan' });

        const avail = await DoctorAvailability.findOne({ doctorId });

        if (!avail || !avail.isActive || !avail.isWeekActive()) {
            return res.json({
                success:     true,
                slots:       [],
                notReleased: true,
                message:     'Dokter belum merilis jadwal untuk minggu ini. Silakan cek kembali beberapa saat lagi.',
            });
        }

        // Ambil tanggal yang diblokir admin (override)
        const overrides = await DoctorScheduleOverride.find({ doctorId }).lean();
        const blockedDates = new Set(overrides.map(o => o.date));

        const nowUTC   = new Date();
        const result   = [];
        const msPerDay = 24 * 60 * 60 * 1000;

        // BUG-21 fix: single query for entire week instead of one per day (N+1)
        // BUG-19 fix: exclude expired pending_payment slots (paymentDeadline < now)
        const weekBookings = await Consultation.find({
            doctorId,
            scheduledAt: { $gte: avail.weekStart, $lte: avail.weekEnd },
            $or: [
                { status: { $in: ['waiting_verification','confirmed','in_progress'] } },
                // pending_payment only valid if paymentDeadline hasn't passed
                { status: 'pending_payment', paymentDeadline: { $gt: nowUTC } },
            ],
        }).select('scheduledAt').lean();

        // Group booked slots by WIB date string for O(1) lookup
        const bookedByDate = {};
        for (const c of weekBookings) {
            const dateKey = wibDateStr(new Date(new Date(c.scheduledAt).getTime() + WIB_OFFSET));
            if (!bookedByDate[dateKey]) bookedByDate[dateKey] = new Set();
            bookedByDate[dateKey].add(utcToWibHHMM(c.scheduledAt));
        }

        let cursor = new Date(avail.weekStart.getTime());

        while (cursor <= avail.weekEnd) {
            const cursorWIB = new Date(cursor.getTime() + WIB_OFFSET);
            const dow       = wibDay(cursorWIB);

            if (dow === 0) { cursor = new Date(cursor.getTime() + msPerDay); continue; }

            const activeSlots = avail.getSlotsForDay(dow);
            if (!activeSlots.length) { cursor = new Date(cursor.getTime() + msPerDay); continue; }

            const dateStr = wibDateStr(cursorWIB);

            // Jika tanggal diblokir admin — semua slot tidak tersedia
            const isBlocked = blockedDates.has(dateStr);

            const bookedSet = bookedByDate[dateStr] || new Set();

            for (const slot of activeSlots) {
                const slotUTC  = wibToUtcDate(dateStr, slot);
                const CUTOFF_MS = 20 * 60 * 1000;
                const isPast   = (slotUTC.getTime() - CUTOFF_MS) <= nowUTC.getTime();
                const isBooked = bookedSet.has(slot);
                const endUTC   = new Date(slotUTC.getTime() + 30 * 60 * 1000);

                result.push({
                    date:      dateStr,
                    startTime: slot,
                    endTime:   utcToWibHHMM(endUTC),
                    startUtc:  slotUTC.toISOString(),
                    endUtc:    endUTC.toISOString(),
                    available: !isPast && !isBooked && !isBlocked,
                    isPast,
                    isBooked,
                    isBlocked,
                    blockReason: isBlocked ? (overrides.find(o => o.date === dateStr)?.reason || 'Dokter tidak hadir') : undefined,
                });
            }

            cursor = new Date(cursor.getTime() + msPerDay);
        }

        res.json({ success: true, slots: result });
    } catch (err) {
        console.error('[GET /availability/slots]', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;