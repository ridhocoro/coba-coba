const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ManualPayment = require('../models/ManualPayment');
const Consultation = require('../models/Consultation');
const auth = require('../middleware/auth');

// Bank accounts data
const bankAccounts = [
    {
        id: 1,
        bankName: 'Bank BCA',
        accountNumber: '1234567890',
        accountName: 'Klinik Pratama IPB',
        branch: 'KCU Bogor',
        isActive: true
    },
    {
        id: 2,
        bankName: 'Bank Mandiri',
        accountNumber: '123456789012',
        accountName: 'Klinik Pratama IPB',
        branch: 'KCP Darmaga',
        isActive: true
    },
    {
        id: 3,
        bankName: 'Bank BRI',
        accountNumber: '1234567890123',
        accountName: 'Klinik Pratama IPB',
        branch: 'Cabang Bogor',
        isActive: true
    },
    {
        id: 4,
        bankName: 'Bank BNI',
        accountNumber: '1234567890',
        accountName: 'Klinik Pratama IPB',
        branch: 'KCU Bogor',
        isActive: true
    }
];

// QRIS Account
const qrisAccounts = [
    {
        id: 999,
        name: 'QRIS Klinik Pratama IPB',
        qrCode: '/images/qris-klinik.png',
        merchantName: 'Klinik Pratama IPB',
        isActive: true
    }
];

// Upload configuration
const uploadDir = path.join(__dirname, '../uploads/proofs');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'proof-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Hanya file gambar (jpeg, jpg, png, gif) dan PDF yang diperbolehkan'));
        }
    }
});

// GET bank accounts (public)
router.get('/bank-accounts', (req, res) => {
    res.json({
        success: true,
        banks: bankAccounts.filter(b => b.isActive),
        qris: qrisAccounts.filter(q => q.isActive)
    });
});

// CREATE payment transaction (protected)
router.post('/create', auth, async (req, res) => {
    try {
        const { amount, paymentType, referenceId, bankId } = req.body;
        
        const transactionId = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        
        let selectedBank;
        let isQRIS = false;
        
        // Cek apakah QRIS (ID 999)
        if (parseInt(bankId) === 999) {
            isQRIS = true;
            selectedBank = {
                bankName: 'QRIS',
                accountNumber: 'QRIS',
                accountName: 'Klinik Pratama IPB'
            };
        } else {
            selectedBank = bankAccounts.find(b => b.id === parseInt(bankId));
        }
        
        if (!selectedBank) {
            return res.status(400).json({ error: 'Bank tidak ditemukan' });
        }

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

// UPLOAD payment proof (protected)
router.post('/upload-proof/:transactionId', 
    auth, 
    upload.single('proof'), 
    async (req, res) => {
        try {
            const { transactionId } = req.params;
            const { transferDate } = req.body;
            
            const manualPayment = await ManualPayment.findOne({ transactionId });
            
            if (!manualPayment) {
                return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
            }

            if (manualPayment.userId.toString() !== req.userId) {
                return res.status(403).json({ error: 'Unauthorized' });
            }

            manualPayment.transferProof = `/uploads/proofs/${req.file.filename}`;
            manualPayment.transferDate = transferDate || new Date();
            manualPayment.status = 'pending';
            
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
    }
);

module.exports = router;