import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import {
  type BlogPost,
  readBlogPosts,
  upsertBlogPost,
} from '@/lib/blog-posts-store';

function getNextFriday(from?: Date): string {
  const d = from ? new Date(from) : new Date();
  const day = d.getDay();
  const daysUntil = day <= 5 ? 5 - day : 5 + (7 - day);
  d.setDate(d.getDate() + (daysUntil === 0 ? 7 : daysUntil));
  return d.toISOString().split('T')[0];
}

/** Find the next available Friday that respects the 7-day cooldown */
function getNextAvailableFriday(posts: BlogPost[]): { date: string; blocked: boolean; cooldownUntil: string | null } {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  // Check recent publishes AND scheduled posts
  const recentOrScheduled = posts.filter(p => 
    (p.publishedAt && new Date(p.publishedAt) > sevenDaysAgo) ||
    (p.status === 'approved' && p.publishDate)
  );

  // Get the latest publish/schedule date
  let latestDate: Date | null = null;
  for (const p of recentOrScheduled) {
    const d = p.publishedAt ? new Date(p.publishedAt) : (p.publishDate ? new Date(p.publishDate) : null);
    if (d && (!latestDate || d > latestDate)) latestDate = d;
  }

  const nextFri = getNextFriday();

  if (!latestDate) {
    return { date: nextFri, blocked: false, cooldownUntil: null };
  }

  // Must be at least 7 days after the latest
  const cooldownEnd = new Date(latestDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  const cooldownDateStr = cooldownEnd.toISOString().split('T')[0];

  // Find the first Friday on or after cooldown ends
  let targetFriday = new Date(nextFri);
  while (targetFriday < cooldownEnd) {
    targetFriday.setDate(targetFriday.getDate() + 7);
  }

  const isBlocked = targetFriday.toISOString().split('T')[0] !== nextFri;

  return {
    date: targetFriday.toISOString().split('T')[0],
    blocked: isBlocked,
    cooldownUntil: isBlocked ? cooldownDateStr : null,
  };
}

// POST - approve or reject a blog post
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  const { postId, action, rejectionReason } = await request.json();

  if (!postId || !action) {
    return NextResponse.json({ success: false, error: 'postId and action required' }, { status: 400 });
  }

  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ success: false, error: 'Action must be approve or reject' }, { status: 400 });
  }

  if (action === 'reject' && !rejectionReason) {
    return NextResponse.json({ success: false, error: 'Rejection reason required' }, { status: 400 });
  }

  const posts = await readBlogPosts();
  const post = posts.find(p => p.id === postId);

  if (!post) {
    return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
  }

  if (post.status !== 'review') {
    return NextResponse.json({ success: false, error: 'Post must be in review status' }, { status: 400 });
  }

  if (action === 'approve') {
    // Validate content meets all requirements before approving
    const errors: string[] = [];
    if (post.title.length < 30) errors.push('Title must be at least 30 characters');
    if (post.body.length < 1500) errors.push('Body must be at least 1,500 characters');
    if (!post.metaDescription || post.metaDescription.length < 120) errors.push('Meta description must be at least 120 characters');
    if (!post.images || post.images.length < 1) errors.push('At least 1 image is required');
    
    if (errors.length > 0) {
      return NextResponse.json({ 
        success: false, 
        error: `Cannot approve: ${errors[0]}`,
        errors 
      }, { status: 400 });
    }

    // Find next available Friday respecting 7-day cooldown
    const { date, blocked, cooldownUntil } = getNextAvailableFriday(posts);

    post.status = 'approved';
    post.publishDate = date;
    post.rejectionReason = null;

    const message = blocked 
      ? `Approved! Scheduled for ${date} (next available Friday after 7-day cooldown ending ${cooldownUntil}).`
      : `Approved! Scheduled for ${date} (next Friday).`;

    post.updatedAt = new Date().toISOString();
    await upsertBlogPost(post);

    return NextResponse.json({ success: true, post, message });
  } else {
    post.status = 'rejected';
    post.rejectionReason = rejectionReason;
    post.publishDate = null;
    post.updatedAt = new Date().toISOString();
    await upsertBlogPost(post);

    return NextResponse.json({ success: true, post });
  }
}
