# Feature: Modul 6 - Bookmarks

## Deskripsi
Modul ini bertugas untuk menyediakan fitur "Simpan Postingan" (Bookmarks). Pengguna (*user*) yang sudah terautentikasi dapat menyimpan jenis konten seperti `post` dan `community_post` agar mudah dicari di kemudian waktu, serta dapat menghapusnya dari daftar simpanan.

---

## 🛠️ Tahapan Implementasi (Panduan untuk Junior Programmer / AI Assistant)

Untuk mengimplementasikan fitur ini, ikuti urutan penyelesaian berikut dengan tertib:

### 1. Struktur Folder dan File
Pastikan pengerjaan dilakukan tepat pada file-file berikut dengan mematuhi konvensi nama:
- **Router**: `src/routes/bookmarks-route.ts` (Berisi spesifikasi HTTP routing)
- **Service**: `src/services/bookmarks-service.ts` (Berisi logika bisnis inti dan pemanggilan Prisma)

### 2. Implementasi Service Layer (`bookmarks-service.ts`)
Buat fungsionalitas dengan pengkondisian asinkron (`async/await`):
- **`createBookmark`**: Pastikan ada validasi pencegahan rentetan duplikat konten yang disave oleh *user* yang sama. Prisma akan menolak secara otomatis menggunakan *constraint* *unique* yang ada pada database, pastikan interupsi ini (`P2002`) dapat disambungkan menuju router.
- **`deleteBookmark`**: Tarik dokumen id-nya, tangani responnya jika datanya tidak/sudah tidak ada (batal). Sangat mendasar: Pastikan hanya profil otentik yang cocok **(user id pemanggil == user_id pemilik bookmark)** yang memiliki wewenang untuk menafikan atau menghapusnya.
- **`getBookmarks`**: Sediakan fitur navigasi paginasi reguler Prisma (`skip` dan `take`). Karena struktur datanya *Polymorphic* (Tipe datanya berubah-ubah tergandung `content_type`), Anda sebaiknya melakukan pemisahan *query* saat `content_type=post` untuk mengambil rincian konten `Post` dan meletakannya kembali ke `data` *Bookmarks*.

### 3. Implementasi Routing Layer (`bookmarks-route.ts`)
Setiap jembatan *endpoint* dari rute wajib dilindungi dan ditengah-tengahi (*middleware*) oleh `authMiddleware`.
Tangkap segala macam kode `Error`:
- Prisma `P2002` (Duplicate) => HTTP Status `409 Conflict`.
- Validasi id absen, hak hapus absen => HTTP Status `403 Forbidden` / `404 Not Found`.
- Output dari pencarian `GET` => wajib dilewatkan lewat pemetaan helper `getPaginationMetadata(total, page, limit)`.

### 4. Tahap Akhir Integrasi Aplikasi
Di rute gerbang aplikasi (`src/index.ts`):
- _Import_ referensial untuk `bookmarksRouter`.
- Ikat (Register) dengan imbuhan _prefix_ `/api`: `app.use('/api', bookmarksRouter);` 

---

## 📡 Spesifikasi Endpoint Penuh

### 1. POST /bookmarks
Digunakan untuk memasukkan data konten ke daftar simpanan user.
**Header  :** `Authorization: Bearer <token>` ✅  
**Request :**
```json
{
  "content_type": "post",
  "content_id": "uuid-post"
}
```
**Response 201 (Created) :**
```json
{
  "success": true,
  "message": "Bookmark berhasil ditambahkan",
  "data": { "id": "uuid", "content_type": "post", "content_id": "uuid-post" }
}
```
**Errors :**
```json
// 409 Conflict
{ "success": false, "error": { "code": "DUPLICATE_ENTRY", "message": "Konten ini sudah ada di bookmark kamu" } }
```

---

### 2. DELETE /bookmarks/:bookmarkId
Menghapus simpanan dari database berdasarkan ID bookmark spesifik.
**Header  :** `Authorization: Bearer <token>` ✅  
**Response 200 (OK) :**
```json
{
  "success": true,
  "message": "Bookmark berhasil dihapus"
}
```

---

### 3. GET /bookmarks
Memanggil daftar memori simpanan _user_.
**Header  :** `Authorization: Bearer <token>` ✅  
**Query   :** `?page=1&limit=20&type=post` (type diisi post atau community_post)  
**Response 200 (OK) :**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "content_type": "post",
      "content_id": "uuid-post",
      "created_at": "2024-01-01T00:00:00.000Z",
      "content": {
        "id": "uuid-post",
        "content": "Isi post yang dibookmark",
        "author": {
          "username": "sari_dev",
          "profile": { "display_name": "Sari Dewi", "avatar_url": "https://..." }
        }
      }
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 8, "total_pages": 1, "has_next": false, "has_prev": false }
}
```
