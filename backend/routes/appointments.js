const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const User = require('../models/User');
const auth = require('../middleware/auth');
const doctorAuth = require('../middleware/doctorAuth');
const { createNotification } = require('../utils/notificationHelper');

// ══ DOCTOR ROUTES - harus SEBELUM generic /:id routes ══════════════

// GET statistik dokter (dashboard)
router.get('/doctor/stats', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ userId: req.userId });
        if (!doctor) return res.json({ success: true, stats: { todayAppointments: 0, totalPatients: 0, pendingAppointments: 0 }, todaySchedule: [] });

        const today = new Date(); today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

        const [todayAppointments, todaySchedule, uniquePatients, pendingCount] = await Promise.all([
            Appointment.countDocuments({ doctorId: doctor._id, appointmentDate: { $gte: today, $lt: tomorrow }, status: { $in: ['pending', 'confirmed'] } }),
            Appointment.find({ doctorId: doctor._id, appointmentDate: { $gte: today, $lt: tomorrow }, status: { $in: ['pending', 'confirmed'] } }).populate('userId', 'name phone').sort('appointmentTime'),
            Appointment.distinct('userId', { doctorId: doctor._id }),
            Appointment.countDocuments({ doctorId: doctor._id, status: 'pending' })
        ]);

        res.json({
            success: true,
            stats: {
                todayAppointments,
                totalPatients: uniquePatients.length,
                pendingAppointments: pendingCount
            },
            todaySchedule
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// GET all appointments for doctor
router.get('/doctor/appointments', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ userId: req.userId });
        if (!doctor) return res.json({ success: true, appointments: [] });

        const { status, date } = req.query;
        let query = { doctorId: doctor._id };
        if (status && status !== 'all') query.status = status;
        if (date) {
            const d = new Date(date);
            query.appointmentDate = {
                $gte: new Date(d.setHours(0, 0, 0, 0)),
                $lt: new Date(d.setHours(23, 59, 59, 999))
            };
        }

        const appointments = await Appointment.find(query)
            .populate('userId', 'name email phone address')
            .sort({ appointmentDate: 1, appointmentTime: 1 });

        res.json({ success: true, appointments });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// GET single appointment detail for doctor
router.get('/doctor/appointments/:id', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ userId: req.userId });
        if (!doctor) return res.status(404).json({ message: 'Profil dokter belum terdaftar. Hubungi admin.' });

        const appointment = await Appointment.findById(req.params.id)
            .populate('userId', 'name email phone address')
            .populate('doctorId');

        if (!appointment) return res.status(404).json({ message: 'Janji tidak ditemukan' });
        if (appointment.doctorId._id.toString() !== doctor._id.toString()) {
            return res.status(403).json({ message: 'Akses ditolak' });
        }

        res.json(appointment);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// APPROVE appointment (dokter)
router.put('/doctor/:id/approve', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ userId: req.userId });
        if (!doctor) return res.status(404).json({ message: 'Profil dokter belum terdaftar. Hubungi admin.' });

        const appointment = await Appointment.findById(req.params.id).populate('userId');
        if (!appointment) return res.status(404).json({ message: 'Janji tidak ditemukan' });
        if (appointment.doctorId.toString() !== doctor._id.toString()) return res.status(403).json({ message: 'Akses ditolak' });
        if (appointment.status !== 'pending') return res.status(400).json({ message: 'Janji sudah diproses' });

        appointment.status = 'confirmed';
        appointment.doctorNotes = req.body.notes || '';
        await appointment.save();

        await createNotification({
            userId: appointment.userId._id,
            type: 'appointment_confirmed',
            title: 'Janji Temu Dikonfirmasi',
            message: `Dokter telah menyetujui janji temu Anda pada ${new Date(appointment.appointmentDate).toLocaleDateString('id-ID')}`,
            data: { appointmentId: appointment._id, url: '/appointments' },
            io: req.app.get('io')
        });

        res.json({ success: true, message: 'Janji temu disetujui', appointment });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// REJECT appointment (dokter)
