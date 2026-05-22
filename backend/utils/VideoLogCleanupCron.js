/**
 * VideoLogCleanupCron.js
 *
 * Setiap 1 jam:
 *   - Cari konsultasi yang videoLog.expiresAt sudah lewat
 *   - Hapus file dari Backblaze B2
 *   - Kosongkan field videoLog di MongoDB
 *
 * Video log hanya tersedia 24 jam setelah upload (expiresAt = uploadedAt + 24h).
 */

const Consultation   = require('../models/Consultation');
const { deleteFromB2 } = require('../config/b2');

let _timer = null;

const cleanupExpiredVideoLogs = async () => {
    const now = new Date();

    const expired = await Consultation.find({
        'videoLog.url'       : { $exists: true, $ne: null },
        'videoLog.expiresAt' : { $lt: now },
    }).select('_id videoLog').lean();

    if (expired.length === 0) {
        console.log('[VideoLogCron] Tidak ada video log kadaluarsa.');
        return;
    }

    console.log(`[VideoLogCron] Menghapus ${expired.length} video log kadaluarsa...`);

    let deleted = 0;
    let failed  = 0;

    for (const c of expired) {
        try {
            // Hapus dari Backblaze B2
            if (c.videoLog?.b2Key) {
                await deleteFromB2(c.videoLog.b2Key);
                console.log(`[VideoLogCron] ✅ B2 dihapus: ${c.videoLog.b2Key}`);
            } else {
                console.warn(`[VideoLogCron] ⚠️  consultation ${c._id} tidak punya b2Key, skip delete B2`);
            }

            // Kosongkan field videoLog di MongoDB
            await Consultation.findByIdAndUpdate(c._id, {
                $unset: { videoLog: '' },
            });

            console.log(`[VideoLogCron] ✅ MongoDB dibersihkan: consultation ${c._id}`);
            deleted++;
        } catch (err) {
            console.error(`[VideoLogCron] ❌ Gagal hapus ${c._id}:`, err.message);
            failed++;
        }
    }

    console.log(`[VideoLogCron] Selesai — ${deleted} berhasil, ${failed} gagal.`);
};

const startCron = () => {
    if (_timer) return;

    // Jalankan sekali saat startup (delay 10 detik agar DB sudah siap)
    setTimeout(() => {
        cleanupExpiredVideoLogs().catch(e =>
            console.error('[VideoLogCron] startup error:', e.message)
        );
    }, 10_000);

    // Jalankan setiap jam
    _timer = setInterval(() => {
        cleanupExpiredVideoLogs().catch(e =>
            console.error('[VideoLogCron] interval error:', e.message)
        );
    }, 60 * 60 * 1000);

    console.log('✅ VideoLog cleanup cron started (setiap 1 jam)');
};

const stopCron = () => {
    if (_timer) { clearInterval(_timer); _timer = null; }
};

module.exports = { startCron, stopCron, cleanupExpiredVideoLogs };