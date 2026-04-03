import prisma from '../lib/prisma';

// ─────────────────────────────────────────────
// SERVICE: SECURITY & ACTIVITY
// ─────────────────────────────────────────────

/**
 * Mencatat log aktivitas pengguna secara internal.
 */
export const recordActivityLog = async (data: {
  userId: string;
  sessionId?: string;
  action: 'login' | 'logout' | 'register' | 'password_change' | 'password_reset' | 'post_create' | 'post_edit' | 'post_delete' | 'community_post_create' | 'community_post_edit' | 'community_post_delete' | 'reply_create' | 'reply_delete' | 'follow' | 'unfollow' | 'react' | 'unreact' | 'bookmark' | 'unbookmark' | 'community_create';
  contentType?: string;
  contentId?: string;
  ipAddress?: string;
  metadata?: any;
}) => {
  return await prisma.activityLog.create({
    data: {
      user_id: data.userId,
      session_id: data.sessionId,
      action: data.action as any,
      content_type: data.contentType,
      content_id: data.contentId,
      ip_address: data.ipAddress,
      metadata: data.metadata ? (typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata)) : null
    } as any
  });
};

/**
 * Mendapatkan daftar sesi aktif dengan penanda sesi saat ini (Current Session).
 */
export const getSessions = async (userId: string, currentSessionId: string) => {
  const sessions = await prisma.session.findMany({
    where: { user_id: userId, is_active: true },
    include: { device: true },
    orderBy: { last_active_at: 'desc' }
  });

  return sessions.map(s => ({
    id: s.id,
    ip_address: s.ip_address,
    is_active: s.is_active,
    is_current: s.id === currentSessionId,
    expires_at: s.expires_at,
    last_active_at: s.last_active_at,
    created_at: s.created_at,
    device: s.device ? {
      device_name: s.device.device_name,
      device_type: s.device.device_type,
      os: s.device.os,
      browser: s.device.browser
    } : null
  }));
};

/**
 * Mencabut sesi spesifik.
 */
export const revokeSession = async (userId: string, sessionId: string) => {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });

  if (!session) throw new Error('Sesi tidak ditemukan');
  if (session.user_id !== userId) throw new Error('UNAUTHORIZED_REVOKE');

  return await prisma.session.delete({ where: { id: sessionId } });
};

/**
 * Mencabut seluruh sesi lain kecuali sesi yang sedang aktif.
 */
export const revokeOtherSessions = async (userId: string, currentSessionId: string) => {
  const result = await prisma.session.deleteMany({
    where: {
      user_id: userId,
      id: { not: currentSessionId }
    }
  });

  return { sessions_revoked: result.count };
};

/**
 * Mendapatkan daftar perangkat unik milik pengguna.
 */
export const getDevices = async (userId: string) => {
  return await prisma.device.findMany({
    where: { user_id: userId },
    orderBy: { last_login_at: 'desc' }
  });
};

/**
 * Menandai perangkat sebagai dipercaya atau tidak.
 */
export const trustDevice = async (userId: string, deviceId: string, isTrusted: boolean) => {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });

  if (!device) throw new Error('Perangkat tidak ditemukan');
  if (device.user_id !== userId) throw new Error('UNAUTHORIZED_ACCESS');

  return await prisma.device.update({
    where: { id: deviceId },
    data: { is_trusted: isTrusted },
    select: { id: true, is_trusted: true }
  });
};

/**
 * Menghapus perangkat (akan memicu pemutusan sesi terkait).
 */
export const deleteDevice = async (userId: string, deviceId: string) => {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });

  if (!device) throw new Error('Perangkat tidak ditemukan');
  if (device.user_id !== userId) throw new Error('UNAUTHORIZED_ACCESS');

  return await prisma.device.delete({ where: { id: deviceId } });
};

/**
 * Mengambil log lokasi (Paginatif).
 */
export const getLocations = async (userId: string, page: number = 1, limit: number = 20) => {
  const skip = (page - 1) * limit;

  const [locations, total] = await Promise.all([
    prisma.location.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit
    }),
    prisma.location.count({ where: { user_id: userId } })
  ]);

  return { locations, total };
};

/**
 * Mengambil riwayat aktivitas sistem secara lengkap (Paginatif).
 */
export const getActivityLogs = async (userId: string, page: number = 1, limit: number = 20) => {
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit
    }),
    prisma.activityLog.count({ where: { user_id: userId } })
  ]);

  return { logs, total };
};
