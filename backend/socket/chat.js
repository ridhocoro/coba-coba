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
            if (userId === socket.userId) {
                socket.join(`user-${userId}`);
            }
        });

        // Join room konsultasi — dengan validasi akses
        socket.on('join-consultation', async (consultationId) => {
            try {
                const consultation = await Consultation.findById(consultationId).lean();

                if (!consultation) {
                    console.error('[Socket] join-consultation: not found:', consultationId);
                    return;
                }

                const patientId = consultation.userId?.toString();
                let doctorUserId = null;
                if (consultation.doctorId) {
                    try {
                        const doctorRecord = await Doctor.findById(consultation.doctorId).lean();
                        doctorUserId = doctorRecord?.userId?.toString() || null;
                    } catch (dbErr) {
                        console.error('[Socket] join-consultation Doctor query error:', dbErr.message);
                    }
                }

                const isAdmin   = socket.userRole === 'admin';
                const isPatient = patientId === socket.userId;
                const isDoctor  = doctorUserId === socket.userId;

                // Log selalu untuk debug production
                console.log(`[Socket] join-consultation attempt: userId=${socket.userId} role=${socket.userRole} isPatient=${isPatient} isDoctor=${isDoctor} doctorUserId=${doctorUserId} consultationId=${consultationId}`);

                if (!isAdmin && !isPatient && !isDoctor) {
                    console.error('[Socket] join-consultation DENIED: userId:', socket.userId);
                    socket.emit('error', { message: 'Akses room konsultasi ditolak' });
                    return;
                }

                const userAllowed = ['confirmed', 'paid', 'scheduled', 'in_progress', 'ongoing', 'completed', 'no_show'];
                if (!isAdmin && !isDoctor && !userAllowed.includes(consultation.status)) {
                    socket.emit('error', { message: 'Konsultasi belum aktif' });
                    return;
                }

                socket.join(`consultation-${consultationId}`);
                if (!socket.consultationRooms) socket.consultationRooms = new Set();
                socket.consultationRooms.add(consultationId);

                console.log(`[Socket] Joined consultation-${consultationId} (userId: ${socket.userId} role: ${socket.userRole})`);

                // Konfirmasi ke client bahwa join berhasil
                socket.emit('joined-consultation', { consultationId });

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
                    : `${fmtDoctorName(consultation.doctorId)}`;

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
        // FIX-1: Cache offer terakhir per konsultasi agar bisa dikirim ulang
        // saat pasien join room setelah dokter sudah kirim offer
        if (!io._vcOfferCache) io._vcOfferCache = {};

        socket.on('vc-offer', ({ consultationId, offer }) => {
            // Simpan offer terbaru — akan dipakai jika pasien kirim vc-ready
            io._vcOfferCache[consultationId] = { offer, fromSocketId: socket.id };
            socket.to(`consultation-${consultationId}`).emit('vc-offer', { offer });
        });

        // FIX-1: Pasien kirim sinyal "siap" → server cek apakah ada cached offer
        // Ini mengatasi race condition di mana dokter kirim offer sebelum pasien join room
        socket.on('vc-ready', ({ consultationId }) => {
            const cached = io._vcOfferCache?.[consultationId];
            if (cached) {
                // Ada offer yang tersimpan → kirim langsung ke pasien ini
                socket.emit('vc-offer', { offer: cached.offer });
                console.log(`[Socket] vc-ready: replay cached offer ke pasien ${socket.userId} untuk konsultasi ${consultationId}`);
            } else {
                // Tidak ada cached offer → relay ke dokter agar kirim ulang offer
                socket.to(`consultation-${consultationId}`).emit('vc-ready');
                console.log(`[Socket] vc-ready: tidak ada cache, relay ke dokter untuk konsultasi ${consultationId}`);
            }
        });

        // Bersihkan cache saat panggilan berakhir
        socket.on('vc-end', ({ consultationId, reason }) => {
            if (io._vcOfferCache?.[consultationId]) {
                delete io._vcOfferCache[consultationId];
            }
            socket.to(`consultation-${consultationId}`).emit('vc-end', { reason: reason || 'ended' });
        });

        socket.on('vc-answer', ({ consultationId, answer }) => {
            socket.to(`consultation-${consultationId}`).emit('vc-answer', { answer });
        });

        socket.on('vc-ice-candidate', ({ consultationId, candidate }) => {
            socket.to(`consultation-${consultationId}`).emit('vc-ice-candidate', { candidate });
        });



        // Pasien menolak panggilan → beri tahu dokter dengan reason khusus
        socket.on('vc-reject', ({ consultationId }) => {
            socket.to(`consultation-${consultationId}`).emit('vc-end', { reason: 'rejected' });
        });

        // Dokter batal karena timeout unanswered
        socket.on('vc-no-answer', ({ consultationId }) => {
            socket.to(`consultation-${consultationId}`).emit('vc-end', { reason: 'no-answer' });
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
            // Hanya log disconnect yang tidak normal (bukan navigasi biasa)
            const normalReasons = ['client namespace disconnect', 'transport close', 'transport error'];
            if (process.env.NODE_ENV !== 'production' && !normalReasons.includes(reason)) {
                console.log(`[Socket] User disconnected: ${socket.userId} (reason: ${reason})`);
            }
        });
    });
};