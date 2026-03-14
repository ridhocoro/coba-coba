// models/Order.js
const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
    imageUrl        : { type: String, required: true },
    uploadedAt      : { type: Date, default: Date.now },
    status          : { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
    rejectedReason  : { type: String },
    reviewedAt      : { type: Date },
    reviewedBy      : { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

const orderItemSchema = new mongoose.Schema({
    medicineId          : { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine' },
    name                : String,
    price               : Number,           // harga asli
    finalPrice          : Number,           // harga setelah diskon mahasiswa (bisa 0)
    quantity            : Number,
    subtotal            : Number,           // finalPrice * quantity
    requiresPrescription: { type: Boolean, default: false },
    isFreeForStudent    : { type: Boolean, default: false }, // masuk kuota gratis mahasiswa?
});

const orderSchema = new mongoose.Schema({
    userId : { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items  : [orderItemSchema],

    // Resep
    prescription                : prescriptionSchema,
    prescriptionUploadCount     : { type: Number, default: 0 },
    prescriptionUploadWindowStart: { type: Date },
    requiresPrescription        : { type: Boolean, default: false },

    // Harga
    subtotalObat      : { type: Number, default: 0 },
    isStudentDiscount : { type: Boolean, default: false },
    studentFreeQty    : { type: Number, default: 0 }, // berapa pcs yang gratis bulan ini
    shippingCost      : { type: Number, default: 0 },
    totalAmount       : { type: Number, required: true },

    // Pengiriman
    deliveryMethod  : { type: String, enum: ['diantar','pickup'], required: true },
    shippingAddress : {
        address : String,   // reverse geocode (editable)
        detail  : String,   // no rumah, RT/RW, dll
        lat     : Number,
        lng     : Number,
        phone   : String,
    },
    distance         : { type: Number, default: 0 },
    estimatedDelivery: { type: String },

    // Pembayaran
    xenditExternalId: { type: String },
    paymentId       : { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },

    /**
     * STATUS FLOW
     * ──────────────────────────────────────────────────────────────
     * Ada resep:
     *   waiting_prescription → prescription_rejected (upload ulang)
     *                       → pending (admin approve + stok di-lock)
     *                         → expired (15 mnt, stok dilepas)
     *                         → paid → diproses
     *
     * DIANTAR:  paid → diproses → dikirim → terkirim → selesai
     *                                          └─ auto 24 jam → selesai
     *
     * PICKUP:   paid → diproses → siap_diambil (auto 30 mnt)
     *                               → selesai (admin klik) / cancelled (admin klik, atau auto 48 jam)
     *
     * Total=0:  pending → (confirm-free) → diproses langsung
     */
    status: {
        type: String,
        enum: [
            'waiting_prescription',   // menunggu verifikasi resep
            'prescription_rejected',  // resep ditolak, bisa upload ulang
            'pending',                // menunggu bayar (stok di-lock 15 mnt)
            'paid',                   // bayar berhasil via Xendit
            'diproses',               // admin sedang siapkan obat
            'dikirim',                // (diantar) sudah dikirim
            'terkirim',               // (diantar) sudah tiba
            'siap_diambil',           // (pickup) siap diambil
            'selesai',
            'expired',
            'cancelled',
        ],
        default: 'pending',
    },

    orderNumber    : { type: String, unique: true },
    paymentExpiry  : { type: Date },
    stockLockExpiry: { type: Date },

    // Timestamps untuk cron
    terkirimAt    : { type: Date },  // diantar: auto selesai 24 jam
    diprosesPaidAt: { type: Date },  // pickup: auto siap_diambil 30 mnt
    siapDiambilAt : { type: Date },  // pickup: auto cancelled 48 jam
    completedAt   : { type: Date },
    cancelledAt   : { type: Date },
    cancelReason  : { type: String },
    notes         : { type: String },

    createdAt : { type: Date, default: Date.now },
    updatedAt : { type: Date, default: Date.now },
});

// Auto order number
orderSchema.pre('save', async function (next) {
    if (!this.orderNumber) {
        const d   = new Date();
        const yy  = d.getFullYear().toString().slice(-2);
        const mm  = (d.getMonth()+1).toString().padStart(2,'0');
        const dd  = d.getDate().toString().padStart(2,'0');
        const sfx = (Date.now()%100000).toString().padStart(5,'0')
                  + Math.floor(Math.random()*10000).toString().padStart(4,'0');
        this.orderNumber = `INV/${yy}${mm}${dd}/${sfx}`;
    }
    next();
});

module.exports = mongoose.model('Order', orderSchema);