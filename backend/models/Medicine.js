// models/Medicine.js
const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema({
    name                : { type: String, required: true, trim: true },
    genericName         : { type: String, trim: true },
    description         : { type: String },
    category            : {
        type    : String,
        enum    : ['obat_bebas','obat_bebas_terbatas','obat_keras','antibiotik','vitamin','alat_kesehatan'],
        required: true,
    },
    price               : { type: Number, required: true, min: 0 },
    stock               : { type: Number, required: true, default: 0, min: 0 },
    lockedStock         : { type: Number, default: 0 },
    minStock            : { type: Number, default: 10 },  // batas minimum stok (admin set per item)
    unit                : { type: String, default: 'tablet' },
    requiresPrescription: { type: Boolean, default: false },

    // Kuota gratis mahasiswa
    availableForStudentQuota: { type: Boolean, default: false }, // toggle admin
    // (kuota 8pcs/bulan/mahasiswa dicek di Order, bukan di Medicine)

    image               : { type: String },
    manufacturer        : { type: String },
    isActive            : { type: Boolean, default: true },
    createdAt           : { type: Date, default: Date.now },
    updatedAt           : { type: Date, default: Date.now },
});

// Stok yang benar-benar bisa dibeli
medicineSchema.virtual('availableStock').get(function () {
    return Math.max(0, (this.stock || 0) - (this.lockedStock || 0));
});

medicineSchema.set('toJSON',   { virtuals: true });
medicineSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Medicine', medicineSchema);