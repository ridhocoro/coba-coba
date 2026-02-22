const express = require('express');
const router = express.Router();
const ManualPayment = require('../models/ManualPayment');
const User = require('../models/User');
const Consultation = require('../models/Consultation');
const Doctor = require('../models/Doctor');
const SickLetter = require('../models/SickLetter');
const Appointment = require('../models/Appointment');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// ========== DASHBOARD STATS ==========
router.get('/stats', auth, adminAuth, async (req, res) => {
    try {
        const totalPatients = await User.countDocuments({ role: 'user' });
        const totalDoctors = await Doctor.countDocuments({ isActive: true });
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const todayConsultations = await Consultation.countDocuments({
            createdAt: { $gte: today, $lt: tomorrow }
        });
        
        const todayPayments = await ManualPayment.find({
            status: 'verified',
            verifiedAt: { $gte: today, $lt: tomorrow }
        });
        const todayRevenue = todayPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        
        const pendingSickLetters = await SickLetter.countDocuments({ status: 'pending' });
        
        res.json({
            totalPatients,
            totalDoctors,
            todayConsultations,
            todayRevenue,
            pendingSickLetters
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ========== PAYMENT ROUTES - SPESIFIK DAHULU ==========
// GET semua pembayaran pending
router.get('/payments/pending', auth, adminAuth, async (req, res) => {
    try {
        const payments = await ManualPayment.find({ status: 'pending' })
            .populate('userId', 'name email phone')
            .populate({
                path: 'referenceId',
                populate: {
                    path: 'doctorId',
                    select: 'name specialization'
                }
            })
            .sort('-createdAt');
        
        res.json({
            success: true,
            count: payments.length,
            payments
        });
    } catch (error) {
        console.error('Error fetching pending payments:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET semua pembayaran (semua status)
router.get('/payments/all', auth, adminAuth, async (req, res) => {
    try {
        const { page = 1, limit = 10, status = 'all' } = req.query;
        
        let query = {};
        if (status !== 'all') {
            query.status = status;
        }
        
        const payments = await ManualPayment.find(query)
            .populate('userId', 'name email')
            .populate({
                path: 'referenceId',
                populate: {
                    path: 'doctorId',
                    select: 'name'
                }
            })
            .sort('-createdAt')
            .limit(limit * 1)
            .skip((page - 1) * limit);
        
        const total = await ManualPayment.countDocuments(query);
        
        res.json({
            success: true,
            payments,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET statistik pembayaran - LETAKKAN SEBELUM /payments/:id
router.get('/payments/stats', auth, adminAuth, async (req, res) => {
    try {
        const pending = await ManualPayment.countDocuments({ status: 'pending' }).catch(() => 0);
        const verified = await ManualPayment.countDocuments({ status: 'verified' }).catch(() => 0);
        const rejected = await ManualPayment.countDocuments({ status: 'rejected' }).catch(() => 0);
        
        const allVerified = await ManualPayment.find({ status: 'verified' }).catch(() => []);
        const totalAmount = allVerified.reduce((sum, p) => sum + (p.amount || 0), 0);
        
        res.json({
            success: true,
            stats: {
                pending: pending || 0,
                verified: verified || 0,
                rejected: rejected || 0,
                totalVerified: verified || 0,
                totalAmount: totalAmount || 0
            }
        });
    } catch (error) {
        console.error('Error fetching payment stats:', error);
        res.json({
            success: true,
            stats: {
                pending: 0,
                verified: 0,
                rejected: 0,
                totalVerified: 0,
                totalAmount: 0
            }
        });
    }
});

// GET detail pembayaran by ID - LETAKKAN PALING BAWAH
router.get('/payments/:id', auth, adminAuth, async (req, res) => {
    try {
        const payment = await ManualPayment.findById(req.params.id)
            .populate('userId', 'name email phone address')
            .populate({
                path: 'referenceId',
                populate: {
                    path: 'doctorId',
                    select: 'name specialization'
                }
            });
        
        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }
        
        res.json({
            success: true,
            payment
        });
    } catch (error) {
        console.error('Error fetching payment:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// VERIFY payment
router.put('/payments/:id/verify', auth, adminAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;
        
        const payment = await ManualPayment.findById(id);
        
        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }
        
        payment.status = status;
        payment.adminNotes = notes || '';
        payment.verifiedAt = new Date();
        payment.verifiedBy = req.userId;
        
        await payment.save();
        
        if (status === 'verified' && payment.paymentType === 'consultation') {
            await Consultation.findByIdAndUpdate(payment.referenceId, { 
                status: 'paid',
                paymentVerified: true,
                verifiedAt: new Date()
            });
        }
        
        res.json({
            success: true,
            message: `Payment ${status === 'verified' ? 'diverifikasi' : 'ditolak'}`,
            payment
        });
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ========== OTHER ADMIN ROUTES ==========
router.get('/doctors', auth, adminAuth, async (req, res) => {
    try {
        const doctors = await Doctor.find({})
            .populate('userId', 'name email phone')
            .sort('-createdAt');
        res.json(doctors);
    } catch (error) {
        console.error('Error fetching doctors:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/consultations', auth, adminAuth, async (req, res) => {
    try {
        const consultations = await Consultation.find({})
            .populate('userId', 'name email')
            .populate('doctorId', 'name specialization')
            .populate('paymentId')
            .sort('-createdAt');
        res.json(consultations);
    } catch (error) {
        console.error('Error fetching consultations:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/sick-letters', auth, adminAuth, async (req, res) => {
    try {
        const sickLetters = await SickLetter.find({})
            .populate('userId', 'name email')
            .populate('doctorId', 'name')
            .populate('paymentId')
            .sort('-createdAt');
        res.json(sickLetters);
    } catch (error) {
        console.error('Error fetching sick letters:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/sick-letters/:id/approve', auth, adminAuth, async (req, res) => {
    try {
        const sickLetter = await SickLetter.findById(req.params.id);
        if (!sickLetter) {
            return res.status(404).json({ error: 'Sick letter not found' });
        }
        sickLetter.status = 'approved';
        await sickLetter.save();
        res.json({ success: true, message: 'Surat sakit disetujui' });
    } catch (error) {
        console.error('Error approving sick letter:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/appointments', auth, adminAuth, async (req, res) => {
    try {
        const appointments = await Appointment.find({})
            .populate('userId', 'name email phone')
            .populate('doctorId', 'name specialization')
            .populate('paymentId')
            .sort('-appointmentDate');
        res.json(appointments);
    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/users', auth, adminAuth, async (req, res) => {
    try {
        const users = await User.find({})
            .select('-password')
            .sort('-createdAt');
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/transactions', auth, adminAuth, async (req, res) => {
    try {
        const transactions = await ManualPayment.find({})
            .populate('userId', 'name email')
            .populate({
                path: 'referenceId',
                populate: {
                    path: 'doctorId',
                    select: 'name'
                }
            })
            .sort('-createdAt');
        res.json(transactions);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;