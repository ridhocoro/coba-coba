const express = require('express');
const router = express.Router();
const SickLetter = require('../models/SickLetter');
const Doctor = require('../models/Doctor');
const auth = require('../middleware/auth');
const PDFDocument = require('pdfkit');

// GET user sick letters
router.get('/my-letters', auth, async (req, res) => {
    try {
        const letters = await SickLetter.find({ userId: req.userId })
            .populate('doctorId', 'name specialization')
            .populate('paymentId')
            .sort('-createdAt');
        res.json(letters);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// CREATE sick letter request (TANPA STRIPE)
router.post('/request', auth, async (req, res) => {
    try {
        const { patientName, patientAge, startDate, endDate, diagnosis, doctorNotes } = req.body;
        
        const doctor = await Doctor.findOne({ specialization: 'Umum', isActive: true });
        
        const sickLetter = new SickLetter({
            userId: req.userId,
            doctorId: doctor?._id,
            patientName,
            patientAge,
            startDate,
            endDate,
            diagnosis,
            doctorNotes,
            status: 'pending',
            letterNumber: 'SK-' + Date.now()
        });

        await sickLetter.save();

        res.json({
            sickLetter,
            amount: 50000 // Fixed price
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Generate PDF surat sakit
router.get('/:id/pdf', auth, async (req, res) => {
    try {
        const sickLetter = await SickLetter.findById(req.params.id)
            .populate('userId', 'name')
            .populate('doctorId', 'name');

        if (!sickLetter) {
            return res.status(404).json({ message: 'Surat tidak ditemukan' });
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
        doc.text(`Nama Pasien: ${sickLetter.patientName || sickLetter.userId?.name}`);
        doc.text(`Usia: ${sickLetter.patientAge} tahun`);
        doc.moveDown();
        doc.text(`Berdasarkan hasil pemeriksaan, pasien tersebut di atas menderita:`);
        doc.text(`${sickLetter.diagnosis}`);
        doc.moveDown();
        doc.text(`Oleh karena itu, pasien memerlukan istirahat selama:`);
        const days = Math.ceil((new Date(sickLetter.endDate) - new Date(sickLetter.startDate)) / (1000 * 60 * 60 * 24)) + 1;
        doc.text(`${days} hari, dari tanggal ${new Date(sickLetter.startDate).toLocaleDateString('id-ID')} sampai ${new Date(sickLetter.endDate).toLocaleDateString('id-ID')}.`);
        doc.moveDown(2);
        doc.text(`Demikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.`);
        doc.moveDown(3);
        doc.text(`Bogor, ${new Date().toLocaleDateString('id-ID')}`);
        doc.moveDown();
        doc.text(`Dokter,`);
        doc.moveDown(3);
        doc.text(`(dr. ${sickLetter.doctorId?.name || 'Dokter Klinik'})`);
        
        doc.end();

        sickLetter.status = 'issued';
        sickLetter.pdfUrl = `/api/sick-letters/${sickLetter._id}/pdf`;
        await sickLetter.save();

    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Update after payment
router.put('/:id/payment-success', auth, async (req, res) => {
    try {
        const sickLetter = await SickLetter.findById(req.params.id);
        sickLetter.status = 'paid';
        sickLetter.paymentId = req.body.paymentId;
        await sickLetter.save();
        res.json(sickLetter);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;