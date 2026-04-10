/**
 * Blog Posts Store
 *
 * Thin wrapper around the Blog_Posts tab on the master Google Sheet. All five
 * blog API routes (list, item, publish, approve, cron-publish) read and write
 * through this module so the schema stays in one place.
 *
 * Added 2026-04-09 as part of the persistence migration. Replaces the local
 * data/blog-posts.json file (writes were silently failing on Vercel's
 * read-only filesystem, causing data loss on every redeploy).
 */

import { googleSheetsService, SHEET_NAMES } from './google-sheets-service';

export interface BlogPost {
  id: string;
  slug: string;
  authorSlug: string;
  authorName: string;
  title: string;
  metaDescription: string;
  body: string;
  images: string[];
  status: 'draft' | 'review' | 'approved' | 'published' | 'rejected';
  createdAt: string;
  updatedAt: string;
  publishDate: string | null;
  publishedAt: string | null;
  rejectionReason: string | null;
}

export const BLOG_HEADERS = [
  'id',
  'slug',
  'authorSlug',
  'authorName',
  'title',
  'metaDescription',
  'body',
  'images',
  'status',
  'createdAt',
  'updatedAt',
  'publishDate',
  'publishedAt',
  'rejectionReason',
];

function rowToPost(row: Record<string, string>): BlogPost {
  let images: string[] = [];
  try {
    images = row.images ? JSON.parse(row.images) : [];
  } catch {
    images = [];
  }
  return {
    id: row.id || '',
    slug: row.slug || '',
    authorSlug: row.authorSlug || '',
    authorName: row.authorName || '',
    title: row.title || '',
    metaDescription: row.metaDescription || '',
    body: row.body || '',
    images,
    status: (row.status as BlogPost['status']) || 'draft',
    createdAt: row.createdAt || '',
    updatedAt: row.updatedAt || '',
    publishDate: row.publishDate || null,
    publishedAt: row.publishedAt || null,
    rejectionReason: row.rejectionReason || null,
  };
}

function postToRow(post: BlogPost): Record<string, unknown> {
  return {
    id: post.id,
    slug: post.slug,
    authorSlug: post.authorSlug,
    authorName: post.authorName,
    title: post.title,
    metaDescription: post.metaDescription,
    body: post.body,
    images: JSON.stringify(post.images),
    status: post.status,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    publishDate: post.publishDate ?? '',
    publishedAt: post.publishedAt ?? '',
    rejectionReason: post.rejectionReason ?? '',
  };
}

export async function readBlogPosts(): Promise<BlogPost[]> {
  const rows = await googleSheetsService.getGenericRows(SHEET_NAMES.BLOG_POSTS, BLOG_HEADERS);
  return rows.map(rowToPost);
}

export async function findBlogPostById(id: string): Promise<BlogPost | undefined> {
  const posts = await readBlogPosts();
  return posts.find((p) => p.id === id);
}

export async function upsertBlogPost(post: BlogPost): Promise<void> {
  await googleSheetsService.upsertGenericRow(
    SHEET_NAMES.BLOG_POSTS,
    BLOG_HEADERS,
    'id',
    postToRow(post),
  );
}

export async function deleteBlogPost(id: string): Promise<boolean> {
  return googleSheetsService.deleteGenericRow(SHEET_NAMES.BLOG_POSTS, 'id', id);
}
