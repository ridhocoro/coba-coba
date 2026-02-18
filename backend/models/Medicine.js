const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  genericName: String,
  manufacturer: String,
  category: { type: String, enum: ['obat_bebas', 'obat_bebas_terbatas', 'obat_keras', 'antibiotik'] },
  price: { type: Number, required: true },
  stock: { type: Number, required: true },
  description: String,
  indications: String,
  dosage: String,
  sideEffects: String,
  image: String,
  prescription: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true }
});

module.exports = mongoose.model('Medicine', medicineSchema);