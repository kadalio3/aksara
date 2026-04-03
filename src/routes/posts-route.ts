import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { getPaginationMetadata } from '../utils/pagination';
import {
  createPost,
  getFeed,
  getPostById,
  updatePost,
  deletePost,
  repostPost,
  getReplies,
  createReply,
  deleteReply,
  toggleLovePost,
  toggleLoveReply,
} from '../services/posts-service';

const router = Router();

// ─────────────────────────────────────────────
// POST MANAGEMENT
// ─────────────────────────────────────────────

router.post('/posts', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const { content, type, media_urls } = req.body;

    const post = await createPost(userId, content, type, media_urls);

    res.status(201).json({
      success: true,
      message: "Post berhasil dibuat",
      data: post,
    });
  } catch (error: any) {
    if (error.message === 'Konten tidak boleh kosong') {
      res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: error.message } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Terjadi kesalahan sistem' } });
  }
});

router.get('/posts/feed', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 20);

    const { posts, total } = await getFeed(page, limit, userId);
    const pagination = getPaginationMetadata(total, page, limit);

    res.status(200).json({ success: true, data: posts, pagination });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Terjadi kesalahan sistem' } });
  }
});

router.get('/posts/:postId', async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const post = await getPostById(postId);
    res.status(200).json({ success: true, data: post });
  } catch (error: any) {
    if (error.message === 'Post tidak ditemukan') {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: error.message } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Terjadi kesalahan sistem' } });
  }
});

router.patch('/posts/:postId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const { postId } = req.params;
    const { content } = req.body;

    const post = await updatePost(userId, postId, content);

    res.status(200).json({
      success: true,
      message: "Post berhasil diperbarui",
      data: post,
    });
  } catch (error: any) {
    if (error.message === 'Post tidak ditemukan') {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: error.message } });
      return;
    }
    if (error.message === 'Kamu tidak punya izin mengedit post ini') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: error.message } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Terjadi kesalahan sistem' } });
  }
});

router.delete('/posts/:postId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const { postId } = req.params;

    await deletePost(userId, postId);

    res.status(200).json({ success: true, message: "Post berhasil dihapus" });
  } catch (error: any) {
    if (error.message === 'Post tidak ditemukan') {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: error.message } });
      return;
    }
    if (error.message === 'Kamu tidak punya izin menghapus post ini') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: error.message } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Terjadi kesalahan sistem' } });
  }
});

router.post('/posts/:postId/repost', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const { postId } = req.params;

    const repost = await repostPost(userId, postId);

    res.status(201).json({
      success: true,
      message: "Repost berhasil",
      data: repost,
    });
  } catch (error: any) {
    if (error.message === 'Post tidak ditemukan') {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: error.message } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Terjadi kesalahan sistem' } });
  }
});

// ─────────────────────────────────────────────
// REPLIES ROUTES
// ─────────────────────────────────────────────

router.get('/posts/:postId/replies', async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 20);

    const { replies, total } = await getReplies(postId, page, limit);
    const pagination = getPaginationMetadata(total, page, limit);

    res.status(200).json({ success: true, data: replies, pagination });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Terjadi kesalahan sistem' } });
  }
});

router.post('/posts/:postId/replies', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const { postId } = req.params;
    const { content } = req.body;

    const reply = await createReply(userId, postId, content);

    res.status(201).json({
      success: true,
      message: "Reply berhasil ditambahkan",
      data: reply,
    });
  } catch (error: any) {
    if (error.message === 'Post tidak ditemukan') {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: error.message } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Terjadi kesalahan sistem' } });
  }
});

router.post('/posts/:postId/replies/:replyId/replies', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const { postId, replyId } = req.params;
    const { content } = req.body;

    const reply = await createReply(userId, postId, content, replyId);

    res.status(201).json({
      success: true,
      message: "Reply berhasil ditambahkan",
      data: reply,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Terjadi kesalahan sistem' } });
  }
});

router.delete('/posts/:postId/replies/:replyId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const { replyId } = req.params;

    await deleteReply(userId, replyId);

    res.status(200).json({ success: true, message: "Reply berhasil dihapus" });
  } catch (error: any) {
    if (error.message === 'Reply tidak ditemukan') {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: error.message } });
      return;
    }
    if (error.message === 'Kamu tidak punya izin menghapus balasan ini') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: error.message } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Terjadi kesalahan sistem' } });
  }
});

// ─────────────────────────────────────────────
// REACTIONS ROUTES
// ─────────────────────────────────────────────

router.post('/posts/:postId/reactions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const { postId } = req.params;

    const result = await toggleLovePost(userId, postId);

    res.status(201).json({
      success: true,
      message: result.is_loved ? "Love berhasil ditambahkan" : "Love berhasil dihapus",
      data: { love_count: result.love_count },
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({ success: false, error: { code: 'ALREADY_REACTED', message: "Kamu sudah memberi love pada post ini" } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Terjadi kesalahan sistem' } });
  }
});

router.delete('/posts/:postId/reactions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const { postId } = req.params;

    const result = await toggleLovePost(userId, postId);

    res.status(200).json({
      success: true,
      message: "Love berhasil dihapus",
      data: { love_count: result.love_count },
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(409).json({ success: false, error: { code: 'NOT_FOLLOWING', message: "Kamu tidak memberi love pada post ini" } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Terjadi kesalahan sistem' } });
  }
});

router.post('/posts/:postId/replies/:replyId/reactions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const { replyId } = req.params;

    const result = await toggleLoveReply(userId, replyId);

    res.status(201).json({
      success: true,
      message: result.is_loved ? "Love berhasil ditambahkan" : "Love berhasil dihapus",
      data: { love_count: result.love_count },
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({ success: false, error: { code: 'ALREADY_REACTED', message: "Kamu sudah memberi love pada balasan ini" } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Terjadi kesalahan sistem' } });
  }
});

router.delete('/posts/:postId/replies/:replyId/reactions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const { replyId } = req.params;

    const result = await toggleLoveReply(userId, replyId);

    res.status(200).json({
      success: true,
      message: "Love berhasil dihapus",
      data: { love_count: result.love_count },
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(409).json({ success: false, error: { code: 'NOT_FOLLOWING', message: "Kamu tidak memberi love pada balasan ini" } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Terjadi kesalahan sistem' } });
  }
});

export default router;
