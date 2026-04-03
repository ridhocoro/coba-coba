/**
 * DoctorAvailability — jadwal konsultasi online per hari
 *
 * Slot fixed yang tersedia:
 * Mulai dari 00:30 hingga 23:30 (interval 1 jam).
 *
 * Dokter memilih per hari slot mana yang aktif (Senin–Sabtu, key '1'–'6').
 * Jadwal berlaku 1 minggu: dari Senin terdekat ke depan sampai Sabtu minggu itu.
 * Dokter wajib set ulang setiap minggu.
 */
const mongoose = require('mongoose');

// Fungsi untuk meng-generate slot dari jam 00:30 hingga 23:30
const generateSlots = () => {
    const slots = [];
    for (let i = 0; i <= 23; i++) {
        const hour = String(i).padStart(2, '0');
        slots.push(`${hour}:30`);
    }
    return slots;
};

// Slot yang diizinkan untuk konsultasi online (sekarang 00:30 - 23:30)
const ALLOWED_SLOTS = generateSlots();

const doctorAvailabilitySchema = new mongoose.Schema({
    doctorId: {
        type:     String,       // UUID dari MySQL — bukan ObjectId
        ref:      'Doctor',
        required: true,
        unique:   true,
    },

    /**
     * Jadwal per hari.
     * Key = string '1'–'6' (Senin–Sabtu). Minggu (0) tidak diizinkan.
     * Value = array slot aktif, subset dari ALLOWED_SLOTS
     */
    schedule: {
        type:    Map,
        of:      [String],
        default: { '1':[],'2':[],'3':[],'4':[],'5':[],'6':[] },
    },

    /**
     * Masa berlaku jadwal (1 minggu).
     * weekStart = Senin minggu berlaku (UTC midnight WIB)
     * weekEnd   = Sabtu minggu berlaku jam 23:59:59 WIB (dalam UTC)
     * Jika weekEnd sudah lewat → jadwal expired, pasien tidak bisa booking.
     */
    weekStart: { type: Date, default: null },
    weekEnd:   { type: Date, default: null },

    isActive:  { type: Boolean, default: true },
    updatedAt: { type: Date,    default: Date.now },
});

// ── Statics ──────────────────────────────────────────────────────────────────

doctorAvailabilitySchema.statics.ALLOWED_SLOTS = ALLOWED_SLOTS;

// ── Methods ──────────────────────────────────────────────────────────────────

/**
 * Kembalikan slot aktif untuk hari tertentu (1–6).
 */
doctorAvailabilitySchema.methods.getSlotsForDay = function (dayOfWeek) {
    const key   = String(dayOfWeek);
    const slots = this.schedule?.get ? this.schedule.get(key) : (this.schedule?.[key] || []);
    return (slots || []).filter(s => ALLOWED_SLOTS.includes(s));
};

/**
 * Kembalikan semua slot aktif dari seluruh hari (flatten).
 * Contoh hasil: [ { day: 1, slot: '08:30' }, { day: 1, slot: '09:30' }, ... ]
 */
doctorAvailabilitySchema.methods.getAllActiveSlots = function () {
    const all = [];
    for (let d = 1; d <= 6; d++) {
        this.getSlotsForDay(d).forEach(s => all.push({ day: d, slot: s }));
    }
    return all;
};

/**
 * Cek apakah slot tertentu aktif pada hari tertentu.
 */
doctorAvailabilitySchema.methods.isSlotActive = function (dayOfWeek, slotHHMM) {
    return this.getSlotsForDay(dayOfWeek).includes(slotHHMM);
};

/**
 * Cek apakah jadwal masih berlaku (weekEnd belum lewat).
 */
doctorAvailabilitySchema.methods.isWeekActive = function () {
    if (!this.weekEnd) return false;
    return new Date() <= this.weekEnd;
};

module.exports = mongoose.model('DoctorAvailability', doctorAvailabilitySchema);
module.exports.ALLOWED_SLOTS = ALLOWED_SLOTS;