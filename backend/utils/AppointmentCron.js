/**
 * AppointmentCron.js
 *
 * Dijalankan setiap menit. Dua tugas:
 *
 * 1. AUTO NO-SHOW
 *    Appointment status 'scheduled' & scheduledAt + 30 menit sudah lewat
 *    → status: no_show, noShowAt dicatat
 *    → notif ke user & dokter
 *
 * 2. REMINDER H-24 JAM
 *    Appointment status 'scheduled' & belum dikirim reminder
 *    & scheduledAt antara 23–25 jam dari sekarang
 *    → notif ke user
 *    → reminderSent = true
 */

const Appointment = require('../models/Appointment');
const { createNotification } = require('./notificationHelper');

const WIB_OFFSET = 7 * 60 * 60 * 1000;
const fmtWIB = (d) =>
    new Date(d.getTime() + WIB_OFFSET)
        .toISOString().replace('T', ' ').slice(0, 16) + ' WIB';

const fmtTgl = (d) =>
    new Date(d.getTime() + WIB_OFFSET)
        .toLocaleDateString('id-ID', {
            day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
        });

let _io    = null;
let _timer = null;

// ── 1. Auto No-Show ────────────────────────────────────────────────────────
async function runAutoNoShow() {
    const now        = new Date();
    const threshold  = new Date(now.getTime() - 30 * 60 * 1000); // -30 menit

    try {
        const stale = await Appointment.find({
            status      : 'scheduled',
            scheduledAt : { $lte: threshold },
        })
        .populate('userId',   'name')
        .populate('doctorId', 'name userId');

        for (const appt of stale) {
            // Atomic update — cegah double processing
            const updated = await Appointment.findOneAndUpdate(
                { _id: appt._id, status: 'scheduled' },
                { $set: { status: 'no_show', noShowAt: now } },
                { new: true }
            );
            if (!updated) continue;

            console.log(`[AppointmentCron] No-show: ${appt._id} | ${appt.appointmentTime} | ${appt.userId?.name}`);

            // Notif user
            await createNotification({
                userId  : appt.userId._id,
                type    : 'appointment_reminder',
                title   : 'Janji Temu: Tidak Hadir',
                message : `Anda tidak hadir pada janji temu ${fmtTgl(appt.scheduledAt)} pukul ${appt.appointmentTime} WIB. Status tercatat sebagai Tidak Hadir.`,
                data    : { appointmentId: appt._id },
                io      : _io,
            });

            // Notif dokter (via userId dokter)
            if (appt.doctorId?.userId) {
                await createNotification({
                    userId  : appt.doctorId.userId,
                    type    : 'appointment_reminder',
                    title   : 'Pasien Tidak Hadir',
                    message : `Pasien ${appt.userId?.name || '-'} tidak hadir pada janji pukul ${appt.appointmentTime} WIB.`,
                    data    : { appointmentId: appt._id },
                    io      : _io,
                });
            }
        }
    } catch (err) {
        console.error('[AppointmentCron] AutoNoShow error:', err.message);
    }
}

// ── 2. Reminder H-24 ──────────────────────────────────────────────────────
async function runReminder() {
    const now       = new Date();
    const in23h     = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const in25h     = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    try {
        const upcoming = await Appointment.find({
            status        : 'scheduled',
            reminderSent  : false,
            scheduledAt   : { $gte: in23h, $lte: in25h },
        })
        .populate('userId',   'name')
        .populate('doctorId', 'name');

        for (const appt of upcoming) {
            const marked = await Appointment.findOneAndUpdate(
                { _id: appt._id, reminderSent: false },
                { $set: { reminderSent: true } },
                { new: true }
            );
            if (!marked) continue;

            await createNotification({
                userId  : appt.userId._id,
                type    : 'appointment_reminder',
                title   : '⏰ Pengingat Janji Temu',
                message : `Ingat! Anda memiliki janji temu dengan dr. ${appt.doctorId?.name || '-'} besok, ${fmtTgl(appt.scheduledAt)} pukul ${appt.appointmentTime} WIB. Harap datang tepat waktu.`,
                data    : { appointmentId: appt._id },
                io      : _io,
            });

            console.log(`[AppointmentCron] Reminder sent: ${appt._id} | ${appt.userId?.name}`);
        }
    } catch (err) {
        console.error('[AppointmentCron] Reminder error:', err.message);
    }
}

// ── Tick ─────────────────────────────────────────────────────────────────
async function tick() {
    await runAutoNoShow();
    await runReminder();
}

// ── Export ────────────────────────────────────────────────────────────────
function startCron(io) {
    _io = io;
    if (_timer) return; // jangan double-start
    tick(); // langsung jalankan saat start
    _timer = setInterval(tick, 60 * 1000); // setiap menit
    console.log('[AppointmentCron] Started ✅');
}

function stopCron() {
    if (_timer) { clearInterval(_timer); _timer = null; }
}

module.exports = { startCron, stopCron };