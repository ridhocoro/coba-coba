// Daftar rekening tujuan pembayaran
const bankAccounts = [
    {
        id: 1,
        bankName: 'Bank BCA',
        accountNumber: '1234567890',
        accountName: 'Klinik Pratama IPB',
        branch: 'KCU Bogor',
        isActive: true
    },
    {
        id: 2,
        bankName: 'Bank Mandiri',
        accountNumber: '123456789012',
        accountName: 'Klinik Pratama IPB',
        branch: 'KCP Darmaga',
        isActive: true
    },
    {
        id: 3,
        bankName: 'Bank BRI',
        accountNumber: '1234567890123',
        accountName: 'Klinik Pratama IPB',
        branch: 'Cabang Bogor',
        isActive: true
    },
    {
        id: 4,
        bankName: 'Bank BNI',
        accountNumber: '1234567890',
        accountName: 'Klinik Pratama IPB',
        branch: 'KCU Bogor',
        isActive: true
    }
];

// QRIS (jika ada)
const qrisAccounts = [
    {
        id: 1,
        name: 'QRIS Klinik Pratama IPB',
        qrCode: '/images/qris-klinik.png', // Path ke file QR code
        merchantName: 'Klinik Pratama IPB',
        isActive: true
    }
];

module.exports = { bankAccounts, qrisAccounts };