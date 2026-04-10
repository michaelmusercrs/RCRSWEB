import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/api-response';
import { readBlogPosts, upsertBlogPost } from '@/lib/blog-posts-store';

// GET /api/cron/publish-blog — Auto-publish approved posts on their scheduled Friday
// Should be called by a cron job daily (or on Fridays)
export async function GET(request: NextRequest) {
  // Optional: verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return apiError('Unauthorized', 401);
  }

  const _hbStart = Date.now();
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const posts = await readBlogPosts();
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
        await upsertBlogPost(post);
        published.push(post.id);
      }
    }

    const { recordCronHeartbeat } = await import('@/lib/cron-heartbeat');
    await recordCronHeartbeat('publish-blog', 'success', Date.now() - _hbStart, `${published.length} published`);

    return NextResponse.json({
      success: true,
      publishedCount: published.length,
      publishedIds: published,
      checkedDate: today,
    });
  } catch (error) {
    try {
      const { recordCronHeartbeat } = await import('@/lib/cron-heartbeat');
      await recordCronHeartbeat('publish-blog', 'error', Date.now() - _hbStart, error instanceof Error ? error.message : String(error));
    } catch { /* heartbeat must not mask real error */ }
    throw error;
  }
}
