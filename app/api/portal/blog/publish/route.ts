import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { readBlogPosts, upsertBlogPost } from '@/lib/blog-posts-store';

// POST - manually publish an approved post (enforces Friday-only + 7-day cooldown)
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  const { postId } = await request.json();

  if (!postId) {
    return NextResponse.json({ success: false, error: 'postId required' }, { status: 400 });
  }

  const posts = await readBlogPosts();
  const post = posts.find(p => p.id === postId);

  if (!post) {
    return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
  }

  if (post.status !== 'approved') {
    return NextResponse.json({ success: false, error: 'Post must be approved before publishing' }, { status: 400 });
  }

  const now = new Date();

  // Enforce Friday-only publishing
  if (now.getDay() !== 5) {
    const daysUntilFri = (5 - now.getDay() + 7) % 7 || 7;
    const nextFri = new Date(now);
    nextFri.setDate(now.getDate() + daysUntilFri);
    return NextResponse.json({
      success: false,
      error: `Posts can only go live on Fridays. Today is ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][now.getDay()]}. The post is scheduled for ${post.publishDate || nextFri.toISOString().split('T')[0]}.`,
      nextFriday: post.publishDate || nextFri.toISOString().split('T')[0],
    }, { status: 400 });
  }

  // Enforce 7-day rolling cooldown
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recentPublished = posts.filter(p => 
    p.id !== post.id && p.publishedAt && new Date(p.publishedAt) > sevenDaysAgo
  );

  if (recentPublished.length > 0) {
    const latest = recentPublished.reduce((a, b) => 
      new Date(a.publishedAt!) > new Date(b.publishedAt!) ? a : b
    );
    const nextEligible = new Date(new Date(latest.publishedAt!).getTime() + 7 * 24 * 60 * 60 * 1000);
    return NextResponse.json({
      success: false,
      error: `Only 1 post per 7 days. Last published on ${latest.publishedAt!.split('T')[0]}. Next eligible: ${nextEligible.toISOString().split('T')[0]}.`,
      nextEligible: nextEligible.toISOString().split('T')[0],
    }, { status: 400 });
  }

  // Publish!
  post.status = 'published';
  post.publishedAt = now.toISOString();
  post.publishDate = now.toISOString().split('T')[0];
  post.updatedAt = now.toISOString();
  await upsertBlogPost(post);

  return NextResponse.json({ success: true, post, message: 'Post published successfully!' });
}
