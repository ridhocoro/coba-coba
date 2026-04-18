// routes/pharmacy.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

const { Medicine, Order, OrderItem, User } = require('../models/mysql');
const { Op } = require('sequelize');
const { createNotification } = require('../utils/notificationHelper');
const { createCloudinaryUpload } = require('../config/cloudinary');

// Upload video refund via Cloudinary (max 50MB, video/image)
const uploadRefundVideo = createCloudinaryUpload(
    'klinik-refund-pharmacy',
    ['mp4', 'mov', 'avi', 'mkv', 'webm', 'jpg', 'jpeg', 'png'],
    50
);

// ─── Konstanta ────────────────────────────────────────────────────────────────
const KLINIK_LAT = -6.5530;
const KLINIK_LNG = 106.7237;
const STUDENT_MAX_PCS = 8;
const PICKUP_READY_MIN = 30;
const PAYMENT_LOCK_MIN = 15;
const FREE_DELIVERY_KM = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function getRoadDistance(lat1, lng1, lat2, lng2) {
    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=false`;
        const r = await axios.get(url, { timeout: 8000, headers: { 'User-Agent': 'KlinikIPB/1.0' } });
        if (r.data?.routes?.length) return r.data.routes[0].distance / 1000;
        throw new Error('no route');
    } catch {
        return haversine(lat1, lng1, lat2, lng2);
    }
}

function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatOrder(o) {
    if (!o) return o;
    const json = o.toJSON ? o.toJSON() : { ...o };

    if (json.id && !json._id) json._id = json.id;

    if (json.user) {
        json.userId = json.user;
        if (json.userId) json.userId.id = json.user.id;
        delete json.user;
    }
    if (json.payment) {
        json.paymentId = json.payment;
        if (json.paymentId) json.paymentId.id = json.payment.id;
        delete json.payment;
    }

    if (json.items && Array.isArray(json.items)) {
        json.items = json.items.map(i => {
            const item = i.toJSON ? i.toJSON() : { ...i };
            if (item.medicine) {
                item.medicineId = item.medicine;
                if (item.medicineId) item.medicineId.id = item.medicine.id;
                delete item.medicine;
            }
            if (!item.name && item.medicineName) item.name = item.medicineName;
            return item;
        });
    }

    if (typeof json.shippingAddress === 'string' || json.shippingLat !== undefined) {
        json.shippingAddress = {
            address: json.shippingAddress || '',
            detail: json.shippingDetail || '',
            lat: json.shippingLat,
            lng: json.shippingLng,
        };
    }

    if (json.requiresPrescription || json.prescriptionImageUrl) {
        json.prescription = {
            imageUrl: json.prescriptionImageUrl || null,
            url: json.prescriptionImageUrl || null,
            status: json.prescriptionStatus || null,
            rejectedReason: json.prescriptionRejectedReason || null,
            reviewedAt: json.prescriptionReviewedAt || null,
        };
    }

    return json;
}

async function getStudentFreeUsage(userId) {
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const orders = await Order.findAll({
        where: {
            userId,
            isStudentDiscount: true,
            studentFreeQty: { [Op.gt]: 0 },
            status: { [Op.notIn]: ['cancelled', 'expired', 'prescription_rejected'] },
            createdAt: { [Op.between]: [startMonth, endMonth] },
        }
    });
    return orders.reduce((s, o) => s + (o.studentFreeQty || 0), 0);
}

// ─── Multer: gambar obat ──────────────────────────────────────────────────────
const medDir = path.join(__dirname, '../uploads/medicines');
if (!fs.existsSync(medDir)) fs.mkdirSync(medDir, { recursive: true });
const uploadMedImage = multer({
    storage: multer.diskStorage({
        destination: (_, __, cb) => cb(null, medDir),
        filename: (req, file, cb) => cb(null, `med-${req.params.id}-${Date.now()}${path.extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: 3 * 1024 * 1024 },
    fileFilter: (_, file, cb) => /jpeg|jpg|png|webp/.test(path.extname(file.originalname).toLowerCase()) ? cb(null, true) : cb(new Error('Hanya jpg/png/webp')),
});

