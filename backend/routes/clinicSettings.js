/**
 * /api/clinic-settings
 *
 * GET  /          → ambil pengaturan klinik (publik, dipakai PDF generator)
 * PUT  /          → update nama/alamat/telepon klinik (admin)
 * POST /logo      → upload logo klinik (admin)
 * POST /stamp     → upload stempel klinik (admin)
 */

const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const auth     = require('../middleware/auth');
const ClinicSettings = require('../models/ClinicSettings');

const uploadDir = path.join(__dirname, '../uploads/clinic');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const imgStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename:    (req, file, cb) => {
        const ext  = path.extname(file.originalname).toLowerCase();
        const type = req.path.includes('stamp') ? 'stamp' : 'logo';
        cb(null, `clinic-${type}-${Date.now()}${ext}`);
    },
});

const imgUpload = multer({
    storage: imgStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (allowed.includes(file.mimetype)) cb(null, true);
        else cb(new Error('Hanya file gambar (JPG, PNG, WEBP) yang diizinkan'));
    },
});

const adminOnly = (req, res, next) => {
    if (req.userRole !== 'admin') return res.status(403).json({ message: 'Akses ditolak' });
    next();
};

// Helper: ambil atau buat settings
async function getSettings() {
    let s = await ClinicSettings.findOne({ key: 'main' });
    if (!s) s = await ClinicSettings.create({ key: 'main' });
    return s;
}

// GET / — publik
router.get('/', async (req, res) => {
    try {
        const s = await getSettings();
        res.json({ success: true, settings: s });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT / — update teks (admin)
router.put('/', auth, adminOnly, async (req, res) => {
    try {
        const { clinicName, clinicAddress, clinicPhone } = req.body;
        const s = await getSettings();
        if (clinicName)    s.clinicName    = clinicName.trim();
        if (clinicAddress) s.clinicAddress = clinicAddress.trim();
        if (clinicPhone !== undefined) s.clinicPhone = clinicPhone.trim();
        s.updatedAt = new Date();
        await s.save();
        res.json({ success: true, settings: s });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /logo — upload logo (admin)
router.post('/logo', auth, adminOnly, imgUpload.single('logo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'File tidak ditemukan' });
        const s = await getSettings();

        // Hapus file lama
        if (s.logoUrl) {
            const old = path.join(__dirname, '..', s.logoUrl.replace(/^\//, ''));
            if (fs.existsSync(old)) fs.unlinkSync(old);
        }

        s.logoUrl   = `/uploads/clinic/${req.file.filename}`;
        s.updatedAt = new Date();
        await s.save();
        res.json({ success: true, logoUrl: s.logoUrl });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// POST /stamp — upload stempel (admin)
router.post('/stamp', auth, adminOnly, imgUpload.single('stamp'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'File tidak ditemukan' });
        const s = await getSettings();

        // Hapus file lama
        if (s.stampUrl) {
            const old = path.join(__dirname, '..', s.stampUrl.replace(/^\//, ''));
            if (fs.existsSync(old)) fs.unlinkSync(old);
        }

        s.stampUrl  = `/uploads/clinic/${req.file.filename}`;
        s.updatedAt = new Date();
        await s.save();
        res.json({ success: true, stampUrl: s.stampUrl });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router;