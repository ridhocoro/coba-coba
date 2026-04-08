const fmtDoctorName = require('../utils/fmtDoctorName');
/**
 * /api/xendit
 *
 * POST /create-invoice          → buat Xendit invoice
 * GET  /status/:externalId      → cek status pembayaran
 * POST /webhook                 → callback Xendit (bayar berhasil)
 * POST /refund/:consultationId  → proses refund otomatis (internal/admin)
 *
 * Logika refund:
 * - paidAt < 7 hari lalu  → Xendit Refund API (instant)
 * - paidAt >= 7 hari lalu → Xendit Disbursement/Payout API (perlu nomor rekening)
 * - Semua refund 100% (biaya payment gateway ditanggung klinik, bukan dipotong dari pasien)
 */

const express    = require('express');
const { Order, Medicine, Payment, Doctor, User } = require('../models/mysql');
const router     = express.Router();
const axios      = require('axios');
const auth       = require('../middleware/auth');

const Consultation = require('../models/Consultation');
const mongoose     = require('mongoose');
const { populateFromMySQL } = require('../utils/hybridJoin');
const { createNotification } = require('../utils/notificationHelper');

const XENDIT_SECRET_KEY     = process.env.XENDIT_SECRET_KEY;
const XENDIT_CALLBACK_TOKEN = process.env.XENDIT_CALLBACK_TOKEN;
const FRONTEND_URL          = process.env.FRONTEND_URL || 'http://localhost:3000';
const REFUND_WINDOW_MS      = 7 * 24 * 60 * 60 * 1000; // 7 hari

const xenditHeaders = () => ({
    Authorization : 'Basic ' + Buffer.from(XENDIT_SECRET_KEY + ':').toString('base64'),
    'Content-Type': 'application/json',
});

// Daftar bank Xendit Disbursement yang didukung
const XENDIT_BANKS = [
    { code: 'BCA',       name: 'Bank Central Asia (BCA)' },
    { code: 'BNI',       name: 'Bank Negara Indonesia (BNI)' },
    { code: 'BRI',       name: 'Bank Rakyat Indonesia (BRI)' },
    { code: 'MANDIRI',   name: 'Bank Mandiri' },
    { code: 'PERMATA',   name: 'Bank Permata' },
    { code: 'CIMB',      name: 'CIMB Niaga' },
    { code: 'DANAMON',   name: 'Bank Danamon' },
    { code: 'OCBC',      name: 'OCBC NISP' },
    { code: 'MAYBANK',   name: 'Maybank' },
    { code: 'BTN',       name: 'Bank Tabungan Negara (BTN)' },
    { code: 'MUAMALAT',  name: 'Bank Muamalat' },
    { code: 'BSI',       name: 'Bank Syariah Indonesia (BSI)' },
    { code: 'JAGO',      name: 'Bank Jago' },
    { code: 'SEABANK',   name: 'SeaBank' },
    { code: 'NOBU',      name: 'Bank Nobu' },
];

// ── GET /banks ────────────────────────────────────────────────────────────────
router.get('/banks', (req, res) => {
    res.json({ success: true, banks: XENDIT_BANKS });
});

