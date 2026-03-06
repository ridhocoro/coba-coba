/**
 * /api/xendit
 *
 * POST   /create-invoice          → buat Xendit invoice (consultation / medicine / appointment)
 * GET    /status/:externalId      → cek status pembayaran
 * POST   /webhook                 → callback dari Xendit (otomatis saat bayar berhasil)
 * POST   /refund/:consultationId  → trigger refund manual (placeholder) untuk doctor_no_show
 */

const express    = require('express');
const router     = express.Router();
const axios      = require('axios');
const auth       = require('../middleware/auth');

const Consultation = require('../models/Consultation');
const Order        = require('../models/Order');
const Medicine     = require('../models/Medicine');
const Payment      = require('../models/Payment');
const Doctor       = require('../models/Doctor');
const User         = require('../models/User');
const { createNotification } = require('../utils/notificationHelper');

const XENDIT_SECRET_KEY    = process.env.XENDIT_SECRET_KEY;
const XENDIT_CALLBACK_TOKEN = process.env.XENDIT_CALLBACK_TOKEN;
const FRONTEND_URL         = process.env.FRONTEND_URL || 'http://localhost:3000';

const WIB_OFFSET = 7 * 60 * 60 * 1000;

// ── Header Basic Auth Xendit ─────────────────────────────────────────────────
const xenditHeaders = () => ({
    Authorization : 'Basic ' + Buffer.from(XENDIT_SECRET_KEY + ':').toString('base64'),
    'Content-Type': 'application/json',
});

// ── POST /create-invoice ─────────────────────────────────────────────────────
router.post('/create-invoice', auth, async (req, res) => {
    try {
        const { amount, paymentType, referenceId, description } = req.body;

        if (!amount || !paymentType || !referenceId) {
            return res.status(400).json({ error: 'amount, paymentType, dan referenceId wajib diisi' });
        }

        const externalId = `INV-${paymentType.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substr(2,6).toUpperCase()}`;

        // Simpan record payment (untuk medicine/appointment)
        // Untuk consultation, xenditExternalId disimpan di Consultation sendiri
        let payment = null;
        if (paymentType !== 'consultation') {
            payment = new Payment({
                userId        : req.userId,
                transactionId : externalId,
                amount,
                currency      : 'idr',
                status        : 'pending',
                paymentType,
                referenceId,
            });
            await payment.save();
        }

        // Update consultation dengan externalId agar webhook bisa link
        if (paymentType === 'consultation') {
            const c = await Consultation.findById(referenceId);
            if (!c) return res.status(404).json({ error: 'Konsultasi tidak ditemukan' });
            if (c.userId.toString() !== req.userId) return res.status(403).json({ error: 'Akses ditolak' });
            if (c.status !== 'pending_payment') {
                return res.status(400).json({ error: `Status konsultasi saat ini: ${c.status}. Tidak bisa bayar.` });
            }
            c.xenditExternalId = externalId;
            await c.save();
        }

        // Buat Xendit invoice
        const invoicePayload = {
            external_id         : externalId,
            amount,
            description         : description || `Pembayaran ${paymentType} – Klinik Pratama IPB`,
            invoice_duration    : 900,   // 15 menit (sama dengan slot lock)
            success_redirect_url: `${FRONTEND_URL}/payment/success?external_id=${externalId}`,
            failure_redirect_url: `${FRONTEND_URL}/payment/failed?external_id=${externalId}`,
            currency            : 'IDR',
            payment_methods     : ['BCA','BNI','BRI','MANDIRI','PERMATA','OVO','DANA','SHOPEEPAY','LINKAJA','QRIS'],
        };

        const xenditRes  = await axios.post('https://api.xendit.co/v2/invoices', invoicePayload, { headers: xenditHeaders() });
        const invoice    = xenditRes.data;

        // Simpan xendit invoice id ke record payment (non-consultation)
        if (payment) {
            payment.stripePaymentIntentId = invoice.id;
            await payment.save();
        }

        // Simpan xendit invoice id ke consultation
        if (paymentType === 'consultation') {
            await Consultation.findByIdAndUpdate(referenceId, {
                xenditInvoiceId: invoice.id,
                xenditExternalId: externalId,
            });
        }

        res.json({
            success    : true,
            invoiceUrl : invoice.invoice_url,
            externalId,
            invoiceId  : invoice.id,
            expiryDate : invoice.expiry_date,
        });
    } catch (err) {
        console.error('[Xendit] create-invoice error:', err.response?.data || err.message);
        res.status(500).json({ error: 'Gagal membuat invoice: ' + (err.response?.data?.message || err.message) });
    }
});

