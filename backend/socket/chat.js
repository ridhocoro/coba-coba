module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log('🔌 New client connected:', socket.id);

        // Join user room berdasarkan userId
        socket.on('join-user', (userId) => {
            socket.join(`user-${userId}`);
            console.log(`User ${userId} joined their room`);
        });

        socket.on('join-consultation', (consultationId) => {
            socket.join(`consultation-${consultationId}`);
            console.log(`User joined consultation: ${consultationId}`);
        });

        socket.on('send-message', (data) => {
            io.to(`consultation-${data.consultationId}`).emit('receive-message', {
                message: data.message,
                senderId: data.senderId,
                senderName: data.senderName,
                timestamp: new Date()
            });
        });

        socket.on('leave-consultation', (consultationId) => {
            socket.leave(`consultation-${consultationId}`);
            console.log(`User left consultation: ${consultationId}`);
        });

        socket.on('disconnect', () => {
            console.log('🔌 Client disconnected:', socket.id);
        });
    });
};