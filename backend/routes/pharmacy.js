const express = require('express');
const router = express.Router();
const Medicine = require('../models/Medicine');
const Order = require('../models/Order');
const auth = require('../middleware/auth');

// GET all medicines (public)
router.get('/medicines', async (req, res) => {
    try {
        const { search, category, page = 1, limit = 12 } = req.query;
        let query = { isActive: true, stock: { $gt: 0 } };
        
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { genericName: { $regex: search, $options: 'i' } }
            ];
        }
        
        if (category) {
            query.category = category;
        }

        const medicines = await Medicine.find(query)
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort('-createdAt');

        const total = await Medicine.countDocuments(query);

        res.json({
            medicines,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET medicine by ID
router.get('/medicines/:id', async (req, res) => {
    try {
        const medicine = await Medicine.findById(req.params.id);
        if (!medicine) {
            return res.status(404).json({ message: 'Obat tidak ditemukan' });
        }
        res.json(medicine);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET user orders
router.get('/orders', auth, async (req, res) => {
    try {
        const orders = await Order.find({ userId: req.userId })
            .populate('items.medicineId')
            .populate('paymentId')
            .sort('-createdAt');
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// CREATE order (TANPA STRIPE)
router.post('/orders', auth, async (req, res) => {
    try {
        const { items, address, paymentId, total } = req.body;
        
        for (const item of items) {
            const medicine = await Medicine.findById(item._id);
            if (medicine.stock < item.quantity) {
                return res.status(400).json({
                    message: `Stok ${medicine.name} tidak mencukupi`
                });
            }
        }

        const order = new Order({
            userId: req.userId,
            items: items.map(item => ({
                medicineId: item._id,
                quantity: item.quantity,
                price: item.price
            })),
            totalAmount: total,
            shippingAddress: address,
            paymentId,
            status: 'paid',
            estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
        });

        await order.save();

        for (const item of items) {
            await Medicine.findByIdAndUpdate(item._id, {
                $inc: { stock: -item.quantity }
            });
        }

        res.status(201).json(order);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ADMIN: Add medicine
router.post('/medicines', auth, async (req, res) => {
    try {
        if (req.userRole !== 'admin') {
            return res.status(403).json({ message: 'Akses ditolak' });
        }
        
        const medicine = new Medicine(req.body);
        await medicine.save();
        res.status(201).json(medicine);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ADMIN: Update medicine
router.put('/medicines/:id', auth, async (req, res) => {
    try {
        if (req.userRole !== 'admin') {
            return res.status(403).json({ message: 'Akses ditolak' });
        }
        
        const medicine = await Medicine.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true }
        );
        res.json(medicine);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ADMIN: Update stock
router.put('/medicines/:id/stock', auth, async (req, res) => {
    try {
        if (req.userRole !== 'admin') {
            return res.status(403).json({ message: 'Akses ditolak' });
        }
        
        const { stock } = req.body;
        const medicine = await Medicine.findByIdAndUpdate(
            req.params.id,
            { $set: { stock } },
            { new: true }
        );
        res.json(medicine);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;