import { PrismaClient, BookmarkContentType } from '@prisma/client';

const prisma = new PrismaClient();

// ─────────────────────────────────────────────
// SERVICE: BOOKMARKS
// ─────────────────────────────────────────────

export const addBookmark = async (userId: string, data: { content_type: BookmarkContentType | string; content_id: string }) => {
  const { content_type, content_id } = data;

  // 1. Verifikasi Keberadaan Konten
  if (content_type === 'post') {
    const post = await prisma.post.findUnique({ where: { id: content_id } });
    if (!post || post.is_deleted) throw new Error('Konten post tidak ditemukan atau sudah dihapus');
  } else if (content_type === 'community_post') {
    const communityPost = await prisma.communityPost.findUnique({ where: { id: content_id } });
    if (!communityPost || communityPost.is_deleted) throw new Error('Konten community_post tidak ditemukan atau sudah dihapus');
  } else {
    throw new Error('Tipe konten tidak valid (post/community_post)');
  }

  // 2. Tambah Bookmark
  try {
    return await prisma.bookmark.create({
      data: {
        user_id: userId,
        content_type: content_type as BookmarkContentType,
        content_id: content_id,
      }
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      throw new Error('DUPLICATE_ENTRY');
    }
    throw error;
  }
};

export const removeBookmark = async (userId: string, bookmarkId: string) => {
  const bookmark = await prisma.bookmark.findUnique({ where: { id: bookmarkId } });
  
  if (!bookmark) throw new Error('Bookmark tidak ditemukan');
  if (bookmark.user_id !== userId) throw new Error('Hanya pemilik yang dapat menghapus bookmark ini');

  return await prisma.bookmark.delete({ where: { id: bookmarkId } });
};

export const getBookmarks = async (userId: string, page: number = 1, limit: number = 20, type?: BookmarkContentType) => {
  const skip = (page - 1) * limit;
  const where: any = { user_id: userId };
  if (type) where.content_type = type;

  const [bookmarks, total] = await Promise.all([
    prisma.bookmark.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
    prisma.bookmark.count({ where })
  ]);

  // ─────────────────────────────────────────────
  // POLYMORPHIC HYDRATION
  // ─────────────────────────────────────────────
  
  // Pisahkan ID berdasarkan tipe untuk kueri batch
  const postIds = bookmarks.filter(b => b.content_type === 'post').map(b => b.content_id);
  const communityPostIds = bookmarks.filter(b => b.content_type === 'community_post').map(b => b.content_id);

  const [posts, communityPosts] = await Promise.all([
    prisma.post.findMany({
      where: { id: { in: postIds }, is_deleted: false },
      include: { 
        author: { 
          select: { username: true, profile: { select: { display_name: true, avatar_url: true } } } 
        } 
      }
    }),
    prisma.communityPost.findMany({
      where: { id: { in: communityPostIds }, is_deleted: false },
      include: { 
        author: { 
          select: { username: true, profile: { select: { display_name: true, avatar_url: true } } } 
        } 
      }
    })
  ]);

  // Gabungkan kembali data konten ke dalam array bookmarks
  const hydratedBookmarks = bookmarks.map(bookmark => {
    let content = null;
    if (bookmark.content_type === 'post') {
      content = posts.find(p => p.id === bookmark.content_id) || null;
    } else if (bookmark.content_type === 'community_post') {
      content = communityPosts.find(cp => cp.id === bookmark.content_id) || null;
    }

    return {
      ...bookmark,
      content
    };
  });

  return { bookmarks: hydratedBookmarks, total };
};