router.put('/doctor/:id/reject', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ userId: req.userId });
        if (!doctor) return res.status(404).json({ message: 'Profil dokter belum terdaftar. Hubungi admin.' });

        const appointment = await Appointment.findById(req.params.id).populate('userId');
        if (!appointment) return res.status(404).json({ message: 'Janji tidak ditemukan' });
        if (appointment.doctorId.toString() !== doctor._id.toString()) return res.status(403).json({ message: 'Akses ditolak' });
        if (appointment.status !== 'pending') return res.status(400).json({ message: 'Janji sudah diproses' });

        const { reason } = req.body;
        if (!reason) return res.status(400).json({ message: 'Alasan penolakan harus diisi' });

        appointment.status = 'rejected';
        appointment.rejectionReason = reason;
        appointment.doctorNotes = reason;
        await appointment.save();

        await createNotification({
            userId: appointment.userId._id,
            type: 'appointment_rejected',
            title: 'Janji Temu Ditolak',
            message: `Maaf, janji temu Anda ditolak. Alasan: ${reason}`,
            data: { appointmentId: appointment._id, url: '/appointments' },
            io: req.app.get('io')
        });

        res.json({ success: true, message: 'Janji temu ditolak', appointment });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// CHECK-IN appointment (dokter - pasien sudah datang)
router.put('/doctor/:id/check-in', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ userId: req.userId });
        if (!doctor) return res.status(404).json({ message: 'Profil dokter belum terdaftar. Hubungi admin.' });

        const appointment = await Appointment.findById(req.params.id).populate('userId');
        if (!appointment) return res.status(404).json({ message: 'Janji tidak ditemukan' });
        if (appointment.doctorId.toString() !== doctor._id.toString()) return res.status(403).json({ message: 'Akses ditolak' });
        if (appointment.status !== 'confirmed') return res.status(400).json({ message: 'Hanya janji confirmed yang bisa di-check-in' });

        appointment.status = 'checked_in';
        appointment.checkedInAt = new Date();
        await appointment.save();

        await createNotification({
            userId: appointment.userId._id,
            type: 'appointment_confirmed',
            title: 'Pasien Check-In',
            message: `Pasien Anda telah check-in untuk janji temu hari ini.`,
            data: { appointmentId: appointment._id, url: '/appointments' },
            io: req.app.get('io')
        });

        res.json({ success: true, message: 'Pasien berhasil di-check-in', appointment });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// COMPLETE appointment (dokter)
router.put('/doctor/:id/complete', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ userId: req.userId });
        if (!doctor) return res.status(404).json({ message: 'Profil dokter belum terdaftar. Hubungi admin.' });

        const appointment = await Appointment.findById(req.params.id);
        if (!appointment) return res.status(404).json({ message: 'Janji tidak ditemukan' });
        if (appointment.doctorId.toString() !== doctor._id.toString()) return res.status(403).json({ message: 'Akses ditolak' });
        if (appointment.status !== 'checked_in') return res.status(400).json({ message: 'Hanya janji yang sudah check-in yang bisa diselesaikan' });

        appointment.status = 'completed';
        appointment.completedAt = new Date();
        appointment.notes = req.body.notes || '';
        await appointment.save();

        await createNotification({
            userId: appointment.userId,
            type: 'appointment_completed',
            title: 'Janji Temu Selesai',
            message: 'Janji temu Anda telah selesai.',
            data: { appointmentId: appointment._id, url: '/appointments' },
            io: req.app.get('io')
        });

        res.json({ success: true, message: 'Janji temu selesai', appointment });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ══ ADMIN ROUTES ═══════════════════════════════════════════════════

