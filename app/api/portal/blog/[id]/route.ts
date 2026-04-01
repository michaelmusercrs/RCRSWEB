import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { auditLog } from '@/lib/audit-logger';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'blog-posts.json');

interface BlogPost {
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

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

function validateForReview(title: string, body: string, metaDescription: string, images: string[]) {
  const errors: string[] = [];
  if (!title || title.length < 30) errors.push(`Title must be at least 30 characters (currently ${(title || '').length})`);
  if (!body || body.length < 1500) errors.push(`Body must be at least 1,500 characters (currently ${(body || '').length})`);
  if (!body || countWords(body) < 300) errors.push(`Body must be at least 300 words (currently ${countWords(body || '')})`);
  if (!metaDescription || metaDescription.length < 120) errors.push(`Meta description must be at least 120 characters (currently ${(metaDescription || '').length})`);
  if (!images || images.length < 1) errors.push('At least 1 image is required');
  return errors;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const { id } = await params;
  const posts = readPosts();
  const post = posts.find(p => p.id === id);

  if (!post) {
    return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
  }

  const isAdmin = auth.user.role === 'admin' || auth.user.role === 'owner';
  if (!isAdmin && post.authorSlug !== auth.user.userId) {
    return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
  }

  return NextResponse.json({ success: true, post });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const { id } = await params;
  const posts = readPosts();
  const idx = posts.findIndex(p => p.id === id);

  if (idx === -1) {
    return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
  }

  const post = posts[idx];
  const isAdmin = auth.user.role === 'admin' || auth.user.role === 'owner';

  if (!isAdmin && post.authorSlug !== auth.user.userId) {
    return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
  }

  if (!isAdmin && post.status !== 'draft' && post.status !== 'rejected') {
    return NextResponse.json({ success: false, error: 'Can only edit draft or rejected posts' }, { status: 400 });
  }

  const { title, body, metaDescription, images, status } = await request.json();

  // Update fields
  if (title !== undefined) post.title = title;
  if (body !== undefined) post.body = body;
  if (metaDescription !== undefined) post.metaDescription = metaDescription;
  if (images !== undefined) post.images = images;

  // If submitting for review, validate all fields
  if (status === 'review') {
    const errors = validateForReview(
      post.title, post.body, post.metaDescription || '', post.images || []
    );
    if (errors.length > 0) {
      return NextResponse.json({ success: false, error: errors[0], errors }, { status: 400 });
    }
  }

  if (status !== undefined) {
    if (!isAdmin && status !== 'draft' && status !== 'review') {
      return NextResponse.json({ success: false, error: 'Can only set status to draft or review' }, { status: 400 });
    }
    post.status = status;
    if (status === 'review') {
      post.rejectionReason = null;
    }
  }

  post.updatedAt = new Date().toISOString();
  posts[idx] = post;
  writePosts(posts);

  const blogAction = status === 'approved' ? 'BLOG_APPROVE' : status === 'published' ? 'BLOG_PUBLISH' : status === 'rejected' ? 'BLOG_REJECT' : 'BLOG_EDIT';
  auditLog(blogAction, auth.user.email, `${blogAction === 'BLOG_EDIT' ? 'Edited' : blogAction === 'BLOG_APPROVE' ? 'Approved' : blogAction === 'BLOG_PUBLISH' ? 'Published' : 'Rejected'} blog post "${post.title}" (${id})`, request);

  return NextResponse.json({ success: true, post });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const { id } = await params;
  const posts = readPosts();
  const idx = posts.findIndex(p => p.id === id);

  if (idx === -1) {
    return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
  }

  const post = posts[idx];
  const isAdmin = auth.user.role === 'admin' || auth.user.role === 'owner';

  if (!isAdmin && post.authorSlug !== auth.user.userId) {
    return NextResponse.json({ success: false, error: 'Not authorized' }, { status: 403 });
  }

  if (!isAdmin && post.status !== 'draft') {
    return NextResponse.json({ success: false, error: 'Can only delete draft posts' }, { status: 400 });
  }

  posts.splice(idx, 1);
  writePosts(posts);

  auditLog('BLOG_DELETE', auth.user.email, `Deleted blog post "${post.title}" (${id})`, request);

  return NextResponse.json({ success: true });
}
