/**
 * Cron setiap menit — 4 job:
 * 1. pending   + paymentExpiry < now          → expired (release stok)
 * 2. diproses  + pickup + diprosesPaidAt < (now-30m) → siap_diambil
 * 3. siap_diambil + siapDiambilAt < (now-48h) → cancelled (release stok)
 * 4. terkirim  + terkirimAt < (now-24h)       → selesai (auto)
 */
const Order    = require('../models/Order');
const Medicine = require('../models/Medicine');
const { createNotification } = require('./notificationHelper');

const run = async (io) => {
    const now = new Date();
    try {

        // ── 1. Expired (tidak bayar 15 mnt) ──────────────────────────────────
        const expired = await Order.find({ status: 'pending', paymentExpiry: { $lt: now } });
        for (const o of expired) {
            for (const item of o.items)
                await Medicine.findByIdAndUpdate(item.medicineId, { $inc: { lockedStock: -item.quantity } });
            o.status = 'expired'; o.updatedAt = now; await o.save();
            // BUG-25 fix: was 'payment_verified' — wrong type for expired order
            await createNotification({ userId: o.userId, type: 'order_expired',
                title: 'Pesanan Kedaluwarsa ⏰',
                message: `Pesanan ${o.orderNumber} kedaluwarsa karena tidak dibayar dalam 15 menit. Silakan pesan kembali.`,
                data: { orderId: o._id }, io });
            if (io) io.to(`user-${o.userId}`).emit('order-status-update', { orderId: o._id.toString(), status: 'expired' });
            console.log(`[CRON] ${o.orderNumber} → expired`);
        }

        // ── 2. Pickup siap diambil setelah 30 mnt diproses ───────────────────
        const t30 = new Date(now - 30 * 60000);
        const readyPickup = await Order.find({ status: 'diproses', deliveryMethod: 'pickup', diprosesPaidAt: { $lt: t30 } });
        for (const o of readyPickup) {
            o.status = 'siap_diambil'; o.siapDiambilAt = now; o.updatedAt = now; await o.save();
            await createNotification({ userId: o.userId, type: 'order_shipped',
                title: 'Obat Siap Diambil 🏥',
                message: `Pesanan ${o.orderNumber} siap diambil di Klinik Pratama IPB. Bawa bukti pesanan ini. Batas pengambilan 48 jam.`,
                data: { orderId: o._id }, io });
            if (io) io.to(`user-${o.userId}`).emit('order-status-update', { orderId: o._id.toString(), status: 'siap_diambil' });
            console.log(`[CRON] ${o.orderNumber} → siap_diambil`);
        }

        // ── 3. Siap diambil → cancelled setelah 48 jam ───────────────────────
        const t48 = new Date(now - 48 * 3600000);
        const expiredPickup = await Order.find({ status: 'siap_diambil', siapDiambilAt: { $lt: t48 } });
        for (const o of expiredPickup) {
            // Kembalikan stok
            for (const item of o.items)
                await Medicine.findByIdAndUpdate(item.medicineId, { $inc: { stock: item.quantity } });
            o.status = 'cancelled'; o.cancelReason = 'Tidak diambil dalam 48 jam'; o.cancelledAt = now; o.updatedAt = now;
            await o.save();
            await createNotification({ userId: o.userId, type: 'order_shipped',
                title: 'Pesanan Dibatalkan Otomatis ❌',
                message: `Pesanan ${o.orderNumber} dibatalkan karena tidak diambil dalam 48 jam. Hubungi klinik jika ada pertanyaan.`,
                data: { orderId: o._id }, io });
            if (io) io.to(`user-${o.userId}`).emit('order-status-update', { orderId: o._id.toString(), status: 'cancelled' });
            console.log(`[CRON] ${o.orderNumber} → cancelled (pickup 48jam)`);
        }

        // ── 4. Terkirim → selesai auto setelah 24 jam ────────────────────────
        const t24 = new Date(now - 24 * 3600000);
        const autoComplete = await Order.find({ status: 'terkirim', terkirimAt: { $lt: t24 } });
        for (const o of autoComplete) {
            o.status = 'selesai'; o.completedAt = now; o.updatedAt = now; await o.save();
            await createNotification({ userId: o.userId, type: 'order_delivered',
                title: 'Pesanan Selesai Otomatis ✅',
                message: `Pesanan ${o.orderNumber} otomatis diselesaikan setelah 24 jam dari status terkirim.`,
                data: { orderId: o._id }, io });
            if (io) io.to(`user-${o.userId}`).emit('order-status-update', { orderId: o._id.toString(), status: 'selesai' });
            console.log(`[CRON] ${o.orderNumber} → selesai (auto 24jam)`);
        }

    } catch (err) { console.error('[ORDER CRON] Error:', err.message); }
};

const startCron = (io) => {
    setInterval(() => run(io), 60000);
    run(io);
    console.log('✅ Order cron started');
};

module.exports = { startCron };