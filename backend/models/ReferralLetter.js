const mongoose = require('mongoose');

/**
 * ReferralLetter — Surat Rujukan Pasien
 * Bisa dibuat dari konsultasi online ATAU janji temu (appointment).
 * Hanya satu sumber per dokumen (consultationId XOR appointmentId).
 */
const referralLetterSchema = new mongoose.Schema({
    // ── Sumber: salah satu harus diisi ───────────────────────────
    consultationId: { type: String, ref: 'Consultation', default: null },
    appointmentId:  { type: String, ref: 'Appointment',  default: null },

    // ── Relasi ───────────────────────────────────────────────────
    userId:   { type: String, ref: 'User',   required: true },
    doctorId: { type: String, ref: 'Doctor', required: true },

    // ── Status ───────────────────────────────────────────────────
    status: {
        type: String,
        enum: ['draft', 'issued'],
        default: 'draft'
    },

    // ── Isi Surat Rujukan ─────────────────────────────────────────
    diagnosis:        { type: String, required: true },   // diagnosis saat merujuk
    referralReason:   { type: String, required: true },   // alasan rujukan
    referralTo:       { type: String, required: true },   // rujuk ke mana (RS / poli / dokter)
    referralSpecialty:{ type: String, default: '' },       // spesialisasi tujuan
    notes:            { type: String, default: '' },       // catatan tambahan

    // ── Data Pasien (snapshot saat surat dibuat) ──────────────────
    patientAge:    { type: String, default: '' },
    patientGender: { type: String, default: '' },
    patientWeight: { type: String, default: '' },

    // ── Metadata Surat ────────────────────────────────────────────
    letterNumber: { type: String, unique: true },
    pdfUrl:       String,
    issuedAt:     Date,
    createdAt:    { type: Date, default: Date.now },
});

// Auto-generate nomor surat sebelum save
referralLetterSchema.pre('save', async function (next) {
    if (!this.letterNumber) {
        const count = await mongoose.model('ReferralLetter').countDocuments();
        this.letterNumber = 'RJ-' + Date.now().toString().slice(-6) + '-' + (count + 1).toString().padStart(3, '0');
    }
    next();
});

module.exports = mongoose.model('ReferralLetter', referralLetterSchema);