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
const { cloudinary, createCloudinaryUpload } = require('../config/cloudinary');

// Logo & stempel klinik → Cloudinary
const imgUpload = createCloudinaryUpload('klinik-ipb/clinic', ['jpg','jpeg','png','webp'], 5);

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

// POST /logo — upload logo (admin) dengan auto-convert WebP → PNG
router.post('/logo', auth, adminOnly, imgUpload.single('logo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'File tidak ditemukan' });
        const s = await getSettings();
        s.logoUrl   = req.file.path || req.file.secure_url || req.file.url;
        s.updatedAt = new Date();
        await s.save();
        res.json({ success: true, logoUrl: s.logoUrl });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});


router.post('/stamp', auth, adminOnly, imgUpload.single('stamp'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'File tidak ditemukan' });
        const s = await getSettings();

        // Cloudinary: file lama otomatis tertimpa

        s.stampUrl  = req.file.path || req.file.secure_url || req.file.url;
        s.updatedAt = new Date();
        await s.save();
        res.json({ success: true, stampUrl: s.stampUrl });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router;