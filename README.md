# UANG DIGITAL RAKYAT — API Fitur Keuangan Digital

REST API Node.js + Express untuk aplikasi keuangan digital (fintech) dengan fitur:

- 💳 **Pembayaran & Transaksi**: QRIS, Transfer real-time (simulasi BI-FAST), Virtual Account
- 📊 **Manajemen Anggaran**: kategorisasi otomatis, mutasi rekening, laporan finansial bulanan
- 💡 **Pembiayaan & Investasi**: PayLater, P2P Lending, Investasi Mikro (reksa dana/saham/emas)
- 🛡️ **Keamanan Akun**: Two-Factor Authentication (TOTP), Biometrik, Blokir Mandiri

> **Catatan jujur**: QRIS/BI-FAST/VA di sini adalah **simulasi internal yang berfungsi penuh** (saldo, riwayat transaksi, QR code asli yang bisa di-scan, dsb). Untuk terhubung ke jaringan BI-FAST/QRIS **resmi**, Anda tetap wajib bekerja sama dengan PJSP/bank berlisensi BI — ini di luar cakupan kode aplikasi manapun. Struktur API ini sudah dirancang agar mudah "dicolokkan" ke penyedia resmi tersebut nanti (cukup ganti isi controller `qris`, `va`, dan `transaction`).

---

## 🚀 Cara Menjalankan di Server

### 1. Persyaratan
- Node.js versi 18 ke atas
- npm (sudah termasuk dalam Node.js)
- Tidak perlu install database terpisah (memakai penyimpanan file JSON bawaan yang otomatis dibuat)

### 2. Instalasi
```bash
# Upload/clone folder ini ke server, lalu masuk ke foldernya
cd uang-digital-rakyat

# Install dependency
npm install

# Salin file environment lalu edit
cp .env.example .env
nano .env   # WAJIB ganti JWT_SECRET dengan string acak yang panjang & rahasia
```

### 3. Menjalankan
```bash
# Mode produksi
npm start

# Mode development (auto-restart saat file berubah)
npm run dev
```

Server akan berjalan di `http://localhost:3000` (atau sesuai `PORT` di `.env`).
Cek status: `GET /api/health`

### 4. Menjalankan permanen di server (disarankan: PM2)
```bash
npm install -g pm2
pm2 start server.js --name uang-digital-rakyat
pm2 save
pm2 startup     # agar otomatis jalan lagi saat server reboot
```

