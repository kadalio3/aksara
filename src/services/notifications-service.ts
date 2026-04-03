import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─────────────────────────────────────────────
// SERVICE: NOTIFICATIONS
// ─────────────────────────────────────────────

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

  return { notifications, total };
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
