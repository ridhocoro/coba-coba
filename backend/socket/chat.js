const fmtDoctorName = require('../utils/fmtDoctorName');
const jwt = require('jsonwebtoken');
const Consultation = require('../models/Consultation');
const Doctor       = require('../models/Doctor');
const User         = require('../models/User'); // FIX: register User schema for populate('userId')

module.exports = (io) => {
    // Middleware autentikasi socket
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        if (!token) {
            console.log('[Socket Auth] No token provided');
            return next(new Error('Authentication error: Token required'));
        }
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
            socket.userId   = decoded.userId;
            socket.userRole = decoded.role;
            console.log(`[Socket Auth] User authenticated: ${socket.userId} (role: ${socket.userRole})`);
            next();
        } catch (err) {
            console.log('[Socket Auth] Invalid token:', err.message);
            return next(new Error('Authentication error: Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`[Socket] New connection: ${socket.id}, userId: ${socket.userId}, role: ${socket.userRole}`);

        // Log hanya di development, dan hanya sekali per userId (bukan per socket id)
        if (process.env.NODE_ENV !== 'production') {
            if (!global._socketLog) global._socketLog = {};
            const now = Date.now();
            if (!global._socketLog[socket.userId] || now - global._socketLog[socket.userId] > 30000) {
                global._socketLog[socket.userId] = now;
                console.log(`[Socket] User connected: ${socket.userId} (role: ${socket.userRole})`);
            }
        }

        // Join room user sendiri
        socket.on('join-user', (userId) => {
            console.log(`[Socket] join-user: userId=${userId}, socket.userId=${socket.userId}`);
            if (userId === socket.userId) {
                socket.join(`user-${userId}`);
                console.log(`[Socket] Joined user-${userId}`);
            }
        });

        // Join room konsultasi — dengan validasi akses
        socket.on('join-consultation', async (consultationId) => {
            console.log(`[Socket] join-consultation RAW: userId=${socket.userId} role=${socket.userRole} consultationId=${consultationId} socketId=${socket.id}`);
            
            try {
                const consultation = await Consultation.findById(consultationId).lean();

                if (!consultation) {
                    console.error('[Socket] join-consultation: not found:', consultationId);
                    socket.emit('error', { message: 'Konsultasi tidak ditemukan' });
                    return;
                }

                console.log(`[Socket] join-consultation found: status=${consultation.status}, userId=${consultation.userId}, doctorId=${consultation.doctorId}`);

                const patientId = consultation.userId?.toString();
                let doctorUserId = null;
                if (consultation.doctorId) {
                    try {
                        const doctorRecord = await Doctor.findById(consultation.doctorId).lean();
                        doctorUserId = doctorRecord?.userId?.toString() || null;
                        console.log(`[Socket] Doctor record found: doctorId=${consultation.doctorId}, doctorUserId=${doctorUserId}`);
                    } catch (dbErr) {
                        console.error('[Socket] join-consultation Doctor query error:', dbErr.message);
                    }
                }

                const isAdmin   = socket.userRole === 'admin';
                const isPatient = patientId === socket.userId;
                const isDoctor  = doctorUserId === socket.userId;

                console.log(`[Socket] join-consultation check: isAdmin=${isAdmin}, isPatient=${isPatient}, isDoctor=${isDoctor}, patientId=${patientId}, doctorUserId=${doctorUserId}, socket.userId=${socket.userId}`);

                if (!isAdmin && !isPatient && !isDoctor) {
                    console.error('[Socket] join-consultation DENIED: userId:', socket.userId);
                    socket.emit('error', { message: 'Akses room konsultasi ditolak' });
                    return;
                }

                const userAllowed = ['confirmed', 'paid', 'scheduled', 'in_progress', 'ongoing', 'completed', 'no_show'];
                if (!isAdmin && !isDoctor && !userAllowed.includes(consultation.status)) {
                    console.log(`[Socket] join-consultation status check failed: status=${consultation.status} not in allowed list`);
                    socket.emit('error', { message: 'Konsultasi belum aktif' });
                    return;
                }

                const roomName = `consultation-${consultationId}`;
                socket.join(roomName);
                if (!socket.consultationRooms) socket.consultationRooms = new Set();
                socket.consultationRooms.add(consultationId);

                console.log(`[Socket] ✅ Joined ${roomName} (userId: ${socket.userId} role: ${socket.userRole})`);

                // Konfirmasi ke client bahwa join berhasil
                socket.emit('joined-consultation', { consultationId });
                console.log(`[Socket] ✅ Emitted joined-consultation to ${socket.id}`);

            } catch (err) {
                console.error('[Socket] join-consultation error:', err.message);
                socket.emit('error', { message: 'Server error saat join konsultasi' });
            }
        });

        // Reconnect: re-join semua rooms yang sebelumnya di-join
        socket.on('reconnect-rooms', async ({ consultationIds, userId }) => {
            console.log(`[Socket] reconnect-rooms: userId=${userId}, consultationIds=${consultationIds}`);
            // Re-join user room
            if (userId === socket.userId) {
                socket.join(`user-${userId}`);
            }
            // Re-join consultation rooms
            if (Array.isArray(consultationIds)) {
                for (const cId of consultationIds) {
                    try {
                        const consultation = await Consultation.findById(cId).lean();
                        if (!consultation) continue;

                        const patientId = consultation.userId?.toString();
                        let doctorUserId = null;
                        if (consultation.doctorId) {
                            const doctorRecord = await Doctor.findById(consultation.doctorId).lean();
                            doctorUserId = doctorRecord?.userId?.toString() || null;
                        }
                        const isAdmin   = socket.userRole === 'admin';
                        const isPatient = patientId === socket.userId;
                        const isDoctor  = doctorUserId === socket.userId;

                        if (isAdmin || isPatient || isDoctor) {
                            socket.join(`consultation-${cId}`);
                            if (!socket.consultationRooms) socket.consultationRooms = new Set();
                            socket.consultationRooms.add(cId);
                            console.log(`[Socket] reconnect-rooms: rejoined consultation-${cId}`);
                        }
                    } catch {}
                }
            }
            socket.emit('rooms-rejoined', { success: true });
        });

        // Kirim pesan teks
        socket.on('send-message', async (data) => {
            try {
                const consultation = await Consultation.findById(data.consultationId)
                    .populate('userId', 'name')
                    .populate('doctorId', 'name userId')
                    .lean();
                if (!consultation) return;

                const isPatient = consultation.userId?._id?.toString() === socket.userId;
                const isDr      = consultation.doctorId?.userId?.toString() === socket.userId;

                if (!isPatient && !isDr && socket.userRole !== 'admin') return;

                const senderRole = isPatient ? (consultation.userId?.role || 'user') : 'doctor';
                const senderName = isPatient
                    ? (consultation.userId?.name || 'Pasien')
                    : `${fmtDoctorName(consultation.doctorId)}`;

                io.to(`consultation-${data.consultationId}`).emit('receive-message', {
                    _id:        data._id,
                    message:    data.message,
                    imageUrl:   data.imageUrl || null,
                    senderId:   socket.userId,
                    senderName,
                    senderRole,
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
        // Cache offer terakhir per konsultasi agar bisa dikirim ulang
        if (!io._vcOfferCache) io._vcOfferCache = {};

        socket.on('vc-offer', ({ consultationId, offer }) => {
            console.log(`[WebRTC] vc-offer from ${socket.id} for consultation ${consultationId}`);
            io._vcOfferCache[consultationId] = { offer, fromSocketId: socket.id };
            socket.to(`consultation-${consultationId}`).emit('vc-offer', { offer });
            console.log(`[WebRTC] vc-offer broadcast to consultation-${consultationId}`);
        });

        // Pasien kirim sinyal "siap" → server cek apakah ada cached offer
        socket.on('vc-ready', ({ consultationId }) => {
            console.log(`[WebRTC] vc-ready from ${socket.id} for consultation ${consultationId}`);
            const cached = io._vcOfferCache?.[consultationId];
            if (cached) {
                console.log(`[WebRTC] vc-ready: replay cached offer to ${socket.id}`);
                socket.emit('vc-offer', { offer: cached.offer });
            } else {
                console.log(`[WebRTC] vc-ready: no cache, relay to doctor for consultation ${consultationId}`);
                socket.to(`consultation-${consultationId}`).emit('vc-ready');
            }
        });

        // Bersihkan cache saat panggilan berakhir
        socket.on('vc-end', ({ consultationId, reason }) => {
            console.log(`[WebRTC] vc-end from ${socket.id} for consultation ${consultationId}, reason: ${reason || 'ended'}`);
            if (io._vcOfferCache?.[consultationId]) {
                delete io._vcOfferCache[consultationId];
            }
            socket.to(`consultation-${consultationId}`).emit('vc-end', { reason: reason || 'ended' });
        });

        socket.on('vc-answer', ({ consultationId, answer }) => {
            console.log(`[WebRTC] vc-answer from ${socket.id} for consultation ${consultationId}`);
            socket.to(`consultation-${consultationId}`).emit('vc-answer', { answer });
            console.log(`[WebRTC] vc-answer broadcast to consultation-${consultationId}`);
        });

        socket.on('vc-ice-candidate', ({ consultationId, candidate }) => {
            socket.to(`consultation-${consultationId}`).emit('vc-ice-candidate', { candidate });
        });

        // Pasien menolak panggilan → beri tahu dokter dengan reason khusus
        socket.on('vc-reject', ({ consultationId }) => {
            console.log(`[WebRTC] vc-reject from ${socket.id} for consultation ${consultationId}`);
            socket.to(`consultation-${consultationId}`).emit('vc-end', { reason: 'rejected' });
        });

        // Dokter batal karena timeout unanswered
        socket.on('vc-no-answer', ({ consultationId }) => {
            console.log(`[WebRTC] vc-no-answer from ${socket.id} for consultation ${consultationId}`);
            socket.to(`consultation-${consultationId}`).emit('vc-end', { reason: 'no-answer' });
        });

        // WebRTC ICE restart request (reconnect)
        socket.on('vc-ice-restart', ({ consultationId }) => {
            console.log(`[WebRTC] vc-ice-restart from ${socket.id} for consultation ${consultationId}`);
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
            console.log(`[Socket] leave-consultation: ${consultationId} from ${socket.id}`);
            socket.leave(`consultation-${consultationId}`);
            socket.consultationRooms?.delete(consultationId);
        });

        socket.on('disconnect', (reason) => {
            console.log(`[Socket] Disconnect: ${socket.id}, userId: ${socket.userId}, reason: ${reason}`);
            const normalReasons = ['client namespace disconnect', 'transport close', 'transport error'];
            if (process.env.NODE_ENV !== 'production' && !normalReasons.includes(reason)) {
                console.log(`[Socket] User disconnected: ${socket.userId} (reason: ${reason})`);
            }
        });
    });
};