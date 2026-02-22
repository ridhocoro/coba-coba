const express = require('express');
const router = express.Router();
const Consultation = require('../models/Consultation');
const Doctor = require('../models/Doctor');
const SickLetter = require('../models/SickLetter');
const User = require('../models/User');
const auth = require('../middleware/auth');
const doctorAuth = require('../middleware/doctorAuth');
const PDFDocument = require('pdfkit');
const { createNotification } = require('../utils/notificationHelper');

// ========== 1. ROUTE STATIS (PALING SPESIFIK) ==========
// Get all consultations for user
router.get('/my-consultations', auth, async (req, res) => {
    try {
        const consultations = await Consultation.find({ userId: req.userId })
            .populate('doctorId', 'name specialization consultationFee')
            .populate('paymentId')
            .populate({
                path: 'sickLetter',
                select: 'letterNumber diagnosis status pdfUrl'
            })
            .sort('-createdAt');
        res.json(consultations);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ✅ ROUTE DOCTOR/PENDING - HARUS SEBELUM /:id
router.get('/doctor/pending', auth, doctorAuth, async (req, res) => {
    try {
        console.log('🔍 Fetching pending consultations for doctor:', req.userId);
        
        // Cari data dokter berdasarkan userId
        const doctor = await Doctor.findOne({ userId: req.userId });
        
        if (!doctor) {
            console.log('❌ Doctor not found for user:', req.userId);
            return res.status(404).json({ 
                success: false,
                message: 'Data dokter tidak ditemukan. Pastikan Anda terdaftar sebagai dokter.' 
            });
        }

        // Cari konsultasi dengan status paid atau ongoing
        const consultations = await Consultation.find({ 
            doctorId: doctor._id,
            status: { $in: ['paid', 'ongoing'] }
        })
        .populate('userId', 'name email phone')
        .sort('-createdAt');

        console.log(`✅ Found ${consultations.length} consultations`);

        return res.json({
            success: true,
            count: consultations.length,
            consultations
        });
    } catch (error) {
        console.error('❌ Error in /doctor/pending:', error);
        return res.status(500).json({ 
            success: false,
            message: 'Server error',
            error: error.message 
        });
    }
});

// ========== 2. ROUTE DENGAN PARAMETER DI TENGAH ==========
// Create consultation
router.post('/create', auth, async (req, res) => {
    try {
        const { doctorId, symptoms } = req.body;
        
        const doctor = await Doctor.findById(doctorId);
        if (!doctor) {
            return res.status(404).json({ message: 'Doctor not found' });
        }

        const consultation = new Consultation({
            userId: req.userId,
            doctorId,
            symptoms,
            status: 'pending'
        });

        await consultation.save();

        const doctorUser = await User.findById(doctor.userId);
        if (doctorUser) {
            await createNotification({
                userId: doctorUser._id,
                type: 'consultation_request',
                title: 'Permintaan Konsultasi Baru',
                message: `Ada pasien baru yang meminta konsultasi dengan Anda`,
                data: { 
                    consultationId: consultation._id,
                    doctorId: doctor._id,
                    url: `/consultations/${consultation._id}`
                },
                io: req.app.get('io')
            });
        }

        res.json({ 
            consultation,
            amount: doctor.consultationFee
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Send message
router.post('/:id/messages', auth, async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id)
            .populate('userId', 'name')
            .populate('doctorId', 'name');
        
        if (!consultation) {
            return res.status(404).json({ message: 'Consultation not found' });
        }
        
        const senderName = req.userId === consultation.userId._id.toString() 
            ? consultation.userId.name 
            : `dr. ${consultation.doctorId.name}`;
        
        consultation.messages.push({
            senderId: req.userId,
            senderName,
            message: req.body.message,
            timestamp: new Date()
        });
        
        await consultation.save();

        const recipientId = req.userId === consultation.userId._id.toString() 
            ? consultation.doctorId.userId 
            : consultation.userId._id;
        
        await createNotification({
            userId: recipientId,
            type: 'new_message',
            title: 'Pesan Baru',
            message: `${senderName} mengirim pesan: ${req.body.message.substring(0, 50)}${req.body.message.length > 50 ? '...' : ''}`,
            data: { 
                consultationId: consultation._id,
                url: `/consultations/${consultation._id}`
            },
            io: req.app.get('io')
        });

        res.json(consultation);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Start consultation
router.put('/:id/start', auth, async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id)
            .populate('userId', 'name')
            .populate('doctorId', 'name');
            
        if (consultation.userId.toString() !== req.userId && req.userRole !== 'doctor') {
            return res.status(403).json({ message: 'Unauthorized' });
        }
        
        consultation.status = 'ongoing';
        consultation.startTime = new Date();
        await consultation.save();
        
        if (req.userRole === 'user') {
            await createNotification({
                userId: consultation.doctorId.userId,
                type: 'consultation_started',
                title: 'Konsultasi Dimulai',
                message: `${consultation.userId.name} telah memulai konsultasi`,
                data: { 
                    consultationId: consultation._id,
                    url: `/consultations/${consultation._id}`
                },
                io: req.app.get('io')
            });
        } else {
            await createNotification({
                userId: consultation.userId._id,
                type: 'consultation_started',
                title: 'Konsultasi Dimulai',
                message: `dr. ${consultation.doctorId.name} telah bergabung`,
                data: { 
                    consultationId: consultation._id,
                    url: `/consultations/${consultation._id}`
                },
                io: req.app.get('io')
            });
        }
        
        res.json(consultation);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// End consultation
router.put('/:id/end', auth, async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id)
            .populate('userId', 'name')
            .populate('doctorId', 'name');
            
        if (consultation.userId.toString() !== req.userId && req.userRole !== 'doctor') {
            return res.status(403).json({ message: 'Unauthorized' });
        }
        
        consultation.status = 'completed';
        consultation.endTime = new Date();
        await consultation.save();
        
        const recipientId = req.userRole === 'user' 
            ? consultation.doctorId.userId 
            : consultation.userId._id;
            
        await createNotification({
            userId: recipientId,
            type: 'consultation_ended',
            title: 'Konsultasi Selesai',
            message: `Konsultasi dengan ${req.userRole === 'user' ? 'dr. ' + consultation.doctorId.name : consultation.userId.name} telah selesai`,
            data: { 
                consultationId: consultation._id,
                url: `/consultations/${consultation._id}`
            },
            io: req.app.get('io')
        });
        
        res.json(consultation);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Create sick letter
router.post('/:id/sick-letter', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { diagnosis, restDays, notes } = req.body;
        
        if (!diagnosis || !restDays) {
            return res.status(400).json({ 
                success: false, 
                message: 'Diagnosis dan jumlah hari istirahat harus diisi' 
            });
        }

        const consultation = await Consultation.findById(id)
            .populate('userId', 'name email')
            .populate('doctorId');
        
        if (!consultation) {
            return res.status(404).json({ 
                success: false, 
                message: 'Konsultasi tidak ditemukan' 
            });
        }

        const doctor = await Doctor.findOne({ userId: req.userId });
        if (!doctor || consultation.doctorId._id.toString() !== doctor._id.toString()) {
            return res.status(403).json({ 
                success: false, 
                message: 'Anda bukan dokter yang menangani konsultasi ini' 
            });
        }

        const existingSickLetter = await SickLetter.findOne({ consultationId: id });
        if (existingSickLetter) {
            return res.status(400).json({ 
                success: false, 
                message: 'Surat sakit sudah dibuat untuk konsultasi ini' 
            });
        }

        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + parseInt(restDays) - 1);

        const sickLetter = new SickLetter({
            consultationId: id,
            userId: consultation.userId._id,
            doctorId: doctor._id,
            diagnosis,
            notes: notes || '',
            startDate,
            endDate,
            status: 'draft'
        });

        await sickLetter.save();

        consultation.sickLetter = sickLetter._id;
        await consultation.save();

        await createNotification({
            userId: consultation.userId._id,
            type: 'sick_letter_draft',
            title: 'Surat Sakit Dibuat',
            message: `Dokter telah membuat surat sakit untuk Anda (menunggu diterbitkan)`,
            data: { 
                consultationId: consultation._id,
                sickLetterId: sickLetter._id,
                url: `/consultations/${consultation._id}`
            },
            io: req.app.get('io')
        });

        res.json({
            success: true,
            message: 'Surat sakit berhasil dibuat',
            sickLetter
        });

    } catch (error) {
        console.error('Error creating sick letter:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal membuat surat sakit',
            error: error.message 
        });
    }
});

// Issue sick letter
router.put('/:id/sick-letter/issue', auth, async (req, res) => {
    try {
        const { id } = req.params;
        
        const consultation = await Consultation.findById(id)
            .populate('userId', 'name email')
            .populate('doctorId');
        
        if (!consultation) {
            return res.status(404).json({ 
                success: false, 
                message: 'Konsultasi tidak ditemukan' 
            });
        }

        const doctor = await Doctor.findOne({ userId: req.userId });
        if (!doctor || consultation.doctorId._id.toString() !== doctor._id.toString()) {
            return res.status(403).json({ 
                success: false, 
                message: 'Anda bukan dokter yang menangani konsultasi ini' 
            });
        }

        const sickLetter = await SickLetter.findOne({ consultationId: id });
        if (!sickLetter) {
            return res.status(404).json({ 
                success: false, 
                message: 'Surat sakit tidak ditemukan' 
            });
        }

        sickLetter.status = 'issued';
        sickLetter.issuedAt = new Date();
        await sickLetter.save();

        await createNotification({
            userId: consultation.userId._id,
            type: 'sick_letter_issued',
            title: 'Surat Sakit Telah Terbit',
            message: `Surat sakit Anda telah diterbitkan oleh dr. ${consultation.doctorId.name}`,
            data: { 
                consultationId: consultation._id,
                sickLetterId: sickLetter._id,
                url: `/consultations/${consultation._id}`
            },
            io: req.app.get('io')
        });

        res.json({
            success: true,
            message: 'Surat sakit berhasil diterbitkan',
            sickLetter
        });

    } catch (error) {
        console.error('Error issuing sick letter:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal menerbitkan surat sakit',
            error: error.message 
        });
    }
});

// Get PDF
router.get('/:id/sick-letter/pdf', auth, async (req, res) => {
    try {
        const { id } = req.params;
        
        const consultation = await Consultation.findById(id)
            .populate('userId', 'name')
            .populate('doctorId', 'name')
            .populate('sickLetter');
        
        if (!consultation) {
            return res.status(404).json({ 
                success: false, 
                message: 'Konsultasi tidak ditemukan' 
            });
        }

        const isUser = consultation.userId._id.toString() === req.userId;
        const isDoctor = consultation.doctorId._id.toString() === req.userId;
        
        if (!isUser && !isDoctor && req.userRole !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                message: 'Akses ditolak' 
            });
        }

        const sickLetter = consultation.sickLetter;
        if (!sickLetter) {
            return res.status(404).json({ 
                success: false, 
                message: 'Surat sakit tidak ditemukan' 
            });
        }

        const doc = new PDFDocument();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=sick-letter-${sickLetter.letterNumber}.pdf`);
        
        doc.pipe(res);
        
        doc.fontSize(20).text('SURAT KETERANGAN SAKIT', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Nomor: ${sickLetter.letterNumber}`, { align: 'center' });
        doc.moveDown(2);
        
        doc.text(`Yang bertanda tangan di bawah ini, dokter pada Klinik Pratama IPB, menerangkan bahwa:`);
        doc.moveDown();
        doc.text(`Nama Pasien: ${consultation.userId.name}`);
        doc.text(`Diagnosis: ${sickLetter.diagnosis}`);
        doc.moveDown();
        doc.text(`Berdasarkan hasil konsultasi online pada tanggal ${new Date(consultation.createdAt).toLocaleDateString('id-ID')},`);
        doc.text(`pasien memerlukan istirahat selama:`);
        const days = Math.ceil((sickLetter.endDate - sickLetter.startDate) / (1000 * 60 * 60 * 24)) + 1;
        doc.text(`${days} hari, dari tanggal ${sickLetter.startDate.toLocaleDateString('id-ID')} sampai ${sickLetter.endDate.toLocaleDateString('id-ID')}.`);
        doc.moveDown();
        
        if (sickLetter.notes) {
            doc.text(`Catatan: ${sickLetter.notes}`);
            doc.moveDown();
        }
        
        doc.moveDown(2);
        doc.text(`Demikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.`);
        doc.moveDown(3);
        doc.text(`Bogor, ${new Date().toLocaleDateString('id-ID')}`);
        doc.moveDown();
        doc.text(`Dokter,`);
        doc.moveDown(3);
        doc.text(`(dr. ${consultation.doctorId.name})`);
        
        doc.end();

    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Gagal generate PDF',
            error: error.message 
        });
    }
});

