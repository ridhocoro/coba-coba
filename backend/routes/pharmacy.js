const express = require('express');
const router = express.Router();
const Medicine = require('../models/Medicine');
const Order = require('../models/Order');
const ManualPayment = require('../models/ManualPayment');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// ========== PUBLIC ROUTES (TANPA LOGIN) ==========
// GET all medicines (public - bisa lihat, tapi harus login untuk beli)
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
            success: true,
            medicines,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET medicine by ID (public)
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

// ========== PROTECTED ROUTES (HANYA USER LOGIN) ==========
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

// CREATE order (perlu login)
router.post('/orders', auth, async (req, res) => {
    try {
        const { items, address, total } = req.body;
        const { user } = req;
        
        // Validasi stok
        for (const item of items) {
            const medicine = await Medicine.findById(item._id);
            if (!medicine) {
                return res.status(404).json({ 
                    success: false, 
                    message: `Obat ${item.name} tidak ditemukan` 
                });
            }
            if (medicine.stock < item.quantity) {
                return res.status(400).json({ 
                    success: false,
                    message: `Stok ${medicine.name} hanya tersedia ${medicine.stock}` 
                });
            }
        }

        // Buat order number
        const orderNumber = 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();

        // Hitung subtotal per item
        const orderItems = items.map(item => ({
            medicineId: item._id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            subtotal: item.price * item.quantity
        }));

        const order = new Order({
            userId: req.userId,
            items: orderItems,
            totalAmount: total,
            shippingAddress: address,
            orderNumber,
            status: 'pending'
        });

        await order.save();

        res.json({
            success: true,
            message: 'Order berhasil dibuat, silakan lanjutkan pembayaran',
            order
        });

    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal membuat pesanan' 
        });
    }
});

// GET single order
router.get('/orders/:id', auth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('items.medicineId')
            .populate('paymentId');
        
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Cek apakah order milik user yang login
        if (order.userId.toString() !== req.userId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        res.json(order);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ========== ADMIN ROUTES (KHUSUS ADMIN) ==========
// ADMIN: Get all orders
router.get('/admin/orders', auth, adminAuth, async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        let query = {};
        if (status) query.status = status;

        const orders = await Order.find(query)
            .populate('userId', 'name email phone')
            .populate('items.medicineId')
            .populate('paymentId')
            .sort('-createdAt')
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Order.countDocuments(query);

        res.json({
            success: true,
            orders,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ADMIN: Update order status (shipped, delivered, etc)
router.put('/admin/orders/:id/status', auth, adminAuth, async (req, res) => {
    try {
        const { status, trackingNumber } = req.body;
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        order.status = status;
        if (trackingNumber) order.trackingNumber = trackingNumber;
        order.updatedAt = new Date();

        await order.save();

        res.json({
            success: true,
            message: 'Order status updated',
            order
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ADMIN: Add medicine
router.post('/admin/medicines', auth, adminAuth, async (req, res) => {
    try {
        const medicine = new Medicine(req.body);
        await medicine.save();
        res.status(201).json({
            success: true,
            message: 'Obat berhasil ditambahkan',
            medicine
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ADMIN: Update medicine
router.put('/admin/medicines/:id', auth, adminAuth, async (req, res) => {
    try {
        const medicine = await Medicine.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true }
        );
        res.json({
            success: true,
            message: 'Obat berhasil diupdate',
            medicine
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ADMIN: Update stock
router.put('/admin/medicines/:id/stock', auth, adminAuth, async (req, res) => {
    try {
        const { stock } = req.body;
        const medicine = await Medicine.findByIdAndUpdate(
            req.params.id,
            { $set: { stock } },
            { new: true }
        );
        res.json({
            success: true,
            message: 'Stok berhasil diupdate',
            medicine
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ADMIN: Delete medicine (soft delete)
router.delete('/admin/medicines/:id', auth, adminAuth, async (req, res) => {
    try {
        await Medicine.findByIdAndUpdate(req.params.id, { isActive: false });
        res.json({
            success: true,
            message: 'Obat berhasil dinonaktifkan'
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;