// ── POST /create-invoice ──────────────────────────────────────────────────────
router.post('/create-invoice', auth, async (req, res) => {
    try {
        const { amount, paymentType, referenceId, description } = req.body;

        if (!amount || !paymentType || !referenceId) {
            return res.status(400).json({ error: 'amount, paymentType, dan referenceId wajib diisi' });
        }

        const externalId = `INV-${paymentType.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substr(2,6).toUpperCase()}`;

        let payment = null;
        if (paymentType !== 'consultation') {
            payment = await Payment.create({
                userId: req.userId, xenditExternalId: externalId, // Diperbaiki
                amount, currency: 'idr', status: 'pending', paymentType, referenceId,
            });
        }

        if (paymentType === 'consultation') {
            const c = await Consultation.findById(referenceId);
            if (!c) return res.status(404).json({ error: 'Konsultasi tidak ditemukan' });
            if (c.userId.toString() !== req.userId) return res.status(403).json({ error: 'Akses ditolak' });
            if (c.status !== 'pending_payment') {
                return res.status(400).json({ error: `Status konsultasi: ${c.status}. Tidak bisa bayar.` });
            }
            c.xenditExternalId = externalId;
            c.amount = amount;
            await c.save();
        }

        const invoicePayload = {
            external_id         : externalId,
            amount,
            description         : description || `Pembayaran ${paymentType} – Klinik Pratama IPB`,
            invoice_duration    : 900,
            success_redirect_url: `${FRONTEND_URL}/payment/success?external_id=${externalId}`,
            failure_redirect_url: `${FRONTEND_URL}/payment/failed?external_id=${externalId}`,
            currency            : 'IDR',
            payment_methods     : ['BCA','BNI','BRI','MANDIRI','PERMATA','OVO','DANA','SHOPEEPAY','LINKAJA','QRIS'],
        };

        const xenditRes = await axios.post('https://api.xendit.co/v2/invoices', invoicePayload, { headers: xenditHeaders() });
        const invoice   = xenditRes.data;

        if (payment) { payment.stripePaymentIntentId = invoice.id; await payment.save(); }
        if (paymentType === 'consultation') {
            await Consultation.findByIdAndUpdate(referenceId, { xenditInvoiceId: invoice.id, xenditExternalId: externalId });
        }

        res.json({ success: true, invoiceUrl: invoice.invoice_url, externalId, invoiceId: invoice.id, expiryDate: invoice.expiry_date });
    } catch (err) {
        console.error('[Xendit] create-invoice:', err.response?.data || err.message);
        res.status(500).json({ error: 'Gagal membuat invoice: ' + (err.response?.data?.message || err.message) });
    }
});

// ── POST /initiate-payment/:consultationId ────────────────────────────────────
router.post('/initiate-payment/:consultationId', auth, async (req, res) => {
    try {
        const consultation = await Consultation.findById(req.params.consultationId);
        if (!consultation)
            return res.status(404).json({ message: 'Konsultasi tidak ditemukan' });

        if (consultation.userId.toString() !== req.userId)
            return res.status(403).json({ message: 'Akses ditolak' });

        if (consultation.status !== 'pending_payment')
            return res.status(400).json({
                message: `Status konsultasi: ${consultation.status}. Tidak bisa bayar.`
            });

        const doctor = await Doctor.findByPk(consultation.doctorId);
        if (!doctor)
            return res.status(404).json({ message: 'Dokter tidak ditemukan' });

        const amount = consultation.amount || doctor.consultationFee;
        if (!amount)
            return res.status(400).json({ message: 'Biaya konsultasi tidak ditemukan' });

        const externalId = `INV-CONSULTATION-${Date.now()}-${Math.random().toString(36).substr(2,6).toUpperCase()}`;

        const invoicePayload = {
            external_id         : externalId,
            amount,
            description         : `Konsultasi dengan ${fmtDoctorName(doctor)} – Klinik Pratama IPB`,
            invoice_duration    : 900,
            success_redirect_url: `${FRONTEND_URL}/payment/success?external_id=${externalId}`,
            failure_redirect_url: `${FRONTEND_URL}/payment/failed?external_id=${externalId}`,
            currency            : 'IDR',
            payment_methods     : ['BCA','BNI','BRI','MANDIRI','PERMATA','OVO','DANA','SHOPEEPAY','LINKAJA','QRIS'],
        };

        const xenditRes = await axios.post(
            'https://api.xendit.co/v2/invoices',
            invoicePayload,
            { headers: xenditHeaders() }
        );
        const invoice = xenditRes.data;

        consultation.xenditExternalId = externalId;
        consultation.xenditInvoiceId  = invoice.id;
        consultation.amount           = amount;
        await consultation.save();

        res.json({
            success   : true,
            invoiceUrl: invoice.invoice_url,
            externalId,
            invoiceId : invoice.id,
        });
    } catch (err) {
        console.error('[Xendit] initiate-payment:', err.response?.data || err.message);
        res.status(400).json({
            message: err.response?.data?.message || err.message || 'Gagal membuat invoice'
        });
    }
});

