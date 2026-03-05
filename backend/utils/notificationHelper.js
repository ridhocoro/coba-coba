const Notification = require('../models/Notification');

const createNotification = async ({
    userId,
    type,
    title,
    message,
    data = {},
    io = null
}) => {
    try {
        let url = '';
        switch(type) {
            case 'consultation_request':
            case 'consultation_started':
            case 'consultation_ended':
            case 'consultation_confirmed':
            case 'consultation_cancelled':
            case 'consultation_expired':
            case 'doctor_no_show':
            case 'new_message':
            case 'sick_letter_draft':
            case 'sick_letter_issued':
            case 'prescription_sent':
            case 'refund_requested':
            case 'refund_processed':
                url = data.consultationId ? `/consultations/${data.consultationId}` : '/consultations';
                break;
            case 'payment_success':
            case 'payment_verified':
                url = '/payments';
                break;
            case 'order_shipped':
            case 'order_delivered':
                url = data.orderId ? `/pharmacy/orders/${data.orderId}` : '/pharmacy';
                break;
            case 'appointment_reminder':
                url = data.appointmentId ? `/appointments/${data.appointmentId}` : '/appointments';
                break;
            default:
                url = '/';
        }

        const notification = new Notification({
            userId,
            type,
            title,
            message,
            data: { ...data, url },
            isRead: false
        });

        await notification.save();

        if (io) {
            io.to(`user-${userId}`).emit('new-notification', notification);
            
            const unreadCount = await Notification.countDocuments({ 
                userId, 
                isRead: false 
            });
            
            io.to(`user-${userId}`).emit('unread-count', unreadCount);
        }

        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
        return null;
    }
};

module.exports = { createNotification };