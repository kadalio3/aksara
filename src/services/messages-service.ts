import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─────────────────────────────────────────────
// SERVICE: MESSAGES (DM)
// ─────────────────────────────────────────────

export const getInbox = async (userId: string) => {
  // 1. Dapatkan daftar ID user yang pernah berinteraksi (sebagai pengirim atau penerima)
  // Karena Prisma tidak punya DISTINCT ON, kita ambil semua lalu filter di JS atau pakai queryRaw
  // Untuk kemudahan di lingkungan ini, kita ambil daftar distinct lawan bicara (partner)
  
  const sentMessages = await prisma.message.findMany({
    where: { sender_id: userId },
    select: { receiver_id: true },
    distinct: ['receiver_id'],
  });

  const receivedMessages = await prisma.message.findMany({
    where: { receiver_id: userId },
    select: { sender_id: true },
    distinct: ['sender_id'],
  });

  const partnerIds = Array.from(new Set([
    ...sentMessages.map(m => m.receiver_id),
    ...receivedMessages.map(m => m.sender_id)
  ]));

  // 2. Ambil detail inbox untuk setiap partner secara paralel
  const inbox = await Promise.all(partnerIds.map(async (partnerId) => {
    const [user, lastMessage, unreadCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: partnerId },
        select: {
          id: true,
          username: true,
          profile: { select: { display_name: true, avatar_url: true } }
        }
      }),
      prisma.message.findFirst({
        where: {
          OR: [
            { sender_id: userId, receiver_id: partnerId },
            { sender_id: partnerId, receiver_id: userId }
          ]
        },
        orderBy: { created_at: 'desc' }
      }),
      prisma.message.count({
        where: {
          sender_id: partnerId,
          receiver_id: userId,
          is_read: false
        }
      })
    ]);

    return {
      user: user || { id: partnerId, username: 'Unknown User', profile: null },
      last_message: lastMessage ? {
        content: lastMessage.content,
        created_at: lastMessage.created_at,
        is_read: lastMessage.is_read
      } : null,
      unread_count: unreadCount
    };
  }));

  // Urutkan inbox berdasarkan pesan terbaru
  return inbox.sort((a, b) => {
    const dateA = a.last_message?.created_at.getTime() || 0;
    const dateB = b.last_message?.created_at.getTime() || 0;
    return dateB - dateA;
  });
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
