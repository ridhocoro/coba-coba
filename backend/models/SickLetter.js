const mongoose = require('mongoose');

const sickLetterSchema = new mongoose.Schema({
    consultationId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Consultation', 
        required: true,
        unique: true // Satu konsultasi hanya bisa punya satu surat sakit
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    status: {
        type: String,
        enum: ['draft', 'issued'],
        default: 'draft'
    },
    diagnosis: { type: String, required: true },
    notes: String,
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    letterNumber: { type: String, unique: true },
    pdfUrl: String,
    issuedAt: Date,
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