/**
 * Cron: Doctor No Show
 *
 * Setiap menit cek konsultasi dengan status 'confirmed' yang:
 * - scheduledAt sudah lewat > 15 menit
 * - dokter belum klik Start (status masih 'confirmed')
 *
 * → otomatis set ke 'doctor_no_show'
 * → kirim notifikasi ke user agar bisa mengajukan refund
 */

const Consultation = require('../models/Consultation');
const { createNotification } = require('./notificationHelper');

let io = null;

const GRACE_PERIOD_MS = 15 * 60 * 1000; // 15 menit

const runDoctorNoShowCheck = async () => {
    try {
        const threshold = new Date(Date.now() - GRACE_PERIOD_MS);

        // Cari semua konsultasi yang:
        // - status confirmed (dokter belum start)
        // - scheduledAt sudah lewat > 15 menit yang lalu
        const lateConsultations = await Consultation.find({
            status: 'confirmed',
            scheduledAt: { $lt: threshold }
        });

        for (const c of lateConsultations) {
            c.status = 'doctor_no_show';
            c.cancelledAt = new Date();
            c.cancelledBy = 'system';
            c.cancelReason = 'Dokter tidak memulai sesi dalam 15 menit setelah jadwal';
            await c.save();

            // Notifikasi ke user: bisa ajukan refund
            await createNotification({
                userId: c.userId,
                type: 'doctor_no_show',
                title: 'Dokter Tidak Hadir',
                message: 'Dokter tidak memulai konsultasi dalam 15 menit. Anda dapat mengajukan refund.',
                data: { consultationId: c._id },
                io
            });

            console.log(`[CRON-DoctorNoShow] Consultation ${c._id} → doctor_no_show`);
        }
    } catch (err) {
        console.error('[CRON-DoctorNoShow] error:', err.message);
    }
};

const startCron = (socketIo) => {
    io = socketIo;
    // Jalankan setiap 60 detik
    setInterval(runDoctorNoShowCheck, 60 * 1000);
    // Jalankan sekali saat start (untuk tangkap yang terlewat saat server restart)
    runDoctorNoShowCheck();
    console.log('✅ Doctor No Show cron started');
};

module.exports = { startCron };
