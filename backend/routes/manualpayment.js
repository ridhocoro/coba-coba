const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const ManualPayment = require('../models/ManualPayment');
const Consultation = require('../models/Consultation');
const Appointment = require('../models/Appointment');
const SickLetter = require('../models/SickLetter');
const Order = require('../models/Order');
const auth = require('../middleware/auth');
//const adminAuth = require('../middleware/adminAuth');

// ========== DATA BANK STATIS (TANPA DATABASE) ==========
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

const qrisAccounts = [
    {
        id: 1,
        name: 'QRIS Klinik Pratama IPB',
        qrCode: '/images/qris-klinik.png',
        merchantName: 'Klinik Pratama IPB',
        isActive: true
    }
];

// ========== KONFIGURASI UPLOAD ==========
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../uploads/proofs');
        // Buat folder jika belum ada
        const fs = require('fs');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'proof-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
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

// ========== ROUTES ==========

// GET daftar rekening tujuan (PUBLIC - TIDAK PERLU AUTH)
router.get('/bank-accounts', (req, res) => {
    console.log('📊 Bank accounts requested at:', new Date().toISOString());
    console.log('Sending banks:', bankAccounts.length);
    
    res.json({
        success: true,
        banks: bankAccounts.filter(b => b.isActive),
        qris: qrisAccounts.filter(q => q.isActive)
    });
});

// Test endpoint (PUBLIC)
router.get('/test', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Manual payment route is working!',
        time: new Date().toISOString()
    });
});

// CREATE manual payment request (PERLU AUTH)
router.post('/create', auth, async (req, res) => {
    try {
        const { amount, paymentType, referenceId, bankId } = req.body;
        
        console.log('Creating transaction:', { amount, paymentType, referenceId, bankId, userId: req.userId });
        
        // Generate transaction ID
        const transactionId = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        
        // Cari bank tujuan
        const selectedBank = bankAccounts.find(b => b.id === parseInt(bankId));
        
        if (!selectedBank) {
            return res.status(400).json({ error: 'Bank tidak ditemukan' });
        }

        // Buat record manual payment (jika model sudah ada)
        let manualPayment = null;
        try {
            const ManualPaymentModel = require('../models/ManualPayment');
            manualPayment = new ManualPaymentModel({
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
        } catch (dbError) {
            console.log('Database error (maybe model not ready):', dbError.message);
            // Lanjutkan tanpa database
        }

        res.json({
            success: true,
            transaction: {
                id: transactionId,
                bank: selectedBank,
                amount,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 jam
            }
        });

    } catch (error) {
        console.error('Manual payment error:', error);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// UPLOAD bukti transfer (PERLU AUTH)
router.post('/upload-proof/:transactionId', 
    auth, 
    upload.single('proof'), 
    async (req, res) => {
        try {
            const { transactionId } = req.params;
            const { transferDate } = req.body;
            
            console.log('Upload proof for transaction:', transactionId);
            console.log('File:', req.file);

            if (!req.file) {
                return res.status(400).json({ error: 'File tidak ditemukan' });
            }

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