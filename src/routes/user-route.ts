import { Router, Request, Response } from 'express';
import { 
  registerUser, 
  loginUser, 
  getMe, 
  getUserByUsername, 
  updateAccount, 
  updateProfile, 
  deleteAccount, 
  searchUsers, 
  getFollowers, 
  getFollowing, 
  getUserPosts,
  logoutUser, 
  logoutAllDevices
} from '../services/user-service';
import { authMiddleware } from '../middleware/auth-middleware';
import { getPaginationMetadata } from '../utils/pagination';

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
    
    res.status(201).json({ success: true, data: 'user berhasil dibuat' });
  } catch (error: any) {
    if (error.message === 'Email telah terdaftar' || error.message === 'Username telah terdaftar') {
      res.status(409).json({ success: false, error: { code: 'DUPLICATE_ENTRY', message: error.message } });
      return;
    }
    
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Terjadi kesalahan sistem' } });
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

    res.status(200).json({ success: true, data: token });
  } catch (error: any) {
    if (error.message === 'Email atau password salah' || error.message === 'Akun telah dinonaktifkan') {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: error.message } });
      return;
    }

    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Terjadi kesalahan sistem' } });
  }
});

router.get('/users/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const user = await getMe(userId);
    res.status(200).json({ success: true, data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Terjadi kesalahan sistem' } });
  }
});

router.patch('/users/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const { username, is_private } = req.body;

    const user = await updateAccount(userId, { username, is_private });

    res.status(200).json({
      success: true,
      message: "Akun berhasil diperbarui",
      data: user
    });
  } catch (error: any) {
    if (error.message === 'Username sudah digunakan') {
      res.status(409).json({ success: false, error: { code: 'DUPLICATE_ENTRY', message: error.message } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Terjadi kesalahan sistem' } });
  }
});

router.patch('/users/me/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const profileData = req.body;

    const profile = await updateProfile(userId, profileData);

    res.status(200).json({
      success: true,
      message: "Profil berhasil diperbarui",
      data: profile
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Terjadi kesalahan sistem' } });
  }
});

router.delete('/users/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const { password } = req.body;

    if (!password) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Password konfirmasi wajib diisi' } });
      return;
    }

    await deleteAccount(userId, password);

    res.status(200).json({
      success: true,
      message: "Akun berhasil dihapus"
    });
  } catch (error: any) {
    if (error.message === 'Password salah') {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: error.message } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Terjadi kesalahan sistem' } });
  }
});

router.get('/users/search', async (req: Request, res: Response) => {
  try {
    const q = req.query.q as string || '';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 20);

    const { users, total } = await searchUsers(q, page, limit);
    const pagination = getPaginationMetadata(total, page, limit);

    res.status(200).json({ success: true, data: users, pagination });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Terjadi kesalahan sistem' } });
  }
});

router.get('/users/:username', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const user = await getUserByUsername(username);
    res.status(200).json({ success: true, data: user });
  } catch (error: any) {
    if (error.message === 'User tidak ditemukan') {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: error.message } });
      return;
    }
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Terjadi kesalahan sistem' } });
  }
});

router.get('/users/:username/followers', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 20);

    const { followers, total } = await getFollowers(username, page, limit);
    const pagination = getPaginationMetadata(total, page, limit);

    res.status(200).json({ success: true, data: followers, pagination });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Terjadi kesalahan sistem' } });
  }
});

router.get('/users/:username/following', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 20);

    const { following, total } = await getFollowing(username, page, limit);
    const pagination = getPaginationMetadata(total, page, limit);

    res.status(200).json({ success: true, data: following, pagination });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Terjadi kesalahan sistem' } });
  }
});

router.get('/users/:username/posts', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, parseInt(req.query.limit as string) || 20);

    const { posts, total } = await getUserPosts(username, page, limit);
    const pagination = getPaginationMetadata(total, page, limit);

    res.status(200).json({ success: true, data: posts, pagination });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Terjadi kesalahan sistem' } });
  }
});

router.post('/users/logout/all', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId;
    const count = await logoutAllDevices(userId);

    res.status(200).json({
      success: true,
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
      success: true,
      data: { message: "logout berhasil" }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Terjadi kesalahan sistem' });
  }
});

export default router;
