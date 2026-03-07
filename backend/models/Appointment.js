/**
 * Appointment.js — Model Janji Temu Offline
 *
 * Status flow:
 *   scheduled → checked_in → completed
 *   scheduled → no_show        (auto cron: +30 mnt sejak appointmentTime, dokter belum check-in)
 *   scheduled → cancelled_by_user / cancelled_by_doctor / cancelled_by_admin
 *
 * Catatan waktu:
 *   - appointmentDate: Date (UTC midnight)
 *   - appointmentTime: String "HH:MM" dalam WIB
 *   - scheduledAt    : Date UTC — gabungan date + time, untuk perbandingan cron
 */
const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
    // ── Relasi ────────────────────────────────────────────────────
    userId   : { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
    doctorId : { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },

    // ── Waktu ─────────────────────────────────────────────────────
    appointmentDate : { type: Date,   required: true }, // UTC midnight tanggal janji
    appointmentTime : { type: String, required: true }, // "HH:MM" WIB, misal "09:00"
    scheduledAt     : { type: Date,   required: true }, // UTC datetime gabungan, untuk cron & sort
    endTime         : { type: String, required: true }, // "HH:MM" WIB waktu selesai slot

    // ── Status ────────────────────────────────────────────────────
    status: {
        type: String,
        enum: [
            'scheduled',
            'checked_in',
            'completed',
            'no_show',
            'cancelled_by_user',
            'cancelled_by_doctor',
            'cancelled_by_admin',
        ],
        default: 'scheduled',
    },

    // ── Konten ────────────────────────────────────────────────────
    complaint : { type: String, default: '' },  // keluhan singkat dari user

    // ── Keterangan pembatalan/penyelesaian ────────────────────────
    cancelReason  : { type: String, default: '' },  // wajib saat cancel
    doctorNotes   : { type: String, default: '' },  // catatan dokter saat completed/no_show
    cancelledBy   : { type: String, enum: ['user', 'doctor', 'admin', ''] , default: '' },
    cancelledAt   : { type: Date },

    // ── Reschedule ────────────────────────────────────────────────
    rescheduledFrom : {
        appointmentDate : Date,
        appointmentTime : String,
        scheduledAt     : Date,
    },
    rescheduledAt : { type: Date },  // waktu user melakukan reschedule

    // ── Timestamps aksi ──────────────────────────────────────────
    checkedInAt  : { type: Date },
    completedAt  : { type: Date },
    noShowAt     : { type: Date },  // dicatat oleh cron

    // ── Reminder ─────────────────────────────────────────────────
    reminderSent : { type: Boolean, default: false },

    createdAt : { type: Date, default: Date.now },
});

// Index untuk query cepat
appointmentSchema.index({ doctorId: 1, scheduledAt: 1, status: 1 });
appointmentSchema.index({ userId: 1, createdAt: -1 });
appointmentSchema.index({ scheduledAt: 1, status: 1 });  // untuk cron

module.exports = mongoose.model('Appointment', appointmentSchema);