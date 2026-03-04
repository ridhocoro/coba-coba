const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    senderId:   { type: mongoose.Schema.Types.ObjectId },
    senderName: String,
    senderRole: { type: String, enum: ['user', 'doctor'] },
    message:    String,
    imageUrl:   String,
    timestamp:  { type: Date, default: Date.now },
    isRead:     { type: Boolean, default: false }
});

const refundSchema = new mongoose.Schema({
    bankName:      { type: String },
    accountNumber: { type: String },
    accountName:   { type: String },
    proofUrl:      { type: String },   // bukti pembayaran asli (untuk cross-check)
    requestedAt:   { type: Date },
    processedAt:   { type: Date },
    failReason:    { type: String },   // alasan admin tolak refund
    adminId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const consultationSchema = new mongoose.Schema({
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
    doctorId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'ManualPayment' },
    sickLetter:{ type: mongoose.Schema.Types.ObjectId, ref: 'SickLetter' },

    // Tipe konsultasi (voice_call sudah dihapus)
    consultationType: {
        type: String,
        enum: ['chat', 'video_call'],
        default: 'chat'
    },

    // Slot terjadwal (selalu scheduled, instant tidak lagi dipakai untuk konsultasi online)
    scheduleType: {
        type: String,
        enum: ['instant', 'scheduled'],
        default: 'scheduled'
    },

    // Jadwal slot (WIB disimpan sebagai UTC di MongoDB)
    scheduledAt:    Date,   // waktu mulai slot
    scheduledEnd:   Date,   // waktu selesai slot (scheduledAt + 30 menit)

    // Lock slot: slot di-lock 15 mnt sejak pending_payment
    slotLockExpires: Date,

    // ── Status ────────────────────────────────────────────────────────────────
    // pending_payment  → user pilih slot, belum bayar (slot terkunci 15 mnt)
    // waiting_verification → user sudah upload bukti, menunggu admin
    // confirmed        → admin verifikasi bayar
    // in_progress      → dokter klik Start
    // completed        → dokter klik End
    // no_show          → dokter End tapi user tidak merespons
    // doctor_no_show   → dokter tidak klik Start 15 mnt setelah jam mulai
    // cancelled_by_doctor → admin/dokter batalkan setelah confirmed
    // expired          → tidak bayar dalam 15 menit
    // refund_requested → user ajukan refund setelah cancelled_by_doctor
    // refunded         → admin sudah transfer refund
    // refund_failed    → admin tolak refund
    status: {
        type: String,
        enum: [
            'pending_payment',
            'waiting_verification',
            'confirmed',
            'in_progress',
            'completed',
            'no_show',
            'doctor_no_show',
            'cancelled_by_doctor',
            'expired',
            'refund_requested',
            'refunded',
            'refund_failed',
            // legacy (tetap ada agar tidak error pada data lama)
            'draft', 'paid', 'scheduled', 'ongoing', 'cancelled', 'rejected_payment'
        ],
        default: 'pending_payment'
    },

    // Deadline bayar 15 menit (= slotLockExpires)
    paymentDeadline: Date,

    // ── Keluhan ───────────────────────────────────────────────────────────────
    symptoms:       String,
    medicalHistory: String,
    attachmentUrls: [String],

    // ── Hasil Konsultasi ──────────────────────────────────────────────────────
    diagnosis:    String,
    prescription: String,

    // ── Rating ───────────────────────────────────────────────────────────────
    rating:        { type: Number, min: 1, max: 5 },
    ratingComment: String,
    ratedAt:       Date,

    // ── Waktu sesi ────────────────────────────────────────────────────────────
    startTime: Date,
    endTime:   Date,

    // ── Chat ─────────────────────────────────────────────────────────────────
    messages: [messageSchema],

    // ── Pembayaran ────────────────────────────────────────────────────────────
    paymentProofUrl:  String,    // bukti transfer dari user
    transferDate:     Date,
    paymentVerified:  { type: Boolean, default: false },
    verifiedAt:       Date,
    verifiedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectedAt:       Date,
    rejectionReason:  String,

    // ── Refund ────────────────────────────────────────────────────────────────
    refund: refundSchema,

    // ── Cancel ───────────────────────────────────────────────────────────────
    cancelledAt:  Date,
    cancelledBy:  { type: String, enum: ['user', 'doctor', 'admin', 'system'] },
    cancelReason: String,

    createdAt: { type: Date, default: Date.now }
});

consultationSchema.index({ userId: 1, createdAt: -1 });
consultationSchema.index({ doctorId: 1, status: 1 });
consultationSchema.index({ status: 1, paymentDeadline: 1 });
consultationSchema.index({ doctorId: 1, scheduledAt: 1, status: 1 }); // untuk cek race condition slot

module.exports = mongoose.model('Consultation', consultationSchema);
