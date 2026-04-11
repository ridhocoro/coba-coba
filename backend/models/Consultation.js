const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    senderId:   { type: String },
    senderName: String,
    senderRole: { type: String, enum: ['user', 'doctor'] },
    message:    String,
    imageUrl:   String,
    timestamp:  { type: Date, default: Date.now },
    isRead:     { type: Boolean, default: false }
});

const refundSchema = new mongoose.Schema({
    bankName:       { type: String },
    bankCode:       { type: String },   // kode bank Xendit, mis. 'BCA', 'BNI'
    accountNumber:  { type: String },
    accountName:    { type: String },
    proofUrl:       { type: String },
    requestedAt:    { type: Date },
    processedAt:    { type: Date },
    failReason:     { type: String },
    adminId:        { type: String, ref: 'User' },
    notes:          { type: String },
    // Xendit refund / disbursement
    xenditRefundId:        { type: String },  // untuk invoice <7 hari (Refund API)
    xenditDisbursementId:  { type: String },  // untuk invoice >7 hari (Disbursement API)
    method:         { type: String, enum: ['xendit_refund','xendit_disbursement','manual'], default: 'manual' },
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
    userId:    { type: String, ref: 'User',   required: true },
    doctorId:  { type: String, ref: 'Doctor', required: true },
    paymentId:  { type: String, ref: 'ManualPayment' },
    sickLetter: { type: String, ref: 'SickLetter' },
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
            'cancelled_by_doctor', 'cancelled_by_user', 'cancelled_by_admin',
            'expired', 'refund_requested', 'refunded', 'refund_failed',
            // legacy
            'draft', 'paid', 'scheduled', 'ongoing', 'cancelled', 'rejected_payment'
        ],
        default: 'pending_payment'
    },

    // ⚠️  PERHATIAN: paymentDeadline digunakan oleh TTL index lama di MongoDB
    // (index "paymentDeadline_1" dengan expireAfterSeconds: 0).
    // Index tersebut HARUS sudah di-drop via script drop-ttl-index.js.
    // Saat pembayaran berhasil (confirmed), field ini wajib di-$unset
    // agar MongoDB tidak menghapus dokumen secara otomatis.
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
    verifiedBy:       { type: String, ref: 'User' },
    rejectedAt:       Date,
    rejectionReason:  String,

    xenditInvoiceId:     { type: String },
    xenditExternalId:    { type: String },
    xenditRefundId:      { type: String },
    xenditPaymentMethod: { type: String },
    paidAt:              { type: Date },
    amount:              { type: Number },  // biaya konsultasi saat booking (snapshot)

    refund: refundSchema,

    cancelledAt:  Date,
    cancelledBy:  { type: String, enum: ['user', 'doctor', 'admin', 'system'] },
    cancelReason: String,

    // Pilihan user setelah doctor_no_show / cancelled_by_doctor / cancelled_by_admin
    postCancelChoice: { type: String, enum: ['refund', 'reschedule', null], default: null },

    // ── Reschedule history ────────────────────────────────────────
    rescheduleHistory : [{
        from : { scheduledAt: Date, scheduledEnd: Date },
        to   : { scheduledAt: Date, scheduledEnd: Date },
        rescheduledAt : { type: Date, default: Date.now },
        reason        : { type: String, default: '' },
    }],

    createdAt: { type: Date, default: Date.now }
});

consultationSchema.index({ userId: 1, createdAt: -1 });
consultationSchema.index({ doctorId: 1, status: 1 });
consultationSchema.index({ status: 1, paymentDeadline: 1 });
consultationSchema.index({ doctorId: 1, scheduledAt: 1, status: 1 });

module.exports = mongoose.model('Consultation', consultationSchema);