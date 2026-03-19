/**
 * DoctorScheduleOverride — admin blokir hari dokter (cuti/absen)
 * Berlaku untuk SEMUA slot di hari tersebut (online consultation dan janji temu).
 */
const mongoose = require('mongoose');

const doctorScheduleOverrideSchema = new mongoose.Schema({
    doctorId  : { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
    date      : { type: String, required: true }, // 'YYYY-MM-DD'
    reason    : { type: String, default: '' },
    blockedBy : { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // admin
    createdAt : { type: Date, default: Date.now },
});

// Satu dokter hanya bisa punya satu override per tanggal
doctorScheduleOverrideSchema.index({ doctorId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DoctorScheduleOverride', doctorScheduleOverrideSchema);