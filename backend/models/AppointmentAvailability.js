/**
 * AppointmentAvailability — availability janji temu offline
 *
 * Aturan yang berlaku:
 *  - Jam operasional: 08:00 – 16:00 WIB (fixed, tidak bisa diubah dokter)
 *  - Break siang   : 12:00 – 13:00 WIB (fixed, tidak bisa diubah dokter)
 *  - Slot hanya boleh di menit :00 atau :30
 *  - Durasi sesi   : 30 menit (fixed)
 *  - Tidak ada buffer — slot langsung berurutan setiap 30 menit
 *  - Hari praktik  : Senin–Jumat saja (1–5)
 *
 * Dokter hanya bisa memilih:
 *  - morningStart / morningEnd    : sesi pagi dalam 08:00–12:00
 *  - afternoonStart / afternoonEnd: sesi sore dalam 13:00–16:00
 *  - practiceDays : subset dari [1,2,3,4,5]
 *
 * Tidak boleh overlap dengan jadwal konsultasi online dokter yang sama.
 * Validasi overlap dilakukan di route, bukan di model.
 */
const mongoose = require('mongoose');

const SYSTEM_START   = '08:00';
const SYSTEM_END     = '16:00';
const LUNCH_START    = '12:00';
const LUNCH_END      = '13:00';
const SLOT_DURATION  = 30;

const appointmentAvailabilitySchema = new mongoose.Schema({
    doctorId : {
        type     : mongoose.Schema.Types.ObjectId,
        ref      : 'Doctor',
        required : true,
        unique   : true,
    },

    // Hari praktik: 1=Senin ... 5=Jumat
    practiceDays : { type: [Number], default: [1, 2, 3, 4, 5] },

    // Sesi pagi: dalam batas 08:00–12:00, hanya menit :00/:30
    morningStart : { type: String, default: '08:00' },
    morningEnd   : { type: String, default: '12:00' },

    // Sesi sore: dalam batas 13:00–16:00, hanya menit :00/:30
    afternoonStart : { type: String, default: '13:00' },
    afternoonEnd   : { type: String, default: '16:00' },

    // Durasi slot: FIXED 30 menit
    slotDuration : { type: Number, default: SLOT_DURATION },

    isActive  : { type: Boolean, default: true },
    updatedAt : { type: Date,    default: Date.now },
});

// ── Helper internal ──────────────────────────────────────────────────────────
const toMin  = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const toHHMM = (min)  => `${String(Math.floor(min / 60)).padStart(2,'0')}:${String(min % 60).padStart(2,'0')}`;

/**
 * Generate semua slot janji temu untuk satu hari.
 * Returns array of { startTime: "HH:MM", endTime: "HH:MM" }
 * Slot berurutan tiap 30 menit (tidak ada buffer).
 * Sesi pagi dan sore dipisah oleh break siang 12:00–13:00 (fixed).
 */
appointmentAvailabilitySchema.methods.generateSlots = function () {
    const slots = [];

    const sessions = [
        { start: this.morningStart,   end: this.morningEnd   },
        { start: this.afternoonStart, end: this.afternoonEnd },
    ];

    for (const session of sessions) {
        let cur       = toMin(session.start);
        const end     = toMin(session.end);

        while (cur + SLOT_DURATION <= end) {
            // Pastikan menit :00 atau :30 (seharusnya sudah, tapi jaga-jaga)
            const mins = cur % 60;
            if (mins !== 0 && mins !== 30) { cur += 30 - (mins % 30); continue; }

            slots.push({
                startTime : toHHMM(cur),
                endTime   : toHHMM(cur + SLOT_DURATION),
            });
            cur += SLOT_DURATION;
        }
    }

    return slots;
};

/**
 * Cek apakah slot HH:MM valid menurut aturan availability ini.
 */
appointmentAvailabilitySchema.methods.isValidSlot = function (slotHHMM) {
    return this.generateSlots().some(s => s.startTime === slotHHMM);
};

module.exports = mongoose.model('AppointmentAvailability', appointmentAvailabilitySchema);