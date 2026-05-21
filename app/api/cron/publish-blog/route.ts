import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/api-response';
import { readBlogPosts, upsertBlogPost, type BlogPost } from '@/lib/blog-posts-store';
import { withCronLock } from '@/lib/cron-lock';

// Reads request-time auth header; must not be prerendered.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Reads + rewrites two Sheets tabs (Blog_Posts + public blog-posts mirror)
// per approved post; per-row Sheets writes easily exceed the 60s default.
export const maxDuration = 300;

// GET /api/cron/publish-blog — Auto-publish approved posts on their scheduled day.
//
// Flow (rep-authored blog pipeline):
//   1. Rep writes post in /portal/blog → stored in `Blog_Posts` sheet (status=draft)
//   2. Rep submits for review → status=review
//   3. Admin approves in /portal/blog → status=approved, publishDate=next Friday
//   4. THIS CRON (daily 06:00 UTC) flips approved+due posts to status=published
//      AND mirrors them into the public-facing `blog-posts` sheet so the
//      /blog page (which reads via cmsSheetsService) actually shows them.
//
// FIX (2026-05-20): Previously the cron only flipped status in Blog_Posts.
// The public site reads from the separate `blog-posts` tab via cmsSheetsService,
// so published rep posts never appeared on the live site. Now we mirror them.
export async function GET(request: NextRequest) {
  // Optional: verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return apiError('Unauthorized', 401);
  }

  return withCronLock('publish-blog', { staleMinutes: 30 }, async () => {
  const _hbStart = Date.now();
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const posts = await readBlogPosts();
    const published: string[] = [];
    const mirrorErrors: Array<{ id: string; error: string }> = [];

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

        // Mirror to public `blog-posts` tab so /blog actually renders it.
        // Wrapped in try so a CMS failure doesn't block the status flip.
        try {
          await mirrorToPublicBlog(post);
        } catch (err) {
          mirrorErrors.push({
            id: post.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }

        published.push(post.id);
      }
    }

    const { recordCronHeartbeat } = await import('@/lib/cron-heartbeat');
    await recordCronHeartbeat(
      'publish-blog',
      mirrorErrors.length ? 'error' : 'success',
      Date.now() - _hbStart,
      `${published.length} published${mirrorErrors.length ? `, ${mirrorErrors.length} mirror failures` : ''}`,
    );

    return NextResponse.json({
      success: true,
      publishedCount: published.length,
      publishedIds: published,
      mirrorErrors,
      checkedDate: today,
    });
  } catch (error) {
    try {
      const { recordCronHeartbeat } = await import('@/lib/cron-heartbeat');
      await recordCronHeartbeat('publish-blog', 'error', Date.now() - _hbStart, error instanceof Error ? error.message : String(error));
    } catch { /* heartbeat must not mask real error */ }
    throw error;
  }
  });
}

/**
 * Copy a published rep post into the public-facing `blog-posts` sheet so it
 * surfaces on /blog. The two tabs have different schemas; this maps between
 * them. If the slug already exists in `blog-posts`, we update; otherwise
 * create.
 */
async function mirrorToPublicBlog(post: BlogPost): Promise<void> {
  const { cmsSheetsService } = await import('@/lib/cms-sheets-service');

  // Derive a short excerpt from body (first 200 chars, normalized whitespace).
  const excerpt = (post.metaDescription || post.body || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);

  // Pick the first image as the hero. Fall back to a generic blog image if none.
  const image = (post.images && post.images[0]) || '/uploads/blog-roofing-myths.jpg';

  // Pretty-print the publish date like "May 16, 2026" to match existing rows.
  const dateObj = post.publishedAt
    ? new Date(post.publishedAt)
    : (post.publishDate ? new Date(post.publishDate) : new Date());
  const dateStr = dateObj.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Try to update an existing row with this slug first.
  const updated = await cmsSheetsService.updateBlogPost(post.slug, {
    title: post.title,
    date: dateStr,
    author: post.authorName,
    image,
    keywords: '', // rep flow doesn't capture keywords yet
    excerpt,
    content: post.body,
    published: true,
  });

  if (!updated) {
    // No existing row — create one.
    await cmsSheetsService.createBlogPost({
      slug: post.slug,
      title: post.title,
      date: dateStr,
      author: post.authorName,
      image,
      keywords: '',
      excerpt,
      content: post.body,
      published: true,
    });
  }
}
