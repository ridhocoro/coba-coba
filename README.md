# 🏥 Klinik Pratama IPB

> Sistem manajemen klinik berbasis web untuk mahasiswa IPB — layanan konsultasi dokter online, janji temu, apotek, dan health check dalam satu platform.

---

## 👥 Anggota Kelompok

| Nama | NIM | Peran |
|------|-----|-------|
| Rifqa Nasywa Kamila | M0405241028 |QA |
| Aqila Begum Fahm Ara | M0405241029 | UI/UX |
| Muhammad Ridho Dwi Kuncoro | M0405241030 | Fullstack |

---

## 🌐 Live Demo

| Layanan | URL |
|---------|-----|
| Frontend | https://klinik-frontend-amber.vercel.app |
| Backend API | https://coba-coba-production-4620.up.railway.app |

---

## 📌 Apa itu Klinik Pratama IPB?

**Klinik Pratama IPB** merupakan platform layanan kesehatan kampus yang dirancang untuk mempermudah akses medis bagi warga IPB. Aplikasi ini berfungsi sebagai klinik digital yang mempertemukan pasien dengan dokter secara langsung melalui fitur chat konsultasi. Pengguna juga tidak perlu mengantre lama di lokasi karena bisa memesan jadwal pertemuan (janji temu) dan membeli kebutuhan obat secara online. Sebagai tambahan, terdapat fitur asisten kesehatan pintar yang dapat mendeteksi kondisi fisik pengguna cukup lewat pemindaian wajah di kamera.

---
## Class Diagram
<img width="1743" height="1556" alt="Untitled Diagram (2)" src="https://github.com/user-attachments/assets/b74d9737-ec13-495d-888c-e1484a4c16d3" />




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
<img width="1905" height="913" alt="image" src="https://github.com/user-attachments/assets/900ac73d-87b0-4220-a6c9-146e0cc13456" />


### 2. Autentikasi (Register & Login)
<img width="1904" height="911" alt="image" src="https://github.com/user-attachments/assets/3ea11488-33ea-409a-89a1-39ea200ee98e" /> 
<img width="1910" height="909" alt="image" src="https://github.com/user-attachments/assets/ca383b99-5fbf-4b7c-97f8-8a1dc03a5960" />


### 3. Konsultasi Online (Chat + Video Call)
<img width="1905" height="914" alt="image" src="https://github.com/user-attachments/assets/501b37bb-faf1-497a-94a2-9abf5e6901c8" />


### 4. Janji Temu Dokter (Booking Slot)
<img width="1905" height="910" alt="image" src="https://github.com/user-attachments/assets/43f497ca-029a-4c9a-a360-aa49bc9ef4b7" />


### 5. Apotek Online
<img width="1908" height="917" alt="image" src="https://github.com/user-attachments/assets/ba829366-7540-4e99-94c8-c45a8ecec982" />


### 6. Pembayaran (Xendit)
<img width="1919" height="913" alt="image" src="https://github.com/user-attachments/assets/e5a47fa6-3ee4-49a1-8699-8ba476522a30" />
<img width="1909" height="913" alt="image" src="https://github.com/user-attachments/assets/10fa5c18-e3a3-4ed8-8fca-17b721cb7df9" />



### 7. Health Check
<img width="1914" height="910" alt="image" src="https://github.com/user-attachments/assets/abbdce29-687c-43ed-a1bd-bc8184d9e6c6" />
<img width="1908" height="914" alt="image" src="https://github.com/user-attachments/assets/34f21b5b-2cba-40ad-9a16-1ecb43716605" />
<img width="1905" height="908" alt="image" src="https://github.com/user-attachments/assets/64d90947-89be-4843-846a-7e6fd5149fcf" />
<img width="1910" height="906" alt="image" src="https://github.com/user-attachments/assets/676e7b28-19fa-4ddf-bd64-8fd7d0e668ac" />
<img width="1909" height="910" alt="image" src="https://github.com/user-attachments/assets/2f7d9a0d-c6ca-4744-b5cf-30d35a465e4c" />


