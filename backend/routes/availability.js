/**
 * /api/availability
 * Mengatur availability dokter dan generate/query slot konsultasi.
 * Semua waktu dalam WIB (UTC+7). Konversi ke UTC dilakukan di sini sebelum simpan/query.
 */
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const doctorAuth = require('../middleware/doctorAuth');
const Doctor = require('../models/Doctor');
const DoctorAvailability = require('../models/DoctorAvailability');
const Consultation = require('../models/Consultation');

// ── WIB helpers ───────────────────────────────────────────────────────────────
const WIB_OFFSET = 7 * 60 * 60 * 1000; // 7 jam dalam milidetik

/** Tanggal/waktu saat ini dalam WIB */
const nowWIB = () => new Date(Date.now() + WIB_OFFSET);

/** Konversi "YYYY-MM-DD" + "HH:MM" (WIB) → Date object (UTC tersimpan di DB) */
const wibToUtc = (dateStr, timeStr) => {
    const [y, mo, d] = dateStr.split('-').map(Number);
    const [h, mi] = timeStr.split(':').map(Number);
    // Buat Date di UTC, lalu kurangi WIB offset
    return new Date(Date.UTC(y, mo - 1, d, h, mi, 0) - WIB_OFFSET);
};

/** Format Date object ke "YYYY-MM-DD" dalam WIB */
const toWIBDateStr = (date) => {
    const wib = new Date(date.getTime() + WIB_OFFSET);
    return wib.toISOString().slice(0, 10);
};

/** Nama hari dalam WIB (0=Sun, 1=Mon, ...) */
const wibDayOfWeek = (date) => {
    const wib = new Date(date.getTime() + WIB_OFFSET);
    return wib.getUTCDay();
};

// ─── GET availability dokter sendiri ─────────────────────────────────────────
router.get('/my', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ userId: req.userId });
        if (!doctor) return res.status(404).json({ message: 'Data dokter tidak ditemukan' });

        let avail = await DoctorAvailability.findOne({ doctorId: doctor._id });
        if (!avail) {
            // Default availability
            avail = {
                practiceDays: [1, 2, 3, 4, 5],
                startTime: '08:00',
                endTime: '16:00',
                sessionDuration: 30,
                bufferDuration: 30,
                lunchBreakStart: '12:00',
                lunchBreakEnd: '13:00',
                isActive: true
            };
        }
        res.json({ success: true, availability: avail });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// ─── PUT update availability dokter sendiri ───────────────────────────────────
router.put('/my', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ userId: req.userId });
        if (!doctor) return res.status(404).json({ message: 'Data dokter tidak ditemukan' });

        const { practiceDays, startTime, endTime, lunchBreakStart, lunchBreakEnd, isActive } = req.body;

        // Validasi dasar
        if (!practiceDays || practiceDays.length === 0) {
            return res.status(400).json({ message: 'Pilih minimal satu hari praktik' });
        }

        const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
        if (toMin(startTime) >= toMin(endTime)) {
            return res.status(400).json({ message: 'Jam mulai harus sebelum jam selesai' });
        }

        const avail = await DoctorAvailability.findOneAndUpdate(
            { doctorId: doctor._id },
            {
                doctorId: doctor._id,
                practiceDays: practiceDays.map(Number),
                startTime,
                endTime,
                sessionDuration: 30,
                bufferDuration: 30,
                lunchBreakStart,
                lunchBreakEnd,
                isActive: isActive !== false,
                updatedAt: new Date()
            },
            { upsert: true, new: true }
        );

        res.json({ success: true, availability: avail });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// ─── GET slot tersedia untuk dokter tertentu (public, dipakai user saat booking) ─
// GET /api/availability/slots/:doctorId?startDate=YYYY-MM-DD
router.get('/slots/:doctorId', async (req, res) => {
    try {
        const { doctorId } = req.params;

        const doctor = await Doctor.findById(doctorId);
        if (!doctor || !doctor.isActive) {
            return res.status(404).json({ message: 'Dokter tidak ditemukan' });
        }

        const avail = await DoctorAvailability.findOne({ doctorId, isActive: true });
        if (!avail) {
            return res.json({ success: true, slots: [], message: 'Dokter belum mengatur jadwal' });
        }

        // Generate 7 hari ke depan termasuk HARI INI (mulai dari slot yang belum lewat)
        const now = new Date(); // UTC, untuk compare dengan slot UTC
        const todayWIB = nowWIB();
        const slots = [];

        for (let dayOffset = 0; dayOffset <= 6; dayOffset++) {
            const targetWIB = new Date(todayWIB);
            targetWIB.setUTCDate(todayWIB.getUTCDate() + dayOffset);

            const dayOfWeek = wibDayOfWeek(targetWIB);
            if (!avail.practiceDays.includes(dayOfWeek)) continue;

            const dateStr = toWIBDateStr(targetWIB);

            // Generate semua slot untuk hari itu
            const daySlots = avail.generateSlotsForDay(dateStr);

            // Cek slot mana yang sudah dipesan (tidak expired/cancelled)
            const bookedSlots = await Consultation.find({
                doctorId,
                status: {
                    $in: ['pending_payment', 'waiting_verification', 'confirmed', 'in_progress']
                },
                scheduledAt: {
                    $gte: wibToUtc(dateStr, '00:00'),
                    $lt:  wibToUtc(dateStr, '23:59')
                }
            }).select('scheduledAt scheduledEnd status');

            const bookedStartTimes = bookedSlots.map(b => {
                // Konversi UTC → WIB untuk compare
                const wibDate = new Date(b.scheduledAt.getTime() + WIB_OFFSET);
                return `${String(wibDate.getUTCHours()).padStart(2, '0')}:${String(wibDate.getUTCMinutes()).padStart(2, '0')}`;
            });

            const enriched = daySlots
                .map(slot => {
                    const slotUtc = wibToUtc(dateStr, slot.startTime);
                    return {
                        date: dateStr,
                        startTime: slot.startTime,
                        endTime: slot.endTime,
                        // UTC datetime untuk dikirim ke backend saat booking
                        startUtc: slotUtc.toISOString(),
                        endUtc:   wibToUtc(dateStr, slot.endTime).toISOString(),
                        available: !bookedStartTimes.includes(slot.startTime)
                    };
                })
                // Filter slot yang sudah lewat (tambah buffer 5 menit agar tidak bookable mepet)
                .filter(slot => {
                    const slotUtc = new Date(slot.startUtc);
                    return slotUtc.getTime() > now.getTime() + 5 * 60 * 1000;
                });

            if (enriched.length > 0) {
                slots.push(...enriched);
            }
        }

        res.json({ success: true, slots });
    } catch (err) {
        console.error('availability slots error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router;
