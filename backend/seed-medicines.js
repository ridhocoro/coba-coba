const mongoose = require('mongoose');
const Medicine = require('./models/Medicine');
require('dotenv').config();

const medicines = [
    // ========== VITAMIN & SUPLEMEN ==========
    {
        name: 'Vitamin C 500mg',
        genericName: 'Ascorbic Acid',
        manufacturer: 'Kimia Farma',
        category: 'obat_bebas',
        price: 25000,
        stock: 100,
        description: 'Vitamin C untuk meningkatkan daya tahan tubuh',
        indications: 'Membantu memenuhi kebutuhan vitamin C',
        dosage: '1 tablet sehari',
        sideEffects: 'Gangguan pencernaan jika dikonsumsi berlebihan',
        prescription: false,
        image: '/images/vitamin-c.jpg'
    },
    {
        name: 'Vitamin D3 1000 IU',
        genericName: 'Cholecalciferol',
        manufacturer: 'Sanbe',
        category: 'obat_bebas',
        price: 45000,
        stock: 75,
        description: 'Vitamin D untuk kesehatan tulang',
        indications: 'Mencegah osteoporosis',
        dosage: '1 kapsul sehari',
        sideEffects: 'Jarang terjadi',
        prescription: false,
        image: '/images/vitamin-d3.jpg'
    },
    {
        name: 'Multivitamin & Mineral',
        genericName: 'Various',
        manufacturer: 'Combiphar',
        category: 'obat_bebas',
        price: 35000,
        stock: 120,
        description: 'Kombinasi vitamin dan mineral lengkap',
        indications: 'Memelihara kesehatan tubuh',
        dosage: '1 tablet sehari',
        sideEffects: 'Mual jika dikonsumsi saat perut kosong',
        prescription: false,
        image: '/images/multivitamin.jpg'
    },
    {
        name: 'Zinc 20mg',
        genericName: 'Zinc Sulfate',
        manufacturer: 'Dexa Medica',
        category: 'obat_bebas',
        price: 30000,
        stock: 85,
        description: 'Suplemen zinc untuk meningkatkan imunitas',
        indications: 'Membantu pemulihan saat sakit',
        dosage: '1 tablet sehari',
        sideEffects: 'Gangguan pencernaan',
        prescription: false,
        image: '/images/zinc.jpg'
    },
    {
        name: 'Omega-3 1000mg',
        genericName: 'Fish Oil',
        manufacturer: 'Blackmores',
        category: 'obat_bebas',
        price: 120000,
        stock: 50,
        description: 'Minyak ikan untuk kesehatan jantung',
        indications: 'Menjaga kesehatan jantung dan pembuluh darah',
        dosage: '1 kapsul sehari',
        sideEffects: 'Rasa amis di mulut',
        prescription: false,
        image: '/images/omega3.jpg'
    },
    {
        name: 'Vitamin B Complex',
        genericName: 'Vitamin B1, B6, B12',
        manufacturer: 'Mega Esia',
        category: 'obat_bebas',
        price: 28000,
        stock: 95,
        description: 'Kombinasi vitamin B untuk kesehatan saraf',
        indications: 'Membantu metabolisme energi',
        dosage: '1 tablet sehari',
        sideEffects: 'Urine berwarna kuning (normal)',
        prescription: false,
        image: '/images/vitamin-b.jpg'
    },
    {
        name: 'Calcium 500mg',
        genericName: 'Calcium Carbonate',
        manufacturer: 'Kimia Farma',
        category: 'obat_bebas',
        price: 32000,
        stock: 80,
        description: 'Kalsium untuk kesehatan tulang dan gigi',
        indications: 'Mencegah osteoporosis',
        dosage: '1 tablet sehari',
        sideEffects: 'Sembelit',
        prescription: false,
        image: '/images/calcium.jpg'
    },
    {
        name: 'Probiotik',
        genericName: 'Lactobacillus',
        manufacturer: 'Interbat',
        category: 'obat_bebas',
        price: 55000,
        stock: 60,
        description: 'Suplemen untuk kesehatan pencernaan',
        indications: 'Menjaga keseimbangan flora usus',
        dosage: '1 kapsul sehari',
        sideEffects: 'Kembung ringan',
        prescription: false,
        image: '/images/probiotik.jpg'
    },

    // ========== OBAT BEBAS ==========
    {
        name: 'Paracetamol 500mg',
        genericName: 'Paracetamol',
        manufacturer: 'Sanbe',
        category: 'obat_bebas',
        price: 15000,
        stock: 200,
        description: 'Obat pereda demam dan nyeri',
        indications: 'Demam, sakit kepala, nyeri ringan',
        dosage: '3-4 kali sehari 1 tablet',
        sideEffects: 'Gangguan hati jika dosis berlebihan',
        prescription: false,
        image: '/images/paracetamol.jpg'
    },
    {
        name: 'Ibuprofen 400mg',
        genericName: 'Ibuprofen',
        manufacturer: 'Dexa Medica',
        category: 'obat_bebas_terbatas',
        price: 28000,
        stock: 150,
        description: 'Obat anti-inflamasi non-steroid',
        indications: 'Nyeri sendi, sakit gigi, peradangan',
        dosage: '2-3 kali sehari 1 tablet',
        sideEffects: 'Iritasi lambung',
        prescription: false,
        image: '/images/ibuprofen.jpg'
    },
    {
        name: 'Antasida Tablet',
        genericName: 'Aluminium Hydroxide',
        manufacturer: 'Kimia Farma',
        category: 'obat_bebas',
        price: 12000,
        stock: 180,
        description: 'Obat untuk mengatasi maag',
        indications: 'Nyeri lambung, mual, kembung',
        dosage: '3-4 kali sehari 1-2 tablet',
        sideEffects: 'Sembelit',
        prescription: false,
        image: '/images/antasida.jpg'
    },
    {
        name: 'CTM 4mg',
        genericName: 'Chlorpheniramine Maleate',
        manufacturer: 'Meprofarm',
        category: 'obat_bebas_terbatas',
        price: 8000,
        stock: 220,
        description: 'Obat anti-alergi',
        indications: 'Alergi, biduran, pilek alergi',
        dosage: '2-3 kali sehari 1 tablet',
        sideEffects: 'Mengantuk',
        prescription: false,
        image: '/images/ctm.jpg'
    },
    {
        name: 'OBH Sirup',
        genericName: 'Various',
        manufacturer: 'Darya-Varia',
        category: 'obat_bebas',
        price: 22000,
        stock: 90,
        description: 'Obat batuk hitam',
        indications: 'Batuk berdahak',
        dosage: '3 kali sehari 15ml',
        sideEffects: 'Mual',
        prescription: false,
        image: '/images/obh.jpg'
    },

    // ========== OBAT BEBAS TERBATAS ==========
    {
        name: 'Asam Mefenamat 500mg',
        genericName: 'Mefenamic Acid',
        manufacturer: 'Sanbe',
        category: 'obat_bebas_terbatas',
        price: 25000,
        stock: 130,
        description: 'Obat pereda nyeri',
        indications: 'Nyeri haid, sakit gigi, nyeri otot',
        dosage: '3 kali sehari 1 tablet',
        sideEffects: 'Gangguan pencernaan',
        prescription: true,
        image: '/images/asam-mefenamat.jpg'
    },
    {
        name: 'Amoxicillin 500mg',
        genericName: 'Amoxicillin',
        manufacturer: 'Dexa Medica',
        category: 'antibiotik',
        price: 35000,
        stock: 100,
        description: 'Antibiotik golongan penisilin',
        indications: 'Infeksi bakteri',
        dosage: '2-3 kali sehari 1 kapsul',
        sideEffects: 'Alergi, diare',
        prescription: true,
        image: '/images/amoxicillin.jpg'
    },
    {
        name: 'Dexamethasone 0.5mg',
        genericName: 'Dexamethasone',
        manufacturer: 'Kimia Farma',
        category: 'obat_keras',
        price: 18000,
        stock: 70,
        description: 'Kortikosteroid',
        indications: 'Peradangan, alergi berat',
        dosage: 'Sesuai petunjuk dokter',
        sideEffects: 'Peningkatan gula darah',
        prescription: true,
        image: '/images/dexamethasone.jpg'
    },

    // ========== ALAT KESEHATAN ==========
    {
        name: 'Masker Medis 3ply',
        genericName: 'Face Mask',
        manufacturer: 'Various',
        category: 'obat_bebas',
        price: 25000,
        stock: 300,
        description: 'Masker bedah 3 lapis',
        indications: 'Perlindungan dari droplet',
        dosage: 'Ganti setiap 4 jam',
        sideEffects: 'Tidak ada',
        prescription: false,
        image: '/images/masker.jpg'
    },
    {
        name: 'Hand Sanitizer 100ml',
        genericName: 'Alcohol Based',
        manufacturer: 'Antis',
        category: 'obat_bebas',
        price: 18000,
        stock: 150,
        description: 'Pembersih tangan tanpa bilas',
        indications: 'Membunuh kuman',
        dosage: 'Oleskan ke telapak tangan',
        sideEffects: 'Kulit kering',
        prescription: false,
        image: '/images/hand-sanitizer.jpg'
    },
    {
        name: 'Termometer Digital',
        genericName: 'Digital Thermometer',
        manufacturer: 'Omron',
        category: 'obat_bebas',
        price: 75000,
        stock: 40,
        description: 'Alat pengukur suhu tubuh digital',
        indications: 'Mengukur suhu tubuh',
        dosage: 'Gunakan sesuai petunjuk',
        sideEffects: 'Tidak ada',
        prescription: false,
        image: '/images/termometer.jpg'
    }
];

const seedMedicines = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/klinik-ipb');
        console.log('✅ Connected to MongoDB');

        await Medicine.deleteMany({});
        console.log('✅ Existing medicines deleted');

        const result = await Medicine.insertMany(medicines);
        console.log(`✅ ${result.length} medicines seeded successfully`);

        console.log('\n📋 Daftar Obat:');
        result.forEach((med, index) => {
            console.log(`${index + 1}. ${med.name} - Rp ${med.price.toLocaleString()} - Stok: ${med.stock}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding medicines:', error);
        process.exit(1);
    }
};

seedMedicines();