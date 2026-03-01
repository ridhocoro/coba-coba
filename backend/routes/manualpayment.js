const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ManualPayment = require('../models/ManualPayment');
const Consultation = require('../models/Consultation');
const Order = require('../models/Order');
const auth = require('../middleware/auth');
const { createNotification } = require('../utils/notificationHelper');

// ─── Bank accounts data ───────────────────────────────────────────────────────
const bankAccounts = [
    { id: 1, bankName: 'Bank BCA',     accountNumber: '1234567890',    accountName: 'Klinik Pratama IPB', branch: 'KCU Bogor',    isActive: true },
    { id: 2, bankName: 'Bank Mandiri', accountNumber: '123456789012',  accountName: 'Klinik Pratama IPB', branch: 'KCP Darmaga', isActive: true },
    { id: 3, bankName: 'Bank BRI',     accountNumber: '1234567890123', accountName: 'Klinik Pratama IPB', branch: 'Cabang Bogor', isActive: true },
    { id: 4, bankName: 'Bank BNI',     accountNumber: '1234567890',    accountName: 'Klinik Pratama IPB', branch: 'KCU Bogor',   isActive: true }
];

const qrisAccounts = [
    { id: 999, name: 'QRIS Klinik Pratama IPB', qrCode: '/images/qris-klinik.png', merchantName: 'Klinik Pratama IPB', isActive: true }
];

// ─── Multer upload config ─────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, '../uploads/proofs');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'proof-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|pdf/;
        if (allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype)) {
            return cb(null, true);
        }
        cb(new Error('Hanya file gambar (jpeg, jpg, png, gif) dan PDF yang diperbolehkan'));
    }
});

// ─── GET bank accounts (public) ───────────────────────────────────────────────
router.get('/bank-accounts', (req, res) => {
    res.json({
        success: true,
        banks: bankAccounts.filter(b => b.isActive),
        qris:  qrisAccounts.filter(q => q.isActive)
    });
});

