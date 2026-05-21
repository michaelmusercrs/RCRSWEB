import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { readBlogPosts } from '@/lib/blog-posts-store';

// GET - list pending (review) posts for admin
//
// FIX (2026-05-20): Previously read from data/blog-posts.json which doesn't
// persist on Vercel. All other blog routes write to the Blog_Posts sheet via
// blog-posts-store, so pending posts never appeared here. Switched to the
// store so admin "Pending Review" actually shows rep submissions.
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  const posts = await readBlogPosts();
  const pending = posts.filter((p) => p.status === 'review');

  return NextResponse.json({ success: true, posts: pending });
}
