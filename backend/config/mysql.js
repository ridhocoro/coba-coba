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
            max    : 5,
            min    : 2,
            acquire: 60000,
            idle   : 5000,
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

        // CATATAN: sync({ alter: true }) dihapus karena menyebabkan
        // index menumpuk di MySQL setiap restart server hingga melewati
        // batas 64 keys. Perubahan skema dilakukan manual via migration.
    } catch (err) {
        console.error('❌ MySQL Connection Error:', err.message);
        process.exit(1);
    }
};

module.exports = { sequelize, connectMySQL };