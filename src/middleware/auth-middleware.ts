import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

    // Mengikat ID milik user ke variable lokal
    res.locals.userId = session.user_id;

    next();
  } catch (error) {
    res.status(500).json({ error: 'Terjadi kesalahan autotentikasi server' });
    return;
  }
};
