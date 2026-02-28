// models/Medicine.js
const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema({
    name: { type: String, required: true },
    genericName: String,
    description: String,
    category: {
        type: String,
        enum: ['obat_bebas', 'obat_bebas_terbatas', 'obat_keras', 'antibiotik', 'vitamin', 'alat_kesehatan'],
        required: true
    },
    price: { type: Number, required: true },
    stock: { type: Number, default: 0, required: true },
    lockedStock: { type: Number, default: 0 }, // ✅ Stok yang di-lock sementara
    stockLockExpiry: Date, // ✅ Waktu expiry lock
    unit: { type: String, default: 'strip' },
    prescription: { type: Boolean, default: false },
    image: String,
    manufacturer: String,
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

// ✅ Virtual untuk stok tersedia (stock - lockedStock)
medicineSchema.virtual('availableStock').get(function() {
    return this.stock - (this.lockedStock || 0);
});

medicineSchema.set('toJSON', { virtuals: true });
medicineSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Medicine', medicineSchema);