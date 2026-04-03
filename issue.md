# Issue: Modul User Lengkap (Profile, Search, Follows, Posts & Settings)

## Deskripsi

Meluaskan fungsionalitas modul _Users_ untuk mencakup pengambilan detail publik melalui parameter `username`, pencarian dinamis user, update profile, pengelolaan follower/following, postingan, serta penghapusan akun. Fitur ini dirancang sangat komprehensif, terstruktur, dan terbagi secara rapi untuk dieksekusi.

---

## 1. Pembaruan Schema Database

Schema saat ini kemungkinan besar belum mengekspos tabel relasi yang memadai untuk memenuhi API Post, Search, Follows dsb. Oleh karena itu, *Langkah Pertama* dalam pengerjaan ini adalah mengubah isi dari file `prisma/schema.prisma` menjadi skema terpusat berikut:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────────
// ENUM DEFINITIONS
// ─────────────────────────────────────────────

enum Gender {
  male
  female
  other
  prefer_not_to_say
}

enum CommunityVisibility {
  public
  private
}

enum CommunityRole {
  member
  moderator
  admin
}

enum PostType {
  text
  image
  video
  repost
}

enum CommunityPostType {
  text
  image
  video
}

enum PostReactionType {
  love
}

enum CommunityReactionType {
  upvote
  downvote
}

enum NotificationType {
  reaction
  reply
  follow
  mention
  repost
  community_invite
  community_join
}

enum NotificationReactionType {
  love
  upvote
}

enum NotificationContentType {
  post
  post_reply
  community_post
  community_post_reply
}

enum PostReactionContentType {
  post
  post_reply
}

enum CommunityReactionContentType {
  community_post
  community_post_reply
}

enum BookmarkContentType {
  post
  community_post
}

enum DeviceType {
  mobile
  tablet
  desktop
  unknown
}

enum ActivityAction {
  // Auth
  login
  logout
  register
  password_change
  password_reset
  // Konten
  post_create
  post_edit
  post_delete
  community_post_create
  community_post_edit
  community_post_delete
  reply_create
  reply_delete
  // Sosial
  follow
  unfollow
  react
  unreact
  bookmark
  unbookmark
  // Komunitas
  community_create
  community_join
  community_leave
  member_promote
  member_kick
  // Keamanan
  login_failed
  suspicious_login
  device_trusted
  session_revoked
}

// ─────────────────────────────────────────────
// TABEL INTI
// ─────────────────────────────────────────────

model User {
  id              String    @id @default(uuid())
  username        String    @unique @db.VarChar(50)
  email           String    @unique @db.VarChar(255)
  password_hash   String    @db.VarChar(255)
  is_verified     Boolean   @default(false)
  is_private      Boolean   @default(false)
  is_active       Boolean   @default(true)
  follower_count  Int       @default(0)
  following_count Int       @default(0)
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt

  // Relasi inti
  profile               UserProfile?
  owned_communities     Community[]         @relation("CommunityOwner")
  community_memberships CommunityMember[]

  // Relasi konten
  posts                    Post[]
  post_replies             PostReply[]
  community_posts          CommunityPost[]
  community_post_replies   CommunityPostReply[]

  // Relasi sosial
  post_reactions           PostReaction[]
  community_reactions      CommunityReaction[]
  bookmarks                Bookmark[]
  sent_messages            Message[]           @relation("MessageSender")
  received_messages        Message[]           @relation("MessageReceiver")
  notifications_received   Notification[]      @relation("NotificationRecipient")
  notifications_acted      Notification[]      @relation("NotificationActor")

  // Relasi follow
  followers   Follow[]  @relation("Following")
  following   Follow[]  @relation("Follower")

  // Relasi keamanan
  sessions       Session[]
  devices        Device[]
  locations      Location[]
  activity_logs  ActivityLog[]

  @@map("users")
}

model UserProfile {
  id           String    @id @default(uuid())
  user_id      String    @unique
  display_name String?   @db.VarChar(100)
  bio          String?   @db.Text
  avatar_url   String?   @db.VarChar(500)
  banner_url   String?   @db.VarChar(500)
  website      String?   @db.VarChar(255)
  location     String?   @db.VarChar(100)
  birth_date   DateTime? @db.Date
  gender       Gender?
  created_at   DateTime  @default(now())
  updated_at   DateTime  @updatedAt

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@map("user_profiles")
}

