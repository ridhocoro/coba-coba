const express = require('express');
const router = express.Router();
const ManualPayment = require('../models/ManualPayment');
const auth = require('../middleware/auth');

// GET user payment history — redirect ke manual payment history
router.get('/history', auth, async (req, res) => {
    try {
        const payments = await ManualPayment.find({ userId: req.userId })
            .populate({
                path: 'referenceId',
                populate: { path: 'doctorId', select: 'name specialization' }
            })
            .sort('-createdAt');
        res.json(payments);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// HAPUS: create-payment-intent (mock payment tidak boleh dipakai di produksi)
router.post('/create-payment-intent', (req, res) => {
    res.status(410).json({
        message: 'Endpoint ini sudah tidak digunakan. Gunakan /api/manual-payment/create untuk pembayaran.'
    });
});

module.exports = router;
