/**
 * Expiredconsultationcron.js  ← FIX: Cast to ObjectId error
 *
 * ROOT CAUSE:
 *   Consultation.doctorId disimpan sebagai String UUID MySQL
 *   (contoh: "bd87e961-747d-40b0-ac6d-db96f9f6caea")
 *
 *   Kode lama:
 *     const doctor = await Doctor.findById(updated.doctorId)  ← MongoDB model
 *     MongoDB mencoba cast UUID string → ObjectId → ERROR
 *
 *   FIX:
 *     Ganti Doctor (MongoDB) → DoctorMySQL (Sequelize) dengan findOne({ where: { id } })
 *     DoctorMySQL.userId adalah UUID MySQL dari tabel users → bisa langsung
 *     dipakai untuk createNotification dan socket emit.
 *
 * Semua logika lain (expired payment, auto in_progress, doctor no show,
 * auto close) tidak berubah sama sekali.
 */

const Consultation       = require('../models/Consultation');
// FIX: gunakan MySQL Doctor model, bukan MongoDB Doctor
const { Doctor: DoctorMySQL } = require('../models/mysql');
const { createNotification } = require('./notificationHelper');

const WIB_OFFSET = 7 * 60 * 60 * 1000;
const fmtWIB = (d) =>
    new Date(d.getTime() + WIB_OFFSET).toISOString().replace('T', ' ').slice(0, 16) + ' WIB';

let _io    = null;
let _timer = null;

// ── 1. Expired payment ────────────────────────────────────────────────────────
const checkExpiredPayments = async () => {
    const now = new Date();

    const candidates = await Consultation.find({
        status         : 'pending_payment',
        paymentDeadline: { $lt: now },
    }).select('_id userId');

    for (const c of candidates) {
        const updated = await Consultation.findOneAndUpdate(
            { _id: c._id, status: 'pending_payment' },
            { $set: {
                status       : 'expired',
                cancelledBy  : 'system',
                cancelReason : 'Pembayaran tidak dilakukan dalam 15 menit',
            }},
            { new: true }
        );
        if (!updated) continue;

        await createNotification({
            userId  : updated.userId,
            type    : 'consultation_expired',
            title   : 'Konsultasi Kadaluarsa ⏰',
            message : 'Anda tidak melakukan pembayaran dalam 15 menit. Silakan booking ulang.',
            data    : { consultationId: updated._id },
            io      : _io,
        });

        if (_io) {
            _io.to(`user-${updated.userId}`).emit('consultation-status-update', {
                consultationId: updated._id.toString(),
                status        : 'expired',
            });
        }

        console.log(`[CRON] ${updated._id} → expired (${fmtWIB(now)})`);
    }
};

// ── 2. Auto in_progress saat jam mulai tiba ───────────────────────────────────
const checkAutoInProgress = async () => {
    const now = new Date();

    const candidates = await Consultation.find({
        status      : 'confirmed',
        scheduledAt : { $lte: now },
        scheduledEnd: { $gt: now },
    }).select('_id userId doctorId scheduledAt');

    for (const c of candidates) {
        const updated = await Consultation.findOneAndUpdate(
            { _id: c._id, status: 'confirmed' },
            { $set: { status: 'in_progress', startTime: c.scheduledAt } },
            { new: true }
        );
        if (!updated) continue;

        // Notif user
        await createNotification({
            userId  : updated.userId,
            type    : 'consultation_started',
            title   : 'Konsultasi Dimulai 🩺',
            message : 'Waktu konsultasi Anda telah tiba. Silakan mulai chat/video call dengan dokter.',
            data    : { consultationId: updated._id },
            io      : _io,
        });

        // ── FIX: Notif dokter — pakai MySQL Doctor, bukan MongoDB Doctor ──────
        // Consultation.doctorId = UUID dari tabel doctors (MySQL)
        // DoctorMySQL.userId    = UUID dari tabel users   (MySQL)
        try {
            const doctorIdStr = updated.doctorId?.toString();
            if (doctorIdStr) {
                const doctor = await DoctorMySQL.findOne({
                    where      : { id: doctorIdStr },
                    attributes : ['id', 'userId'],
                });
                if (doctor?.userId) {
                    await createNotification({
                        userId  : doctor.userId,
                        type    : 'consultation_started',
                        title   : 'Sesi Konsultasi Dimulai 🩺',
                        message : 'Waktu konsultasi dengan pasien telah tiba. Silakan mulai sesi.',
                        data    : { consultationId: updated._id },
                        io      : _io,
                    });
                }
            }
        } catch (e) {
            console.error(`[CRON] Gagal notif dokter konsultasi ${updated._id}:`, e.message);
        }
        // ── END FIX ───────────────────────────────────────────────────────────

        if (_io) {
            _io.to(`user-${updated.userId}`).emit('consultation-status-update', {
                consultationId: updated._id.toString(),
                status        : 'in_progress',
            });
        }

        console.log(`[CRON] ${updated._id} → in_progress (${fmtWIB(now)})`);
    }
};

