/**
 * AppointmentAvailability — jadwal janji temu offline per hari
 *
 * Slot fixed yang tersedia:
 *   08:00  09:00  10:00  11:00  13:00  14:00  15:00
 *
 * Dokter memilih per hari slot mana yang aktif (Senin–Sabtu, key '1'–'6').
 * Jadwal berlaku 1 minggu: dari Senin terdekat ke depan sampai Sabtu minggu itu.
 */
const mongoose = require('mongoose');

// Slot yang diizinkan untuk janji temu offline (FIXED)
const ALLOWED_SLOTS = ['08:00','09:00','10:00','11:00','13:00','14:00','15:00'];

const appointmentAvailabilitySchema = new mongoose.Schema({
    doctorId: {
        type:     mongoose.Schema.Types.ObjectId,
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
     */
    weekStart: { type: Date, default: null },
    weekEnd:   { type: Date, default: null },

    isActive:  { type: Boolean, default: true },
    updatedAt: { type: Date,    default: Date.now },
});

appointmentAvailabilitySchema.statics.ALLOWED_SLOTS = ALLOWED_SLOTS;

/**
 * Kembalikan slot aktif untuk hari tertentu (1–6).
 */
appointmentAvailabilitySchema.methods.getSlotsForDay = function (dayOfWeek) {
    const key   = String(dayOfWeek);
    const slots = this.schedule?.get ? this.schedule.get(key) : (this.schedule?.[key] || []);
    return (slots || []).filter(s => ALLOWED_SLOTS.includes(s));
};

/**
 * Kembalikan semua slot aktif dari seluruh hari (flatten).
 */
appointmentAvailabilitySchema.methods.getAllActiveSlots = function () {
    const all = [];
    for (let d = 1; d <= 6; d++) {
        this.getSlotsForDay(d).forEach(s => all.push({ day: d, slot: s }));
    }
    return all;
};

/**
 * Cek apakah slot tertentu aktif pada hari tertentu.
 */
appointmentAvailabilitySchema.methods.isSlotActive = function (dayOfWeek, slotHHMM) {
    return this.getSlotsForDay(dayOfWeek).includes(slotHHMM);
};

/**
 * Cek apakah jadwal masih berlaku (weekEnd belum lewat).
 */
appointmentAvailabilitySchema.methods.isWeekActive = function () {
    if (!this.weekEnd) return false;
    return new Date() <= this.weekEnd;
};

module.exports = mongoose.model('AppointmentAvailability', appointmentAvailabilitySchema);
module.exports.ALLOWED_SLOTS = ALLOWED_SLOTS;