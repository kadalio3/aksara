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
      profile: {
        create: {}, // akan membuat record kosong dengan ID relasional user yang sesuai
      },
    },
    select: {
      id: true,
      username: true,
      email: true,
      created_at: true,
      profile: true,
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

export const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
    },
  });

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Hilangkan password_hash sebelum dikirim
  const { password_hash, ...safeUser } = user;
  return safeUser;
};

export const getUserByUsername = async (username: string) => {
  const user = await prisma.user.findUnique({
    where: { username },
    include: {
      profile: true,
    },
  });

  if (!user) {
    throw new Error('User tidak ditemukan');
  }

  // Seleksi field publik saja
  const { password_hash, email, is_active, ...publicUser } = user;
  return publicUser;
};

export const updateAccount = async (userId: string, data: { username?: string; is_private?: boolean }) => {
  // Jika username diubah, cek keunikan
  if (data.username) {
    const existing = await prisma.user.findUnique({
      where: { username: data.username },
    });
    if (existing && existing.id !== userId) {
      throw new Error('Username sudah digunakan');
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      username: true,
      is_private: true,
      updated_at: true,
    },
  });

  return user;
};

export const updateProfile = async (userId: string, data: any) => {
  const profile = await prisma.userProfile.update({
    where: { user_id: userId },
    data,
    select: {
      display_name: true,
      bio: true,
      location: true,
      updated_at: true,
    },
  });

  return profile;
};

export const deleteAccount = async (userId: string, password_string: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User tidak ditemukan');
  }

  const isValidPassword = await bcrypt.compare(password_string, user.password_hash);
  if (!isValidPassword) {
    throw new Error('Password salah');
  }

  await prisma.user.delete({
    where: { id: userId },
  });
};

export const searchUsers = async (query: string, page: number, limit: number) => {
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: query } },
          { profile: { display_name: { contains: query } } },
        ],
      },
      select: {
        id: true,
        username: true,
        follower_count: true,
        profile: {
          select: {
            display_name: true,
            avatar_url: true,
          },
        },
      },
      skip,
      take: limit,
    }),
    prisma.user.count({
      where: {
        OR: [
          { username: { contains: query } },
          { profile: { display_name: { contains: query } } },
        ],
      },
    }),
  ]);

  return { users, total };
};

export const getFollowers = async (username: string, page: number, limit: number) => {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) throw new Error('User tidak ditemukan');

  const skip = (page - 1) * limit;

  const [follows, total] = await Promise.all([
    prisma.follow.findMany({
      where: { following_id: user.id },
      include: {
        follower: {
          include: { profile: true },
        },
      },
      skip,
      take: limit,
    }),
    prisma.follow.count({ where: { following_id: user.id } }),
  ]);

  const followers = follows.map(f => ({
    id: f.follower.id,
    username: f.follower.username,
    profile: f.follower.profile,
  }));

  return { followers, total };
};

export const getFollowing = async (username: string, page: number, limit: number) => {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) throw new Error('User tidak ditemukan');

  const skip = (page - 1) * limit;

  const [follows, total] = await Promise.all([
    prisma.follow.findMany({
      where: { follower_id: user.id },
      include: {
        following: {
          include: { profile: true },
        },
      },
      skip,
      take: limit,
    }),
    prisma.follow.count({ where: { follower_id: user.id } }),
  ]);

  const following = follows.map(f => ({
    id: f.following.id,
    username: f.following.username,
    profile: f.following.profile,
  }));

  return { following, total };
};

export const getUserPosts = async (username: string, page: number, limit: number) => {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) throw new Error('User tidak ditemukan');

  const skip = (page - 1) * limit;

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where: { user_id: user.id, is_deleted: false },
      include: {
        author: {
          include: { profile: true },
        },
      },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
    prisma.post.count({ where: { user_id: user.id, is_deleted: false } }),
  ]);

  const formattedPosts = posts.map(p => {
    const { author, ...postData } = p;
    return {
      ...postData,
      author: {
        id: author.id,
        username: author.username,
        profile: {
          display_name: author.profile?.display_name,
          avatar_url: author.profile?.avatar_url,
        },
      },
    };
  });

  return { posts: formattedPosts, total };
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

