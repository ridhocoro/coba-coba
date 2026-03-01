const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    senderId: { type: mongoose.Schema.Types.ObjectId },
    senderName: String,
    senderRole: { type: String, enum: ['user', 'doctor'] },
    message: String,
    imageUrl: String,
    timestamp: { type: Date, default: Date.now },
    isRead: { type: Boolean, default: false }
});

const consultationSchema = new mongoose.Schema({
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    paymentId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    sickLetter: { type: mongoose.Schema.Types.ObjectId, ref: 'SickLetter' },

    // Tipe konsultasi
    consultationType: {
        type: String,
        enum: ['chat', 'voice_call', 'video_call'],
        default: 'chat'
    },

    // Instant = langsung setelah bayar; Scheduled = tunggu konfirmasi jadwal
    scheduleType: {
        type: String,
        enum: ['instant', 'scheduled'],
        default: 'instant'
    },
    scheduledAt: Date,

    // ── Status ────────────────────────────────────────────────────
    // draft → pending_payment
    // pending_payment → paid | expired | rejected_payment
    // paid → ongoing (instant) | scheduled (scheduled) | cancelled
    // scheduled → ongoing | no_show | cancelled (max 1 hari sebelum jadwal)
    // ongoing → completed
    status: {
        type: String,
        enum: [
            'draft',
            'pending_payment',
            'paid',
            'scheduled',
            'ongoing',
            'completed',
            'cancelled',
            'expired',
            'rejected_payment',
            'no_show'
        ],
        default: 'draft'
    },

    // Deadline 15 menit dari saat pending_payment
    paymentDeadline: Date,

    // ── Keluhan ───────────────────────────────────────────────────
    symptoms: String,
    medicalHistory: String,
    attachmentUrls: [String],

    // ── Hasil Konsultasi ──────────────────────────────────────────
    diagnosis: String,
    prescription: String,

    // ── Rating pasien ─────────────────────────────────────────────
    rating: { type: Number, min: 1, max: 5 },
    ratingComment: String,
    ratedAt: Date,

    // ── Waktu ─────────────────────────────────────────────────────
    startTime: Date,
    endTime: Date,

    // ── Chat ──────────────────────────────────────────────────────
    messages: [messageSchema],

    // ── Pembayaran ────────────────────────────────────────────────
    paymentVerified: { type: Boolean, default: false },
    verifiedAt: Date,
    rejectedAt: Date,
    rejectionReason: String,

    // ── Cancel ────────────────────────────────────────────────────
    cancelledAt: Date,
    cancelledBy: { type: String, enum: ['user', 'doctor', 'admin', 'system'] },
    cancelReason: String,

    createdAt: { type: Date, default: Date.now }
});

consultationSchema.index({ userId: 1, createdAt: -1 });
consultationSchema.index({ doctorId: 1, status: 1 });
consultationSchema.index({ status: 1, paymentDeadline: 1 });

module.exports = mongoose.model('Consultation', consultationSchema);