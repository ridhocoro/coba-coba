/**
 * migrate.js  —  versi final yang benar
 * MongoDB → MySQL (idempotent: aman dijalankan berkali-kali)
 *
 * Cara jalankan:
 *   cd backend
 *   node scripts/migrate.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// ── MongoDB Models ──────────────────────────────────────────────────────────
const MongoUser     = require('../models/User');
const MongoDoctor   = require('../models/Doctor');
const MongoMedicine = require('../models/Medicine');
const MongoOrder    = require('../models/Order');

// ── MySQL Models ────────────────────────────────────────────────────────────
// PENTING: pastikan models/mysql/index.js sudah mengekspor DoctorSchedule
// (gunakan file index.js dari output migrate-fix)
const { sequelize, User, Doctor, DoctorSchedule, Medicine, Order, OrderItem }
    = require('../models/mysql');
const { connectMySQL } = require('../config/mysql');

// ── Warna terminal ──────────────────────────────────────────────────────────
const c = {
    green : s => `\x1b[32m${s}\x1b[0m`,
    red   : s => `\x1b[31m${s}\x1b[0m`,
    yellow: s => `\x1b[33m${s}\x1b[0m`,
    cyan  : s => `\x1b[36m${s}\x1b[0m`,
    bold  : s => `\x1b[1m${s}\x1b[0m`,
};

// ── Helper: MongoDB ObjectId (24 hex) → UUID CHAR(36) ──────────────────────
const toUUID = (mongoId) => {
    if (!mongoId) return null;
    const hex = mongoId.toString().padStart(32, '0');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
};

const logResult = (label, ok, fail, skip) => {
    console.log(`\n  ${c.bold(label)}`);
    console.log(`    ${c.green('✅ Berhasil  :')} ${ok}`);
    if (fail > 0) console.log(`    ${c.red('❌ Gagal     :')} ${fail}`);
    if (skip > 0) console.log(`    ${c.yellow('⚠️  Dilewati  :')} ${skip} (sudah ada)`);
};

// ══════════════════════════════════════════════════════════════════════════════
// 1. USERS  — raw INSERT untuk bypass hook bcrypt (password sudah di-hash)
// ══════════════════════════════════════════════════════════════════════════════
async function migrasiUsers() {
    console.log(c.cyan('\n📦 Memulai migrasi Users...'));
    const list = await MongoUser.find({}).lean();
    console.log(`   Ditemukan ${list.length} user di MongoDB`);

    let ok = 0, fail = 0, skip = 0;

    for (const u of list) {
        try {
            const existing = await User.findOne({ where: { email: u.email } });
            if (existing) { skip++; continue; }

            // Raw INSERT → hook bcrypt TIDAK jalan → password tetap hash asli
            await sequelize.query(
                `INSERT INTO users (
                    id, name, email, password, phone,
                    date_of_birth, gender, role,
                    is_active, is_verified, quota_bonus,
                    address_street, address_city, address_province, address_postal_code,
                    created_at, updated_at
                ) VALUES (
                    :id,:name,:email,:password,:phone,
                    :dob,:gender,:role,
                    :isActive,:isVerified,:quotaBonus,
                    :street,:city,:province,:postal,
                    :createdAt,:updatedAt
                )`,
                {
                    replacements: {
                        id        : toUUID(u._id),
                        name      : u.name       || 'Tanpa Nama',
                        email     : u.email,
                        password  : u.password,                   // bcrypt hash asli
                        phone     : u.phone      || '-',
                        dob       : u.dateOfBirth || null,
                        gender    : u.gender     || '',
                        role      : u.role       || 'user',
                        isActive  : u.isActive   !== undefined ? (u.isActive   ? 1 : 0) : 1,
                        isVerified: u.isVerified !== undefined ? (u.isVerified ? 1 : 0) : 0,
                        quotaBonus: u.quotaBonus || 0,
                        street    : u.address?.street    || null,
                        city      : u.address?.city      || null,
                        province  : u.address?.province  || null,
                        postal    : u.address?.postalCode || null,
                        createdAt : u.createdAt  || new Date(),
                        updatedAt : u.updatedAt  || new Date(),
                    },
                    type: sequelize.QueryTypes.INSERT,
                }
            );
            ok++;
        } catch (err) {
            console.log(`    ${c.red('❌')} ${u.email}: ${err.message}`);
            fail++;
        }
    }

    logResult('Users', ok, fail, skip);
    return { berhasil: ok, gagal: fail };
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. DOCTORS + SCHEDULES
// ══════════════════════════════════════════════════════════════════════════════
async function migrasiDoctors() {
    console.log(c.cyan('\n👨‍⚕️  Memulai migrasi Doctors...'));
    const list = await MongoDoctor.find({}).lean();
    console.log(`   Ditemukan ${list.length} dokter di MongoDB`);

    let ok = 0, fail = 0, skip = 0, skipNoUser = 0, schedOk = 0;

    const hariMap = {
        Senin:1, Selasa:2, Rabu:3, Kamis:4, Jumat:5, Sabtu:6, Minggu:0,
        Monday:1, Tuesday:2, Wednesday:3, Thursday:4, Friday:5, Saturday:6, Sunday:0,
    };

    for (const d of list) {
        try {
            const doctorId = toUUID(d._id);
            const userId   = d.userId ? toUUID(d.userId) : null;

            if (!userId) {
                console.log(`    ${c.yellow('⚠️')}  Skip (no userId): ${d.name}`);
                skipNoUser++;
                continue;
            }

            const userExists = await User.findOne({ where: { id: userId } });
            if (!userExists) {
                console.log(`    ${c.yellow('⚠️')}  Skip (userId tidak ada di MySQL): ${d.name}`);
                skipNoUser++;
                continue;
            }

            const existing = await Doctor.findOne({ where: { id: doctorId } });
            if (existing) { skip++; continue; }

            await Doctor.create({
                id             : doctorId,
                userId,
                name           : d.name,
                specialization : d.specialization,
                qualification  : d.qualification  || null,
                strNumber       : d.strNumber       || null,
                alumnus         : d.alumnus         || null,
                practiceLocation: d.practiceLocation || null,
                titlePrefix     : d.titlePrefix     || null,
                titleSuffix     : d.titleSuffix     || null,
                gender         : d.gender         || '',
                experience     : d.experience     || null,
                consultationFee: d.consultationFee || 0,
                rating         : d.rating         || 0,
                totalReviews   : d.totalReviews   || 0,
                isActive       : d.isActive       !== undefined ? d.isActive : true,
                isOnline       : d.isOnline       !== undefined ? d.isOnline : false,
                bio            : d.bio            || null,
                photo          : d.photo          || null,
                signatureUrl   : d.signatureUrl   || null,
                allowChat      : d.consultationSettings?.allowChat      ?? true,
                allowVideoCall : d.consultationSettings?.allowVideoCall ?? true,
            });
            ok++;

            // Jadwal — DoctorSchedule diimport langsung (bukan via sequelize.models)
            if (DoctorSchedule && d.availableDays?.length) {
                for (const hari of d.availableDays) {
                    const dayNum = hariMap[hari.day];
                    if (dayNum === undefined) continue;
                    for (const slot of (hari.slots || [])) {
                        if (!slot.startTime || !slot.endTime) continue;
                        try {
                            await DoctorSchedule.create({
                                doctorId   : doctorId,
                                dayOfWeek  : dayNum,
                                startTime  : slot.startTime,
                                endTime    : slot.endTime,
                                isAvailable: slot.isAvailable !== undefined ? slot.isAvailable : true,
                            });
                            schedOk++;
                        } catch (_) { /* abaikan duplikat */ }
                    }
                }
            }
        } catch (err) {
            console.log(`    ${c.red('❌')} ${d.name}: ${err.message}`);
            fail++;
        }
    }

    logResult('Doctors', ok, fail, skip);
    if (skipNoUser > 0)
        console.log(`    ${c.yellow('⏭️  Skip (no userId) :')} ${skipNoUser}`);
    console.log(`    ${c.green('📅 Jadwal    :')} ${schedOk} slot`);
    return { berhasil: ok, gagal: fail };
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. MEDICINES
// ══════════════════════════════════════════════════════════════════════════════
async function migrasiMedicines() {
    console.log(c.cyan('\n💊 Memulai migrasi Medicines...'));
    const list = await MongoMedicine.find({}).lean();
    console.log(`   Ditemukan ${list.length} obat di MongoDB`);

    let ok = 0, fail = 0, skip = 0;

    for (const m of list) {
        try {
            const medId = toUUID(m._id);
            const existing = await Medicine.findOne({ where: { id: medId } });
            if (existing) { skip++; continue; }

            await Medicine.create({
                id                      : medId,
                name                    : m.name,
                genericName             : m.genericName              || null,
                description             : m.description              || null,
                category                : m.category,
                price                   : m.price                    || 0,
                stock                   : m.stock                    || 0,
                lockedStock             : m.lockedStock              || 0,
                minStock                : m.minStock                 || 10,
                unit                    : m.unit                     || 'tablet',
                requiresPrescription    : m.requiresPrescription     || false,
                availableForStudentQuota: m.availableForStudentQuota || false,
                image                   : m.image                    || null,
                manufacturer            : m.manufacturer             || null,
                isActive                : m.isActive !== undefined ? m.isActive : true,
            });
            ok++;
        } catch (err) {
            console.log(`    ${c.red('❌')} ${m.name}: ${err.message}`);
            fail++;
        }
    }

    logResult('Medicines', ok, fail, skip);
    return { berhasil: ok, gagal: fail };
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. ORDERS + ITEMS
// ══════════════════════════════════════════════════════════════════════════════
async function migrasiOrders() {
    console.log(c.cyan('\n🛒 Memulai migrasi Orders...'));
    const list = await MongoOrder.find({}).lean();
    console.log(`   Ditemukan ${list.length} order di MongoDB`);

    let ok = 0, fail = 0, skip = 0, itemOk = 0;

    for (const o of list) {
        try {
            const orderId = toUUID(o._id);
            const userId  = toUUID(o.userId);

            const existing = await Order.findOne({ where: { id: orderId } });
            if (existing) { skip++; continue; }

            await Order.create({
                id          : orderId,
                orderNumber : o.orderNumber || `INV-MIGR-${o._id}`,
                userId,

                subtotalObat     : o.subtotalObat      || 0,
                shippingCost     : o.shippingCost      || 0,
                totalAmount      : o.totalAmount       || 0,
                isStudentDiscount: o.isStudentDiscount || false,
                studentFreeQty   : o.studentFreeQty    || 0,

                deliveryMethod   : o.deliveryMethod    || 'pickup',
                shippingAddress  : o.shippingAddress?.address || null,
                shippingDetail   : o.shippingAddress?.detail  || null,
                shippingLat      : o.shippingAddress?.lat     || null,
                shippingLng      : o.shippingAddress?.lng     || null,
                shippingPhone    : o.shippingAddress?.phone   || null,
                distance         : o.distance          || 0,
                estimatedDelivery: o.estimatedDelivery || null,

                requiresPrescription      : o.requiresPrescription        || false,
                prescriptionImageUrl      : o.prescription?.imageUrl      || null,
                prescriptionStatus        : o.prescription?.status        || null,
                prescriptionRejectedReason: o.prescription?.rejectedReason|| null,
                prescriptionReviewedAt    : o.prescription?.reviewedAt    || null,
                prescriptionUploadCount   : o.prescriptionUploadCount      || 0,

                xenditExternalId: o.xenditExternalId || null,
                paymentExpiry   : o.paymentExpiry    || null,
                status          : o.status           || 'pending',

                refundVideoUrl     : o.refund?.videoUrl      || null,
                refundReason       : o.refund?.reason        || null,
                refundRequestedAt  : o.refund?.requestedAt   || null,
                refundReviewedAt   : o.refund?.reviewedAt    || null,
                refundRejectReason : o.refund?.rejectReason  || null,
                refundBankCode     : o.refund?.bankCode       || null,
                refundAccountNumber: o.refund?.accountNumber || null,
                refundAccountName  : o.refund?.accountName   || null,
                refundMethod       : o.refund?.method        || null,
                refundProcessedAt  : o.refund?.processedAt   || null,

                terkirimAt    : o.terkirimAt     || null,
                diprosesPaidAt: o.diprosesPaidAt || null,
                siapDiambilAt : o.siapDiambilAt  || null,
                completedAt   : o.completedAt    || null,
                cancelledAt   : o.cancelledAt    || null,
                cancelReason  : o.cancelReason   || null,
                notes         : o.notes          || null,
                stockLockExpiry: o.stockLockExpiry || null,
            });
            ok++;

            for (const item of (o.items || [])) {
                try {
                    await OrderItem.create({
                        orderId             : orderId,
                        medicineId          : item.medicineId ? toUUID(item.medicineId) : null,
                        medicineName        : item.name       || 'Obat tidak diketahui',
                        price               : item.price      || 0,
                        finalPrice          : item.finalPrice || item.price || 0,
                        quantity            : item.quantity   || 1,
                        subtotal            : item.subtotal   || 0,
                        requiresPrescription: item.requiresPrescription || false,
                        isFreeForStudent    : item.isFreeForStudent     || false,
                    });
                    itemOk++;
                } catch (ie) {
                    console.log(`    ${c.yellow('⚠️')}  Item ${item.name}: ${ie.message}`);
                }
            }
        } catch (err) {
            console.log(`    ${c.red('❌')} Order ${o.orderNumber}: ${err.message}`);
            fail++;
        }
    }

    logResult('Orders', ok, fail, skip);
    console.log(`    ${c.green('📦 Items     :')} ${itemOk} item`);
    return { berhasil: ok, gagal: fail };
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════
async function main() {
    console.log(c.bold('\n╔══════════════════════════════════════════════╗'));
    console.log(c.bold('║   MIGRASI DATA: MongoDB → MySQL              ║'));
    console.log(c.bold('╚══════════════════════════════════════════════╝'));
    console.log(c.yellow('⚠️  Pastikan server TIDAK sedang berjalan!\n'));

    console.log('🔌 Menghubungkan ke MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/klinik-ipb');
    console.log(c.green('✅ MongoDB terhubung'));

    console.log('🔌 Menghubungkan ke MySQL...');
    await connectMySQL();
    console.log(c.green('✅ MySQL terhubung'));

    const t0 = Date.now();
    const r1 = await migrasiUsers();
    const r2 = await migrasiDoctors();
    const r3 = await migrasiMedicines();
    const r4 = await migrasiOrders();

    const totalOk   = r1.berhasil + r2.berhasil + r3.berhasil + r4.berhasil;
    const totalFail = r1.gagal    + r2.gagal    + r3.gagal    + r4.gagal;
    const durasi    = ((Date.now() - t0) / 1000).toFixed(1);

    console.log(c.bold('\n╔══════════════════════════════════════════════╗'));
    console.log(c.bold('║   RINGKASAN                                  ║'));
    console.log(c.bold('╚══════════════════════════════════════════════╝'));
    console.log(`  ${c.green('Total berhasil :')} ${totalOk} data`);
    if (totalFail > 0) console.log(`  ${c.red('Total gagal    :')} ${totalFail} data`);
    console.log(`  Durasi         : ${durasi} detik`);

    if (totalFail === 0) {
        console.log(c.green(c.bold('\n  ✅ Migrasi selesai tanpa error!\n')));
    } else {
        console.log(c.yellow(c.bold(`\n  ⚠️  Selesai dengan ${totalFail} error.\n`)));
    }

    await mongoose.disconnect();
    await sequelize.close();
    process.exit(0);
}

main().catch(err => {
    console.error(c.red('\n❌ ERROR FATAL:'), err.message);
    process.exit(1);
});