# 🏥 Klinik Pratama IPB

> Sistem manajemen klinik berbasis web untuk mahasiswa IPB — layanan konsultasi dokter online, janji temu, apotek, dan health check dalam satu platform.

---

## 👥 Anggota Kelompok

| Nama | NIM | Peran |
|------|-----|-------|
| Rifqa Nasywa Kamila | M0405241028 | <!-- Peran --> |
| Aqila Begum Fahm Ara | M0405241029 | <!-- Peran --> |
| Muhammad Ridho Dwi Kuncoro | M0405241030 | <!-- Peran --> |

---

## 🌐 Live Demo

| Layanan | URL |
|---------|-----|
| Frontend | https://klinik-frontend-amber.vercel.app |
| Backend API | https://coba-coba-production-4620.up.railway.app |

---

## 📌 Apa itu Klinik Pratama IPB?

**Klinik Pratama IPB** adalah platform manajemen klinik berbasis web yang dirancang khusus untuk civitas akademika IPB. Platform ini menghadirkan layanan kesehatan digital yang terintegrasi — mulai dari konsultasi dokter secara real-time, pemesanan janji temu, pembelian obat di apotek online, hingga pengecekan kesehatan mandiri berbasis kamera (rPPG). Sistem ini dibangun dengan arsitektur hybrid database (MongoDB + MySQL) dan mendukung komunikasi real-time via Socket.IO.

---

## 🛠️ Tech Stack

### Frontend
| Teknologi | Keterangan |
|-----------|-----------|
| React 18 | UI framework utama |
| React Router v7 | Client-side routing |
| Bootstrap 5 + React-Bootstrap | Komponen UI & styling |
| Chart.js + react-chartjs-2 | Visualisasi data & grafik admin |
| Socket.IO Client | Real-time chat & notifikasi |
| MediaPipe Tasks Vision | Deteksi wajah untuk VitalScan rPPG |
| FFmpeg (WASM) | Pemrosesan video di sisi klien |
| React Hot Toast | Notifikasi toast |
| Vercel | Deployment |

### Backend
| Teknologi | Keterangan |
|-----------|-----------|
| Node.js + Express | Server & REST API |
| MongoDB + Mongoose | Database utama (konsultasi, chat, notifikasi) |
| MySQL + Sequelize | Database relasional (user, dokter, obat, order) |
| Socket.IO | Real-time bidirectional communication |
| Redis (ioredis) | Caching & rate limiting |
| JWT | Autentikasi & otorisasi |
| node-cron | Penjadwalan tugas otomatis |
| PDFKit | Generate PDF (resep, surat sakit) |
| Railway | Deployment |

### Layanan Eksternal
| Layanan | Fungsi |
|---------|--------|
| Xendit | Payment gateway (konsultasi & apotek) |
| Cloudinary | Upload & CDN media/gambar |
| Backblaze B2 | Penyimpanan file (kompatibel S3) |
| Groq SDK | LLM untuk AI Chatbot (model Mistral) |
| Fonnte | Notifikasi WhatsApp |
| Brevo | Pengiriman email transaksional |

---

## ✨ Fitur-fitur

### 1. Halaman Utama (Landing Page)
> Screenshot

### 2. Autentikasi (Register & Login)
> Screenshot

### 3. Konsultasi Online (Chat + Video Call)
> Screenshot

### 4. Janji Temu Dokter (Booking Slot)
> Screenshot

### 5. Apotek Online
> Screenshot

### 6. Pembayaran (Xendit)
> Screenshot

### 7. Health Check
> Screenshot

- **BMI Calculator** — kalkulasi indeks massa tubuh
- **Calorie Calculator** — estimasi kebutuhan kalori harian
- **Blood Pressure Checker** — panduan tekanan darah
- **VitalScan (rPPG)** — pengukuran detak jantung via kamera menggunakan MediaPipe & algoritma rPPG dengan filter ektopik dan deteksi kemiringan kepala

### 8. AI Chatbot
> Screenshot

### 9. Riwayat Pembayaran
> Screenshot

### 10. Dashboard Dokter
> Screenshot

- Beranda & statistik pasien
- Manajemen jadwal (atur ketersediaan)
- Konsultasi & janji temu aktif
- Buat resep & surat sakit digital
- Riwayat pasien

### 11. Dashboard Admin
> Screenshot

- Statistik & grafik frekuensi (Chart.js)
- Kelola dokter, user, apotek
- Manajemen konsultasi & janji temu
- Laporan & analytics
- Surat sakit
- Pengaturan klinik
- Chat admin–dokter

