/**
 * ExpiredOrderCron.js — Sequelize (MySQL) version
 * Cron setiap menit — 4 job:
 * 1. pending   + paymentExpiry < now          → expired (release lockedStock)
 * 2. diproses  + pickup + diprosesPaidAt < (now-30m) → siap_diambil
 * 3. siap_diambil + siapDiambilAt < (now-48h) → cancelled (release stock)
 * 4. terkirim  + terkirimAt < (now-24h)       → selesai (auto)
 */

const { Order, OrderItem, Medicine } = require('../models/mysql');
const { Op }                          = require('sequelize');
const { createNotification }          = require('./notificationHelper');

const run = async (io) => {
    const now = new Date();
    try {

        // ── 1. Expired: pending + paymentExpiry < now ─────────────────────────
        const expiredOrders = await Order.findAll({
            where: {
                status       : 'pending',
                paymentExpiry: { [Op.lt]: now },
            },
            include: [{ association: 'items' }],
        });

        for (const o of expiredOrders) {
            // Kembalikan lockedStock untuk setiap item
            for (const item of (o.items || [])) {
                await Medicine.increment(
                    { lockedStock: -item.quantity },
                    { where: { id: item.medicineId } }
                );
            }
            o.status    = 'expired';
            o.updatedAt = now;
            await o.save();

            await createNotification({
                userId : o.userId,
                type   : 'order_expired',
                title  : 'Pesanan Kedaluwarsa ⏰',
                message: `Pesanan ${o.orderNumber} kedaluwarsa karena tidak dibayar dalam 15 menit. Silakan pesan kembali.`,
                data   : { orderId: o.id },
                io,
            });
            if (io) io.to(`user-${o.userId}`).emit('order-status-update', {
                orderId: o.id.toString(),
                status : 'expired',
            });
            console.log(`[CRON] ${o.orderNumber} → expired`);
        }

        // ── 2. Pickup siap diambil setelah 30 mnt diproses ───────────────────
        const t30 = new Date(now - 30 * 60000);
        const readyPickup = await Order.findAll({
            where: {
                status        : 'diproses',
                deliveryMethod: 'pickup',
                diprosesPaidAt: { [Op.lt]: t30 },
            },
        });

        for (const o of readyPickup) {
            o.status       = 'siap_diambil';
            o.siapDiambilAt= now;
            o.updatedAt    = now;
            await o.save();

            await createNotification({
                userId : o.userId,
                type   : 'order_shipped',
                title  : 'Obat Siap Diambil 🏥',
                message: `Pesanan ${o.orderNumber} siap diambil di Klinik Pratama IPB. Bawa bukti pesanan ini. Batas pengambilan 48 jam.`,
                data   : { orderId: o.id },
                io,
            });
            if (io) io.to(`user-${o.userId}`).emit('order-status-update', {
                orderId: o.id.toString(),
                status : 'siap_diambil',
            });
            console.log(`[CRON] ${o.orderNumber} → siap_diambil`);
        }

        // ── 3. Siap diambil → cancelled setelah 48 jam ───────────────────────
        const t48 = new Date(now - 48 * 3600000);
        const expiredPickup = await Order.findAll({
            where: {
                status      : 'siap_diambil',
                siapDiambilAt: { [Op.lt]: t48 },
            },
            include: [{ association: 'items' }],
        });

        for (const o of expiredPickup) {
            // Kembalikan stok permanen (sudah dikurangi saat paid)
            for (const item of (o.items || [])) {
                await Medicine.increment(
                    { stock: item.quantity },
                    { where: { id: item.medicineId } }
                );
            }
            o.status      = 'cancelled';
            o.cancelReason= 'Tidak diambil dalam 48 jam';
            o.cancelledAt = now;
            o.updatedAt   = now;
            await o.save();

            await createNotification({
                userId : o.userId,
                type   : 'order_shipped',
                title  : 'Pesanan Dibatalkan Otomatis ❌',
                message: `Pesanan ${o.orderNumber} dibatalkan karena tidak diambil dalam 48 jam. Hubungi klinik jika ada pertanyaan.`,
                data   : { orderId: o.id },
                io,
            });
            if (io) io.to(`user-${o.userId}`).emit('order-status-update', {
                orderId: o.id.toString(),
                status : 'cancelled',
            });
            console.log(`[CRON] ${o.orderNumber} → cancelled (pickup 48jam)`);
        }

        // ── 4. Terkirim → selesai auto setelah 24 jam ────────────────────────
        const t24 = new Date(now - 24 * 3600000);
        const autoComplete = await Order.findAll({
            where: {
                status    : 'terkirim',
                terkirimAt: { [Op.lt]: t24 },
            },
        });

        for (const o of autoComplete) {
            o.status      = 'selesai';
            o.completedAt = now;
            o.updatedAt   = now;
            await o.save();

            await createNotification({
                userId : o.userId,
                type   : 'order_delivered',
                title  : 'Pesanan Selesai Otomatis ✅',
                message: `Pesanan ${o.orderNumber} otomatis diselesaikan setelah 24 jam dari status terkirim.`,
                data   : { orderId: o.id },
                io,
            });
            if (io) io.to(`user-${o.userId}`).emit('order-status-update', {
                orderId: o.id.toString(),
                status : 'selesai',
            });
            console.log(`[CRON] ${o.orderNumber} → selesai (auto 24jam)`);
        }

    } catch (err) {
        console.error('[ORDER CRON] Error:', err.message, err.stack);
    }
};

const startCron = (io) => {
    setInterval(() => run(io), 60000); // setiap 1 menit
    run(io);                           // langsung jalankan saat startup
    console.log('✅ Order cron started (Sequelize/MySQL)');
};

module.exports = { startCron };