const rxDir = path.join(__dirname, '../uploads/prescriptions');
if (!fs.existsSync(rxDir)) fs.mkdirSync(rxDir, { recursive: true });
const uploadRx = multer({
    storage: multer.diskStorage({
        destination: (_, __, cb) => cb(null, rxDir),
        filename: (req, file, cb) => cb(null, `rx-${req.params.orderId}-${Date.now()}${path.extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_, file, cb) => /jpeg|jpg|png|webp|pdf/.test(path.extname(file.originalname).toLowerCase()) ? cb(null, true) : cb(new Error('Hanya gambar/PDF')),
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC — Daftar & detail obat
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/medicines', async (req, res) => {
    try {
        const { search, category, page = 1, limit = 12 } = req.query;
        const where = {};
        if (search) {
            where[Op.or] = [
                { name: { [Op.like]: `%${search}%` } },
                { genericName: { [Op.like]: `%${search}%` } },
            ];
        }
        if (category) where.category = category;

        const offset = (Number(page) - 1) * Number(limit);
        const { count, rows: meds } = await Medicine.findAndCountAll({
            where,
            limit: Number(limit),
            offset,
            order: [['created_at', 'DESC']],
        });

        res.json({
            success: true,
            medicines: meds,
            total: count,
            totalPages: Math.ceil(count / Number(limit)),
            currentPage: Number(page),
        });
    } catch (err) {
        console.error('[pharmacy] GET /medicines error:', err.message);
        res.status(500).json({ message: 'Server error', detail: err.message });
    }
});

router.get('/admin/medicines', auth, adminAuth, async (req, res) => {
    try {
        const { search, category, page = 1, limit = 200 } = req.query;
        const where = {};
        if (search) {
            where[Op.or] = [
                { name: { [Op.like]: `%${search}%` } },
                { genericName: { [Op.like]: `%${search}%` } },
            ];
        }
        if (category) where.category = category;

        const { count, rows: meds } = await Medicine.findAndCountAll({
            where,
            limit: Number(limit),
            offset: (Number(page) - 1) * Number(limit),
            order: [['created_at', 'DESC']],
        });

        const medicines = meds.map(m => { const j = m.toJSON(); j._id = j.id; return j; });
        res.json({ success: true, medicines, total: count });
    } catch (err) {
        console.error('[pharmacy] GET /admin/medicines error:', err.message);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

router.post('/admin/medicines', auth, adminAuth, async (req, res) => {
    try {
        const med = await Medicine.create(req.body);
        const j = med.toJSON();
        j._id = j.id;
        res.status(201).json({ success: true, message: 'Obat ditambahkan', medicine: j });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put('/admin/medicines/:id', auth, adminAuth, async (req, res) => {
    try {
        await Medicine.update({ ...req.body, updatedAt: new Date() }, { where: { id: req.params.id } });
        const med = await Medicine.findByPk(req.params.id);
        const j = med.toJSON();
        j._id = j.id;
        res.json({ success: true, message: 'Obat diperbarui', medicine: j });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.delete('/admin/medicines/:id', auth, adminAuth, async (req, res) => {
    try {
        await Medicine.update({ isActive: false }, { where: { id: req.params.id } });
        res.json({ success: true, message: 'Obat dinonaktifkan' });
    } catch {
        res.status(500).json({ message: 'Server error' });
    }
});

router.post('/admin/medicines/:id/image', auth, adminAuth,
    (req, res, next) => {
        uploadMedImage.single('image')(req, res, err => {
            if (err) return res.status(400).json({ error: err.message });
            next();
        });
    },
    async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ error: 'File gambar diperlukan' });
            const med = await Medicine.findByPk(req.params.id);
            if (!med) return res.status(404).json({ error: 'Obat tidak ditemukan' });
            if (med.image) {
                const old = path.join(__dirname, '..', med.image);
                if (fs.existsSync(old)) fs.unlinkSync(old);
            }
            med.image = `/uploads/medicines/${req.file.filename}`;
            await med.save();
            res.json({ success: true, image: med.image });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
);

// ═══════════════════════════════════════════════════════════════════════════════
// USER — Hitung Ongkir
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/calculate-shipping', auth, async (req, res) => {
    try {
        const { lat, lng } = req.body;
        if (!lat || !lng) return res.status(400).json({ message: 'Koordinat (lat, lng) wajib diisi' });

        const distanceKm = await getRoadDistance(KLINIK_LAT, KLINIK_LNG, lat, lng);
        const withinRange = distanceKm <= FREE_DELIVERY_KM;

        const options = [];

        options.push({
            method: 'diantar',
            label: 'Diantar ke Rumah',
            description: withinRange
                ? `Gratis ongkir! Estimasi 1–2 jam (jarak ${distanceKm.toFixed(1)} km)`
                : `Hanya tersedia untuk jarak ≤ ${FREE_DELIVERY_KM} km (jarak Anda ${distanceKm.toFixed(1)} km)`,
            cost: 0,
            disabled: !withinRange,
        });

        options.push({
            method: 'pickup',
            label: 'Ambil di Apotek',
            description: `Ambil langsung di Klinik Pratama IPB. Siap dalam ±${PICKUP_READY_MIN} menit.`,
            cost: 0,
            disabled: false,
        });

        return res.json({
            success: true,
            distance: parseFloat(distanceKm.toFixed(2)),
            canDeliver: withinRange,
            message: withinRange
                ? `📍 Jarak ${distanceKm.toFixed(1)} km — pengiriman gratis tersedia!`
                : `📍 Jarak ${distanceKm.toFixed(1)} km — melebihi batas pengiriman ${FREE_DELIVERY_KM} km. Silakan pilih Pickup.`,
            options,
        });
    } catch (err) {
        console.error('[pharmacy] calculate-shipping:', err.message);
        res.status(500).json({ message: 'Gagal menghitung jarak pengiriman', detail: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// USER — Daftar pesanan saya
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/orders', auth, async (req, res) => {
    try {
        const orders = await Order.findAll({
            where: { userId: req.userId },
            include: [{ association: 'items', include: ['medicine'] }],
            order: [['created_at', 'DESC']],
        });
        res.json(orders.map(formatOrder));
    } catch (err) {
        console.error('[pharmacy] GET /orders:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// USER — Buat pesanan baru
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/orders', auth, async (req, res) => {
    try {
        const { items, deliveryMethod, address, detail, lat, lng, distance, phone } = req.body;

        if (!items || items.length === 0)
            return res.status(400).json({ message: 'Keranjang kosong' });
        if (!['diantar', 'pickup'].includes(deliveryMethod))
            return res.status(400).json({ message: 'Metode pengiriman tidak valid' });

        if (deliveryMethod === 'diantar') {
            if (!lat || !lng) return res.status(400).json({ message: 'Koordinat wajib diisi untuk pengiriman' });
            const distKm = await getRoadDistance(KLINIK_LAT, KLINIK_LNG, lat, lng);
            if (distKm > FREE_DELIVERY_KM)
                return res.status(400).json({ message: `Pengiriman hanya tersedia untuk jarak ≤ ${FREE_DELIVERY_KM} km. Jarak Anda ${distKm.toFixed(1)} km. Silakan pilih Pickup.` });
        }

        const user = await User.findByPk(req.userId);
        if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });

        const isStudent = user.email?.toLowerCase().endsWith('@apps.ipb.ac.id');
        let quotaUsed = 0;
        const freeUsedThisMonth = isStudent ? await getStudentFreeUsage(req.userId) : 0;
        let remainingQuota = isStudent ? Math.max(0, STUDENT_MAX_PCS - freeUsedThisMonth) : 0;

        let subtotalObat = 0;
        let requiresPrescription = false;
        const orderItemsData = [];

        for (const item of items) {
            const med = await Medicine.findByPk(item._id || item.id);
            if (!med || !med.isActive)
                return res.status(400).json({ message: `Obat "${item.name || item._id}" tidak tersedia` });

            const available = (med.stock || 0) - (med.lockedStock || 0);
            if (item.quantity > available)
                return res.status(400).json({ message: `Stok ${med.name} tidak mencukupi (tersedia: ${available})` });

            if (med.requiresPrescription) requiresPrescription = true;

            let isFreeForStudent = false;
            let finalPrice = Number(med.price);

            if (isStudent && med.availableForStudentQuota && !med.requiresPrescription && remainingQuota > 0) {
                const freeQty = Math.min(item.quantity, remainingQuota);
                remainingQuota -= freeQty;
                quotaUsed += freeQty;
                finalPrice = freeQty >= item.quantity ? 0 : Number(med.price);
                isFreeForStudent = freeQty > 0;
            }

            const subtotal = finalPrice * item.quantity;
            subtotalObat += subtotal;

            orderItemsData.push({
                medicineId: med.id,
                medicineName: med.name,
                price: Number(med.price),
                finalPrice,
                quantity: item.quantity,
                subtotal,
                requiresPrescription: med.requiresPrescription || false,
                isFreeForStudent,
            });
        }

        const totalAmount = subtotalObat;

        const order = await Order.create({
            userId: req.userId,
            deliveryMethod,
            shippingAddress: address || '',
            shippingDetail: detail || '',
            shippingLat: lat || null,
            shippingLng: lng || null,
            shippingPhone: phone || '',
            distance: distance || 0,
            shippingCost: 0,
            subtotalObat,
            totalAmount,
            requiresPrescription,
            isStudentDiscount: isStudent && quotaUsed > 0,
            studentFreeQty: quotaUsed,
            status: requiresPrescription ? 'waiting_prescription' : 'pending',
            estimatedDelivery: deliveryMethod === 'diantar'
                ? 'Estimasi 1–2 jam setelah pembayaran dikonfirmasi' : null,
        });

        for (const itemData of orderItemsData) {
            await OrderItem.create({ orderId: order.id, ...itemData });
        }

        const fullOrder = await Order.findByPk(order.id, {
            include: [{ association: 'items', include: ['medicine'] }],
        });

        res.status(201).json({ success: true, order: formatOrder(fullOrder), requiresPrescription, quotaUsed });
    } catch (err) {
        console.error('[pharmacy] POST /orders:', err.message, err.stack);
        res.status(500).json({ message: err.message || 'Server error' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// USER — Upload resep
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/orders/:orderId/prescription', auth,
    (req, res, next) => {
        uploadRx.single('prescription')(req, res, err => {
            if (err) return res.status(400).json({ message: err.message });
            next();
        });
    },
    async (req, res) => {
        try {
            const order = await Order.findByPk(req.params.orderId);
            if (!order) return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
            if (order.userId !== req.userId) return res.status(403).json({ message: 'Akses ditolak' });
            if (!['waiting_prescription', 'prescription_rejected'].includes(order.status))
                return res.status(400).json({ message: 'Tidak bisa upload resep pada status ini' });
            if (!req.file) return res.status(400).json({ message: 'File resep diperlukan' });

            order.prescriptionImageUrl = `/uploads/prescriptions/${req.file.filename}`;
            order.prescriptionStatus = 'pending';
            order.prescriptionUploadCount = (order.prescriptionUploadCount || 0) + 1;
            order.status = 'waiting_prescription';
            order.updatedAt = new Date();
            await order.save();

            const io = req.app.get('io');
            const admins = await User.findAll({ where: { role: 'admin' } });
            for (const admin of admins) {
                await createNotification({
                    userId: admin.id, type: 'prescription_submitted',
                    title: '📋 Resep Baru Dikirim',
                    message: `Pesanan ${order.orderNumber} mengirimkan resep. Harap verifikasi.`,
                    data: { orderId: order.id }, io,
                });
            }

            res.json({ success: true, message: 'Resep berhasil diupload. Menunggu verifikasi admin.', order });
        } catch (err) {
            res.status(500).json({ message: err.message || 'Server error' });
        }
    }
);

// ═══════════════════════════════════════════════════════════════════════════════
// USER — Batalkan pesanan
// ═══════════════════════════════════════════════════════════════════════════════

router.put('/orders/:id/cancel', auth, async (req, res) => {
    try {
        const order = await Order.findByPk(req.params.id, {
            include: [{ association: 'items' }],
        });
        if (!order) return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
        if (order.userId !== req.userId) return res.status(403).json({ message: 'Akses ditolak' });

        const cancellable = ['waiting_prescription', 'prescription_rejected', 'pending', 'paid'];
        if (!cancellable.includes(order.status))
            return res.status(400).json({ message: 'Pesanan tidak bisa dibatalkan pada status ini' });

        if (order.status === 'paid') {
            for (const item of (order.items || []))
                await Medicine.increment('stock', { by: item.quantity, where: { id: item.medicineId } });
        }

        order.status = 'cancelled';
        order.cancelReason = req.body.reason || 'Dibatalkan pengguna';
        order.cancelledAt = new Date();
        order.updatedAt = new Date();
        await order.save();

        res.json({ success: true, message: 'Pesanan dibatalkan', order });
    } catch (err) {
        res.status(500).json({ message: err.message || 'Server error' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// USER — Konfirmasi pesanan gratis
// ═══════════════════════════════════════════════════════════════════════════════

router.put('/orders/:id/confirm-free', auth, async (req, res) => {
    try {
        const order = await Order.findByPk(req.params.id, {
            include: [{ association: 'items' }],
        });
        if (!order) return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
        if (order.userId !== req.userId) return res.status(403).json({ message: 'Akses ditolak' });
        if (order.totalAmount !== 0) return res.status(400).json({ message: 'Pesanan ini tidak gratis' });

        if (!['pending', 'paid'].includes(order.status))
            return res.status(400).json({ message: 'Status pesanan tidak valid untuk konfirmasi gratis' });

        for (const item of (order.items || []))
            await Medicine.increment('stock', { by: -item.quantity, where: { id: item.medicineId } });

        order.status = 'diproses';
        order.diprosesPaidAt = new Date();
        order.updatedAt = new Date();
        await order.save();

        res.json({ success: true, message: 'Pesanan dikonfirmasi. Sedang disiapkan.', order });
    } catch (err) {
        res.status(500).json({ message: err.message || 'Server error' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// USER — Selesaikan pesanan
// ═══════════════════════════════════════════════════════════════════════════════

router.put('/orders/:id/selesai', auth, async (req, res) => {
    try {
        const order = await Order.findByPk(req.params.id);
        if (!order) return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
        if (order.userId !== req.userId) return res.status(403).json({ message: 'Akses ditolak' });
        if (!['terkirim', 'siap_diambil'].includes(order.status))
            return res.status(400).json({ message: 'Pesanan belum diterima/siap diambil' });

        order.status = 'selesai';
        order.completedAt = new Date();
        order.updatedAt = new Date();
        await order.save();

        res.json({ success: true, message: 'Pesanan diselesaikan!', order });
    } catch (err) {
        res.status(500).json({ message: err.message || 'Server error' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// USER — Kuota mahasiswa
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/student-quota', auth, async (req, res) => {
    try {
        const user = await User.findByPk(req.userId);
        if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });
        const isStudent = user.email?.toLowerCase().endsWith('@apps.ipb.ac.id');
        if (!isStudent) return res.json({ isStudent: false, used: 0, remaining: 0, max: STUDENT_MAX_PCS });
        const used = await getStudentFreeUsage(req.userId);
        const remaining = Math.max(0, STUDENT_MAX_PCS - used);
        res.json({ isStudent: true, used, remaining, max: STUDENT_MAX_PCS });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN — Orders
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/admin/orders', auth, adminAuth, async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        const q = {};
        if (status && status !== 'all') q.status = status;
        const result = await Order.findAndCountAll({
            where: q,
            include: [{ model: User, as: 'user', attributes: ['name', 'email', 'phone'] }, 'payment', { association: 'items', include: ['medicine'] }],
            order: [['created_at', 'DESC']],
            limit: limit * 1,
            offset: (page - 1) * limit
        });
        const orders = result.rows.map(formatOrder);
        const total = result.count;
        res.json({ success: true, orders, totalPages: Math.ceil(total / limit), total });
    } catch (err) {
        console.error('[pharmacy] GET /admin/orders:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

// ── Admin: edit kuantitas item sebelum approve resep (FIXED) ─────────────────────────
router.put('/admin/orders/:id/adjust-items', auth, adminAuth, async (req, res) => {
    try {
        const { items } = req.body;
        const order = await Order.findByPk(req.params.id, {
            include: [{ association: 'items' }],
        });
        if (!order) return res.status(404).json({ message: 'Order tidak ditemukan' });
        if (order.status !== 'waiting_prescription')
            return res.status(400).json({ message: 'Hanya bisa edit item saat waiting_prescription' });

        // Update quantity dan hitung ulang subtotal
        for (const adj of items) {
            const idx = order.items.findIndex(i => String(i.medicineId) === String(adj.medicineId));
            if (idx === -1) continue;
            const med = await Medicine.findByPk(adj.medicineId);
            if (!med) continue;

            const avail = (med.stock || 0) - (med.lockedStock || 0);
            if (adj.quantity > avail) {
                return res.status(400).json({ message: `Stok ${med.name} tidak cukup untuk kuantitas ${adj.quantity}` });
            }

            order.items[idx].quantity = adj.quantity;
            // Gunakan finalPrice atau price untuk perhitungan
            const pricePerUnit = order.items[idx].finalPrice || order.items[idx].price || 0;
            order.items[idx].subtotal = pricePerUnit * adj.quantity;
        }

        // Hitung ulang total order
        order.subtotalObat = order.items.reduce((s, i) => s + (i.subtotal || 0), 0);
        order.totalAmount = order.subtotalObat + (order.shippingCost || 0);
        order.updatedAt = new Date();
        await order.save();

        const io = req.app.get('io');
        await createNotification({
            userId: order.userId,
            type: 'order_items_adjusted',
            title: 'Kuantitas Obat Disesuaikan 📋',
            message: `Admin telah menyesuaikan jumlah obat di pesanan ${order.orderNumber} sesuai dosis resep. Total baru: Rp ${order.totalAmount.toLocaleString('id-ID')}`,
            data: { orderId: order.id },
            io
        });

        if (io) {
            io.to(`user-${order.userId}`).emit('order-items-adjusted', {
                orderId: order.id.toString(),
                newTotal: order.totalAmount
            });
        }

        // Ambil order yang sudah diupdate untuk response
        const updatedOrder = await Order.findByPk(order.id, {
            include: [
                { model: User, as: 'user', attributes: ['name', 'email', 'phone'] },
                { association: 'items' },
            ],
        });

        res.json({ success: true, message: 'Item diperbarui', order: formatOrder(updatedOrder) });
    } catch (err) {
        console.error('[pharmacy] adjust items:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// ── Admin: verifikasi resep ───────────────────────────────────────────────────
router.put('/admin/orders/:id/verify-prescription', auth, adminAuth, async (req, res) => {
    try {
        const { action, reason } = req.body;
        if (!['approve', 'reject'].includes(action))
            return res.status(400).json({ message: 'action harus approve atau reject' });

        const order = await Order.findByPk(req.params.id, {
            include: [
                { model: User, as: 'user', attributes: ['name', 'email', 'phone'] },
                { association: 'items' },
            ],
        });
        if (!order) return res.status(404).json({ message: 'Order tidak ditemukan' });
        if (order.status !== 'waiting_prescription')
            return res.status(400).json({ message: 'Order tidak dalam status menunggu verifikasi resep' });
        if (!order.prescriptionImageUrl)
            return res.status(400).json({ message: 'Belum ada resep yang diupload' });

        const io = req.app.get('io');

        if (action === 'approve') {
            order.prescriptionStatus = 'approved';
            order.prescriptionReviewedAt = new Date();
            order.updatedAt = new Date();

            if (order.totalAmount === 0) {
                for (const item of (order.items || []))
                    await Medicine.increment({ stock: -item.quantity }, { where: { id: item.medicineId } });
                order.status = 'diproses';
                order.diprosesPaidAt = new Date();
                await order.save();
                await createNotification({
                    userId: order.userId, type: 'payment_verified',
                    title: 'Resep Disetujui & Pesanan Diproses ✅',
                    message: `Resep pesanan ${order.orderNumber} disetujui. Karena total Rp 0, pesanan langsung diproses.`,
                    data: { orderId: order.id }, io
                });
            } else {
                const lockExpiry = new Date(Date.now() + PAYMENT_LOCK_MIN * 60000);
                for (const item of (order.items || []))
                    await Medicine.increment({ lockedStock: item.quantity }, { where: { id: item.medicineId } });
                order.status = 'pending';
                order.paymentExpiry = lockExpiry;
                order.stockLockExpiry = lockExpiry;
                await order.save();
                await createNotification({
                    userId: order.userId, type: 'payment_verified',
                    title: 'Resep Disetujui ✅',
                    message: `Resep pesanan ${order.orderNumber} disetujui. Silakan lanjutkan pembayaran dalam 15 menit.`,
                    data: { orderId: order.id }, io
                });
            }
            if (io) io.to(`user-${order.userId}`).emit('prescription-verified', { orderId: order.id.toString(), status: 'approved' });

        } else {
            order.prescriptionStatus = 'rejected';
            order.prescriptionRejectedReason = reason || 'Resep tidak valid';
            order.prescriptionReviewedAt = new Date();
            order.status = 'prescription_rejected';
            order.updatedAt = new Date();
            await order.save();

            await createNotification({
                userId: order.userId, type: 'payment_verified',
                title: 'Resep Ditolak ❌',
                message: `Resep pesanan ${order.orderNumber} ditolak. Alasan: ${reason || 'Resep tidak valid'}. Silakan upload ulang resep yang valid.`,
                data: { orderId: order.id }, io
            });
            if (io) io.to(`user-${order.userId}`).emit('prescription-verified', { orderId: order.id.toString(), status: 'rejected', reason });
        }

        res.json({ success: true, message: action === 'approve' ? 'Resep disetujui' : 'Resep ditolak', order });
    } catch (err) {
        console.error('[pharmacy] verify rx:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// ── Admin: update status order ────────────────────────────────────────────────
router.put('/admin/orders/:id/status', auth, adminAuth, async (req, res) => {
    try {
        const { status } = req.body;
        const order = await Order.findByPk(req.params.id, {
            include: [
                { model: User, as: 'user', attributes: ['name', 'email', 'phone'] },
                { association: 'items' },
            ],
        });
        if (!order) return res.status(404).json({ message: 'Order tidak ditemukan' });

        const isPickup = order.deliveryMethod === 'pickup';
        const validTransitions = {
            'paid': ['diproses'],
            'diproses': isPickup ? ['siap_diambil'] : ['dikirim'],
            'dikirim': ['terkirim'],
            'terkirim': ['selesai'],
            'siap_diambil': ['selesai'],
        };

        const allowed = validTransitions[order.status];
        if (!allowed || !allowed.includes(status))
            return res.status(400).json({ message: `Tidak bisa ubah dari "${order.status}" ke "${status}"` });

        const io = req.app.get('io');
        const now = new Date();
        const prevStatus = order.status;
        order.status = status;
        order.updatedAt = now;

        if (status === 'diproses' && isPickup) order.diprosesPaidAt = now;
        if (status === 'terkirim') order.terkirimAt = now;
        if (status === 'selesai') order.completedAt = now;
        if (status === 'cancelled') {
            order.cancelledAt = now;
            order.cancelReason = 'Dibatalkan oleh admin';
            const needsStockReturn = ['paid', 'diproses', 'dikirim', 'terkirim', 'siap_diambil'].includes(prevStatus);
            if (needsStockReturn) {
                for (const item of (order.items || []))
                    await Medicine.increment('stock', { by: item.quantity, where: { id: item.medicineId } });
            }
        }
        await order.save();

        const notifMap = {
            diproses: { title: 'Pesanan Diproses 📦', msg: `Pesanan ${order.orderNumber} sedang disiapkan apoteker.` },
            dikirim: { title: 'Pesanan Dikirim 🏍️', msg: `Pesanan ${order.orderNumber} sedang dalam perjalanan. Estimasi 1–2 hari kerja.` },
            terkirim: { title: 'Pesanan Sudah Tiba 📬', msg: `Pesanan ${order.orderNumber} sudah tiba. Silakan konfirmasi penerimaan.` },
            siap_diambil: { title: 'Obat Siap Diambil 🏥', msg: `Pesanan ${order.orderNumber} siap diambil di Klinik Pratama IPB.` },
            selesai: { title: 'Pesanan Selesai ✅', msg: `Pesanan ${order.orderNumber} selesai.` },
            cancelled: { title: 'Pesanan Dibatalkan', msg: `Pesanan ${order.orderNumber} dibatalkan oleh admin.` },
        };
        if (notifMap[status]) {
            await createNotification({
                userId: order.userId, type: 'order_shipped',
                title: notifMap[status].title, message: notifMap[status].msg,
                data: { orderId: order.id }, io
            });
            if (io) io.to(`user-${order.userId}`).emit('order-status-update', { orderId: order.id.toString(), status });
        }

        res.json({ success: true, message: 'Status diperbarui', order });
    } catch (err) {
        console.error('[pharmacy] update status:', err.message, err.stack);
        res.status(500).json({ message: err.message || 'Server error' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// REFUND FARMASI
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/orders/:id/refund-request',
    auth,
    (req, res, next) => {
        uploadRefundVideo.single('video')(req, res, (err) => {
            if (err && err.code !== 'LIMIT_UNEXPECTED_FILE') return next(err);
            next();
        });
    },
    async (req, res) => {
        try {
            const order = await Order.findByPk(req.params.id);
            if (!order) return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
            if (order.userId !== req.userId)
                return res.status(403).json({ message: 'Akses ditolak' });

            const { reason } = req.body;

            if (order.status === 'paid') {
                const paidAt = order.updatedAt || order.createdAt;
                const elapsed = Date.now() - new Date(paidAt).getTime();
                if (elapsed > 60 * 60 * 1000) {
                    return res.status(400).json({ message: 'Batas refund langsung adalah 1 jam setelah pembayaran. Untuk refund barang yang sudah diterima, pilih opsi refund dengan video bukti.' });
                }

                const XENDIT_SECRET_KEY = process.env.XENDIT_SECRET_KEY;
                const headers = {
                    Authorization: 'Basic ' + Buffer.from(XENDIT_SECRET_KEY + ':').toString('base64'),
                    'Content-Type': 'application/json',
                };
                const amount = order.totalAmount;
                let refunded = false;
                let refundMethod = null;

                let xenditInvoiceId = null;
                if (order.xenditExternalId) {
                    try {
                        const invRes = await axios.get(
                            `https://api.xendit.co/v2/invoices?external_id=${order.xenditExternalId}`,
                            { headers }
                        );
                        xenditInvoiceId = invRes.data?.[0]?.id;
                    } catch (e) { /* ignore */ }
                }

                if (xenditInvoiceId) {
                    try {
                        const r = await axios.post('https://api.xendit.co/refunds',
                            { invoice_id: xenditInvoiceId, reason: 'CANCELLATION', amount },
                            { headers: { ...headers, 'idempotency-key': `REFUND-ORDER-${order.id}-${Date.now()}` } }
                        );
                        order.refundMethod = 'xendit_refund';
                        order.refundProcessedAt = new Date();
                        order.refundReason = reason?.trim() || 'Dibatalkan oleh pasien';
                        refundMethod = 'xendit_refund';
                        refunded = true;
                    } catch (xenditErr) {
                        const errCode = xenditErr.response?.data?.error_code;
                        if (!['REFUND_NOT_SUPPORTED', 'CHANNEL_NOT_SUPPORTED'].includes(errCode)) {
                            console.error('[pharmacy refund instant] Xendit error:', xenditErr.response?.data);
                        }
                    }
                }

                if (!refunded) {
                    const { bankCode, accountNumber, accountName } = req.body;
                    if (!bankCode || !accountNumber || !accountName) {
                        return res.status(200).json({
                            success: true, needsBankInfo: true,
                            message: 'Metode pembayaran tidak mendukung refund otomatis. Masukkan data rekening bank untuk menerima refund.',
                        });
                    }
                    const r = await axios.post('https://api.xendit.co/disbursements',
                        { external_id: `DISB-ORDER-${order.id}-${Date.now()}`, bank_code: bankCode, account_holder_name: accountName, account_number: accountNumber, description: `Refund pesanan ${order.orderNumber}`, amount },
                        { headers: { ...headers, 'X-IDEMPOTENCY-KEY': `DISB-ORDER-${order.id}-${Date.now()}` } }
                    );
                    order.refundMethod = 'xendit_disbursement';
                    order.refundBankCode = bankCode;
                    order.refundAccountNumber = accountNumber;
                    order.refundAccountName = accountName;
                    order.refundProcessedAt = new Date();
                    order.refundReason = reason?.trim() || 'Dibatalkan oleh pasien';
                    refundMethod = 'xendit_disbursement';
                }

                order.status = 'refunded';
                await order.save();

                const eta = refundMethod === 'xendit_refund' ? 'beberapa menit' : '1x24 jam';
                await createNotification({
                    userId: order.userId,
                    type: 'refund_processed',
                    title: '💰 Refund Berhasil',
                    message: `Refund pesanan ${order.orderNumber} sebesar Rp ${Number(amount).toLocaleString('id-ID')} sedang diproses dan akan masuk dalam ${eta}. Catatan: biaya payment gateway tidak termasuk.`,
                    data: { orderId: order.id },
                    io: req.app.get('io'),
                });

                return res.json({ success: true, message: `Refund berhasil diproses. Dana akan masuk dalam ${eta}.`, method: refundMethod, order });
            }

            if (!['terkirim', 'selesai'].includes(order.status)) {
                return res.status(400).json({ message: `Refund dengan video hanya bisa untuk pesanan yang sudah diterima (terkirim/selesai). Status saat ini: ${order.status}` });
            }

            const arrivedAt = order.terkirimAt || order.completedAt || order.updatedAt;
            if (Date.now() - new Date(arrivedAt).getTime() > 24 * 60 * 60 * 1000) {
                return res.status(400).json({ message: 'Batas pengajuan refund adalah 1 hari setelah pesanan diterima.' });
            }

            if (!req.file) {
                return res.status(400).json({ message: 'Video bukti wajib diunggah untuk refund barang yang sudah diterima.' });
            }
            if (!reason?.trim()) {
                return res.status(400).json({ message: 'Alasan refund wajib diisi.' });
            }

            order.status = 'refund_requested';
            order.refundVideoUrl = req.file.path;
            order.refundReason = reason.trim();
            order.refundRequestedAt = new Date();
            await order.save();

            const admins = await User.findAll({ where: { role: 'admin' } });
            for (const admin of admins) {
                await createNotification({
                    userId: admin.id,
                    type: 'refund_requested',
                    title: '🎥 Refund Farmasi — Perlu Review',
                    message: `Pesanan ${order.orderNumber} mengajukan refund barang tidak sesuai. Tinjau video bukti.`,
                    data: { orderId: order.id },
                    io: req.app.get('io'),
                });
            }

            return res.json({ success: true, message: 'Pengajuan refund berhasil dikirim. Admin akan meninjau dalam 1×24 jam.', order });
        } catch (err) {
            console.error('[pharmacy refund-request]', err.response?.data || err.message);
            res.status(500).json({ message: 'Server error', error: err.message });
        }
    });

