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

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/klinik-ipb')
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.log('❌ MongoDB Connection Error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/doctors', require('./routes/doctors'));
app.use('/api/availability', require('./routes/availability'));
app.use('/api/consultations', require('./routes/consultations'));
app.use('/api/health-check', require('./routes/healthCheck'));
app.use('/api/pharmacy', require('./routes/pharmacy'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/manual-payment', require('./routes/manualpayment'));

// 🔔 TAMBAHKAN ROUTE NOTIFIKASI
app.use('/api/notifications', require('./routes/notifications'));

// Socket.io for real-time chat
require('./socket/chat')(io);

// Cron: expired consultation checker (setiap 1 menit)
require('./utils/Expiredconsultationcron').startCron(io);

// Cron: doctor no-show checker (setiap 1 menit, grace period 15 mnt)
require('./utils/DoctorNoShowCron').startCron(io);

// Cron: expired order checker (setiap 1 menit)
require('./utils/ExpiredOrderCron').startCron();

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});