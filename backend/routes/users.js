const express = require('express');
const router = express.Router();
const { User } = require('../models/mysql');
const auth = require('../middleware/auth');
const bcrypt = require('bcryptjs');

// GET user profile
router.get('/profile', auth, async (req, res) => {
    try {
        const user = await User.findByPk(req.userId, {
            attributes: { exclude: ['password'] }
        });
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

        let updates = { name, phone };
        if (address) {
            if (typeof address === 'string') {
                updates.addressStreet = address;
            } else {
                updates.addressStreet = address.street;
                updates.addressCity = address.city;
                updates.addressProvince = address.province;
                updates.addressPostalCode = address.postalCode;
            }
        }

        await User.update(updates, { where: { id: req.userId } });
        const user = await User.findByPk(req.userId, {
            attributes: { exclude: ['password'] }
        });

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

        if (newPassword.length < 8) {
            return res.status(400).json({ message: 'Password baru minimal 8 karakter' });
        }
        if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
            return res.status(400).json({ message: 'Password baru harus mengandung huruf besar, huruf kecil, dan angka' });
        }

        const user = await User.findByPk(req.userId);
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