- **BMI Calculator** — kalkulasi indeks massa tubuh
- **Calorie Calculator** — estimasi kebutuhan kalori harian
- **Blood Pressure Checker** — panduan tekanan darah
- **VitalScan (rPPG)** — pengukuran detak jantung via kamera menggunakan MediaPipe & algoritma rPPG dengan filter ektopik dan deteksi kemiringan kepala

### 8. AI Chatbot
<img width="467" height="694" alt="image" src="https://github.com/user-attachments/assets/7d857032-5ae5-4b8b-8d97-9bdc1ad7e079" />


### 9. Riwayat Pembayaran
<img width="1906" height="916" alt="image" src="https://github.com/user-attachments/assets/85113517-4f84-4068-a887-1c811e638917" />


### 10. Dashboard Dokter
<img width="1914" height="918" alt="image" src="https://github.com/user-attachments/assets/f1c58c3e-a8b5-4007-8279-4e935f39d211" />
<img width="1625" height="913" alt="image" src="https://github.com/user-attachments/assets/1128e95c-0047-4724-afa9-a4aa3f6d38c9" />
<img width="1624" height="907" alt="image" src="https://github.com/user-attachments/assets/0dd1b604-f639-43f2-83df-226c9baed9ed" />
<img width="1626" height="914" alt="image" src="https://github.com/user-attachments/assets/1d6e5904-2de7-44ac-82aa-fdcbca43c72a" />
<img width="1625" height="917" alt="image" src="https://github.com/user-attachments/assets/e0a26855-55cb-49b5-bd95-178f431312e5" />
<img width="1627" height="913" alt="image" src="https://github.com/user-attachments/assets/823e5fec-ac63-4cc8-a1dd-ab72a825b4c0" />
<img width="1625" height="913" alt="image" src="https://github.com/user-attachments/assets/be9a02aa-608c-47e3-81ad-1597ade8205e" />
<img width="1625" height="915" alt="image" src="https://github.com/user-attachments/assets/59fe1f0e-a62e-48c0-8ff4-116fc6a4e037" />


- Beranda & statistik pasien
- Manajemen jadwal (atur ketersediaan)
- Konsultasi & janji temu aktif
- Buat resep & surat sakit digital
- Riwayat pasien

### 11. Dashboard Admin
<img width="1626" height="913" alt="image" src="https://github.com/user-attachments/assets/27ba3d7b-8792-49a2-8e86-8cdb7282d7fa" />
<img width="1624" height="913" alt="image" src="https://github.com/user-attachments/assets/f8111508-505e-4210-a28e-6092fe098dae" />
<img width="1624" height="915" alt="image" src="https://github.com/user-attachments/assets/04b23a33-80fa-4ae4-83b0-a8582f900196" />
<img width="1627" height="914" alt="image" src="https://github.com/user-attachments/assets/3258accc-2ed9-4232-84d4-b367642257c0" />
<img width="1624" height="917" alt="image" src="https://github.com/user-attachments/assets/9ac73d7e-f9b9-4a7d-94ce-bf8f97a35211" />
<img width="1623" height="907" alt="image" src="https://github.com/user-attachments/assets/b0347663-9462-42bc-aa07-a05765738cb4" />
<img width="1624" height="912" alt="image" src="https://github.com/user-attachments/assets/72366bea-7d1b-4abf-8f16-41bdca3354b6" />
<img width="1626" height="908" alt="image" src="https://github.com/user-attachments/assets/22f3dfb3-cd64-4386-bf5f-f8db0142b015" />
<img width="1629" height="912" alt="image" src="https://github.com/user-attachments/assets/f03c1501-59ab-46b0-b8cc-e09fd489c72d" />
<img width="1624" height="918" alt="image" src="https://github.com/user-attachments/assets/ee358113-2d8d-4c43-9a7e-64eb9a98c197" />


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
