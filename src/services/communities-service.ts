import prisma from '../lib/prisma';
import { CommunityRole, CommunityVisibility, CommunityReactionType, CommunityReactionContentType, CommunityPostType } from '@prisma/client';

// ─────────────────────────────────────────────
// COMMUNITY PROFILE
// ─────────────────────────────────────────────

export const createCommunity = async (userId: string, data: { name: string; slug: string; description?: string; visibility?: CommunityVisibility }) => {
  if (!/^[a-z0-9-]+$/.test(data.slug)) {
    throw new Error('Format slug tidak valid (hanya alphanumeric dan tanda hubung)');
  }

  return await prisma.$transaction(async (tx) => {
    const community = await tx.community.create({
      data: {
        owner_id: userId,
        name: data.name,
        slug: data.slug,
        description: data.description,
        visibility: data.visibility || 'public',
        member_count: 1,
      },
      include: {
        owner: { select: { id: true, username: true } },
      },
    });

    await tx.communityMember.create({
      data: {
        user_id: userId,
        community_id: community.id,
        role: 'admin',
      },
    });

    return community;
  });
};

export const getCommunities = async (page: number, limit: number, query?: string) => {
  const skip = (page - 1) * limit;
  const where = query ? {
    OR: [
      { name: { contains: query } },
      { description: { contains: query } },
    ],
    visibility: 'public' as CommunityVisibility,
  } : { visibility: 'public' as CommunityVisibility };

  const [communities, total] = await Promise.all([
    prisma.community.findMany({
      where,
      orderBy: { member_count: 'desc' },
      skip,
      take: limit,
    }),
    prisma.community.count({ where }),
  ]);

  return { communities, total };
};

export const getCommunityBySlug = async (slug: string, userId?: string) => {
  const community = await prisma.community.findUnique({
    where: { slug },
    include: {
      owner: {
        select: {
          id: true,
          username: true,
          profile: { select: { display_name: true, avatar_url: true } },
        },
      },
    },
  });

  if (!community) throw new Error('Komunitas tidak ditemukan');

  let membership = null;
  if (userId) {
    membership = await prisma.communityMember.findUnique({
      where: { user_id_community_id: { user_id: userId, community_id: community.id } },
    });
  }

  return {
    ...community,
    is_member: !!membership,
    my_role: membership ? membership.role : null,
  };
};

export const updateCommunity = async (slug: string, data: any, userId: string) => {
  const community = await prisma.community.findUnique({ where: { slug } });
  if (!community) throw new Error('Komunitas tidak ditemukan');

  const member = await prisma.communityMember.findUnique({
    where: { user_id_community_id: { user_id: userId, community_id: community.id } },
  });

  if (!member || member.role !== 'admin') {
    throw new Error('Hanya admin yang bisa mengedit komunitas');
  }

  return await prisma.community.update({
    where: { id: community.id },
    data,
  });
};

export const deleteCommunity = async (slug: string, userId: string) => {
  const community = await prisma.community.findUnique({ where: { slug } });
  if (!community) throw new Error('Komunitas tidak ditemukan');

  if (community.owner_id !== userId) {
    throw new Error('Hanya pemilik yang bisa menghapus komunitas');
  }

  await prisma.$transaction(async (tx) => {
    // Hapus relasi secara berurutan untuk menghindari constraint error
    await tx.communityMember.deleteMany({ where: { community_id: community.id } });
    
    // CommunityPost akan dihapus, namun replies dan reactions terkait harus dibersihkan dulu
    const posts = await tx.communityPost.findMany({ where: { community_id: community.id } });
    const postIds = posts.map(p => p.id);

    await tx.communityReaction.deleteMany({
      where: { 
        OR: [
          { content_type: 'community_post', content_id: { in: postIds } },
          { content_type: 'community_post_reply' } // Ini bisa dioptimasi tapi demi keamanan kita cek postIds
        ]
      }
    });

    await tx.communityPostReply.deleteMany({ where: { community_post_id: { in: postIds } } });
    await tx.communityPost.deleteMany({ where: { community_id: community.id } });
    
    // Akhirnya hapus komunitasnya
    await tx.community.delete({ where: { id: community.id } });
  });
};

// ─────────────────────────────────────────────
// MEMBERSHIP
// ─────────────────────────────────────────────

