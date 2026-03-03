const express = require('express');
const router = express.Router();
const ManualPayment = require('../models/ManualPayment');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Consultation = require('../models/Consultation');
const Doctor = require('../models/Doctor');
const SickLetter = require('../models/SickLetter');
const Appointment = require('../models/Appointment');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// ══════════════════════════════════════════════════════════════════
// DASHBOARD STATS dengan data harian untuk grafik
// ══════════════════════════════════════════════════════════════════
router.get('/stats', auth, adminAuth, async (req, res) => {
    try {
        const totalPatients = await User.countDocuments({ role: 'user' });
        const totalDoctors  = await Doctor.countDocuments({ isActive: true });

        const today    = new Date(); 
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today); 
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Data untuk hari ini
        const todayConsultations = await Consultation.countDocuments({
            createdAt: { $gte: today, $lt: tomorrow }
        });

        const todayPayments = await ManualPayment.find({
            status: 'verified',
            verifiedAt: { $gte: today, $lt: tomorrow }
        });
        const todayRevenue = todayPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

        const pendingSickLetters = await SickLetter.countDocuments({ status: 'draft' });

        // ═══════════════════════════════════════════════════════════
        // DATA HARIAN UNTUK 7 HARI TERAKHIR
        // ═══════════════════════════════════════════════════════════
        const dailyRevenue = {};
        const dailyConsultations = {};
        
        // Loop untuk 7 hari terakhir
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);
            
            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);
            
            const dateStr = date.toISOString().split('T')[0]; // Format YYYY-MM-DD
            
            // Hitung pendapatan per hari dari ManualPayment
            const dailyPayments = await ManualPayment.find({
                status: 'verified',
                verifiedAt: { $gte: date, $lt: nextDate }
            });
            
            dailyRevenue[dateStr] = dailyPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
            
            // Hitung jumlah konsultasi per hari
            dailyConsultations[dateStr] = await Consultation.countDocuments({
                createdAt: { $gte: date, $lt: nextDate }
            });
        }

        // Data tambahan untuk statistik lainnya
        const pendingPayments = await ManualPayment.countDocuments({ status: 'pending' });
        const totalRevenue = await ManualPayment.aggregate([
            { $match: { status: 'verified' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        res.json({
            totalPatients,
            totalDoctors,
            todayConsultations,
            todayRevenue,
            pendingSickLetters,
            pendingPayments,
            totalRevenue: totalRevenue[0]?.total || 0,
            dailyRevenue,        // Object dengan format { "2026-03-03": 500000, ... }
            dailyConsultations   // Object dengan format { "2026-03-03": 5, ... }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ══════════════════════════════════════════════════════════════════
// PAYMENT ROUTES
// ══════════════════════════════════════════════════════════════════

// GET pembayaran pending
router.get('/payments/pending', auth, adminAuth, async (req, res) => {
    try {
        const payments = await ManualPayment.find({ status: 'pending' })
            .populate('userId', 'name email phone')
            .populate({
                path: 'referenceId',
                populate: { path: 'doctorId', select: 'name specialization' }
            })
            .sort('-createdAt');

        res.json({ success: true, count: payments.length, payments });
    } catch (error) {
        console.error('Error fetching pending payments:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET semua pembayaran (dengan filter & paginasi)
router.get('/payments/all', auth, adminAuth, async (req, res) => {
    try {
        const { page = 1, limit = 10, status = 'all' } = req.query;
        const query = status !== 'all' ? { status } : {};

        const payments = await ManualPayment.find(query)
            .populate('userId', 'name email')
            .populate({
                path: 'referenceId',
                populate: { path: 'doctorId', select: 'name' }
            })
            .sort('-createdAt')
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await ManualPayment.countDocuments(query);

        res.json({
            success: true, payments,
            totalPages: Math.ceil(total / limit),
            currentPage: page, total
        });
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET statistik pembayaran (jumlah per status + total uang masuk)
router.get('/payments/stats', auth, adminAuth, async (req, res) => {
    try {
        const [pending, verified, rejected, allVerified] = await Promise.all([
            ManualPayment.countDocuments({ status: 'pending' }),
            ManualPayment.countDocuments({ status: 'verified' }),
            ManualPayment.countDocuments({ status: 'rejected' }),
            ManualPayment.find({ status: 'verified' })
        ]);

        const totalAmount = allVerified.reduce((sum, p) => sum + (p.amount || 0), 0);

        res.json({
            success: true,
            stats: { pending, verified, rejected, totalVerified: verified, totalAmount }
        });
    } catch (error) {
        console.error('Error fetching payment stats:', error);
        res.json({
            success: true,
            stats: { pending: 0, verified: 0, rejected: 0, totalVerified: 0, totalAmount: 0 }
        });
    }
});

// GET pending count saja (untuk badge navbar)
router.get('/payments/pending-count', auth, adminAuth, async (req, res) => {
    try {
        const count = await ManualPayment.countDocuments({ status: 'pending' });
        res.json({ count });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// GET detail satu pembayaran
router.get('/payments/:id', auth, adminAuth, async (req, res) => {
    try {
        const payment = await ManualPayment.findById(req.params.id)
            .populate('userId', 'name email phone address')
            .populate({
                path: 'referenceId',
                populate: { path: 'doctorId', select: 'name specialization' }
            });

        if (!payment) return res.status(404).json({ error: 'Payment not found' });
        res.json({ success: true, payment });
    } catch (error) {
        console.error('Error fetching payment:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT verifikasi / tolak pembayaran
router.put('/payments/:id/verify', auth, adminAuth, async (req, res) => {
    try {
        const { status, notes } = req.body;
        const payment = await ManualPayment.findById(req.params.id);
        if (!payment) return res.status(404).json({ error: 'Payment not found' });

        payment.status      = status;
        payment.adminNotes  = notes || '';
        payment.verifiedAt  = new Date();
        payment.verifiedBy  = req.userId;
        await payment.save();

        // Update status konsultasi / order setelah verified
        if (status === 'verified') {
            if (payment.paymentType === 'consultation') {
                const consultation = await Consultation.findById(payment.referenceId);
                if (consultation) {
                    consultation.paymentVerified = true;
                    consultation.verifiedAt = new Date();
                    if (consultation.scheduleType === 'scheduled') {
                        consultation.status = 'scheduled';
                    } else {
                        consultation.status = 'ongoing';
                        consultation.startTime = new Date();
                    }
                    await consultation.save();
                }
            }
        }

        if (status === 'rejected' && payment.paymentType === 'consultation') {
            await Consultation.findByIdAndUpdate(payment.referenceId, {
                status: 'rejected_payment',
                rejectedAt: new Date(),
                rejectionReason: notes || 'Bukti transfer tidak valid'
            });
        }

        res.json({
            success: true,
            message: `Payment ${status === 'verified' ? 'diverifikasi' : 'ditolak'}`,
            payment
        });
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ══════════════════════════════════════════════════════════════════
// MANAJEMEN DOKTER
// ══════════════════════════════════════════════════════════════════

router.get('/doctors', auth, adminAuth, async (req, res) => {
    try {
        const doctors = await Doctor.find({})
            .populate('userId', 'name email phone')
            .sort('-createdAt');
        res.json({ success: true, doctors });
    } catch (error) {
        console.error('Error fetching doctors:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/doctors', auth, adminAuth, async (req, res) => {
    try {
        const { name, specialization, qualification, experience,
                consultationFee, bio, availableDays, email, password, phone } = req.body;

        if (!name || !specialization || !consultationFee || !email || !password) {
            return res.status(400).json({ error: 'Nama, spesialisasi, biaya konsultasi, email, dan password wajib diisi' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ error: 'Email sudah terdaftar' });

        const userDoc = new User({ name, email, password, phone: phone || '-', role: 'doctor' });
        await userDoc.save();

        const doctor = new Doctor({
            userId: userDoc._id, name, specialization,
            qualification: qualification || '', experience: experience || 0,
            consultationFee, bio: bio || '', availableDays: availableDays || [], isActive: true
        });
        await doctor.save();

        res.status(201).json({ success: true, message: 'Dokter berhasil ditambahkan', doctor });
    } catch (error) {
        console.error('Error adding doctor:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/doctors/:id', auth, adminAuth, async (req, res) => {
    try {
        const { name, specialization, qualification, experience,
                consultationFee, bio, availableDays, isActive, phone } = req.body;

        const doctor = await Doctor.findByIdAndUpdate(
            req.params.id,
            { $set: { name, specialization, qualification, experience, consultationFee, bio, availableDays, isActive } },
            { new: true }
        );
        if (!doctor) return res.status(404).json({ error: 'Dokter tidak ditemukan' });

        if (doctor.userId) {
            await User.findByIdAndUpdate(doctor.userId, { $set: { name, ...(phone && { phone }) } });
        }

        res.json({ success: true, message: 'Data dokter berhasil diperbarui', doctor });
    } catch (error) {
        console.error('Error updating doctor:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT toggle aktif/nonaktif dokter
router.put('/doctors/:id/toggle-status', auth, adminAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findById(req.params.id);
        if (!doctor) return res.status(404).json({ error: 'Dokter tidak ditemukan' });

        doctor.isActive = !doctor.isActive;
        await doctor.save();

        res.json({
            success: true,
            message: `Dokter ${doctor.isActive ? 'diaktifkan' : 'dinonaktifkan'}`,
            isActive: doctor.isActive
        });
    } catch (error) {
        console.error('Error toggling doctor status:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE hapus dokter permanen
router.delete('/doctors/:id', auth, adminAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findById(req.params.id);
        if (!doctor) return res.status(404).json({ error: 'Dokter tidak ditemukan' });

        if (doctor.userId) await User.findByIdAndDelete(doctor.userId);
        await Doctor.findByIdAndDelete(req.params.id);

        res.json({ success: true, message: 'Dokter berhasil dihapus' });
    } catch (error) {
        console.error('Error deleting doctor:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ══════════════════════════════════════════════════════════════════
// KONSULTASI, JANJI TEMU, SURAT SAKIT, USERS, TRANSAKSI
// ══════════════════════════════════════════════════════════════════

router.get('/consultations', auth, adminAuth, async (req, res) => {
    try {
        const consultations = await Consultation.find({})
            .populate('userId', 'name email phone')
            .populate('doctorId', 'name specialization consultationFee')
            .populate({ path: 'sickLetter', select: 'status letterNumber diagnosis' })
            .sort('-createdAt');
        res.json(consultations);
    } catch (error) {
        console.error('Error fetching consultations:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/consultations/:id/end', auth, adminAuth, async (req, res) => {
    try {
        const consultation = await Consultation.findByIdAndUpdate(
            req.params.id, { status: 'completed', endTime: new Date() }, { new: true }
        );
        if (!consultation) return res.status(404).json({ error: 'Konsultasi tidak ditemukan' });
        res.json({ success: true, message: 'Konsultasi diselesaikan', consultation });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/sick-letters', auth, adminAuth, async (req, res) => {
    try {
        const sickLetters = await SickLetter.find({})
            .populate('userId', 'name email')
            .populate('doctorId', 'name')
            .populate('consultationId', 'symptoms createdAt')
            .sort('-createdAt');
        res.json(sickLetters);
    } catch (error) {
        console.error('Error fetching sick letters:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/sick-letters/:id/approve', auth, adminAuth, async (req, res) => {
    try {
        const sickLetter = await SickLetter.findByIdAndUpdate(
            req.params.id,
            { status: 'issued', issuedAt: new Date() },
            { new: true, runValidators: false }
        );
        if (!sickLetter) return res.status(404).json({ error: 'Surat sakit tidak ditemukan' });
        res.json({ success: true, message: 'Surat sakit diterbitkan', sickLetter });
    } catch (error) {
        console.error('Error approving sick letter:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/appointments', auth, adminAuth, async (req, res) => {
    try {
        const appointments = await Appointment.find({})
            .populate('userId', 'name email phone')
            .populate('doctorId', 'name specialization')
            .sort('-appointmentDate');
        res.json(appointments);
    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/appointments/:id/check-in', auth, adminAuth, async (req, res) => {
    try {
        const appointment = await Appointment.findByIdAndUpdate(
            req.params.id,
            { status: 'checked_in', checkedInAt: new Date() },
            { new: true }
        );
        if (!appointment) return res.status(404).json({ error: 'Janji tidak ditemukan' });
        res.json({ success: true, message: 'Pasien berhasil di-check-in', appointment });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/appointments/:id/confirm', auth, adminAuth, async (req, res) => {
    try {
        const appointment = await Appointment.findByIdAndUpdate(
            req.params.id, { status: 'confirmed' }, { new: true }
        );
        if (!appointment) return res.status(404).json({ error: 'Janji tidak ditemukan' });
        res.json({ success: true, message: 'Janji temu dikonfirmasi', appointment });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/appointments/:id/cancel', auth, adminAuth, async (req, res) => {
    try {
        const appointment = await Appointment.findByIdAndUpdate(
            req.params.id, { status: 'cancelled' }, { new: true }
        );
        if (!appointment) return res.status(404).json({ error: 'Janji tidak ditemukan' });
        res.json({ success: true, message: 'Janji temu dibatalkan', appointment });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/users', auth, adminAuth, async (req, res) => {
    try {
        const users = await User.find({}).select('-password').sort('-createdAt');
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

router.put('/users/:id/toggle-status', auth, adminAuth, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });
        if (user.role === 'admin') return res.status(400).json({ message: 'Tidak bisa menonaktifkan admin' });

        user.isActive = !user.isActive;
        await user.save();
        res.json({ success: true, message: `User ${user.isActive ? 'diaktifkan' : 'dinonaktifkan'}`, user });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/transactions', auth, adminAuth, async (req, res) => {
    try {
        const transactions = await ManualPayment.find({})
            .populate('userId', 'name email')
            .populate({
                path: 'referenceId',
                populate: { path: 'doctorId', select: 'name' }
            })
            .sort('-createdAt');
        res.json(transactions);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;