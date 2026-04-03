# Feature: Modul 7 - Messages (DM)

## Deskripsi
Modul ini bertugas menyediakan kapabilitas olah pesan instan (*Direct Message*) antarpengguna. Endpoint ini mencakup fitur menampilkan daftar kontak chat (inbox), mengambil riwayat percakapan dengan pengguna tertentu, mengirim pesan baru, memperbarui status baca (read receipt), dan membatalkan pesanan.

---

## 🛠️ Tahapan Implementasi (SOP untuk Junior Programmer / AI)

Buku panduan dalam mengeksekusi fitur ini secara berurutan:

### 1. Struktur Folder dan File
Gunakan dua file utama yang memisahkan antara layer penyajian dan layer logika pengolahan:
- **Router Layer**: `src/routes/messages-route.ts` 
- **Service Layer**: `src/services/messages-service.ts`

### 2. Implementasi Service Layer (`messages-service.ts`)
Setiap fungsi di sini **wajib** menggunakan blok asinkron dan menembak _Model Prisma_ `Message`.

- **`getInbox(userId)`**:
  - *Tantangan Terbesar*: Membuat list kotak masuk seperti aplikasi *chat*. Anda harus menarik daftar pengguna unik yang pernah berinteraksi dengan pemanggil (bisa sebagai *sender* atau *receiver*).
  - Trik Prisma: Tarik semua pesan dimana pemanggil berdapan (OR: `sender_id=X`, `receiver_id=X`), kemudian kelompokkan berdasarkan *lawan bicara*. Ambil objek obrolan terakhir (*last_message*) dan kueri terpisah untuk mencari *unread_count* (pesan yang `receiver_id = userId` dan `is_read = false`).
- **`getChatHistory(userId, targetUserId, page, limit)`**:
  - Lakukan kueri paginasi standar menggunakan `where: OR [{sender: X, receiver:Y}, {sender: Y, receiver:X}]`.
  - Sortir pesan dari yang paling baru (`created_at: 'desc'`).
  - Tambahkan label `is_mine` secara dinamis di level kode (jika `sender_id === userId`).
- **`sendMessage(userId, targetUserId, content, mediaUrl)`**:
  - Cek keberadaan `targetUserId` di database User.
  - Lakukan `prisma.message.create`.
- **`markAsRead(userId, targetUserId)`**:
  - Jalankan `prisma.message.updateMany`.
  - Syaratnya: `receiver_id = userId`, `sender_id = targetUserId`, dan `is_read = false`.
- **`deleteMessage(userId, messageId)`**:
  - Tarik pesan secara spesifik berdasar ID.
  - Verifikasi keamanan: `if (message.sender_id !== userId)`, lemparkan error hak akses.
  - Hapus jika terverifikasi.

### 3. Implementasi Routing Layer (`messages-route.ts`)
- Sematkan `authMiddleware` di muka seluruh jalur endpoint untuk melindungi tatanan privasi sistem.
- Rute yang harus dibangun:
  - `GET /messages` (Inbox)
  - `GET /messages/:userId` (Chat History) -> Ingat untuk membungkus balasan menggunakan rutin `getPaginationMetadata`.
  - `POST /messages/:userId` (Send Message)
  - `PATCH /messages/:userId/read` (Mark Read)
  - `DELETE /messages/:messageId` (Delete Message) -> Tangkap error pengecekan kepemilikan dan ubah menjadi `403 Forbidden`.

### 4. Tahap Akhir Integrasi Aplikasi
Panggil (*import*) `messagesRouter` di file sentral `src/index.ts` dan tancapkan menuju URL dasar dengan *prefix* `/api`.

---

## 📡 Spesifikasi Endpoint Penuh

### 1. GET /messages
**Header  :** `Authorization: Bearer <token>` ✅  
**Response 200 :**
```json
{
  "success": true,
  "data": [
    {
      "user": {
        "id": "uuid",
        "username": "sari_dev",
        "profile": { "display_name": "Sari Dewi", "avatar_url": "https://..." }
      },
      "last_message": {
        "content": "Boleh, tanya aja!",
        "created_at": "2024-01-01T10:00:00.000Z",
        "is_read": false
      },
      "unread_count": 2
    }
  ]
}
```

---

### 2. GET /messages/:userId
**Header  :** `Authorization: Bearer <token>` ✅  
**Query   :** `?page=1&limit=30`  
**Response 200 :**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "content": "Hei, boleh tanya soal coding?",
      "media_url": null,
      "is_read": true,
      "is_mine": true,
      "created_at": "2024-01-01T09:00:00.000Z"
    },
    {
      "id": "uuid",
      "content": "Boleh, tanya aja!",
      "media_url": null,
      "is_read": false,
      "is_mine": false,
      "created_at": "2024-01-01T10:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 30, "total": 25, "total_pages": 1, "has_next": false, "has_prev": false }
}
```

---

### 3. POST /messages/:userId
**Header  :** `Authorization: Bearer <token>` ✅  
**Request :**
```json
{
  "content": "Hei, boleh tanya soal coding?",
  "media_url": null
}
```
**Response 201 :**
```json
{
  "success": true,
  "message": "Pesan berhasil dikirim",
  "data": {
    "id": "uuid",
    "content": "Hei, boleh tanya soal coding?",
    "is_read": false,
    "created_at": "2024-01-01T09:00:00.000Z"
  }
}
```

---

### 4. PATCH /messages/:userId/read
**Header  :** `Authorization: Bearer <token>` ✅  
**Response 200 :**
```json
{
  "success": true,
  "message": "Semua pesan ditandai sudah dibaca",
  "data": { "updated_count": 3 }
}
```

---

### 5. DELETE /messages/:messageId
**Header  :** `Authorization: Bearer <token>` ✅  
**Response 200 :**
```json
{
  "success": true,
  "message": "Pesan berhasil dihapus"
}
```
**Errors :**
```json
// 403 — bukan pengirim pesan
{ "success": false, "error": { "code": "FORBIDDEN", "message": "Kamu hanya bisa menghapus pesan yang kamu kirim" } }
```
