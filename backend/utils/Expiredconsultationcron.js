/**
 * Cron: setiap menit cek konsultasi dengan status pending_payment
 * yang sudah melewati paymentDeadline → set ke expired
 */
const Consultation = require('../models/Consultation');
const { createNotification } = require('./notificationHelper');

let io = null;

const runExpiredCheck = async () => {
    try {
        const now = new Date();
        const expired = await Consultation.find({
            status: 'pending_payment',
            paymentDeadline: { $lt: now }
        });

        for (const c of expired) {
            c.status = 'expired';
            c.cancelledBy = 'system';
            c.cancelReason = 'Pembayaran tidak dilakukan dalam 15 menit';
            await c.save();

            await createNotification({
                userId: c.userId,
                type: 'consultation_expired',
                title: 'Konsultasi Kadaluarsa',
                message: 'Anda tidak melakukan pembayaran dalam 15 menit. Konsultasi dibatalkan.',
                data: { consultationId: c._id },
                io
            });

            console.log(`[CRON] Consultation ${c._id} → expired`);
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