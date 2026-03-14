/**
 * CleanupUnverifiedUsersCron.js
 * Hapus permanen user yang daftar tapi tidak verifikasi OTP lebih dari 24 jam.
 * Menggunakan setInterval (konsisten dengan cron lain di proyek ini).
 */
const User = require('../models/User');

let _timer = null;

async function tick() {
    try {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 jam lalu
        const result = await User.deleteMany({
            isVerified: false,
            createdAt : { $lt: cutoff },
        });
        if (result.deletedCount > 0) {
            console.log(`[CRON CleanupUsers] Hapus ${result.deletedCount} akun unverified > 24 jam`);
        }
    } catch (err) {
        console.error('[CRON CleanupUsers] Error:', err.message);
    }
}

function startCron() {
    tick(); // jalankan sekali saat startup
    _timer = setInterval(tick, 24 * 60 * 60 * 1000); // setiap 24 jam
    console.log('✅ CRON CleanupUnverifiedUsers aktif (setiap 24 jam)');
}

function stopCron() {
    if (_timer) clearInterval(_timer);
}

module.exports = { startCron, stopCron };