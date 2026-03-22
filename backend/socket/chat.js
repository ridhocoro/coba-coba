const jwt = require('jsonwebtoken');
const Consultation = require('../models/Consultation');
const Doctor       = require('../models/Doctor');

module.exports = (io) => {
    // Middleware autentikasi socket
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

        // Join room user sendiri
        socket.on('join-user', (userId) => {
            if (userId === socket.userId) {
                socket.join(`user-${userId}`);
            }
        });

        // Join room konsultasi — dengan validasi akses
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

                const userAllowed = ['confirmed', 'paid', 'scheduled', 'in_progress', 'ongoing', 'completed', 'no_show'];
                if (!isAdmin && !isDoctor && !userAllowed.includes(consultation.status)) {
                    socket.emit('error', { message: 'Konsultasi belum aktif' });
                    return;
                }

                socket.join(`consultation-${consultationId}`);
                // Simpan rooms yang di-join untuk reconnect handling
                if (!socket.consultationRooms) socket.consultationRooms = new Set();
                socket.consultationRooms.add(consultationId);

                console.log(`User ${socket.userId} (${socket.userRole}) joined consultation: ${consultationId}`);
            } catch (err) {
                console.error('[Socket] join-consultation error:', err.message);
            }
        });

        // Reconnect: re-join semua rooms yang sebelumnya di-join
        socket.on('reconnect-rooms', async ({ consultationIds, userId }) => {
            // Re-join user room
            if (userId === socket.userId) {
                socket.join(`user-${userId}`);
            }
            // Re-join consultation rooms
            if (Array.isArray(consultationIds)) {
                for (const cId of consultationIds) {
                    try {
                        const consultation = await Consultation.findById(cId)
                            .populate('doctorId', 'userId');
                        if (!consultation) continue;

                        const patientId    = consultation.userId?.toString();
                        const doctorUserId = consultation.doctorId?.userId?.toString();
                        const isAdmin   = socket.userRole === 'admin';
                        const isPatient = patientId === socket.userId;
                        const isDoctor  = doctorUserId === socket.userId;

                        if (isAdmin || isPatient || isDoctor) {
                            socket.join(`consultation-${cId}`);
                            if (!socket.consultationRooms) socket.consultationRooms = new Set();
                            socket.consultationRooms.add(cId);
                        }
                    } catch {}
                }
            }
            socket.emit('rooms-rejoined', { success: true });
        });

        // Kirim pesan teks
        // SEC-02 fix: derive senderRole and senderName from server-side data, never trust client
        socket.on('send-message', async (data) => {
            try {
                const consultation = await Consultation.findById(data.consultationId)
                    .populate('userId', 'name')
                    .populate('doctorId', 'name userId')
                    .lean();
                if (!consultation) return;

                const isPatient = consultation.userId?._id?.toString() === socket.userId;
                const isDr      = consultation.doctorId?.userId?.toString() === socket.userId;

                // Only patient or doctor of THIS consultation may broadcast
                if (!isPatient && !isDr && socket.userRole !== 'admin') return;

                const senderRole = isPatient ? (consultation.userId?.role || 'user') : 'doctor';
                const senderName = isPatient
                    ? (consultation.userId?.name || 'Pasien')
                    : `dr. ${consultation.doctorId?.name || 'Dokter'}`;

                io.to(`consultation-${data.consultationId}`).emit('receive-message', {
                    _id:        data._id,
                    message:    data.message,
                    imageUrl:   data.imageUrl || null,
                    senderId:   socket.userId,   // always use server-verified userId
                    senderName,                   // server-derived, not from client
                    senderRole,                   // server-derived, not from client
                    timestamp:  new Date(),
                });
            } catch (err) {
                console.error('[Socket] send-message error:', err.message);
            }
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
        socket.on('vc-offer', ({ consultationId, offer }) => {
            socket.to(`consultation-${consultationId}`).emit('vc-offer', { offer });
        });

        socket.on('vc-answer', ({ consultationId, answer }) => {
            socket.to(`consultation-${consultationId}`).emit('vc-answer', { answer });
        });

        socket.on('vc-ice-candidate', ({ consultationId, candidate }) => {
            socket.to(`consultation-${consultationId}`).emit('vc-ice-candidate', { candidate });
        });

        socket.on('vc-end', ({ consultationId }) => {
            socket.to(`consultation-${consultationId}`).emit('vc-end');
        });

        // WebRTC ICE restart request (reconnect)
        socket.on('vc-ice-restart', ({ consultationId }) => {
            socket.to(`consultation-${consultationId}`).emit('vc-ice-restart');
        });

        // ── WebRTC Signaling (alias) ──────────────────────────────────────
        socket.on('webrtc-offer', ({ consultationId, offer }) => {
            socket.to(`consultation-${consultationId}`).emit('webrtc-offer', {
                offer,
                fromId: socket.userId
            });
        });

        socket.on('webrtc-answer', ({ consultationId, answer }) => {
            socket.to(`consultation-${consultationId}`).emit('webrtc-answer', {
                answer,
                fromId: socket.userId
            });
        });

        socket.on('webrtc-ice-candidate', ({ consultationId, candidate }) => {
            socket.to(`consultation-${consultationId}`).emit('webrtc-ice-candidate', {
                candidate,
                fromId: socket.userId
            });
        });

        socket.on('webrtc-call-start', ({ consultationId }) => {
            socket.to(`consultation-${consultationId}`).emit('webrtc-incoming-call', {
                fromId: socket.userId
            });
        });

        socket.on('webrtc-call-end', ({ consultationId }) => {
            socket.to(`consultation-${consultationId}`).emit('webrtc-call-ended', {
                fromId: socket.userId
            });
        });

        socket.on('leave-consultation', (consultationId) => {
            socket.leave(`consultation-${consultationId}`);
            socket.consultationRooms?.delete(consultationId);
        });

        socket.on('disconnect', (reason) => {
            console.log(`🔌 Client disconnected: ${socket.id} (reason: ${reason})`);
        });
    });
};