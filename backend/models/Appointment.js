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
    userId   : { type: String, ref: 'User',   required: true },
    doctorId : { type: String, ref: 'Doctor', required: true },

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
    disease_category     : { type: String, default: null },   // ← TAMBAH
    category_confidence  : { type: Number, default: null },   // ← TAMBAH
    category_method      : { type: String, default: null },   // ← TAMBAH

    // ── Keterangan pembatalan/penyelesaian ────────────────────────
    cancelReason  : { type: String, default: '' },  // wajib saat cancel
    doctorNotes   : { type: String, default: '' },  // catatan dokter saat completed/no_show
    cancelledBy   : { type: String, enum: ['user', 'doctor', 'admin', ''] , default: '' },
    cancelledAt   : { type: Date },

    // ── Rekam Medis (SOAP) — diisi saat selesai ───────────────────
    medicalRecord : {
        objectiveFindings : { type: String, default: '' },
        assessment        : { type: String, default: '' }, // diagnosis — WAJIB
        plan              : { type: String, default: '' }, // rencana terapi — WAJIB
        doctorNotes       : { type: String, default: '' },
        isCompleted       : { type: Boolean, default: false },
        completedAt       : { type: Date },
    },

    // ── Reschedule ────────────────────────────────────────────────
    rescheduledFrom : {
        appointmentDate : Date,
        appointmentTime : String,
        scheduledAt     : Date,
    },
    rescheduledAt    : { type: Date },   // waktu reschedule terakhir
    rescheduleCount  : { type: Number, default: 0 }, // berapa kali sudah reschedule

    // History tiap reschedule: [ { from: {...}, to: {...}, rescheduledAt, reason } ]
    rescheduleHistory : [{
        from : {
            appointmentDate : Date,
            appointmentTime : String,
            scheduledAt     : Date,
        },
        to : {
            appointmentDate : Date,
            appointmentTime : String,
            scheduledAt     : Date,
        },
        rescheduledAt : { type: Date, default: Date.now },
        reason        : { type: String, default: '' },
    }],

    // ── Timestamps aksi ──────────────────────────────────────────
    checkedInAt  : { type: Date },
    completedAt  : { type: Date },
    noShowAt     : { type: Date },  // dicatat oleh cron

    // ── Reminder ─────────────────────────────────────────────────
    reminderSent : { type: Boolean, default: false },

    // ── Rating ───────────────────────────────────────────────────
    rating: { type: Number },

    createdAt : { type: Date, default: Date.now },
});

// Index untuk query cepat
appointmentSchema.index({ doctorId: 1, scheduledAt: 1, status: 1 });
appointmentSchema.index({ userId: 1, createdAt: -1 });
appointmentSchema.index({ scheduledAt: 1, status: 1 });  // untuk cron

module.exports = mongoose.model('Appointment', appointmentSchema);