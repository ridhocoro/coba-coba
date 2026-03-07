/**
 * /api/availability — Jadwal Konsultasi Online Dokter
 *
 * GET  /my        → dokter lihat pengaturan jadwalnya sendiri
 * PUT  /my        → dokter simpan pengaturan jadwal
 * GET  /slots/:id → user lihat slot tersedia dokter (7 hari ke depan)
 *
 * Aturan sistem (tidak bisa diubah siapapun):
 *  - Jam operasional : 08:00 – 16:00 WIB
 *  - Break siang     : 12:00 – 13:00 WIB (fixed)
 *  - Slot hanya di menit :00 atau :30
 *  - Durasi sesi     : 30 menit, buffer 30 menit (interval = 60 menit)
 *  - Hari            : Senin–Jumat saja
 *
 * Dokter hanya bisa memilih startTime, endTime, dan practiceDays.
 */

const express            = require('express');
const router             = express.Router();
const auth               = require('../middleware/auth');
const doctorAuth         = require('../middleware/doctorAuth');
const Doctor             = require('../models/Doctor');
const DoctorAvailability = require('../models/DoctorAvailability');
const Consultation       = require('../models/Consultation');

const WIB_OFFSET = 7 * 60 * 60 * 1000;

// Batas sistem (fixed)
const SYS_START   = '08:00';
const SYS_END     = '16:00';
const LUNCH_START = '12:00';
const LUNCH_END   = '13:00';

// ── Helpers ───────────────────────────────────────────────────────────────────
const nowAsWIB   = () => new Date(Date.now() + WIB_OFFSET);
const wibDateStr = (wibDate) => wibDate.toISOString().slice(0, 10);
const wibDay     = (wibDate) => wibDate.getUTCDay();

const wibToUtcDate = (dateStr, timeStr) => {
    const [y, mo, d] = dateStr.split('-').map(Number);
    const [h, m]     = timeStr.split(':').map(Number);
    return new Date(Date.UTC(y, mo - 1, d, h, m, 0) - WIB_OFFSET);
};

const utcToWibHHMM = (utcDate) => {
    const w = new Date(utcDate.getTime() + WIB_OFFSET);
    return String(w.getUTCHours()).padStart(2,'0') + ':' + String(w.getUTCMinutes()).padStart(2,'0');
};

const toMin = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
};

/** Validasi: hanya menit :00 atau :30 */
const isValidMinute = (hhmm) => {
    if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return false;
    const [, m] = hhmm.split(':').map(Number);
    return m === 0 || m === 30;
};

/** Validasi: dalam batas jam operasional sistem */
const isWithinSystemHours = (hhmm) => {
    const t = toMin(hhmm);
    return t >= toMin(SYS_START) && t <= toMin(SYS_END);
};

