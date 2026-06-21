/**
 * MLRetrainCron.js
 * Cron Job untuk memicu Active Learning (Retrain) secara otomatis
 * Berjalan setiap jam 02:00 dini hari.
 * Jika tabel prediction_logs memiliki >= 50 koreksi baru, picu retrain.
 */
const cron = require('node-cron');
const axios = require('axios');
const mongoose = require('mongoose');

let cronTask = null;

async function checkAndRetrain() {
    try {
        console.log('[CRON ML-Retrain] Mulai mengecek data koreksi di database...');
        const db = mongoose.connection.db;
        if (!db) {
            console.error('[CRON ML-Retrain] Koneksi DB belum siap.');
            return;
        }

        const logsCollection = db.collection('prediction_logs');
        const count = await logsCollection.countDocuments({ is_trained: { $ne: true } });

        console.log(`[CRON ML-Retrain] Ditemukan ${count} koreksi baru.`);

        if (count >= 50) {
            console.log('[CRON ML-Retrain] Threshold tercapai (>= 50). Memulai retrain...');
            const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';
            
            // Panggil API Retrain
            // Kita biarkan memproses di background, tidak perlu ditunggu hasilnya
            axios.post(`${mlServiceUrl}/retrain`).catch(err => {
                console.error('[CRON ML-Retrain] Gagal memanggil API ML-Service:', err.message);
            });
            console.log('[CRON ML-Retrain] Instruksi retrain telah dikirim ke ML-Service.');
        } else {
            console.log('[CRON ML-Retrain] Belum memenuhi threshold (butuh 50). Retrain diskip.');
        }

    } catch (error) {
        console.error('[CRON ML-Retrain] Terjadi kesalahan:', error.message);
    }
}

function startCron() {
    if (cronTask) {
        console.log('[CRON ML-Retrain] Sudah berjalan.');
        return;
    }

    // Berjalan setiap jam 02:00 dini hari WIB
    cronTask = cron.schedule('0 2 * * *', checkAndRetrain, {
        scheduled: true,
        timezone: "Asia/Jakarta"
    });

    console.log('✅ CRON ML-Retrain aktif (berjalan setiap jam 02:00 dini hari)');
}

function stopCron() {
    if (cronTask) {
        cronTask.stop();
        cronTask = null;
        console.log('⛔ CRON ML-Retrain dihentikan');
    }
}

module.exports = { startCron, stopCron };
