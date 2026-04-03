import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { getPaginationMetadata } from '../utils/pagination';
import {
  addBookmark,
  removeBookmark,
  getBookmarks
} from '../services/bookmarks-service';

const router = Router();

// ─────────────────────────────────────────────
// BOOKMARKS
// ─────────────────────────────────────────────

router.post('/bookmarks', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const bookmark = await addBookmark(userId, req.body);
    res.status(201).json({ success: true, message: "Bookmark berhasil ditambahkan", data: bookmark });
  } catch (error: any) {
    if (error.message === 'DUPLICATE_ENTRY') {
      res.status(409).json({ success: false, error: { code: 'ALREADY_BOOKMARKED', message: "Konten ini sudah ada di bookmark kamu" } });
      return;
    }
    if (error.message === 'FORBIDDEN_PRIVATE_CONTENT') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: "Kamu tidak memiliki akses ke komunitas ini" } });
      return;
    }
    if (error.message.includes('tidak ditemukan')) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: error.message } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

router.delete('/bookmarks/:bookmarkId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    await removeBookmark(userId, req.params.bookmarkId);
    res.status(200).json({ success: true, message: "Bookmark berhasil dihapus" });
  } catch (error: any) {
    if (error.message === 'Bookmark tidak ditemukan') {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: error.message } });
      return;
    }
    if (error.message === 'Hanya pemilik yang dapat menghapus bookmark ini') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: error.message } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

router.get('/bookmarks', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 20);
    const type = req.query.type as any;

    const { bookmarks, total } = await getBookmarks(userId, page, limit, type);
    res.status(200).json({ 
      success: true, 
      data: bookmarks, 
      pagination: getPaginationMetadata(total, page, limit) 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

export default router;
