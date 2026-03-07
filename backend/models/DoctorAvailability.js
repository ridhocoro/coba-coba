/**
 * DoctorAvailability — availability konsultasi online
 *
 * Aturan yang berlaku:
 *  - Jam operasional: 08:00 – 16:00 WIB (fixed, tidak bisa diubah dokter)
 *  - Break siang   : 12:00 – 13:00 WIB (fixed, tidak bisa diubah dokter)
 *  - Slot hanya boleh di menit :00 atau :30
 *  - Durasi sesi   : 30 menit (fixed)
 *  - Buffer        : 30 menit setelah sesi (interval antar slot = 60 menit)
 *  - Hari praktik  : Senin–Jumat saja (1–5), bisa dipilih dokter
 *
 * Dokter hanya bisa memilih:
 *  - startTime   : jam mulai (min 08:00, maks sebelum endTime, hanya menit :00/:30)
 *  - endTime     : jam selesai (maks 16:00, hanya menit :00/:30)
 *  - practiceDays: subset dari [1,2,3,4,5]
 */
const mongoose = require('mongoose');

const SYSTEM_START     = '08:00';
const SYSTEM_END       = '16:00';
const LUNCH_START      = '12:00';
const LUNCH_END        = '13:00';
const SESSION_DURATION = 30;
const BUFFER_DURATION  = 30;

const doctorAvailabilitySchema = new mongoose.Schema({
    doctorId: {
        type     : mongoose.Schema.Types.ObjectId,
        ref      : 'Doctor',
        required : true,
        unique   : true,
    },

    // Hari praktik: 1=Senin ... 5=Jumat
    practiceDays: {
        type    : [Number],
        default : [1, 2, 3, 4, 5],
    },

    // Jam praktik WIB — dalam batas SYSTEM_START–SYSTEM_END, hanya menit :00/:30
    startTime : { type: String, default: SYSTEM_START },
    endTime   : { type: String, default: SYSTEM_END   },

    // Break siang: FIXED, selalu 12:00–13:00 (disimpan agar frontend bisa baca)
    lunchBreakStart : { type: String, default: LUNCH_START },
    lunchBreakEnd   : { type: String, default: LUNCH_END   },

    // Durasi & buffer: FIXED
    sessionDuration : { type: Number, default: SESSION_DURATION },
    bufferDuration  : { type: Number, default: BUFFER_DURATION  },

    isActive  : { type: Boolean, default: true },
    updatedAt : { type: Date,    default: Date.now },
});

// ── Helper internal ──────────────────────────────────────────────────────────
const toMin = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
};
const toHHMM = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
};

/**
 * Generate semua slot konsultasi online untuk satu hari.
 * Hanya slot di menit :00 atau :30, break siang 12:00-13:00 selalu dilewati.
 * Interval antar slot = 60 menit (sesi 30 mnt + buffer 30 mnt).
 */
doctorAvailabilitySchema.methods.generateSlotsForDay = function () {
    const slots      = [];
    const interval   = SESSION_DURATION + BUFFER_DURATION; // 60
    const startMin   = toMin(this.startTime);
    const endMin     = toMin(this.endTime);
    const lunchStart = toMin(LUNCH_START);
    const lunchEnd   = toMin(LUNCH_END);

    let cur = startMin;
    while (cur + SESSION_DURATION <= endMin) {
        // Paksa ke menit :00 atau :30 terdekat
        const mins = cur % 60;
        if (mins !== 0 && mins !== 30) {
            cur += 30 - (mins % 30);
            continue;
        }
        // Lewati break siang
        if (cur >= lunchStart && cur < lunchEnd) { cur = lunchEnd; continue; }
        if (cur < lunchStart && cur + SESSION_DURATION > lunchStart) { cur = lunchEnd; continue; }
        // Jangan melewati jam selesai
        if (cur + SESSION_DURATION > endMin) break;

        slots.push({ startTime: toHHMM(cur), endTime: toHHMM(cur + SESSION_DURATION) });
        cur += interval;
    }
    return slots;
};

/**
 * Cek apakah slot HH:MM valid menurut aturan availability ini.
 */
doctorAvailabilitySchema.methods.isValidSlot = function (slotHHMM) {
    return this.generateSlotsForDay().some(s => s.startTime === slotHHMM);
};

module.exports = mongoose.model('DoctorAvailability', doctorAvailabilitySchema);