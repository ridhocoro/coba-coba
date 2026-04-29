/**
 * init-db.js — FIXED VERSION
 */

// Gunakan path absolut untuk dotenv agar pasti terbaca dari folder root
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// IMPORT instance sequelize dan model sekaligus dari models/mysql/index.js
const { 
    sequelize, 
    User, 
    Doctor, 
    DoctorSchedule, 
    Medicine, 
    Order, 
    OrderItem, 
    Payment 
} = require('../models/mysql'); 

async function initDB() {
    try {
        console.log('\n🔄 Connecting to MySQL...');
        console.log(`Host: ${process.env.MYSQL_HOST}`);
        console.log(`Database: ${process.env.MYSQL_DATABASE}\n`);
        
        await sequelize.authenticate();
        console.log('✅ MySQL Connection OK\n');

        console.log('📦 Models found:');
        console.log(`   - ${User.name}\n   - ${Doctor.name}\n   - ${Order.name}\n`);

        console.log('🔄 Syncing tables (Creating if not exist)...');
        // Gunakan alter: true agar tabel dibuat otomatis
        await sequelize.sync({ alter: true });
        console.log('✅ All tables synced\n');

        // List tabel untuk verifikasi
        const [tables] = await sequelize.query(
            "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?",
            { replacements: [process.env.MYSQL_DATABASE] }
        );

        console.log('📋 Tables in Railway:');
        tables.forEach((row, i) => {
            console.log(`   ${i + 1}. ${row.TABLE_NAME}`);
        });

        console.log(`\n✅ Database initialization complete! (${tables.length} tables)\n`);
        
        await sequelize.close();
        process.exit(0);

    } catch (err) {
        console.error('\n❌ Error:', err.message);
        process.exit(1);
    }
}

initDB();