/**
 * fix-indexes.js
 * 
 * Membersihkan index duplikat yang menumpuk akibat sync({ alter: true }).
 * Jalankan SEKALI saja: node scripts/fix-indexes.js
 * 
 * Yang dilakukan:
 * 1. Untuk setiap tabel, ambil semua non-PRIMARY index
 * 2. Hapus semua index duplikat, sisakan satu per kolom
 * 3. Pertahankan index UNIQUE yang penting (email, order_number)
 */

require('dotenv').config();
const { sequelize } = require('../config/mysql');

// Index UNIQUE yang wajib dipertahankan (key_name yang benar)
const KEEP_UNIQUE = {
    users:   ['email'],
    orders:  ['order_number'],
    payments:['xendit_invoice_id', 'xendit_external_id'],
};

async function fixIndexes() {
    try {
        await sequelize.authenticate();
        console.log('✅ Terhubung ke MySQL\n');

        const [tables] = await sequelize.query(
            `SELECT TABLE_NAME FROM information_schema.TABLES 
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'`
        );

        for (const { TABLE_NAME: table } of tables) {
            const [indexes] = await sequelize.query(
                `SHOW INDEX FROM \`${table}\``
            );

            // Kelompokkan index by Key_name (nama index)
            const byName = {};
            for (const idx of indexes) {
                if (!byName[idx.Key_name]) byName[idx.Key_name] = [];
                byName[idx.Key_name].push(idx);
            }

            // Kelompokkan by kolom — cari duplikat (index berbeda nama tapi kolom sama)
            const byColumn = {};
            for (const [keyName, rows] of Object.entries(byName)) {
                if (keyName === 'PRIMARY') continue;
                const colKey = rows.map(r => r.Column_name).sort().join(',');
                if (!byColumn[colKey]) byColumn[colKey] = [];
                byColumn[colKey].push(keyName);
            }

            let dropped = 0;
            for (const [colKey, keyNames] of Object.entries(byColumn)) {
                if (keyNames.length <= 1) continue;

                // Tentukan index mana yang dipertahankan:
                // Prioritaskan nama yang pendek / bukan angka acak
                const keepNames = (KEEP_UNIQUE[table] || []);
                const sorted = keyNames.sort((a, b) => a.length - b.length);
                const toKeep = sorted.find(n => keepNames.includes(n)) || sorted[0];
                const toDrop = sorted.filter(n => n !== toKeep);

                for (const idxName of toDrop) {
                    try {
                        await sequelize.query(`ALTER TABLE \`${table}\` DROP INDEX \`${idxName}\``);
                        console.log(`  🗑  ${table}: DROP INDEX \`${idxName}\` (duplikat kolom: ${colKey})`);
                        dropped++;
                    } catch (e) {
                        console.warn(`  ⚠️  Gagal drop ${table}.${idxName}: ${e.message}`);
                    }
                }
            }

            if (dropped === 0) {
                console.log(`  ✔  ${table}: tidak ada index duplikat`);
            }
        }

        console.log('\n✅ Selesai. Silakan restart server.');
    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await sequelize.close();
    }
}

fixIndexes();