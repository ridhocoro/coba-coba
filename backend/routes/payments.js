const express = require('express');
const router = express.Router();
const Payment = require('../models/Payment');
const Consultation = require('../models/Consultation');
const Appointment = require('../models/Appointment');
const SickLetter = require('../models/SickLetter');
const Order = require('../models/Order');
const auth = require('../middleware/auth');

// Helper function untuk get model berdasarkan tipe
const getModelByType = (type) => {
    const models = {
        consultation: Consultation,
        appointment: Appointment,
        sick_letter: SickLetter,
        medicine: Order
    };
    return models[type];
};

// GET user payment history
router.get('/history', auth, async (req, res) => {
    try {
        const payments = await Payment.find({ userId: req.userId })
            .sort('-createdAt');
        res.json(payments);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// CREATE mock payment intent (TANPA STRIPE)
router.post('/create-payment-intent', auth, async (req, res) => {
    try {
        const { amount, paymentType, referenceId } = req.body;

        // Generate mock transaction ID
        const mockTransactionId = 'MOCK-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();

        // Create payment record with status 'paid' (LANGSUNG SUKSES)
        const payment = new Payment({
            userId: req.userId,
            transactionId: mockTransactionId,
            amount,
            paymentType,
            referenceId,
            stripePaymentIntentId: 'mock_' + Date.now(),
            status: 'paid', // LANGSUNG PAID!
            paymentMethod: 'mock_payment',
            paidAt: new Date()
        });

        await payment.save();

        // Update reference document status
        const Model = getModelByType(paymentType);
        if (Model) {
            let updateData = { paymentId: payment._id };
            
            // Set status berdasarkan tipe
            switch(paymentType) {
                case 'consultation':
                    updateData.status = 'paid';
                    break;
                case 'appointment':
                    updateData.status = 'confirmed';
                    break;
                case 'sick_letter':
                    updateData.status = 'paid';
                    break;
                case 'medicine':
                    updateData.status = 'paid';
                    break;
            }
            
            await Model.findByIdAndUpdate(referenceId, { $set: updateData });
        }

        res.json({
            clientSecret: 'mock_secret_' + Date.now(),
            paymentId: payment._id,
            transactionId: mockTransactionId,
            status: 'paid'
        });

    } catch (error) {
        console.error('Payment error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET payment by ID
router.get('/:id', auth, async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id);
        if (!payment) {
            return res.status(404).json({ message: 'Payment not found' });
        }
        
        // Check authorization
        if (payment.userId.toString() !== req.userId && req.userRole !== 'admin') {
            return res.status(403).json({ message: 'Unauthorized' });
        }
        
        res.json(payment);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;