const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIO = require('socket.io');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/klinik-ipb', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Routes - PASTIKAN SEMUA ADA TANPA KOMA BERLEBIH
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/doctors', require('./routes/doctors'));
app.use('/api/consultations', require('./routes/consultations'));
app.use('/api/health-check', require('./routes/healthCheck'));
app.use('/api/sick-letters', require('./routes/sickLetters'));
app.use('/api/pharmacy', require('./routes/pharmacy'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/manual-payment', require('./routes/manualpayment'));

// Socket.io for real-time chat
require('./socket/chat')(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});