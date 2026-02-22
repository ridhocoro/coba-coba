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
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'ManualPayment' },
    status: {
        type: String,
        enum: ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'],
        default: 'pending'
    },
    orderNumber: { type: String, unique: true },
    estimatedDelivery: Date,
    trackingNumber: String,
    notes: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Generate order number before save
orderSchema.pre('save', async function(next) {
    if (!this.orderNumber) {
        const count = await mongoose.model('Order').countDocuments();
        this.orderNumber = 'ORD-' + Date.now().toString().slice(-8) + '-' + (count + 1).toString().padStart(3, '0');
    }
    next();
});

module.exports = mongoose.model('Order', orderSchema);