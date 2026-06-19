/**
 * seed-admin.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Script untuk membuat / memperbarui user Admin di database Railway.
 *
 * CARA PAKAI:
 *   Di Railway Console (atau lokal dengan .env Railway):
 *   node scripts/seed-admin.js
 *
 * ENV yang wajib diisi sebelum jalankan:
 *   ADMIN_NAME     = "Nama Admin"         (default: "Admin Klinik")
 *   ADMIN_EMAIL    = "admin@example.com"  (WAJIB)
 *   ADMIN_PASSWORD = "Password123!"       (WAJIB, min 8 char, ada huruf besar & angka)
 *   ADMIN_PHONE    = "081234567890"       (default: "081234567890")
 *
 *   + semua env koneksi MySQL (MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { sequelize, User } = require('../models/mysql');

// ─── Warna terminal ───────────────────────────────────────────────────────────
const c = {
    reset : '\x1b[0m',
    green : '\x1b[32m',
    red   : '\x1b[31m',
    yellow: '\x1b[33m',
    cyan  : '\x1b[36m',
    bold  : '\x1b[1m',
};
const ok  = (m) => console.log(`${c.green}✅ ${m}${c.reset}`);
const err = (m) => console.log(`${c.red}❌ ${m}${c.reset}`);
const inf = (m) => console.log(`${c.cyan}ℹ  ${m}${c.reset}`);
const warn = (m) => console.log(`${c.yellow}⚠  ${m}${c.reset}`);

async function seedAdmin() {
    console.log(`\n${c.bold}${c.cyan}═══════════════════════════════════════════${c.reset}`);
    console.log(`${c.bold}   Klinik IPB — Seed Admin User${c.reset}`);
    console.log(`${c.bold}${c.cyan}═══════════════════════════════════════════${c.reset}\n`);

    // ─── Validasi env ─────────────────────────────────────────────────────────
    const adminEmail    = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminName     = process.env.ADMIN_NAME     || 'Admin Klinik';
    const adminPhone    = process.env.ADMIN_PHONE    || '081234567890';

    if (!adminEmail) {
        err('ADMIN_EMAIL tidak diset di environment variable!');
        err('Tambahkan di Railway: ADMIN_EMAIL=admin@klinik.com');
        process.exit(1);
    }

    if (!adminPassword) {
        err('ADMIN_PASSWORD tidak diset di environment variable!');
        err('Tambahkan di Railway: ADMIN_PASSWORD=Password123!');
        process.exit(1);
    }

    if (adminPassword.length < 8) {
        err('ADMIN_PASSWORD minimal 8 karakter!');
        process.exit(1);
    }

    inf(`Email    : ${adminEmail}`);
    inf(`Nama     : ${adminName}`);
    inf(`Role     : admin`);
    console.log('');

    // ─── Koneksi DB ──────────────────────────────────────────────────────────
    try {
        inf('Menghubungkan ke MySQL...');
        await sequelize.authenticate();
        ok('Koneksi MySQL berhasil');
    } catch (e) {
        err(`Gagal konek ke MySQL: ${e.message}`);
        err('Pastikan env MYSQL_HOST / MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE sudah benar di Railway.');
        process.exit(1);
    }

    // ─── Cek apakah admin sudah ada ──────────────────────────────────────────
    try {
        const existing = await User.findOne({ where: { email: adminEmail } });

        if (existing) {
            warn(`User dengan email ${adminEmail} sudah ada (role: ${existing.role})`);

            if (existing.role !== 'admin') {
                existing.role = 'admin';
                existing.isActive   = true;
                existing.isVerified = true;
                await existing.save();
                ok(`Role berhasil diupdate ke 'admin' untuk ${adminEmail}`);
            } else {
                // Update password jika script dijalankan ulang (berguna untuk reset password)
                existing.password   = adminPassword; // hook beforeSave akan hash otomatis
                existing.isActive   = true;
                existing.isVerified = true;
                await existing.save();
                ok(`Admin sudah ada — password & status diperbarui untuk ${adminEmail}`);
            }
        } else {
            // Buat admin baru
            const admin = await User.create({
                name       : adminName,
                email      : adminEmail,
                password   : adminPassword,
                phone      : adminPhone,
                dateOfBirth: '1990-01-01',
                gender     : 'laki-laki',
                role       : 'admin',
                isActive   : true,
                isVerified : true,
            });

            ok(`Admin berhasil dibuat!`);
            ok(`ID   : ${admin.id}`);
            ok(`Email: ${admin.email}`);
            ok(`Role : ${admin.role}`);
        }

        console.log('');
        console.log(`${c.bold}${c.green}═══════════════════════════════════════════${c.reset}`);
        console.log(`${c.bold}${c.green}   SELESAI — Admin siap digunakan${c.reset}`);
        console.log(`${c.bold}${c.green}═══════════════════════════════════════════${c.reset}`);
        console.log('');
        console.log(`${c.yellow}Login di frontend dengan:${c.reset}`);
        console.log(`  Email   : ${adminEmail}`);
        console.log(`  Password: ${adminPassword}`);
        console.log('');

    } catch (e) {
        err(`Gagal membuat admin: ${e.message}`);
        if (e.errors) {
            e.errors.forEach(ve => err(`  → ${ve.path}: ${ve.message}`));
        }
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

seedAdmin();
