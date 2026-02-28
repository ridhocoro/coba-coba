const mongoose = require('mongoose');
const Doctor = require('./models/Doctor');
require('dotenv').config();

const doctors = [
    {
        name: 'dr. Ahmad Syauqi, Sp.PD',
        specialization: 'Penyakit Dalam',
        consultationFee: 150000,
        qualification: 'Spesialis Penyakit Dalam',
        experience: 15,
        rating: 4.9,
        totalReviews: 128,
        isActive: true,
        bio: 'Dokter spesialis penyakit dalam dengan pengalaman 15 tahun di RSUP Nasional. Lulusan Universitas Indonesia.',
        photo: '/images/doctor-1.jpg',
        availableDays: [
            {
                day: 'Monday',
                slots: [
                    { startTime: '08:00', endTime: '12:00', isAvailable: true },
                    { startTime: '13:00', endTime: '16:00', isAvailable: true }
                ]
            },
            {
                day: 'Wednesday',
                slots: [
                    { startTime: '08:00', endTime: '12:00', isAvailable: true },
                    { startTime: '13:00', endTime: '16:00', isAvailable: true }
                ]
            },
            {
                day: 'Friday',
                slots: [
                    { startTime: '08:00', endTime: '12:00', isAvailable: true }
                ]
            }
        ]
    },
    {
        name: 'dr. Siti Rahma, Sp.A',
        specialization: 'Spesialis Anak',
        consultationFee: 120000,
        qualification: 'Spesialis Anak',
        experience: 12,
        rating: 4.8,
        totalReviews: 95,
        isActive: true,
        bio: 'Dokter spesialis anak yang ramah dan berpengalaman. Lulusan Universitas Padjadjaran.',
        photo: '/images/doctor-2.jpg',
        availableDays: [
            {
                day: 'Tuesday',
                slots: [
                    { startTime: '09:00', endTime: '14:00', isAvailable: true }
                ]
            },
            {
                day: 'Thursday',
                slots: [
                    { startTime: '09:00', endTime: '14:00', isAvailable: true }
                ]
            }
        ]
    },
    {
        name: 'dr. Budi Santoso, Sp.JP',
        specialization: 'Spesialis Jantung',
        consultationFee: 250000,
        qualification: 'Spesialis Jantung dan Pembuluh Darah',
        experience: 20,
        rating: 5.0,
        totalReviews: 210,
        isActive: true,
        bio: 'Konsultan kardiologi dengan pengalaman 20 tahun. Mantan kepala ruang ICCU di RS Jantung Harapan Kita.',
        photo: '/images/doctor-3.jpg',
        availableDays: [
            {
                day: 'Monday',
                slots: [
                    { startTime: '10:00', endTime: '14:00', isAvailable: true }
                ]
            },
            {
                day: 'Thursday',
                slots: [
                    { startTime: '10:00', endTime: '14:00', isAvailable: true }
                ]
            }
        ]
    },
    {
        name: 'dr. Dewi Lestari, Sp.OG',
        specialization: 'Spesialis Kandungan',
        consultationFee: 200000,
        qualification: 'Spesialis Obstetri dan Ginekologi',
        experience: 10,
        rating: 4.7,
        totalReviews: 82,
        isActive: true,
        bio: 'Dokter spesialis kandungan yang berpengalaman dalam menangani kehamilan dan kesehatan wanita.',
        photo: '/images/doctor-4.jpg',
        availableDays: [
            {
                day: 'Tuesday',
                slots: [
                    { startTime: '13:00', endTime: '17:00', isAvailable: true }
                ]
            },
            {
                day: 'Friday',
                slots: [
                    { startTime: '08:00', endTime: '12:00', isAvailable: true }
                ]
            }
        ]
    },
    {
        name: 'dr. Rudi Hermawan, Sp.KK',
        specialization: 'Spesialis Kulit',
        consultationFee: 180000,
        qualification: 'Spesialis Kulit dan Kelamin',
        experience: 8,
        rating: 4.6,
        totalReviews: 67,
        isActive: true,
        bio: 'Dokter spesialis kulit yang ahli dalam perawatan kulit dan penanganan masalah dermatologi.',
        photo: '/images/doctor-5.jpg',
        availableDays: [
            {
                day: 'Wednesday',
                slots: [
                    { startTime: '09:00', endTime: '15:00', isAvailable: true }
                ]
            },
            {
                day: 'Saturday',
                slots: [
                    { startTime: '08:00', endTime: '12:00', isAvailable: true }
                ]
            }
        ]
    },
    {
        name: 'dr. Maya Safitri, Sp.M',
        specialization: 'Spesialis Mata',
        consultationFee: 160000,
        qualification: 'Spesialis Mata',
        experience: 7,
        rating: 4.8,
        totalReviews: 73,
        isActive: true,
        bio: 'Dokter spesialis mata dengan pelayanan ramah dan alat diagnostik modern.',
        photo: '/images/doctor-6.jpg',
        availableDays: [
            {
                day: 'Monday',
                slots: [
                    { startTime: '08:00', endTime: '12:00', isAvailable: true }
                ]
            },
            {
                day: 'Thursday',
                slots: [
                    { startTime: '13:00', endTime: '17:00', isAvailable: true }
                ]
            }
        ]
    }
];

const seedDoctors = async () => {
    try {
        const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/klinik-ipb';

        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');

        await Doctor.deleteMany({});
        console.log('🗑️ Existing doctors deleted');

        const result = await Doctor.insertMany(doctors);
        console.log(`✅ ${result.length} doctors seeded successfully`);

        console.log('\n📋 Daftar Dokter:');
        result.forEach((doc, index) => {
            console.log(`${index + 1}. ${doc.name} - ${doc.specialization} - Rp ${doc.consultationFee.toLocaleString()}`);
        });

        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');

        process.exit(0);

    } catch (error) {
        console.error('❌ Error seeding doctors:', error);
        process.exit(1);
    }
};

seedDoctors();