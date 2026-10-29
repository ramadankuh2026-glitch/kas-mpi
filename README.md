# KAS MPI – Sistem Keuangan Kelas MPI

**KAS MPI** adalah aplikasi web untuk mencatat pemasukan dan pengeluaran kelas **Manajemen Pemasaran Internasional**, dengan pemisahan jelas antara:

- **Kas HIMPI** (organisasi / himpunan)
- **Kas Usaha Kelas** (kegiatan bisnis mahasiswa)

Frontend di-host di **GitHub Pages**. Backend & penyimpanan menggunakan **Google Apps Script + Google Sheets**.

> **Status saat ini: MODE DEMO**  
> Autentikasi bersifat demo (pilih user tanpa password).  
> Jangan gunakan untuk transaksi uang nyata sampai autentikasi Google OAuth / session token diimplementasikan dan diuji.

---

## Fitur yang Sudah Siap

| Fitur | Status |
|-------|--------|
| Login multi-peran (Admin, Bendahara HIMPI, Bendahara Usaha, Anggota) | ✅ Demo |
| Dashboard saldo gabungan, HIMPI, Usaha | ✅ |
| Pencatatan transaksi Kas HIMPI | ✅ |
| Pencatatan transaksi Kas Usaha Kelas | ✅ |
| Pemisahan dua kas (tidak tercampur) | ✅ |
| Validasi nominal, kategori, jenis kas (backend) | ✅ |
| Idempotency key (cegah duplikat) | ✅ |
| Filter & pencarian transaksi | ✅ |
| Pagination | ✅ |
| Laporan per periode + ekspor CSV | ✅ |
| Saldo awal (Admin) + audit log | ✅ |
| Mode demo lokal (localStorage) tanpa backend | ✅ |
| Desain responsif mobile & desktop | ✅ |
| Integrasi Google Sheets via Apps Script | ⚙️ Perlu konfigurasi user |
| Autentikasi Google OAuth yang aman | ❌ Belum (demo only) |
| Upload bukti transaksi | ❌ Belum |
| Modul stok / HPP detail | ❌ Struktur disiapkan |

---

## Struktur Repository

```
kas-mpi/
├── index.html              # Dashboard
├── login.html              # Halaman login
├── himpi.html              # Kas HIMPI
├── usaha.html              # Kas Usaha Kelas
├── transactions.html       # Riwayat semua transaksi
├── reports.html            # Laporan & ekspor CSV
├── settings.html           # Pengaturan
├── css/style.css
├── js/
│   ├── api.js              # Client API + demo mode
│   ├── auth.js             # Auth demo
│   ├── app.js              # Utilitas bersama
│   ├── dashboard.js
│   ├── transactions.js
│   └── reports.js
├── backend/
│   ├── Code.gs             # Backend Google Apps Script
│   └── README.md           # Panduan deploy backend
├── .gitignore
└── README.md
```

---

## Cara Cepat Mencoba (Mode Demo Lokal)

1. Clone / unduh repository ini.
2. Buka `login.html` di browser (atau serve dengan Live Server / `npx serve`).
3. Pilih salah satu user demo → Masuk.
4. Semua data disimpan di **localStorage** browser. Tidak perlu Google Sheets.

---

## Deployment Lengkap (GitHub Pages + Google Sheets)

### A. Backend Google Apps Script

Ikuti langkah detail di **[backend/README.md](backend/README.md)**:

1. Buat Google Spreadsheet baru.
2. Buka **Ekstensi → Apps Script**, tempel isi `backend/Code.gs`.
3. Jalankan fungsi `initializeSpreadsheet()` sekali (otorisasi saat diminta).
4. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone** (atau Anyone with Google account)
5. Salin **Web App URL**.

### B. Frontend

1. Buat repository GitHub baru (misalnya `kas-mpi`).
2. Upload semua file frontend (jangan masukkan file rahasia).
3. Edit `js/api.js`:

