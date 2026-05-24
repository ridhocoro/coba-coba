/**
 * CleanupUnverifiedUsersCron.js
 * Hapus permanen user yang daftar tapi tidak verifikasi OTP lebih dari 24 jam.
 * FIX: Ganti MongoDB User -> MySQL User (Sequelize)
 */
const { User } = require('../models/mysql');
const { Op }   = require('sequelize');

let _timer = null;

async function tick() {
    try {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const deleted = await User.destroy({
            where: {
                isVerified: false,
                created_at: { [Op.lt]: cutoff },
            },
        });
        if (deleted > 0) {
            console.log(`[CRON CleanupUsers] Hapus ${deleted} akun unverified > 24 jam`);
        }
    } catch (err) {
        console.error('[CRON CleanupUsers] Error:', err.message);
    }
}

function startCron() {
    tick();
    _timer = setInterval(tick, 24 * 60 * 60 * 1000);
    console.log('✅ CRON CleanupUnverifiedUsers aktif (setiap 24 jam)');
}

function stopCron() {
    if (_timer) clearInterval(_timer);
}

module.exports = { startCron, stopCron };
