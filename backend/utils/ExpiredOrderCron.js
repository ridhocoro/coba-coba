/**
 * Cron: setiap menit cek order dengan status awaiting_payment
 * yang sudah melewati paymentExpiry → set ke expired & release lockedStock
 *
 * Menggantikan setTimeout() yang tidak reliable saat server restart.
 */
const Order    = require('../models/Order');
const Medicine = require('../models/Medicine');

const runExpiredOrderCheck = async () => {
    try {
        const now = new Date();

        const expiredOrders = await Order.find({
            status: 'awaiting_payment',
            paymentExpiry: { $lt: now }
        });

        for (const order of expiredOrders) {
            // Release locked stock untuk setiap item
            for (const item of order.items) {
                await Medicine.findByIdAndUpdate(item.medicineId, {
                    $inc: { lockedStock: -item.quantity }
                });
            }

            order.status = 'expired';
            await order.save();

            console.log(`[ORDER CRON] Order ${order.orderNumber || order._id} → expired`);
        }
    } catch (err) {
        console.error('[ORDER CRON] Error:', err.message);
    }
};

const startCron = () => {
    setInterval(runExpiredOrderCheck, 60 * 1000); // setiap 60 detik
    // Jalankan sekali langsung saat startup untuk tangani order yang expired saat server mati
    runExpiredOrderCheck();
    console.log('✅ Expired order cron started');
};

module.exports = { startCron };
