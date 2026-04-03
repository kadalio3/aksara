import { Router, Request, Response } from 'express';
import { 
  followUser, 
  unfollowUser, 
  getFollowStatus 
} from '../services/follow-service';
import { authMiddleware } from '../middleware/auth-middleware';

const router = Router();

// ─────────────────────────────────────────────
// FOLLOWS ROUTES
// ─────────────────────────────────────────────

router.post('/follows/:userId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const followerId = res.locals.userId;
    const followingId = req.params.userId;

    await followUser(followerId, followingId);

    res.status(201).json({
      success: true,
      message: "Berhasil mengikuti user"
    });
  } catch (error: any) {
    if (error.message === 'User tidak ditemukan') {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: error.message } });
      return;
    }
    if (error.message === 'Tidak bisa mengikuti diri sendiri') {
      res.status(400).json({ success: false, error: { code: 'SELF_FOLLOW', message: error.message } });
      return;
    }
    if (error.message === 'Kamu sudah mengikuti user ini') {
      res.status(409).json({ success: false, error: { code: 'ALREADY_FOLLOWING', message: error.message } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Terjadi kesalahan sistem' } });
  }
});

router.delete('/follows/:userId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const followerId = res.locals.userId;
    const followingId = req.params.userId;

    await unfollowUser(followerId, followingId);

    res.status(200).json({
      success: true,
      message: "Berhasil berhenti mengikuti user"
    });
  } catch (error: any) {
    if (error.message === 'Kamu tidak mengikuti user ini') {
      res.status(409).json({ success: false, error: { code: 'NOT_FOLLOWING', message: error.message } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Terjadi kesalahan sistem' } });
  }
});

router.get('/follows/:userId/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const meId = res.locals.userId;
    const targetId = req.params.userId;

    const status = await getFollowStatus(meId, targetId);

    res.status(200).json({
      success: true,
      data: status
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Terjadi kesalahan sistem' } });
  }
});

export default router;
