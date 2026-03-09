/**
 * DoctorAvailability — jadwal konsultasi online per hari
 *
 * Slot fixed yang tersedia:
 *   08:30  09:30  10:30  11:30  13:30  14:30  15:30
 *
 * Dokter memilih per hari slot mana yang aktif.
 * schedule: { "1": ["08:30","09:30"], "2": ["13:30"], ... }
 * Key = hari (1=Senin … 5=Jumat sebagai string)
 * Value = array slot yang aktif untuk hari tersebut
 */
const mongoose = require('mongoose');

// Slot yang diizinkan untuk konsultasi online (FIXED — tidak bisa ditambah)
const ALLOWED_SLOTS = ['08:30','09:30','10:30','11:30','13:30','14:30','15:30'];

const doctorAvailabilitySchema = new mongoose.Schema({
    doctorId: {
        type:     mongoose.Schema.Types.ObjectId,
        ref:      'Doctor',
        required: true,
        unique:   true,
    },

    /**
     * Jadwal per hari.
     * Key = string '1'–'5' (Senin–Jumat)
     * Value = array slot aktif, subset dari ALLOWED_SLOTS
     *
     * Disimpan sebagai Map agar fleksibel.
     * Default: semua hari kosong (dokter belum set jadwal)
     */
    schedule: {
        type:    Map,
        of:      [String],
        default: { '1':[],'2':[],'3':[],'4':[],'5':[] },
    },

    isActive:  { type: Boolean, default: true },
    updatedAt: { type: Date,    default: Date.now },
});

// ── Statics ──────────────────────────────────────────────────────────────────

/** Slot yang diizinkan sistem */
doctorAvailabilitySchema.statics.ALLOWED_SLOTS = ALLOWED_SLOTS;

// ── Methods ──────────────────────────────────────────────────────────────────

/**
 * Kembalikan slot aktif untuk hari tertentu (1–5).
 * @param {number|string} dayOfWeek
 * @returns {string[]}  mis. ['08:30','09:30']
 */
doctorAvailabilitySchema.methods.getSlotsForDay = function (dayOfWeek) {
    const key  = String(dayOfWeek);
    const slots = this.schedule?.get ? this.schedule.get(key) : (this.schedule?.[key] || []);
    // Filter: hanya kembalikan slot yang ada di whitelist
    return (slots || []).filter(s => ALLOWED_SLOTS.includes(s));
};

/**
 * Cek apakah slot tertentu aktif pada hari tertentu.
 */
doctorAvailabilitySchema.methods.isSlotActive = function (dayOfWeek, slotHHMM) {
    return this.getSlotsForDay(dayOfWeek).includes(slotHHMM);
};

module.exports = mongoose.model('DoctorAvailability', doctorAvailabilitySchema);
module.exports.ALLOWED_SLOTS = ALLOWED_SLOTS;