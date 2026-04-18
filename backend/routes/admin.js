// routes/admin.js - Admin Dashboard API (LENGKAP DENGAN PERBAIKAN)

const express = require('express');
const { Op } = require('sequelize');
const { User, Doctor, Order, Medicine, Payment } = require('../models/mysql');
const { populateFromMySQL } = require('../utils/hybridJoin');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const { createNotification } = require('../utils/notificationHelper');

// MongoDB models
const Consultation = require('../models/Consultation');
const Appointment = require('../models/Appointment');
const SickLetter = require('../models/SickLetter');
const AdminChat = require('../models/AdminChat');
const DoctorScheduleOverride = require('../models/DoctorScheduleOverride');
const DoctorAvailability = require('../models/DoctorAvailability');
const AppointmentAvailability = require('../models/AppointmentAvailability');

// ── Middleware shorthand ──
const guard = [auth, adminAuth];

// ════════════════════════════════════════════════════════════════════════════
// MULTER CONFIGURATION
// ════════════════════════════════════════════════════════════════════════════

const photoDir = path.join(__dirname, '../uploads/doctors');
if (!fs.existsSync(photoDir)) fs.mkdirSync(photoDir, { recursive: true });
const uploadDoctorPhoto = multer({
    storage: multer.diskStorage({
        destination: (_, __, cb) => cb(null, photoDir),
        filename: (req, file, cb) =>
            cb(null, `doctor-${req.params.id}-${Date.now()}${path.extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_, file, cb) => {
        if (/image\/(jpeg|jpg|png|webp)/.test(file.mimetype)) cb(null, true);
        else cb(new Error('Hanya gambar JPG/PNG/WebP'));
    },
});

const chatDir = path.join(__dirname, '../uploads/admin-chat');
if (!fs.existsSync(chatDir)) fs.mkdirSync(chatDir, { recursive: true });
const uploadChatFile = multer({
    storage: multer.diskStorage({
        destination: (_, __, cb) => cb(null, chatDir),
        filename: (_, file, cb) => cb(null, `chat-${Date.now()}-${file.originalname}`),
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
});

// Helper function untuk format tanggal WIB
function dateRange(period, from, to) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    if (period === 'today') return { start: todayStart, end: todayEnd };
    if (period === '7d') {
        return { start: new Date(todayStart.getTime() - 6 * 86400000), end: todayEnd };
    }
    if (period === '30d') {
        return { start: new Date(todayStart.getTime() - 29 * 86400000), end: todayEnd };
    }
    if (from && to) {
        return {
            start: new Date(from + 'T00:00:00'),
            end: new Date(to + 'T23:59:59'),
        };
    }
    return { start: new Date(todayStart.getTime() - 29 * 86400000), end: todayEnd };
}

// Helper untuk format nama dokter
function fmtDoctorName(doctor) {
    if (!doctor) return 'Dokter';
    let name = '';
    if (doctor.title_prefix) name += doctor.title_prefix + ' ';
    name += doctor.name || '';
    if (doctor.title_suffix) name += ', ' + doctor.title_suffix;
    return name.trim() || 'Dokter';
}

// ════════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ════════════════════════════════════════════════════════════════════════════

router.get('/analytics/operational', guard, async (req, res) => {
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const [pendingRx, paidOrders, pickupReady, todayAppt, todayConsult] = await Promise.all([
            Order.count({ where: { status: 'waiting_prescription' } }),
            Order.count({ where: { status: 'paid' } }),
            Order.count({ where: { status: 'siap_diambil' } }),
            Appointment.countDocuments({
                scheduledAt: { $gte: todayStart, $lte: todayEnd },
                status: { $in: ['scheduled', 'checked_in'] },
            }),
            Consultation.countDocuments({
                scheduledAt: { $gte: todayStart, $lte: todayEnd },
                status: { $in: ['confirmed', 'in_progress'] },
            }),
        ]);

        res.json({ success: true, pendingRx, paidOrders, pickupReady, todayAppt, todayConsult });
    } catch (err) {
        console.error('[admin] GET /analytics/operational error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

router.get('/analytics/financial', guard, async (req, res) => {
    try {
        const { period, from, to } = req.query;
        const { start, end } = dateRange(period, from, to);

        const [consultations, appointments] = await Promise.all([
            Consultation.find({
                paidAt: { $gte: start, $lte: end },
                status: { $in: ['confirmed', 'in_progress', 'completed', 'refunded'] },
            }).select('amount paidAt'),
            Appointment.find({
                scheduledAt: { $gte: start, $lte: end },
                status: { $in: ['checked_in', 'completed'] },
            }).select('scheduledAt'),
        ]);

        const dbOrders = await Order.findAll({
            where: {
                created_at: { [Op.between]: [start, end] },
                status: { [Op.in]: ['paid', 'diproses', 'dikirim', 'terkirim', 'selesai', 'refunded'] },
            },
            attributes: ['total_amount', 'shipping_cost', 'created_at'],
            raw: true,
        });

        const revenueConsultation = consultations.reduce((s, c) => s + (c.amount || 0), 0);
        const revenuePharmacy = dbOrders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0);

        const completedConsultations = await Consultation.countDocuments({
            status: 'completed',
            updatedAt: { $gte: start, $lte: end },
        });
        const completedOrders = await Order.count({
            where: {
                status: 'selesai',
                updated_at: { [Op.between]: [start, end] },
            },
        });
        const completedAppointments = await Appointment.countDocuments({
            status: 'completed',
            updatedAt: { $gte: start, $lte: end },
        });

        const ratingData = await Consultation.find({
            rating: { $gt: 0 },
            updatedAt: { $gte: start, $lte: end },
        }).select('rating');
        const avgRating = ratingData.length > 0
            ? (ratingData.reduce((s, c) => s + c.rating, 0) / ratingData.length).toFixed(1)
            : 0;

        res.json({
            success: true,
            revenue: {
                total: revenueConsultation + revenuePharmacy,
                consultation: revenueConsultation,
                pharmacy: revenuePharmacy,
            },
            completed: {
                consultations: completedConsultations,
                orders: completedOrders,
                appointments: completedAppointments,
            },
            avgRating: parseFloat(avgRating),
            period: { start, end },
        });
    } catch (err) {
        console.error('[admin] GET /analytics/financial error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

router.get('/analytics/growth', guard, async (req, res) => {
    try {
        const { period, from, to } = req.query;
        const { start, end } = dateRange(period, from, to);

        const [newPatients, totalPatients, totalDoctors, activeDoctors] = await Promise.all([
            User.count({
                where: {
                    role: { [Op.in]: ['user', 'mahasiswa'] },
                    created_at: { [Op.between]: [start, end] },
                },
            }),
            User.count({
                where: { role: { [Op.in]: ['user', 'mahasiswa'] } },
            }),
            Doctor.count({}),
            Doctor.count({ where: { is_active: true } }),
        ]);

        const doctors = await Doctor.findAll({
            where: { is_active: true },
            attributes: ['id', 'name', 'rating', 'total_reviews', 'specialization', 'title_prefix', 'title_suffix'],
            raw: true,
        });

        const formattedDoctors = doctors.map(d => ({
            ...d,
            _id: d.id,
            formattedName: fmtDoctorName(d)
        }));

        res.json({
            success: true,
            newPatients,
            totalPatients,
            totalDoctors,
            activeDoctors,
            doctors: formattedDoctors,
            period: { start, end }
        });
    } catch (err) {
        console.error('[admin] GET /analytics/growth error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

// ════════════════════════════════════════════════════════════════════════════
// DOKTER
// ════════════════════════════════════════════════════════════════════════════

router.get('/doctors', guard, async (req, res) => {
    try {
        const where = {};
        if (req.query.specialization) where.specialization = req.query.specialization;

        const doctors = await Doctor.findAll({
            where,
            include: [{
                model: User,
                as: 'user',
                attributes: ['name', 'email', 'phone', 'is_active'],
            }],
        });

        const result = doctors.map(d => {
            const json = d.toJSON();
            json._id = json.id;
            json.userId = json.user;
            return json;
        });

        res.json({ success: true, doctors: result });
    } catch (err) {
        console.error('[admin] GET /doctors error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

router.post('/doctors', guard, async (req, res) => {
    try {
        const {
            name, email, password, specialization, gender, consultationFee, bio, experience,
            strNumber, alumnus, practiceLocation, titlePrefix, titleSuffix,
        } = req.body;

        if (!name?.trim()) return res.status(400).json({ success: false, message: 'Nama wajib diisi' });
        if (!email?.trim()) return res.status(400).json({ success: false, message: 'Email wajib diisi' });
        if (!password || password.length < 6) return res.status(400).json({ success: false, message: 'Password minimal 6 karakter' });
        if (!specialization?.trim()) return res.status(400).json({ success: false, message: 'Spesialisasi wajib diisi' });

        const existing = await User.findOne({ where: { email: email.toLowerCase().trim() } });
        if (existing) return res.status(400).json({ success: false, message: 'Email sudah digunakan' });

        const user = await User.create({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            password,
            phone: '',
            role: 'doctor',
            is_verified: true,
            is_active: true,
        });

        const doctor = await Doctor.create({
            user_id: user.id,
            name: name.trim(),
            specialization: specialization.trim(),
            gender: gender || '',
            bio: bio?.trim() || '',
            experience: experience ? Number(experience) : 0,
            consultation_fee: consultationFee ? Number(consultationFee) : 0,
            str_number: strNumber?.trim() || '',
            alumnus: alumnus?.trim() || '',
            practice_location: practiceLocation?.trim() || '',
            title_prefix: titlePrefix?.trim() || '',
            title_suffix: titleSuffix?.trim() || '',
            is_active: true,
        });

        const populated = await Doctor.findByPk(doctor.id, {
            include: [{ model: User, as: 'user', attributes: ['name', 'email'] }],
        });
        const result = populated.toJSON();
        result._id = result.id;
        result.userId = result.user;
        res.status(201).json({ success: true, message: 'Dokter berhasil ditambahkan', doctor: result });
    } catch (err) {
        console.error('[admin] POST /doctors error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

router.get('/doctors/:id', guard, async (req, res) => {
    try {
        const docRow = await Doctor.findByPk(req.params.id, {
            include: [{ model: User, as: 'user', attributes: ['name', 'email', 'phone', 'is_active', 'gender', 'date_of_birth'] }],
        });
        if (!docRow) return res.status(404).json({ success: false, message: 'Dokter tidak ditemukan' });

        const doctor = docRow.toJSON();
        doctor._id = doctor.id;
        doctor.userId = doctor.user;

        let reviews = await Consultation.find({ doctorId: doctor.id, rating: { $gt: 0 } })
            .select('rating ratingComment ratedAt userId')
            .sort('-ratedAt')
            .limit(10)
            .lean();

        reviews = await populateFromMySQL(reviews, 'userId', 'User', 'id name');

        const ratingDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        reviews.forEach(r => { if (ratingDist[r.rating] !== undefined) ratingDist[r.rating]++; });

        res.json({ success: true, doctor, reviews, ratingDist });
    } catch (err) {
        console.error('[admin] GET /doctors/:id error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

router.put('/doctors/:id', guard, async (req, res) => {
    try {
        const { name, specialization, consultationFee, bio, gender, titlePrefix, titleSuffix, experience, strNumber, alumnus, practiceLocation } = req.body;
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (specialization !== undefined) updates.specialization = specialization;
        if (consultationFee !== undefined) updates.consultation_fee = Number(consultationFee);
        if (bio !== undefined) updates.bio = bio;
        if (gender !== undefined) updates.gender = gender;
        if (titlePrefix !== undefined) updates.title_prefix = titlePrefix;
        if (titleSuffix !== undefined) updates.title_suffix = titleSuffix;
        if (experience !== undefined) updates.experience = experience;
        if (strNumber !== undefined) updates.str_number = strNumber;
        if (alumnus !== undefined) updates.alumnus = alumnus;
        if (practiceLocation !== undefined) updates.practice_location = practiceLocation;

        await Doctor.update(updates, { where: { id: req.params.id } });
        const doctor = await Doctor.findByPk(req.params.id);
        if (!doctor) return res.status(404).json({ success: false, message: 'Dokter tidak ditemukan' });
        const result = doctor.toJSON();
        result._id = result.id;
        res.json({ success: true, doctor: result });
    } catch (err) {
        console.error('[admin] PUT /doctors/:id error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

router.put('/doctors/:id/toggle-status', guard, async (req, res) => {
    try {
        const doctor = await Doctor.findByPk(req.params.id);
        if (!doctor) return res.status(404).json({ success: false, message: 'Dokter tidak ditemukan' });
        doctor.is_active = !doctor.is_active;
        await doctor.save();
        if (doctor.user_id) {
            await User.update({ is_active: doctor.is_active }, { where: { id: doctor.user_id } });
        }
        res.json({ success: true, doctor: { ...doctor.toJSON(), _id: doctor.id }, isActive: doctor.is_active });
    } catch (err) {
        console.error('[admin] PUT /doctors/:id/toggle-status error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

router.post('/doctors/:id/photo', guard, uploadDoctorPhoto.single('photo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'File tidak ada' });
        const photoUrl = `/uploads/doctors/${req.file.filename}`;
        await Doctor.update({ photo: photoUrl }, { where: { id: req.params.id } });
        const doctor = await Doctor.findByPk(req.params.id);
        if (!doctor) return res.status(404).json({ success: false, message: 'Dokter tidak ditemukan' });
        res.json({ success: true, photoUrl });
    } catch (err) {
        console.error('[admin] POST /doctors/:id/photo error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

router.get('/doctors/:id/schedule', guard, async (req, res) => {
    try {
        const [consultAvail, apptAvail, overrides] = await Promise.all([
            DoctorAvailability.findOne({ doctorId: req.params.id }).lean(),
            AppointmentAvailability.findOne({ doctorId: req.params.id }).lean(),
            DoctorScheduleOverride.find({ doctorId: req.params.id }).sort('date').lean(),
        ]);
        res.json({ success: true, consultAvail, apptAvail, overrides });
    } catch (err) {
        console.error('[admin] GET /doctors/:id/schedule error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

router.put('/doctors/:id/schedule/override', guard, async (req, res) => {
    try {
        const { dates, reason } = req.body;
        if (!dates || !Array.isArray(dates) || dates.length === 0)
            return res.status(400).json({ success: false, message: 'dates wajib diisi (array YYYY-MM-DD)' });

        const results = [];
        for (const date of dates) {
            await DoctorScheduleOverride.findOneAndUpdate(
                { doctorId: req.params.id, date },
                { doctorId: req.params.id, date, reason: reason || '', blockedBy: req.userId },
                { upsert: true, new: true }
            );
            results.push(date);
        }

        let cancelledCount = 0;
        for (const date of dates) {
            const dayStart = new Date(date + 'T00:00:00');
            const dayEnd = new Date(date + 'T23:59:59');
            const toCancel = await Appointment.find({
                doctorId: req.params.id,
                scheduledAt: { $gte: dayStart, $lte: dayEnd },
                status: { $in: ['scheduled', 'checked_in'] },
            }).lean();

            const userIds = [...new Set(toCancel.map(a => a.userId).filter(Boolean))];
            const userRows = userIds.length ? await User.findAll({ where: { id: userIds }, raw: true }) : [];
            const userMap = Object.fromEntries(userRows.map(u => [u.id, u]));

            for (const appt of toCancel) {
                await Appointment.findByIdAndUpdate(appt._id, {
                    status: 'cancelled_by_admin',
                    cancelledAt: new Date(),
                    cancelReason: reason || 'Dokter tidak hadir (override jadwal oleh admin)',
                });
                const userRow = userMap[appt.userId];
                if (userRow) {
                    await createNotification({
                        userId: userRow.id,
                        type: 'appointment_cancelled',
                        title: 'Janji Temu Dibatalkan',
                        message: `Janji temu Anda pada ${date} dibatalkan. ${reason ? 'Alasan: ' + reason : 'Dokter tidak hadir.'}`,
                        data: { appointmentId: appt._id?.toString() },
                        io: req.app.get('io'),
                    });
                }
                cancelledCount++;
            }
        }

        res.json({ success: true, blockedDates: results, cancelledAppointments: cancelledCount });
    } catch (err) {
        console.error('[admin] PUT /doctors/:id/schedule/override error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

router.delete('/doctors/:id/schedule/override/:date', guard, async (req, res) => {
    try {
        await DoctorScheduleOverride.findOneAndDelete({ doctorId: req.params.id, date: req.params.date });
        res.json({ success: true });
    } catch (err) {
        console.error('[admin] DELETE /doctors/:id/schedule/override/:date error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

router.get('/doctors/:id/schedule/overrides', guard, async (req, res) => {
    try {
        const overrides = await DoctorScheduleOverride.find({ doctorId: req.params.id }).sort('date').lean();
        res.json({ success: true, overrides });
    } catch (err) {
        console.error('[admin] GET /doctors/:id/schedule/overrides error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

// ════════════════════════════════════════════════════════════════════════════
// PASIEN / USER
// ════════════════════════════════════════════════════════════════════════════

router.get('/users', guard, async (req, res) => {
    try {
        const { role, search, page = 1, limit = 30 } = req.query;
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 30;
        const offset = (pageNum - 1) * limitNum;

        const where = { role: { [Op.in]: ['user', 'mahasiswa'] } };
        if (role && ['user', 'mahasiswa'].includes(role)) where.role = role;
        
        if (search && search.trim()) {
            const searchTerm = `%${search.trim()}%`;
            where[Op.or] = [
                { name: { [Op.like]: searchTerm } },
                { email: { [Op.like]: searchTerm } },
                { phone: { [Op.like]: searchTerm } },
            ];
        }

        const total = await User.count({ where });
        const users = await User.findAll({
            where,
            attributes: { exclude: ['password', 'email_otp', 'reset_password_token', 'reset_password_expires'] },
            order: [['created_at', 'DESC']],
            offset,
            limit: limitNum,
            raw: true,
        });

        const formattedUsers = users.map(user => ({
            ...user,
            _id: user.id,
            isActive: user.is_active !== false,
            createdAt: user.created_at,
            updatedAt: user.updated_at,
        }));

        res.json({ 
            success: true, 
            users: formattedUsers, 
            total, 
            page: pageNum, 
            pages: Math.ceil(total / limitNum) 
        });
    } catch (err) {
        console.error('[admin] GET /users error:', err);
        res.status(500).json({ success: false, message: 'Gagal memuat data pasien', error: err.message });
    }
});

router.get('/users/:id', guard, async (req, res) => {
    try {
        const userId = req.params.id;

        const user = await User.findByPk(userId, {
            attributes: { exclude: ['password', 'email_otp', 'reset_password_token', 'reset_password_expires'] },
            raw: true,
        });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
        }

        let consultations = [];
        try {
            consultations = await Consultation.find({ userId: userId })
                .select('status scheduledAt amount paidAt createdAt consultationType doctorId')
                .sort('-createdAt')
                .limit(20)
                .lean();

            if (consultations.length > 0) {
                const doctorIds = [...new Set(consultations.map(c => c.doctorId).filter(Boolean))];
                if (doctorIds.length > 0) {
                    const doctors = await Doctor.findAll({
                        where: { id: doctorIds },
                        attributes: ['id', 'name', 'specialization', 'title_prefix', 'title_suffix'],
                        raw: true
                    });
                    const doctorMap = {};
                    doctors.forEach(d => { doctorMap[d.id] = d; });
                    consultations = consultations.map(c => ({
                        ...c,
                        doctorId: doctorMap[c.doctorId] || null
                    }));
                }
            }
        } catch (err) {
            console.error('[admin] GET /users/:id consultations error:', err);
            consultations = [];
        }

        let appointments = [];
        try {
            appointments = await Appointment.find({ userId: userId })
                .select('status scheduledAt appointmentTime appointmentDate createdAt doctorId complaint')
                .sort('-createdAt')
                .limit(20)
                .lean();

            if (appointments.length > 0) {
                const doctorIds = [...new Set(appointments.map(a => a.doctorId).filter(Boolean))];
                if (doctorIds.length > 0) {
                    const doctors = await Doctor.findAll({
                        where: { id: doctorIds },
                        attributes: ['id', 'name', 'specialization', 'title_prefix', 'title_suffix'],
                        raw: true
                    });
                    const doctorMap = {};
                    doctors.forEach(d => { doctorMap[d.id] = d; });
                    appointments = appointments.map(a => ({
                        ...a,
                        doctorId: doctorMap[a.doctorId] || null
                    }));
                }
            }
        } catch (err) {
            console.error('[admin] GET /users/:id appointments error:', err);
            appointments = [];
        }

        let orders = [];
        try {
            orders = await Order.findAll({
                where: { user_id: userId },
                attributes: ['id', 'order_number', 'status', 'total_amount', 'created_at', 'delivery_method'],
                order: [['created_at', 'DESC']],
                limit: 20,
                raw: true,
            });
            orders = orders.map(o => ({ ...o, _id: o.id, createdAt: o.created_at }));
        } catch (err) {
            console.error('[admin] GET /users/:id orders error:', err);
            orders = [];
        }

        res.json({
            success: true,
            user: { ...user, _id: user.id, isActive: user.is_active !== false, createdAt: user.created_at },
            consultations,
            appointments,
            orders
        });
    } catch (err) {
        console.error('[admin] GET /users/:id error:', err);
        res.status(500).json({ success: false, message: 'Gagal memuat detail user', error: err.message });
    }
});

router.get('/users/:id/quota', guard, async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id, { raw: true });
        if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });

        if (user.role !== 'mahasiswa') {
            return res.json({ success: true, used: 0, max: 0, remaining: 0, manualExtra: 0, isMahasiswa: false });
        }

        const STUDENT_MAX_PCS = 8;
        const now = new Date();
        const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        const orders = await Order.findAll({
            where: {
                user_id: req.params.id,
                is_student_discount: true,
                student_free_qty: { [Op.gt]: 0 },
                status: { [Op.notIn]: ['cancelled', 'expired', 'prescription_rejected'] },
                created_at: { [Op.between]: [startMonth, endMonth] },
            },
            attributes: ['order_number', 'student_free_qty', 'created_at'],
            raw: true,
        });

        const used = orders.reduce((s, o) => s + (o.student_free_qty || 0), 0);
        const manualExtra = user.quota_bonus || 0;
        const max = STUDENT_MAX_PCS + manualExtra;

        res.json({ success: true, used, max, remaining: Math.max(0, max - used), manualExtra, orders, month: startMonth });
    } catch (err) {
        console.error('[admin] GET /users/:id/quota error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

router.put('/users/:id/quota', guard, async (req, res) => {
    try {
        const { action, amount } = req.body;
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
        if (user.role !== 'mahasiswa') return res.status(400).json({ success: false, message: 'Hanya untuk mahasiswa' });

        if (action === 'reset') {
            user.quota_bonus = 0;
        } else if (action === 'add') {
            user.quota_bonus = (user.quota_bonus || 0) + Number(amount || 0);
        } else {
            return res.status(400).json({ success: false, message: 'action harus add atau reset' });
        }

        await user.save();
        res.json({ success: true, quotaBonus: user.quota_bonus });
    } catch (err) {
        console.error('[admin] PUT /users/:id/quota error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

router.put('/users/:id/toggle-status', guard, async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
        user.is_active = !user.is_active;
        await user.save();
        res.json({ success: true, isActive: user.is_active });
    } catch (err) {
        console.error('[admin] PUT /users/:id/toggle-status error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

router.post('/users/upgrade-mahasiswa', guard, async (req, res) => {
    try {
        const [affectedCount] = await User.update(
            { role: 'mahasiswa' },
            { where: { email: { [Op.like]: '%@apps.ipb.ac.id' }, role: 'user' } }
        );
        res.json({
            success: true,
            upgraded: affectedCount,
            message: `${affectedCount} akun berhasil diupgrade ke mahasiswa`,
        });
    } catch (err) {
        console.error('[admin] POST /users/upgrade-mahasiswa error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

router.post('/users/reset-quota-bonus', guard, async (req, res) => {
    try {
        const [affectedCount] = await User.update(
            { quota_bonus: 0 },
            { where: { role: 'mahasiswa', quota_bonus: { [Op.gt]: 0 } } }
        );
        res.json({ success: true, reset: affectedCount, message: `Kuota bonus ${affectedCount} mahasiswa berhasil direset ke 0` });
    } catch (err) {
        console.error('[admin] POST /users/reset-quota-bonus error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

// ════════════════════════════════════════════════════════════════════════════
// KONSULTASI
// ════════════════════════════════════════════════════════════════════════════

router.get('/consultations', guard, async (req, res) => {
    try {
        const { period, from, to, doctorId, status, page = 1, limit = 50 } = req.query;
        const { start, end } = dateRange(period, from, to);

        const filter = {
            $or: [
                { scheduledAt: { $gte: start, $lte: end } },
                { createdAt: { $gte: start, $lte: end } },
            ],
        };
        if (doctorId) filter.doctorId = doctorId;
        if (status) filter.status = status;

        const total = await Consultation.countDocuments(filter);
        let consultations = await Consultation.find(filter)
            .select('status scheduledAt scheduledEnd consultationType startTime endTime paidAt amount xenditExternalId doctorId userId createdAt rating')
            .sort('-scheduledAt')
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit))
            .lean();

        if (consultations.length > 0) {
            const doctorIds = [...new Set(consultations.map(c => c.doctorId).filter(Boolean))];
            if (doctorIds.length > 0) {
                const doctors = await Doctor.findAll({
                    where: { id: doctorIds },
                    attributes: ['id', 'name', 'specialization', 'title_prefix', 'title_suffix'],
                    raw: true
                });
                const doctorMap = {};
                doctors.forEach(d => { doctorMap[d.id] = d; });
                consultations = consultations.map(c => ({
                    ...c,
                    doctorId: doctorMap[c.doctorId] || null
                }));
            }

            const userIds = [...new Set(consultations.map(c => c.userId).filter(Boolean))];
            if (userIds.length > 0) {
                const users = await User.findAll({
                    where: { id: userIds },
                    attributes: ['id', 'name', 'email'],
                    raw: true
                });
                const userMap = {};
                users.forEach(u => { userMap[u.id] = u; });
                consultations = consultations.map(c => ({
                    ...c,
                    userId: userMap[c.userId] || null
                }));
            }
        }

        const data = consultations.map(c => ({
            ...c,
            durationMin: c.startTime && c.endTime
                ? Math.round((new Date(c.endTime) - new Date(c.startTime)) / 60000)
                : null,
        }));

        res.json({ success: true, consultations: data, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
    } catch (err) {
        console.error('[admin] GET /consultations error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

// ════════════════════════════════════════════════════════════════════════════
// JANJI TEMU
// ════════════════════════════════════════════════════════════════════════════

router.get('/appointments', guard, async (req, res) => {
    try {
        const { period, from, to, doctorId, status, page = 1, limit = 50 } = req.query;
        const { start, end } = dateRange(period, from, to);

        const filter = {
            $or: [
                { scheduledAt: { $gte: start, $lte: end } },
                { createdAt: { $gte: start, $lte: end } },
            ],
        };
        if (doctorId) filter.doctorId = doctorId;
        if (status) filter.status = status;

        const total = await Appointment.countDocuments(filter);
        let appointments = await Appointment.find(filter)
            .select('status scheduledAt appointmentTime appointmentDate doctorId userId complaint cancelReason createdAt')
            .sort('-scheduledAt')
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit))
            .lean();

        if (appointments.length > 0) {
            const doctorIds = [...new Set(appointments.map(a => a.doctorId).filter(Boolean))];
            if (doctorIds.length > 0) {
                const doctors = await Doctor.findAll({
                    where: { id: doctorIds },
                    attributes: ['id', 'name', 'specialization', 'title_prefix', 'title_suffix'],
                    raw: true
                });
                const doctorMap = {};
                doctors.forEach(d => { doctorMap[d.id] = d; });
                appointments = appointments.map(a => ({
                    ...a,
                    doctorId: doctorMap[a.doctorId] || null
                }));
            }

            const userIds = [...new Set(appointments.map(a => a.userId).filter(Boolean))];
            if (userIds.length > 0) {
                const users = await User.findAll({
                    where: { id: userIds },
                    attributes: ['id', 'name', 'email', 'phone'],
                    raw: true
                });
                const userMap = {};
                users.forEach(u => { userMap[u.id] = u; });
                appointments = appointments.map(a => ({
                    ...a,
                    userId: userMap[a.userId] || null
                }));
            }
        }

        res.json({ success: true, appointments, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
    } catch (err) {
        console.error('[admin] GET /appointments error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

router.put('/appointments/:id/check-in', guard, async (req, res) => {
    try {
        const appt = await Appointment.findById(req.params.id).lean();
        if (!appt) return res.status(404).json({ success: false, message: 'Janji temu tidak ditemukan' });
        if (appt.status !== 'scheduled')
            return res.status(400).json({ success: false, message: `Status harus scheduled, saat ini: ${appt.status}` });

        await Appointment.findByIdAndUpdate(req.params.id, {
            status: 'checked_in',
            checkedInAt: new Date(),
        });

        const userRow = appt.userId ? await User.findByPk(appt.userId, { raw: true }) : null;
        const doctorRow = appt.doctorId ? await Doctor.findByPk(appt.doctorId, { raw: true }) : null;

        if (userRow) {
            await createNotification({
                userId: userRow.id,
                type: 'appointment_reminder',
                title: '✅ Check-In Berhasil',
                message: `Anda telah check-in untuk janji temu dengan ${fmtDoctorName(doctorRow)}. Silakan menunggu.`,
                data: { appointmentId: appt._id?.toString() },
                io: req.app.get('io'),
            });
        }

        res.json({ success: true, appointment: { ...appt, status: 'checked_in' } });
    } catch (err) {
        console.error('[admin] PUT /appointments/:id/check-in error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

router.put('/appointments/:id/cancel', guard, async (req, res) => {
    try {
        const { reason, cancelledFor } = req.body;
        if (!reason?.trim()) return res.status(400).json({ success: false, message: 'Alasan pembatalan wajib diisi' });

        const appt = await Appointment.findById(req.params.id).lean();
        if (!appt) return res.status(404).json({ success: false, message: 'Janji temu tidak ditemukan' });
        if (!['scheduled', 'checked_in'].includes(appt.status))
            return res.status(400).json({ success: false, message: `Tidak bisa batalkan dari status: ${appt.status}` });

        const newStatus = cancelledFor === 'doctor' ? 'cancelled_by_doctor' : 'cancelled_by_admin';
        const cancelledAt = new Date();
        await Appointment.findByIdAndUpdate(req.params.id, {
            status: newStatus,
            cancelReason: reason,
            cancelledAt,
        });

        const io = req.app.get('io');
        const [userRow, doctorRow] = await Promise.all([
            appt.userId ? User.findByPk(appt.userId, { raw: true }) : null,
            appt.doctorId ? Doctor.findByPk(appt.doctorId, { raw: true }) : null,
        ]);

        if (userRow) {
            await createNotification({
                userId: userRow.id,
                type: 'appointment_cancelled',
                title: '❌ Janji Temu Dibatalkan',
                message: `Janji temu Anda dengan ${fmtDoctorName(doctorRow)} dibatalkan. Alasan: ${reason}`,
                data: { appointmentId: appt._id?.toString() },
                io,
            });
        }

        if (doctorRow?.user_id && cancelledFor !== 'doctor') {
            await createNotification({
                userId: doctorRow.user_id,
                type: 'appointment_cancelled',
                title: '❌ Janji Temu Dibatalkan Admin',
                message: `Janji temu dengan pasien ${userRow?.name || '-'} dibatalkan. Alasan: ${reason}`,
                data: { appointmentId: appt._id?.toString() },
                io,
            });
        }

        res.json({ success: true, appointment: { ...appt, status: newStatus, cancelReason: reason, cancelledAt } });
    } catch (err) {
        console.error('[admin] PUT /appointments/:id/cancel error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

// ════════════════════════════════════════════════════════════════════════════
// FARMASI
// ════════════════════════════════════════════════════════════════════════════

router.get('/pharmacy/low-stock', guard, async (req, res) => {
    try {
        const meds = await Medicine.findAll({ where: { is_active: true }, raw: true });
        const lowStock = meds.filter(m => (m.stock - (m.locked_stock || 0)) <= (m.min_stock ?? 10));
        res.json({ success: true, medicines: lowStock });
    } catch (err) {
        console.error('[admin] GET /pharmacy/low-stock error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

router.get('/pharmacy/best-sellers', guard, async (req, res) => {
    try {
        const limitN = parseInt(req.query.limit) || 5;

        const allOrders = await Order.findAll({
            where: { status: { [Op.in]: ['selesai', 'terkirim', 'dikirim', 'diproses'] } },
            include: [{ association: 'items', attributes: ['medicine_id', 'medicine_name', 'quantity'] }],
        });

        const itemMap = {};
        for (const order of allOrders) {
            const items = order.items || [];
            for (const item of items) {
                const key = item.medicine_id || item.medicine_name;
                const name = item.medicine_name;
                if (!itemMap[key]) itemMap[key] = { id: key, name, totalQty: 0 };
                itemMap[key].totalQty += (item.quantity || 0);
            }
        }
        const result = Object.values(itemMap).sort((a, b) => b.totalQty - a.totalQty).slice(0, limitN);
        res.json({ success: true, bestSellers: result });
    } catch (err) {
        console.error('[admin] GET /pharmacy/best-sellers error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

// ════════════════════════════════════════════════════════════════════════════
// SURAT SAKIT
// ════════════════════════════════════════════════════════════════════════════

router.get('/sick-letters', guard, async (req, res) => {
    try {
        const { doctorId, userId, from, to, status, page = 1, limit = 30 } = req.query;
        const filter = {};
        if (doctorId) filter.doctorId = doctorId;
        if (userId) filter.userId = userId;
        if (status) filter.status = status;
        if (from || to) {
            filter.createdAt = {};
            if (from) filter.createdAt.$gte = new Date(from + 'T00:00:00');
            if (to) filter.createdAt.$lte = new Date(to + 'T23:59:59');
        }

        const total = await SickLetter.countDocuments(filter);
        let letters = await SickLetter.find(filter)
            .select('letterNumber status diagnosis startDate endDate issuedAt createdAt userId doctorId pdfUrl')
            .sort('-createdAt')
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit))
            .lean();

        // UUID regex untuk validasi
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        
        if (letters.length > 0) {
            // Filter userId yang valid UUID
            const validUserIds = [...new Set(letters.map(l => l.userId).filter(id => id && uuidRegex.test(id)))];
            if (validUserIds.length > 0) {
                const users = await User.findAll({
                    where: { id: validUserIds },
                    attributes: ['id', 'name', 'email'],
                    raw: true
                });
                const userMap = {};
                users.forEach(u => { userMap[u.id] = u; });
                letters = letters.map(l => ({
                    ...l,
                    userId: userMap[l.userId] || null
                }));
            } else {
                letters = letters.map(l => ({ ...l, userId: null }));
            }

            // Filter doctorId yang valid UUID
            const validDoctorIds = [...new Set(letters.map(l => l.doctorId).filter(id => id && uuidRegex.test(id)))];
            if (validDoctorIds.length > 0) {
                const doctors = await Doctor.findAll({
                    where: { id: validDoctorIds },
                    attributes: ['id', 'name', 'specialization', 'title_prefix', 'title_suffix'],
                    raw: true
                });
                const doctorMap = {};
                doctors.forEach(d => { doctorMap[d.id] = d; });
                letters = letters.map(l => ({
                    ...l,
                    doctorId: doctorMap[l.doctorId] || null
                }));
            } else {
                letters = letters.map(l => ({ ...l, doctorId: null }));
            }
        }

        res.json({ success: true, letters, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
    } catch (err) {
        console.error('[admin] GET /sick-letters error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

// ════════════════════════════════════════════════════════════════════════════
// LAPORAN & KEUANGAN
// ════════════════════════════════════════════════════════════════════════════

router.get('/reports/revenue', guard, async (req, res) => {
    try {
        const { period, from, to, format = 'json', jenis } = req.query;
        const { start, end } = dateRange(period, from, to);
        const REPORT_LIMIT = 5000;

        // Consultation tetap sama
        let consultations = await Consultation.find({
            paidAt: { $gte: start, $lte: end },
            status: { $nin: ['pending_payment', 'expired', 'cancelled', 'cancelled_by_user'] },
        })
            .limit(REPORT_LIMIT)
            .select('paidAt amount xenditExternalId consultationType status userId doctorId')
            .lean();

        // Populate user & doctor
        if (consultations.length > 0) {
            const userIds = [...new Set(consultations.map(c => c.userId).filter(Boolean))];
            const doctorIds = [...new Set(consultations.map(c => c.doctorId).filter(Boolean))];
            
            const [users, doctors] = await Promise.all([
                userIds.length ? User.findAll({ where: { id: userIds }, attributes: ['id', 'name', 'email'], raw: true }) : [],
                doctorIds.length ? Doctor.findAll({ where: { id: doctorIds }, attributes: ['id', 'name'], raw: true }) : [],
            ]);
            
            const userMap = Object.fromEntries(users.map(u => [u.id, u]));
            const doctorMap = Object.fromEntries(doctors.map(d => [d.id, d]));
            
            consultations = consultations.map(c => ({
                ...c,
                userId: userMap[c.userId] || null,
                doctorId: doctorMap[c.doctorId] || null
            }));
        }

        // PERBAIKAN: Filter order yang statusnya TIDAK termasuk yang dikecualikan
        // Dikecualikan: waiting_prescription, prescription_rejected, refunded, cancelled, expired
        const dbOrders = await Order.findAll({
            where: {
                created_at: { [Op.between]: [start, end] },
                status: { 
                    [Op.notIn]: [
                        'pending', 'expired', 'cancelled', 
                        'waiting_prescription', 'prescription_rejected', 'refunded',
                        'refund_requested', 'refund_rejected'
                    ] 
                },
            },
            limit: REPORT_LIMIT,
            include: [
                { model: User, as: 'user', attributes: ['name', 'email'] },
                { association: 'items', attributes: ['quantity', 'medicine_name'] },
            ],
            attributes: ['order_number', 'created_at', 'total_amount', 'shipping_cost', 'xendit_external_id', 'status', 'user_id', 'delivery_method'],
        });

        const orders = dbOrders.map(o => {
            const json = o.toJSON();
            json.userId = json.user;
            json.items = json.items || [];
            json.orderNumber = json.order_number;
            json.createdAt = json.created_at;
            json.totalAmount = json.total_amount;
            json.shippingCost = json.shipping_cost;
            json.xenditExternalId = json.xendit_external_id;
            json.deliveryMethod = json.delivery_method;
            return json;
        });

        let appointments = await Appointment.find({
            scheduledAt: { $gte: start, $lte: end },
            status: { $in: ['checked_in', 'completed'] },
        })
            .limit(REPORT_LIMIT)
            .select('scheduledAt appointmentTime userId doctorId status')
            .lean();

        appointments = await populateFromMySQL(appointments, 'userId', 'User', 'id name email');
        appointments = await populateFromMySQL(appointments, 'doctorId', 'Doctor', 'id name');

        let rows = [
            ...consultations.map(c => ({
                tanggal: new Date(c.paidAt).toLocaleDateString('id-ID'),
                jenis: 'Konsultasi',
                id_transaksi: c.xenditExternalId || '-',
                nama_pasien: c.userId?.name || '-',
                email_pasien: c.userId?.email || '-',
                nama_dokter: c.doctorId?.name || '-',
                nominal: c.amount || 0,
                metode_bayar: 'Xendit',
                ongkir: 0,
                total_qty: '-',
                status: c.status,
            })),
            ...orders.map(o => ({
                tanggal: new Date(o.createdAt).toLocaleDateString('id-ID'),
                jenis: 'Farmasi',
                id_transaksi: o.xenditExternalId || o.orderNumber || '-',
                nama_pasien: o.userId?.name || '-',
                email_pasien: o.userId?.email || '-',
                nama_dokter: '-',
                nominal: Number(o.totalAmount) || 0,
                metode_bayar: 'Xendit',
                ongkir: Number(o.shippingCost) || 0,
                total_qty: (o.items || []).reduce((s, i) => s + (i.quantity || 0), 0),
                status: o.status,
            })),
        ].sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

        // Filter by jenis if specified
        if (jenis === 'Konsultasi') {
            rows = rows.filter(r => r.jenis === 'Konsultasi');
        } else if (jenis === 'Farmasi') {
            rows = rows.filter(r => r.jenis === 'Farmasi');
        }

        if (format === 'csv') {
            const header = 'Tanggal,Jenis,ID Transaksi,Nama Pasien,Email Pasien,Nama Dokter,Nominal,Metode Bayar,Biaya Ongkir,Total Qty,Status\n';
            const csv = header + rows.map(r =>
                `"${r.tanggal}","${r.jenis}","${r.id_transaksi}","${r.nama_pasien}","${r.email_pasien}","${r.nama_dokter}",${r.nominal},"${r.metode_bayar}",${r.ongkir},"${r.total_qty}","${r.status}"`
            ).join('\n');
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="laporan-pendapatan-${from || 'all'}-${to || 'all'}.csv"`);
            return res.send(csv);
        }

        res.json({ success: true, rows, total: rows.reduce((s, r) => s + (r.nominal || 0), 0), period: { start, end } });
    } catch (err) {
        console.error('[admin] GET /reports/revenue error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

router.get('/reports/subsidi-mahasiswa', guard, async (req, res) => {
    try {
        const { from, to, format = 'json' } = req.query;
        const start = from ? new Date(from + 'T00:00:00') : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const end = to ? new Date(to + 'T23:59:59') : new Date();

        // PERBAIKAN: Filter order yang statusnya TIDAK termasuk yang dikecualikan
        // Dikecualikan: waiting_prescription, prescription_rejected, refunded, cancelled, expired
        const dbOrders = await Order.findAll({
            where: {
                is_student_discount: true,
                status: { 
                    [Op.notIn]: [
                        'cancelled', 'expired', 'prescription_rejected', 
                        'waiting_prescription', 'refunded', 'refund_requested', 'refund_rejected'
                    ] 
                },
                created_at: { [Op.between]: [start, end] },
            },
            include: [
                { model: User, as: 'user', attributes: ['name', 'email'] },
                { association: 'items' }
            ],
            attributes: ['created_at', 'user_id', 'student_free_qty'],
        });

        const rows = [];
        for (const order of dbOrders) {
            const json = order.toJSON();
            const items = order.items || [];
            const freeItems = items.filter(i => i.is_free_for_student);
            for (const item of freeItems) {
                rows.push({
                    tanggal: new Date(json.created_at).toLocaleDateString('id-ID'),
                    email_mahasiswa: json.user?.email || '-',
                    nama_mahasiswa: json.user?.name || '-',
                    nama_obat: item.medicine_name || '-',
                    qty: item.quantity || 0,
                    harga_satuan: item.price || 0,
                    total_subsidi: (item.price || 0) * (item.quantity || 0),
                });
            }
        }

        const grandTotal = rows.reduce((s, r) => s + r.total_subsidi, 0);

        if (format === 'csv') {
            const header = 'Tanggal,Email Mahasiswa,Nama Mahasiswa,Nama Obat,Qty,Harga Satuan,Total Subsidi\n';
            const csv = header + rows.map(r =>
                `"${r.tanggal}","${r.email_mahasiswa}","${r.nama_mahasiswa}","${r.nama_obat}",${r.qty},${r.harga_satuan},${r.total_subsidi}`
            ).join('\n');
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="laporan-subsidi-mahasiswa-${from || 'all'}-${to || 'all'}.csv"`);
            return res.send(csv);
        }

        res.json({ success: true, rows, grandTotal, period: { start, end } });
    } catch (err) {
        console.error('[admin] GET /reports/subsidi-mahasiswa error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

// ════════════════════════════════════════════════════════════════════════════
// CHAT ADMIN ↔ DOKTER
// ════════════════════════════════════════════════════════════════════════════

router.get('/chat/threads', guard, async (req, res) => {
    try {
        let threads = await AdminChat.find()
            .select('doctorId doctorUserId lastMessage lastAt unreadAdmin')
            .sort('-lastAt')
            .lean();

        // Filter doctorId yang valid (UUID format, bukan MongoDB ObjectId)
        // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const validDoctorIds = threads
            .map(t => t.doctorId)
            .filter(id => id && typeof id === 'string' && uuidRegex.test(id));
        
        // Hanya query ke MySQL jika ada ID yang valid
        const doctors = validDoctorIds.length ? await Doctor.findAll({
            where: { id: validDoctorIds },
            attributes: ['id', 'name', 'specialization', 'title_prefix', 'title_suffix'],
            raw: true
        }) : [];

        const doctorMap = {};
        doctors.forEach(d => {
            doctorMap[d.id] = {
                ...d,
                _id: d.id,
                name: d.name
            };
        });

        // Map doctor info ke threads, jika tidak ditemukan tetap tampilkan dengan ID
        threads = threads.map(t => {
            const doctorInfo = doctorMap[t.doctorId];
            return {
                ...t,
                doctorId: doctorInfo || { 
                    id: t.doctorId, 
                    name: 'Dokter',
                    specialization: '-'
                }
            };
        });

        res.json({ success: true, threads });
    } catch (err) {
        console.error('[admin] GET /chat/threads error:', err);
        // Jangan throw error, tetap kirim response dengan threads kosong
        res.json({ success: true, threads: [] });
    }
});

router.get('/chat/:doctorId', guard, async (req, res) => {
    try {
        const { doctorId } = req.params;
        
        // Validasi format doctorId (harus UUID)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(doctorId)) {
            return res.status(400).json({ success: false, message: 'Format ID dokter tidak valid' });
        }
        
        let thread = await AdminChat.findOne({ doctorId }).lean();
        
        // Verify doctor exists in MySQL
        const doctor = await Doctor.findByPk(doctorId);
        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Dokter tidak ditemukan' });
        }
        
        if (!thread) {
            thread = { doctorId: doctor.id, doctorUserId: doctor.user_id, messages: [] };
        }

        res.json({ success: true, messages: thread.messages || [], doctorId });
    } catch (err) {
        console.error('[admin] GET /chat/:doctorId error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

router.post('/chat/:doctorId', guard, uploadChatFile.single('file'), async (req, res) => {
    try {
        const { doctorId } = req.params;
        const { text } = req.body;
        
        if (!text?.trim() && !req.file) {
            return res.status(400).json({ success: false, message: 'Pesan atau file wajib ada' });
        }
        
        // Validasi format doctorId
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(doctorId)) {
            return res.status(400).json({ success: false, message: 'Format ID dokter tidak valid' });
        }

        const doctor = await Doctor.findByPk(doctorId, {
            include: [{ model: User, as: 'user', attributes: ['id', 'name'] }],
        });
        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Dokter tidak ditemukan' });
        }

        const doctorJson = doctor.toJSON();
        const doctorUserId = doctorJson.user?.id || doctor.user_id;

        let fileUrl = null, fileName = null, fileType = null;
        if (req.file) {
            fileUrl = `/uploads/admin-chat/${req.file.filename}`;
            fileName = req.file.originalname;
            fileType = req.file.mimetype.startsWith('image/') ? 'image' : 'file';
        }

        const msg = {
            senderId: req.userId,
            senderRole: 'admin',
            text: text?.trim() || '',
            fileUrl,
            fileName,
            fileType,
            isRead: false,
            createdAt: new Date(),
        };

        await AdminChat.findOneAndUpdate(
            { doctorId },
            {
                $push: { messages: msg },
                $set: { lastMessage: text?.trim() || `📎 ${fileName}`, lastAt: new Date(), adminId: req.userId },
                $inc: { unreadDoctor: 1 },
                $setOnInsert: { doctorUserId },
            },
            { upsert: true, new: true }
        );

        if (doctorUserId) {
            await createNotification({
                userId: doctorUserId,
                type: 'new_message',
                title: '💬 Pesan dari Admin',
                message: text?.trim() || 'Admin mengirimkan file',
                data: { doctorId },
                io: req.app.get('io'),
            });

            const io = req.app.get('io');
            if (io) {
                io.to(`user-${doctorUserId}`).emit('admin-chat-message', {
                    doctorId,
                    message: msg,
                });
            }
        }

        res.json({ success: true, message: msg });
    } catch (err) {
        console.error('[admin] POST /chat/:doctorId error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

router.put('/chat/:doctorId/read', guard, async (req, res) => {
    try {
        const { doctorId } = req.params;
        
        // Validasi format doctorId
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(doctorId)) {
            return res.status(400).json({ success: false, message: 'Format ID dokter tidak valid' });
        }
        
        await AdminChat.findOneAndUpdate(
            { doctorId },
            {
                $set: { unreadAdmin: 0, 'messages.$[elem].isRead': true },
            },
            { arrayFilters: [{ 'elem.senderRole': 'doctor', 'elem.isRead': false }] }
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[admin] PUT /chat/:doctorId/read error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

router.put('/chat/:doctorId/read', guard, async (req, res) => {
    try {
        await AdminChat.findOneAndUpdate(
            { doctorId: req.params.doctorId },
            {
                $set: { unreadAdmin: 0, 'messages.$[elem].isRead': true },
            },
            { arrayFilters: [{ 'elem.senderRole': 'doctor', 'elem.isRead': false }] }
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[admin] PUT /chat/:doctorId/read error:', err);
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
});

module.exports = router;