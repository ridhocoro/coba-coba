const mongoose = require('mongoose');

const consultationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    sickLetter: { type: mongoose.Schema.Types.ObjectId, ref: 'SickLetter' }, // BARU
    status: { 
        type: String, 
        enum: ['pending', 'waiting_payment', 'paid', 'ongoing', 'completed', 'cancelled'],
        default: 'pending'
    },
    symptoms: String,
    diagnosis: String,
    prescription: String,
    startTime: Date,
    endTime: Date,
    messages: [{
        senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        senderName: String,
        message: String,
        timestamp: { type: Date, default: Date.now },
        isRead: { type: Boolean, default: false }
    }],
    paymentVerified: { type: Boolean, default: false },
    verifiedAt: Date,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Consultation', consultationSchema);