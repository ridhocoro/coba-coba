/**
 * AppointmentAvailability.js — Availability Janji Temu Offline
 *
 * Berbeda dengan DoctorAvailability (konsultasi online):
 *  - Slot hanya di menit :00 atau :30
 *  - Jam praktik: 08:30–11:30 dan 13:30–16:30 (default, bisa dikustomisasi dokter)
 *  - Break siang: 12:00–13:00 (tidak bisa dipilih)
 *  - Durasi sesi: 30 menit (tetap)
 *  - Senin–Jumat saja
 *  - Admin bisa override isActive
 *
 * Tidak boleh overlap dengan jadwal konsultasi online dokter yang sama.
 * Validasi overlap dilakukan di route, bukan di model.
 */
const mongoose = require('mongoose');

const appointmentAvailabilitySchema = new mongoose.Schema({
    doctorId : {
        type     : mongoose.Schema.Types.ObjectId,
        ref      : 'Doctor',
        required : true,
        unique   : true,  // satu dokter satu setting
    },

    // Hari praktik: 1=Senin, 2=Selasa, 3=Rabu, 4=Kamis, 5=Jumat
    practiceDays : { type: [Number], default: [1, 2, 3, 4, 5] },

    // Sesi pagi: default 08:30 – 11:30
    morningStart : { type: String, default: '08:30' },
    morningEnd   : { type: String, default: '11:30' },

    // Sesi sore: default 13:30 – 16:30
    afternoonStart : { type: String, default: '13:30' },
    afternoonEnd   : { type: String, default: '16:30' },

    // Break siang (tetap, tidak bisa diubah dokter)
    lunchStart : { type: String, default: '12:00' },
    lunchEnd   : { type: String, default: '13:00' },

    // Durasi slot: 30 menit (tetap)
    slotDuration : { type: Number, default: 30 },

    isActive  : { type: Boolean, default: true },
    updatedAt : { type: Date,    default: Date.now },
});

// ── Helper ───────────────────────────────────────────────────────────────────
const toMin  = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const toHHMM = (min)  => `${String(Math.floor(min / 60)).padStart(2,'0')}:${String(min % 60).padStart(2,'0')}`;

/**
 * Generate semua slot untuk satu hari.
 * Returns array of { startTime: "HH:MM", endTime: "HH:MM" }
 * Hanya menit :00 dan :30.
 */
appointmentAvailabilitySchema.methods.generateSlots = function () {
    const slots = [];
    const dur   = this.slotDuration; // 30

    const sessions = [
        { start: this.morningStart,   end: this.morningEnd   },
        { start: this.afternoonStart, end: this.afternoonEnd },
    ];

    for (const session of sessions) {
        let cur = toMin(session.start);
        const end = toMin(session.end);

        while (cur + dur <= end) {
            // Hanya menit :00 atau :30
            const mins = cur % 60;
            if (mins !== 0 && mins !== 30) {
                cur += 30;
                continue;
            }
            slots.push({
                startTime : toHHMM(cur),
                endTime   : toHHMM(cur + dur),
            });
            cur += dur;
        }
    }

    return slots;
};

/**
 * Cek apakah sebuah slot HH:MM valid (ada di grid).
 */
appointmentAvailabilitySchema.methods.isValidSlot = function (slotHHMM) {
    return this.generateSlots().some(s => s.startTime === slotHHMM);
};

module.exports = mongoose.model('AppointmentAvailability', appointmentAvailabilitySchema);