// ── 3. Doctor no show ─────────────────────────────────────────────────────────
const checkDoctorNoShow = async () => {
    const now   = new Date();
    const grace = new Date(now.getTime() - 15 * 60 * 1000);

    const candidates = await Consultation.find({
        status      : 'confirmed',
        scheduledEnd: { $lt: grace },
    }).lean();

    for (const c of candidates) {
        const updated = await Consultation.findOneAndUpdate(
            { _id: c._id, status: 'confirmed' },
            { $set: {
                status       : 'doctor_no_show',
                cancelledAt  : now,
                cancelledBy  : 'system',
                cancelReason : 'Dokter tidak memulai sesi dalam waktu yang ditentukan',
                refund       : { requestedAt: now, notes: 'Auto-refund: dokter tidak hadir' },
            }},
            { new: true }
        );
        if (!updated) continue;

        let hasAvailableSlots = false;
        try {
            const DoctorAvailability = require('../models/DoctorAvailability');
            const avail = await DoctorAvailability.findOne({
                doctorId: updated.doctorId?._id || updated.doctorId,
            });
            hasAvailableSlots = !!(avail && avail.isWeekActive());
        } catch (e) { /* ignore */ }

        try {
            const { processRefundInternal } = require('../routes/consultations');
            await processRefundInternal(updated._id.toString(), {}, _io);
            console.log(`[CRON] ${updated._id} → doctor_no_show → refunded (auto)`);
        } catch (refundErr) {
            if (refundErr.message === 'NEED_BANK_INFO') {
                await Consultation.findByIdAndUpdate(updated._id, { status: 'doctor_no_show' });
                await createNotification({
                    userId  : updated.userId,
                    type    : 'doctor_no_show',
                    title   : 'Dokter Tidak Hadir — Tindakan Diperlukan',
                    message : hasAvailableSlots
                        ? 'Dokter tidak hadir. Pilih: reschedule ke jadwal lain atau refund (masukkan data rekening untuk refund).'
                        : 'Dokter tidak hadir. Tidak ada jadwal tersedia. Masukkan data rekening untuk menerima refund.',
                    data    : { consultationId: updated._id, hasAvailableSlots },
                    io      : _io,
                });
            } else {
                console.error(`[CRON] Refund gagal ${updated._id}:`, refundErr.message);
                await Consultation.findByIdAndUpdate(updated._id, { status: 'refund_requested' });
                await createNotification({
                    userId  : updated.userId,
                    type    : 'doctor_no_show',
                    title   : 'Dokter Tidak Hadir — Refund Diproses Admin',
                    message : 'Dokter tidak hadir. Refund gagal diproses otomatis dan akan diselesaikan admin dalam 1-3 hari.',
                    data    : { consultationId: updated._id },
                    io      : _io,
                });
            }
        }

        if (_io) {
            try {
                const finalDoc = await Consultation.findById(updated._id).select('status').lean();
                _io.to(`user-${updated.userId}`).emit('consultation-status-update', {
                    consultationId: updated._id.toString(),
                    status        : finalDoc?.status || updated.status,
                    hasAvailableSlots,
                });
            } catch {
                _io.to(`user-${updated.userId}`).emit('consultation-status-update', {
                    consultationId: updated._id.toString(),
                    status        : updated.status,
                    hasAvailableSlots,
                });
            }
        }
    }
};

