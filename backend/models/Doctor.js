const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
    userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name:           { type: String, required: true },
    specialization: { type: String, required: true },
    qualification:  String,
    gender:         { type: String, default: '' },
    experience:     Number,
    consultationFee:{ type: Number, required: true },
    availableDays: [{
        day: String,
        slots: [{
            startTime:   String,
            endTime:     String,
            isAvailable: { type: Boolean, default: true },
        }],
    }],
    rating:       { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
    isActive:     { type: Boolean, default: true },
    isOnline:     { type: Boolean, default: false },
    bio:          String,
    photo:        String,
    signatureUrl: { type: String, default: '' }, // tanda tangan dokter untuk surat sakit
    consultationSettings: {
        allowChat:      { type: Boolean, default: true },
        allowVideoCall: { type: Boolean, default: true },
    },
});

module.exports = mongoose.model('Doctor', doctorSchema);