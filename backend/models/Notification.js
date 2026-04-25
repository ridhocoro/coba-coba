// models/Notification.js
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
            // Consultation related
            'consultation_request',
            'consultation_started',
            'consultation_ended',
            'consultation_cancelled',
            'consultation_expired',
            'consultation_confirmed',
            'consultation_rescheduled',
            'new_message',
            
            // Payment related
            'payment_success',
            'payment_verified',
            
            // Refund related
            'refund_requested',
            'refund_approved',
            'refund_rejected',
            'refund_processed',
            'refund_processing',
            'refund_bank_submitted',
            'refund_waiting_disbursement',
            
            // Doctor related
            'doctor_no_show',
            'schedule_reminder',
            
            // Prescription related
            'prescription_sent',
            'prescription_submitted',
            
            // Order related
            'order_shipped',
            'order_delivered',
            'order_expired',
            'order_items_adjusted',
            
            // Appointment related
            'appointment_reminder',
            'appointment_request',
            'appointment_confirmed',
            'appointment_rejected',
            'appointment_cancelled',
            'appointment_completed',
            'appointment_rescheduled',
            
            // Sick letter related
            'sick_letter_draft',
            'sick_letter_issued',
            
            // System
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