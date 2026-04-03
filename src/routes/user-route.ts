import { Router, Request, Response } from 'express';
import { registerUser } from '../services/user-service';

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;
    
    // Validasi basic null check
    if (!username || !email || !password) {
      res.status(400).json({ error: 'Username, email, dan password wajib diisi' });
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

export default router;
