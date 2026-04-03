import bcrypt from 'bcrypt';
import crypto from 'crypto';
import prisma from '../lib/prisma';

export const registerUser = async (username: string, email: string, password_string: string) => {
  // 1. Cek email unik
  const existingEmail = await prisma.user.findUnique({
    where: { email },
  });
  if (existingEmail) {
    throw new Error('Email telah terdaftar');
  }

  // 2. Cek username unik
  const existingUsername = await prisma.user.findUnique({
    where: { username },
  });
  if (existingUsername) {
    throw new Error('Username telah terdaftar');
  }

  // 3. Hash password
  const password_hash = await bcrypt.hash(password_string, 10);

  // 4. Insert user beserta profil (atomic creation / transaction)
  const user = await prisma.user.create({
    data: {
      username,
      email,
      password_hash,
      UserProfile: {
        create: {}, // akan membuat record kosong dengan ID relasional user yang sesuai
      },
    },
    select: {
      id: true,
      username: true,
      email: true,
      created_at: true,
      UserProfile: true,
    },
  });

  return user;
};

export const loginUser = async (email: string, password_string: string) => {
  // 1. Cari user berdasarkan email
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error('Email atau password salah');
  }

  if (!user.is_active) {
    throw new Error('Akun telah dinonaktifkan');
  }

  // 2. Bandingkan password
  const isValidPassword = await bcrypt.compare(password_string, user.password_hash);
  
  if (!isValidPassword) {
    throw new Error('Email atau password salah');
  }

  // 3. Generate token sesi
  const token = crypto.randomUUID();

  // 4. Hitung masa kadaluarsa (7 hari dari sekarang)
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // 5. Simpan sesi ke database
  await prisma.session.create({
    data: {
      user_id: user.id,
      token: token,
      expires_at: expiresAt,
      is_active: true,
    },
  });

  return token;
};

export const getCurrentUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      created_at: true,
    },
  });

  if (!user) {
    throw new Error('Unauthorized');
  }

  return user;
};

export const logoutUser = async (token: string) => {
  await prisma.session.deleteMany({
    where: { token },
  });
};

export const logoutAllDevices = async (userId: string) => {
  const result = await prisma.session.deleteMany({
    where: { user_id: userId },
  });
  return result.count;
};