### 5. (Opsional) Reverse proxy dengan Nginx + HTTPS
Arahkan domain Anda ke aplikasi Node.js ini melalui Nginx, lalu pasang SSL (mis. dengan Certbot/Let's Encrypt), supaya seluruh trafik terenkripsi — **wajib** untuk aplikasi keuangan yang diakses publik.

---

## 📁 Struktur Proyek
```
uang-digital-rakyat/
├── server.js                  # Entry point
├── .env.example                # Contoh konfigurasi environment
├── src/
│   ├── app.js                  # Setup Express, middleware, routing
│   ├── config/db.js             # Lapisan penyimpanan data (JSON file store)
│   ├── middleware/              # Autentikasi JWT & error handler
│   ├── controllers/             # Logika bisnis tiap fitur
│   ├── routes/                  # Definisi endpoint tiap fitur
│   ├── utils/                   # Helper (kategorisasi, validasi, response)
│   └── data/                    # Data tersimpan otomatis di sini (JSON, dibuat runtime)
```

Data disimpan sebagai file JSON di `src/data/`. Untuk skala produksi besar, ganti `src/config/db.js` dengan koneksi PostgreSQL/MySQL/MongoDB — seluruh controller sudah dipisah rapi sehingga penggantian ini tidak mengubah logic bisnis lainnya.

---

## 🔑 Autentikasi

Sebagian besar endpoint memerlukan header:
```
Authorization: Bearer <token>
```

Alur login:
1. `POST /api/auth/register` → daftar akun (otomatis dapat wallet + fasilitas PayLater default)
2. `POST /api/auth/login` → jika 2FA belum aktif, langsung dapat `token`. Jika 2FA aktif, dapat `tempToken` dan diminta kode OTP.
3. `POST /api/auth/2fa/login-verify` (pakai `tempToken`) → kirim kode OTP dari Google Authenticator → dapat `token` penuh.

---

## 📚 Daftar Lengkap Endpoint

### Autentikasi & Keamanan Login (`/api/auth`)
| Method | Endpoint | Auth | Keterangan |
|---|---|---|---|
| POST | `/register` | - | Daftar akun baru |
| POST | `/login` | - | Login (step 1) |
| POST | `/2fa/login-verify` | Temp Token | Login (step 2, verifikasi OTP) |
| POST | `/biometric/login` | - | Login via biometrik (sidik jari/wajah) |
| GET | `/me` | ✅ | Profil pengguna saat ini |
| POST | `/2fa/setup` | ✅ | Mulai setup 2FA, dapat QR code |
| POST | `/2fa/verify` | ✅ | Aktifkan 2FA setelah scan QR |
| POST | `/2fa/disable` | ✅ | Nonaktifkan 2FA |
| POST | `/biometric/register` | ✅ | Daftarkan biometrik perangkat |

### Wallet (`/api/wallet`)
| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/` | Lihat saldo & info wallet |
| POST | `/topup` | Top up saldo (simulasi) |

### Transaksi (`/api/transactions`)
| Method | Endpoint | Keterangan |
|---|---|---|
| POST | `/transfer` | Transfer antarpengguna real-time (simulasi BI-FAST) |
| GET | `/` | Mutasi rekening (bisa difilter `type`, `category`, `startDate`, `endDate`) |
| GET | `/report` | Laporan finansial bulanan + data grafik per kategori |

### QRIS (`/api/qris`)
| Method | Endpoint | Keterangan |
|---|---|---|
| POST | `/generate` | Buat kode QRIS (statis/dinamis) + gambar QR |
| POST | `/pay` | Bayar menggunakan kode QRIS |
| GET | `/:code` | Detail status QRIS |

### Virtual Account (`/api/va`)
| Method | Endpoint | Keterangan |
|---|---|---|
| POST | `/` | Buat nomor Virtual Account baru |
| GET | `/` | Daftar VA milik pengguna |
| POST | `/:vaNumber/pay` | Simulasi pembayaran masuk ke VA |

### Anggaran (`/api/budget`)
| Method | Endpoint | Keterangan |
|---|---|---|
| POST | `/` | Tetapkan/ubah limit anggaran per kategori per bulan |
| GET | `/` | Lihat anggaran bulan berjalan |
| GET | `/status` | Realisasi vs limit anggaran |

### PayLater (`/api/paylater`)
| Method | Endpoint | Keterangan |
|---|---|---|
| POST | `/apply` | Aktifkan fasilitas PayLater |
| GET | `/` | Info akun & riwayat PayLater |
| POST | `/transaction` | Belanja pakai PayLater |
| POST | `/pay-bill` | Bayar tagihan PayLater |

### P2P Lending (`/api/lending`)
| Method | Endpoint | Keterangan |
|---|---|---|
| POST | `/offer` | Tawarkan dana sebagai pemberi pinjaman |
| POST | `/request` | Ajukan permintaan pinjaman |
| GET | `/` | Marketplace P2P (filter `status`) |
| POST | `/:id/fund` | Danai sebuah permintaan pinjaman (`request`) |
| POST | `/:id/accept` | Terima sebuah penawaran dana (`offer`) sebagai peminjam |
| POST | `/:id/repay` | Bayar cicilan/pelunasan pinjaman |

### Investasi Mikro (`/api/investment`)
| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/products` | Daftar produk (reksa dana, saham, emas) |
| POST | `/buy` | Beli instrumen investasi |
| POST | `/sell` | Jual instrumen investasi |
| GET | `/portfolio` | Portofolio & untung/rugi |

### Keamanan Akun (`/api/security`)
| Method | Endpoint | Keterangan |
|---|---|---|
| POST | `/block` | Blokir mandiri akun (perlu PIN) |
| POST | `/unblock` | Buka blokir (perlu password + PIN) |
| POST | `/change-pin` | Ganti PIN transaksi |
| GET | `/logs` | Riwayat aktivitas keamanan |

---

## 🧪 Contoh Penggunaan (curl)

```bash
# 1. Registrasi
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Budi Santoso","email":"budi@example.com","password":"passwordkuat123","pin":"123456"}'

# 2. Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"budi@example.com","password":"passwordkuat123"}'
# -> simpan "token" dari response

# 3. Top up saldo
curl -X POST http://localhost:3000/api/wallet/topup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"amount":500000,"source":"Transfer Bank"}'

# 4. Buat QRIS
curl -X POST http://localhost:3000/api/qris/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"amount":25000,"merchantName":"Warung Kopi Rakyat"}'

# 5. Cek laporan bulanan
curl http://localhost:3000/api/transactions/report \
  -H "Authorization: Bearer <token>"
```

---

## 🔒 Rekomendasi Keamanan Produksi
1. Ganti `JWT_SECRET` dengan nilai acak panjang (mis. `openssl rand -hex 64`).
2. Jalankan selalu di belakang **HTTPS**.
3. Gunakan database sungguhan (PostgreSQL/MySQL) untuk beban tinggi, bukan file JSON.
4. Aktifkan backup rutin folder `src/data/` (atau database pengganti).
5. Pertimbangkan menambahkan audit log & monitoring (mis. Sentry, ELK).
6. Untuk QRIS/BI-FAST/VA sungguhan, integrasikan dengan PJSP berlisensi resmi BI, bukan hanya kode di repo ini.
7. Terapkan kebijakan kata sandi kuat & pertimbangkan lockout setelah beberapa kali PIN salah.
