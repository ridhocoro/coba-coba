  const mongoose = require('mongoose');

  const paymentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    transactionId: { type: String, unique: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'idr' },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending'
    },
    paymentMethod: String,
    paymentType: {
      type: String,
      enum: ['consultation', 'sick_letter', 'medicine', 'appointment']
    },
    referenceId: { type: mongoose.Schema.Types.ObjectId },
    stripePaymentIntentId: String,
    paidAt: Date,
    createdAt: { type: Date, default: Date.now }
  });

  paymentSchema.pre('save', function(next) {
    if (!this.transactionId) {
      this.transactionId = 'TRX-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
    next();
  });

  module.exports = mongoose.model('Payment', paymentSchema);