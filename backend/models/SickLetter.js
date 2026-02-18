const mongoose = require('mongoose');

const sickLetterSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  status: {
    type: String,
    enum: ['pending', 'paid', 'approved', 'rejected', 'issued'],
    default: 'pending'
  },
  patientName: String,
  patientAge: Number,
  startDate: Date,
  endDate: Date,
  diagnosis: String,
  doctorNotes: String,
  letterNumber: String,
  pdfUrl: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SickLetter', sickLetterSchema);