import prisma from '../lib/prisma';
import { createNotification } from './notifications-service';
import { recordActivityLog } from './activity-service';
import { PostType, PostReactionContentType, PostReactionType } from '@prisma/client';

export const createPost = async (userId: string, content: string, type: PostType = 'text', media_urls: any = null) => {
  if (!content.trim()) {
    throw new Error('Konten tidak boleh kosong');
  }

  const post = await prisma.post.create({
    data: {
      user_id: userId,
      content,
      type,
      media_urls,
    },
    include: {
      author: {
        select: {
          id: true,
          username: true,
          profile: {
            select: {
              display_name: true,
              avatar_url: true,
            },
          },
        },
      },
    },
  });

  // RECORD ACTIVITY
  await recordActivityLog({
    userId,
    action: 'post_create',
    contentType: 'post',
    contentId: post.id
  });

  return post;
};

export const getFeed = async (page: number, limit: number, userId?: string) => {
  const skip = (page - 1) * limit;

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where: { is_deleted: false },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            profile: {
              select: {
                display_name: true,
                avatar_url: true,
              },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
    prisma.post.count({ where: { is_deleted: false } }),
  ]);

  // Jika userId ada, cek apakah user sudah me-love post tersebut
  let formattedPosts = posts;
  if (userId) {
    const postIds = posts.map(p => p.id);
    const reactions = await prisma.postReaction.findMany({
      where: {
        user_id: userId,
        content_type: 'post',
        content_id: { in: postIds },
      },
    });

    const reactedPostIds = new Set(reactions.map(r => r.content_id));
    formattedPosts = posts.map(p => ({
      ...p,
      is_loved: reactedPostIds.has(p.id),
      is_bookmarked: false, // Bookmark akan diimplementasi nanti jika perlu
    })) as any;
  }

  return { posts: formattedPosts, total };
};

export const getPostById = async (postId: string, userId?: string) => {
  const post = await prisma.post.findUnique({
    where: { id: postId, is_deleted: false },
    include: {
      author: {
        select: {
          id: true,
          username: true,
          profile: {
            select: {
              display_name: true,
              avatar_url: true,
            },
          },
        },
      },
    },
  });

  if (!post) throw new Error('Post tidak ditemukan');

  if (userId) {
    const reaction = await prisma.postReaction.findUnique({
      where: {
        user_id_content_type_content_id: {
          user_id: userId,
          content_type: 'post',
          content_id: postId,
        },
      },
    });
    return { ...post, is_loved: !!reaction, is_bookmarked: false };
  }

  return post;
};

export const updatePost = async (userId: string, postId: string, content: string) => {
  const post = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!post) throw new Error('Post tidak ditemukan');
  if (post.user_id !== userId) throw new Error('Kamu tidak punya izin mengedit post ini');

  const updatedPost = await prisma.post.update({
    where: { id: postId },
    data: { content },
    select: {
      id: true,
      content: true,
      updated_at: true,
    },
  });

  return updatedPost;
};

export const deletePost = async (userId: string, postId: string) => {
  const post = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!post) throw new Error('Post tidak ditemukan');
  if (post.user_id !== userId) throw new Error('Kamu tidak punya izin menghapus post ini');

  await prisma.post.update({
    where: { id: postId },
    data: { is_deleted: true },
  });

  // RECORD ACTIVITY
  await recordActivityLog({
    userId,
    action: 'post_delete',
    contentType: 'post',
    contentId: postId
  });
};

export const repostPost = async (userId: string, postId: string) => {
  const targetPost = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!targetPost) throw new Error('Post tidak ditemukan');

  return await prisma.$transaction(async (tx) => {
    const repost = await tx.post.create({
      data: {
        user_id: userId,
        content: `Repost dari ${targetPost.id}`, // Anda bisa menyesuaikan logic konten repost
        type: 'repost',
      },
    });

    await tx.post.update({
      where: { id: postId },
      data: { repost_count: { increment: 1 } },
    });

    return repost;
  });
};

// ─────────────────────────────────────────────
// REPLIES
// ─────────────────────────────────────────────