model Community {
  id           String              @id @default(uuid())
  owner_id     String
  name         String              @db.VarChar(100)
  slug         String              @unique @db.VarChar(100)
  description  String?             @db.Text
  avatar_url   String?             @db.VarChar(500)
  banner_url   String?             @db.VarChar(500)
  visibility   CommunityVisibility @default(public)
  member_count Int                 @default(0)
  post_count   Int                 @default(0)
  created_at   DateTime            @default(now())
  updated_at   DateTime            @updatedAt

  owner   User              @relation("CommunityOwner", fields: [owner_id], references: [id])
  members CommunityMember[]
  posts   CommunityPost[]

  @@index([owner_id])
  @@map("communities")
}

model CommunityMember {
  id           String        @id @default(uuid())
  user_id      String
  community_id String
  role         CommunityRole @default(member)
  joined_at    DateTime      @default(now())

  user      User      @relation(fields: [user_id], references: [id], onDelete: Cascade)
  community Community @relation(fields: [community_id], references: [id], onDelete: Cascade)

  @@unique([user_id, community_id])
  @@index([community_id])
  @@map("community_members")
}

// ─────────────────────────────────────────────
// KONTEN TIMELINE PRIBADI
// ─────────────────────────────────────────────

model Post {
  id            String   @id @default(uuid())
  user_id       String
  content       String   @db.Text
  type          PostType @default(text)
  media_urls    Json?
  love_count    Int      @default(0)
  reply_count   Int      @default(0)
  repost_count  Int      @default(0)
  is_deleted    Boolean  @default(false)
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt

  author  User        @relation(fields: [user_id], references: [id])
  replies PostReply[]

  @@index([user_id])
  @@index([created_at])
  @@map("posts")
}

model PostReply {
  id              String   @id @default(uuid())
  post_id         String
  user_id         String
  parent_reply_id String?
  content         String   @db.Text
  media_urls      Json?
  love_count      Int      @default(0)
  is_deleted      Boolean  @default(false)
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  post         Post       @relation(fields: [post_id], references: [id], onDelete: Cascade)
  author       User       @relation(fields: [user_id], references: [id])
  parent_reply PostReply? @relation("ReplyNested", fields: [parent_reply_id], references: [id])
  child_replies PostReply[] @relation("ReplyNested")

  @@index([post_id])
  @@index([user_id])
  @@index([parent_reply_id])
  @@map("post_replies")
}

// ─────────────────────────────────────────────
// KONTEN KOMUNITAS
// ─────────────────────────────────────────────

model CommunityPost {
  id              String            @id @default(uuid())
  user_id         String
  community_id    String
  content         String            @db.Text
  type            CommunityPostType @default(text)
  media_urls      Json?
  flair           String?           @db.VarChar(50)
  upvote_count    Int               @default(0)
  downvote_count  Int               @default(0)
  reply_count     Int               @default(0)
  is_deleted      Boolean           @default(false)
  created_at      DateTime          @default(now())
  updated_at      DateTime          @updatedAt

  author    User                 @relation(fields: [user_id], references: [id])
  community Community            @relation(fields: [community_id], references: [id])
  replies   CommunityPostReply[]

  @@index([community_id])
  @@index([user_id])
  @@index([created_at])
  @@map("community_posts")
}

model CommunityPostReply {
  id                String   @id @default(uuid())
  community_post_id String
  user_id           String
  parent_reply_id   String?
  content           String   @db.Text
  media_urls        Json?
  upvote_count      Int      @default(0)
  downvote_count    Int      @default(0)
  is_deleted        Boolean  @default(false)
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt

  community_post CommunityPost       @relation(fields: [community_post_id], references: [id], onDelete: Cascade)
  author         User                @relation(fields: [user_id], references: [id])
  parent_reply   CommunityPostReply? @relation("CommunityReplyNested", fields: [parent_reply_id], references: [id])
  child_replies  CommunityPostReply[] @relation("CommunityReplyNested")

  @@index([community_post_id])
  @@index([user_id])
  @@index([parent_reply_id])
  @@map("community_post_replies")
}

// ─────────────────────────────────────────────
// REAKSI
// ─────────────────────────────────────────────

