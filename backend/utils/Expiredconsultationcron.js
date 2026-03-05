/**
 * Cron: setiap menit cek konsultasi dengan status pending_payment atau waiting_verification
 * yang sudah melewati paymentDeadline → set ke expired
 *
 * Catatan: waiting_verification yang melewati deadline berarti slot sudah lewat sebelum admin sempat verifikasi.
 */
const Consultation = require('../models/Consultation');
const { createNotification } = require('./notificationHelper');

let io = null;

const runExpiredCheck = async () => {
    try {
        const now = new Date();
        const expired = await Consultation.find({
            status: { $in: ['pending_payment', 'waiting_verification'] },
            paymentDeadline: { $lt: now }
        });

        for (const c of expired) {
            const prevStatus = c.status; // simpan sebelum diubah
            c.status = 'expired';
            c.cancelledBy = 'system';
            c.cancelReason = prevStatus === 'waiting_verification'
                ? 'Pembayaran tidak diverifikasi dalam waktu yang tersedia'
                : 'Pembayaran tidak dilakukan dalam 15 menit';
            await c.save();

            await createNotification({
                userId: c.userId,
                type: 'consultation_expired',
                title: 'Konsultasi Kadaluarsa',
                message: c.cancelReason + '. Silakan booking ulang.',
                data: { consultationId: c._id },
                io
            });

            console.log(`[CRON] Consultation ${c._id} (${prevStatus}) → expired`);
        }
    } catch (err) {
        console.error('[CRON] expiredCheck error:', err.message);
    }
};

const startCron = (socketIo) => {
    io = socketIo;
    // Jalankan setiap 60 detik
    setInterval(runExpiredCheck, 60 * 1000);
    console.log('✅ Expired consultation cron started');
};

module.exports = { startCron };