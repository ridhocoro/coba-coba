/**
 * backend/scripts/migrate-refund-fields.js
 *
 * Jalankan dengan: node backend/scripts/migrate-refund-fields.js
 */

require('dotenv').config();
const { sequelize } = require('../config/mysql');

async function migrate() {
    console.log('🔄 Menjalankan migration refund fields...\n');

    // 1. Tambah kolom baru (skip jika sudah ada)
    const columns = [
        { name: 'refund_video_public_id', sql: `ALTER TABLE orders ADD COLUMN refund_video_public_id VARCHAR(255) NULL AFTER refund_video_url` },
        { name: 'refund_approved_at',     sql: `ALTER TABLE orders ADD COLUMN refund_approved_at DATETIME NULL AFTER refund_reviewed_at` },
        { name: 'refund_approved_by',     sql: `ALTER TABLE orders ADD COLUMN refund_approved_by CHAR(36) NULL AFTER refund_approved_at` },
    ];

    for (const q of columns) {
        try {
            await sequelize.query(q.sql);
            console.log(`  ✅ Kolom "${q.name}" berhasil ditambahkan`);
        } catch (err) {
            if (err.message.includes('Duplicate column name') || err.message.includes('already exists')) {
                console.log(`  ⚠️  Kolom "${q.name}" sudah ada, dilewati`);
            } else {
                throw err;
            }
        }
    }

    // 2. Cek data dengan status lama yang tidak ada di ENUM baru
    console.log('\n  🔍 Cek data dengan status lama...');
    const oldStatuses = ['refund_approved', 'refund_waiting_bank_info', 'refund_processing', 'refund_failed'];
    const [rows] = await sequelize.query(
        `SELECT id, status FROM orders WHERE status IN (:statuses)`,
        { replacements: { statuses: oldStatuses } }
    );

    if (rows.length > 0) {
        console.log(`  ⚠️  Ditemukan ${rows.length} row dengan status lama:`);
        rows.forEach(r => console.log(`      • id=${r.id} → status="${r.status}"`));

        // Map status lama ke status baru
        const statusMap = {
            'refund_approved'         : 'refund_requested', // kembalikan ke requested agar bisa diproses ulang
            'refund_waiting_bank_info': 'refund_requested',
            'refund_processing'       : 'refunded',         // sudah diproses, anggap selesai
            'refund_failed'           : 'refund_rejected',
        };

        for (const row of rows) {
            const newStatus = statusMap[row.status] || 'refund_requested';
            await sequelize.query(
                `UPDATE orders SET status = :newStatus WHERE id = :id`,
                { replacements: { newStatus, id: row.id } }
            );
            console.log(`  ✅ id=${row.id}: "${row.status}" → "${newStatus}"`);
        }
    } else {
        console.log('  ✅ Tidak ada data dengan status lama');
    }

    // 3. Update ENUM (setelah data bersih)
    console.log('\n  🔄 Update ENUM status orders...');
    await sequelize.query(`
        ALTER TABLE orders MODIFY COLUMN status ENUM(
            'waiting_prescription',
            'prescription_rejected',
            'pending',
            'paid',
            'diproses',
            'dikirim',
            'terkirim',
            'siap_diambil',
            'selesai',
            'expired',
            'cancelled',
            'refund_requested',
            'refund_rejected',
            'refunded'
        ) NOT NULL DEFAULT 'pending'
    `);
    console.log('  ✅ ENUM status berhasil diupdate');

    console.log('\n✅ Migration selesai!\n');
    process.exit(0);
}

migrate().catch(err => {
    console.error('\n❌ Migration gagal:', err.message);
    process.exit(1);
});