/**
 * Cron: setiap menit jalankan 3 pengecekan:
 *
 * 1. EXPIRED PAYMENT
 *    Consultation status pending_payment & paymentDeadline sudah lewat
 *    → status: expired, slot dibebaskan
 *
 * 2. AUTO START (in_progress)
 *    Consultation status confirmed & scheduledAt sudah tiba (waktu sekarang >= scheduledAt)
 *    → status: in_progress, startTime dicatat
 *    (dokter tetap bisa "start" manual, ini safety net)
 *
 * 3. DOCTOR NO SHOW
 *    Consultation status confirmed/in_progress & scheduledEnd sudah lewat + 15 menit grace
 *    DAN dokter belum klik start (status masih confirmed)
 *    → status: doctor_no_show → trigger refund placeholder
 *
 * Semua waktu dibandingkan UTC (Date.now()) — WIB hanya untuk logging.
 */

const Consultation         = require('../models/Consultation');
const Doctor               = require('../models/Doctor');
const User                 = require('../models/User');
const { createNotification } = require('./notificationHelper');

const WIB_OFFSET = 7 * 60 * 60 * 1000;
const fmtWIB = (d) => new Date(d.getTime() + WIB_OFFSET).toISOString().replace('T',' ').slice(0,16) + ' WIB';

let _io = null;

// ── 1. Expired payment ───────────────────────────────────────────────────────
const checkExpiredPayments = async () => {
    const now = new Date();
    const expired = await Consultation.find({
        status         : 'pending_payment',
        paymentDeadline: { $lt: now },
    });

    for (const c of expired) {
        c.status      = 'expired';
        c.cancelledBy = 'system';
        c.cancelReason = 'Pembayaran tidak dilakukan dalam 15 menit';
        await c.save();

        await createNotification({
            userId  : c.userId,
            type    : 'consultation_expired',
            title   : 'Konsultasi Kadaluarsa ⏰',
            message : 'Anda tidak melakukan pembayaran dalam 15 menit. Silakan booking ulang.',
            data    : { consultationId: c._id },
            io      : _io,
        });

        // Emit socket agar frontend update real-time
        if (_io) {
            _io.to(`user-${c.userId}`).emit('consultation-status-update', {
                consultationId: c._id.toString(),
                status        : 'expired',
            });
        }

        console.log(`[CRON] Consultation ${c._id} → expired (${fmtWIB(now)})`);
    }
};

// ── 2. Auto in_progress saat jam mulai tiba ──────────────────────────────────
const checkAutoInProgress = async () => {
    const now = new Date();

    // confirmed + scheduledAt sudah tiba + scheduledEnd belum lewat
    const toStart = await Consultation.find({
        status     : 'confirmed',
        scheduledAt: { $lte: now },
        scheduledEnd: { $gt: now },
    });

    for (const c of toStart) {
        c.status    = 'in_progress';
        c.startTime = c.scheduledAt; // gunakan scheduledAt sebagai startTime resmi
        await c.save();

        // Notif user
        await createNotification({
            userId  : c.userId,
            type    : 'consultation_started',
            title   : 'Konsultasi Dimulai 🩺',
            message : 'Waktu konsultasi Anda telah tiba. Silakan mulai chat/video call dengan dokter.',
            data    : { consultationId: c._id },
            io      : _io,
        });

        // Notif dokter
        const doctor = await Doctor.findById(c.doctorId);
        if (doctor) {
            const docUser = await User.findById(doctor.userId);
            if (docUser) {
                await createNotification({
                    userId  : docUser._id,
                    type    : 'consultation_started',
                    title   : 'Sesi Konsultasi Dimulai 🩺',
                    message : `Waktu konsultasi dengan pasien telah tiba. Silakan mulai sesi.`,
                    data    : { consultationId: c._id },
                    io      : _io,
                });
            }
        }

        if (_io) {
            _io.to(`user-${c.userId}`).emit('consultation-status-update', {
                consultationId: c._id.toString(),
                status        : 'in_progress',
            });
        }

        console.log(`[CRON] Consultation ${c._id} → in_progress (${fmtWIB(now)})`);
    }
};