// ✅ ROUTE DELETE - Hapus konsultasi (hanya jika status pending)
router.delete('/:id', auth, async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id);
        
        if (!consultation) {
            return res.status(404).json({ 
                success: false,
                message: 'Consultation not found' 
            });
        }

        // Cek apakah user yang membuat konsultasi
        if (consultation.userId.toString() !== req.userId) {
            return res.status(403).json({ 
                success: false,
                message: 'Unauthorized' 
            });
        }

        // Hanya boleh hapus jika status pending
        if (consultation.status !== 'pending') {
            return res.status(400).json({ 
                success: false,
                message: 'Cannot delete consultation that is already processing' 
            });
        }

        await Consultation.findByIdAndDelete(req.params.id);
        
        res.json({ 
            success: true, 
            message: 'Consultation deleted successfully' 
        });
    } catch (error) {
        console.error('Error deleting consultation:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error' 
        });
    }
});

// ✅ ATAU ALTERNATIF: Cancel consultation (ubah status jadi cancelled)
router.put('/:id/cancel', auth, async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id);
        
        if (!consultation) {
            return res.status(404).json({ 
                success: false,
                message: 'Consultation not found' 
            });
        }

        if (consultation.userId.toString() !== req.userId) {
            return res.status(403).json({ 
                success: false,
                message: 'Unauthorized' 
            });
        }

        // Hanya boleh cancel jika status pending
        if (consultation.status !== 'pending') {
            return res.status(400).json({ 
                success: false,
                message: 'Cannot cancel consultation that is already processing' 
            });
        }

        consultation.status = 'cancelled';
        await consultation.save();
        
        res.json({ 
            success: true, 
            message: 'Consultation cancelled successfully' 
        });
    } catch (error) {
        console.error('Error cancelling consultation:', error);
        res.status(500).json({ 
            success: false,
            message: 'Server error' 
        });
    }
});

// ========== 3. ROUTE PARAMETER GENERIK (PALING BAWAH) ==========
// Get single consultation
router.get('/:id', auth, async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.id)
            .populate('userId', 'name email')
            .populate('doctorId', 'name specialization photo')
            .populate('paymentId')
            .populate({
                path: 'sickLetter',
                select: 'letterNumber diagnosis status pdfUrl startDate endDate'
            });
        
        if (!consultation) {
            return res.status(404).json({ message: 'Consultation not found' });
        }
        
        const isUser = consultation.userId._id.toString() === req.userId;
        const isDoctor = consultation.doctorId._id.toString() === req.userId;
        
        if (!isUser && !isDoctor && req.userRole !== 'admin') {
            return res.status(403).json({ message: 'Unauthorized' });
        }
        
        res.json(consultation);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;