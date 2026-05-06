/**
 * ClinicSettings — pengaturan klinik yang hanya bisa diubah admin.
 * Hanya ada 1 dokumen (singleton), diidentifikasi dengan key: 'main'.
 */
const mongoose = require('mongoose');

const clinicSettingsSchema = new mongoose.Schema({
    key:         { type: String, default: 'main', unique: true },
    clinicName:  { type: String, default: 'Klinik Pratama IPB' },
    clinicAddress:{ type: String, default: 'Bogor, Jawa Barat' },
    clinicPhone: { type: String, default: '' },
    signLocation: { type: String, default: 'Bogor' },
    logoUrl:     { type: String, default: '' }, // path ke file logo/stempel
    stampUrl:    { type: String, default: '' }, // path ke file stempel (bisa sama dengan logo)
    updatedAt:   { type: Date, default: Date.now },
});

module.exports = mongoose.model('ClinicSettings', clinicSettingsSchema);