export const joinCommunity = async (slug: string, userId: string) => {
  const community = await prisma.community.findUnique({ where: { slug } });
  if (!community) throw new Error('Komunitas tidak ditemukan');

  if (community.visibility === 'private') {
    throw new Error('Komunitas ini privat, kamu butuh undangan');
  }

  return await prisma.$transaction(async (tx) => {
    const membership = await tx.communityMember.create({
      data: {
        user_id: userId,
        community_id: community.id,
        role: 'member',
      },
    });

    await tx.community.update({
      where: { id: community.id },
      data: { member_count: { increment: 1 } },
    });

    return membership;
  });
};

export const leaveCommunity = async (slug: string, userId: string) => {
  const community = await prisma.community.findUnique({ where: { slug } });
  if (!community) throw new Error('Komunitas tidak ditemukan');

  if (community.owner_id === userId) {
    throw new Error('Pemilik komunitas tidak bisa keluar. Hapus atau pindahkan kepemilikan dulu');
  }

  await prisma.$transaction(async (tx) => {
    await tx.communityMember.delete({
      where: { user_id_community_id: { user_id: userId, community_id: community.id } },
    });

    await tx.community.update({
      where: { id: community.id },
      data: { member_count: { decrement: 1 } },
    });
  });
};

export const getCommunityMembers = async (slug: string, page: number, limit: number, role?: CommunityRole) => {
  const community = await prisma.community.findUnique({ where: { slug } });
  if (!community) throw new Error('Komunitas tidak ditemukan');

  const skip = (page - 1) * limit;
  const where = { community_id: community.id, ...(role && { role }) };

  const [members, total] = await Promise.all([
    prisma.communityMember.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            profile: { select: { display_name: true, avatar_url: true } },
          },
        },
      },
      orderBy: { joined_at: 'desc' },
      skip,
      take: limit,
    }),
    prisma.communityMember.count({ where }),
  ]);

  return { members, total };
};

export const updateMemberRole = async (slug: string, targetUserId: string, role: CommunityRole, userId: string) => {
  const community = await prisma.community.findUnique({ where: { slug } });
  if (!community) throw new Error('Komunitas tidak ditemukan');

  const [currentUserMember, targetMember] = await Promise.all([
    prisma.communityMember.findUnique({
      where: { user_id_community_id: { user_id: userId, community_id: community.id } },
    }),
    prisma.communityMember.findUnique({
      where: { user_id_community_id: { user_id: targetUserId, community_id: community.id } },
    })
  ]);

  if (!currentUserMember || currentUserMember.role !== 'admin') {
    throw new Error('Hanya admin yang bisa mengubah role anggota');
  }

  if (!targetMember) throw new Error('Anggota target tidak ditemukan');

  // Hierarki: Hanya Owner yang bisa men-demote Admin, atau mengubah role Admin lain
  if (targetMember.role === 'admin' && community.owner_id !== userId) {
    throw new Error('Hanya pemilik komunitas yang bisa mengubah hak akses Admin');
  }

  return await prisma.communityMember.update({
    where: { id: targetMember.id },
    data: { role },
  });
};

export const removeMember = async (slug: string, targetUserId: string, userId: string) => {
  const community = await prisma.community.findUnique({ where: { slug } });
  if (!community) throw new Error('Komunitas tidak ditemukan');

  const [currentUserMember, targetMember] = await Promise.all([
    prisma.communityMember.findUnique({
      where: { user_id_community_id: { user_id: userId, community_id: community.id } },
    }),
    prisma.communityMember.findUnique({
      where: { user_id_community_id: { user_id: targetUserId, community_id: community.id } },
    })
  ]);

  if (!currentUserMember) throw new Error('Kamu bukan anggota komunitas ini');
  if (!targetMember) throw new Error('Anggota target tidak ditemukan');

  // Cek Hierarki
  const isOwner = community.owner_id === userId;
  const isAdmin = currentUserMember.role === 'admin';
  const isMod = currentUserMember.role === 'moderator';

  // Moderator tidak bisa kick Admin atau Moderator lain
  if (isMod && (targetMember.role === 'admin' || targetMember.role === 'moderator')) {
    throw new Error('Moderator tidak punya izin untuk mengeluarkan Admin atau Moderator lain');
  }

  // Admin (bukan owner) tidak bisa kick sesama Admin
  if (isAdmin && !isOwner && targetMember.role === 'admin') {
    throw new Error('Hanya pemilik komunitas yang bisa mengeluarkan Admin');
  }

  if (!isAdmin && !isMod) {
    throw new Error('Hanya admin atau moderator yang bisa mengeluarkan anggota');
  }

  await prisma.$transaction(async (tx) => {
    await tx.communityMember.delete({
      where: { id: targetMember.id },
    });

    await tx.community.update({
      where: { id: community.id },
      data: { member_count: { decrement: 1 } },
    });
  });
};

