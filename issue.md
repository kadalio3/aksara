# Feature: Modul 8 - Notifications

## Deskripsi
Modul ini bertugas menyediakan kapabilitas sistem pemberitahuan aktivitas (*Notifications*) kepada pengguna. Endpoint ini mencakup pengambilan seluruh notifikasi dengan dukungan filter, penarikan jumlah notifikasi yang belum dibaca, mekanisme "tandai sudah dibaca" secara massal maupun individual, dan penghapusan notifikasi secara mandiri.

---

## 🛠️ Tahapan Implementasi (SOP untuk Junior Programmer / AI)

Buku panduan dalam mengeksekusi fitur ini secara berurutan:

### 1. Struktur Folder dan File
Gunakan dua file utama yang memisahkan antara layer penyajian API (Routes) dan layer pengolahan data (Services):
- **Router Layer**: `src/routes/notifications-route.ts` 
- **Service Layer**: `src/services/notifications-service.ts`

### 2. Implementasi Service Layer (`notifications-service.ts`)
Setiap fungsi di bawah ini akan memanggil `PrismaClient` yang berinteraksi dengan model `Notification`.

- **`getNotifications(userId, page, limit, isRead)`**:
  - Dapatkan daftar notifikasi menggunakan `prisma.notification.findMany`.
  - Pasang kueri opsional di dalam klausa `where`: Jika parameter `isRead` didefinisikan (e.g. string "false" atau "true"), ubah filter kondisi `is_read` mengikuti permintaannya.
  - Jangan lupa menautkan data profil lengkap sang aktor dengan `include: { actor: { select: { id, username, profile: { select: { display_name, avatar_url } } } } }`.
  - Urutkan menurun berdasar `created_at: 'desc'`. 
  - Gunakan `Promise.all` bersamaan dengan `prisma.notification.count` demi efisiensi penarikan metadata paginasi.
- **`getUnreadCount(userId)`**:
  - Panggil `prisma.notification.count` sembari menyertakan `where: { recipient_id: userId, is_read: false }`.
- **`markAllAsRead(userId)`**:
  - Panggil `prisma.notification.updateMany`.
  - Syaratnya: `recipient_id = userId` dan `is_read = false`.
  - Perbarui isian `data: { is_read: true }`. Kembalikan total baris yang diubah `count`.
- **`markAsRead(userId, notificationId)`**:
  - Verifikasi eksistensi kueri `findUnique`.
  - Validasi kepemilikan: bila `recipient_id !== userId`, lemparkan error hak cipta.
  - Panggil `prisma.notification.update` ke `is_read: true`.
- **`deleteNotification(userId, notificationId)`**:
  - Persis dengan tahap verifikasi `markAsRead` sebelumnya.
  - Bila lolos *guard*, lakukan `prisma.notification.delete`.

### 3. Implementasi Routing Layer (`notifications-route.ts`)
- Sematkan `authMiddleware` pada **semua** baris rute karena fitur notifikasi menuntut kerahasiaan identitas pemanggil.
- Rute yang harus dibangun:
  - `GET /notifications` (Daftar & Paginasi) -> Tangkap param query string `page`, `limit`, dan `is_read`.
  - `GET /notifications/unread/count` (Perhitungan unread) -> **Perhatian Kritis**: Letakkan urutan rute spesifik ini *di atas* rute yang mengandung param dinamis `:id`, jika tidak, URL `/unread/count` akan tersangkut dan dibaca sebagai `:id = unread`.
  - `PATCH /notifications/read/all` (Tandai selesai masif) -> Aturan penempatan serupa berlaku diutamakan.
  - `PATCH /notifications/:id/read` (Tandai per item)
  - `DELETE /notifications/:id` (Hapus notifikasi)

### 4. Tahap Akhir Integrasi Aplikasi
Regisrasikan obyek `notificationsRouter` di berkas sentral `src/index.ts` dan tancapkan di belakang *prefix* dasar aplikasi `/api`.

---

## 📡 Spesifikasi Endpoint Penuh

### 1. GET /notifications
**Header  :** `Authorization: Bearer <token>` ✅  
**Query   :** `?page=1&limit=20&is_read=false`  
**Response 200 :**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "reaction",
      "reaction_type": "love",
      "content_type": "post",
      "content_id": "uuid-post",
      "is_read": false,
      "created_at": "2024-01-01T09:00:00.000Z",
      "actor": {
        "id": "uuid",
        "username": "sari_dev",
        "profile": { "display_name": "Sari Dewi", "avatar_url": "https://..." }
      }
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 15, "total_pages": 1, "has_next": false, "has_prev": false }
}
```

---

### 2. GET /notifications/unread/count
**Header  :** `Authorization: Bearer <token>` ✅  
**Response 200 :**
```json
{
  "success": true,
  "data": { "count": 7 }
}
```

---

### 3. PATCH /notifications/read/all
**Header  :** `Authorization: Bearer <token>` ✅  
**Response 200 :**
```json
{
  "success": true,
  "message": "Semua notifikasi ditandai sudah dibaca",
  "data": { "updated_count": 7 }
}
```

---

### 4. PATCH /notifications/:id/read
**Header  :** `Authorization: Bearer <token>` ✅  
**Response 200 :**
```json
{
  "success": true,
  "message": "Notifikasi ditandai sudah dibaca"
}
```

---

### 5. DELETE /notifications/:id
**Header  :** `Authorization: Bearer <token>` ✅  
**Response 200 :**
```json
{
  "success": true,
  "message": "Notifikasi berhasil dihapus"
}
```
