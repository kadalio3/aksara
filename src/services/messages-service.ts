import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─────────────────────────────────────────────
// SERVICE: MESSAGES (DM)
// ─────────────────────────────────────────────

export const getInbox = async (userId: string, page: number = 1, limit: number = 20) => {
  const offset = (page - 1) * limit;

  // Query untuk mendapatkan daftar partner terakhir (latest message per partner) secara efisien
  // Menggunakan Raw SQL untuk menghindari N+1 kueri pada list inbox
  const results: any[] = await prisma.$queryRaw`
    SELECT 
      m.content, 
      m.created_at, 
      m.is_read,
      u.id as partner_id,
      u.username,
      up.display_name,
      up.avatar_url,
      (SELECT COUNT(*) FROM messages WHERE receiver_id = ${userId} AND sender_id = u.id AND is_read = false) as unread_count
    FROM messages m
    JOIN (
      SELECT 
        CASE WHEN sender_id = ${userId} THEN receiver_id ELSE sender_id END as partner_id,
        MAX(created_at) as latest_at
      FROM messages
      WHERE sender_id = ${userId} OR receiver_id = ${userId}
      GROUP BY partner_id
    ) latest ON 
      ((m.sender_id = ${userId} AND m.receiver_id = latest.partner_id) OR (m.sender_id = latest.partner_id AND m.receiver_id = ${userId}))
      AND m.created_at = latest.latest_at
    JOIN users u ON u.id = latest.partner_id
    LEFT JOIN user_profiles up ON up.user_id = latest.partner_id
    ORDER BY latest.latest_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  // Hitung total percakapan unik untuk metadata paginasi
  const totalResults: any[] = await prisma.$queryRaw`
    SELECT COUNT(DISTINCT CASE WHEN sender_id = ${userId} THEN receiver_id ELSE sender_id END) as total
    FROM messages
    WHERE sender_id = ${userId} OR receiver_id = ${userId}
  `;
  
  const total = Number(totalResults[0]?.total || 0);

  const inbox = results.map(row => ({
    user: {
      id: row.partner_id,
      username: row.username,
      profile: {
        display_name: row.display_name,
        avatar_url: row.avatar_url,
      }
    },
    last_message: {
      content: row.content,
      created_at: row.created_at,
      is_read: row.is_read === 1 || row.is_read === true,
    },
    unread_count: Number(row.unread_count)
  }));

  return { inbox, total };
};

export const getChatHistory = async (userId: string, targetUserId: string, page: number = 1, limit: number = 30) => {
  const skip = (page - 1) * limit;

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: {
        OR: [
          { sender_id: userId, receiver_id: targetUserId },
          { sender_id: targetUserId, receiver_id: userId }
        ]
      },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
    prisma.message.count({
      where: {
        OR: [
          { sender_id: userId, receiver_id: targetUserId },
          { sender_id: targetUserId, receiver_id: userId }
        ]
      }
    })
  ]);

  // Tambahkan flag is_mine
  const formattedMessages = messages.map(m => ({
    id: m.id,
    content: m.content,
    media_url: m.media_url,
    is_read: m.is_read,
    is_mine: m.sender_id === userId,
    created_at: m.created_at
  }));

  return { messages: formattedMessages, total };
};

export const sendMessage = async (userId: string, targetUserId: string, data: { content: string; media_url?: string }) => {
  if (!data.content || data.content.trim().length === 0) throw new Error('Konten pesan tidak boleh kosong');
  if (userId === targetUserId) throw new Error('SELF_DM_NOT_ALLOWED');

  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!targetUser) throw new Error('Target user tidak ditemukan');

  return await prisma.message.create({
    data: {
      sender_id: userId,
      receiver_id: targetUserId,
      content: data.content,
      media_url: data.media_url || null,
    },
    select: {
      id: true,
      content: true,
      is_read: true,
      created_at: true,
    }
  });
};

export const markAsRead = async (userId: string, targetUserId: string) => {
  const updateResult = await prisma.message.updateMany({
    where: {
      sender_id: targetUserId,
      receiver_id: userId,
      is_read: false
    },
    data: { is_read: true }
  });

  return { updated_count: updateResult.count };
};

export const deleteMessage = async (userId: string, messageId: string) => {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  
  if (!message) throw new Error('Pesan tidak ditemukan');
  
  // Hanya pengirim yang bisa menghapus pesan
  if (message.sender_id !== userId) {
    throw new Error('UNAUTHORIZED_DELETE');
  }

  return await prisma.message.delete({ where: { id: messageId } });
};
