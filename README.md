# Sistem Peminjaman Smart TV Internal Perusahaan

Aplikasi web full-stack untuk mengelola ketersediaan, peminjaman, dan pengembalian Smart TV internal perusahaan secara teratur, dilengkapi dengan notifikasi, QR code scanning, checklist serah terima, denda keterlambatan, dan fitur blacklist otomatis.

## Tech Stack
- **Frontend**: React (Vite) + Tailwind CSS v3
- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma Client
- **Autentikasi**: JWT (Access Token + Refresh Token) dengan Role-Based Access

---

## Persyaratan Awal (Prerequisites)
1. **Node.js** versi >= 18.0.0
2. **PostgreSQL** versi >= 14
3. **NPM** versi >= 9

---

## Cara Setup & Instalasi Lokal

### 1. Klon / Download Workspace
Pastikan struktur folder berada dalam direktori workspace:
```
peminjaman-smarttv/
├── backend/
└── frontend/
```

### 2. Konfigurasi Backend
Pindah ke direktori `backend`, pasang dependensi, lalu edit berkas `.env` dengan kredensial PostgreSQL Anda:
```bash
cd backend
npm install
```

Salin contoh env dan sesuaikan:
```bash
cp .env.example .env
```
Contoh isi file `.env`:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/smarttv_db"
JWT_SECRET="smarttv-jwt-secret-key-change-in-production"
JWT_REFRESH_SECRET="smarttv-jwt-refresh-secret-change-in-production"
PORT=5000
FRONTEND_URL="http://localhost:5173"
UPLOAD_DIR="./uploads"
```

### 3. Migrasi Database & Seeding Data
Jalankan perintah Prisma untuk melakukan sinkronisasi skema ke database PostgreSQL Anda serta mengunggah data dummy awal:
```bash
# Lakukan migrasi database
npx prisma migrate dev --name init

# Lakukan seeding data contoh
npm run seed
```

*Data Akun Contoh Hasil Seeding:*
- **Admin Aset:** `admin@company.com` / `password123`
- **Karyawan Budi:** `budi@company.com` / `password123`
- **Karyawan Siti:** `siti@company.com` / `password123`
- **Karyawan Andi:** `andi@company.com` / `password123`
- **Karyawan Dewi:** `dewi@company.com` / `password123`

### 4. Konfigurasi Frontend
Buka terminal baru, pindah ke direktori `frontend`, lalu pasang seluruh dependensi:
```bash
cd ../frontend
npm install
```

---

## Cara Menjalankan Aplikasi secara Lokal

### 1. Jalankan Backend API Server
Di terminal direktori `backend`, jalankan:
```bash
npm run dev
```
*Backend API akan berjalan di port `http://localhost:5000`.*

### 2. Jalankan Frontend Web Dev Server
Di terminal direktori `frontend`, jalankan:
```bash
npm run dev
```
*Frontend akan berjalan di port `http://localhost:5173`.*

---

## Fitur Utama

1. **Dashboard & Laporan (Admin):** Visualisasi KPI ketersediaan TV, ekspor laporan berkala ke Excel/CSV langsung, tracking unit terpopuler.
2. **Manajemen TV:** CRUD inventaris TV secara visual beserta upload foto dan autogenerate QR code unik.
3. **Cek Konflik Jadwal:** Sistem secara otomatis mendeteksi bentrok jadwal peminjaman TV pada rentang waktu yang sama ketika karyawan memasukkan tanggal peminjaman.
4. **Serah Terima Kondisi (Digital):** Pencatatan kondisi aset TV beserta foto saat serah terima pengambilan maupun pengembalian.
5. **Auto-Blacklist:** Karyawan yang terlambat mengembalikan TV lebih dari 3 kali secara otomatis akan masuk daftar blacklist oleh cron job scheduler dan dilarang meminjam unit TV lagi sebelum statusnya dibuka kembali oleh admin.
6. **QR Scanner Cepat:** Admin dapat menyalakan kamera laptop/device untuk men-scan QR code TV agar sistem melacak data peminjaman aktif dan memproses serah terima dengan cepat.
