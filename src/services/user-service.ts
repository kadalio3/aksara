import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

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
    include: {
      UserProfile: true,
    },
  });

  return user;
};
