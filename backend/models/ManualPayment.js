const mongoose = require('mongoose');

const manualPaymentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    transactionId: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    paymentType: { 
        type: String, 
        enum: ['consultation', 'appointment', 'sick_letter', 'medicine'],
        required: true 
    },
    referenceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    bankName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    accountName: { type: String, required: true },
    transferDate: Date,
    transferProof: String,
    status: { 
        type: String, 
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending'
    },
    adminNotes: String,
    verifiedAt: Date,
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ManualPayment', manualPaymentSchema);