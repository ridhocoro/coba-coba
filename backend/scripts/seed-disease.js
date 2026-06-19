/**
 * seed-disease.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Script untuk membuat data dummy tren penyakit secara otomatis.
 * Menghasilkan data Consultation (Online) dan Appointment (Offline)
 * dengan proporsi yang natural untuk presentasi grafik penyakit.
 *
 * CARA PAKAI:
 *   node scripts/seed-disease.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const { sequelize, User, Doctor } = require('../models/mysql');
const Appointment = require('../models/Appointment');
const Consultation = require('../models/Consultation');

// Warna terminal
const c = { reset: '\x1b[0m', green: '\x1b[32m', cyan: '\x1b[36m', bold: '\x1b[1m', yellow: '\x1b[33m' };

const TOTAL_RECORDS = 500;
const DAYS_BACK = 180; // 6 bulan

// Proporsi Penyakit Natural (Total 100)
const DISEASE_DISTRIBUTION = [
    { name: 'ISPA', weight: 28 },
    { name: 'Gangguan Pencernaan', weight: 22 },
    { name: 'Penyakit Kulit', weight: 14 },
    { name: 'Hipertensi', weight: 9 },
    { name: 'Diabetes', weight: 8 },
    { name: 'Karies Gigi', weight: 5 },
    { name: 'Sakit Gusi', weight: 4 },
    { name: 'Gangguan Mata', weight: 3 },
    { name: 'Gangguan Jantung', weight: 2 },
    { name: 'Lainnya', weight: 5 },
];

function getRandomDisease() {
    const totalWeight = DISEASE_DISTRIBUTION.reduce((sum, item) => sum + item.weight, 0);
    let randomNum = Math.random() * totalWeight;
    for (const item of DISEASE_DISTRIBUTION) {
        if (randomNum < item.weight) return item.name;
        randomNum -= item.weight;
    }
    return 'Lainnya';
}

function getDateBetween(minDays, maxDays) {
    const now = new Date();
    const pastMin = new Date(now.getTime() - (minDays * 24 * 60 * 60 * 1000));
    const pastMax = new Date(now.getTime() - (maxDays * 24 * 60 * 60 * 1000));
    return new Date(pastMax.getTime() + Math.random() * (pastMin.getTime() - pastMax.getTime()));
}

async function seedDisease() {
    console.log(`\n${c.bold}${c.cyan}═══════════════════════════════════════════${c.reset}`);
    console.log(`${c.bold}   Klinik IPB — Seed Disease Trend Data${c.reset}`);
    console.log(`${c.bold}${c.cyan}═══════════════════════════════════════════${c.reset}\n`);

    try {
        // 1. Connect MySQL
        await sequelize.authenticate();
        console.log(`${c.green}✅ MySQL Connected${c.reset}`);

        // 2. Connect MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/klinik-ipb');
        console.log(`${c.green}✅ MongoDB Connected${c.reset}`);

        // 3. Fetch Doctors & Users
        const { Op } = require('sequelize');
        const doctors = await Doctor.findAll({ attributes: ['id'] });
        
        if (doctors.length === 0) throw new Error("Tidak ada dokter di database. Silakan buat dokter terlebih dahulu.");

        // Pastikan ada Laki-laki dan Perempuan untuk kebutuhan filter
        let maleUsers = await User.findAll({ attributes: ['id'], where: { role: { [Op.in]: ['user', 'mahasiswa'] }, gender: 'laki-laki' } });
        let femaleUsers = await User.findAll({ attributes: ['id'], where: { role: { [Op.in]: ['user', 'mahasiswa'] }, gender: 'perempuan' } });

        const bcrypt = require('bcryptjs');
        const hashedPw = await bcrypt.hash('password123', 10);

        if (maleUsers.length === 0) {
            console.log(`${c.yellow}ℹ  Tidak ada user Laki-laki. Membuat user dummy...${c.reset}`);
            const dummyMale = await User.create({ name: 'Dummy Laki-laki', email: `malepasien_${Date.now()}@klinik.com`, password: hashedPw, phone: '08123456789', gender: 'laki-laki', role: 'user' });
            maleUsers = [dummyMale];
        }
        if (femaleUsers.length === 0) {
            console.log(`${c.yellow}ℹ  Tidak ada user Perempuan. Membuat user dummy...${c.reset}`);
            const dummyFemale = await User.create({ name: 'Dummy Perempuan', email: `femalepasien_${Date.now()}@klinik.com`, password: hashedPw, phone: '08123456789', gender: 'perempuan', role: 'user' });
            femaleUsers = [dummyFemale];
        }

        const allUsers = [...maleUsers, ...femaleUsers];

        console.log(`${c.cyan}ℹ  Mempersiapkan ${TOTAL_RECORDS} data...${c.reset}`);

        const createdConsultations = [];
        const createdAppointments = [];

        for (let i = 0; i < TOTAL_RECORDS; i++) {
            const randomDoc = doctors[Math.floor(Math.random() * doctors.length)].id;
            
            // Distribusi 50% Laki-laki, 50% Perempuan agar imbang
            const isMale = Math.random() < 0.5;
            const targetUsers = isMale ? maleUsers : femaleUsers;
            const randomUser = targetUsers[Math.floor(Math.random() * targetUsers.length)].id;
            
            let disease = getRandomDisease();
            if (!isMale && Math.random() < 0.35) {
                // 35% peluang khusus pasien wanita diarahkan ke label spesifik wanita
                const fRand = Math.random();
                if (fRand < 0.43) disease = 'Gangguan Menstruasi';  // ~15%
                else if (fRand < 0.71) disease = 'Anemia';          // ~10%
                else disease = 'Gangguan Pencernaan';               // ~10% tambahan
            }
            
            // Algoritma Musim Penyakit (Trend Waves) agar grafik memiliki puncak yang logis
            let date;
            if (disease === 'ISPA') {
                // Memuncak di 30-60 hari lalu (musim pancaroba)
                date = Math.random() < 0.65 ? getDateBetween(25, 65) : getDateBetween(0, 180);
            } else if (disease === 'Penyakit Kulit') {
                // Memuncak di 90-120 hari lalu (musim kemarau panjang)
                date = Math.random() < 0.65 ? getDateBetween(85, 125) : getDateBetween(0, 180);
            } else if (disease === 'Gangguan Pencernaan') {
                // Memuncak di 7-30 hari lalu (pasca liburan/lebaran)
                date = Math.random() < 0.65 ? getDateBetween(5, 35) : getDateBetween(0, 180);
            } else if (disease === 'Gangguan Menstruasi') {
                // Memuncak sedikit di 45-75 hari lalu untuk membentuk trend wave yang berbeda
                date = Math.random() < 0.5 ? getDateBetween(45, 75) : getDateBetween(0, 180);
            } else {
                // Penyakit kronis (Hipertensi, Diabetes) tersebar merata sepanjang waktu
                date = getDateBetween(0, 180);
            }
            
            // 60% Offline (Appointment), 40% Online (Consultation)
            const isOffline = Math.random() < 0.6;

            if (isOffline) {
                const appt = {
                    userId: randomUser.toString(),
                    doctorId: randomDoc.toString(),
                    appointmentDate: date,
                    appointmentTime: '10:00',
                    endTime: '11:00',
                    scheduledAt: date,
                    status: 'completed',
                    complaint: 'Keluhan ' + disease,
                    disease_category: disease,
                    category_confidence: 0.85 + (Math.random() * 0.1),
                    category_method: 'ml',
                    completedAt: date,
                };
                createdAppointments.push(appt);
            } else {
                const cons = {
                    userId: randomUser.toString(),
                    doctorId: randomDoc.toString(),
                    consultationType: 'chat',
                    scheduleType: 'instant',
                    scheduledAt: date,
                    status: 'completed',
                    disease_category: disease,
                    category_confidence: 0.85 + (Math.random() * 0.1),
                    category_method: 'ml',
                    completedAt: date,
                };
                createdConsultations.push(cons);
            }
        }

        // Insert to DB
        if (createdAppointments.length > 0) {
            await Appointment.insertMany(createdAppointments);
            console.log(`${c.green}✅ Berhasil insert ${createdAppointments.length} Appointments (Offline)${c.reset}`);
        }
        
        if (createdConsultations.length > 0) {
            await Consultation.insertMany(createdConsultations);
            console.log(`${c.green}✅ Berhasil insert ${createdConsultations.length} Consultations (Online)${c.reset}`);
        }

        console.log(`\n${c.bold}${c.green}🎉 Selesai! Data Disease Trend berhasil dimasukkan.${c.reset}`);
        console.log(`${c.yellow}Silakan cek Dasbor Admin atau Beranda Dokter untuk melihat grafik.${c.reset}\n`);

    } catch (e) {
        console.error(`\n${c.yellow}❌ Gagal:${c.reset}`, e.message);
    } finally {
        await sequelize.close();
        await mongoose.disconnect();
        process.exit(0);
    }
}

seedDisease();
