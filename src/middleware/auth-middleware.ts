import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const token = authHeader.split(' ')[1];

    const session = await prisma.session.findUnique({
      where: { token },
    });

    if (!session || !session.is_active || session.expires_at < new Date()) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Mengikat ID milik user & session ke variable lokal
    res.locals.userId = session.user_id;
    res.locals.sessionId = session.id;
    res.locals.token = token;

    // Refresh last_active_at secara asinkron (tidak ditunggu/await) agar respon tetap cepat
    prisma.session.update({
      where: { id: session.id },
      data: { last_active_at: new Date() }
    }).catch(err => console.error('Gagal memperbarui last_active_at:', err));

    next();
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan sistem' });
    return;
  }
};
