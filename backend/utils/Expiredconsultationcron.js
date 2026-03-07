/**
 * Expiredconsultationcron.js
 *
 * Satu-satunya cron untuk konsultasi. Dijalankan setiap menit.
 * DoctorNoShowCron.js sudah dihapus — semua logikanya ada di sini.
 *
 * 1. EXPIRED PAYMENT
 *    pending_payment + paymentDeadline lewat → expired
 *
 * 2. AUTO IN_PROGRESS
 *    confirmed + scheduledAt tiba + scheduledEnd belum lewat → in_progress
 *    (atomic: findOneAndUpdate agar tidak double-process)
 *
 * 3. DOCTOR NO SHOW
 *    confirmed + scheduledEnd + 15 menit grace lewat (dokter tidak pernah start)
 *    → doctor_no_show → refund_requested
 *    (atomic: dua findOneAndUpdate berurutan)
 *
 * 4. AUTO CLOSE (user no_show / completed)
 *    in_progress + scheduledEnd + 15 menit grace lewat (dokter tidak klik End)
 *    → no_show (user tidak pernah kirim pesan) atau completed
 *    (atomic: findOneAndUpdate)
 *
 * Semua timestamp dibandingkan UTC — WIB hanya untuk logging.
 */

const Consultation       = require('../models/Consultation');
const Doctor             = require('../models/Doctor');
const User               = require('../models/User');
const { createNotification } = require('./notificationHelper');

const WIB_OFFSET = 7 * 60 * 60 * 1000;
const fmtWIB = (d) =>
    new Date(d.getTime() + WIB_OFFSET).toISOString().replace('T', ' ').slice(0, 16) + ' WIB';

let _io    = null;
let _timer = null;

// ── 1. Expired payment ────────────────────────────────────────────────────────
const checkExpiredPayments = async () => {
    const now = new Date();

    const candidates = await Consultation.find({
        status         : 'pending_payment',
        paymentDeadline: { $lt: now },
    }).select('_id userId');

    for (const c of candidates) {
        const updated = await Consultation.findOneAndUpdate(
            { _id: c._id, status: 'pending_payment' },
            { $set: {
                status       : 'expired',
                cancelledBy  : 'system',
                cancelReason : 'Pembayaran tidak dilakukan dalam 15 menit',
            }},
            { new: true }
        );
        if (!updated) continue;

        await createNotification({
            userId  : updated.userId,
            type    : 'consultation_expired',
            title   : 'Konsultasi Kadaluarsa ⏰',
            message : 'Anda tidak melakukan pembayaran dalam 15 menit. Silakan booking ulang.',
            data    : { consultationId: updated._id },
            io      : _io,
        });

        if (_io) {
            _io.to(`user-${updated.userId}`).emit('consultation-status-update', {
                consultationId: updated._id.toString(),
                status        : 'expired',
            });
        }

        console.log(`[CRON] ${updated._id} → expired (${fmtWIB(now)})`);
    }
};

// ── 2. Auto in_progress saat jam mulai tiba ───────────────────────────────────
const checkAutoInProgress = async () => {
    const now = new Date();

    const candidates = await Consultation.find({
        status      : 'confirmed',
        scheduledAt : { $lte: now },
        scheduledEnd: { $gt: now },
    }).select('_id userId doctorId scheduledAt');

    for (const c of candidates) {
        const updated = await Consultation.findOneAndUpdate(
            { _id: c._id, status: 'confirmed' },
            { $set: { status: 'in_progress', startTime: c.scheduledAt } },
            { new: true }
        );
        if (!updated) continue;

        // Notif user
        await createNotification({
            userId  : updated.userId,
            type    : 'consultation_started',
            title   : 'Konsultasi Dimulai 🩺',
            message : 'Waktu konsultasi Anda telah tiba. Silakan mulai chat/video call dengan dokter.',
            data    : { consultationId: updated._id },
            io      : _io,
        });

        // Notif dokter — null-safe
        try {
            const doctor = await Doctor.findById(updated.doctorId).select('userId');
            if (doctor?.userId) {
                await createNotification({
                    userId  : doctor.userId,
                    type    : 'consultation_started',
                    title   : 'Sesi Konsultasi Dimulai 🩺',
                    message : 'Waktu konsultasi dengan pasien telah tiba. Silakan mulai sesi.',
                    data    : { consultationId: updated._id },
                    io      : _io,
                });
            }
        } catch (e) {
            console.error(`[CRON] Gagal notif dokter konsultasi ${updated._id}:`, e.message);
        }

        if (_io) {
            _io.to(`user-${updated.userId}`).emit('consultation-status-update', {
                consultationId: updated._id.toString(),
                status        : 'in_progress',
            });
        }

        console.log(`[CRON] ${updated._id} → in_progress (${fmtWIB(now)})`);
    }
};

