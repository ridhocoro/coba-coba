/**
 * AppointmentCron.js
 *
 * FIX: Appointment.userId & doctorId adalah UUID string dari MySQL —
 * tidak bisa di-populate via Mongoose (MongoDB expect ObjectId).
 * Solusi: query .lean() lalu lookup manual ke MySQL dengan findByPk().
 */

const Appointment = require('../models/Appointment');
const { User, Doctor } = require('../models/mysql');
const { createNotification } = require('./notificationHelper');
const { waReminderJanjiTemu } = require('./fonnte');

const WIB_OFFSET = 7 * 60 * 60 * 1000;

const fmtTgl = (d) =>
    new Date(new Date(d).getTime() + WIB_OFFSET)
        .toLocaleDateString('id-ID', {
            day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
        });

let _io    = null;
let _timer = null;

// ── 1. Auto No-Show ────────────────────────────────────────────────────────
async function runAutoNoShow() {
    const now       = new Date();
    const threshold = new Date(now.getTime() - 30 * 60 * 1000);

    try {
        const stale = await Appointment.find({
            status      : 'scheduled',
            scheduledAt : { $lte: threshold },
        }).lean();

        for (const appt of stale) {
            const updated = await Appointment.findOneAndUpdate(
                { _id: appt._id, status: 'scheduled' },
                { $set: { status: 'no_show', noShowAt: now } },
                { new: true }
            );
            if (!updated) continue;

            const [user, doctor] = await Promise.all([
                User.findByPk(appt.userId,    { attributes: ['id', 'name'] }),
                Doctor.findByPk(appt.doctorId, { attributes: ['id', 'name', 'userId'] }),
            ]);

            console.log(`[AppointmentCron] No-show: ${appt._id} | ${appt.appointmentTime} | ${user?.name || appt.userId}`);

            if (user?.id) {
                await createNotification({
                    userId  : user.id,
                    type    : 'appointment_reminder',
                    title   : 'Janji Temu: Tidak Hadir',
                    message : `Anda tidak hadir pada janji temu ${fmtTgl(appt.scheduledAt)} pukul ${appt.appointmentTime} WIB. Status tercatat sebagai Tidak Hadir.`,
                    data    : { appointmentId: appt._id },
                    io      : _io,
                });
            }

            if (doctor?.userId) {
                await createNotification({
                    userId  : doctor.userId,
                    type    : 'appointment_reminder',
                    title   : 'Pasien Tidak Hadir',
                    message : `Pasien ${user?.name || '-'} tidak hadir pada janji pukul ${appt.appointmentTime} WIB.`,
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
    const now   = new Date();
    const in23h = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    try {
        const upcoming = await Appointment.find({
            status       : 'scheduled',
            reminderSent : false,
            scheduledAt  : { $gte: in23h, $lte: in25h },
        }).lean();

        for (const appt of upcoming) {
            const marked = await Appointment.findOneAndUpdate(
                { _id: appt._id, reminderSent: false },
                { $set: { reminderSent: true } },
                { new: true }
            );
            if (!marked) continue;

            const [user, doctor] = await Promise.all([
                User.findByPk(appt.userId,    { attributes: ['id', 'name', 'phone'] }),
                Doctor.findByPk(appt.doctorId, { attributes: ['id', 'name'] }),
            ]);

            if (user?.id) {
                await createNotification({
                    userId  : user.id,
                    type    : 'appointment_reminder',
                    title   : '⏰ Pengingat Janji Temu',
                    message : `Ingat! Anda memiliki janji temu dengan dr. ${doctor?.name || '-'} besok pukul ${appt.appointmentTime} WIB. Harap datang tepat waktu.`,
                    data    : { appointmentId: appt._id },
                    io      : _io,
                });
            }

            try {
                if (user?.phone) {
                    await waReminderJanjiTemu(user, doctor, appt);
                }
            } catch (waErr) {
                console.error('[AppointmentCron] WA reminder error:', waErr.message);
            }

            console.log(`[AppointmentCron] Reminder sent: ${appt._id} | ${user?.name || appt.userId}`);
        }
    } catch (err) {
        console.error('[AppointmentCron] Reminder error:', err.message);
    }
}

async function tick() {
    await runAutoNoShow();
    await runReminder();
}

function startCron(io) {
    _io = io;
    if (_timer) return;
    tick();
    _timer = setInterval(tick, 60 * 1000);
    console.log('[AppointmentCron] Started ✅');
}

function stopCron() {
    if (_timer) { clearInterval(_timer); _timer = null; }
}

module.exports = { startCron, stopCron };