export const getReplies = async (postId: string, page: number, limit: number, userId?: string) => {
  const skip = (page - 1) * limit;

  const [replies, total] = await Promise.all([
    prisma.postReply.findMany({
      where: { post_id: postId, is_deleted: false },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            profile: {
              select: {
                display_name: true,
                avatar_url: true,
              },
            },
          },
        },
        _count: {
          select: { child_replies: true },
        },
      },
      orderBy: { created_at: 'asc' },
      skip,
      take: limit,
    }),
    prisma.postReply.count({ where: { post_id: postId, is_deleted: false } }),
  ]);

  let formattedReplies = replies;
  if (userId) {
    const replyIds = replies.map(r => r.id);
    const reactions = await prisma.postReaction.findMany({
      where: {
        user_id: userId,
        content_type: 'post_reply',
        content_id: { in: replyIds },
      },
    });

    const reactedReplyIds = new Set(reactions.map(r => r.content_id));
    formattedReplies = replies.map(r => ({
      ...r,
      is_loved: reactedReplyIds.has(r.id),
      child_reply_count: r._count.child_replies,
    })) as any;
  }

  return { replies: formattedReplies, total };
};

export const createReply = async (userId: string, postId: string, content: string, parentReplyId: string | null = null) => {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new Error('Post tidak ditemukan');

  return await prisma.$transaction(async (tx) => {
    const reply = await tx.postReply.create({
      data: {
        user_id: userId,
        post_id: postId,
        content,
        parent_reply_id: parentReplyId,
      },
      include: {
        author: {
          select: { id: true, username: true, profile: { select: { display_name: true, avatar_url: true } } },
        },
      },
    });

    await tx.post.update({
      where: { id: postId },
      data: { reply_count: { increment: 1 } },
    });

    // KIRIM NOTIFIKASI
    await createNotification({
      recipient_id: post.user_id,
      actor_id: userId,
      type: 'reply',
      content_type: 'post_reply',
      content_id: reply.id
    });

    return reply;
  });
};

export const deleteReply = async (userId: string, replyId: string) => {
  const reply = await prisma.postReply.findUnique({
    where: { id: replyId },
  });

  if (!reply) throw new Error('Reply tidak ditemukan');
  if (reply.user_id !== userId) throw new Error('Kamu tidak punya izin menghapus balasan ini');

  await prisma.$transaction(async (tx) => {
    await tx.postReply.update({
      where: { id: replyId },
      data: { is_deleted: true },
    });

    await tx.post.update({
      where: { id: reply.post_id },
      data: { reply_count: { decrement: 1 } },
    });
  });
};

// ─────────────────────────────────────────────
// REACTIONS (LOVES)
// ─────────────────────────────────────────────

export const toggleLovePost = async (userId: string, postId: string) => {
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) throw new Error('Post tidak ditemukan');

  const existing = await prisma.postReaction.findUnique({
    where: {
      user_id_content_type_content_id: {
        user_id: userId,
        content_type: 'post',
        content_id: postId,
      },
    },
  });

  return await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.postReaction.delete({ where: { id: existing.id } });
      const updated = await tx.post.update({
        where: { id: postId },
        data: { love_count: { decrement: 1 } },
      });
      return { love_count: updated.love_count, is_loved: false };
    } else {
      await tx.postReaction.create({
        data: { user_id: userId, content_type: 'post', content_id: postId, reaction_type: 'love' },
      });
      const updated = await tx.post.update({
        where: { id: postId },
        data: { love_count: { increment: 1 } },
      });

      // KIRIM NOTIFIKASI
      await createNotification({
        recipient_id: post.user_id,
        actor_id: userId,
        type: 'reaction',
        reaction_type: 'love',
        content_type: 'post',
        content_id: postId
      });

      return { love_count: updated.love_count, is_loved: true };
    }
  });
};

export const toggleLoveReply = async (userId: string, replyId: string) => {
  const reply = await prisma.postReply.findUnique({ where: { id: replyId } });
  if (!reply) throw new Error('Reply tidak ditemukan');

  const existing = await prisma.postReaction.findUnique({
    where: {
      user_id_content_type_content_id: {
        user_id: userId,
        content_type: 'post_reply',
        content_id: replyId,
      },
    },
  });

  return await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.postReaction.delete({ where: { id: existing.id } });
      const updated = await tx.postReply.update({
        where: { id: replyId },
        data: { love_count: { decrement: 1 } },
      });
      return { love_count: updated.love_count, is_loved: false };
    } else {
      await tx.postReaction.create({
        data: { user_id: userId, content_type: 'post_reply', content_id: replyId, reaction_type: 'love' },
      });
      const updated = await tx.postReply.update({
        where: { id: replyId },
        data: { love_count: { increment: 1 } },
      });

      // KIRIM NOTIFIKASI
      await createNotification({
        recipient_id: reply.user_id,
        actor_id: userId,
        type: 'reaction',
        reaction_type: 'love',
        content_type: 'post_reply',
        content_id: replyId
      });

      return { love_count: updated.love_count, is_loved: true };
    }
  });
};