// ── GET /status/:externalId ───────────────────────────────────────────────────
router.get('/status/:externalId', auth, async (req, res) => {
    try {
        const { externalId } = req.params;

        const consultation = await Consultation.findOne({ xenditExternalId: externalId });
        if (consultation) {
            if (['confirmed','in_progress','completed'].includes(consultation.status)) {
                return res.json({ success: true, status: 'paid', type: 'consultation', consultation });
            }
        }

        const payment = await Payment.findOne({ where: { xenditExternalId: externalId } }); // Diperbaiki
        if (payment?.status === 'paid') {
            return res.json({ success: true, status: 'paid', type: payment.paymentType, payment });
        }

        const xenditRes = await axios.get(
            `https://api.xendit.co/v2/invoices?external_id=${externalId}`,
            { headers: xenditHeaders() }
        );
        const invoices = xenditRes.data;

        if (invoices?.length > 0) {
            const invoice = invoices[0];
            const io = req.app.get('io');
            if (invoice.status === 'PAID') {
                if (consultation && !['confirmed','in_progress','completed'].includes(consultation.status)) {
                    await handleConsultationPaid(consultation, invoice, io);
                }
                if (payment && payment.status !== 'paid') {
                    await handlePaymentPaid(payment, invoice, io);
                }
                return res.json({ success: true, status: 'paid' });
            }
            return res.json({ success: true, status: invoice.status.toLowerCase() });
        }

        res.json({ success: true, status: consultation?.status || payment?.status || 'pending' });
    } catch (err) {
        console.error('[Xendit] status check:', err.response?.data || err.message);
        res.status(500).json({ error: 'Gagal cek status: ' + err.message });
    }
});