// ── 4. Auto close: user no_show / completed ───────────────────────────────────
const checkUserNoShow = async () => {
    const now   = new Date();
    const grace = new Date(now.getTime() - 15 * 60 * 1000);

    const candidates = await Consultation.find({
        status      : 'in_progress',
        scheduledEnd: { $lt: grace },
    });

    for (const c of candidates) {
        const userMessages = (c.messages || []).filter(
            m => m.senderId?.toString() === c.userId?.toString()
        );
        const finalStatus = userMessages.length === 0 ? 'no_show' : 'completed';

        const medicalRecordPlaceholder = finalStatus === 'completed' ? {
            objectiveFindings : '',
            assessment        : '',
            plan              : '',
            doctorNotes       : 'Sesi berakhir otomatis — rekam medis belum diisi dokter.',
            isCompleted       : false,
            completedAt       : null,
        } : undefined;

        const updateFields = { status: finalStatus, endTime: c.scheduledEnd };
        if (medicalRecordPlaceholder) updateFields.medicalRecord = medicalRecordPlaceholder;

        const updated = await Consultation.findOneAndUpdate(
            { _id: c._id, status: 'in_progress' },
            { $set: updateFields },
            { new: true }
        );
        if (!updated) continue;

        await createNotification({
            userId  : updated.userId,
            type    : 'consultation_ended',
            title   : finalStatus === 'no_show' ? 'Sesi Berakhir — Tidak Hadir' : 'Konsultasi Selesai ✅',
            message : finalStatus === 'no_show'
                ? 'Sesi konsultasi telah berakhir. Anda tercatat tidak hadir.'
                : 'Sesi konsultasi telah selesai secara otomatis. Rekam medis akan dilengkapi dokter. Silakan beri rating.',
            data    : { consultationId: updated._id },
            io      : _io,
        });

        // ── FIX: Notif dokter lengkapi rekam medis — pakai MySQL Doctor ───────
        if (finalStatus === 'completed') {
            try {
                const doctorIdStr = updated.doctorId?.toString();
                if (doctorIdStr) {
                    const doctor = await DoctorMySQL.findOne({
                        where      : { id: doctorIdStr },
                        attributes : ['id', 'userId'],
                    });
                    if (doctor?.userId) {
                        await createNotification({
                            userId  : doctor.userId,
                            type    : 'consultation_ended',
                            title   : '📋 Lengkapi Rekam Medis',
                            message : 'Sesi konsultasi berakhir otomatis. Harap lengkapi rekam medis pasien segera.',
                            data    : { consultationId: updated._id },
                            io      : _io,
                        });
                    }
                }
            } catch (e) {
                console.error(`[CRON] Gagal notif dokter rekam medis ${updated._id}:`, e.message);
            }
        }
        // ── END FIX ───────────────────────────────────────────────────────────

        if (_io) {
            _io.to(`user-${updated.userId}`).emit('consultation-status-update', {
                consultationId: updated._id.toString(),
                status        : finalStatus,
            });
            if (finalStatus === 'completed') {
                _io.to(`user-${updated.userId}`).emit('show-rating-modal', {
                    consultationId: updated._id.toString(),
                });
            }
        }

        console.log(`[CRON] ${updated._id} → ${finalStatus} (auto-close, ${fmtWIB(now)})`);
    }
};

// ── Master runner ─────────────────────────────────────────────────────────────
const runAllChecks = async () => {
    try { await checkExpiredPayments(); } catch (e) { console.error('[CRON] checkExpiredPayments:', e.message); }
    try { await checkAutoInProgress();  } catch (e) { console.error('[CRON] checkAutoInProgress:', e.message); }
    try { await checkDoctorNoShow();    } catch (e) { console.error('[CRON] checkDoctorNoShow:', e.message); }
    try { await checkUserNoShow();      } catch (e) { console.error('[CRON] checkUserNoShow:', e.message); }
};

const startCron = (socketIo) => {
    _io = socketIo;
    if (_timer) return;
    _timer = setInterval(runAllChecks, 60 * 1000);
    runAllChecks().catch(e => console.error('[CRON] startup check error:', e.message));
    console.log('✅ Consultation cron started (expired / auto-start / doctor-no-show / auto-close)');
};

const stopCron = () => {
    if (_timer) { clearInterval(_timer); _timer = null; }
};

module.exports = { startCron, stopCron };