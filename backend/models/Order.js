// models/Order.js
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [{
        medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine' },
        name: String,
        price: Number,
        quantity: Number,
        subtotal: Number
    }],
    totalAmount: { type: Number, required: true },
    shippingAddress: {
        street: String,
        city: String,
        province: String,
        postalCode: String,
        phone: String
    },
    courier: { type: String }, // JNE, J&T, SiCepat, dll
    courierService: { type: String }, // REG, YES, OKE
    shippingCost: { type: Number, default: 0 },
    estimatedDays: { type: String },
    
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'ManualPayment' },
    
    // Status baru sesuai flow ideal
    status: {
        type: String,
        enum: [
            'awaiting_payment', // Menunggu bayar (stok di-lock)
            'paid',             // Sudah bayar, stok berkurang
            'processing',       // Diproses admin
            'shipped',          // Dikirim
            'delivered',        // Diterima
            'expired',          // Kadaluarsa (tidak bayar)
            'cancelled'         // Dibatalkan
        ],
        default: 'awaiting_payment'
    },
    
    orderNumber: { type: String, unique: true },
    
    // Lock & expiry
    stockLockExpiry: { type: Date }, // untuk lock stok sementara
    paymentExpiry: { type: Date }, // batas waktu pembayaran
    
    trackingNumber: String,
    notes: String,
    cancelledAt: Date,
    cancelReason: String,
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Generate order number before save
orderSchema.pre('save', async function(next) {
    if (!this.orderNumber) {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        this.orderNumber = `INV/${year}${month}${day}/${random}`;
    }
    next();
});

module.exports = mongoose.model('Order', orderSchema);