// ─────────────────────────────────────────────
// POSTS
// ─────────────────────────────────────────────

export const createCommunityPost = async (slug: string, userId: string, data: { content: string; type?: CommunityPostType; flair?: string }) => {
  if (!data.content || data.content.trim().length === 0) throw new Error('Konten tidak boleh kosong');
  if (data.content.length > 2000) throw new Error('Konten maksimal 2000 karakter');

  const community = await prisma.community.findUnique({ where: { slug } });
  if (!community) throw new Error('Komunitas tidak ditemukan');

  const member = await prisma.communityMember.findUnique({
    where: { user_id_community_id: { user_id: userId, community_id: community.id } },
  });

  if (!member) throw new Error('Kamu harus bergabung ke komunitas ini untuk membuat post');

  return await prisma.$transaction(async (tx) => {
    const post = await tx.communityPost.create({
      data: {
        user_id: userId,
        community_id: community.id,
        content: data.content,
        type: data.type || 'text',
        flair: data.flair,
      },
      include: {
        author: { select: { id: true, username: true, profile: { select: { display_name: true, avatar_url: true } } } },
        community: { select: { id: true, name: true, slug: true } },
      },
    });

    await tx.community.update({
      where: { id: community.id },
      data: { post_count: { increment: 1 } },
    });

    return post;
  });
};

