import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { getPaginationMetadata } from '../utils/pagination';
import {
  getInbox,
  getChatHistory,
  sendMessage,
  markAsRead,
  deleteMessage
} from '../services/messages-service';

const router = Router();

// ─────────────────────────────────────────────
// MESSAGES (DM)
// ─────────────────────────────────────────────

router.get('/messages', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 20);

    const { inbox, total } = await getInbox(userId, page, limit);
    res.status(200).json({ 
      success: true, 
      data: inbox,
      pagination: getPaginationMetadata(total, page, limit)
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

router.get('/messages/:userId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const targetUserId = req.params.userId;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 30);

    const { messages, total } = await getChatHistory(userId, targetUserId, page, limit);
    res.status(200).json({ 
      success: true, 
      data: messages, 
      pagination: getPaginationMetadata(total, page, limit) 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

router.post('/messages/:userId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const targetUserId = req.params.userId;
    const message = await sendMessage(userId, targetUserId, req.body);
    res.status(201).json({ success: true, message: "Pesan berhasil dikirim", data: message });
  } catch (error: any) {
    if (error.message === 'SELF_DM_NOT_ALLOWED') {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: "Kamu tidak bisa mengirim pesan ke diri sendiri" } });
      return;
    }
    if (error.message === 'Target user tidak ditemukan') {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: error.message } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

router.patch('/messages/:userId/read', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const targetUserId = req.params.userId;
    const result = await markAsRead(userId, targetUserId);
    res.status(200).json({ success: true, message: "Semua pesan ditandai sudah dibaca", data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

router.delete('/messages/:messageId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    await deleteMessage(userId, req.params.messageId);
    res.status(200).json({ success: true, message: "Pesan berhasil dihapus" });
  } catch (error: any) {
    if (error.message === 'Pesan tidak ditemukan') {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: error.message } });
      return;
    }
    if (error.message === 'UNAUTHORIZED_DELETE') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: "Kamu hanya bisa menghapus pesan yang kamu kirim" } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

export default router;
