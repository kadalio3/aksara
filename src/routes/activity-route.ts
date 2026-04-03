import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { getPaginationMetadata } from '../utils/pagination';
import {
  getSessions,
  revokeSession,
  revokeOtherSessions,
  getDevices,
  trustDevice,
  deleteDevice,
  getLocations,
  getActivityLogs
} from '../services/activity-service';

const router = Router();

// ─────────────────────────────────────────────
// SECURITY: SESSIONS
// ─────────────────────────────────────────────

router.get('/security/sessions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const currentSessionId = res.locals.sessionId;
    const sessions = await getSessions(userId, currentSessionId);
    res.status(200).json({ success: true, data: sessions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

router.delete('/security/sessions/:sessionId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const sessionId = req.params.sessionId;
    await revokeSession(userId, sessionId);
    res.status(200).json({ success: true, message: "Sesi berhasil dicabut" });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED_REVOKE') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: "Kamu tidak bisa mencabut sesi ini" } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

router.delete('/security/sessions', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const currentSessionId = res.locals.sessionId;
    const result = await revokeOtherSessions(userId, currentSessionId);
    res.status(200).json({ success: true, message: "Semua sesi lain berhasil dicabut", data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

// ─────────────────────────────────────────────
// SECURITY: DEVICES
// ─────────────────────────────────────────────

router.get('/security/devices', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const devices = await getDevices(userId);
    res.status(200).json({ success: true, data: devices });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

router.patch('/security/devices/:deviceId/trust', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const deviceId = req.params.deviceId;
    const isTrusted = req.body.is_trusted === true;

    const device = await trustDevice(userId, deviceId, isTrusted);
    res.status(200).json({ success: true, message: "Perangkat ditandai sebagai terpercaya", data: device });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED_ACCESS') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: "Kamu tidak memiliki akses untuk perangkat ini" } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

router.delete('/security/devices/:deviceId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const deviceId = req.params.deviceId;
    await deleteDevice(userId, deviceId);
    res.status(200).json({ success: true, message: "Perangkat berhasil dihapus" });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED_ACCESS') {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: "Kamu tidak memiliki akses untuk perangkat ini" } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

// ─────────────────────────────────────────────
// SECURITY: LOGS
// ─────────────────────────────────────────────

router.get('/security/locations', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 20);

    const { locations, total } = await getLocations(userId, page, limit);
    res.status(200).json({ 
      success: true, 
      data: locations, 
      pagination: getPaginationMetadata(total, page, limit) 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

router.get('/security/activity', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 20);

    const { logs, total } = await getActivityLogs(userId, page, limit);
    res.status(200).json({ 
      success: true, 
      data: logs, 
      pagination: getPaginationMetadata(total, page, limit) 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: error.message } });
  }
});

export default router;