// ── GET /status/:externalId ──────────────────────────────────────────────────
router.get('/status/:externalId', auth, async (req, res) => {
    try {
        const { externalId } = req.params;

        // Cek di consultation dulu
        const consultation = await Consultation.findOne({ xenditExternalId: externalId });
        if (consultation) {
            // Jika sudah confirmed, langsung return
            if (['confirmed','in_progress','completed'].includes(consultation.status)) {
                return res.json({ success: true, status: 'paid', type: 'consultation', consultation });
            }
            // Fallthrough ke cek Xendit jika masih pending
        }

        // Cek di payment record
        const payment = await Payment.findOne({ transactionId: externalId });

        // Jika sudah paid lokal, return langsung
        if (payment?.status === 'paid') {
            return res.json({ success: true, status: 'paid', type: payment.paymentType, payment });
        }

        // Cek ke Xendit
        const xenditRes = await axios.get(
            `https://api.xendit.co/v2/invoices?external_id=${externalId}`,
            { headers: xenditHeaders() }
        );
        const invoices = xenditRes.data;

        if (invoices?.length > 0) {
            const invoice = invoices[0];
            if (invoice.status === 'PAID') {
                // Proses jika belum
                if (consultation && !['confirmed','in_progress','completed'].includes(consultation.status)) {
                    await handleConsultationPaid(consultation, invoice, req.app.get('io'));
                }
                if (payment && payment.status !== 'paid') {
                    await handlePaymentPaid(payment, invoice, req.app.get('io'));
                }
                return res.json({ success: true, status: 'paid' });
            }
            return res.json({ success: true, status: invoice.status.toLowerCase() });
        }

        res.json({ success: true, status: consultation?.status || payment?.status || 'pending' });
    } catch (err) {
        console.error('[Xendit] status check error:', err.response?.data || err.message);
        res.status(500).json({ error: 'Gagal cek status: ' + err.message });
    }
});