// ── 3. Doctor no show ─────────────────────────────────────────────────────────
// Grace period: 15 menit setelah scheduledEnd
const checkDoctorNoShow = async () => {
    const now = new Date();
    const gracePeriodMs = 15 * 60 * 1000; // 15 mnt

    // Konsultasi yang masih confirmed (dokter belum start) SETELAH scheduledEnd + grace
    const noShows = await Consultation.find({
        status      : 'confirmed',
        scheduledEnd: { $lt: new Date(now.getTime() - gracePeriodMs) },
    });

    for (const c of noShows) {
        c.status      = 'doctor_no_show';
        c.cancelledAt = now;
        c.cancelledBy = 'system';
        c.cancelReason = 'Dokter tidak memulai sesi dalam waktu yang ditentukan';
        await c.save();

        // Trigger placeholder refund
        await triggerRefund(c, _io);

        console.log(`[CRON] Consultation ${c._id} → doctor_no_show (${fmtWIB(now)})`);
    }
};

// ── 4. User no show / auto end (setelah in_progress berakhir tanpa klik End) ──
const checkUserNoShow = async () => {
    const now = new Date();
    const gracePeriodMs = 15 * 60 * 1000;

    // in_progress yang sudah melewati scheduledEnd + grace
    const stale = await Consultation.find({
        status      : 'in_progress',
        scheduledEnd: { $lt: new Date(now.getTime() - gracePeriodMs) },
    });

    for (const c of stale) {
        // Cek apakah user pernah mengirim pesan
        const userMessages = (c.messages || []).filter(
            m => m.senderId?.toString() === c.userId?.toString()
        );
        const finalStatus = userMessages.length === 0 ? 'no_show' : 'completed';

        // Atomic: hanya update jika masih in_progress
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
            // Trigger rating modal untuk user
            if (finalStatus === 'completed') {
                _io.to(`user-${updated.userId}`).emit('show-rating-modal', {
                    consultationId: updated._id.toString(),
                });
            }
        }

        console.log(`[CRON] Consultation ${updated._id} → ${finalStatus} (auto-close, ${fmtWIB(now)})`);
    }
};

// ── Trigger refund placeholder ───────────────────────────────────────────────
const triggerRefund = async (consultation, io) => {
    try {
        const User = require('../models/User');

        // Set refund_requested (bukan refunded) karena belum ada Xendit Refund API
        // Admin akan memproses secara manual
        consultation.status = 'refund_requested';
        consultation.refund = {
            bankName: 'Proses Admin',
            accountNumber: '-',
            accountName: '-',
            requestedAt: new Date(),
            notes: 'Auto-refund: dokter tidak hadir pada jadwal konsultasi'
        };
        await consultation.save();

        await createNotification({
            userId  : consultation.userId,
            type    : 'doctor_no_show',
            title   : 'Refund Otomatis Dijadwalkan 💰',
            message : 'Dokter tidak hadir pada jadwal konsultasi Anda. Refund akan diproses oleh admin dalam 3-5 hari kerja.',
            data    : { consultationId: consultation._id },
            io,
        });

        // Notif admin
        const admins = await User.find({ role: 'admin' });
        for (const admin of admins) {
            await createNotification({
                userId: admin._id,
                type: 'refund_requested',
                title: 'Refund Otomatis: Dokter Tidak Hadir',
                message: `Konsultasi perlu diproses refundnya (dokter tidak hadir).`,
                data: { consultationId: consultation._id },
                io
            });
        }

        if (io) {
            io.to(`user-${consultation.userId}`).emit('consultation-status-update', {
                consultationId: consultation._id.toString(),
                status        : 'refund_requested',
            });
        }
    } catch (err) {
        console.error('[CRON] triggerRefund error:', err.message);
    }
};

// ── Master runner ─────────────────────────────────────────────────────────────
const runAllChecks = async () => {
    await checkExpiredPayments();
    await checkAutoInProgress();
    await checkDoctorNoShow();
    await checkUserNoShow();
};

const startCron = (socketIo) => {
    _io = socketIo;
    // Jalankan setiap 60 detik
    setInterval(runAllChecks, 60 * 1000);
    // Jalankan sekali langsung saat startup
    runAllChecks().catch(e => console.error('[CRON] startup check error:', e.message));
    console.log('✅ Consultation cron started (expired / auto-start / no-show checks)');
};

module.exports = { startCron };