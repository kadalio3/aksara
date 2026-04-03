# Ikhtisar Fitur: API Follows Pengguna

## Deskripsi
Tugas ini membahas implementasi fitur "Follow/Unfollow" pengguna beserta pengecekan status relasi tersebut. Kita akan membuat tiga endpoint utama untuk memfasilitasi kebutuhan ini. Pengerjaan akan dipisah menjadi 2 bagian: **Logic Layer** (`src/services/`) dan **Routing Layer** (`src/routes/`).

---

## Spesifikasi Endpoint

### POST /follows/:userId
**Header  :** Authorization: Bearer \<token\> ✅  
**Request :** Tidak ada  
**Response 201 :**
```json
{
  "success": true,
  "message": "Berhasil mengikuti user"
}
```
**Errors :**
```json
// 409 — sudah follow
{ "success": false, "error": { "code": "ALREADY_FOLLOWING", "message": "Kamu sudah mengikuti user ini" } }

// 400 — follow diri sendiri
{ "success": false, "error": { "code": "SELF_FOLLOW", "message": "Tidak bisa mengikuti diri sendiri" } }

// 404
{ "success": false, "error": { "code": "NOT_FOUND", "message": "User tidak ditemukan" } }
```

---

### DELETE /follows/:userId
**Header  :** Authorization: Bearer \<token\> ✅  
**Response 200 :**
```json
{
  "success": true,
  "message": "Berhasil berhenti mengikuti user"
}
```
**Errors :**
```json
// 409 — belum follow
{ "success": false, "error": { "code": "NOT_FOLLOWING", "message": "Kamu tidak mengikuti user ini" } }
```

---

### GET /follows/:userId/status
**Header  :** Authorization: Bearer \<token\> ✅  
**Response 200 :**
```json
{
  "success": true,
  "data": {
    "is_following": true,
    "is_followed_by": false
  }
}
```

---

## Struktur Folder & File

Pastikan struktur file terbagi seperti ini:
- **Routes Layer**: Logika HTTP request/response (`src/routes/user-route.ts`)
- **Service Layer**: Logika aksi database dengan Prisma (`src/services/user-service.ts`)

Pengerjaan routing digabung dengan entitas target `user-route.ts` dan fungsi servisnya diletakkan di `user-service.ts`.

---

## Panduan Implementasi (Tahapan Pengerjaan)

Silakan ikuti instruksi langkah-demi-langkah (step-by-step) berikut dengan saksama:

### Tahap 1: Membuat Logika Bisnis di `src/services/user-service.ts`

Buat 3 fungsi *async* baru yang dipanggil dari Prisma:

1.  **`followUser(followerId: string, followingId: string)`**:
    - **Cek Target**: Cek apakah target pengguna itu ada (`prisma.user.findUnique({ where: { id: followingId } })`). Lempar _Error_ "User tidak ditemukan" jika tidak ada.
    - **Validasi Self-Follow**: Cek jika argumen `followerId === followingId`. Lempar _Error_ "Tidak bisa mengikuti diri sendiri" jika benar.
    - **Cek Status Follow**: Periksa pada tabel `Follow` (`prisma.follow.findUnique` menggunakan `@@unique([follower_id, following_id])`). Lempar _Error_ "Kamu sudah mengikuti user ini" jika eksis.
    - **Eksekusi Atomik (Transaction)**: Wajib jalankan operasi serentak di array `prisma.$transaction([])` dengan 3 sintaks operasi:
      1. Tambahkan relasi di tabel `Follow` (`prisma.follow.create({ data: { follower_id, following_id } })`).
      2. Inkremen (tambah 1) jumlah _follower_count_ di target pengguna.
      3. Inkremen _following_count_ di pengguna yang me-request.

2.  **`unfollowUser(followerId: string, followingId: string)`**:
    - **Cek Relasi**: Periksa apakah ada record Follow persis antara keuda Id. Lempar _Error_ "Kamu tidak mengikuti user ini" jika record tidak ada.
    - **Eksekusi Atomik (Transaction)**: Wajib di array `prisma.$transaction([])` dengan 3 operasi:
      1. Hapus nilai `Follow` tersebut berasaskan ID yang ditemukan.
      2. Dekremen (kurang 1) poin _follower_count_ di target pengguna.
      3. Dekremen poin _following_count_ di pengguna yang melakukan _request_.

3.  **`getFollowStatus(meId: string, targetId: string)`**:
    - Pakai fitur `prisma.follow.findMany` (atau dua baris instruksi pengecek eksistensi boolean biasa) untuk menelusuri 1.) apakah `meId` mem-follow target `targetId` dan kembalikan di variabel `is_following` lalu 2.) apakah `targetId` mem-follow `meId` diletakkan di variabel `is_followed_by`.
    - Return di format object `is_following` dan `is_followed_by`.

### Tahap 2: Menambahkan Rute Endpoint di `src/routes/user-route.ts`

Masukkan rute *Post, Delete, dan Status* di dalam block router yang menggunakan perlindungan middleware. Tambahkan import untuk fungsi di atas.

1.  **`router.post('/follows/:userId', authMiddleware, async ...)`**
    - Ambil properti id penerima param url dari variabel  `req.params.userId`.
    - Ambil id requester aman dari `res.locals.userId` (dijamin tokennya valid karena filter oleh `authMiddleware`).
    - Jalankan metode layanan `await followUser(...)`.
    - Lakukan seleksi _Catch Error_. Saring pesan error string seperti "*Kamu sudah mengikuti user ini*" menjadi *Response 409* khusus dan `Tidak bisa mengikuti diri sendiri` di *Response 400*.

2.  **`router.delete('/follows/:userId', authMiddleware, async ...)`**
    - Ambil variabel parameter yang sama seperti post di atas.
    - Jalankan layanan fungsional `await unfollowUser(..)` di dalam try/catch *block*.
    - Hadang _error message_ "Kamu tidak mengikuti user ini" untuk lempar format *Status* 409 (sesuaikan dengan ekspektasi error json)

3.  **`router.get('/follows/:userId/status', authMiddleware, async ...)`**
    - Siapkan try-catch dan jalankan `await getFollowStatus(...)`.
    - Lempar return nya di wadah `{ success: true, data: { ... } }` menggunakan response 200.

### Kriteria Penyelesaian:
- [ ] 3 Endpoint telah teregister bersama proteksi _authMiddleware_.
- [ ] Update field *follower_count* & *following_count* sudah memanfaatkan `prisma.$transaction()`.
- [ ] Format JSON *Sukses/Error* mematuhi arahan respon pada tabel atas.
- [ ] Tida ada relasi ganda (Pencegahan Unik *Follow*).