// ── POST /webhook ────────────────────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
    try {
        // Verifikasi callback token
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

            // Cek consultation
            const consultation = await Consultation.findOne({ xenditExternalId: externalId });
            if (consultation && consultation.status === 'pending_payment') {
                await handleConsultationPaid(consultation, event, io);
            }

            // Cek payment record (medicine / appointment)
            const payment = await Payment.findOne({ transactionId: externalId });
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

// ── POST /refund/:consultationId ─────────────────────────────────────────────
// Placeholder refund — dipanggil otomatis oleh cron doctor_no_show
// Saat Xendit Refund API sudah aktif, ganti bagian "PLACEHOLDER" dengan API call nyata
router.post('/refund/:consultationId', auth, async (req, res) => {
    try {
        // Hanya admin atau sistem internal (cron memanggil via internal function)
        if (req.userRole !== 'admin') {
            return res.status(403).json({ error: 'Hanya admin yang bisa trigger refund' });
        }

        const consultation = await Consultation.findById(req.params.consultationId);
        if (!consultation) return res.status(404).json({ error: 'Konsultasi tidak ditemukan' });

        if (consultation.status !== 'doctor_no_show') {
            return res.status(400).json({ error: 'Refund hanya bisa untuk status doctor_no_show' });
        }

        // ── PLACEHOLDER: Ganti blok ini dengan Xendit Refund API saat sudah aktif ──
        // const refundRes = await axios.post(
        //     `https://api.xendit.co/refunds`,
        //     { invoice_id: consultation.xenditInvoiceId, reason: 'OTHERS', amount: consultation.amount },
        //     { headers: xenditHeaders() }
        // );
        // consultation.xenditRefundId = refundRes.data.id;
        // ─────────────────────────────────────────────────────────────────────────

        // Set status refunded (manual/placeholder)
        consultation.status        = 'refunded';
        consultation.cancelledAt   = new Date();
        consultation.cancelReason  = 'Dokter tidak hadir — refund otomatis';
        await consultation.save();

        await createNotification({
            userId : consultation.userId,
            type   : 'payment_verified',
            title  : 'Refund Diproses 💰',
            message: `Konsultasi Anda dibatalkan karena dokter tidak hadir. Refund sedang diproses oleh admin dan akan masuk ke rekening Anda dalam 3-5 hari kerja.`,
            data   : { consultationId: consultation._id },
            io     : req.app.get('io'),
        });

        res.json({ success: true, message: 'Status refund berhasil diupdate', consultation });
    } catch (err) {
        console.error('[Xendit] refund error:', err);
        res.status(500).json({ error: 'Gagal proses refund: ' + err.message });
    }
});

// ════════════════════════════════════════════════════════════════════════════
// INTERNAL HELPERS (juga di-export untuk cron)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Proses consultation menjadi confirmed setelah Xendit konfirmasi bayar.
 * Dipanggil dari webhook dan status-check endpoint.
 */
const handleConsultationPaid = async (consultation, xenditEvent, io) => {
    try {
        consultation.status              = 'confirmed';
        consultation.paymentVerified     = true;
        consultation.verifiedAt          = new Date();
        consultation.paidAt              = new Date(xenditEvent.paid_at || Date.now());
        consultation.xenditPaymentMethod = xenditEvent.payment_method || xenditEvent.payment_channel || '';
        await consultation.save();

        // Notif ke pasien
        await createNotification({
            userId : consultation.userId,
            type   : 'payment_verified',
            title  : 'Pembayaran Berhasil ✅',
            message: `Konsultasi Anda telah dikonfirmasi. Jadwal: ${_fmtDate(consultation.scheduledAt)}`,
            data   : { consultationId: consultation._id },
            io,
        });

        // Notif ke dokter
        const doctor = await Doctor.findById(consultation.doctorId);
        if (doctor) {
            const doctorUser = await User.findById(doctor.userId);
            if (doctorUser) {
                await createNotification({
                    userId : doctorUser._id,
                    type   : 'consultation_request',
                    title  : 'Booking Konsultasi Baru 📅',
                    message: `Pasien telah melakukan pembayaran. Jadwal konsultasi: ${_fmtDate(consultation.scheduledAt)}`,
                    data   : { consultationId: consultation._id },
                    io,
                });
            }
        }

        // Emit socket update ke user
        if (io) {
            io.to(`user-${consultation.userId}`).emit('consultation-status-update', {
                consultationId: consultation._id.toString(),
                status        : 'confirmed',
            });
        }

        console.log(`[Xendit] Consultation ${consultation._id} → confirmed`);
    } catch (err) {
        console.error('[Xendit] handleConsultationPaid error:', err.message);
    }
};

/**
 * Proses payment (medicine/appointment) setelah Xendit konfirmasi bayar.
 */
const handlePaymentPaid = async (payment, xenditEvent, io) => {
    try {
        payment.status        = 'paid';
        payment.paymentMethod = xenditEvent.payment_method || xenditEvent.payment_channel;
        payment.paidAt        = new Date(xenditEvent.paid_at || Date.now());
        await payment.save();

        // Update order farmasi
        if (payment.paymentType === 'medicine') {
            const order = await Order.findById(payment.referenceId);
            if (order && order.status === 'awaiting_payment') {
                for (const item of order.items) {
                    await Medicine.findByIdAndUpdate(item.medicineId, {
                        $inc: { stock: -item.quantity, lockedStock: -item.quantity },
                    });
                }
                await Order.findByIdAndUpdate(payment.referenceId, { status: 'processing', paymentVerified: true });
            }
        }

        await createNotification({
            userId : payment.userId,
            type   : 'payment_verified',
            title  : 'Pembayaran Berhasil ✅',
            message: `Pembayaran Rp ${(payment.amount || 0).toLocaleString('id-ID')} telah dikonfirmasi.`,
            data   : { paymentId: payment._id },
            io,
        });

        console.log(`[Xendit] Payment ${payment._id} → paid`);
    } catch (err) {
        console.error('[Xendit] handlePaymentPaid error:', err.message);
    }
};

// Helper format date WIB
const _fmtDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleString('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
    }) + ' WIB';
};

module.exports = router;
module.exports.handleConsultationPaid = handleConsultationPaid;