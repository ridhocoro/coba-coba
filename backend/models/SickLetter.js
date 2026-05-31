const mongoose = require('mongoose');

const sickLetterSchema = new mongoose.Schema({
    // Salah satu wajib diisi — konsultasi atau janji temu
    consultationId: { type: String, ref: 'Consultation', default: null },
    appointmentId:  { type: String, ref: 'Appointment',  default: null },

    userId:   { type: String, ref: 'User',   required: true },
    doctorId: { type: String, ref: 'Doctor', required: true },
    status: {
        type: String,
        enum: ['draft', 'issued'],
        default: 'draft'
    },
    diagnosis: { type: String, required: true },
    notes: String,
    patientAge:    { type: String, default: '' },
    patientGender: { type: String, default: '' },
    patientWeight: { type: String, default: '' },
    startDate: { type: Date, required: true },
    endDate:   { type: Date, required: true },
    letterNumber: { type: String, unique: true },
    pdfUrl:    String,
    issuedAt:  Date,
    createdAt: { type: Date, default: Date.now }
});

// Generate nomor surat otomatis sebelum save
sickLetterSchema.pre('save', async function(next) {
    if (!this.letterNumber) {
        const count = await mongoose.model('SickLetter').countDocuments();
        this.letterNumber = 'SK-' + Date.now().toString().slice(-6) + '-' + (count + 1).toString().padStart(3, '0');
    }
    next();
});

module.exports = mongoose.model('SickLetter', sickLetterSchema);