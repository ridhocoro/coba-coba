/**
 * /api/availability — Jadwal Konsultasi Online Dokter
 *
 * GET  /my          → dokter lihat jadwal per-hari miliknya
 * PUT  /my          → dokter simpan jadwal per-hari
 * GET  /slots/:id   → user lihat slot tersedia dokter (7 hari ke depan)
 *
 * Slot konsultasi online yang diizinkan (FIXED):
 *   08:30  09:30  10:30  11:30  13:30  14:30  15:30
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
const DAYS_LABEL    = { 1:'Senin', 2:'Selasa', 3:'Rabu', 4:'Kamis', 5:'Jumat' };

// ── Helpers ───────────────────────────────────────────────────────────────────
const nowAsWIB   = () => new Date(Date.now() + WIB_OFFSET);
const wibDateStr = (d) => d.toISOString().slice(0, 10);
const wibDay     = (d) => d.getUTCDay();  // 0=Min, 1=Sen, …, 6=Sab

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
 * Normalise schedule dari body request.
 * Menerima object { "1": ["08:30","09:30"], "2": [...], ... }
 * Hanya menyimpan slot yang ada di ALLOWED_SLOTS.
 * Key yang tidak ada di 1–5 dibuang.
 */
const normaliseSchedule = (raw) => {
    const result = { '1':[],'2':[],'3':[],'4':[],'5':[] };
    if (!raw || typeof raw !== 'object') return result;
    for (let d = 1; d <= 5; d++) {
        const key    = String(d);
        const incoming = Array.isArray(raw[key]) ? raw[key] : [];
        result[key]  = incoming.filter(s => ALLOWED_SLOTS.includes(s));
    }
    return result;
};

