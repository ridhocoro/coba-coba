// backend/config/redis.js
// ============================================================
//  Redis client singleton  —  ioredis
//  Install: npm install ioredis
//
//  Support environment:
//   - Local Docker  : REDIS_HOST=redis, REDIS_TLS=false
//   - Railway Redis : REDIS_HOST=*.railway.internal, REDIS_TLS=false
//   - Upstash       : REDIS_URL=rediss://..., REDIS_TLS=true
// ============================================================

const Redis = require('ioredis');

let redisClient = null;

function getRedisClient() {
    if (redisClient) return redisClient;

    // Upstash / Railway bisa inject REDIS_URL langsung
    const redisUrl = process.env.REDIS_URL;

    const config = {
        retryStrategy(times) {
            if (times > 10) {
                console.error('[Redis] Berhenti retry setelah 10x gagal');
                return null;
            }
            const delay = Math.min(times * 200, 2000);
            console.warn(`[Redis] Retry ke-${times} dalam ${delay}ms...`);
            return delay;
        },
        connectTimeout:      10000,
        lazyConnect:         true,
        enableOfflineQueue:  false,  // jangan antri perintah saat Redis mati
    };

    if (redisUrl) {
        // Format URL: redis://:password@host:port  atau  rediss://...
        redisClient = new Redis(redisUrl, config);
    } else {
        redisClient = new Redis({
            host:     process.env.REDIS_HOST     || 'localhost',
            port:     parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD || undefined,
            ...(process.env.REDIS_TLS === 'true' && {
                tls: { rejectUnauthorized: false }
            }),
            ...config,
        });
    }

    redisClient.on('connect',     () => console.log('✅ Redis Connected'));
    redisClient.on('ready',       () => console.log('✅ Redis Ready'));
    redisClient.on('error',  (err) => console.error('[Redis Error]', err.message));
    redisClient.on('close',       () => console.warn('[Redis] Koneksi ditutup'));
    redisClient.on('reconnecting',() => console.warn('[Redis] Reconnecting...'));

    return redisClient;
}

// ── Safe wrappers: tidak throw meski Redis mati ───────────────
async function safeGet(key) {
    try { return await getRedisClient().get(key); }
    catch { return null; }
}

async function safeSet(key, value, ttlSeconds) {
    try {
        if (ttlSeconds) await getRedisClient().setex(key, ttlSeconds, value);
        else            await getRedisClient().set(key, value);
        return true;
    } catch { return false; }
}

async function safeDel(...keys) {
    try { await getRedisClient().del(...keys); return true; }
    catch { return false; }
}

async function safeIncr(key) {
    try { return await getRedisClient().incr(key); }
    catch { return null; }
}

async function safeExpire(key, ttl) {
    try { return await getRedisClient().expire(key, ttl); }
    catch { return false; }
}

async function safeTtl(key) {
    try { return await getRedisClient().ttl(key); }
    catch { return -1; }
}

module.exports = {
    getRedisClient,
    safeGet,
    safeSet,
    safeDel,
    safeIncr,
    safeExpire,
    safeTtl,
};
