const fmtDoctorName = require('./fmtDoctorName');
/**
 * WeeklyScheduleReminderCron.js
 *
 * Berjalan setiap hari, dicek apakah sekarang Sabtu pukul 08:00–08:59 WIB.
 * Jika ya, kirim notifikasi ke dokter yang belum merilis jadwal minggu depan.
 *
 * FIX: Ganti Doctor MongoDB → Doctor MySQL (Sequelize)
 * karena data dokter sudah dipindah ke MySQL.
 */

const { Doctor: DoctorMySQL }  = require('../models/mysql');
const DoctorAvailability       = require('../models/DoctorAvailability');
const AppointmentAvailability  = require('../models/AppointmentAvailability');
const { createNotification }   = require('./notificationHelper');

const WIB_OFFSET = 7 * 60 * 60 * 1000;

let _io    = null;
let _timer = null;

const checkAndNotify = async () => {
    const nowWIB = new Date(Date.now() + WIB_OFFSET);
    const dow    = nowWIB.getUTCDay();   // 0=Min, 6=Sab
    const hour   = nowWIB.getUTCHours(); // jam WIB

    // Hanya jalankan saat Sabtu pukul 08:xx WIB
    if (dow !== 6 || hour !== 8) return;

    console.log('[WeeklyReminderCron] Sabtu 08:xx — memeriksa jadwal dokter...');

    const now     = new Date();
    // FIX: pakai MySQL model, bukan MongoDB Doctor.find()
    const doctors = await DoctorMySQL.findAll({
        where: { is_active: true },
        attributes: ['id', 'user_id', 'name', 'title_prefix', 'title_suffix'],
        raw: true,
    });

    for (const doctor of doctors) {
        if (!doctor.user_id) continue;

        const doctorIdStr = String(doctor.id);

        // ── Cek konsultasi online ─────────────────────────────────────────────
        const onlineAvail = await DoctorAvailability.findOne({ doctorId: doctorIdStr });
        const hasOnline   = onlineAvail && onlineAvail.weekEnd && new Date(onlineAvail.weekEnd) >= now;

        if (!hasOnline) {
            await createNotification({
                userId  : doctor.user_id,
                type    : 'schedule_reminder',
                title   : '📅 Jadwal Konsultasi Belum Dirilis',
                message : `Halo ${fmtDoctorName(doctor)}, jadwal konsultasi online Anda untuk minggu depan belum diset. Silakan atur di menu Jadwal.`,
                data    : {},
                io      : _io,
            }).catch(e => console.error('[WeeklyReminderCron] notif online error:', e.message));
        }

        // ── Cek janji temu offline ────────────────────────────────────────────
        const apptAvail = await AppointmentAvailability.findOne({ doctorId: doctorIdStr });
        const hasAppt   = apptAvail && apptAvail.weekEnd && new Date(apptAvail.weekEnd) >= now;

        if (!hasAppt) {
            await createNotification({
                userId  : doctor.user_id,
                type    : 'schedule_reminder',
                title   : '📅 Jadwal Janji Temu Belum Dirilis',
                message : `Halo ${fmtDoctorName(doctor)}, jadwal janji temu offline Anda untuk minggu depan belum diset. Silakan atur di menu Jadwal.`,
                data    : {},
                io      : _io,
            }).catch(e => console.error('[WeeklyReminderCron] notif appt error:', e.message));
        }
    }

    console.log('[WeeklyReminderCron] Selesai.');
};

function startCron(io) {
    _io = io;
    if (_timer) return;
    _timer = setInterval(() => {
        checkAndNotify().catch(e =>
            console.error('[WeeklyReminderCron] error:', e.message)
        );
    }, 60 * 60 * 1000); // cek setiap jam
    console.log('[WeeklyReminderCron] Started ✅');
}

function stopCron() {
    if (_timer) { clearInterval(_timer); _timer = null; }
}

module.exports = { startCron, stopCron };
