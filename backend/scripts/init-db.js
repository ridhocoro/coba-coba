/**
 * init-db.js
 * 
 * Script standalone untuk create/sync tabel di Railway MySQL
 * Jalankan SATU KALI saja untuk setup database
 * 
 * cd backend
 * node scripts/init-db.js
 */

require('dotenv').config({ path: '../.env' });
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
    process.env.MYSQL_DATABASE || 'klinik_ipb',
    process.env.MYSQL_USER     || 'root',
    process.env.MYSQL_PASSWORD || '',
    {
        host    : process.env.MYSQL_HOST || 'localhost',
        port    : parseInt(process.env.MYSQL_PORT || '3306'),
        dialect : 'mysql',
        timezone: '+07:00',
        logging : false,
        pool: {
            max    : 5,
            min    : 2,
            acquire: 60000,
            idle   : 5000,
        },
    }
);

async function initDB() {
    try {
        console.log('\n🔄 Connecting to MySQL...');
        console.log(`Host: ${process.env.MYSQL_HOST}`);
        console.log(`Database: ${process.env.MYSQL_DATABASE}\n`);
        
        await sequelize.authenticate();
        console.log('✅ MySQL Connection OK\n');

        console.log('📦 Loading models...');
        const { User, Doctor, DoctorSchedule, Medicine, Order, OrderItem, Payment } 
            = require('../models/mysql');
        console.log('✅ Models loaded\n');

        console.log('🔄 Syncing tables...');
        await sequelize.sync({ alter: false });
        console.log('✅ All tables synced\n');

        // List tabel
        const [tables] = await sequelize.query(
            "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?"
            , { replacements: [process.env.MYSQL_DATABASE] }
        );

        console.log('📋 Tables created:');
        tables.forEach((row, i) => {
            console.log(`   ${i + 1}. ${row.TABLE_NAME}`);
        });

        console.log(`\n✅ Database initialization complete! (${tables.length} tables)\n`);
        
        await sequelize.close();
        process.exit(0);

    } catch (err) {
        console.error('\n❌ Error:', err.message);
        if (err.original) console.error('Details:', err.original.message);
        process.exit(1);
    }
}

initDB();