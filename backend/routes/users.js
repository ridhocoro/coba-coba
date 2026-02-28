const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');

// GET user profile
router.get('/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT update user profile (nama, telepon, alamat)
router.put('/profile', auth, async (req, res) => {
    try {
        const { name, phone, address } = req.body;

        if (!name || !phone) {
            return res.status(400).json({ message: 'Nama dan nomor telepon wajib diisi' });
        }

        const user = await User.findByIdAndUpdate(
            req.userId,
            { $set: { name, phone, address } },
            { new: true }
        ).select('-password');

        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT ganti password
router.put('/change-password', auth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Password lama dan baru wajib diisi' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'Password baru minimal 6 karakter' });
        }

        const user = await User.findById(req.userId);
        const isMatch = await user.comparePassword(currentPassword);

        if (!isMatch) {
            return res.status(400).json({ message: 'Password lama tidak sesuai' });
        }

        user.password = newPassword;
        await user.save(); // pre-save hook di model akan hash otomatis

        res.json({ success: true, message: 'Password berhasil diubah' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;