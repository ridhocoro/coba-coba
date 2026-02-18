module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log('New client connected');

        socket.on('join-consultation', (consultationId) => {
            socket.join(`consultation-${consultationId}`);
        });

        socket.on('send-message', (data) => {
            io.to(`consultation-${data.consultationId}`).emit('receive-message', {
                message: data.message,
                senderId: data.senderId,
                timestamp: new Date()
            });
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected');
        });
    });
};