const fmtDoctorName = require('./fmtDoctorName');
/**
 * WeeklyScheduleReminderCron.js
 *
 * Berjalan setiap hari, dicek apakah sekarang Sabtu pukul 08:00–08:59 WIB.
 * Jika ya, kirim notifikasi ke dokter yang belum merilis jadwal minggu depan:
 *   - Notifikasi 1: konsultasi online (DoctorAvailability)
 *   - Notifikasi 2: janji temu offline (AppointmentAvailability)
 *
 * "Belum merilis" = weekEnd sudah lewat atau belum pernah diset sama sekali.
 */

const Doctor                  = require('../models/Doctor');
const DoctorAvailability      = require('../models/DoctorAvailability');
const AppointmentAvailability = require('../models/AppointmentAvailability');
const { createNotification }  = require('./notificationHelper');

const WIB_OFFSET = 7 * 60 * 60 * 1000;

let _io    = null;
let _timer = null;

const checkAndNotify = async () => {
    const nowWIB = new Date(Date.now() + WIB_OFFSET);
    const dow    = nowWIB.getUTCDay();   // 0=Min,6=Sab
    const hour   = nowWIB.getUTCHours(); // jam WIB

    // Hanya jalankan saat Sabtu pukul 08:xx WIB
    if (dow !== 6 || hour !== 8) return;

    console.log('[WeeklyReminderCron] Sabtu 08:xx — memeriksa jadwal dokter...');

    const now     = new Date();
    const doctors = await Doctor.find({ isActive: true }).select('_id userId name');

    for (const doctor of doctors) {
        if (!doctor.userId) continue;

        // ── Cek konsultasi online ─────────────────────────────────────────────
        const onlineAvail = await DoctorAvailability.findOne({ doctorId: doctor._id });
        const onlineExpired = !onlineAvail || !onlineAvail.weekEnd || onlineAvail.weekEnd < now;

        if (onlineExpired) {
            await createNotification({
                userId  : doctor.userId,
                type    : 'schedule_reminder',
                title   : '⏰ Jadwal Konsultasi Online Belum Dirilis',
                message : `${fmtDoctorName(doctor)}, jadwal konsultasi online minggu depan belum dirilis. Pasien tidak bisa booking. Silakan atur jadwal sekarang di menu Jadwal → Konsultasi Online.`,
                data    : { type: 'online' },
                io      : _io,
            });
            console.log(`[WeeklyReminderCron] Notif konsultasi online → ${doctor.name}`);
        }

        // ── Cek janji temu offline ────────────────────────────────────────────
        const apptAvail   = await AppointmentAvailability.findOne({ doctorId: doctor._id });
        const apptExpired = !apptAvail || !apptAvail.weekEnd || apptAvail.weekEnd < now;

        if (apptExpired) {
            await createNotification({
                userId  : doctor.userId,
                type    : 'schedule_reminder',
                title   : '⏰ Jadwal Janji Temu Belum Dirilis',
                message : `${fmtDoctorName(doctor)}, jadwal janji temu offline minggu depan belum dirilis. Pasien tidak bisa booking. Silakan atur jadwal sekarang di menu Jadwal → Janji Temu.`,
                data    : { type: 'appointment' },
                io      : _io,
            });
            console.log(`[WeeklyReminderCron] Notif janji temu → ${doctor.name}`);
        }
    }
};

const startCron = (io) => {
    _io = io;
    if (_timer) return;
    // Cek setiap 30 menit — ringan, hanya aktif 1 jam per minggu
    _timer = setInterval(checkAndNotify, 30 * 60 * 1000);
    checkAndNotify(); // jalankan segera saat startup
    console.log('[WeeklyReminderCron] Started ✅');
};

const stopCron = () => {
    if (_timer) { clearInterval(_timer); _timer = null; }
};

module.exports = { startCron, stopCron };