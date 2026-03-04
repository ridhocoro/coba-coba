/**
 * /api/availability
 *
 * GET  /my           → dokter lihat pengaturan jadwalnya sendiri
 * PUT  /my           → dokter simpan pengaturan jadwal
 * GET  /slots/:id    → user lihat slot tersedia dokter (7 hari ke depan)
 *
 * Timezone: semua jam praktik disimpan "HH:MM" WIB.
 * MongoDB menyimpan Date dalam UTC.
 *
 * Konversi WIB → UTC:
 *   new Date(Date.UTC(y, mo-1, d, h, m, 0) - WIB_OFFSET)
 *
 * Cara baca "sekarang dalam WIB":
 *   const nowWIB = new Date(Date.now() + WIB_OFFSET);
 *   nowWIB.getUTCHours() → jam WIB saat ini
 *   nowWIB.toISOString().slice(0,10) → "YYYY-MM-DD" WIB hari ini
 */

const express            = require('express');
const router             = express.Router();
const auth               = require('../middleware/auth');
const doctorAuth         = require('../middleware/doctorAuth');
const Doctor             = require('../models/Doctor');
const DoctorAvailability = require('../models/DoctorAvailability');
const Consultation       = require('../models/Consultation');

const WIB_OFFSET = 7 * 60 * 60 * 1000;

// ── Helpers ──────────────────────────────────────────────────────────────────

const nowAsWIB     = () => new Date(Date.now() + WIB_OFFSET);
const wibDateStr   = (wibDate) => wibDate.toISOString().slice(0, 10);
const wibDay       = (wibDate) => wibDate.getUTCDay();

const wibToUtcDate = (dateStr, timeStr) => {
    const [y, mo, d] = dateStr.split('-').map(Number);
    const [h, m]     = timeStr.split(':').map(Number);
    return new Date(Date.UTC(y, mo - 1, d, h, m, 0) - WIB_OFFSET);
};

const utcToWibHHMM = (utcDate) => {
    const w = new Date(utcDate.getTime() + WIB_OFFSET);
    return String(w.getUTCHours()).padStart(2,'0') + ':' + String(w.getUTCMinutes()).padStart(2,'0');
};

const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

// ── GET /my ──────────────────────────────────────────────────────────────────
router.get('/my', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ userId: req.userId });
        if (!doctor) return res.status(404).json({ message: 'Data dokter tidak ditemukan' });

        const avail = await DoctorAvailability.findOne({ doctorId: doctor._id });
        if (!avail) {
            return res.json({
                success: true,
                availability: {
                    practiceDays: [1, 2, 3, 4, 5],
                    startTime: '08:00',
                    endTime: '16:00',
                    sessionDuration: 30,
                    bufferDuration: 30,
                    lunchBreakStart: '12:00',
                    lunchBreakEnd: '13:00',
                    isActive: false,
                    _isDefault: true
                }
            });
        }

        res.json({ success: true, availability: avail });
    } catch (err) {
        console.error('[GET /availability/my]', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

// ── PUT /my ──────────────────────────────────────────────────────────────────
router.put('/my', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ userId: req.userId });
        if (!doctor) return res.status(404).json({ message: 'Data dokter tidak ditemukan' });

        const {
            practiceDays,
            startTime,
            endTime,
            lunchBreakStart = '12:00',
            lunchBreakEnd   = '13:00',
            isActive
        } = req.body;

        if (!practiceDays || !Array.isArray(practiceDays) || practiceDays.length === 0)
            return res.status(400).json({ message: 'Pilih minimal satu hari praktik' });
        if (!startTime || !endTime)
            return res.status(400).json({ message: 'Jam mulai dan jam selesai wajib diisi' });
        if (toMin(startTime) >= toMin(endTime))
            return res.status(400).json({ message: 'Jam mulai harus sebelum jam selesai' });

        // Hitung jumlah slot yang akan dihasilkan
        const SESSION  = 30, BUFFER = 30, INTERVAL = 60;
        const lbS = toMin(lunchBreakStart), lbE = toMin(lunchBreakEnd);
        const s = toMin(startTime), e = toMin(endTime);
        let slotCount = 0, cur = s;
        while (cur + SESSION <= e) {
            if (cur >= lbS && cur < lbE)          { cur = lbE; continue; }
            if (cur < lbS && cur + SESSION > lbS) { cur = lbE; continue; }
            if (cur + SESSION > e) break;
            slotCount++;
            cur += INTERVAL;
        }
        if (slotCount === 0)
            return res.status(400).json({ message: 'Pengaturan ini tidak menghasilkan slot apapun.' });

        const avail = await DoctorAvailability.findOneAndUpdate(
            { doctorId: doctor._id },
            {
                doctorId:        doctor._id,
                practiceDays:    practiceDays.map(Number),
                startTime,
                endTime,
                sessionDuration: SESSION,
                bufferDuration:  BUFFER,
                lunchBreakStart,
                lunchBreakEnd,
                isActive:        isActive !== false,
                updatedAt:       new Date()
            },
            { upsert: true, new: true }
        );

        res.json({ success: true, availability: avail });
    } catch (err) {
        console.error('[PUT /availability/my]', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

// ── GET /slots/:doctorId ─────────────────────────────────────────────────────
// Public — tidak perlu login
router.get('/slots/:doctorId', async (req, res) => {
    try {
        const { doctorId } = req.params;

        const doctor = await Doctor.findById(doctorId);
        if (!doctor || !doctor.isActive)
            return res.status(404).json({ message: 'Dokter tidak ditemukan' });

        const avail = await DoctorAvailability.findOne({ doctorId });
        if (!avail)
            return res.json({ success: true, slots: [], message: 'Dokter belum mengatur jadwal praktik' });
        if (!avail.isActive)
            return res.json({ success: true, slots: [], message: 'Dokter sedang tidak menerima konsultasi' });

        const nowWIB = nowAsWIB();
        const nowUTC = new Date();
        const result = [];

        for (let offset = 1; offset <= 7; offset++) {
            const targetWIB = new Date(nowWIB.getTime() + offset * 24 * 60 * 60 * 1000);
            const dayOfWeek = wibDay(targetWIB);
            const dateStr   = wibDateStr(targetWIB);

            if (!avail.practiceDays.includes(dayOfWeek)) continue;

            // Generate slot template
            const daySlots = avail.generateSlotsForDay();
            if (daySlots.length === 0) continue;

            // Cari slot yang sudah dibooking hari ini
            const dayStartUTC = wibToUtcDate(dateStr, '00:00');
            const dayEndUTC   = wibToUtcDate(dateStr, '23:59');

            const bookedList = await Consultation.find({
                doctorId,
                scheduledAt: { $gte: dayStartUTC, $lte: dayEndUTC },
                status: { $in: ['pending_payment', 'waiting_verification', 'confirmed', 'in_progress'] }
            }).select('scheduledAt');

            const bookedSet = new Set(bookedList.map(c => utcToWibHHMM(c.scheduledAt)));

            for (const slot of daySlots) {
                const startUTC = wibToUtcDate(dateStr, slot.startTime);
                const endUTC   = wibToUtcDate(dateStr, slot.endTime);

                // Buang slot yang sudah lewat (safety)
                if (startUTC.getTime() <= nowUTC.getTime()) continue;

                result.push({
                    date:      dateStr,
                    startTime: slot.startTime,
                    endTime:   slot.endTime,
                    startUtc:  startUTC.toISOString(),
                    endUtc:    endUTC.toISOString(),
                    available: !bookedSet.has(slot.startTime)
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
