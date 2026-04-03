import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { getPaginationMetadata } from '../utils/pagination';
import {
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
  deleteNotification
} from '../services/notifications-service';

const router = Router();

// ─────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────

router.get('/notifications', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 20);
    const isRead = req.query.is_read !== undefined ? req.query.is_read === 'true' : undefined;

    const { notifications, total } = await getNotifications(userId, page, limit, isRead);
    res.status(200).json({ 
      success: true, 
      data: notifications, 
      pagination: getPaginationMetadata(total, page, limit) 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

router.get('/notifications/unread/count', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const count = await getUnreadCount(userId);
    res.status(200).json({ success: true, data: { count } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

router.patch('/notifications/read/all', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const updated_count = await markAllAsRead(userId);
    res.status(200).json({ success: true, message: "Semua notifikasi ditandai sudah dibaca", data: { updated_count } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

router.patch('/notifications/:id/read', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    await markAsRead(userId, req.params.id);
    res.status(200).json({ success: true, message: "Notifikasi ditandai sudah dibaca" });
  } catch (error: any) {
    if (error.message === 'Notifikasi tidak ditemukan') {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: error.message } });
      return;
    }
    if (error.message === 'UNAUTHORIZED_ACCESS') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: "Kamu tidak memiliki akses untuk notifikasi ini" } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

router.delete('/notifications/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    await deleteNotification(userId, req.params.id);
    res.status(200).json({ success: true, message: "Notifikasi berhasil dihapus" });
  } catch (error: any) {
    if (error.message === 'Notifikasi tidak ditemukan') {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: error.message } });
      return;
    }
    if (error.message === 'UNAUTHORIZED_ACCESS') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: "Kamu tidak memiliki akses untuk notifikasi ini" } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

export default router;