---

## ⚙️ Persyaratan Sistem

- Node.js 18.20.x
- npm 10.x
- MongoDB (lokal atau Atlas)
- MySQL Server
- Redis (lokal atau Upstash)

---

## 🚀 Instalasi

### 1. Clone Repository

```bash
git clone https://github.com/ridhocoro/coba-coba.git
cd coba-coba
```

### 2. Setup Backend

```bash
cd backend
npm install
```

Buat file `.env` di folder `backend/`:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://127.0.0.1:27017/klinik-ipb
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=klinik_ipb
MYSQL_USER=root
MYSQL_PASSWORD=your_password

# Redis
REDIS_URL=redis://127.0.0.1:6379

# Auth
JWT_SECRET=your_jwt_secret_key

# Xendit
XENDIT_SECRET_KEY=your_xendit_secret_key
XENDIT_WEBHOOK_TOKEN=your_xendit_webhook_token

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Backblaze B2
B2_APPLICATION_KEY_ID=your_key_id
B2_APPLICATION_KEY=your_application_key
B2_BUCKET_NAME=your_bucket_name
B2_ENDPOINT=your_b2_endpoint

# Groq (AI Chatbot)
GROQ_API_KEY=your_groq_api_key

# Email
BREVO_API_KEY=your_brevo_api_key
RESEND_API_KEY=your_resend_api_key

# WhatsApp (Fonnte)
FONNTE_TOKEN=your_fonnte_token

# Frontend URL (untuk CORS)
FRONTEND_URL=http://localhost:3000
```

Jalankan migrasi & seed (opsional):

```bash
node scripts/init-db.js
node scripts/migrate.js
node seed-doctors.js     # opsional
node seed-medicines.js   # opsional
```

Jalankan backend:

```bash
npm run dev
```

Backend berjalan di `http://localhost:5000`

---

### 3. Setup Frontend

```bash
cd frontend
npm install
```

Buat file `.env` di folder `frontend/`:

```env
REACT_APP_API_URL=http://localhost:5000
REACT_APP_SOCKET_URL=http://localhost:5000
```

Jalankan frontend:

```bash
npm start
```

Frontend berjalan di `http://localhost:3000`

---

## 🗄️ Arsitektur Database

Sistem menggunakan **hybrid database** — dua database berjalan paralel dan dijembatani oleh utility `hybridJoin.js`:

| Database | Digunakan untuk |
|----------|----------------|
| **MongoDB** | Konsultasi, pesan chat, notifikasi, jadwal dokter (override), admin chat |
| **MySQL** | User, dokter, obat, order apotek, pembayaran, surat sakit, pengaturan klinik |

---

## 🌐 Deployment

### Backend (Railway)

1. Push ke GitHub
2. Hubungkan repo ke [Railway](https://railway.app)
3. Tambahkan semua environment variable dari `.env` ke Railway dashboard
4. Set start command: `node server.js`

### Frontend (Vercel)

1. Hubungkan repo ke [Vercel](https://vercel.com)
2. Set root directory ke `frontend/`
3. Tambahkan environment variable:
   ```
   REACT_APP_API_URL=https://your-backend.up.railway.app
   REACT_APP_SOCKET_URL=https://your-backend.up.railway.app
   ```

---

## ⚠️ Common Issues

**`SequelizeValidationError` saat create dokter/user**
> Pastikan field di request body menggunakan format yang sesuai dengan model Sequelize (snake_case vs camelCase). Cek definisi kolom di `backend/models/mysql/index.js`.

**`JWT_SECRET` tidak terbaca di production**
> Setelah menambahkan environment variable baru di Railway, lakukan **Redeploy** manual agar env ter-load ulang.

**Socket.IO tidak terkoneksi di production**
> Pastikan `FRONTEND_URL` di backend dan `REACT_APP_SOCKET_URL` di frontend sudah mengarah ke URL production yang benar, bukan `localhost`.

**Redis connection error**
> Jika tidak menggunakan Redis lokal, gunakan [Upstash](https://upstash.com) dan set `REDIS_URL` ke connection string yang diberikan.

**File upload gagal (Cloudinary/B2)**
> Pastikan semua credentials Cloudinary dan Backblaze B2 sudah diisi dengan benar dan bucket/folder sudah dikonfigurasi dengan akses public atau signed URL.

---

## 📄 Lisensi

Proyek ini dibuat untuk keperluan akademik. Seluruh hak cipta milik tim pengembang.