// ── 3. Doctor no show ─────────────────────────────────────────────────────────
const checkDoctorNoShow = async () => {
    const now   = new Date();
    const grace = new Date(now.getTime() - 15 * 60 * 1000);

    const candidates = await Consultation.find({
        status      : 'confirmed',
        scheduledEnd: { $lt: grace },
    }).select('_id userId');

    for (const c of candidates) {
        // Step 1: atomic → doctor_no_show
        const step1 = await Consultation.findOneAndUpdate(
            { _id: c._id, status: 'confirmed' },
            { $set: {
                status       : 'doctor_no_show',
                cancelledAt  : now,
                cancelledBy  : 'system',
                cancelReason : 'Dokter tidak memulai sesi dalam waktu yang ditentukan',
            }},
            { new: true }
        );
        if (!step1) continue;

        // Step 2: atomic → refund_requested
        const step2 = await Consultation.findOneAndUpdate(
            { _id: step1._id, status: 'doctor_no_show' },
            { $set: {
                status : 'refund_requested',
                refund : {
                    bankName      : 'Proses Admin',
                    accountNumber : '-',
                    accountName   : '-',
                    requestedAt   : now,
                    notes         : 'Auto-refund: dokter tidak hadir pada jadwal konsultasi',
                },
            }},
            { new: true }
        );
        if (!step2) continue;

        // Notif user
        await createNotification({
            userId  : step2.userId,
            type    : 'doctor_no_show',
            title   : 'Dokter Tidak Hadir — Refund Otomatis 💰',
            message : 'Dokter tidak hadir pada jadwal konsultasi Anda. Refund akan diproses admin dalam 3-5 hari kerja.',
            data    : { consultationId: step2._id },
            io      : _io,
        });

        // Notif semua admin
        try {
            const admins = await User.find({ role: 'admin' }).select('_id');
            for (const admin of admins) {
                await createNotification({
                    userId  : admin._id,
                    type    : 'refund_requested',
                    title   : 'Refund Otomatis: Dokter Tidak Hadir',
                    message : 'Ada konsultasi yang perlu diproses refundnya (dokter tidak hadir).',
                    data    : { consultationId: step2._id },
                    io      : _io,
                });
            }
        } catch (e) {
            console.error(`[CRON] Gagal notif admin refund ${step2._id}:`, e.message);
        }

        if (_io) {
            _io.to(`user-${step2.userId}`).emit('consultation-status-update', {
                consultationId: step2._id.toString(),
                status        : 'refund_requested',
            });
        }

        console.log(`[CRON] ${step2._id} → doctor_no_show → refund_requested (${fmtWIB(now)})`);
    }
};

// ── 4. Auto close: user no_show / completed ────────────────────────────────────
const checkUserNoShow = async () => {
    const now   = new Date();
    const grace = new Date(now.getTime() - 15 * 60 * 1000);

    const candidates = await Consultation.find({
        status      : 'in_progress',
        scheduledEnd: { $lt: grace },
    });

    for (const c of candidates) {
        const userMessages = (c.messages || []).filter(
            m => m.senderId?.toString() === c.userId?.toString()
        );
        const finalStatus = userMessages.length === 0 ? 'no_show' : 'completed';

        const updated = await Consultation.findOneAndUpdate(
            { _id: c._id, status: 'in_progress' },
            { $set: { status: finalStatus, endTime: c.scheduledEnd } },
            { new: true }
        );
        if (!updated) continue;

        await createNotification({
            userId  : updated.userId,
            type    : 'consultation_ended',
            title   : finalStatus === 'no_show' ? 'Sesi Berakhir — Tidak Hadir' : 'Konsultasi Selesai ✅',
            message : finalStatus === 'no_show'
                ? 'Sesi konsultasi telah berakhir. Anda tercatat tidak hadir.'
                : 'Sesi konsultasi telah selesai secara otomatis. Silakan beri rating.',
            data    : { consultationId: updated._id },
            io      : _io,
        });

        if (_io) {
            _io.to(`user-${updated.userId}`).emit('consultation-status-update', {
                consultationId: updated._id.toString(),
                status        : finalStatus,
            });
            if (finalStatus === 'completed') {
                _io.to(`user-${updated.userId}`).emit('show-rating-modal', {
                    consultationId: updated._id.toString(),
                });
            }
        }

        console.log(`[CRON] ${updated._id} → ${finalStatus} (auto-close, ${fmtWIB(now)})`);
    }
};

// ── Master runner ─────────────────────────────────────────────────────────────
const runAllChecks = async () => {
    try { await checkExpiredPayments(); } catch (e) { console.error('[CRON] checkExpiredPayments:', e.message); }
    try { await checkAutoInProgress();  } catch (e) { console.error('[CRON] checkAutoInProgress:', e.message); }
    try { await checkDoctorNoShow();    } catch (e) { console.error('[CRON] checkDoctorNoShow:', e.message); }
    try { await checkUserNoShow();      } catch (e) { console.error('[CRON] checkUserNoShow:', e.message); }
};

const startCron = (socketIo) => {
    _io = socketIo;
    if (_timer) return; // jangan double-start
    _timer = setInterval(runAllChecks, 60 * 1000);
    runAllChecks().catch(e => console.error('[CRON] startup check error:', e.message));
    console.log('✅ Consultation cron started (expired / auto-start / doctor-no-show / auto-close)');
};

const stopCron = () => {
    if (_timer) { clearInterval(_timer); _timer = null; }
};

module.exports = { startCron, stopCron };