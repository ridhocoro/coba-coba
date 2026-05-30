// backend/server.js  ← GANTI file lama sepenuhnya
// ============================================================
//  Perubahan dari versi sebelumnya:
//  + import getRedisClient → inisialisasi koneksi Redis saat startup
//  + import globalLimiter  → pasang sebelum semua route (200 req/menit)
//  + graceful shutdown     → tutup Redis saat SIGTERM
// ============================================================

const express   = require('express');
const mongoose  = require('mongoose');
const cors      = require('cors');
const dotenv    = require('dotenv');
const http      = require('http');
const socketIO  = require('socket.io');
const path      = require('path');

dotenv.config();

// ── Redis: inisialisasi koneksi sejak dini ────────────────────
const { getRedisClient } = require('./config/redis');
getRedisClient(); // mulai koneksi lazy — error tidak crash server

// ── Rate limiter global ───────────────────────────────────────
const { globalLimiter } = require('./middleware/rateLimiter');

const app    = express();
const server = http.createServer(app);
const io     = socketIO(server, {
    cors: {
        origin:  ['https://klinik-frontend-amber.vercel.app', 'http://localhost:3000'],
        methods: ['GET', 'POST'],
    },
    // FIX-4: Utamakan WebSocket, hindari polling yang lambat di Railway
    transports:    ['websocket', 'polling'],
    pingTimeout:   60000,  // toleransi koneksi lambat / Railway cold start
    pingInterval:  25000,  // kirim ping lebih sering agar koneksi tidak mati
});

app.set('io', io);

// ── Middleware ────────────────────────────────────────────────
app.use(cors({
    origin:      ['https://klinik-frontend-amber.vercel.app', 'http://localhost:3000'],
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Hybrid Populate
const { hybridPopulateMiddleware } = require('./utils/hybridPopulateInterceptor');
app.use(hybridPopulateMiddleware);

// ── Global rate limiter (200 req/menit per IP) ────────────────
// Dipasang setelah middleware dasar, sebelum semua route
app.use(globalLimiter);

// ── MongoDB ───────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/klinik-ipb', {
    maxPoolSize:              10,
    minPoolSize:              5,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS:          45000,
    family:                   4,
})
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.log('❌ MongoDB Connection Error:', err));

require('./models/AdminChat');
require('./models/DoctorScheduleOverride');

// ── MySQL ─────────────────────────────────────────────────────
const { connectMySQL, sequelize } = require('./config/mysql');
require('./models/mysql');

(async () => {
    try {
        await connectMySQL();
        console.log('✅ MySQL Connected');
        console.log('🔄 Syncing database tables...');
        await sequelize.sync({ alter: false });
        console.log('✅ Database tables synced');
    } catch (err) {
        console.error('❌ MySQL/Database Sync Error:', err.message);
        console.error('⚠️  Server tetap jalan tapi database tidak siap');
    }
})();

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',            require('./routes/auth'));
app.use('/api/users',           require('./routes/users'));
app.use('/api/doctors',         require('./routes/doctors'));
app.use('/api/availability',    require('./routes/availability'));
app.use('/api/consultations',   require('./routes/consultations'));
app.use('/api/health-check',    require('./routes/healthCheck'));
app.use('/api/pharmacy',        require('./routes/pharmacy'));
app.use('/api/appointments',    require('./routes/appointments'));
app.use('/api/admin',           require('./routes/admin'));
app.use('/api/xendit',          require('./routes/xendit'));
app.use('/api/clinic-settings', require('./routes/clinicSettings'));
app.use('/api/notifications',   require('./routes/notifications'));
app.use('/api/ollama',          require('./routes/ollama'));

// ── Socket.io ─────────────────────────────────────────────────
require('./socket/chat')(io);

// ── Cron Jobs ─────────────────────────────────────────────────
require('./utils/Expiredconsultationcron').startCron(io);
require('./utils/ExpiredOrderCron').startCron(io);
require('./utils/AppointmentCron').startCron(io);
require('./utils/CleanupUnverifiedUsersCron').startCron();
require('./utils/WeeklyScheduleReminderCron').startCron(io);
require('./utils/VideoLogCleanupCron').startCron();

// ── Error handler global ──────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('[API Error]', err.message);
    res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

// ── Graceful shutdown: tutup Redis sebelum process mati ───────
async function gracefulShutdown(signal) {
    console.log(`\n🛑 ${signal} diterima, shutting down...`);
    try {
        await getRedisClient().quit();
        console.log('✅ Redis disconnected');
    } catch (err) {
        console.error('[Shutdown] Redis quit error:', err.message);
    }
    server.close(() => {
        console.log('✅ HTTP server closed');
        process.exit(0);
    });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
