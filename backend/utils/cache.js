// backend/utils/cache.js
// ============================================================
//  Cache helper  —  getOrSet, OTP store, token blacklist
//
//  Menggantikan struktur in-memory di auth.js:
//   ipResendMap   → rate limiter Redis (rateLimiter.js)
//   otpVerifyMap  → rate limiter Redis (rateLimiter.js)
//   loginLimitMap → rate limiter Redis (rateLimiter.js)
//   OTP data      → storeOtp / getOtp / deleteOtp (file ini)
// ============================================================

const { safeGet, safeSet, safeDel, getRedisClient } = require('../config/redis');

// ── Key namespace ─────────────────────────────────────────────
const CACHE_KEYS = {
    DOCTORS_ALL:      'cache:doctors:all',
    DOCTOR_DETAIL:    (id) => `cache:doctors:${id}`,
    DOCTOR_SCHEDULE:  (id) => `cache:doctors:${id}:schedule`,

    // FIX: MEDICINES_ALL dihapus karena tidak dipakai di mana pun.
    // Semua cache medicines menggunakan MEDICINES_PAGE (per query parameter).
    MEDICINES_PAGE:   (search, cat, page, limit) =>
                        `cache:medicines:${search||''}:${cat||''}:p${page}:l${limit}`,

    CLINIC_SETTINGS:  'cache:clinic:settings',
    REFUND_BANKS:     'cache:refund_banks',
    OTP:              (email) => `otp:${Buffer.from(email).toString('base64')}`,
    TOKEN_BLACKLIST:  (jti)   => `blacklist:${jti}`,
};

const TTL = {
    DOCTORS:          300,    //  5 menit
    MEDICINES:        300,    //  5 menit (konservatif — data stok bisa berubah cepat)
    CLINIC_SETTINGS:  3600,   //  1 jam
    REFUND_BANKS:     3600,   //  1 jam (data bank jarang berubah)
    OTP:              300,    //  5 menit (sama dengan OTP_EXPIRES_MIN di auth.js)
    TOKEN_BLACKLIST:  86400,  // 24 jam
};

// ═══════════════════════════════════════════════════════════════
//  CORE: getOrSet
//  Cache-aside pattern: cek cache → hit → return, miss → fetch → simpan
// ═══════════════════════════════════════════════════════════════
async function getOrSet(key, ttlSeconds, fetchFn) {
    const cached = await safeGet(key);
    if (cached !== null) {
        try { return JSON.parse(cached); } catch { /* cache corrupt, lanjut fetch */ }
    }

    const data = await fetchFn();
    // Simpan async, tidak block response
    safeSet(key, JSON.stringify(data), ttlSeconds).catch(() => {});
    return data;
}

async function invalidate(key) {
    return safeDel(key);
}

// FIX: invalidateMany menggunakan Promise.all agar aman
// jika safeDel hanya menerima 1 argument
async function invalidateMany(...keys) {
    return Promise.all(keys.map(k => safeDel(k)));
}

// Invalidate semua key yang cocok dengan pattern (pakai SCAN, aman di prod)
async function invalidatePattern(pattern) {
    try {
        const client = getRedisClient();
        let cursor = '0';
        const toDelete = [];
        do {
            const [next, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
            cursor = next;
            toDelete.push(...keys);
        } while (cursor !== '0');

        if (toDelete.length > 0) {
            await client.del(...toDelete);
            console.log(`[Cache] Invalidated ${toDelete.length} keys: ${pattern}`);
        }
    } catch (err) {
        console.error('[Cache] invalidatePattern error:', err.message);
    }
}

// ═══════════════════════════════════════════════════════════════
//  OTP STORE
//  Menggantikan otpVerifyMap (Map in-memory) di auth.js.
//  Keunggulan: tetap ada setelah server restart, aman multi-instance.
//
//  Cara pakai di auth.js:
//    GANTI:  const otpStore = new Map();
//            otpStore.set(email, { otp, name, ... })
//    DENGAN: await storeOtp(email, { otp, name, ... })
//            const data = await getOtp(email)
//            await deleteOtp(email)
// ═══════════════════════════════════════════════════════════════

/**
 * Simpan data OTP ke Redis
 * @param {string} email
 * @param {object} data - { otp, name, resendCount, createdAt, ... }
 */
async function storeOtp(email, data) {
    return safeSet(CACHE_KEYS.OTP(email), JSON.stringify(data), TTL.OTP);
}

/**
 * Ambil data OTP dari Redis
 * @param {string} email
 * @returns {object|null}
 */
async function getOtp(email) {
    const raw = await safeGet(CACHE_KEYS.OTP(email));
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
}

/**
 * Hapus OTP setelah berhasil diverifikasi
 * @param {string} email
 */
async function deleteOtp(email) {
    return safeDel(CACHE_KEYS.OTP(email));
}

// ═══════════════════════════════════════════════════════════════
//  TOKEN BLACKLIST
//  Untuk logout sejati: token di-blacklist sampai expiry-nya.
//  Perlu ditambahkan pengecekan di middleware/auth.js.
// ═══════════════════════════════════════════════════════════════

async function blacklistToken(jti, ttlSeconds = TTL.TOKEN_BLACKLIST) {
    return safeSet(CACHE_KEYS.TOKEN_BLACKLIST(jti), '1', ttlSeconds);
}

async function isTokenBlacklisted(jti) {
    const val = await safeGet(CACHE_KEYS.TOKEN_BLACKLIST(jti));
    return val !== null;
}

module.exports = {
    getOrSet,
    invalidate,
    invalidateMany,
    invalidatePattern,
    CACHE_KEYS,
    TTL,
    // OTP
    storeOtp,
    getOtp,
    deleteOtp,
    // Token
    blacklistToken,
    isTokenBlacklisted,
};