```js
const API_CONFIG = {
  BASE_URL: 'https://script.google.com/macros/s/XXXXXXXX/exec', // URL Anda
  TIMEOUT_MS: 25000
};
```

4. Aktifkan **GitHub Pages**:
   - Settings → Pages → Source: Deploy from branch → `main` / root.
5. Buka URL GitHub Pages Anda (contoh: `https://username.github.io/kas-mpi/`).

### C. Pengujian Koneksi

- Buka aplikasi → login sebagai Admin.
- Coba tambah transaksi.
- Periksa sheet **Transaksi** di Google Spreadsheet apakah baris baru muncul.
- Jika gagal, buka Console browser (F12) dan cek error CORS / network.

---

## Peran Pengguna (Demo)

| User ID    | Nama             | Hak Akses                                      |
|------------|------------------|------------------------------------------------|
| USR-ADMIN  | Admin Utama      | Semua kas + ubah saldo awal + lihat pengguna   |
| USR-BH     | Bendahara HIMPI  | Hanya mencatat & lihat Kas HIMPI               |
| USR-BU     | Bendahara Usaha  | Hanya mencatat & lihat Kas Usaha Kelas         |
| USR-ANG    | Anggota          | Hanya melihat (tidak bisa menambah transaksi)  |

---

## Checklist Pengujian

Lakukan pengujian berikut setelah backend terhubung:

- [ ] Login sebagai setiap peran berhasil
- [ ] Anggota **tidak** bisa menambah transaksi
- [ ] Bendahara HIMPI **tidak** bisa mencatat di Kas Usaha
- [ ] Bendahara Usaha **tidak** bisa mencatat di Kas HIMPI
- [ ] Simpan pemasukan HIMPI → saldo naik
- [ ] Simpan pengeluaran HIMPI → saldo turun
- [ ] Simpan modal / penjualan / biaya usaha → saldo & ringkasan benar
- [ ] Kas HIMPI dan Usaha **tidak tercampur** di dashboard & laporan
- [ ] Nominal 0 atau negatif ditolak
- [ ] Jenis kas tidak dikenal ditolak
- [ ] Submit berulang dengan idempotency key yang sama → tidak duplikat
- [ ] Filter tanggal & kategori berfungsi
- [ ] Laporan generate + ekspor CSV berhasil
- [ ] Data tetap ada setelah refresh halaman
- [ ] Tampilan rapi di HP dan laptop
- [ ] Audit log tercatat di sheet Audit_Log

---

## Keamanan – Yang Perlu Anda Ketahui

1. **Autentikasi saat ini demo.** Identitas dikirim dari browser dan dicek terhadap sheet Pengguna. Siapa pun yang tahu `user_id` bisa menyamar.
2. Untuk produksi, implementasikan:
   - Google Identity Services / OAuth 2.0, atau
   - Session token yang ditandatangani di backend.
3. Jangan simpan password di Google Sheets.
4. Jangan commit token / kredensial ke repository publik.
5. Batasi akses Spreadsheet hanya ke akun yang diperlukan.
6. Setelah mengubah kode Apps Script, selalu buat **versi deployment baru**.

---

## Backup & Pemulihan

- Google Sheets memiliki **Version history** (File → Version history).
- Unduh salinan spreadsheet secara berkala (File → Download → Excel/CSV).
- Sheet `Audit_Log` membantu menelusuri perubahan penting.

---

## Pengembangan Selanjutnya (Saran)

- Autentikasi Google OAuth
- Upload bukti transfer (Google Drive)
- Modul stok barang & HPP
- Notifikasi / laporan otomatis ke email atau WhatsApp
- Multi-kelas / multi-tahun ajaran
- Grafik interaktif (Chart.js)

---

## Lisensi & Kontribusi

Dibuat untuk keperluan internal kelas MPI. Silakan modifikasi sesuai kebutuhan.

Jika menemukan bug atau ingin menambah fitur, buat issue / pull request di repository ini.

---

**KAS MPI v1.0.0-demo** · Zona waktu Asia/Makassar · Bahasa Indonesia
