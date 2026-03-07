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
    proofUrl:      { type: String },
    requestedAt:   { type: Date },
    processedAt:   { type: Date },
    failReason:    { type: String },
    adminId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes:         { type: String }
});

// Obat dalam resep
const medicineItemSchema = new mongoose.Schema({
    name:         { type: String, required: true },
    dose:         String,   // misal "500 mg"
    form:         String,   // tablet/kapsul/sirup
    frequency:    String,   // "3x sehari"
    instructions: String,   // "sesudah makan"
    quantity:     String,   // "10 tablet"
}, { _id: false });

// Resep digital terstruktur
const prescriptionDataSchema = new mongoose.Schema({
    prescriptionNumber: String,
    issuedAt:           Date,
    validUntil:         Date,   // berlaku 7 hari
    patientAge:         String,
    patientGender:      String,
    patientWeight:      String,
    medicines:          [medicineItemSchema],
    doctorNotes:        String,
    isUsed:             { type: Boolean, default: false }, // 1x pembelian
    usedAt:             Date,
}, { _id: false });

// Rekam Medis (SOAP)
const medicalRecordSchema = new mongoose.Schema({
    // S = Subjective (keluhan — sudah ada di consultation.symptoms)
    // O = Objective
    objectiveFindings:   String,   // pemeriksaan fisik / temuan objektif
    // A = Assessment
    assessment:          String,   // diagnosis
    // P = Plan
    plan:                String,   // rencana terapi
    doctorNotes:         String,   // catatan tambahan dokter
    isCompleted:         { type: Boolean, default: false },
    completedAt:         Date,
}, { _id: false });

const consultationSchema = new mongoose.Schema({
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
    doctorId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    paymentId:  { type: mongoose.Schema.Types.ObjectId, ref: 'ManualPayment' },
    sickLetter: { type: mongoose.Schema.Types.ObjectId, ref: 'SickLetter' },
    // medicalRecord & prescriptionData disimpan sebagai embedded subdocument (lihat bawah)
    // prescriptionDoc & medicalRecord sebagai ObjectId REF dihapus untuk menghindari schema conflict

    consultationType: { type: String, enum: ['chat', 'video_call'], default: 'chat' },
    scheduleType:     { type: String, enum: ['instant', 'scheduled'], default: 'scheduled' },

    scheduledAt:     Date,
    scheduledEnd:    Date,
    slotLockExpires: Date,

    status: {
        type: String,
        enum: [
            'pending_payment', 'waiting_verification', 'confirmed',
            'in_progress', 'completed', 'no_show', 'doctor_no_show',
            'cancelled_by_doctor', 'expired', 'refund_requested',
            'refunded', 'refund_failed',
            // legacy
            'draft', 'paid', 'scheduled', 'ongoing', 'cancelled', 'rejected_payment'
        ],
        default: 'pending_payment'
    },

    paymentDeadline: Date,
    symptoms:        String,
    medicalHistory:  String,
    attachmentUrls:  [String],

    // ── Hasil Konsultasi ──────────────────────────────────────────
    diagnosis:        String,      // legacy single string
    prescription:     String,      // legacy single string

    // ── Rekam Medis (SOAP) ────────────────────────────────────────
    medicalRecord: medicalRecordSchema,

    // ── Resep Digital Terstruktur ─────────────────────────────────
    prescriptionData: prescriptionDataSchema,

    // ── Rating ────────────────────────────────────────────────────
    rating:        { type: Number, min: 1, max: 5 },
    ratingComment: String,
    ratedAt:       Date,

    startTime: Date,
    endTime:   Date,
    messages:  [messageSchema],

    paymentProofUrl:  String,
    transferDate:     Date,
    paymentVerified:  { type: Boolean, default: false },
    verifiedAt:       Date,
    verifiedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectedAt:       Date,
    rejectionReason:  String,

    xenditInvoiceId:     { type: String },
    xenditExternalId:    { type: String },
    xenditRefundId:      { type: String },
    xenditPaymentMethod: { type: String },
    paidAt:              { type: Date },

    refund: refundSchema,

    cancelledAt:  Date,
    cancelledBy:  { type: String, enum: ['user', 'doctor', 'admin', 'system'] },
    cancelReason: String,

    createdAt: { type: Date, default: Date.now }
});

consultationSchema.index({ userId: 1, createdAt: -1 });
consultationSchema.index({ doctorId: 1, status: 1 });
consultationSchema.index({ status: 1, paymentDeadline: 1 });
consultationSchema.index({ doctorId: 1, scheduledAt: 1, status: 1 });

module.exports = mongoose.model('Consultation', consultationSchema);