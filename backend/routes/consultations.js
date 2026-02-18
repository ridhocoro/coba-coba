const express = require('express');
const router = express.Router();
const Consultation = require('../models/Consultation');
const Doctor = require('../models/Doctor');
const auth = require('../middleware/auth');

// Get all consultations for user
router.get('/my-consultations', auth, async (req, res) => {
    try {
        const consultations = await Consultation.find({ userId: req.userId })
            .populate('doctorId', 'name specialization consultationFee photo bio')
            .populate('paymentId')
            .sort('-createdAt');
        res.json(consultations);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Create consultation (TANPA STRIPE)
router.post('/create', auth, async (req, res) => {
    try {
        const { doctorId, symptoms } = req.body;
        
        const doctor = await Doctor.findById(doctorId);
        if (!doctor) {
            return res.status(404).json({ message: 'Doctor not found' });
        }

        const consultation = new Consultation({
            userId: req.userId,
            doctorId,
            symptoms,
            status: 'pending'
        });

        await consultation.save();

        // Return consultation tanpa payment intent
        res.json({ 
            consultation,
            amount: doctor.consultationFee
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Start consultation (update status to ongoing)
router.put('/:id/start', auth, async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id);
        if (consultation.userId.toString() !== req.userId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }
        
        consultation.status = 'ongoing';
        consultation.startTime = new Date();
        await consultation.save();
        
        res.json(consultation);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// End consultation
router.put('/:id/end', auth, async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id);
        if (consultation.userId.toString() !== req.userId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }
        
        consultation.status = 'completed';
        consultation.endTime = new Date();
        await consultation.save();
        
        res.json(consultation);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Send message in consultation
router.post('/:id/messages', auth, async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id);
        consultation.messages.push({
            senderId: req.userId,
            message: req.body.message,
            timestamp: new Date()
        });
        await consultation.save();
        res.json(consultation);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;