// backend/config/mysql.js
// Sequelize connection untuk MySQL
// Install: npm install sequelize mysql2

const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
    process.env.MYSQL_DATABASE || 'klinik_ipb',
    process.env.MYSQL_USER     || 'root',
    process.env.MYSQL_PASSWORD || '',
    {
        host    : process.env.MYSQL_HOST || 'localhost',
        port    : parseInt(process.env.MYSQL_PORT || '3306'),
        dialect : 'mysql',
        timezone: '+07:00',  // WIB
        logging : false,
        pool: {
            max    : 5,           // Kurangi dari 10 agar lebih stabil
            min    : 2,           // Minimal 2 koneksi
            acquire: 60000,       // 60 detik timeout acquire (naik dari 30s)
            idle   : 5000,        // 5 detik sebelum idle (turun dari 10s)
            validate: (conn) => {
                return new Promise((resolve, reject) => {
                    conn.query('SELECT 1', (err) => {
                        if (err) reject(err);
                        else resolve(conn);
                    });
                });
            },
        },
        define: {
            underscored  : true,  // camelCase → snake_case otomatis
            freezeTableName: false,
            timestamps   : true,
            createdAt    : 'created_at',
            updatedAt    : 'updated_at',
        },
    }
);

const connectMySQL = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ MySQL Connected');

        // CATATAN: sync({ alter: false }) dipindahkan ke server.js
        // agar bisa dijalankan setelah models sudah di-require
    } catch (err) {
        console.error('❌ MySQL Connection Error:', err.message);
        process.exit(1);
    }
};

module.exports = { sequelize, connectMySQL };