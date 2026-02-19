import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'blog-posts.json');

interface BlogPost {
  id: string;
  authorSlug: string;
  authorName: string;
  title: string;
  body: string;
  status: 'draft' | 'review' | 'approved' | 'published' | 'rejected';
  createdAt: string;
  updatedAt: string;
  publishDate: string | null;
  publishedAt: string | null;
  rejectionReason: string | null;
}

function readPosts(): BlogPost[] {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writePosts(posts: BlogPost[]) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(posts, null, 2));
}

// GET /api/cron/publish-blog — Auto-publish approved posts on their scheduled Friday
// Should be called by a cron job daily (or on Fridays)
export async function GET(request: NextRequest) {
  // Optional: verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const posts = readPosts();
  const published: string[] = [];

  for (const post of posts) {
    if (
      post.status === 'approved' &&
      post.publishDate &&
      post.publishDate <= today
    ) {
      post.status = 'published';
      post.publishedAt = new Date().toISOString();
      post.updatedAt = new Date().toISOString();
      published.push(post.id);
    }
  }

  if (published.length > 0) {
    writePosts(posts);
  }

  return NextResponse.json({
    success: true,
    publishedCount: published.length,
    publishedIds: published,
    checkedDate: today,
  });
}
