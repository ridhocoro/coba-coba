/**
 * VideoLogCleanupCron.js
 *
 * Setiap 1 jam:
 *   - Cari konsultasi yang videoLog.expiresAt sudah lewat
 *   - Hapus file dari Cloudinary
 *   - Kosongkan field videoLog di MongoDB
 *
 * Video log hanya tersedia 24 jam setelah upload (expiresAt = uploadedAt + 24h).
 */

const Consultation = require('../models/Consultation');
const { deleteFromB2 } = require('../config/b2');

let _timer = null;

const cleanupExpiredVideoLogs = async () => {
    const now = new Date();

    const expired = await Consultation.find({
        'videoLog.url'       : { $exists: true, $ne: null },
        'videoLog.expiresAt' : { $lt: now },
    }).select('_id videoLog').lean();

    if (expired.length === 0) return;

    console.log(`[VideoLogCron] Menghapus ${expired.length} video log kadaluarsa...`);

    for (const c of expired) {
        try {
            // Hapus dari Backblaze B2 jika ada b2Key
            if (c.videoLog?.b2Key) {
                await deleteFromB2(c.videoLog.b2Key);
            }

            // Kosongkan field videoLog di MongoDB
            await Consultation.findByIdAndUpdate(c._id, {
                $unset: { videoLog: '' },
            });

            console.log(`[VideoLogCron] ✅ Dihapus: consultation ${c._id} (publicId: ${c.videoLog?.publicId})`);
        } catch (err) {
            console.error(`[VideoLogCron] ❌ Gagal hapus ${c._id}:`, err.message);
        }
    }
};

const startCron = () => {
    if (_timer) return;
    // Jalankan setiap jam
    _timer = setInterval(() => {
        cleanupExpiredVideoLogs().catch(e =>
            console.error('[VideoLogCron] Error:', e.message)
        );
    }, 60 * 60 * 1000);

    // Jalankan sekali saat startup
    cleanupExpiredVideoLogs().catch(e =>
        console.error('[VideoLogCron] startup error:', e.message)
    );

    console.log('✅ VideoLog cleanup cron started (setiap 1 jam)');
};

const stopCron = () => {
    if (_timer) { clearInterval(_timer); _timer = null; }
};

module.exports = { startCron, stopCron };