router.get('/admin/all', auth, async (req, res) => {
    try {
        if (req.userRole !== 'admin') return res.status(403).json({ message: 'Akses ditolak' });
        const { page = 1, limit = 10, status } = req.query;
        let query = {};
        if (status && status !== 'all') query.status = status;

        const [appointments, total] = await Promise.all([
            Appointment.find(query)
                .populate('userId', 'name email')
                .populate('doctorId', 'name specialization')
                .sort('-appointmentDate')
                .limit(limit * 1).skip((page - 1) * limit),
            Appointment.countDocuments(query)
        ]);

        res.json({ success: true, appointments, totalPages: Math.ceil(total / limit), currentPage: page, total });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ══ PUBLIC / USER ROUTES ═══════════════════════════════════════════

// GET available slots for doctor
router.get('/available-slots/:doctorId/:date', async (req, res) => {
    try {
        const { doctorId, date } = req.params;
        const selectedDate = new Date(date);
        const dayName = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });

        const doctor = await Doctor.findById(doctorId);
        if (!doctor) return res.status(404).json({ message: 'Dokter tidak ditemukan' });

        const daySchedule = doctor.availableDays?.find(d => d.day === dayName);
        if (!daySchedule) return res.json({ success: true, slots: [] });

        const start = new Date(date); start.setHours(0, 0, 0, 0);
        const end = new Date(date); end.setHours(23, 59, 59, 999);

        const bookedAppointments = await Appointment.find({
            doctorId,
            appointmentDate: { $gte: start, $lt: end },
            status: { $in: ['pending', 'confirmed'] }
        });

        const bookedTimes = bookedAppointments.map(a => a.appointmentTime);
        const availableSlots = daySchedule.slots
            .filter(slot => slot.isAvailable && !bookedTimes.includes(slot.startTime))
            .map(slot => slot.startTime);

        res.json({ success: true, slots: availableSlots });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET my appointments (pasien)
router.get('/my-appointments', auth, async (req, res) => {
    try {
        const appointments = await Appointment.find({ userId: req.userId })
            .populate('doctorId', 'name specialization consultationFee photo')
            .populate('paymentId')
            .sort('-appointmentDate');
        res.json(appointments);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// CREATE appointment (pasien)
router.post('/create', auth, async (req, res) => {
    try {
        const { doctorId, appointmentDate, appointmentTime, complaint } = req.body;

        const doctor = await Doctor.findById(doctorId);
        if (!doctor) return res.status(404).json({ message: 'Dokter tidak ditemukan' });
        if (!doctor.isActive) return res.status(400).json({ message: 'Dokter tidak aktif' });

        const existingAppointment = await Appointment.findOne({
            doctorId, appointmentDate, appointmentTime,
            status: { $in: ['pending', 'confirmed'] }
        });
        if (existingAppointment) return res.status(400).json({ success: false, message: 'Jadwal sudah dipilih pasien lain' });

        const start = new Date(appointmentDate); start.setHours(0, 0, 0, 0);
        const end = new Date(appointmentDate); end.setHours(23, 59, 59, 999);
        const todayCount = await Appointment.countDocuments({ doctorId, appointmentDate: { $gte: start, $lt: end } });

        const appointment = new Appointment({
            userId: req.userId, doctorId, appointmentDate, appointmentTime, complaint,
            queueNumber: todayCount + 1, status: 'pending'
        });
        await appointment.save();

        const doctorUser = await User.findById(doctor.userId);
        if (doctorUser) {
            await createNotification({
                userId: doctorUser._id,
                type: 'appointment_request',
                title: 'Permintaan Janji Temu Baru',
                message: `Ada pasien baru meminta janji temu pada ${new Date(appointmentDate).toLocaleDateString('id-ID')} pukul ${appointmentTime}`,
                data: { appointmentId: appointment._id, url: '/doctor/appointments' },
                io: req.app.get('io')
            });
        }

        res.json({ success: true, message: 'Janji temu berhasil dibuat, menunggu konfirmasi dokter', appointment });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// CANCEL appointment (pasien) - harus SETELAH semua /doctor/... dan /admin/... routes
router.put('/:id/cancel', auth, async (req, res) => {
    try {
        const appointment = await Appointment.findById(req.params.id).populate('doctorId');
        if (!appointment) return res.status(404).json({ message: 'Janji tidak ditemukan' });
        if (appointment.userId.toString() !== req.userId) return res.status(403).json({ message: 'Akses ditolak' });
        if (!['pending', 'confirmed'].includes(appointment.status)) {
            return res.status(400).json({ message: 'Tidak dapat membatalkan janji yang sudah diproses' });
        }

        appointment.status = 'cancelled';
        appointment.notes = req.body.reason || 'Dibatalkan pasien';
        await appointment.save();

        const doctorUser = await User.findById(appointment.doctorId?.userId);
        if (doctorUser) {
            await createNotification({
                userId: doctorUser._id,
                type: 'appointment_cancelled',
                title: 'Janji Temu Dibatalkan',
                message: `Pasien membatalkan janji temu ${new Date(appointment.appointmentDate).toLocaleDateString('id-ID')}`,
                data: { appointmentId: appointment._id, url: '/doctor/appointments' },
                io: req.app.get('io')
            });
        }

        res.json({ success: true, message: 'Janji temu dibatalkan' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
