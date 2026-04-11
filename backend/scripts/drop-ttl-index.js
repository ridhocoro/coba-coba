/**
 * drop-ttl-index.js
 *
 * Script sekali-jalan untuk menghapus TTL index "paymentDeadline_1"
 * dari collection consultations di MongoDB.
 *
 * TTL index ini menyebabkan dokumen konsultasi terhapus PERMANEN dari database
 * secara otomatis saat paymentDeadline terlewat — bahkan jika status sudah
 * 'confirmed'. Ini adalah root cause utama data konsultasi yang hilang.
 *
 * CARA MENJALANKAN:
 *   cd backend
 *   node scripts/drop-ttl-index.js
 *
 * Jalankan SEKALI SAJA. Setelah berhasil, script ini tidak perlu dijalankan lagi.
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!MONGO_URI) {
    console.error('❌  MONGODB_URI tidak ditemukan di .env');
    process.exit(1);
}

async function dropTTLIndex() {
    console.log('🔌  Menghubungkan ke MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅  Terhubung.\n');

    const db = mongoose.connection.db;
    const collection = db.collection('consultations');

    // ── 1. Tampilkan semua index yang ada sekarang ────────────────────────────
    const indexesBefore = await collection.indexes();
    console.log('📋  Index saat ini di collection "consultations":');
    for (const idx of indexesBefore) {
        const isTTL = idx.expireAfterSeconds !== undefined;
        console.log(`  ${isTTL ? '🔴 TTL' : '   '} [${idx.name}]  key: ${JSON.stringify(idx.key)}${isTTL ? `  expireAfterSeconds: ${idx.expireAfterSeconds}` : ''}`);
    }
    console.log();

    // ── 2. Cari semua TTL index (expireAfterSeconds !== undefined) ────────────
    const ttlIndexes = indexesBefore.filter(idx => idx.expireAfterSeconds !== undefined);

    if (ttlIndexes.length === 0) {
        console.log('✅  Tidak ditemukan TTL index. Tidak ada yang perlu dihapus.');
        await mongoose.disconnect();
        return;
    }

    console.log(`⚠️   Ditemukan ${ttlIndexes.length} TTL index yang akan dihapus:`);
    for (const idx of ttlIndexes) {
        console.log(`    - "${idx.name}"  field: ${JSON.stringify(idx.key)}`);
    }
    console.log();

    // ── 3. Drop semua TTL index ───────────────────────────────────────────────
    for (const idx of ttlIndexes) {
        try {
            await collection.dropIndex(idx.name);
            console.log(`🗑   TTL index "${idx.name}" berhasil dihapus.`);
        } catch (err) {
            console.error(`❌  Gagal menghapus index "${idx.name}": ${err.message}`);
        }
    }
    console.log();

    // ── 4. Tampilkan index yang tersisa untuk konfirmasi ──────────────────────
    const indexesAfter = await collection.indexes();
    console.log('📋  Index tersisa setelah cleanup:');
    for (const idx of indexesAfter) {
        console.log(`     [${idx.name}]  key: ${JSON.stringify(idx.key)}`);
    }

    console.log('\n✅  Selesai. TTL index sudah dihapus — data konsultasi tidak akan terhapus otomatis lagi.');
    console.log('    Silakan restart server backend.\n');
    await mongoose.disconnect();
}

dropTTLIndex().catch(err => {
    console.error('❌  Error tidak terduga:', err.message);
    mongoose.disconnect();
    process.exit(1);
});