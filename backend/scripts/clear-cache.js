/**
 * Script untuk membersihkan Redis Cache secara manual.
 * Berguna saat ada data nyangkut di environment production (Railway).
 * 
 * Cara pakai:
 * railway run node scripts/clear-cache.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Redis = require('ioredis');

async function clearCache() {
    const redisUrl = process.env.REDIS_URL;
    let client;

    console.log("Menghubungkan ke Redis...");
    
    if (redisUrl) {
        client = new Redis(redisUrl);
    } else {
        client = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD || undefined,
            ...(process.env.REDIS_TLS === 'true' && { tls: { rejectUnauthorized: false } })
        });
    }

    try {
        console.log("Mengambil semua keys...");
        const keys = await client.keys('cache:*');
        
        if (keys.length === 0) {
            console.log("✅ Tidak ada cache yang perlu dihapus.");
        } else {
            console.log(`Menghapus ${keys.length} keys...`);
            await client.del(...keys);
            console.log("✅ Berhasil menghapus cache!");
        }
    } catch (e) {
        console.error("❌ Gagal menghapus cache:", e.message);
    } finally {
        client.quit();
        process.exit(0);
    }
}

clearCache();