model PostReaction {
  id            String                  @id @default(uuid())
  user_id       String
  content_type  PostReactionContentType
  content_id    String
  reaction_type PostReactionType
  created_at    DateTime                @default(now())

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([user_id, content_type, content_id])
  @@index([content_type, content_id])
  @@map("post_reactions")
}

model CommunityReaction {
  id            String                       @id @default(uuid())
  user_id       String
  content_type  CommunityReactionContentType
  content_id    String
  reaction_type CommunityReactionType
  created_at    DateTime                     @default(now())

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([user_id, content_type, content_id])
  @@index([content_type, content_id])
  @@map("community_reactions")
}

// ─────────────────────────────────────────────
// SOSIAL
// ─────────────────────────────────────────────

model Follow {
  id           String   @id @default(uuid())
  follower_id  String
  following_id String
  created_at   DateTime @default(now())

  follower  User @relation("Follower",  fields: [follower_id],  references: [id], onDelete: Cascade)
  following User @relation("Following", fields: [following_id], references: [id], onDelete: Cascade)

  @@unique([follower_id, following_id])
  @@index([follower_id])
  @@index([following_id])
  @@map("follows")
}

model Bookmark {
  id           String              @id @default(uuid())
  user_id      String
  content_type BookmarkContentType
  content_id   String
  created_at   DateTime            @default(now())

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([user_id, content_type, content_id])
  @@map("bookmarks")
}

model Message {
  id          String   @id @default(uuid())
  sender_id   String
  receiver_id String
  content     String   @db.Text
  media_url   String?  @db.VarChar(500)
  is_read     Boolean  @default(false)
  created_at  DateTime @default(now())

  sender   User @relation("MessageSender",   fields: [sender_id],   references: [id])
  receiver User @relation("MessageReceiver", fields: [receiver_id], references: [id])

  @@index([sender_id, receiver_id])
  @@index([receiver_id, is_read])
  @@map("messages")
}

model Notification {
  id            String                    @id @default(uuid())
  recipient_id  String
  actor_id      String
  type          NotificationType
  reaction_type NotificationReactionType?
  content_type  NotificationContentType?
  content_id    String?
  is_read       Boolean                   @default(false)
  created_at    DateTime                  @default(now())

  recipient User @relation("NotificationRecipient", fields: [recipient_id], references: [id], onDelete: Cascade)
  actor     User @relation("NotificationActor",     fields: [actor_id],     references: [id], onDelete: Cascade)

  @@index([recipient_id, is_read])
  @@index([recipient_id, created_at])
  @@map("notifications")
}

// ─────────────────────────────────────────────
// KEAMANAN & AUDIT
// ─────────────────────────────────────────────

model Session {
  id             String    @id @default(uuid())
  user_id        String
  token          String    @unique @db.VarChar(500)
  device_id      String?
  ip_address     String?   @db.VarChar(45)
  is_active      Boolean   @default(true)
  expires_at     DateTime
  last_active_at DateTime  @default(now())
  created_at     DateTime  @default(now())

  user          User          @relation(fields: [user_id], references: [id], onDelete: Cascade)
  device        Device?       @relation(fields: [device_id], references: [id])
  locations     Location[]
  activity_logs ActivityLog[]

  @@index([user_id, is_active])
  @@map("sessions")
}

model Device {
  id            String     @id @default(uuid())
  user_id       String
  device_name   String?    @db.VarChar(100)
  device_type   DeviceType @default(unknown)
  os            String?    @db.VarChar(50)
  browser       String?    @db.VarChar(50)
  push_token    String?    @db.VarChar(500)
  is_trusted    Boolean    @default(false)
  last_login_at DateTime   @default(now())
  created_at    DateTime   @default(now())

  user     User      @relation(fields: [user_id], references: [id], onDelete: Cascade)
  sessions Session[]

  @@index([user_id])
  @@map("devices")
}

model Location {
  id            String   @id @default(uuid())
  session_id    String
  user_id       String
  ip_address    String   @db.VarChar(45)
  country       String?  @db.VarChar(100)
  city          String?  @db.VarChar(100)
  latitude      Decimal? @db.Decimal(10, 7)
  longitude     Decimal? @db.Decimal(10, 7)
  is_suspicious Boolean  @default(false)
  created_at    DateTime @default(now())

  session Session @relation(fields: [session_id], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id])
  @@index([session_id])
  @@map("locations")
}

