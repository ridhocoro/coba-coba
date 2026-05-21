/**
 * routes/clinicSettings.js  ← VERSI LENGKAP dengan Redis caching
 *
 * Perubahan dari versi lama:
 *  + import getOrSet, invalidate, CACHE_KEYS, TTL
 *  + GET /        → dibungkus getOrSet (cache 1 jam)
 *  + PUT /        → invalidate cache setelah update
 *  + POST /logo   → invalidate cache setelah upload
 *  + POST /stamp  → invalidate cache setelah upload
 */

const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const auth     = require('../middleware/auth');
const ClinicSettings = require('../models/ClinicSettings');
const { cloudinary, createCloudinaryUpload } = require('../config/cloudinary');

// ── Redis cache helpers ───────────────────────────────────────
const { getOrSet, invalidate, CACHE_KEYS, TTL } = require('../utils/cache');

const imgUpload = createCloudinaryUpload('klinik-ipb/clinic', ['jpg','jpeg','png','webp'], 5);

const adminOnly = (req, res, next) => {
    if (req.userRole !== 'admin') return res.status(403).json({ message: 'Akses ditolak' });
    next();
};

async function getSettings() {
    let s = await ClinicSettings.findOne({ key: 'main' });
    if (!s) s = await ClinicSettings.create({ key: 'main' });
    return s;
}

// GET / — publik, cache 1 jam
router.get('/', async (req, res) => {
    try {
        const settings = await getOrSet(CACHE_KEYS.CLINIC_SETTINGS, TTL.CLINIC_SETTINGS, () => getSettings());
        res.json({ success: true, settings });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT / — update teks (admin), invalidasi cache
router.put('/', auth, adminOnly, async (req, res) => {
    try {
        const { clinicName, clinicAddress, clinicPhone, signLocation } = req.body;
        const s = await getSettings();
        if (clinicName)    s.clinicName    = clinicName.trim();
        if (clinicAddress) s.clinicAddress = clinicAddress.trim();
        if (clinicPhone !== undefined) s.clinicPhone = clinicPhone.trim();
        if (signLocation !== undefined) s.signLocation = signLocation.trim();
        s.updatedAt = new Date();
        await s.save();

        // Invalidasi cache agar GET / berikutnya ambil data terbaru
        await invalidate(CACHE_KEYS.CLINIC_SETTINGS);

        res.json({ success: true, settings: s });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /logo — upload logo (admin), invalidasi cache
router.post('/logo', auth, adminOnly, imgUpload.single('logo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'File tidak ditemukan' });
        const s = await getSettings();
        s.logoUrl   = req.file.path || req.file.secure_url || req.file.url;
        s.updatedAt = new Date();
        await s.save();

        // Invalidasi cache
        await invalidate(CACHE_KEYS.CLINIC_SETTINGS);

        res.json({ success: true, logoUrl: s.logoUrl });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// POST /stamp — upload stempel (admin), invalidasi cache
router.post('/stamp', auth, adminOnly, imgUpload.single('stamp'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'File tidak ditemukan' });
        const s = await getSettings();

        s.stampUrl  = req.file.path || req.file.secure_url || req.file.url;
        s.updatedAt = new Date();
        await s.save();

        // Invalidasi cache
        await invalidate(CACHE_KEYS.CLINIC_SETTINGS);

        res.json({ success: true, stampUrl: s.stampUrl });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router;
