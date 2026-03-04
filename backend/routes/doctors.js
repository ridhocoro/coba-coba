const express = require('express');
const router = express.Router();
const Doctor = require('../models/Doctor');
const User = require('../models/User');
const auth = require('../middleware/auth');
const doctorAuth = require('../middleware/doctorAuth');

// ══════════════════════════════════════════════════════════════════
// ROUTE STATIS — HARUS di atas /:id agar tidak tertimpa
// ══════════════════════════════════════════════════════════════════

// ✅ FIX UTAMA: GET profil dokter yang sedang login
// Frontend (DoctorHome & DoctorDashboard) memanggil endpoint ini.
// Sebelumnya endpoint ini TIDAK ADA → selalu 404 → noProfile = true
router.get('/my/profile', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ userId: req.userId });
        if (!doctor) {
            // Kembalikan flag needsProfile = true agar frontend bisa menampilkan
            // pesan yang tepat, tanpa throw error 404
            return res.status(404).json({
                needsProfile: true,
                message: 'Profil dokter belum terdaftar. Hubungi admin.'
            });
        }
        res.json({ success: true, doctor });
    } catch (error) {
        console.error('Error fetching doctor profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ✅ FIX: POST hubungkan profil dokter ke akun user yang sudah ada
// Frontend ManageDoctors memanggil endpoint ini via tombol "Hubungkan Akun".
// Sebelumnya endpoint ini TIDAK ADA → tombol tidak berfungsi
router.post('/admin/link-user', auth, async (req, res) => {
    try {
        if (req.userRole !== 'admin') {
            return res.status(403).json({ message: 'Akses ditolak' });
        }

        const { doctorId, userId } = req.body;
        if (!doctorId || !userId) {
            return res.status(400).json({ message: 'doctorId dan userId wajib diisi' });
        }

        // Pastikan user ada dan role-nya doctor
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });
        if (user.role !== 'doctor') {
            return res.status(400).json({ message: 'User harus memiliki role doctor' });
        }

        // Pastikan user belum terhubung ke dokter lain
        const alreadyLinked = await Doctor.findOne({ userId });
        if (alreadyLinked && alreadyLinked._id.toString() !== doctorId) {
            return res.status(400).json({ message: 'Akun user ini sudah terhubung ke dokter lain' });
        }

        const doctor = await Doctor.findByIdAndUpdate(
            doctorId,
            { $set: { userId } },
            { new: true }
        ).populate('userId', 'name email phone');

        if (!doctor) return res.status(404).json({ message: 'Dokter tidak ditemukan' });

        res.json({ success: true, message: 'Dokter berhasil dihubungkan ke akun user', doctor });
    } catch (error) {
        console.error('Error linking doctor to user:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ══════════════════════════════════════════════════════════════════
// ROUTE PUBLIK
// ══════════════════════════════════════════════════════════════════

// GET semua dokter (public)
router.get('/', async (req, res) => {
    try {
        const doctors = await Doctor.find({ isActive: true })
            .select('name specialization consultationFee rating availableDays photo bio isOnline consultationSettings');
        res.json(doctors);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET jadwal dokter (public) — harus sebelum /:id
router.get('/:id/schedule', async (req, res) => {
    try {
        const doctor = await Doctor.findById(req.params.id)
            .select('availableDays name');
        if (!doctor) return res.status(404).json({ message: 'Dokter tidak ditemukan' });
        res.json(doctor);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET dokter by ID (public)
router.get('/:id', async (req, res) => {
    try {
        const doctor = await Doctor.findById(req.params.id).select('-__v');
        if (!doctor) {
            return res.status(404).json({ message: 'Dokter tidak ditemukan' });
        }
        res.json(doctor);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ══════════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ══════════════════════════════════════════════════════════════════

// ADMIN: Tambah dokter (lewat admin panel; prefer pakai /api/admin/doctors)
router.post('/', auth, async (req, res) => {
    try {
        if (req.userRole !== 'admin') {
            return res.status(403).json({ message: 'Akses ditolak' });
        }
        const doctor = new Doctor(req.body);
        await doctor.save();
        res.status(201).json(doctor);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ADMIN: Update dokter
router.put('/:id', auth, async (req, res) => {
    try {
        if (req.userRole !== 'admin') {
            return res.status(403).json({ message: 'Akses ditolak' });
        }
        const doctor = await Doctor.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true }
        );
        if (!doctor) return res.status(404).json({ message: 'Dokter tidak ditemukan' });
        res.json(doctor);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ADMIN: Update jadwal dokter
router.put('/:id/schedule', auth, async (req, res) => {
    try {
        if (req.userRole !== 'admin') {
            return res.status(403).json({ message: 'Akses ditolak' });
        }
        const doctor = await Doctor.findByIdAndUpdate(
            req.params.id,
            { $set: { availableDays: req.body.schedule } },
            { new: true }
        );
        res.json(doctor);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ADMIN: Toggle status online/offline dokter
// PUT update consultation settings (dokter sendiri)
router.put('/my/settings', auth, doctorAuth, async (req, res) => {
    try {
        const { allowChat, allowVideoCall } = req.body;
        const doctor = await Doctor.findOne({ userId: req.userId });
        if (!doctor) return res.status(404).json({ message: 'Profil dokter tidak ditemukan' });

        // Minimal satu fitur harus aktif
        if (!allowChat && !allowVideoCall) {
            return res.status(400).json({ message: 'Minimal satu fitur konsultasi harus diaktifkan' });
        }

        doctor.consultationSettings = { allowChat, allowVideoCall };
        await doctor.save();

        res.json({ success: true, consultationSettings: doctor.consultationSettings });
    } catch (err) {
        console.error('Update settings error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// PUT update consultation settings oleh admin (target dokter tertentu via :id)
router.put('/:id/settings', auth, async (req, res) => {
    try {
        if (req.userRole !== 'admin') return res.status(403).json({ message: 'Unauthorized' });
        const { allowChat, allowVideoCall } = req.body;

        if (!allowChat && !allowVideoCall) {
            return res.status(400).json({ message: 'Minimal satu fitur konsultasi harus diaktifkan' });
        }

        const doctor = await Doctor.findByIdAndUpdate(
            req.params.id,
            { $set: { consultationSettings: { allowChat, allowVideoCall } } },
            { new: true }
        );
        if (!doctor) return res.status(404).json({ message: 'Dokter tidak ditemukan' });

        res.json({ success: true, consultationSettings: doctor.consultationSettings });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

router.put('/:id/online-status', auth, async (req, res) => {    try {
        if (req.userRole !== 'admin') {
            return res.status(403).json({ message: 'Akses ditolak' });
        }
        const doctor = await Doctor.findById(req.params.id);
        if (!doctor) return res.status(404).json({ message: 'Dokter tidak ditemukan' });

        const isOnline = req.body.isOnline !== undefined ? req.body.isOnline : !doctor.isOnline;
        doctor.isOnline = isOnline;
        await doctor.save();

        res.json({ success: true, isOnline: doctor.isOnline, doctor });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ADMIN: Hapus/nonaktifkan dokter
router.delete('/:id', auth, async (req, res) => {
    try {
        if (req.userRole !== 'admin') {
            return res.status(403).json({ message: 'Akses ditolak' });
        }
        await Doctor.findByIdAndUpdate(req.params.id, { isActive: false });
        res.json({ message: 'Dokter dinonaktifkan' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
