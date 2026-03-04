/**
 * DoctorAvailability — aturan availability dokter
 *
 * Semua jam praktik disimpan sebagai string "HH:MM" dalam WIB (UTC+7).
 * Konversi ke UTC hanya dilakukan saat generate startUtc/endUtc untuk frontend.
 *
 * Aturan slot:
 *  - Interval = sessionDuration (30 mnt) + bufferDuration (30 mnt) = 60 mnt
 *  - Break siang: tidak ada slot yang dimulai di rentang [lunchBreakStart, lunchBreakEnd)
 *  - Slot tidak boleh melewati jam selesai atau melewati break siang
 */
const mongoose = require('mongoose');

const doctorAvailabilitySchema = new mongoose.Schema({
    doctorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Doctor',
        required: true,
        unique: true
    },

    // Hari praktik: 0=Minggu, 1=Senin, ..., 5=Jumat, 6=Sabtu
    practiceDays: {
        type: [Number],
        default: [1, 2, 3, 4, 5]
    },

    // Jam praktik dalam WIB, format "HH:MM"
    startTime:      { type: String, default: '08:00' },
    endTime:        { type: String, default: '16:00' },

    // Durasi sesi + buffer (buffer selalu 30 mnt, tidak bisa diubah dokter)
    sessionDuration: { type: Number, default: 30 },
    bufferDuration:  { type: Number, default: 30 },

    // Break siang dalam WIB
    lunchBreakStart: { type: String, default: '12:00' },
    lunchBreakEnd:   { type: String, default: '13:00' },

    isActive: { type: Boolean, default: true },
    updatedAt: { type: Date, default: Date.now }
});

// ── Helper internal ──────────────────────────────────────────────────────────
const toMin = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
};
const toHHMM = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/**
 * Generate semua slot untuk satu hari.
 * Returns array of { startTime: "HH:MM", endTime: "HH:MM" } dalam WIB.
 */
doctorAvailabilitySchema.methods.generateSlotsForDay = function () {
    const slots = [];
    const interval = this.sessionDuration + this.bufferDuration; // 60 mnt

    const startMin   = toMin(this.startTime);
    const endMin     = toMin(this.endTime);
    const lunchStart = toMin(this.lunchBreakStart);
    const lunchEnd   = toMin(this.lunchBreakEnd);

    let cur = startMin;
    while (cur + this.sessionDuration <= endMin) {
        // Lewati break siang
        if (cur >= lunchStart && cur < lunchEnd) {
            cur = lunchEnd;
            continue;
        }
        // Sesi tidak boleh selesai melewati jam break siang
        if (cur < lunchStart && cur + this.sessionDuration > lunchStart) {
            cur = lunchEnd;
            continue;
        }
        // Sesi tidak boleh melewati jam selesai
        if (cur + this.sessionDuration > endMin) break;

        slots.push({
            startTime: toHHMM(cur),
            endTime:   toHHMM(cur + this.sessionDuration),
        });

        cur += interval;
    }

    return slots;
};

/**
 * Validasi apakah sebuah slot WIB ("HH:MM") valid menurut aturan availability.
 * Dipakai backend saat booking untuk mencegah bypass frontend.
 */
doctorAvailabilitySchema.methods.isValidSlot = function (slotHHMM) {
    return this.generateSlotsForDay().some(s => s.startTime === slotHHMM);
};

module.exports = mongoose.model('DoctorAvailability', doctorAvailabilitySchema);
