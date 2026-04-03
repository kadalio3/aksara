import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { getPaginationMetadata } from '../utils/pagination';
import {
  createCommunity,
  getCommunities,
  getCommunityBySlug,
  updateCommunity,
  deleteCommunity,
  joinCommunity,
  leaveCommunity,
  getCommunityMembers,
  updateMemberRole,
  removeMember,
  createCommunityPost,
  getCommunityPosts,
  getCommunityPostById,
  updateCommunityPost,
  deleteCommunityPost,
  toggleCommunityPostReaction,
  deleteCommunityPostReaction,
  createCommunityReply,
  deleteCommunityReply,
  toggleCommunityReplyReaction,
  deleteCommunityReplyReaction,
} from '../services/communities-service';

const router = Router();

// ─────────────────────────────────────────────
// COMMUNITY PROFILE
// ─────────────────────────────────────────────

router.post('/communities', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const community = await createCommunity(userId, req.body);
    res.status(201).json({ success: true, message: "Komunitas berhasil dibuat", data: community });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({ success: false, error: { code: 'DUPLICATE_ENTRY', message: "Slug komunitas sudah digunakan" } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

router.get('/communities', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 20);
    const { communities, total } = await getCommunities(page, limit);
    res.status(200).json({ success: true, data: communities, pagination: getPaginationMetadata(total, page, limit) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

router.get('/communities/search', async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 20);
    const { communities, total } = await getCommunities(page, limit, q);
    res.status(200).json({ success: true, data: communities, pagination: getPaginationMetadata(total, page, limit) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

router.get('/communities/:slug', async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId; // Dari middleware auth jika ada (bersifat opsional)
    const community = await getCommunityBySlug(req.params.slug, userId);
    res.status(200).json({ success: true, data: community });
  } catch (error: any) {
    if (error.message === 'Komunitas tidak ditemukan') {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: error.message } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

router.patch('/communities/:slug', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const community = await updateCommunity(req.params.slug, req.body, userId);
    res.status(200).json({ success: true, message: "Komunitas berhasil diperbarui", data: community });
  } catch (error: any) {
    if (error.message === 'Hanya admin yang bisa mengedit komunitas') {
      res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_ROLE', message: error.message } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

router.delete('/communities/:slug', authMiddleware, async (req: Request, res: Response) => {
  try {
    await deleteCommunity(req.params.slug, res.locals.userId);
    res.status(200).json({ success: true, message: "Komunitas berhasil dihapus" });
  } catch (error: any) {
    if (error.message === 'Hanya pemilik yang bisa menghapus komunitas') {
      res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_ROLE', message: error.message } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

// ─────────────────────────────────────────────
// MEMBERSHIP
// ─────────────────────────────────────────────

router.post('/communities/:slug/join', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await joinCommunity(req.params.slug, res.locals.userId);
    res.status(201).json({ success: true, message: "Berhasil bergabung ke komunitas", data: { role: result.role } });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({ success: false, error: { code: 'ALREADY_MEMBER', message: "Kamu sudah bergabung ke komunitas ini" } });
      return;
    }
    if (error.message === 'Komunitas ini privat, kamu butuh undangan') {
      res.status(403).json({ success: false, error: { code: 'COMMUNITY_PRIVATE', message: error.message } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

router.delete('/communities/:slug/leave', authMiddleware, async (req: Request, res: Response) => {
  try {
    await leaveCommunity(req.params.slug, res.locals.userId);
    res.status(200).json({ success: true, message: "Berhasil keluar dari komunitas" });
  } catch (error: any) {
    if (error.message === 'Pemilik komunitas tidak bisa keluar. Hapus atau pindahkan kepemilikan dulu') {
      res.status(400).json({ success: false, error: { code: 'FORBIDDEN', message: error.message } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

router.get('/communities/:slug/members', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 20);
    const role = req.query.role as any;
    const { members, total } = await getCommunityMembers(req.params.slug, page, limit, role);
    res.status(200).json({ success: true, data: members, pagination: getPaginationMetadata(total, page, limit) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

router.patch('/communities/:slug/members/:userId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await updateMemberRole(req.params.slug, req.params.userId, req.body.role, res.locals.userId);
    res.status(200).json({ success: true, message: "Role anggota berhasil diubah", data: { user_id: result.user_id, role: result.role } });
  } catch (error: any) {
    if (error.message === 'Hanya admin yang bisa mengubah role anggota') {
      res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_ROLE', message: error.message } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

router.delete('/communities/:slug/members/:userId', authMiddleware, async (req: Request, res: Response) => {
  try {
    await removeMember(req.params.slug, req.params.userId, res.locals.userId);
    res.status(200).json({ success: true, message: "Anggota berhasil dikeluarkan dari komunitas" });
  } catch (error: any) {
    if (error.message.includes('Hanya admin')) {
      res.status(403).json({ success: false, error: { code: 'INSUFFICIENT_ROLE', message: error.message } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

// ─────────────────────────────────────────────
// POSTS
// ─────────────────────────────────────────────

router.post('/communities/:slug/posts', authMiddleware, async (req: Request, res: Response) => {
  try {
    const post = await createCommunityPost(req.params.slug, res.locals.userId, req.body);
    res.status(201).json({ success: true, message: "Post berhasil dibuat", data: post });
  } catch (error: any) {
    if (error.message.includes('Kamu harus bergabung')) {
      res.status(403).json({ success: false, error: { code: 'NOT_MEMBER', message: error.message } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

router.get('/communities/:slug/posts', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 20);
    const sort = (req.query.sort as any) || 'new';
    const { posts, total } = await getCommunityPosts(req.params.slug, page, limit, sort);
    res.status(200).json({ success: true, data: posts, pagination: getPaginationMetadata(total, page, limit) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

router.get('/communities/:slug/posts/:postId', async (req: Request, res: Response) => {
  try {
    const post = await getCommunityPostById(req.params.postId);
    res.status(200).json({ success: true, data: post });
  } catch (error: any) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: error.message } });
  }
});

router.patch('/communities/:slug/posts/:postId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const post = await updateCommunityPost(req.params.postId, res.locals.userId, req.body);
    res.status(200).json({ success: true, message: "Post berhasil diperbarui", data: post });
  } catch (error: any) {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: error.message } });
  }
});

router.delete('/communities/:slug/posts/:postId', authMiddleware, async (req: Request, res: Response) => {
  try {
    await deleteCommunityPost(req.params.postId, res.locals.userId);
    res.status(200).json({ success: true, message: "Post berhasil dihapus" });
  } catch (error: any) {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: error.message } });
  }
});

// ─────────────────────────────────────────────
// REACTIONS
// ─────────────────────────────────────────────

router.post('/communities/:slug/posts/:postId/reactions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await toggleCommunityPostReaction(res.locals.userId, req.params.postId, req.body.reaction_type);
    res.status(201).json({ success: true, message: "Reaksi berhasil ditambahkan", data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

router.delete('/communities/:slug/posts/:postId/reactions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await deleteCommunityPostReaction(res.locals.userId, req.params.postId);
    res.status(200).json({ success: true, message: "Reaksi berhasil dihapus", data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

// ─────────────────────────────────────────────
// REPLIES
// ─────────────────────────────────────────────

router.post('/communities/:slug/posts/:postId/replies', authMiddleware, async (req: Request, res: Response) => {
  try {
    const reply = await createCommunityReply(res.locals.userId, req.params.postId, req.body.content);
    res.status(201).json({ success: true, message: "Reply berhasil ditambahkan", data: reply });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

router.delete('/communities/:slug/posts/:postId/replies/:replyId', authMiddleware, async (req: Request, res: Response) => {
  try {
    await deleteCommunityReply(res.locals.userId, req.params.replyId);
    res.status(200).json({ success: true, message: "Reply berhasil dihapus" });
  } catch (error: any) {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: error.message } });
  }
});

// REACTION REPLIES
router.post('/communities/:slug/posts/:postId/replies/:replyId/reactions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await toggleCommunityReplyReaction(res.locals.userId, req.params.replyId, req.body.reaction_type);
    res.status(201).json({ success: true, message: "Reaksi berhasil ditambahkan", data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

router.delete('/communities/:slug/posts/:postId/replies/:replyId/reactions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await deleteCommunityReplyReaction(res.locals.userId, req.params.replyId);
    res.status(200).json({ success: true, message: "Reaksi berhasil dihapus", data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

export default router;