model ActivityLog {
  id           String         @id @default(uuid())
  user_id      String
  session_id   String?
  action       ActivityAction
  content_type String?        @db.VarChar(50)
  content_id   String?
  metadata     Json?
  ip_address   String?        @db.VarChar(45)
  created_at   DateTime       @default(now())

  user    User     @relation(fields: [user_id], references: [id], onDelete: Cascade)
  session Session? @relation(fields: [session_id], references: [id])

  @@index([user_id])
  @@index([created_at])
  @@map("activity_logs")
}
```

JANGAN LUPA mengeksekusi sinkronisasi dengan database:
```bash
npx prisma db push
npx prisma generate
```

---

## 2. Spesifikasi API Endpoint

Gunakan hasil sinkronisasi schema di atas untuk merakit 9 Routing Data.

### GET /users/:username
- **Header**: Tidak perlu (publik)
- Mengembalikan detail spesifik profile milik parameter `:username` (relasi `profile`).
- Harus return struktur valid sesuai Issue / `404 Not Found`.

### GET /users/me
- **Header**: `Authorization: Bearer <token>`
- Ambil properti _Profile_ user yang diotentikasi. Mirip routing publik tetapi mengembalikan metadata logistik berlebihan (`email`, `birth_date`).

### PATCH /users/me
- **Header**: `Authorization: Bearer <token>`
- Merubah konfigurasi base-account: `username` atau `is_private`.
- Mencegah bentrok dengan database (`P2002 Unique Constraint`) dengan mengembalikan `409 Conflict`.

### PATCH /users/me/profile
- **Header**: `Authorization: Bearer <token>`
- Upsert/Update field ekstensial di tabel terpisah `UserProfile`.

### DELETE /users/me
- **Header**: `Authorization: Bearer <token>`
- Menerima JSON body `{ "password": "..." }`.
- Validasi via `bcrypt` dan lalu hapus seluruh jejak identitas ke database (`prisma.user.delete`).

### ENDPOINT GET-LIST WITH PAGINATION
Gunakan offset `take` & `skip` dari query limit+page `?page=X&limit=Y` pada tabel-tabel terkait:
- `GET /users/:username/followers` ➡️ Query table `Follow` relator `follower`
- `GET /users/:username/following` ➡️ Query table `Follow` relator `following`
- `GET /users/:username/posts` ➡️ Query table `Post` pengikatan `author` dengan urutan `desc` (`created_at`).

### MENCARI PENGGUNA (GET `/users/search?q=XYZ`)
- Pakai instrumen _Search string/contains_ Prisma untuk memanggil pencarian pada entitas `username` atau tabel relasi `profile.display_name`.

---

## 3. Langkah-Langkah Pengerjaan

### Tahap 1: Sinkronisasi Database
- Salin skema utuh ke `prisma/schema.prisma` seperti kode di atas.
- Berikan sinkronisasi dan generate client Prisma.

### Tahap 2: Helper Pagination (`src/utils/pagination.ts`)
- Buat sebuah modul fungsi terpisah untuk membersihkan output kalkulasi halaman (page, total_pages dsb).

### Tahap 3: Implementasi Layanan Bisnis (`src/services/user-service.ts`)
- Buat 8-9 fungsi *Async Prisma Query* (mengambil Profil, Posts, Followers dll).
- Tarik import properti unik baru sesuai format yang ditawarkan Prisma (seperti string filter pencarian, nested includes relasi Profile).

### Tahap 4: Implementasi Controller Rute (`src/routes/user-route.ts`)
- Sisipkan _Route Logic_ beserta _Middleware_, pastikan pola path yang berpotensi ditabrak (*conflict route wildcard*) tertata dari yang terbawah.
  - `/me` (Terproteksi `authMiddleware`)
  - `/me/profile` (Terproteksi `authMiddleware`)
  - `/search`
  - `/:username`
  - `/:username/...`

---

## Acceptance Criteria

- [ ] File Schema dirubah sempurna untuk membangkitkan entitas Database seperti Posts dan Follows.
- [ ] Tersedia helper pagination output.
- [ ] Fitur update profil membedakan entitas basis _Users_ vs sub-kolom _UserProfile_.
- [ ] Rute dinamis tidak bertabrakan dengan statik route.
- [ ] Validasi keamanan hapus account.
