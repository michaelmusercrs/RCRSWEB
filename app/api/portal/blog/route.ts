import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { auditLog } from '@/lib/audit-logger';
import {
  type BlogPost,
  readBlogPosts,
  upsertBlogPost,
} from '@/lib/blog-posts-store';

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function getNextFriday(from?: Date): string {
  const d = from ? new Date(from) : new Date();
  const day = d.getDay();
  const daysUntil = day <= 5 ? 5 - day : 5 + (7 - day);
  d.setDate(d.getDate() + (daysUntil === 0 ? 7 : daysUntil));
  return d.toISOString().split('T')[0];
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

/** Check rolling 7-day publish window. Returns null if OK, or the next eligible date string. */
function checkPublishCooldown(posts: BlogPost[]): string | null {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const recentPublished = posts.filter(p => 
    p.publishedAt && new Date(p.publishedAt) > sevenDaysAgo
  );
  
  if (recentPublished.length > 0) {
    // Find the most recent publish date and add 7 days
    const latest = recentPublished.reduce((a, b) => 
      new Date(a.publishedAt!) > new Date(b.publishedAt!) ? a : b
    );
    const nextEligible = new Date(new Date(latest.publishedAt!).getTime() + 7 * 24 * 60 * 60 * 1000);
    return nextEligible.toISOString().split('T')[0];
  }
  return null;
}

function validatePostContent(title: string, body: string, metaDescription: string, images: string[], requireAllForPublish: boolean) {
  const errors: string[] = [];
  
  if (!title || title.length < 30) {
    errors.push(`Title must be at least 30 characters (currently ${(title || '').length})`);
  }
  if (!body || body.length < 1500) {
    errors.push(`Body must be at least 1,500 characters (currently ${(body || '').length})`);
  }
  if (!body || countWords(body) < 300) {
    errors.push(`Body must be at least 300 words (currently ${countWords(body || '')})`);
  }
  if (requireAllForPublish) {
    if (!metaDescription || metaDescription.length < 120) {
      errors.push(`Meta description must be at least 120 characters (currently ${(metaDescription || '').length})`);
    }
    if (!images || images.length < 1) {
      errors.push('At least 1 image is required');
    }
  }
  return errors;
}

// GET - list posts for current user (or all for admin/owner)
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const posts = await readBlogPosts();
  const isAdmin = auth.user.role === 'admin' || auth.user.role === 'owner';

  const filtered = isAdmin ? posts : posts.filter(p => p.authorSlug === auth.user.userId);

  // Include publish cooldown info
  const cooldownDate = checkPublishCooldown(posts);

  return NextResponse.json({ success: true, posts: filtered, cooldownDate });
}

// POST - create new blog post
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const { title, body, metaDescription, images, status } = await request.json();

  if (status !== 'draft' && status !== 'review') {
    return NextResponse.json({ success: false, error: 'Status must be draft or review' }, { status: 400 });
  }

  // For drafts, only require title. For review, require all fields.
  const requireAll = status === 'review';
  
  if (requireAll) {
    const errors = validatePostContent(title, body, metaDescription, images, true);
    if (errors.length > 0) {
      return NextResponse.json({ success: false, error: errors[0], errors }, { status: 400 });
    }
  } else {
    // Minimal validation for drafts - just need a title
    if (!title || title.length < 5) {
      return NextResponse.json({ success: false, error: 'Title is required (min 5 characters for draft)' }, { status: 400 });
    }
  }

  const posts = await readBlogPosts();

  // Generate unique slug
  let slug = slugify(title);
  const existingSlugs = new Set(posts.map(p => p.slug));
  if (existingSlugs.has(slug)) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const newPost: BlogPost = {
    id: `blog-${Date.now()}`,
    slug,
    authorSlug: auth.user.userId,
    authorName: auth.user.name,
    title,
    metaDescription: metaDescription || '',
    body: body || '',
    images: images || [],
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publishDate: null,
    publishedAt: null,
    rejectionReason: null,
  };

  await upsertBlogPost(newPost);

  auditLog('BLOG_CREATE', auth.user.email, `Created blog post "${title}" (${newPost.id}, status: ${status})`, request);

  return NextResponse.json({ success: true, post: newPost }, { status: 201 });
}
