const jwt = require('jsonwebtoken');
const Consultation = require('../models/Consultation');

module.exports = (io) => {
    // Middleware autentikasi socket: validasi JWT sebelum koneksi diterima
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        if (!token) {
            return next(new Error('Authentication error: Token required'));
        }
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
            socket.userId   = decoded.userId;
            socket.userRole = decoded.role;
            next();
        } catch (err) {
            return next(new Error('Authentication error: Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`🔌 Client connected: ${socket.id} (userId: ${socket.userId})`);

        // Join room user sendiri (untuk notifikasi personal)
        socket.on('join-user', (userId) => {
            // FIX: user hanya boleh join room miliknya sendiri
            if (userId === socket.userId) {
                socket.join(`user-${userId}`);
            }
        });

        // Join room konsultasi — FIX: validasi akses ke room
        socket.on('join-consultation', async (consultationId) => {
            try {
                const consultation = await Consultation.findById(consultationId)
                    .populate('doctorId', 'userId');

                if (!consultation) return;

                const patientId    = consultation.userId?.toString();
                const doctorUserId = consultation.doctorId?.userId?.toString();
                const isAdmin   = socket.userRole === 'admin';
                const isPatient = patientId === socket.userId;
                const isDoctor  = doctorUserId === socket.userId;

                if (!isAdmin && !isPatient && !isDoctor) {
                    socket.emit('error', { message: 'Akses room konsultasi ditolak' });
                    return;
                }

                // Hanya boleh chat jika status memungkinkan
                const allowedStatuses = ['paid', 'scheduled', 'ongoing', 'completed'];
                if (!allowedStatuses.includes(consultation.status) && !isAdmin) {
                    socket.emit('error', { message: 'Konsultasi belum aktif' });
                    return;
                }

                socket.join(`consultation-${consultationId}`);
                console.log(`User ${socket.userId} joined consultation: ${consultationId}`);
            } catch (err) {
                console.error('[Socket] join-consultation error:', err.message);
            }
        });

        // Kirim pesan teks (broadcast ke room)
        socket.on('send-message', (data) => {
            io.to(`consultation-${data.consultationId}`).emit('receive-message', {
                message:    data.message,
                imageUrl:   data.imageUrl || null,
                senderId:   data.senderId,
                senderName: data.senderName,
                senderRole: data.senderRole,
                timestamp:  new Date()
            });
        });

        // Typing indicator
        socket.on('typing', (data) => {
            socket.to(`consultation-${data.consultationId}`).emit('user-typing', {
                senderId:   data.senderId,
                senderName: data.senderName
            });
        });

        socket.on('stop-typing', (data) => {
            socket.to(`consultation-${data.consultationId}`).emit('user-stop-typing', {
                senderId: data.senderId
            });
        });

        socket.on('leave-consultation', (consultationId) => {
            socket.leave(`consultation-${consultationId}`);
        });

        socket.on('disconnect', () => {
            console.log(`🔌 Client disconnected: ${socket.id}`);
        });
    });
};
