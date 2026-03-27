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
            max    : 10,
            min    : 0,
            acquire: 30000,
            idle   : 10000,
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

        // Sync models di development saja (bukan production)
        if (process.env.NODE_ENV === 'development') {
            await sequelize.sync({ alter: true });
            console.log('✅ MySQL Models synced');
        }
    } catch (err) {
        console.error('❌ MySQL Connection Error:', err.message);
        process.exit(1);
    }
};

module.exports = { sequelize, connectMySQL };