// ─── POST create payment transaction ─────────────────────────────────────────
router.post('/create', auth, async (req, res) => {
    try {
        const { amount, paymentType, referenceId, bankId } = req.body;

        const transactionId = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

        let selectedBank;
        let isQRIS = false;

        if (parseInt(bankId) === 999) {
            isQRIS = true;
            selectedBank = { bankName: 'QRIS', accountNumber: 'QRIS', accountName: 'Klinik Pratama IPB' };
        } else {
            selectedBank = bankAccounts.find(b => b.id === parseInt(bankId));
        }

        if (!selectedBank) return res.status(400).json({ error: 'Bank tidak ditemukan' });

        const manualPayment = new ManualPayment({
            userId: req.userId,
            transactionId,
            amount,
            paymentType,
            referenceId,
            bankName: selectedBank.bankName,
            accountNumber: selectedBank.accountNumber,
            accountName: selectedBank.accountName,
            status: 'pending'
        });

        await manualPayment.save();

        // Update status konsultasi menjadi waiting_payment
        if (paymentType === 'consultation') {
            await Consultation.findByIdAndUpdate(referenceId, {
                status: 'waiting_payment',
                paymentId: manualPayment._id
            });
        }

        res.json({
            success: true,
            transaction: {
                id: transactionId,
                bank: selectedBank,
                amount,
                isQRIS,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
            }
        });

    } catch (error) {
        console.error('Manual payment error:', error);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// ─── POST upload payment proof ────────────────────────────────────────────────
router.post('/upload-proof/:transactionId', auth, upload.single('proof'), async (req, res) => {
    try {
        const { transactionId } = req.params;
        const { transferDate } = req.body;

        const manualPayment = await ManualPayment.findOne({ transactionId });
        if (!manualPayment) return res.status(404).json({ error: 'Transaksi tidak ditemukan' });

        if (manualPayment.userId.toString() !== req.userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        if (!req.file) return res.status(400).json({ error: 'File bukti transfer diperlukan' });

        manualPayment.transferProof = `/uploads/proofs/${req.file.filename}`;
        manualPayment.transferDate  = transferDate || new Date();
        manualPayment.status        = 'pending';
        await manualPayment.save();

        res.json({
            success: true,
            message: 'Bukti transfer berhasil diupload, menunggu verifikasi admin',
            file: req.file.filename
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// ─── GET riwayat pembayaran user (tanpa populate) ─────────────────────────────
router.get('/my-history', auth, async (req, res) => {
    try {
        const payments = await ManualPayment.find({ userId: req.userId }).sort('-createdAt');
        res.json({ success: true, payments });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── GET riwayat pembayaran user (dengan populate) ────────────────────────────
// FIX: route ini sekarang berada SEBELUM module.exports agar aktif
router.get('/history', auth, async (req, res) => {
    try {
        const payments = await ManualPayment.find({ userId: req.userId })
            .populate({
                path: 'referenceId',
                populate: { path: 'doctorId', select: 'name specialization' }
            })
            .sort('-createdAt');

        res.json({ success: true, payments });
    } catch (error) {
        console.error('Error fetching payment history:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── Admin: GET semua pending manual payment ──────────────────────────────────
router.get('/admin/pending', auth, async (req, res) => {
    try {
        if (req.userRole !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
        const payments = await ManualPayment.find({ status: 'pending' })
            .populate('userId', 'name email phone')
            .sort('-createdAt');
        res.json({ success: true, payments });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── Admin: PUT verifikasi/tolak pembayaran ───────────────────────────────────
// FIX: setelah verified, consultation status diset ke 'ongoing' (bukan 'paid'),
//      dan notifikasi dikirim ke user
router.put('/admin/verify/:paymentId', auth, async (req, res) => {
    try {
        if (req.userRole !== 'admin') return res.status(403).json({ error: 'Unauthorized' });

        const { status, notes } = req.body;
        const payment = await ManualPayment.findById(req.params.paymentId).populate('userId', '_id name');
        if (!payment) return res.status(404).json({ error: 'Pembayaran tidak ditemukan' });

        payment.status     = status;
        payment.adminNotes = notes || '';
        payment.verifiedAt = new Date();
        payment.verifiedBy = req.userId;
        await payment.save();

        if (status === 'verified') {
            // FIX: set consultation ke 'ongoing' agar dokter langsung bisa mulai chat
            if (payment.paymentType === 'consultation') {
                await Consultation.findByIdAndUpdate(payment.referenceId, {
                    status: 'ongoing',
                    paymentVerified: true,
                    verifiedAt: new Date()
                });
            }

            // Update status order farmasi
            // FIX: frontend mengirim paymentType 'medicine', bukan 'pharmacy'
            if (payment.paymentType === 'medicine') {
                await Order.findByIdAndUpdate(payment.referenceId, {
                    status: 'processing',
                    paymentVerified: true
                });
            }

            // Kirim notifikasi ke user
            const userId = payment.userId?._id || payment.userId;
            await createNotification({
                userId,
                type: 'payment_verified',
                title: 'Pembayaran Dikonfirmasi ✅',
                message: `Pembayaran Anda sebesar Rp ${(payment.amount || 0).toLocaleString('id-ID')} telah diverifikasi. ${
                    payment.paymentType === 'consultation'
                        ? 'Konsultasi Anda sudah aktif, silakan mulai chat dengan dokter.'
                        : 'Pesanan obat Anda sedang diproses.'
                }`,
                data: { paymentId: payment._id },
                io: req.app.get('io')
            });
        }

        if (status === 'rejected') {
            // Kirim notifikasi penolakan ke user
            const userId = payment.userId?._id || payment.userId;
            await createNotification({
                userId,
                type: 'payment_verified',
                title: 'Pembayaran Ditolak ❌',
                message: `Pembayaran Anda ditolak. Alasan: ${notes || 'Bukti transfer tidak valid'}. Silakan upload ulang bukti transfer.`,
                data: { paymentId: payment._id },
                io: req.app.get('io')
            });
        }

        res.json({
            success: true,
            message: `Pembayaran ${status === 'verified' ? 'diverifikasi' : 'ditolak'}`,
            payment
        });
    } catch (error) {
        console.error('Verify payment error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
