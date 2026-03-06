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

                // Dokter boleh join kapan saja (untuk cek keluhan)
                // User boleh join saat confirmed/in_progress/completed
                const userAllowed = ['confirmed', 'paid', 'scheduled', 'in_progress', 'ongoing', 'completed'];
                if (!isAdmin && !isDoctor && !userAllowed.includes(consultation.status)) {
                    socket.emit('error', { message: 'Konsultasi belum aktif' });
                    return;
                }

                socket.join(`consultation-${consultationId}`);
                console.log(`User ${socket.userId} (${socket.userRole}) joined consultation: ${consultationId}`);
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

        // ── WebRTC Video Call Signaling ─────────────────────────────────────
        // Semua event diteruskan hanya ke pihak lain di room (socket.to = broadcast kecuali pengirim)

        // Dokter → User: offer
        socket.on('vc-offer', ({ consultationId, offer }) => {
            socket.to(`consultation-${consultationId}`).emit('vc-offer', { offer });
        });

        // User → Dokter: answer
        socket.on('vc-answer', ({ consultationId, answer }) => {
            socket.to(`consultation-${consultationId}`).emit('vc-answer', { answer });
        });

        // Kedua pihak: ICE candidate exchange
        socket.on('vc-ice-candidate', ({ consultationId, candidate }) => {
            socket.to(`consultation-${consultationId}`).emit('vc-ice-candidate', { candidate });
        });

        // Salah satu pihak akhiri call
        socket.on('vc-end', ({ consultationId }) => {
            socket.to(`consultation-${consultationId}`).emit('vc-end');
        });
        // ───────────────────────────────────────────────────────────────────

        socket.on('leave-consultation', (consultationId) => {
            socket.leave(`consultation-${consultationId}`);
        });

        // ── WebRTC Signaling ──────────────────────────────────────────────────
        // Semua event diteruskan hanya ke user lain dalam room (bukan broadcast)

        // Inisiator kirim offer ke pihak lain
        socket.on('webrtc-offer', ({ consultationId, offer }) => {
            socket.to(`consultation-${consultationId}`).emit('webrtc-offer', {
                offer,
                fromId: socket.userId
            });
        });

        // Penerima balas dengan answer
        socket.on('webrtc-answer', ({ consultationId, answer }) => {
            socket.to(`consultation-${consultationId}`).emit('webrtc-answer', {
                answer,
                fromId: socket.userId
            });
        });

        // ICE candidate exchange
        socket.on('webrtc-ice-candidate', ({ consultationId, candidate }) => {
            socket.to(`consultation-${consultationId}`).emit('webrtc-ice-candidate', {
                candidate,
                fromId: socket.userId
            });
        });

        // Notifikasi: user mulai video call (agar pihak lain tahu ada panggilan masuk)
        socket.on('webrtc-call-start', ({ consultationId }) => {
            socket.to(`consultation-${consultationId}`).emit('webrtc-incoming-call', {
                fromId: socket.userId
            });
        });

        // Notifikasi: user akhiri/tolak video call
        socket.on('webrtc-call-end', ({ consultationId }) => {
            socket.to(`consultation-${consultationId}`).emit('webrtc-call-ended', {
                fromId: socket.userId
            });
        });

        socket.on('disconnect', () => {
            console.log(`🔌 Client disconnected: ${socket.id}`);
        });
    });
};