import { Router, Request, Response } from 'express';
import { registerUser, loginUser, getCurrentUser, logoutUser, logoutAllDevices } from '../services/user-service';
import { authMiddleware } from '../middleware/auth-middleware';

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  try {
    const username = req.body.username?.trim();
    const email = req.body.email?.trim();
    const { password } = req.body;
    
    // Validasi 1: Cek field kosong
    if (!username || !email || !password) {
      res.status(400).json({ error: 'Username, email, dan password wajib diisi' });
      return;
    }

    // Validasi 2: Cek tipe data
    if (typeof username !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Format input tidak valid' });
      return;
    }

    // Validasi 3: Panjang username (3-50)
    if (username.length < 3 || username.length > 50) {
      res.status(400).json({ error: 'Username harus antara 3 - 50 karakter' });
      return;
    }

    // Validasi 4: Format & panjang email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || email.length > 255) {
      const errorMsg = email.length > 255 ? 'Email maksimal 255 karakter' : 'Format email tidak valid';
      res.status(400).json({ error: errorMsg });
      return;
    }

    // Validasi 5: Panjang password minimal
    if (password.length < 6) {
      res.status(400).json({ error: 'Password minimal 6 karakter' });
      return;
    }

    await registerUser(username, email, password);
    
    res.status(201).json({ data: 'user berhasil dibuat' });
  } catch (error: any) {
    // 409 Conflict cocok untuk resource duplikat (Email/Username sudah terdaftar)
    if (error.message === 'Email telah terdaftar' || error.message === 'Username telah terdaftar') {
      res.status(409).json({ error: error.message });
      return;
    }
    
    res.status(500).json({ error: 'Terjadi kesalahan sistem' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email dan password wajib diisi' });
      return;
    }

    const token = await loginUser(email, password);

    res.status(200).json({ data: token });
  } catch (error: any) {
    if (error.message === 'Email atau password salah') {
      res.status(401).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Terjadi kesalahan sistem' });
  }
});

router.get('/user', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await getCurrentUser(userId);

    res.status(200).json({ data: user });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    res.status(500).json({ error: 'Terjadi kesalahan sistem' });
  }
});

router.post('/users/logout/all', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const count = await logoutAllDevices(userId);

    res.status(200).json({
      data: {
        message: "Semua device berhasil logout",
        sessions_revoked: count
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Terjadi kesalahan sistem' });
  }
});

router.post('/users/logout', authMiddleware, async (req: Request, res: Response) => {
  try {
    const token = res.locals.token;

    await logoutUser(token);

    res.status(200).json({
      data: { message: "logout berhasil" }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Terjadi kesalahan sistem' });
  }
});

export default router;