router.put('/admin/orders/:id/refund-review', auth, adminAuth, async (req, res) => {
    try {
        const order = await Order.findByPk(req.params.id, { include: [{ model: User, as: 'user' }] });
        if (!order) return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
        if (order.status !== 'refund_requested')
            return res.status(400).json({ message: 'Status harus refund_requested' });

        const { action, rejectReason, bankCode, accountNumber, accountName } = req.body;
        if (!['approve', 'reject'].includes(action))
            return res.status(400).json({ message: 'action harus approve atau reject' });

        if (action === 'reject') {
            order.status = 'refund_rejected';
            order.refundReviewedAt = new Date();
            order.refundRejectReason = rejectReason || 'Tidak memenuhi syarat refund';
            await order.save();

            await createNotification({
                userId: order.userId,
                type: 'refund_processed',
                title: '❌ Refund Ditolak',
                message: `Refund pesanan ${order.orderNumber} ditolak. Alasan: ${order.refundRejectReason}`,
                data: { orderId: order.id },
                io: req.app.get('io'),
            });
            return res.json({ success: true, message: 'Refund ditolak', order });
        }

        const xenditExternalId = order.xenditExternalId;
        const XENDIT_SECRET_KEY = process.env.XENDIT_SECRET_KEY;
        const headers = {
            Authorization: 'Basic ' + Buffer.from(XENDIT_SECRET_KEY + ':').toString('base64'),
            'Content-Type': 'application/json',
        };
        const amount = order.totalAmount;
        let refunded = false;
        let refundMethod = null;

        let xenditInvoiceId = null;
        if (xenditExternalId) {
            try {
                const invRes = await axios.get(
                    `https://api.xendit.co/v2/invoices?external_id=${xenditExternalId}`,
                    { headers }
                );
                xenditInvoiceId = invRes.data?.[0]?.id;
            } catch (e) { /* ignore */ }
        }

        if (xenditInvoiceId) {
            try {
                const r = await axios.post('https://api.xendit.co/refunds',
                    { invoice_id: xenditInvoiceId, reason: 'CANCELLATION', amount },
                    { headers: { ...headers, 'idempotency-key': `REFUND-ORDER-${order.id}-${Date.now()}` } }
                );
                refundMethod = 'xendit_refund';
                refunded = true;
            } catch (xenditErr) {
                const errCode = xenditErr.response?.data?.error_code;
                if (!['REFUND_NOT_SUPPORTED', 'CHANNEL_NOT_SUPPORTED'].includes(errCode)) {
                    console.error('[pharmacy refund] Xendit Refund error:', xenditErr.response?.data);
                }
            }
        }

        if (!refunded) {
            if (!bankCode || !accountNumber || !accountName) {
                return res.status(400).json({
                    needsBankInfo: true,
                    message: 'Metode pembayaran tidak mendukung refund otomatis. Masukkan data rekening untuk disbursement.',
                });
            }
            const r = await axios.post('https://api.xendit.co/disbursements',
                {
                    external_id: `DISB-ORDER-${order.id}-${Date.now()}`,
                    bank_code: bankCode,
                    account_holder_name: accountName,
                    account_number: accountNumber,
                    description: `Refund pesanan ${order.orderNumber}`,
                    amount,
                },
                { headers: { ...headers, 'X-IDEMPOTENCY-KEY': `DISB-ORDER-${order.id}-${Date.now()}` } }
            );
            order.refundBankCode = bankCode;
            order.refundAccountNumber = accountNumber;
            order.refundAccountName = accountName;
            refundMethod = 'xendit_disbursement';
        }

        order.status = 'refunded';
        order.refundMethod = refundMethod;
        order.refundReviewedAt = new Date();
        order.refundProcessedAt = new Date();
        await order.save();

        const eta = refundMethod === 'xendit_refund' ? 'beberapa menit' : '1x24 jam';
        await createNotification({
            userId: order.userId,
            type: 'refund_processed',
            title: '💰 Refund Disetujui',
            message: `Refund pesanan ${order.orderNumber} sebesar Rp ${Number(amount).toLocaleString('id-ID')} sedang diproses dan akan masuk dalam ${eta}. Catatan: biaya payment gateway tidak termasuk dalam refund.`,
            data: { orderId: order.id },
            io: req.app.get('io'),
        });

        res.json({ success: true, method: refundMethod, amount, order });
    } catch (err) {
        console.error('[pharmacy refund-review]', err.response?.data || err.message);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

router.get('/admin/orders/refund-requests', auth, adminAuth, async (req, res) => {
    try {
        const result = await Order.findAll({
            where: { status: 'refund_requested' },
            include: [{ model: User, as: 'user', attributes: ['name', 'email', 'phone'] }],
            order: [['created_at', 'DESC']]
        });
        const orders = result.map(formatOrder);
        res.json({ success: true, orders });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;