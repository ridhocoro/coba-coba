// routes/pharmacy.js
const express = require('express');
const router = express.Router();
const Medicine = require('../models/Medicine');
const Order = require('../models/Order');
const ManualPayment = require('../models/ManualPayment');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// ========== PUBLIC ROUTES ==========
// GET all medicines
router.get('/medicines', async (req, res) => {
    try {
        const { search, category, page = 1, limit = 12 } = req.query;
        let query = { isActive: true };
        
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

// ========== PROTECTED ROUTES ==========

// ✅ CEK ONGKIR (simulasi - bisa diintegrasi dengan API RajaOngkir)
router.post('/shipping-cost', auth, async (req, res) => {
    try {
        const { destination, weight, courier } = req.body;
        
        // Simulasi data ongkir
        const shippingCosts = [
            { courier: 'JNE', service: 'REG', cost: 10000, etd: '2-3' },
            { courier: 'JNE', service: 'YES', cost: 20000, etd: '1-2' },
            { courier: 'J&T', service: 'REG', cost: 9000, etd: '2-4' },
            { courier: 'J&T', service: 'EZ', cost: 15000, etd: '1-2' },
            { courier: 'SiCepat', service: 'REG', cost: 8000, etd: '2-3' },
            { courier: 'SiCepat', service: 'BEST', cost: 18000, etd: '1-2' },
            { courier: 'Pos Indonesia', service: 'Kilat', cost: 12000, etd: '3-5' }
        ];
        
        // Filter berdasarkan courier yang dipilih
        const filtered = courier 
            ? shippingCosts.filter(c => c.courier === courier)
            : shippingCosts;
        
        res.json({ success: true, costs: filtered });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ✅ CREATE ORDER (dengan lock stok)
router.post('/orders', auth, async (req, res) => {
    try {
        const { items, address, courier, courierService, shippingCost, total } = req.body;
        
        // Validasi stok tersedia (stock - lockedStock)
        for (const item of items) {
            const medicine = await Medicine.findById(item._id);
            if (!medicine) {
                return res.status(404).json({ 
                    success: false, 
                    message: `Obat ${item.name} tidak ditemukan` 
                });
            }
            
            const availableStock = medicine.stock - (medicine.lockedStock || 0);
            if (availableStock < item.quantity) {
                return res.status(400).json({ 
                    success: false,
                    message: `Stok ${medicine.name} hanya tersedia ${availableStock} dari ${medicine.stock}` 
                });
            }
        }
        
        // Lock stok selama 15 menit
        const lockExpiry = new Date(Date.now() + 15 * 60000); // 15 menit
        
        for (const item of items) {
            await Medicine.findByIdAndUpdate(item._id, {
                $inc: { lockedStock: item.quantity },
                $set: { stockLockExpiry: lockExpiry }
            });
        }
        
        // Buat order dengan status awaiting_payment
        const order = new Order({
            userId: req.userId,
            items: items.map(item => ({
                medicineId: item._id,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                subtotal: item.price * item.quantity
            })),
            totalAmount: total + shippingCost,
            shippingAddress: address,
            courier,
            courierService,
            shippingCost,
            status: 'awaiting_payment',
            paymentExpiry: lockExpiry,
            stockLockExpiry: lockExpiry
        });

        await order.save();

        // Schedule auto-expire setelah 15 menit
        setTimeout(async () => {
            try {
                const currentOrder = await Order.findById(order._id);
                if (currentOrder && currentOrder.status === 'awaiting_payment') {
                    // Release locked stock
                    for (const item of currentOrder.items) {
                        await Medicine.findByIdAndUpdate(item.medicineId, {
                            $inc: { lockedStock: -item.quantity }
                        });
                    }
                    currentOrder.status = 'expired';
                    await currentOrder.save();
                }
            } catch (error) {
                console.error('Error in auto-expire:', error);
            }
        }, 15 * 60000);

        res.json({
            success: true,
            message: 'Order berhasil dibuat, silakan bayar dalam 15 menit',
            order,
            paymentExpiry: lockExpiry
        });

    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal membuat pesanan' 
        });
    }
});

// ✅ KONFIRMASI PEMBAYARAN (kurangi stok permanen)
router.put('/orders/:id/confirm-payment', auth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });
        }

        // Validasi kepemilikan
        if (order.userId.toString() !== req.userId) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        if (order.status !== 'awaiting_payment') {
            return res.status(400).json({ 
                success: false, 
                message: 'Order tidak dalam status menunggu pembayaran' 
            });
        }

        // Cek apakah masih dalam batas waktu
        if (order.paymentExpiry < new Date()) {
            return res.status(400).json({ 
                success: false, 
                message: 'Waktu pembayaran telah habis' 
            });
        }

        // Kurangi stok permanen dan lepaskan lock
        for (const item of order.items) {
            await Medicine.findByIdAndUpdate(item.medicineId, {
                $inc: { 
                    stock: -item.quantity,
                    lockedStock: -item.quantity 
                }
            });
        }

        order.status = 'paid';
        await order.save();

        res.json({ 
            success: true, 
            message: 'Pembayaran dikonfirmasi, stok berkurang', 
            order 
        });

    } catch (error) {
        console.error('Error confirming payment:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ✅ BATALKAN ORDER (release locked stock)
router.put('/orders/:id/cancel', auth, async (req, res) => {
    try {
        const { reason } = req.body;
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order tidak ditemukan' });
        }

        // Validasi kepemilikan
        if (order.userId.toString() !== req.userId) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        // Hanya bisa cancel jika masih awaiting_payment
        if (order.status !== 'awaiting_payment') {
            return res.status(400).json({ 
                success: false, 
                message: 'Tidak dapat membatalkan order yang sudah diproses' 
            });
        }

        // Release locked stock
        for (const item of order.items) {
            await Medicine.findByIdAndUpdate(item.medicineId, {
                $inc: { lockedStock: -item.quantity }
            });
        }

        order.status = 'cancelled';
        order.cancelReason = reason || 'Dibatalkan oleh pengguna';
        order.cancelledAt = new Date();
        await order.save();

        res.json({ 
            success: true, 
            message: 'Order berhasil dibatalkan', 
            order 
        });

    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ✅ GET user orders
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

// ✅ GET single order
router.get('/orders/:id', auth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('items.medicineId')
            .populate('paymentId');
        
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.userId.toString() !== req.userId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        res.json(order);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ========== ADMIN ROUTES ==========
// ADMIN: Get all orders
router.get('/admin/orders', auth, adminAuth, async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        let query = {};
        if (status && status !== 'all') query.status = status;

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

// ADMIN: Update order status (processing, shipped, delivered)
router.put('/admin/orders/:id/status', auth, adminAuth, async (req, res) => {
    try {
        const { status, trackingNumber } = req.body;
        const order = await Order.findById(req.params.id);
        
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Validasi status flow
        const validTransitions = {
            'paid': ['processing', 'cancelled'],
            'processing': ['shipped', 'cancelled'],
            'shipped': ['delivered', 'cancelled']
        };

        if (validTransitions[order.status] && !validTransitions[order.status].includes(status)) {
            return res.status(400).json({ 
                message: `Tidak dapat mengubah status dari ${order.status} ke ${status}` 
            });
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