// ── GET /my ──────────────────────────────────────────────────────────────────
router.get('/my', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ userId: req.userId });
        if (!doctor) return res.status(404).json({ message: 'Data dokter tidak ditemukan' });

        const avail = await DoctorAvailability.findOne({ doctorId: doctor._id });
        if (!avail) {
            // Kembalikan default
            return res.json({
                success      : true,
                availability : {
                    practiceDays    : [1, 2, 3, 4, 5],
                    startTime       : SYS_START,
                    endTime         : SYS_END,
                    lunchBreakStart : LUNCH_START,
                    lunchBreakEnd   : LUNCH_END,
                    sessionDuration : 30,
                    bufferDuration  : 30,
                    isActive        : false,
                    _isDefault      : true,
                    // Info batas sistem untuk frontend
                    systemStart     : SYS_START,
                    systemEnd       : SYS_END,
                },
            });
        }

        // Selalu kembalikan lunchBreak yang fixed agar frontend konsisten
        const result = avail.toObject();
        result.lunchBreakStart = LUNCH_START;
        result.lunchBreakEnd   = LUNCH_END;
        result.systemStart     = SYS_START;
        result.systemEnd       = SYS_END;

        res.json({ success: true, availability: result });
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

        const { practiceDays, startTime, endTime, isActive } = req.body;

        // ── Validasi practiceDays ─────────────────────────────────────────────
        if (!practiceDays || !Array.isArray(practiceDays) || practiceDays.length === 0)
            return res.status(400).json({ message: 'Pilih minimal satu hari praktik' });

        const validDays  = [1, 2, 3, 4, 5];
        const cleanDays  = practiceDays.map(Number).filter(d => validDays.includes(d));
        if (cleanDays.length === 0)
            return res.status(400).json({ message: 'Hari praktik hanya boleh Senin–Jumat' });

        // ── Validasi startTime & endTime ──────────────────────────────────────
        if (!startTime || !endTime)
            return res.status(400).json({ message: 'Jam mulai dan jam selesai wajib diisi' });

        if (!isValidMinute(startTime))
            return res.status(400).json({ message: 'Jam mulai hanya boleh di menit :00 atau :30' });

        if (!isValidMinute(endTime))
            return res.status(400).json({ message: 'Jam selesai hanya boleh di menit :00 atau :30' });

        if (!isWithinSystemHours(startTime))
            return res.status(400).json({ message: `Jam mulai tidak boleh sebelum ${SYS_START} atau setelah ${SYS_END}` });

        if (!isWithinSystemHours(endTime))
            return res.status(400).json({ message: `Jam selesai tidak boleh melebihi ${SYS_END}` });

        if (toMin(startTime) >= toMin(endTime))
            return res.status(400).json({ message: 'Jam mulai harus sebelum jam selesai' });

        // Jangan izinkan startTime di break siang
        const startMin = toMin(startTime);
        const endMin   = toMin(endTime);
        const lbS      = toMin(LUNCH_START);
        const lbE      = toMin(LUNCH_END);

        if (startMin >= lbS && startMin < lbE)
            return res.status(400).json({ message: `Jam mulai tidak boleh di tengah break siang (${LUNCH_START}–${LUNCH_END})` });

        // ── Cek apakah ada minimal 1 slot yang terbentuk ─────────────────────
        const SESSION  = 30, BUFFER = 30, INTERVAL = 60;
        let slotCount = 0;
        let cur = startMin;
        while (cur + SESSION <= endMin) {
            const mins = cur % 60;
            if (mins !== 0 && mins !== 30) { cur += 30 - (mins % 30); continue; }
            if (cur >= lbS && cur < lbE)   { cur = lbE; continue; }
            if (cur < lbS && cur + SESSION > lbS) { cur = lbE; continue; }
            if (cur + SESSION > endMin) break;
            slotCount++;
            cur += INTERVAL;
        }
        if (slotCount === 0)
            return res.status(400).json({ message: 'Pengaturan jam ini tidak menghasilkan slot konsultasi apapun. Pastikan ada ruang minimal 60 menit di luar break siang.' });

        // ── Cek overlap dengan janji temu offline ─────────────────────────────
        const AppointmentAvailability = require('../models/AppointmentAvailability');
        const offlineAvail = await AppointmentAvailability.findOne({ doctorId: doctor._id, isActive: true });
        if (offlineAvail) {
            // Buat instance sementara untuk generate slot online baru
            const tmpOnline = new DoctorAvailability({ doctorId: doctor._id, startTime, endTime });
            const onlineSlots  = tmpOnline.generateSlotsForDay();
            const offlineSlots = offlineAvail.generateSlots();
            const offlineTimes = new Set(offlineSlots.map(s => s.startTime));
            const overlapping  = onlineSlots.filter(s => offlineTimes.has(s.startTime));
            if (overlapping.length > 0) {
                return res.status(400).json({
                    message     : `Jadwal konsultasi online bentrok dengan janji temu offline pada slot: ${overlapping.map(s => s.startTime).join(', ')}. Sesuaikan jam agar tidak overlap.`,
                    overlapping : overlapping.map(s => s.startTime),
                });
            }
        }

        // ── Simpan ────────────────────────────────────────────────────────────
        const avail = await DoctorAvailability.findOneAndUpdate(
            { doctorId: doctor._id },
            {
                doctorId        : doctor._id,
                practiceDays    : cleanDays,
                startTime,
                endTime,
                // Break siang selalu di-reset ke nilai fixed
                lunchBreakStart : LUNCH_START,
                lunchBreakEnd   : LUNCH_END,
                sessionDuration : SESSION,
                bufferDuration  : BUFFER,
                isActive        : isActive !== false,
                updatedAt       : new Date(),
            },
            { upsert: true, new: true }
        );

        const result       = avail.toObject();
        result.systemStart = SYS_START;
        result.systemEnd   = SYS_END;

        res.json({ success: true, availability: result });
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

            const daySlots = avail.generateSlotsForDay();
            if (daySlots.length === 0) continue;

            const dayStartUTC = wibToUtcDate(dateStr, '00:00');
            const dayEndUTC   = wibToUtcDate(dateStr, '23:59');

            const bookedList = await Consultation.find({
                doctorId,
                scheduledAt : { $gte: dayStartUTC, $lte: dayEndUTC },
                status      : { $in: ['pending_payment', 'waiting_verification', 'confirmed', 'in_progress'] },
            }).select('scheduledAt');

            const bookedSet = new Set(bookedList.map(c => utcToWibHHMM(c.scheduledAt)));

            for (const slot of daySlots) {
                const startUTC = wibToUtcDate(dateStr, slot.startTime);
                const endUTC   = wibToUtcDate(dateStr, slot.endTime);

                if (startUTC.getTime() <= nowUTC.getTime()) continue;

                result.push({
                    date      : dateStr,
                    startTime : slot.startTime,
                    endTime   : slot.endTime,
                    startUtc  : startUTC.toISOString(),
                    endUtc    : endUTC.toISOString(),
                    available : !bookedSet.has(slot.startTime),
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