// routes/pharmacy.js
const express   = require('express');
const router    = express.Router();
const multer    = require('multer');
const path      = require('path');
const fs        = require('fs');
const axios     = require('axios');

const Medicine  = require('../models/Medicine');
const Order     = require('../models/Order');
const auth      = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const User      = require('../models/User');
const { createNotification } = require('../utils/notificationHelper');
const { createCloudinaryUpload } = require('../config/cloudinary');

// Upload video refund via Cloudinary (max 50MB, video/image)
const uploadRefundVideo = createCloudinaryUpload(
    'klinik-refund-pharmacy',
    ['mp4', 'mov', 'avi', 'mkv', 'webm', 'jpg', 'jpeg', 'png'],
    50
);

// ─── Konstanta ────────────────────────────────────────────────────────────────
const KLINIK_LAT        = -6.5530;
const KLINIK_LNG        = 106.7237;
const STUDENT_MAX_PCS   = 8;   // maks 8 pcs gratis / bulan / mahasiswa
const PICKUP_READY_MIN  = 30;  // menit sampai siap diambil
const PAYMENT_LOCK_MIN  = 15;  // menit lock stok saat pending

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function getRoadDistance(lat1, lng1, lat2, lng2) {
    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=false`;
        const r   = await axios.get(url, { timeout: 8000, headers: { 'User-Agent': 'KlinikIPB/1.0' } });
        if (r.data?.routes?.length) return r.data.routes[0].distance / 1000;
        throw new Error('no route');
    } catch {
        return haversine(lat1, lng1, lat2, lng2);
    }
}
function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

/**
 * Cek berapa pcs mahasiswa sudah ambil gratis bulan ini
 * Hanya menghitung order dengan status selain cancelled/expired
 */
async function getStudentFreeUsage(userId) {
    const now       = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endMonth   = new Date(now.getFullYear(), now.getMonth()+1, 0, 23, 59, 59);

    const orders = await Order.find({
        userId,
        isStudentDiscount: true,
        studentFreeQty   : { $gt: 0 },
        status           : { $nin: ['cancelled','expired','prescription_rejected'] },
        createdAt        : { $gte: startMonth, $lte: endMonth },
    });
    return orders.reduce((s, o) => s + (o.studentFreeQty || 0), 0);
}

// ─── Multer: gambar obat ──────────────────────────────────────────────────────
const medDir = path.join(__dirname, '../uploads/medicines');
if (!fs.existsSync(medDir)) fs.mkdirSync(medDir, { recursive: true });
const uploadMedImage = multer({
    storage: multer.diskStorage({
        destination: (_,__,cb) => cb(null, medDir),
        filename   : (req,file,cb) => cb(null, `med-${req.params.id}-${Date.now()}${path.extname(file.originalname).toLowerCase()}`),
    }),
    limits    : { fileSize: 3*1024*1024 },
    fileFilter: (_,file,cb) => /jpeg|jpg|png|webp/.test(path.extname(file.originalname).toLowerCase()) ? cb(null,true) : cb(new Error('Hanya jpg/png/webp')),
});

// ─── Multer: resep ────────────────────────────────────────────────────────────
const rxDir = path.join(__dirname, '../uploads/prescriptions');
if (!fs.existsSync(rxDir)) fs.mkdirSync(rxDir, { recursive: true });
const uploadRx = multer({
    storage: multer.diskStorage({
        destination: (_,__,cb) => cb(null, rxDir),
        filename   : (req,file,cb) => cb(null, `rx-${req.params.orderId}-${Date.now()}${path.extname(file.originalname).toLowerCase()}`),
    }),
    limits    : { fileSize: 5*1024*1024 },
    fileFilter: (_,file,cb) => /jpeg|jpg|png|webp|pdf/.test(path.extname(file.originalname).toLowerCase()) ? cb(null,true) : cb(new Error('Hanya gambar/PDF')),
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC — Daftar & detail obat
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/medicines', async (req, res) => {
    try {
        const { search, category, page=1, limit=12 } = req.query;
        const q = {}; // tampilkan semua obat (aktif & nonaktif) — frontend bedakan UI
        if (search)   q.$or = [{ name: { $regex: search, $options:'i' } }, { genericName: { $regex: search, $options:'i' } }];
        if (category) q.category = category;
        const meds  = await Medicine.find(q).limit(limit*1).skip((page-1)*limit).sort('-createdAt');
        const total = await Medicine.countDocuments(q);
        res.json({ success:true, medicines:meds, totalPages:Math.ceil(total/limit), currentPage:+page, total });
    } catch { res.status(500).json({ message:'Server error' }); }
});

router.get('/medicines/:id', async (req, res) => {
    try {
        const med = await Medicine.findById(req.params.id);
        if (!med) return res.status(404).json({ message:'Obat tidak ditemukan' });
        res.json(med);
    } catch { res.status(500).json({ message:'Server error' }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PROTECTED — Kuota mahasiswa (info untuk frontend)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/student-quota', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const isStudent = user.email?.toLowerCase().endsWith('@apps.ipb.ac.id');
        if (!isStudent) return res.json({ isStudent: false });
        const used      = await getStudentFreeUsage(req.userId);
        const remaining = Math.max(0, STUDENT_MAX_PCS - used);
        res.json({ isStudent: true, used, remaining, max: STUDENT_MAX_PCS });
    } catch { res.status(500).json({ message:'Server error' }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PROTECTED — Hitung ongkir
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/calculate-shipping', auth, async (req, res) => {
    try {
        const uLat = parseFloat(req.body.lat), uLng = parseFloat(req.body.lng);
        if (isNaN(uLat)||isNaN(uLng)) return res.status(400).json({ success:false, message:'Koordinat tidak valid' });
        if (uLat<-7.5||uLat>-5.5||uLng<105.5||uLng>108.0)
            return res.status(400).json({ success:false, message:'Lokasi di luar area layanan Klinik IPB' });

        const km   = Math.round(await getRoadDistance(KLINIK_LAT,KLINIK_LNG,uLat,uLng)*10)/10;
        const opts = [];
        if (km < 5) opts.push({ method:'diantar', label:'Diantar ke Alamat', cost:5000, description:'Ojek klinik · estimasi 1–2 hari kerja' });
        opts.push(  { method:'pickup',  label:'Ambil di Klinik (Pickup)', cost:0,    description:'Klinik Pratama IPB Dramaga · Gratis' });

        res.json({
            success:true, distance:km, canDeliver:km<5, options:opts,
            message: km<5
                ? `Jarak ${km} km — tersedia pengiriman (ongkir Rp 5.000) atau pickup gratis`
                : `Jarak ${km} km — di luar area pengiriman (>5 km), hanya tersedia pickup`,
        });
    } catch { res.status(500).json({ success:false, message:'Server error' }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PROTECTED — Buat Order
//
// Aturan kuota mahasiswa:
//   - Email @apps.ipb.ac.id → isStudent
//   - Setiap bulan maks 8 pcs gratis (hanya obat dengan availableForStudentQuota=true)
//   - Tidak berlaku untuk obat resep (requiresPrescription=true tidak bisa gratis)
//   - Obat yang melebihi kuota tetap dikenakan harga normal
//   - Tidak ada diantar gratis (pickup gratis, diantar tetap bayar ongkir)
//
// Lock stok:
//   - Tidak ada resep → status pending, stok di-lock 15 mnt
//   - Ada resep → status waiting_prescription, stok BELUM di-lock
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/orders', auth, async (req, res) => {
    try {
        const { items, deliveryMethod, address, detail, lat, lng, distance, shippingCost, phone } = req.body;

        if (!['diantar','pickup'].includes(deliveryMethod))
            return res.status(400).json({ success:false, message:'Metode pengiriman tidak valid' });
        if (deliveryMethod==='diantar') {
            const uLat = parseFloat(lat), uLng = parseFloat(lng);
            if (isNaN(uLat)||isNaN(uLng))
                return res.status(400).json({ success:false, message:'Koordinat lokasi wajib diisi untuk pengiriman' });
            // Re-verify jarak server-side agar user tidak manipulasi shippingCost
            const verifiedKm = Math.round(await getRoadDistance(KLINIK_LAT,KLINIK_LNG,uLat,uLng)*10)/10;
            if (verifiedKm >= 5)
                return res.status(400).json({ success:false, message:`Jarak terdeteksi ${verifiedKm} km — di luar area pengiriman. Hanya tersedia pickup.` });
        }

        // Validasi items
        if (!items?.length) return res.status(400).json({ success:false, message:'Keranjang kosong' });

        const user      = await User.findById(req.userId);
        const isStudent = user.email?.toLowerCase().endsWith('@apps.ipb.ac.id');

        // ── Cek backend: apakah ada obat resep tanpa resep yang approve? ─────
        // (jika ada, backend tolak checkout)
        let needsRx = false;
        for (const item of items) {
            const med = await Medicine.findById(item._id);
            if (!med || !med.isActive) return res.status(404).json({ success:false, message:`Obat ${item.name} tidak tersedia` });
            const avail = (med.stock||0) - (med.lockedStock||0);
            if (avail < item.quantity) return res.status(400).json({ success:false, message:`Stok ${med.name} tidak cukup (tersisa ${avail})` });
            if (med.requiresPrescription) needsRx = true;
        }

        // ── Hitung harga item per item (kuota mahasiswa) ──────────────────────
        let usedQuota = isStudent ? await getStudentFreeUsage(req.userId) : 0;
        let quotaThisOrder = 0;
        const orderItems = [];
        let subtotalObat = 0;

        for (const item of items) {
            const med = await Medicine.findById(item._id);
            let freeQty = 0;
            let paidQty = item.quantity;

            // Obat bisa gratis jika: mahasiswa + toggle aktif + bukan obat resep
            if (isStudent && med.availableForStudentQuota && !med.requiresPrescription) {
                const remainingQuota = STUDENT_MAX_PCS - usedQuota;
                freeQty = Math.min(item.quantity, Math.max(0, remainingQuota));
                paidQty = item.quantity - freeQty;
                usedQuota      += freeQty;
                quotaThisOrder += freeQty;
            }

            const paidSubtotal = paidQty * med.price;
            const finalPrice   = paidQty === 0 ? 0 : med.price; // per unit (informasi)
            subtotalObat      += paidSubtotal;

            orderItems.push({
                medicineId          : med._id,
                name                : med.name,
                price               : med.price,
                finalPrice,
                quantity            : item.quantity,
                subtotal            : paidSubtotal,
                requiresPrescription: med.requiresPrescription,
                isFreeForStudent    : freeQty > 0,
            });
        }

        // Mahasiswa tidak dapat diantar gratis — ongkir tetap
        // Paksa ongkir dari server agar tidak bisa dimanipulasi frontend
        const finalShipping = deliveryMethod==='pickup' ? 0 : 5000;
        const totalAmount   = subtotalObat + finalShipping;

        const initStatus = needsRx ? 'waiting_prescription' : 'pending';
        const lockExpiry = needsRx ? null : new Date(Date.now() + PAYMENT_LOCK_MIN*60000);

        // Lock stok hanya jika tidak butuh resep
        if (!needsRx) {
            for (const item of items) {
                await Medicine.findByIdAndUpdate(item._id, {
                    $inc: { lockedStock: item.quantity },
                    $set: { stockLockExpiry: lockExpiry },
                });
            }
        }

        const order = new Order({
            userId          : req.userId,
            items           : orderItems,
            requiresPrescription: needsRx,
            subtotalObat,
            isStudentDiscount: isStudent && quotaThisOrder > 0,
            studentFreeQty  : quotaThisOrder,
            shippingCost    : finalShipping,
            totalAmount,
            deliveryMethod,
            shippingAddress : { address:address||'', detail:detail||'', lat:lat||null, lng:lng||null, phone:phone||user.phone||'' },
            distance        : deliveryMethod==='diantar' ? (parseFloat(distance)||0) : 0,
            estimatedDelivery: deliveryMethod==='diantar' ? 'Estimasi 1–2 hari kerja' : 'Ambil di Klinik Pratama IPB',
            status          : initStatus,
            paymentExpiry   : lockExpiry,
            stockLockExpiry : lockExpiry,
        });
        await order.save();

        res.json({
            success: true,
            message: needsRx
                ? 'Pesanan dibuat. Upload resep dokter untuk melanjutkan.'
                : 'Pesanan dibuat. Silakan bayar dalam 15 menit.',
            order, requiresPrescription: needsRx,
            isStudentDiscount: isStudent && quotaThisOrder>0,
            quotaUsed: quotaThisOrder,
        });
    } catch (err) {
        console.error('[pharmacy] create order:', err);
        res.status(500).json({ success:false, message:'Gagal membuat pesanan' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PROTECTED — Upload resep ke order
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/orders/:orderId/prescription',
    auth,
    (req,res,next) => { uploadRx.single('prescription')(req,res,err => { if(err) return res.status(400).json({ message:err.message }); next(); }); },
    async (req, res) => {
        try {
            const order = await Order.findById(req.params.orderId);
            if (!order) return res.status(404).json({ message:'Pesanan tidak ditemukan' });
            if (order.userId.toString() !== req.userId) return res.status(403).json({ message:'Unauthorized' });
            if (!['waiting_prescription','prescription_rejected'].includes(order.status))
                return res.status(400).json({ message:'Status pesanan tidak memungkinkan upload resep' });
            if (!req.file) return res.status(400).json({ message:'File resep harus disertakan' });

            // Rate limit 3x/jam
            const now    = Date.now();
            const winStart = order.prescriptionUploadWindowStart?.getTime()||0;
            const inWin  = (now-winStart) < 3600000;
            if (inWin && order.prescriptionUploadCount>=3) {
                fs.unlink(req.file.path,()=>{});
                const mLeft = Math.ceil((3600000-(now-winStart))/60000);
                return res.status(429).json({ message:`Batas upload tercapai (3x/jam). Coba lagi dalam ${mLeft} menit.` });
            }

            // Hapus resep lama
            if (order.prescription?.imageUrl) {
                const old = path.join(__dirname,'..', order.prescription.imageUrl);
                if (fs.existsSync(old)) fs.unlink(old,()=>{});
            }

            if (!inWin) { order.prescriptionUploadCount=1; order.prescriptionUploadWindowStart=new Date(now); }
            else        { order.prescriptionUploadCount+=1; }

            order.prescription = { imageUrl:`/uploads/prescriptions/${req.file.filename}`, uploadedAt:new Date(), status:'pending' };
            order.status    = 'waiting_prescription';
            order.updatedAt = new Date();
            await order.save();

            const io = req.app.get('io');
            if (io) io.emit('prescription-uploaded', { orderId:order._id, orderNumber:order.orderNumber });

            // Notifikasi ke semua admin
            try {
                const admins = await User.find({ role: 'admin' }).select('_id');
                for (const admin of admins) {
                    await createNotification({
                        userId : admin._id,
                        type   : 'order_shipped',
                        title  : '📋 Resep Baru Menunggu Verifikasi',
                        message: `Pesanan ${order.orderNumber} mengunggah resep. Silakan verifikasi.`,
                        data   : { orderId: order._id },
                        io,
                    });
                }
            } catch (e) { console.error('[pharmacy] rx admin notif:', e.message); }

            res.json({ success:true, message:'Resep diupload. Menunggu verifikasi admin.', order });
        } catch (err) {
            if (req.file) fs.unlink(req.file.path,()=>{});
            console.error('[pharmacy] upload rx:', err);
            res.status(500).json({ message:'Server error' });
        }
    }
);

// ═══════════════════════════════════════════════════════════════════════════════
// PROTECTED — Konfirmasi order gratis (total = 0, hanya pickup)
// ═══════════════════════════════════════════════════════════════════════════════

router.put('/orders/:id/confirm-free', auth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message:'Order tidak ditemukan' });
        if (order.userId.toString()!==req.userId) return res.status(403).json({ message:'Unauthorized' });
        if (order.status!=='pending') return res.status(400).json({ message:'Order bukan status pending' });
        if (order.totalAmount>0) return res.status(400).json({ message:'Hanya untuk order total Rp 0' });

        for (const item of order.items)
            await Medicine.findByIdAndUpdate(item.medicineId, { $inc:{ stock:-item.quantity, lockedStock:-item.quantity } });

        order.status         = 'diproses';
        order.diprosesPaidAt = new Date();
        order.updatedAt      = new Date();
        await order.save();

        const io = req.app.get('io');
        await createNotification({ userId:req.userId, type:'payment_verified',
            title:'Pesanan Dikonfirmasi ✅',
            message:`Pesanan ${order.orderNumber} sedang disiapkan. Siap diambil dalam ±${PICKUP_READY_MIN} menit.`,
            data:{ orderId:order._id }, io });

        res.json({ success:true, message:'Pesanan dikonfirmasi', order });
    } catch (err) {
        console.error('[pharmacy] confirm free:', err);
        res.status(500).json({ message:'Server error' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PROTECTED — User klik selesai (terkirim atau siap_diambil)
// ═══════════════════════════════════════════════════════════════════════════════

router.put('/orders/:id/selesai', auth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message:'Order tidak ditemukan' });
        if (order.userId.toString()!==req.userId) return res.status(403).json({ message:'Unauthorized' });
        if (!['terkirim'].includes(order.status))
            return res.status(400).json({ message:'Hanya order berstatus "terkirim" yang bisa diselesaikan oleh user' });
        order.status='selesai'; order.completedAt=new Date(); order.updatedAt=new Date();
        await order.save();
        res.json({ success:true, message:'Pesanan diselesaikan', order });
    } catch (err) {
        console.error('[pharmacy] selesai:', err);
        res.status(500).json({ message:'Server error' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PROTECTED — Batalkan order (hanya fase awal)
// ═══════════════════════════════════════════════════════════════════════════════

router.put('/orders/:id/cancel', auth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message:'Order tidak ditemukan' });
        if (order.userId.toString()!==req.userId) return res.status(403).json({ message:'Unauthorized' });
        if (!['waiting_prescription','prescription_rejected','pending'].includes(order.status))
            return res.status(400).json({ message:'Pesanan tidak bisa dibatalkan di fase ini' });

        if (order.status==='pending')
            for (const item of order.items)
                await Medicine.findByIdAndUpdate(item.medicineId, { $inc:{ lockedStock:-item.quantity } });

        order.status='cancelled'; order.cancelReason=req.body.reason||'Dibatalkan pengguna';
        order.cancelledAt=new Date(); order.updatedAt=new Date();
        await order.save();
        res.json({ success:true, message:'Pesanan dibatalkan', order });
    } catch (err) {
        console.error('[pharmacy] cancel:', err);
        res.status(500).json({ message:'Server error' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PROTECTED — Get orders user
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/orders', auth, async (req, res) => {
    try {
        const orders = await Order.find({ userId:req.userId }).populate('items.medicineId').populate('paymentId').sort('-createdAt');
        res.json(orders);
    } catch { res.status(500).json({ message:'Server error' }); }
});

router.get('/orders/:id', auth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).populate('items.medicineId').populate('paymentId');
        if (!order) return res.status(404).json({ message:'Order tidak ditemukan' });
        if (order.userId.toString()!==req.userId) return res.status(403).json({ message:'Unauthorized' });
        res.json(order);
    } catch { res.status(500).json({ message:'Server error' }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN — CRUD Obat
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/admin/medicines', auth, adminAuth, async (req, res) => {
    try {
        const { search, category, page=1, limit=50 } = req.query;
        const q = {};
        if (search)   q.$or = [{ name:{ $regex:search,$options:'i' } }, { genericName:{ $regex:search,$options:'i' } }];
        if (category) q.category = category;
        const meds  = await Medicine.find(q).limit(limit*1).skip((page-1)*limit).sort('-createdAt');
        const total = await Medicine.countDocuments(q);
        res.json({ success:true, medicines:meds, totalPages:Math.ceil(total/limit), total });
    } catch { res.status(500).json({ message:'Server error' }); }
});

router.post('/admin/medicines', auth, adminAuth, async (req, res) => {
    try {
        const med = new Medicine(req.body);
        await med.save();
        res.status(201).json({ success:true, message:'Obat ditambahkan', medicine:med });
    } catch (err) { res.status(500).json({ message:err.message }); }
});

router.put('/admin/medicines/:id', auth, adminAuth, async (req, res) => {
    try {
        const med = await Medicine.findByIdAndUpdate(req.params.id, { $set:{...req.body, updatedAt:new Date()} }, { new:true, runValidators:true });
        res.json({ success:true, message:'Obat diperbarui', medicine:med });
    } catch (err) { res.status(500).json({ message:err.message }); }
});

router.delete('/admin/medicines/:id', auth, adminAuth, async (req, res) => {
    try {
        await Medicine.findByIdAndUpdate(req.params.id, { isActive:false });
        res.json({ success:true, message:'Obat dinonaktifkan' });
    } catch { res.status(500).json({ message:'Server error' }); }
});

router.post('/admin/medicines/:id/image', auth, adminAuth,
    (req,res,next) => { uploadMedImage.single('image')(req,res,err => { if(err) return res.status(400).json({ error:err.message }); next(); }); },
    async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ error:'File gambar diperlukan' });
            const med = await Medicine.findById(req.params.id);
            if (!med) return res.status(404).json({ error:'Obat tidak ditemukan' });
            if (med.image) { const old=path.join(__dirname,'..',med.image); if(fs.existsSync(old)) fs.unlinkSync(old); }
            med.image = `/uploads/medicines/${req.file.filename}`;
            await med.save();
            res.json({ success:true, image:med.image });
        } catch (err) { res.status(500).json({ error:err.message }); }
    }
);

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN — Orders
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/admin/orders', auth, adminAuth, async (req, res) => {
    try {
        const { status, page=1, limit=10 } = req.query;
        const q = {};
        if (status && status!=='all') q.status = status;
        const orders = await Order.find(q)
            .populate('userId','name email phone')
            .populate('items.medicineId')
            .populate('paymentId')
            .sort('-createdAt')
            .limit(limit*1).skip((page-1)*limit);
        const total = await Order.countDocuments(q);
        res.json({ success:true, orders, totalPages:Math.ceil(total/limit), total });
    } catch { res.status(500).json({ message:'Server error' }); }
});

// ── Admin: edit kuantitas item sebelum approve resep ─────────────────────────
router.put('/admin/orders/:id/adjust-items', auth, adminAuth, async (req, res) => {
    try {
        const { items } = req.body; // [{ medicineId, quantity }]
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message:'Order tidak ditemukan' });
        if (order.status !== 'waiting_prescription')
            return res.status(400).json({ message:'Hanya bisa edit item saat waiting_prescription' });

        for (const adj of items) {
            const idx = order.items.findIndex(i => i.medicineId.toString() === adj.medicineId);
            if (idx === -1) continue;
            const med = await Medicine.findById(adj.medicineId);
            if (!med) continue;

            const avail = (med.stock||0) - (med.lockedStock||0);
            if (adj.quantity > avail) return res.status(400).json({ message:`Stok ${med.name} tidak cukup untuk kuantitas ${adj.quantity}` });

            order.items[idx].quantity = adj.quantity;
            order.items[idx].subtotal = (order.items[idx].finalPrice || order.items[idx].price) * adj.quantity;
        }

        // Recalculate total
        order.subtotalObat = order.items.reduce((s,i) => s + (i.subtotal||0), 0);
        order.totalAmount  = order.subtotalObat + (order.shippingCost||0);
        order.updatedAt    = new Date();
        await order.save();

        // Notif user bahwa kuantitas diubah
        const io = req.app.get('io');
        await createNotification({ userId:order.userId, type:'payment_verified',
            title:'Kuantitas Obat Disesuaikan 📋',
            message:`Admin telah menyesuaikan jumlah obat di pesanan ${order.orderNumber} sesuai dosis resep. Silakan cek detail pesanan.`,
            data:{ orderId:order._id }, io });
        if (io) io.to(`user-${order.userId}`).emit('order-items-adjusted', { orderId:order._id.toString() });

        res.json({ success:true, message:'Item diperbarui', order });
    } catch (err) {
        console.error('[pharmacy] adjust items:', err);
        res.status(500).json({ message:'Server error' });
    }
});

// ── Admin: verifikasi resep ───────────────────────────────────────────────────
router.put('/admin/orders/:id/verify-prescription', auth, adminAuth, async (req, res) => {
    try {
        const { action, reason } = req.body;
        if (!['approve','reject'].includes(action))
            return res.status(400).json({ message:'action harus approve atau reject' });

        const order = await Order.findById(req.params.id).populate('userId','name email');
        if (!order) return res.status(404).json({ message:'Order tidak ditemukan' });
        if (order.status!=='waiting_prescription')
            return res.status(400).json({ message:'Order tidak dalam status menunggu verifikasi resep' });
        if (!order.prescription)
            return res.status(400).json({ message:'Belum ada resep yang diupload' });

        const io = req.app.get('io');

        if (action==='approve') {
            order.prescription.status    = 'approved';
            order.prescription.reviewedAt= new Date();
            order.prescription.reviewedBy= req.userId;
            order.updatedAt              = new Date();

            if (order.totalAmount === 0) {
                // Gratis — kurangi stok langsung, skip payment step
                for (const item of order.items)
                    await Medicine.findByIdAndUpdate(item.medicineId, { $inc:{ stock:-item.quantity } });
                order.status         = 'diproses';
                order.diprosesPaidAt = new Date();
                await order.save();
                await createNotification({ userId:order.userId._id, type:'payment_verified',
                    title:'Resep Disetujui & Pesanan Diproses ✅',
                    message:`Resep pesanan ${order.orderNumber} disetujui. Karena total Rp 0, pesanan langsung diproses.`,
                    data:{ orderId:order._id }, io });
            } else {
                // Ada biaya — lock stok 15 menit, tunggu pembayaran
                const lockExpiry = new Date(Date.now() + PAYMENT_LOCK_MIN*60000);
                for (const item of order.items)
                    await Medicine.findByIdAndUpdate(item.medicineId, { $inc:{ lockedStock:item.quantity }, $set:{ stockLockExpiry:lockExpiry } });
                order.status          = 'pending';
                order.paymentExpiry   = lockExpiry;
                order.stockLockExpiry = lockExpiry;
                await order.save();
                await createNotification({ userId:order.userId._id, type:'payment_verified',
                    title:'Resep Disetujui ✅',
                    message:`Resep pesanan ${order.orderNumber} disetujui. Silakan lanjutkan pembayaran dalam 15 menit.`,
                    data:{ orderId:order._id }, io });
            }
            if (io) io.to(`user-${order.userId._id}`).emit('prescription-verified', { orderId:order._id.toString(), status:'approved' });

        } else {
            order.prescription.status         = 'rejected';
            order.prescription.rejectedReason = reason||'Resep tidak valid';
            order.prescription.reviewedAt     = new Date();
            order.prescription.reviewedBy     = req.userId;
            order.status                      = 'prescription_rejected';
            order.updatedAt                   = new Date();
            await order.save();

            await createNotification({ userId:order.userId._id, type:'payment_verified',
                title:'Resep Ditolak ❌',
                message:`Resep pesanan ${order.orderNumber} ditolak. Alasan: ${reason||'Resep tidak valid'}. Silakan upload ulang resep yang valid.`,
                data:{ orderId:order._id }, io });
            if (io) io.to(`user-${order.userId._id}`).emit('prescription-verified', { orderId:order._id.toString(), status:'rejected', reason });
        }

        res.json({ success:true, message:action==='approve'?'Resep disetujui':'Resep ditolak', order });
    } catch (err) {
        console.error('[pharmacy] verify rx:', err);
        res.status(500).json({ message:'Server error' });
    }
});

// ── Admin: update status order ────────────────────────────────────────────────
router.put('/admin/orders/:id/status', auth, adminAuth, async (req, res) => {
    try {
        const { status } = req.body;
        const order = await Order.findById(req.params.id).populate('userId','name email');
        if (!order) return res.status(404).json({ message:'Order tidak ditemukan' });

        const isPickup = order.deliveryMethod==='pickup';
        const validTransitions = {
            'paid'         : ['diproses'],
            'diproses'     : isPickup ? ['siap_diambil'] : ['dikirim'],
            'dikirim'      : ['terkirim'],
            'terkirim'     : ['selesai'],
            'siap_diambil' : ['selesai'],
        };

        const allowed = validTransitions[order.status];
        if (!allowed||!allowed.includes(status))
            return res.status(400).json({ message:`Tidak bisa ubah dari "${order.status}" ke "${status}"` });

        const io  = req.app.get('io');
        const now = new Date();
        const prevStatus = order.status; // simpan sebelum diubah
        order.status    = status;
        order.updatedAt = now;

        if (status==='diproses' && isPickup) order.diprosesPaidAt = now;
        if (status==='terkirim') order.terkirimAt = now;
        if (status==='selesai')  order.completedAt = now;
        if (status==='cancelled') {
            order.cancelledAt  = now;
            order.cancelReason = 'Dibatalkan oleh admin';
            // Stok sudah dikurangi permanent saat xendit paid →
            // kembalikan jika cancel dari: paid, diproses, dikirim, terkirim, siap_diambil
            const needsStockReturn = ['paid','diproses','dikirim','terkirim','siap_diambil'].includes(prevStatus);
            if (needsStockReturn) {
                for (const item of order.items)
                    await Medicine.findByIdAndUpdate(item.medicineId, { $inc:{ stock: item.quantity } });
            }
        }
        await order.save();

        const notifMap = {
            diproses    : { title:'Pesanan Diproses 📦',       msg:`Pesanan ${order.orderNumber} sedang disiapkan apoteker.` },
            dikirim     : { title:'Pesanan Dikirim 🏍️',        msg:`Pesanan ${order.orderNumber} sedang dalam perjalanan. Estimasi 1–2 hari kerja.` },
            terkirim    : { title:'Pesanan Sudah Tiba 📬',     msg:`Pesanan ${order.orderNumber} sudah tiba. Silakan konfirmasi penerimaan.` },
            siap_diambil: { title:'Obat Siap Diambil 🏥',      msg:`Pesanan ${order.orderNumber} siap diambil di Klinik Pratama IPB.` },
            selesai     : { title:'Pesanan Selesai ✅',         msg:`Pesanan ${order.orderNumber} selesai.` },
            cancelled   : { title:'Pesanan Dibatalkan',         msg:`Pesanan ${order.orderNumber} dibatalkan oleh admin.` },
        };
        if (notifMap[status]) {
            await createNotification({ userId:order.userId._id, type:'order_shipped',
                title:notifMap[status].title, message:notifMap[status].msg,
                data:{ orderId:order._id }, io });
            if (io) io.to(`user-${order.userId._id}`).emit('order-status-update', { orderId:order._id.toString(), status });
        }

        res.json({ success:true, message:'Status diperbarui', order });
    } catch (err) {
        console.error('[pharmacy] update status:', err.message, err.stack);
        res.status(500).json({ message: err.message || 'Server error' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// REFUND FARMASI
// ═══════════════════════════════════════════════════════════════════════════════

/**
/**
 * POST /pharmacy/orders/:id/refund-request
 *
 * DUA SKENARIO:
 * 1. Status 'paid' & belum 1 jam → refund langsung otomatis via Xendit, tanpa video
 * 2. Status 'terkirim' atau 'selesai' → upload video bukti, review admin dulu
 */
router.post('/orders/:id/refund-request',
    auth,
    (req, res, next) => {
        // Hanya proses upload video jika bukan refund langsung
        // Kita cek status order dulu sebelum memutuskan apakah perlu multer
        uploadRefundVideo.single('video')(req, res, (err) => {
            if (err && err.code !== 'LIMIT_UNEXPECTED_FILE') return next(err);
            next();
        });
    },
    async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
        if (order.userId.toString() !== req.userId)
            return res.status(403).json({ message: 'Akses ditolak' });

        const { reason } = req.body;

        // ── SKENARIO 1: paid & belum 1 jam → refund langsung, tanpa video ──
        if (order.status === 'paid') {
            const paidAt  = order.updatedAt || order.createdAt;
            const elapsed = Date.now() - new Date(paidAt).getTime();
            if (elapsed > 60 * 60 * 1000) {
                return res.status(400).json({ message: 'Batas refund langsung adalah 1 jam setelah pembayaran. Untuk refund barang yang sudah diterima, pilih opsi refund dengan video bukti.' });
            }

            // Proses refund otomatis via Xendit
            const XENDIT_SECRET_KEY = process.env.XENDIT_SECRET_KEY;
            const headers = {
                Authorization : 'Basic ' + Buffer.from(XENDIT_SECRET_KEY + ':').toString('base64'),
                'Content-Type': 'application/json',
            };
            const amount = order.totalAmount;
            let refunded = false;
            let refundMethod = null;

            // Cari xendit invoice id
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
                        { headers: { ...headers, 'idempotency-key': `REFUND-ORDER-${order._id}-${Date.now()}` } }
                    );
                    order.refund = { xenditRefundId: r.data.id, method: 'xendit_refund', processedAt: new Date(), reason: reason?.trim() || 'Dibatalkan oleh pasien' };
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
                // Tidak bisa refund otomatis (e-wallet/QRIS) → perlu data rekening
                const { bankCode, accountNumber, accountName } = req.body;
                if (!bankCode || !accountNumber || !accountName) {
                    return res.status(200).json({
                        success: true, needsBankInfo: true,
                        message: 'Metode pembayaran tidak mendukung refund otomatis. Masukkan data rekening bank untuk menerima refund.',
                    });
                }
                const r = await axios.post('https://api.xendit.co/disbursements',
                    { external_id: `DISB-ORDER-${order._id}-${Date.now()}`, bank_code: bankCode, account_holder_name: accountName, account_number: accountNumber, description: `Refund pesanan ${order.orderNumber}`, amount },
                    { headers: { ...headers, 'X-IDEMPOTENCY-KEY': `DISB-ORDER-${order._id}-${Date.now()}` } }
                );
                order.refund = { xenditDisbursementId: r.data.id, method: 'xendit_disbursement', bankCode, accountNumber, accountName, processedAt: new Date(), reason: reason?.trim() || 'Dibatalkan oleh pasien' };
                refundMethod = 'xendit_disbursement';
            }

            order.status = 'refunded';
            await order.save();

            const eta = refundMethod === 'xendit_refund' ? 'beberapa menit' : '1x24 jam';
            await createNotification({
                userId  : order.userId,
                type    : 'refund_processed',
                title   : '💰 Refund Berhasil',
                message : `Refund pesanan ${order.orderNumber} sebesar Rp ${amount.toLocaleString('id-ID')} sedang diproses dan akan masuk dalam ${eta}. Catatan: biaya payment gateway tidak termasuk.`,
                data    : { orderId: order._id },
                io      : req.app.get('io'),
            });

            return res.json({ success: true, message: `Refund berhasil diproses. Dana akan masuk dalam ${eta}.`, method: refundMethod, order });
        }

        // ── SKENARIO 2: terkirim / selesai → upload video, review admin ──
        if (!['terkirim', 'selesai'].includes(order.status)) {
            return res.status(400).json({ message: `Refund dengan video hanya bisa untuk pesanan yang sudah diterima (terkirim/selesai). Status saat ini: ${order.status}` });
        }

        // Batas 1 hari setelah terkirim/selesai
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
        order.refund = {
            videoUrl      : req.file.path,
            videoPublicId : req.file.filename,
            reason        : reason.trim(),
            requestedAt   : new Date(),
        };
        await order.save();

        const admins = await User.find({ role: 'admin' }).select('_id');
        for (const admin of admins) {
            await createNotification({
                userId  : admin._id,
                type    : 'refund_requested',
                title   : '🎥 Refund Farmasi — Perlu Review',
                message : `Pesanan ${order.orderNumber} mengajukan refund barang tidak sesuai. Tinjau video bukti.`,
                data    : { orderId: order._id },
                io      : req.app.get('io'),
            });
        }

        return res.json({ success: true, message: 'Pengajuan refund berhasil dikirim. Admin akan meninjau dalam 1×24 jam.', order });
    } catch (err) {
        console.error('[pharmacy refund-request]', err.response?.data || err.message);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

/**
 * PUT /pharmacy/admin/orders/:id/refund-review
 * Admin approve atau reject pengajuan refund.
 * Body: { action: 'approve'|'reject', rejectReason?, bankCode?, accountNumber?, accountName? }
 */
router.put('/admin/orders/:id/refund-review', auth, adminAuth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).populate('userId', 'name');
        if (!order) return res.status(404).json({ message: 'Pesanan tidak ditemukan' });
        if (order.status !== 'refund_requested')
            return res.status(400).json({ message: 'Status harus refund_requested' });

        const { action, rejectReason, bankCode, accountNumber, accountName } = req.body;
        if (!['approve', 'reject'].includes(action))
            return res.status(400).json({ message: 'action harus approve atau reject' });

        if (action === 'reject') {
            order.status = 'refund_rejected';
            order.refund.reviewedAt = new Date();
            order.refund.reviewedBy = req.userId;
            order.refund.rejectReason = rejectReason || 'Tidak memenuhi syarat refund';
            await order.save();

            await createNotification({
                userId  : order.userId._id,
                type    : 'refund_processed',
                title   : '❌ Refund Ditolak',
                message : `Refund pesanan ${order.orderNumber} ditolak. Alasan: ${order.refund.rejectReason}`,
                data    : { orderId: order._id },
                io      : req.app.get('io'),
            });
            return res.json({ success: true, message: 'Refund ditolak', order });
        }

        // ── APPROVE → proses refund via Xendit ───────────────────────────────
        // Cek metode pembayaran: cari Payment record
        const Payment = require('../models/Payment');
        const payment = await Payment.findOne({ referenceId: order._id });
        const xenditExternalId = order.xenditExternalId;

        const XENDIT_SECRET_KEY = process.env.XENDIT_SECRET_KEY;
        const headers = {
            Authorization : 'Basic ' + Buffer.from(XENDIT_SECRET_KEY + ':').toString('base64'),
            'Content-Type': 'application/json',
        };
        const amount = order.totalAmount;

        // Cek apakah bisa Xendit Refund API (invoice < 7 hari)
        let refunded = false;
        let refundMethod = null;

        // Cari xendit invoice id
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
                    { headers: { ...headers, 'idempotency-key': `REFUND-ORDER-${order._id}-${Date.now()}` } }
                );
                order.refund.xenditRefundId = r.data.id;
                refundMethod = 'xendit_refund';
                refunded = true;
            } catch (xenditErr) {
                const errCode = xenditErr.response?.data?.error_code;
                // REFUND_NOT_SUPPORTED → fallback disbursement
                if (!['REFUND_NOT_SUPPORTED', 'CHANNEL_NOT_SUPPORTED'].includes(errCode)) {
                    console.error('[pharmacy refund] Xendit Refund error:', xenditErr.response?.data);
                }
            }
        }

        // Fallback: Xendit Disbursement (e-wallet / channel tidak support refund)
        if (!refunded) {
            if (!bankCode || !accountNumber || !accountName) {
                return res.status(400).json({
                    needsBankInfo: true,
                    message: 'Metode pembayaran tidak mendukung refund otomatis. Masukkan data rekening untuk disbursement.',
                });
            }
            const r = await axios.post('https://api.xendit.co/disbursements',
                {
                    external_id          : `DISB-ORDER-${order._id}-${Date.now()}`,
                    bank_code            : bankCode,
                    account_holder_name  : accountName,
                    account_number       : accountNumber,
                    description          : `Refund pesanan ${order.orderNumber}`,
                    amount,
                },
                { headers: { ...headers, 'X-IDEMPOTENCY-KEY': `DISB-ORDER-${order._id}-${Date.now()}` } }
            );
            order.refund.xenditDisbursementId = r.data.id;
            order.refund.bankCode      = bankCode;
            order.refund.accountNumber = accountNumber;
            order.refund.accountName   = accountName;
            refundMethod = 'xendit_disbursement';
        }

        order.status = 'refunded';
        order.refund.method      = refundMethod;
        order.refund.reviewedAt  = new Date();
        order.refund.reviewedBy  = req.userId;
        order.refund.processedAt = new Date();
        await order.save();

        const eta = refundMethod === 'xendit_refund' ? 'beberapa menit' : '1x24 jam';
        await createNotification({
            userId  : order.userId._id,
            type    : 'refund_processed',
            title   : '💰 Refund Disetujui',
            message : `Refund pesanan ${order.orderNumber} sebesar Rp ${amount.toLocaleString('id-ID')} sedang diproses dan akan masuk dalam ${eta}. Catatan: biaya payment gateway tidak termasuk dalam refund.`,
            data    : { orderId: order._id },
            io      : req.app.get('io'),
        });

        res.json({ success: true, method: refundMethod, amount, order });
    } catch (err) {
        console.error('[pharmacy refund-review]', err.response?.data || err.message);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

/**
 * GET /pharmacy/admin/orders/refund-requests
 * Admin lihat semua pesanan yang sedang menunggu review refund.
 */
router.get('/admin/orders/refund-requests', auth, adminAuth, async (req, res) => {
    try {
        const orders = await Order.find({ status: 'refund_requested' })
            .populate('userId', 'name email phone')
            .sort('-refund.requestedAt');
        res.json({ success: true, orders });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;