# Backend KAS MPI – Google Apps Script

## Status Keamanan

**MODE DEMO**

Autentikasi saat ini bersifat *demo*. Identitas pengguna dikirim dari frontend dan diverifikasi hanya terhadap sheet `Pengguna`. Ini **bukan** autentikasi kriptografis. Jangan gunakan untuk transaksi uang nyata sebelum mengimplementasikan:

- Google OAuth 2.0 / Identity Services, atau
- Session token yang ditandatangani, atau
- Login dengan Google Account + pemeriksaan email yang diverifikasi.

## Langkah Deployment

### 1. Buat Spreadsheet

1. Buka [Google Sheets](https://sheets.google.com).
2. Buat spreadsheet baru, beri nama misalnya `KAS MPI - Data`.
3. Catat ID spreadsheet dari URL (`https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`).

### 2. Buat Proyek Apps Script

**Opsi A – Bound script (disarankan)**

1. Di spreadsheet, klik **Ekstensi → Apps Script**.
2. Hapus kode default, tempel seluruh isi `Code.gs`.
3. Simpan proyek (Ctrl+S), beri nama `KAS MPI Backend`.

**Opsi B – Standalone**

1. Buka [script.google.com](https://script.google.com).
2. Proyek baru → tempel kode.
3. Di bagian atas `Code.gs`, isi `SPREADSHEET_ID` dengan ID spreadsheet Anda.

### 3. Inisialisasi Sheet

1. Di editor Apps Script, pilih fungsi `initializeSpreadsheet` dari dropdown.
2. Klik **Jalankan**.
3. Otorisasi akses ke Spreadsheet saat diminta.
4. Cek spreadsheet: harus muncul sheet `Transaksi`, `Pengaturan`, `Pengguna`, `Audit_Log`, dan `Ringkasan`.

### 4. Deploy sebagai Web App

1. Klik **Deploy → New deployment**.
2. Jenis: **Web app**.
3. Deskripsi: `KAS MPI v1`.
4. **Execute as**: Me (akun Anda).
5. **Who has access**:
   - Untuk pengujian cepat: **Anyone**
   - Lebih aman: **Anyone with Google account**
6. Klik **Deploy**.
7. Salin **Web app URL** (bentuk `https://script.google.com/macros/s/XXXX/exec`).

### 5. Uji Endpoint

Buka di browser:

```
https://script.google.com/macros/s/XXXX/exec?action=ping
```

Harus mengembalikan JSON:

```json
{
  "success": true,
  "message": "KAS MPI Backend OK",
  "data": { "version": "1.0.0-demo", "timezone": "Asia/Makassar", "mode": "DEMO" },
  ...
}
```

### 6. Hubungkan ke Frontend

Di file `js/api.js` frontend, ganti:

```js
const API_BASE_URL = 'https://script.google.com/macros/s/XXXX/exec';
```

## Struktur Sheet

| Sheet        | Fungsi                                      |
|--------------|---------------------------------------------|
| Transaksi    | Semua transaksi kas                         |
| Pengaturan   | Saldo awal, kategori, nama kelas            |
| Pengguna     | Daftar user + role (tanpa password)         |
| Audit_Log    | Jejak perubahan penting                     |
| Ringkasan    | Tempat formula ringkasan (opsional)         |

## Pengguna Demo (setelah inisialisasi)

| user_id     | Nama             | Role              | Kas yang diizinkan     |
|-------------|------------------|-------------------|------------------------|
| USR-ADMIN   | Admin Utama      | ADMIN             | HIMPI + USAHA_KELAS    |
| USR-BH      | Bendahara HIMPI  | BENDAHARA_HIMPI   | HIMPI                  |
| USR-BU      | Bendahara Usaha  | BENDAHARA_USAHA   | USAHA_KELAS            |
| USR-ANG     | Anggota Kelas    | ANGGOTA           | Lihat saja             |

Login di frontend menggunakan `user_id` di atas (mode demo).

## API Ringkas

### GET

| action              | Parameter utama                          |
|---------------------|------------------------------------------|
| ping                | –                                        |
| getDashboard        | user_id, month (opsional)                |
| getTransactions     | user_id, cash_type, date_from, date_to, search, page, limit |
| getTransactionById  | user_id, id                              |
| getReport           | user_id, cash_type, date_from, date_to   |
| getSettings         | user_id                                  |
| getCategories       | –                                        |
| getUsers            | user_id                                  |

### POST (JSON body)

```json
{
  "action": "createTransaction",
  "identity": { "user_id": "USR-ADMIN" },
  "payload": {
    "cash_type": "HIMPI",
    "transaction_type": "INCOME",
    "category": "Iuran Anggota",
    "amount": 50000,
    "transaction_date": "2026-10-29",
    "person_name": "Budi",
    "payment_method": "Tunai",
    "description": "Iuran Oktober",
    "idempotency_key": "unique-key-123"
  }
}
```

## Catatan Penting

- Gunakan `LockService` sudah diterapkan untuk mencegah race condition saat menulis.
- Idempotency key mencegah transaksi duplikat akibat retry.
- Semua validasi nominal, kategori, dan jenis kas dilakukan di backend.
- Jangan pernah menyimpan password di sheet.
- Setelah mengubah kode, selalu buat **New deployment** (atau Manage deployments → Edit → New version).
