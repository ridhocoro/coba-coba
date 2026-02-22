const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  appointmentDate: { type: Date, required: true },
  appointmentTime: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'rejected', 'completed', 'cancelled'], // ✅ tambah 'rejected'
    default: 'pending'
  },
  complaint: String,
  queueNumber: Number,
  notes: String,
  doctorNotes: String, // catatan dari dokter (alasan reject dll)
  rejectionReason: String, // alasan penolakan
  completedAt: Date,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Appointment', appointmentSchema);