export const getCommunityPosts = async (slug: string, page: number, limit: number, sort: 'new' | 'top' | 'hot' = 'new', userId?: string) => {
  const community = await prisma.community.findUnique({ where: { slug } });
  if (!community) throw new Error('Komunitas tidak ditemukan');

  const skip = (page - 1) * limit;

  let orderBy: any = { created_at: 'desc' };
  if (sort === 'top') orderBy = { upvote_count: 'desc' };
  if (sort === 'hot') orderBy = [{ upvote_count: 'desc' }, { reply_count: 'desc' }];

  const [posts, total] = await Promise.all([
    prisma.communityPost.findMany({
      where: { community_id: community.id, is_deleted: false },
      include: {
        author: { select: { id: true, username: true, profile: { select: { display_name: true, avatar_url: true } } } },
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.communityPost.count({ where: { community_id: community.id, is_deleted: false } }),
  ]);

  let formattedPosts = posts;
  if (userId) {
    const postIds = posts.map(p => p.id);
    const [reactions, bookmarks] = await Promise.all([
      prisma.communityReaction.findMany({
        where: { user_id: userId, content_type: 'community_post', content_id: { in: postIds } },
      }),
      prisma.bookmark.findMany({
        where: { user_id: userId, content_type: 'community_post', content_id: { in: postIds } },
      }),
    ]);

    const reactionMap = new Map(reactions.map(r => [r.content_id, r.reaction_type]));
    const bookmarkedSet = new Set(bookmarks.map(b => b.content_id));

    formattedPosts = posts.map(p => ({
      ...p,
      my_reaction: reactionMap.get(p.id) || null,
      is_bookmarked: bookmarkedSet.has(p.id),
    })) as any;
  }

  return { posts: formattedPosts, total };
};

export const getCommunityPostById = async (postId: string, userId?: string) => {
  const post = await prisma.communityPost.findUnique({
    where: { id: postId, is_deleted: false },
    include: {
      author: { select: { id: true, username: true, profile: { select: { display_name: true, avatar_url: true } } } },
      community: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!post) throw new Error('Post tidak ditemukan');

  if (userId) {
    const reaction = await prisma.communityReaction.findUnique({
      where: { user_id_content_type_content_id: { user_id: userId, content_type: 'community_post', content_id: postId } },
    });
    return { ...post, my_reaction: reaction ? reaction.reaction_type : null };
  }

  return post;
};

export const updateCommunityPost = async (postId: string, userId: string, data: { content: string; flair?: string }) => {
  const post = await prisma.communityPost.findUnique({ where: { id: postId } });
  if (!post) throw new Error('Post tidak ditemukan');
  if (post.user_id !== userId) throw new Error('Kamu tidak punya izin mengedit post ini');

  return await prisma.communityPost.update({
    where: { id: postId },
    data,
  });
};

export const deleteCommunityPost = async (postId: string, userId: string) => {
  const post = await prisma.communityPost.findUnique({ where: { id: postId } });
  if (!post) throw new Error('Post tidak ditemukan');

  const member = await prisma.communityMember.findUnique({
    where: { user_id_community_id: { user_id: userId, community_id: post.community_id } },
  });

  // Pemilik post atau Moderator/Admin bisa menghapus
  const isAuthorized = post.user_id === userId || (member && (member.role === 'admin' || member.role === 'moderator'));
  if (!isAuthorized) throw new Error('Kamu tidak punya izin menghapus post ini');

  await prisma.$transaction(async (tx) => {
    await tx.communityPost.update({
      where: { id: postId },
      data: { is_deleted: true },
    });

    await tx.community.update({
      where: { id: post.community_id },
      data: { post_count: { decrement: 1 } },
    });
  });
};

// ─────────────────────────────────────────────
// REACTIONS
// ─────────────────────────────────────────────

export const toggleCommunityPostReaction = async (userId: string, postId: string, reactionType: CommunityReactionType) => {
  const post = await prisma.communityPost.findUnique({ where: { id: postId } });
  if (!post) throw new Error('Post tidak ditemukan');

  const existing = await prisma.communityReaction.findUnique({
    where: { user_id_content_type_content_id: { user_id: userId, content_type: 'community_post', content_id: postId } },
  });

  return await prisma.$transaction(async (tx) => {
    if (existing) {
      if (existing.reaction_type === reactionType) {
        // Unreact
        await tx.communityReaction.delete({ where: { id: existing.id } });
        const updated = await tx.communityPost.update({
          where: { id: postId },
          data: { [reactionType === 'upvote' ? 'upvote_count' : 'downvote_count']: { decrement: 1 } },
        });
        return { reaction_type: null, upvote_count: updated.upvote_count, downvote_count: updated.downvote_count };
      } else {
        // Switch reaction
        await tx.communityReaction.update({ where: { id: existing.id }, data: { reaction_type: reactionType } });
        const updated = await tx.communityPost.update({
          where: { id: postId },
          data: {
            upvote_count: { [reactionType === 'upvote' ? 'increment' : 'decrement']: 1 },
            downvote_count: { [reactionType === 'downvote' ? 'increment' : 'decrement']: 1 },
          },
        });
        return { reaction_type: reactionType, upvote_count: updated.upvote_count, downvote_count: updated.downvote_count };
      }
    } else {
      // New reaction
      await tx.communityReaction.create({
        data: { user_id: userId, content_id: postId, content_type: 'community_post', reaction_type: reactionType },
      });
      const updated = await tx.communityPost.update({
        where: { id: postId },
        data: { [reactionType === 'upvote' ? 'upvote_count' : 'downvote_count']: { increment: 1 } },
      });
      return { reaction_type: reactionType, upvote_count: updated.upvote_count, downvote_count: updated.downvote_count };
    }
  });
};

export const deleteCommunityPostReaction = async (userId: string, postId: string) => {
  const existing = await prisma.communityReaction.findUnique({
    where: { user_id_content_type_content_id: { user_id: userId, content_type: 'community_post', content_id: postId } },
  });

  if (!existing) throw new Error('Kamu tidak punya reaksi pada post ini');

  return await prisma.$transaction(async (tx) => {
    await tx.communityReaction.delete({ where: { id: existing.id } });
    const updated = await tx.communityPost.update({
      where: { id: postId },
      data: { [existing.reaction_type === 'upvote' ? 'upvote_count' : 'downvote_count']: { decrement: 1 } },
    });
    return { upvote_count: updated.upvote_count, downvote_count: updated.downvote_count };
  });
};

// ─────────────────────────────────────────────
// REPLIES
// ─────────────────────────────────────────────

export const createCommunityReply = async (userId: string, postId: string, content: string, parentReplyId: string | null = null) => {
  if (!content || content.trim().length === 0) throw new Error('Konten tidak boleh kosong');
  if (content.length > 1000) throw new Error('Balasan maksimal 1000 karakter');

  const post = await prisma.communityPost.findUnique({ where: { id: postId } });
  if (!post) throw new Error('Post tidak ditemukan');

  return await prisma.$transaction(async (tx) => {
    const reply = await tx.communityPostReply.create({
      data: {
        user_id: userId,
        community_post_id: postId,
        content,
        parent_reply_id: parentReplyId,
      },
      include: {
        author: { select: { id: true, username: true, profile: { select: { display_name: true, avatar_url: true } } } },
      },
    });

    await tx.communityPost.update({
      where: { id: postId },
      data: { reply_count: { increment: 1 } },
    });

    return reply;
  });
};

export const deleteCommunityReply = async (userId: string, replyId: string) => {
  const reply = await prisma.communityPostReply.findUnique({ where: { id: replyId } });
  if (!reply) throw new Error('Reply tidak ditemukan');

  if (reply.user_id !== userId) throw new Error('Kamu tidak punya izin menghapus balasan ini');

  await prisma.$transaction(async (tx) => {
    await tx.communityPostReply.update({ where: { id: replyId }, data: { is_deleted: true } });
    await tx.communityPost.update({ where: { id: reply.community_post_id }, data: { reply_count: { decrement: 1 } } });
  });
};

export const toggleCommunityReplyReaction = async (userId: string, replyId: string, reactionType: CommunityReactionType) => {
  const reply = await prisma.communityPostReply.findUnique({ where: { id: replyId } });
  if (!reply) throw new Error('Reply tidak ditemukan');

  const existing = await prisma.communityReaction.findUnique({
    where: { user_id_content_type_content_id: { user_id: userId, content_type: 'community_post_reply', content_id: replyId } },
  });

  return await prisma.$transaction(async (tx) => {
    if (existing) {
      if (existing.reaction_type === reactionType) {
        await tx.communityReaction.delete({ where: { id: existing.id } });
        const updated = await tx.communityPostReply.update({
          where: { id: replyId },
          data: { [reactionType === 'upvote' ? 'upvote_count' : 'downvote_count']: { decrement: 1 } },
        });
        return { reaction_type: null, upvote_count: updated.upvote_count, downvote_count: updated.downvote_count };
      } else {
        await tx.communityReaction.update({ where: { id: existing.id }, data: { reaction_type: reactionType } });
        const updated = await tx.communityPostReply.update({
          where: { id: replyId },
          data: {
            upvote_count: { [reactionType === 'upvote' ? 'increment' : 'decrement']: 1 },
            downvote_count: { [reactionType === 'downvote' ? 'increment' : 'decrement']: 1 },
          },
        });
        return { reaction_type: reactionType, upvote_count: updated.upvote_count, downvote_count: updated.downvote_count };
      }
    } else {
      await tx.communityReaction.create({
        data: { user_id: userId, content_id: replyId, content_type: 'community_post_reply', reaction_type: reactionType },
      });
      const updated = await tx.communityPostReply.update({
        where: { id: replyId },
        data: { [reactionType === 'upvote' ? 'upvote_count' : 'downvote_count']: { increment: 1 } },
      });
      return { reaction_type: reactionType, upvote_count: updated.upvote_count, downvote_count: updated.downvote_count };
    }
  });
};

export const deleteCommunityReplyReaction = async (userId: string, replyId: string) => {
  const existing = await prisma.communityReaction.findUnique({
    where: { user_id_content_type_content_id: { user_id: userId, content_type: 'community_post_reply', content_id: replyId } },
  });

  if (!existing) throw new Error('Kamu tidak punya reaksi pada balasan ini');

  return await prisma.$transaction(async (tx) => {
    await tx.communityReaction.delete({ where: { id: existing.id } });
    const updated = await tx.communityPostReply.update({
      where: { id: replyId },
      data: { [existing.reaction_type === 'upvote' ? 'upvote_count' : 'downvote_count']: { decrement: 1 } },
    });
    return { upvote_count: updated.upvote_count, downvote_count: updated.downvote_count };
  });
};
