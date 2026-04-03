import prisma from '../lib/prisma';
import { createNotification } from './notifications-service';

// ─────────────────────────────────────────────
// SOCIAL FEATURES (FOLLOWS)
// ─────────────────────────────────────────────

export const followUser = async (followerId: string, followingId: string) => {
  // 1. Validasi: Target user harus ada
  const targetUser = await prisma.user.findUnique({
    where: { id: followingId },
  });
  if (!targetUser) throw new Error('User tidak ditemukan');

  // 2. Validasi: Tidak bisa follow diri sendiri
  if (followerId === followingId) {
    throw new Error('Tidak bisa mengikuti diri sendiri');
  }

  // 3. Validasi: Cek apakah sudah follow
  const existingFollow = await prisma.follow.findUnique({
    where: {
      follower_id_following_id: {
        follower_id: followerId,
        following_id: followingId,
      },
    },
  });
  if (existingFollow) throw new Error('Kamu sudah mengikuti user ini');

  // 4. Eksekusi atomik menggunakan transaksi
  await prisma.$transaction([
    prisma.follow.create({
      data: {
        follower_id: followerId,
        following_id: followingId,
      },
    }),
    prisma.user.update({
      where: { id: followingId },
      data: { follower_count: { increment: 1 } },
    }),
    prisma.user.update({
      where: { id: followerId },
      data: { following_count: { increment: 1 } },
    }),
  ]);

  // KIRIM NOTIFIKASI
  await createNotification({
    recipient_id: followingId,
    actor_id: followerId,
    type: 'follow'
  });
};

export const unfollowUser = async (followerId: string, followingId: string) => {
  // 1. Validasi: Cek hubungan follow harus ada
  const follow = await prisma.follow.findUnique({
    where: {
      follower_id_following_id: {
        follower_id: followerId,
        following_id: followingId,
      },
    },
  });
  if (!follow) throw new Error('Kamu tidak mengikuti user ini');

  // 2. Eksekusi atomik
  await prisma.$transaction([
    prisma.follow.delete({
      where: { id: follow.id },
    }),
    prisma.user.update({
      where: { id: followingId },
      data: { follower_count: { decrement: 1 } },
    }),
    prisma.user.update({
      where: { id: followerId },
      data: { following_count: { decrement: 1 } },
    }),
  ]);
};

export const getFollowStatus = async (meId: string, targetId: string) => {
  const [following, followedBy] = await Promise.all([
    prisma.follow.findUnique({
      where: {
        follower_id_following_id: {
          follower_id: meId,
          following_id: targetId,
        },
      },
    }),
    prisma.follow.findUnique({
      where: {
        follower_id_following_id: {
          follower_id: targetId,
          following_id: meId,
        },
      },
    }),
  ]);

  return {
    is_following: !!following,
    is_followed_by: !!followedBy,
  };
};
