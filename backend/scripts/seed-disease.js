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

const TOTAL_RECORDS = 250;
const DAYS_BACK = 30;

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

function getRandomDateWithinDays(daysAgo) {
    const now = new Date();
    const past = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
    return new Date(past.getTime() + Math.random() * (now.getTime() - past.getTime()));
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
        const doctors = await Doctor.findAll({ attributes: ['id'] });
        const users = await User.findAll({ attributes: ['id'], where: { role: 'user' } });

        if (doctors.length === 0) throw new Error("Tidak ada dokter di database. Silakan buat dokter terlebih dahulu.");
        if (users.length === 0) throw new Error("Tidak ada user (pasien) di database. Silakan buat user terlebih dahulu.");

        console.log(`${c.cyan}ℹ  Mempersiapkan ${TOTAL_RECORDS} data...${c.reset}`);

        const createdConsultations = [];
        const createdAppointments = [];

        for (let i = 0; i < TOTAL_RECORDS; i++) {
            const randomDoc = doctors[Math.floor(Math.random() * doctors.length)].id;
            const randomUser = users[Math.floor(Math.random() * users.length)].id;
            const disease = getRandomDisease();
            const date = getRandomDateWithinDays(DAYS_BACK);
            
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