// ── POST /webhook ─────────────────────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
    try {
        const token = req.headers['x-callback-token'];
        if (XENDIT_CALLBACK_TOKEN && token !== XENDIT_CALLBACK_TOKEN) {
            console.warn('[Xendit] Invalid callback token');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const event = req.body;
        console.log('[Xendit] Webhook:', event.event || event.status, event.external_id);

        if (event.status === 'PAID' || event.event === 'invoice.paid') {
            const externalId = event.external_id;
            const io = req.app.get('io');

            const consultation = await Consultation.findOne({ xenditExternalId: externalId });
            if (consultation && consultation.status === 'pending_payment') {
                await handleConsultationPaid(consultation, event, io);
            }

            const payment = await Payment.findOne({ where: { xenditExternalId: externalId } }); // Diperbaiki
            if (payment && payment.status !== 'paid') {
                await handlePaymentPaid(payment, event, io);
            }
        }

        res.status(200).json({ success: true });
    } catch (err) {
        console.error('[Xendit] Webhook error:', err);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

// ── POST /refund/:consultationId ──────────────────────────────────────────────
router.post('/refund/:consultationId', auth, async (req, res) => {
    try {
        if (req.userRole !== 'admin') {
            return res.status(403).json({ error: 'Akses ditolak — hanya admin' });
        }

        const consultation = await Consultation.findById(req.params.consultationId);
        if (!consultation) return res.status(404).json({ error: 'Konsultasi tidak ditemukan' });

        const refundableStatuses = ['refund_requested', 'cancelled_by_user', 'cancelled_by_doctor', 'cancelled_by_admin', 'doctor_no_show'];
        if (!refundableStatuses.includes(consultation.status)) {
            return res.status(400).json({ error: `Status ${consultation.status} tidak bisa direfund` });
        }

        const _docInfo = await populateFromMySQL({ doctorId: consultation.doctorId }, 'doctorId', 'Doctor', 'consultationFee name titlePrefix titleSuffix');
        const doctorInfo = _docInfo?.doctorId;
        const amount = consultation.amount || doctorInfo?.consultationFee;
        if (!amount) return res.status(400).json({ error: 'Nominal refund tidak diketahui' });

        const paidAt     = consultation.paidAt ? new Date(consultation.paidAt) : null;
        const isWithin7d = paidAt && (Date.now() - paidAt.getTime()) < REFUND_WINDOW_MS;

        let refundMethod, refundResult;

        if (isWithin7d && consultation.xenditInvoiceId) {
            try {
                const refundRes = await axios.post(
                    'https://api.xendit.co/refunds',
                    {
                        invoice_id       : consultation.xenditInvoiceId,
                        reason           : 'CANCELLATION',
                        amount,
                        metadata         : { consultationId: consultation.id.toString() },
                    },
                    {
                        headers: {
                            ...xenditHeaders(),
                            'idempotency-key': `REFUND-${consultation.id}-${Date.now()}`,
                        },
                    }
                );
                refundMethod = 'xendit_refund';
                refundResult = refundRes.data;
                consultation.xenditRefundId = refundResult.id;
                console.log(`[Xendit] Refund API success: ${refundResult.id} for consultation ${consultation.id}`);
            } catch (refundErr) {
                console.warn('[Xendit] Refund API failed, falling back to disbursement:', refundErr.response?.data?.message);
                refundMethod = 'xendit_disbursement';
            }
        } else {
            refundMethod = 'xendit_disbursement';
        }

        if (refundMethod === 'xendit_disbursement') {
            const { bankCode, accountNumber, accountName } = req.body;
            if (!bankCode || !accountNumber || !accountName) {
                return res.status(400).json({
                    error           : 'Data rekening diperlukan untuk refund',
                    needsBankInfo   : true,
                    message         : 'Pembayaran lebih dari 7 hari lalu. Silakan masukkan data rekening untuk menerima refund.',
                });
            }

            const disbTimestamp = Date.now();
            const disbExternalId = `DISB-${consultation.id}-${disbTimestamp}`;

            const disbursementRes = await axios.post(
                'https://api.xendit.co/disbursements',
                {
                    external_id          : disbExternalId,
                    bank_code            : bankCode,
                    account_holder_name  : accountName,
                    account_number       : accountNumber,
                    description          : `Refund konsultasi ${consultation.id}`,
                    amount,
                },
                {
                    headers: {
                        ...xenditHeaders(),
                        'X-IDEMPOTENCY-KEY': disbExternalId,
                    },
                }
            );
            refundResult = disbursementRes.data;
            consultation.refund = {
                ...consultation.refund?.toObject?.() || {},
                bankCode, accountNumber, accountName,
                xenditDisbursementId : refundResult.id,
                method               : 'xendit_disbursement',
                requestedAt          : consultation.refund?.requestedAt || new Date(),
                processedAt          : new Date(),
            };
            console.log(`[Xendit] Disbursement success: ${refundResult.id} for consultation ${consultation.id}`);
        }

        if (refundMethod === 'xendit_refund') {
            consultation.refund = {
                ...consultation.refund?.toObject?.() || {},
                xenditRefundId : consultation.xenditRefundId,
                method         : 'xendit_refund',
                requestedAt    : consultation.refund?.requestedAt || new Date(),
                processedAt    : new Date(),
            };
        }

        consultation.status = 'refunded';
        await consultation.save();

        const eta = refundMethod === 'xendit_refund'
            ? 'dalam beberapa menit hingga 1 hari kerja'
            : 'dalam 1x24 jam';

        await createNotification({
            userId : consultation.userId,
            type   : 'refund_processed',
            title  : '💰 Refund Berhasil Diproses',
            message: `Refund Rp ${amount.toLocaleString('id-ID')} sedang diproses dan akan masuk ke rekening Anda ${eta}.`,
            data   : { consultationId: consultation.id },
            io     : req.app.get('io'),
        });

        res.json({ success: true, method: refundMethod, amount, consultation });
    } catch (err) {
        console.error('[Xendit] refund error:', err.response?.data || err.message);
        res.status(500).json({ error: 'Gagal proses refund: ' + (err.response?.data?.message || err.message) });
    }
});

// ════════════════════════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ════════════════════════════════════════════════════════════════════════════

const handleConsultationPaid = async (consultation, xenditEvent, io) => {
    try {
        consultation.status              = 'confirmed';
        consultation.paymentVerified     = true;
        consultation.verifiedAt          = new Date();
        consultation.paidAt              = new Date(xenditEvent.paid_at || Date.now());
        consultation.xenditPaymentMethod = xenditEvent.payment_method || xenditEvent.payment_channel || '';
        await consultation.save();

        await createNotification({
            userId : consultation.userId,
            type   : 'payment_verified',
            title  : 'Pembayaran Berhasil ✅',
            message: `Konsultasi Anda telah dikonfirmasi. Jadwal: ${_fmtDate(consultation.scheduledAt)}`,
            data   : { consultationId: consultation.id },
            io,
        });

        const doctor = await Doctor.findByPk(consultation.doctorId);
        if (doctor) {
            const doctorUser = await User.findByPk(doctor.userId);
            if (doctorUser) {
                await createNotification({
                    userId : doctorUser.id,
                    type   : 'consultation_request',
                    title  : 'Booking Konsultasi Baru 📅',
                    message: `Pasien telah melakukan pembayaran. Jadwal: ${_fmtDate(consultation.scheduledAt)}`,
                    data   : { consultationId: consultation.id },
                    io,
                });
            }
        }

        if (io) {
            io.to(`user-${consultation.userId}`).emit('consultation-status-update', {
                consultationId: consultation.id.toString(),
                status        : 'confirmed',
            });
        }
        console.log(`[Xendit] Consultation ${consultation.id} → confirmed`);
    } catch (err) {
        console.error('[Xendit] handleConsultationPaid:', err.message);
    }
};

const handlePaymentPaid = async (payment, xenditEvent, io) => {
    try {
        payment.status        = 'paid';
        payment.paymentMethod = xenditEvent.payment_method || xenditEvent.payment_channel;
        payment.paidAt        = new Date(xenditEvent.paid_at || Date.now());
        await payment.save();

        if (payment.paymentType === 'medicine') {
            const order = await Order.findByPk(payment.referenceId);
            if (order && order.status === 'pending') {
                for (const item of order.items) {
                    await Medicine.findByIdAndUpdate(item.medicineId, {
                        $inc: { stock: -item.quantity, lockedStock: -item.quantity },
                    });
                }
                order.status = 'paid'; order.updatedAt = new Date();
                await order.save();
                await createNotification({
                    userId : order.userId,
                    type   : 'payment_verified',
                    title  : 'Pembayaran Pesanan Berhasil ✅',
                    message: `Pembayaran pesanan ${order.orderNumber} berhasil. Admin akan segera menyiapkan obat Anda.`,
                    data   : { orderId: order.id },
                    io,
                });
                if (io) io.to(`user-${order.userId}`).emit('order-status-update', { orderId: order.id.toString(), status: 'paid' });

                try {
                    const admins = await User.findAll({ where: { role: 'admin' }, attributes: ['id'] });
                    for (const admin of admins) {
                        await createNotification({
                            userId : admin.id,
                            type   : 'order_shipped',
                            title  : '🛒 Pesanan Baru Masuk',
                            message: `Pesanan ${order.orderNumber} sudah dibayar dan menunggu diproses.`,
                            data   : { orderId: order.id },
                            io,
                        });
                    }
                } catch (e) { console.error('[Xendit] admin notif error:', e.message); }
            }
        }

        await createNotification({
            userId : payment.userId,
            type   : 'payment_verified',
            title  : 'Pembayaran Berhasil ✅',
            message: `Pembayaran Rp ${(payment.amount || 0).toLocaleString('id-ID')} telah dikonfirmasi.`,
            data   : { paymentId: payment.id },
            io,
        });
        console.log(`[Xendit] Payment ${payment.id} → paid`);
    } catch (err) {
        console.error('[Xendit] handlePaymentPaid:', err.message);
    }
};

const _fmtDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleString('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
    }) + ' WIB';
};


