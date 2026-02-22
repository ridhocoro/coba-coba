    const express = require('express');
    const router = express.Router();
    const Doctor = require('../models/Doctor');
    const auth = require('../middleware/auth');

    // GET semua dokter (public)
    router.get('/', async (req, res) => {
        try {
            const doctors = await Doctor.find({ isActive: true })
                .select('name specialization consultationFee rating availableDays photo bio');
            res.json(doctors);
        } catch (error) {
            res.status(500).json({ message: 'Server error' });
        }
    });

    // GET dokter by ID (public)
    router.get('/:id', async (req, res) => {
        try {
            const doctor = await Doctor.findById(req.params.id)
                .select('-__v');
            if (!doctor) {
                return res.status(404).json({ message: 'Dokter tidak ditemukan' });
            }
            res.json(doctor);
        } catch (error) {
            res.status(500).json({ message: 'Server error' });
        }
    });

    // GET jadwal dokter (public)
    router.get('/:id/schedule', async (req, res) => {
        try {
            const doctor = await Doctor.findById(req.params.id)
                .select('availableDays name');
            res.json(doctor);
        } catch (error) {
            res.status(500).json({ message: 'Server error' });
        }
    });

    // ADMIN: Tambah dokter
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