// ── GET /my ───────────────────────────────────────────────────────────────────
router.get('/my', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ userId: req.userId });
        if (!doctor) return res.status(404).json({ message: 'Data dokter tidak ditemukan' });

        const avail = await DoctorAvailability.findOne({ doctorId: doctor._id });

        const defaultSchedule = { '1':[],'2':[],'3':[],'4':[],'5':[] };

        if (!avail) {
            return res.json({
                success:      true,
                availability: {
                    schedule:     defaultSchedule,
                    isActive:     false,
                    allowedSlots: ALLOWED_SLOTS,
                    _isDefault:   true,
                },
            });
        }

        // Konversi Map → plain object untuk JSON response
        const scheduleObj = {};
        for (let d = 1; d <= 5; d++) {
            const key = String(d);
            scheduleObj[key] = avail.getSlotsForDay(d);
        }

        res.json({
            success:      true,
            availability: {
                _id:          avail._id,
                schedule:     scheduleObj,
                isActive:     avail.isActive,
                allowedSlots: ALLOWED_SLOTS,
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

        // Validasi: schedule harus ada dan berupa object
        if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule)) {
            return res.status(400).json({ message: 'Format schedule tidak valid. Gunakan { "1": ["08:30",...], ... }' });
        }

        // Normalise — buang slot tidak dikenal
        const cleanSchedule = normaliseSchedule(schedule);

        // Pastikan minimal ada 1 slot aktif di antara semua hari
        const totalSlots = Object.values(cleanSchedule).reduce((sum, arr) => sum + arr.length, 0);
        if (totalSlots === 0) {
            return res.status(400).json({ message: 'Pilih minimal satu slot pada salah satu hari' });
        }

        // Cek overlap dengan janji temu offline (slot yang sama di hari yang sama)
        const AppointmentAvailability = require('../models/AppointmentAvailability');
        const offlineAvail = await AppointmentAvailability.findOne({ doctorId: doctor._id, isActive: true });
        if (offlineAvail) {
            const conflicts = [];
            for (let d = 1; d <= 5; d++) {
                const onlineSlots  = cleanSchedule[String(d)] || [];
                const offlineSlots = offlineAvail.getSlotsForDay(d);
                const overlap      = onlineSlots.filter(s => offlineSlots.includes(s));
                if (overlap.length > 0) {
                    conflicts.push(`${DAYS_LABEL[d]}: ${overlap.join(', ')}`);
                }
            }
            if (conflicts.length > 0) {
                return res.status(400).json({
                    message:   `Jadwal konsultasi online bentrok dengan janji temu di: ${conflicts.join(' | ')}`,
                    conflicts,
                });
            }
        }

        // Simpan
        const avail = await DoctorAvailability.findOneAndUpdate(
            { doctorId: doctor._id },
            {
                $set: {
                    schedule:  cleanSchedule,
                    isActive:  isActive !== false,
                    updatedAt: new Date(),
                },
            },
            { upsert: true, new: true }
        );

        // Konversi Map → plain object
        const scheduleObj = {};
        for (let d = 1; d <= 5; d++) scheduleObj[String(d)] = avail.getSlotsForDay(d);

        res.json({
            success:      true,
            message:      'Jadwal konsultasi online berhasil disimpan',
            availability: { schedule: scheduleObj, isActive: avail.isActive, allowedSlots: ALLOWED_SLOTS },
        });
    } catch (err) {
        console.error('[PUT /availability/my]', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

// ── GET /slots/:doctorId ──────────────────────────────────────────────────────
// Public — tidak perlu login
router.get('/slots/:doctorId', async (req, res) => {
    try {
        const { doctorId } = req.params;

        const doctor = await Doctor.findById(doctorId);
        if (!doctor || !doctor.isActive)
            return res.status(404).json({ message: 'Dokter tidak ditemukan' });

        const avail = await DoctorAvailability.findOne({ doctorId });
        if (!avail || !avail.isActive)
            return res.json({ success: true, slots: [], message: 'Dokter belum mengatur jadwal atau sedang tidak aktif' });

        const nowWIB = nowAsWIB();
        const nowUTC = new Date();
        const result = [];

        // Generate slot 7 hari ke depan
        for (let offset = 1; offset <= 7; offset++) {
            const targetWIB = new Date(nowWIB.getTime() + offset * 24 * 60 * 60 * 1000);
            const dayOfWeek = wibDay(targetWIB);  // 0=Min, 1=Sen, …

            // Hanya Senin–Jumat
            if (dayOfWeek < 1 || dayOfWeek > 5) continue;

            const activeSlots = avail.getSlotsForDay(dayOfWeek);
            if (activeSlots.length === 0) continue;

            const dateStr = wibDateStr(targetWIB);

            // Ambil sesi yang sudah dibooking hari ini
            const dayStartUTC = wibToUtcDate(dateStr, '00:00');
            const dayEndUTC   = wibToUtcDate(dateStr, '23:59');

            const bookedList = await Consultation.find({
                doctorId,
                scheduledAt: { $gte: dayStartUTC, $lte: dayEndUTC },
                status:      { $in: ['pending_payment','waiting_verification','confirmed','in_progress'] },
            }).select('scheduledAt');

            const bookedSet = new Set(bookedList.map(c => utcToWibHHMM(c.scheduledAt)));

            for (const slot of activeSlots) {
                const slotUTC = wibToUtcDate(dateStr, slot);

                // Jangan tampilkan slot yang sudah lewat
                if (slotUTC.getTime() <= nowUTC.getTime()) continue;

                // End time = +60 menit (sesi 30 mnt + buffer 30 mnt)
                const endUTC = new Date(slotUTC.getTime() + 60 * 60 * 1000);

                result.push({
                    date:      dateStr,
                    startTime: slot,
                    endTime:   utcToWibHHMM(endUTC),
                    startUtc:  slotUTC.toISOString(),
                    endUtc:    endUTC.toISOString(),
                    available: !bookedSet.has(slot),
                });
            }
        }

        res.json({ success: true, slots: result });
    } catch (err) {
        console.error('[GET /availability/slots]', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;