// ── GET /history ──────────────────────────────────────────────────────────────
router.get('/history', auth, async (req, res) => {
    try {
        const paidStatuses = [
            'confirmed', 'in_progress', 'completed', 'no_show',
            'doctor_no_show', 'cancelled_by_doctor', 'cancelled_by_admin',
            'cancelled_by_user', 'refund_requested', 'refunded',
        ];

        let userObjectId;
        try {
            userObjectId = new mongoose.Types.ObjectId(req.userId);
        } catch {
            userObjectId = req.userId;
        }

        let consultations = [];
        try {
            consultations = await Consultation.find({
                $or: [
                    { userId: userObjectId },
                    { userId: req.userId },
                ],
                status           : { $in: paidStatuses },
                xenditExternalId : { $exists: true, $ne: null },
            })
            .sort({ paidAt: -1, createdAt: -1 })
            .lean();
        } catch (mongoErr) {
            console.error('[Xendit] /history MongoDB error:', mongoErr.message);
            consultations = [];
        }

        let consultationItems = [];
        if (consultations.length > 0) {
            try {
                consultations = await populateFromMySQL(
                    consultations, 'doctorId', 'Doctor', 'name specialization titlePrefix titleSuffix'
                );
            } catch (popErr) {
                console.error('[Xendit] /history populateFromMySQL error:', popErr.message);
            }

            consultationItems = consultations.map(c => ({
                _id            : c._id,
                transactionId  : c.xenditExternalId,
                paymentType    : 'consultation',
                amount         : c.amount || 0,
                status         : ['confirmed', 'in_progress', 'completed', 'no_show'].includes(c.status)
                                 ? 'paid'
                                 : c.status === 'refunded' ? 'refunded' : 'paid',
                paymentMethod  : c.xenditPaymentMethod || 'Xendit',
                paidAt         : c.paidAt,
                createdAt      : c.createdAt,
                doctorName     : [c.doctorId?.titlePrefix, c.doctorId?.name, c.doctorId?.titleSuffix].filter(Boolean).join(' ') || null,
                doctorSpec     : c.doctorId?.specialization || null,
                consultationId : c._id,
            }));
        }

        let orderItems = [];
        try {
            const orderPayments = await Payment.findAll({
                where : { userId: req.userId },
                order : [['created_at', 'DESC']], // Diperbaiki: createdAt jadi created_at
                raw   : true,
            });

            orderItems = orderPayments.map(p => ({
                _id           : p.id,
                transactionId : p.xenditExternalId, // Diperbaiki
                paymentType   : p.paymentType || 'medicine',
                amount        : p.amount || 0,
                status        : p.status,
                paymentMethod : p.paymentMethod || 'Xendit',
                paidAt        : p.paidAt,
                createdAt     : p.createdAt,
            }));
        } catch (sqlErr) {
            console.error('[Xendit] /history Payment.findAll error:', sqlErr.message);
        }

        const all = [...consultationItems, ...orderItems]
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        res.json({ success: true, payments: all });
    } catch (err) {
        console.error('[Xendit] /history error:', err.message, err.stack);
        res.status(500).json({ error: 'Gagal memuat riwayat: ' + err.message });
    }
});

module.exports = router;
module.exports.handleConsultationPaid = handleConsultationPaid;
module.exports.XENDIT_BANKS = XENDIT_BANKS;