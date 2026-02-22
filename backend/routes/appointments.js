const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const User = require('../models/User');
const auth = require('../middleware/auth');
const doctorAuth = require('../middleware/doctorAuth');
const { createNotification } = require('../utils/notificationHelper');

// ========== ROUTE UNTUK PASIEN ==========

// GET available slots for doctor
router.get('/available-slots/:doctorId/:date', async (req, res) => {
    try {
        const { doctorId, date } = req.params;
        const selectedDate = new Date(date);
        const dayName = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
        
        const doctor = await Doctor.findById(doctorId);
        if (!doctor) {
            return res.status(404).json({ message: 'Doctor not found' });
        }

        const daySchedule = doctor.availableDays?.find(d => d.day === dayName);
        
        if (!daySchedule) {
            return res.json({ slots: [] });
        }

        // Cari janji yang sudah di-book
        const bookedAppointments = await Appointment.find({
            doctorId,
            appointmentDate: {
                $gte: new Date(selectedDate.setHours(0,0,0)),
                $lt: new Date(selectedDate.setHours(23,59,59))
            },
            status: { $in: ['pending', 'confirmed'] }
        });

        const bookedTimes = bookedAppointments.map(a => a.appointmentTime);
        
        // Filter slot yang tersedia (belum di-book)
        const availableSlots = daySchedule.slots
            .filter(slot => slot.isAvailable && !bookedTimes.includes(slot.startTime))
            .map(slot => slot.startTime);

        res.json({ 
            success: true,
            slots: availableSlots 
        });
    } catch (error) {
        console.error('Error fetching slots:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET my appointments (untuk pasien)
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
        if (!doctor) {
            return res.status(404).json({ message: 'Dokter tidak ditemukan' });
        }

        // CEK DOUBLE BOOKING
        const existingAppointment = await Appointment.findOne({
            doctorId,
            appointmentDate,
            appointmentTime,
            status: { $in: ['pending', 'confirmed'] }
        });

        if (existingAppointment) {
            return res.status(400).json({ 
                success: false,
                message: 'Jadwal sudah dipilih pasien lain' 
            });
        }

        // Dapatkan nomor antrian untuk hari itu
        const todayAppointments = await Appointment.countDocuments({
            doctorId,
            appointmentDate: {
                $gte: new Date(new Date(appointmentDate).setHours(0,0,0)),
                $lt: new Date(new Date(appointmentDate).setHours(23,59,59))
            }
        });

        const appointment = new Appointment({
            userId: req.userId,
            doctorId,
            appointmentDate,
            appointmentTime,
            complaint,
            queueNumber: todayAppointments + 1,
            status: 'pending'
        });

        await appointment.save();

        // 🔔 NOTIFIKASI ke dokter
        const doctorUser = await User.findById(doctor.userId);
        if (doctorUser) {
            await createNotification({
                userId: doctorUser._id,
                type: 'appointment_request',
                title: 'Permintaan Janji Temu Baru',
                message: `Ada pasien baru meminta janji temu pada ${new Date(appointmentDate).toLocaleDateString('id-ID')} pukul ${appointmentTime}`,
                data: { 
                    appointmentId: appointment._id,
                    url: `/doctor/appointments/${appointment._id}`
                },
                io: req.app.get('io')
            });
        }

        res.json({
            success: true,
            message: 'Janji temu berhasil dibuat, menunggu konfirmasi dokter',
            appointment
        });
    } catch (error) {
        console.error('Error creating appointment:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// CANCEL appointment (pasien)
router.put('/:id/cancel', auth, async (req, res) => {
    try {
        const appointment = await Appointment.findById(req.params.id)
            .populate('doctorId');
        
        if (!appointment) {
            return res.status(404).json({ message: 'Janji tidak ditemukan' });
        }

        // Cek apakah milik pasien yang login
        if (appointment.userId.toString() !== req.userId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        // Hanya bisa cancel jika masih pending
        if (appointment.status !== 'pending' && appointment.status !== 'confirmed') {
            return res.status(400).json({ 
                message: 'Tidak dapat membatalkan janji yang sudah diproses' 
            });
        }

        appointment.status = 'cancelled';
        appointment.notes = req.body.reason || 'Dibatalkan pasien';
        await appointment.save();

        // 🔔 NOTIFIKASI ke dokter
        const doctorUser = await User.findById(appointment.doctorId.userId);
        if (doctorUser) {
            await createNotification({
                userId: doctorUser._id,
                type: 'appointment_cancelled',
                title: 'Janji Temu Dibatalkan',
                message: `Pasien membatalkan janji temu ${new Date(appointment.appointmentDate).toLocaleDateString('id-ID')}`,
                data: { 
                    appointmentId: appointment._id,
                    url: `/doctor/appointments`
                },
                io: req.app.get('io')
            });
        }

        res.json({
            success: true,
            message: 'Janji temu dibatalkan'
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ========== ROUTE UNTUK DOKTER ==========

// GET appointments for doctor (pending & confirmed)
router.get('/doctor/appointments', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ userId: req.userId });
        if (!doctor) {
            return res.status(404).json({ message: 'Doctor not found' });
        }

        const { status, date } = req.query;
        let query = { doctorId: doctor._id };
        
        if (status && status !== 'all') {
            query.status = status;
        }
        
        if (date) {
            const selectedDate = new Date(date);
            query.appointmentDate = {
                $gte: new Date(selectedDate.setHours(0,0,0)),
                $lt: new Date(selectedDate.setHours(23,59,59))
            };
        }

        const appointments = await Appointment.find(query)
            .populate('userId', 'name email phone')
            .sort('appointmentDate appointmentTime');

        res.json({
            success: true,
            appointments
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// GET single appointment detail for doctor
router.get('/doctor/appointments/:id', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ userId: req.userId });
        
        const appointment = await Appointment.findById(req.params.id)
            .populate('userId', 'name email phone address')
            .populate('doctorId');
        
        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        // Cek apakah dokter yang berhak
        if (appointment.doctorId._id.toString() !== doctor._id.toString()) {
            return res.status(403).json({ message: 'Unauthorized' });
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
        
        const appointment = await Appointment.findById(req.params.id)
            .populate('userId');
        
        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        if (appointment.doctorId.toString() !== doctor._id.toString()) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        if (appointment.status !== 'pending') {
            return res.status(400).json({ message: 'Janji sudah diproses' });
        }

        appointment.status = 'confirmed';
        appointment.doctorNotes = req.body.notes || '';
        await appointment.save();

        // 🔔 NOTIFIKASI ke pasien
        await createNotification({
            userId: appointment.userId._id,
            type: 'appointment_confirmed',
            title: 'Janji Temu Dikonfirmasi',
            message: `Dokter telah menyetujui janji temu Anda pada ${new Date(appointment.appointmentDate).toLocaleDateString('id-ID')}`,
            data: { 
                appointmentId: appointment._id,
                url: `/appointments`
            },
            io: req.app.get('io')
        });

        res.json({
            success: true,
            message: 'Janji temu disetujui',
            appointment
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// REJECT appointment (dokter)
router.put('/doctor/:id/reject', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ userId: req.userId });
        
        const appointment = await Appointment.findById(req.params.id)
            .populate('userId');
        
        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        if (appointment.doctorId.toString() !== doctor._id.toString()) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        if (appointment.status !== 'pending') {
            return res.status(400).json({ message: 'Janji sudah diproses' });
        }

        const { reason } = req.body;
        if (!reason) {
            return res.status(400).json({ message: 'Alasan penolakan harus diisi' });
        }

        appointment.status = 'rejected';
        appointment.rejectionReason = reason;
        appointment.doctorNotes = reason;
        await appointment.save();

        // 🔔 NOTIFIKASI ke pasien
        await createNotification({
            userId: appointment.userId._id,
            type: 'appointment_rejected',
            title: 'Janji Temu Ditolak',
            message: `Maaf, janji temu Anda ditolak oleh dokter. Alasan: ${reason}`,
            data: { 
                appointmentId: appointment._id,
                url: `/appointments`
            },
            io: req.app.get('io')
        });

        res.json({
            success: true,
            message: 'Janji temu ditolak',
            appointment
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// COMPLETE appointment (dokter - setelah selesai)
router.put('/doctor/:id/complete', auth, doctorAuth, async (req, res) => {
    try {
        const doctor = await Doctor.findOne({ userId: req.userId });
        
        const appointment = await Appointment.findById(req.params.id);
        
        if (!appointment) {
            return res.status(404).json({ message: 'Appointment not found' });
        }

        if (appointment.doctorId.toString() !== doctor._id.toString()) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        if (appointment.status !== 'confirmed') {
            return res.status(400).json({ message: 'Hanya janji confirmed yang bisa diselesaikan' });
        }

        appointment.status = 'completed';
        appointment.completedAt = new Date();
        appointment.notes = req.body.notes || '';
        await appointment.save();

        // 🔔 NOTIFIKASI ke pasien (untuk pembayaran)
        await createNotification({
            userId: appointment.userId,
            type: 'appointment_completed',
            title: 'Janji Temu Selesai',
            message: 'Janji temu Anda telah selesai. Silakan lakukan pembayaran.',
            data: { 
                appointmentId: appointment._id,
                url: `/appointments/${appointment._id}/payment`
            },
            io: req.app.get('io')
        });

        res.json({
            success: true,
            message: 'Janji temu selesai',
            appointment
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ========== ROUTE UNTUK ADMIN ==========
// GET all appointments (admin)
router.get('/admin/all', auth, async (req, res) => {
    try {
        if (req.userRole !== 'admin') {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const { page = 1, limit = 10, status } = req.query;
        let query = {};
        if (status && status !== 'all') {
            query.status = status;
        }

        const appointments = await Appointment.find(query)
            .populate('userId', 'name email')
            .populate('doctorId', 'name specialization')
            .sort('-appointmentDate')
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Appointment.countDocuments(query);

        res.json({
            success: true,
            appointments,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;