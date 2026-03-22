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
            case 'appointment_confirmed':
            case 'appointment_completed':
            case 'appointment_cancelled':
            case 'appointment_rescheduled':
                // BUG-22 fix: /appointments/:id route doesn't exist in App.js — use query param instead
                url = data.appointmentId ? `/appointments?id=${data.appointmentId}` : '/appointments';
                break;
            case 'consultation_rescheduled':
                url = data.consultationId ? `/consultations/${data.consultationId}` : '/consultations';
                break;
            // BUG-20 fix: schedule_reminder was missing → fell to default '/'
            case 'schedule_reminder':
                url = '/doctor';
                break;
            // BUG-25/BUG-29 fix: proper types for expired order and adjusted items
            case 'order_expired':
                url = data.orderId ? `/pharmacy?orderId=${data.orderId}` : '/pharmacy';
                break;
            case 'order_items_adjusted':
                url = data.orderId ? `/pharmacy?orderId=${data.orderId}` : '/pharmacy';
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