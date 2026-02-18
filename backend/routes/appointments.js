const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const auth = require('../middleware/auth');

// GET appointments user
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

        const bookedAppointments = await Appointment.find({
            doctorId,
            appointmentDate: {
                $gte: new Date(selectedDate.setHours(0,0,0)),
                $lt: new Date(selectedDate.setHours(23,59,59))
            },
            status: { $in: ['confirmed', 'pending'] }
        });

        const bookedTimes = bookedAppointments.map(a => a.appointmentTime);
        
        const availableSlots = daySchedule.slots
            .filter(slot => slot.isAvailable && !bookedTimes.includes(slot.startTime))
            .map(slot => slot.startTime);

        res.json({ slots: availableSlots });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// CREATE appointment (TANPA STRIPE)
router.post('/create', auth, async (req, res) => {
    try {
        const { doctorId, appointmentDate, appointmentTime, complaint } = req.body;
        
        const doctor = await Doctor.findById(doctorId);
        if (!doctor) {
            return res.status(404).json({ message: 'Dokter tidak ditemukan' });
        }

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

        res.json({
            appointment,
            amount: doctor.consultationFee
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Confirm appointment after payment
router.put('/:id/confirm', auth, async (req, res) => {
    try {
        const appointment = await Appointment.findById(req.params.id);
        appointment.status = 'confirmed';
        appointment.paymentId = req.body.paymentId;
        await appointment.save();
        res.json(appointment);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Cancel appointment
router.put('/:id/cancel', auth, async (req, res) => {
    try {
        const appointment = await Appointment.findById(req.params.id);
        if (appointment.userId.toString() !== req.userId && req.userRole !== 'admin') {
            return res.status(403).json({ message: 'Akses ditolak' });
        }
        
        appointment.status = 'cancelled';
        await appointment.save();
        res.json({ message: 'Janji temu dibatalkan' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;