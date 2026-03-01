module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log('🔌 New client connected:', socket.id);

        // Join room user sendiri
        socket.on('join-user', (userId) => {
            socket.join(`user-${userId}`);
        });

        // Join room konsultasi (hanya setelah paid - validasi di FE)
        socket.on('join-consultation', (consultationId) => {
            socket.join(`consultation-${consultationId}`);
            console.log(`User joined consultation: ${consultationId}`);
        });

        // Kirim pesan teks (broadcast ke room)
        socket.on('send-message', (data) => {
            io.to(`consultation-${data.consultationId}`).emit('receive-message', {
                message: data.message,
                imageUrl: data.imageUrl || null,
                senderId: data.senderId,
                senderName: data.senderName,
                senderRole: data.senderRole,
                timestamp: new Date()
            });
        });

        // Typing indicator
        socket.on('typing', (data) => {
            socket.to(`consultation-${data.consultationId}`).emit('user-typing', {
                senderId: data.senderId,
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
            console.log('🔌 Client disconnected:', socket.id);
        });
    });
};