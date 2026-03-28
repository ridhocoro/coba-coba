/**
 * DoctorScheduleOverride — admin blokir hari dokter (cuti/absen)
 * Berlaku untuk SEMUA slot di hari tersebut (online consultation dan janji temu).
 */
const mongoose = require('mongoose');

const doctorScheduleOverrideSchema = new mongoose.Schema({
    doctorId  : { type: String, ref: 'Doctor', required: true },
    date      : { type: String, required: true }, // 'YYYY-MM-DD'
    reason    : { type: String, default: '' },
    blockedBy : { type: String, ref: 'User' }, // admin
    createdAt : { type: Date, default: Date.now },
});

// Satu dokter hanya bisa punya satu override per tanggal
doctorScheduleOverrideSchema.index({ doctorId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DoctorScheduleOverride', doctorScheduleOverrideSchema);