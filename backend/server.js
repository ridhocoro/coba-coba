const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

dotenv.config();


const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// 🔔 Set io instance agar bisa diakses di routes
app.set('io', io);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Hybrid Populate Middleware ────────────────────────────────────────────────
const { hybridPopulateMiddleware } = require('./utils/hybridPopulateInterceptor');
app.use(hybridPopulateMiddleware);

// ── MongoDB ──────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/klinik-ipb', {
  maxPoolSize: 10,
  minPoolSize: 5,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4,
})
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.log('❌ MongoDB Connection Error:', err));

// Pastikan model-model baru terdaftar di Mongoose
require('./models/AdminChat');
require('./models/DoctorScheduleOverride');

// ── MySQL (hybrid database) ──────────────────────────────────────────────────
const { connectMySQL, sequelize } = require('./config/mysql');
require('./models/mysql');

async function initMySQL() {
  try {
    await connectMySQL();
    console.log('✅ MySQL Connected');
    
    // PENTING: Sync database tables - create if not exist
    // alter: false = jangan drop tabel, hanya create yang belum ada
    console.log('🔄 Syncing database tables...');
    await sequelize.sync({ alter: false });
    console.log('✅ Database tables synced');
  } catch (err) {
    console.error('❌ MySQL/Sync Error:', err.message);
    process.exit(1);
  }
}

// Panggil init sebelum routes
initMySQL();

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',            require('./routes/auth'));
app.use('/api/users',           require('./routes/users'));
app.use('/api/doctors',         require('./routes/doctors'));
app.use('/api/availability',    require('./routes/availability'));
app.use('/api/consultations',   require('./routes/consultations'));
app.use('/api/health-check',    require('./routes/healthCheck'));
app.use('/api/pharmacy',        require('./routes/pharmacy'));
app.use('/api/appointments',    require('./routes/appointments'));
app.use('/api/admin',           require('./routes/admin'));
app.use('/api/xendit',          require('./routes/xendit'));        // ← semua payment lewat sini
app.use('/api/clinic-settings', require('./routes/clinicSettings'));
app.use('/api/notifications',   require('./routes/notifications'));
app.use('/api/ollama', require('./routes/ollama'));

// routes/payments.js dan routes/manualpayment.js DIHAPUS —
// semua payment sekarang berpusat ke /api/xendit

// ── Socket.io (real-time chat + WebRTC signaling) ────────────────────────
require('./socket/chat')(io);

// ── Cron Jobs ────────────────────────────────────────────────────────────
// Setiap cron menjalankan logika bisnis penting secara otomatis.

// 1. Konsultasi kedaluwarsa, auto in_progress, doctor no-show, auto close
require('./utils/Expiredconsultationcron').startCron(io);

// 2. Order kedaluwarsa, auto siap_diambil, auto selesai
require('./utils/ExpiredOrderCron').startCron(io);

// 3. Appointment no-show + reminder H-24
require('./utils/AppointmentCron').startCron(io);

// 4. Hapus akun belum verifikasi > 24 jam
require('./utils/CleanupUnverifiedUsersCron').startCron();

// 5. Reminder jadwal mingguan dokter
require('./utils/WeeklyScheduleReminderCron').startCron(io);

// ── Error handler global ─────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[API Error]', err.message);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});