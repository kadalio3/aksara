import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─────────────────────────────────────────────
// SERVICE: NOTIFICATIONS
// ─────────────────────────────────────────────

/**
 * Membuat notifikasi baru.
 * Digunakan secara internal oleh service lain (Posts, Follows, dll).
 */
export const createNotification = async (data: {
  recipient_id: string;
  actor_id: string;
  type: 'reaction' | 'reply' | 'follow' | 'mention' | 'repost' | 'community_invite' | 'community_join';
  reaction_type?: 'love' | 'upvote';
  content_type?: 'post' | 'post_reply' | 'community_post' | 'community_post_reply';
  content_id?: string;
}) => {
  // Jangan buat notifikasi jika aktor === penerima (aksi diri sendiri)
  if (data.actor_id === data.recipient_id) return null;

  return await prisma.notification.create({
    data: {
      recipient_id: data.recipient_id,
      actor_id: data.actor_id,
      type: data.type,
      reaction_type: data.reaction_type as any,
      content_type: data.content_type as any,
      content_id: data.content_id,
    }
  });
};

export const getNotifications = async (userId: string, page: number = 1, limit: number = 20, isRead?: boolean) => {
  const skip = (page - 1) * limit;
  const where: any = { recipient_id: userId };
  
  if (isRead !== undefined) {
    where.is_read = isRead;
  }

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
      include: {
        actor: {
          select: {
            id: true,
            username: true,
            profile: {
              select: {
                display_name: true,
                avatar_url: true
              }
            }
          }
        }
      }
    }),
    prisma.notification.count({ where })
  ]);

  // --- HYDRATION LOGIC ---
  // Kita ambil cuplikan konten asli agar Frontend tidak perlu query manual
  const hydratedNotifications = await Promise.all(notifications.map(async (n): Promise<any> => {
    let content: any = null;

    if (n.content_type === 'post' && n.content_id) {
      const post = await prisma.post.findUnique({ 
        where: { id: n.content_id },
        select: { content: true }
      });
      content = post ? { excerpt: post.content.substring(0, 50) } : null;
    } else if (n.content_type === 'post_reply' && n.content_id) {
      const reply = await prisma.postReply.findUnique({
        where: { id: n.content_id },
        select: { content: true }
      });
      content = reply ? { excerpt: reply.content.substring(0, 50) } : null;
    }

    return { ...n, content };
  }));

  return { notifications: hydratedNotifications, total };
};

export const getUnreadCount = async (userId: string) => {
  const count = await prisma.notification.count({
    where: { recipient_id: userId, is_read: false }
  });
  return count;
};

export const markAllAsRead = async (userId: string) => {
  const result = await prisma.notification.updateMany({
    where: { recipient_id: userId, is_read: false },
    data: { is_read: true }
  });
  return result.count;
};

export const markAsRead = async (userId: string, notificationId: string) => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId }
  });

  if (!notification) throw new Error('Notifikasi tidak ditemukan');
  if (notification.recipient_id !== userId) throw new Error('UNAUTHORIZED_ACCESS');

  return await prisma.notification.update({
    where: { id: notificationId },
    data: { is_read: true }
  });
};

export const deleteNotification = async (userId: string, notificationId: string) => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId }
  });

  if (!notification) throw new Error('Notifikasi tidak ditemukan');
  if (notification.recipient_id !== userId) throw new Error('UNAUTHORIZED_ACCESS');

  return await prisma.notification.delete({
    where: { id: notificationId }
  });
};
