// backend/middleware/rateLimiter.js
// ============================================================
//  Redis-backed rate limiter — sliding window
//
//  Preset siap pakai:
//   aiChatLimiter      → POST /api/ollama/chat (15/menit)
//   aiChatDailyLimiter → POST /api/ollama/chat (100/hari)
//   loginLimiter       → POST /api/auth/login  (mengganti loginLimitMap)
//   otpResendLimiter   → POST /api/auth/resend-otp (mengganti ipResendMap)
//   otpVerifyLimiter   → POST /api/auth/verify-otp (mengganti otpVerifyMap)
//   globalLimiter      → semua route, 200/menit
// ============================================================

const { safeIncr, safeExpire, safeTtl } = require('../config/redis');

/**
 * Factory: buat middleware rate limiter
 * @param {object} opts
 * @param {string}  opts.prefix         - namespace key Redis
 * @param {number}  opts.windowSec      - durasi window (detik)
 * @param {number}  opts.max            - maks request per window
 * @param {string}  [opts.keyBy]        - 'ip' | 'user' | 'ip+user'
 * @param {string}  [opts.message]      - pesan 429 custom
 * @param {boolean} [opts.skipOnError]  - loloskan jika Redis mati (default: true)
 */
function createRateLimiter({
    prefix,
    windowSec,
    max,
    keyBy       = 'ip',
    message     = 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
    skipOnError = true,
}) {
    return async function (req, res, next) {
        try {
            const ip     = req.ip || req.socket?.remoteAddress || 'unknown';
            const userId = req.userId || null;

            let id;
            if (keyBy === 'user' && userId)        id = `user:${userId}`;
            else if (keyBy === 'ip+user' && userId) id = `ip:${ip}:user:${userId}`;
            else                                    id = `ip:${ip}`;

            const key     = `rate:${prefix}:${id}`;
            const current = await safeIncr(key);

            if (current === null) {
                // Redis mati — graceful degradation
                return skipOnError ? next() : res.status(503).json({ message: 'Service tidak tersedia.' });
            }

            if (current === 1) await safeExpire(key, windowSec);

            const ttl = await safeTtl(key);
            res.set({
                'X-RateLimit-Limit':     max,
                'X-RateLimit-Remaining': Math.max(0, max - current),
                'X-RateLimit-Reset':     Math.floor(Date.now() / 1000) + ttl,
            });

            if (current > max) {
                return res.status(429).json({ success: false, message, retryAfter: ttl });
            }

            next();
        } catch (err) {
            console.error('[RateLimiter]', err.message);
            return skipOnError ? next() : res.status(503).json({ message: 'Service tidak tersedia.' });
        }
    };
}

// ── Preset ───────────────────────────────────────────────────

// AI Chatbot — maks 15 pesan / menit per user+IP
const aiChatLimiter = createRateLimiter({
    prefix:    'ai_chat',
    windowSec: 60,
    max:       15,
    keyBy:     'ip+user',
    message:   'Kamu sudah terlalu banyak bertanya ke Klinbot dalam 1 menit. Tunggu sebentar ya, Kak! 😊',
});

// AI Chatbot — maks 100 pesan / hari per user+IP
const aiChatDailyLimiter = createRateLimiter({
    prefix:    'ai_chat_daily',
    windowSec: 86400,
    max:       100,
    keyBy:     'ip+user',
    message:   'Kamu sudah mencapai batas 100 pertanyaan hari ini ke Klinbot. Coba lagi besok ya, Kak! 😊',
});

// Login — mengganti loginLimitMap di auth.js
// Maks 10x / 15 menit per IP
const loginLimiter = createRateLimiter({
    prefix:    'login',
    windowSec: 900,
    max:       10,
    keyBy:     'ip',
    message:   'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.',
});

// OTP resend — mengganti ipResendMap di auth.js
// Maks 3x / jam per IP (sesuai RESEND_MAX di auth.js)
const otpResendLimiter = createRateLimiter({
    prefix:    'otp_resend',
    windowSec: 3600,
    max:       3,
    keyBy:     'ip',
    message:   'Terlalu banyak permintaan OTP. Coba lagi dalam 1 jam.',
});

// OTP verify — mengganti otpVerifyMap di auth.js
// Maks 5x / 15 menit per IP (sesuai OTP_VERIFY_MAX di auth.js)
const otpVerifyLimiter = createRateLimiter({
    prefix:    'otp_verify',
    windowSec: 900,
    max:       5,
    keyBy:     'ip',
    message:   'Terlalu banyak percobaan verifikasi OTP. Coba lagi dalam 15 menit.',
});

// Global — semua route, 200 req/menit per IP
const globalLimiter = createRateLimiter({
    prefix:    'global',
    windowSec: 60,
    max:       200,
    keyBy:     'ip',
    message:   'Terlalu banyak permintaan. Coba lagi dalam 1 menit.',
});

module.exports = {
    createRateLimiter,
    aiChatLimiter,
    aiChatDailyLimiter,
    loginLimiter,
    otpResendLimiter,
    otpVerifyLimiter,
    globalLimiter,
};
