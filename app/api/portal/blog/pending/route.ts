import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'blog-posts.json');

function readPosts() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

// GET - list pending (review) posts for admin
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  const posts = readPosts();
  const pending = posts.filter((p: { status: string }) => p.status === 'review');

  return NextResponse.json({ success: true, posts: pending });
}
