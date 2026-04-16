const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: { 
        type: String, 
        ref: 'User', 
        required: true 
    },
    type: {
        type: String,
        enum: [
            'consultation_request',
            'consultation_started',
            'consultation_ended',
            'consultation_cancelled',
            'consultation_expired',
            'new_message',
            'payment_success',
            'payment_verified',
            'refund_requested',
            'refund_processed',
            'doctor_no_show',
            'schedule_reminder',
            'prescription_sent',
            'prescription_submitted',
            'order_shipped',
            'order_delivered',
            'appointment_reminder',
            'appointment_request',
            'appointment_confirmed',
            'appointment_rejected',
            'appointment_cancelled',
            'appointment_completed',
            'sick_letter_draft',
            'sick_letter_issued',
            'system'
        ],
        required: true
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    data: {
        consultationId: { type: String, ref: 'Consultation' },
        paymentId: { type: String, ref: 'Payment' },
        orderId: { type: String, ref: 'Order' },
        appointmentId: { type: String, ref: 'Appointment' },
        sickLetterId: { type: String, ref: 'SickLetter' },
        doctorId: { type: String, ref: 'Doctor' },
        url: String
    },
    isRead: { type: Boolean, default: false },
    readAt: Date,
    createdAt: { type: Date, default: Date.now }
});

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);