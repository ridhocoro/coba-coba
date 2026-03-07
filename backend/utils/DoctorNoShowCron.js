/**
 * Cron: Doctor No Show
 *
 * CATATAN: Logika utama sudah ada di Expiredconsultationcron.js.
 * File ini dipertahankan sebagai redundancy check.
 *
 * Setiap menit cek konsultasi dengan status 'confirmed' yang:
 * - scheduledAt sudah lewat > 15 menit
 * - dokter belum klik Start
 *
 * → otomatis set ke 'doctor_no_show' lalu langsung 'refund_requested'
 */

const Consultation = require('../models/Consultation');
const User = require('../models/User');
const { createNotification } = require('./notificationHelper');

let io = null;

const GRACE_PERIOD_MS = 15 * 60 * 1000; // 15 menit

const runDoctorNoShowCheck = async () => {
    try {
        const now = new Date();
        const threshold = new Date(now.getTime() - GRACE_PERIOD_MS);

        const lateConsultations = await Consultation.find({
            status: 'confirmed',
            scheduledAt: { $lt: threshold }
        });

        for (const c of lateConsultations) {
            // Atomic: hanya update jika masih confirmed
            const updated = await Consultation.findOneAndUpdate(
                { _id: c._id, status: 'confirmed' },
                { $set: {
                    status: 'doctor_no_show',
                    cancelledAt: now,
                    cancelledBy: 'system',
                    cancelReason: 'Dokter tidak memulai sesi dalam 15 menit setelah jadwal'
                }},
                { new: true }
            );
            if (!updated) continue; // sudah diproses oleh cron lain

            // Langsung set refund_requested (tanpa perlu user isi form)
            updated.status = 'refund_requested';
            updated.refund = {
                bankName: 'Proses Admin',
                accountNumber: '-',
                accountName: '-',
                requestedAt: now,
                notes: 'Auto-refund: dokter tidak hadir'
            };
            await updated.save();

            // Notifikasi ke user
            await createNotification({
                userId: updated.userId,
                type: 'doctor_no_show',
                title: 'Dokter Tidak Hadir — Refund Otomatis 💰',
                message: 'Dokter tidak memulai konsultasi tepat waktu. Refund Anda sedang diproses admin (3-5 hari kerja).',
                data: { consultationId: updated._id },
                io
            });

            // Notifikasi ke admin
            const admins = await User.find({ role: 'admin' });
            for (const admin of admins) {
                await createNotification({
                    userId: admin._id,
                    type: 'refund_requested',
                    title: 'Refund Otomatis: Dokter Tidak Hadir',
                    message: `Konsultasi perlu diproses refundnya (dokter tidak hadir pada jadwal).`,
                    data: { consultationId: updated._id },
                    io
                });
            }

            if (io) {
                io.to(`user-${updated.userId}`).emit('consultation-status-update', {
                    consultationId: updated._id.toString(),
                    status: 'refund_requested',
                });
            }

            console.log(`[CRON-DoctorNoShow] Consultation ${updated._id} → doctor_no_show → refund_requested`);
        }
    } catch (err) {
        console.error('[CRON-DoctorNoShow] error:', err.message);
    }
};

const startCron = (socketIo) => {
    io = socketIo;
    setInterval(runDoctorNoShowCheck, 60 * 1000);
    runDoctorNoShowCheck();
    console.log('✅ Doctor No Show cron started');
};

module.exports = { startCron };
