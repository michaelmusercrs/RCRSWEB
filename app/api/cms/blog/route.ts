import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { cmsSheetsService } from '@/lib/cms-sheets-service';
import { cache, CACHE_TTL } from '@/lib/cache';

const BLOG_TTL = 30 * 60 * 1000; // 30 minutes

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    const blogCacheHeaders = {
      'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
    };

    if (slug) {
      const cacheKey = `cms:blog:${slug}`;
      const cached = cache.get(cacheKey);
      if (cached) return NextResponse.json(cached, { headers: blogCacheHeaders });

      const post = await cmsSheetsService.getBlogPostBySlug(slug);
      if (!post) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }
      cache.set(cacheKey, post, BLOG_TTL);
      return NextResponse.json(post, { headers: blogCacheHeaders });
    }

    const cacheKey = 'cms:blog:all';
    const cached = cache.get(cacheKey);
    if (cached) return NextResponse.json(cached, { headers: blogCacheHeaders });

    const posts = await cmsSheetsService.getBlogPosts();
    cache.set(cacheKey, posts, BLOG_TTL);
    return NextResponse.json(posts, { headers: blogCacheHeaders });
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    return NextResponse.json({ error: 'Failed to fetch blog posts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const data = await request.json();

    // ── Validation Rules ──

    // 1. Title is required
    if (!data.title || data.title.trim().length < 10) {
      return NextResponse.json(
        { error: 'Title must be at least 10 characters long' },
        { status: 400 }
      );
    }

    // 2. Content minimum character count (500 chars for quality)
    if (!data.content || data.content.trim().length < 500) {
      return NextResponse.json(
        { error: `Content must be at least 500 characters. Currently: ${(data.content || '').trim().length}` },
        { status: 400 }
      );
    }

    // 3. Excerpt is required (min 50 chars)
    if (!data.excerpt || data.excerpt.trim().length < 50) {
      return NextResponse.json(
        { error: 'Excerpt must be at least 50 characters for SEO' },
        { status: 400 }
      );
    }

    // 4. Max 1 post per week per author (only for published posts)
    if (data.published !== false) {
      const existingPosts = await cmsSheetsService.getBlogPosts();
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const recentByAuthor = existingPosts.filter(p => {
        if (p.author !== data.author) return false;
        // Parse date like "February 14, 2026"
        const postDate = new Date(p.date);
        return !isNaN(postDate.getTime()) && postDate >= oneWeekAgo;
      });

      if (recentByAuthor.length > 0) {
        return NextResponse.json(
          { error: `${data.author} already published a post this week (${recentByAuthor[0].title}). Max 1 per week per author.` },
          { status: 400 }
        );
      }

      // 5. Friday publishing rule — posts can only go live on Fridays
      const today = new Date();
      if (today.getDay() !== 5) {
        // Allow saving as draft on non-Fridays
        return NextResponse.json(
          { error: 'Blog posts can only be published on Fridays. Save as a draft (set published=false) and publish on Friday.' },
          { status: 400 }
        );
      }
    }

    // Generate slug from title if not provided
    if (!data.slug) {
      data.slug = data.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    const post = await cmsSheetsService.createBlogPost({
      slug: data.slug,
      title: data.title,
      date: data.date || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      author: data.author || 'Chris Muse',
      image: data.image || '',
      keywords: data.keywords || '',
      excerpt: data.excerpt || '',
      content: data.content || '',
      published: data.published !== false,
    });

    cache.invalidatePattern('^cms:blog:');
    return NextResponse.json(post);
  } catch (error) {
    console.error('Error creating blog post:', error);
    return NextResponse.json({ error: 'Failed to create blog post' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const data = await request.json();
    const { slug, ...updates } = data;

    if (!slug) {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
    }

    const post = await cmsSheetsService.updateBlogPost(slug, updates);

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    cache.invalidatePattern('^cms:blog:');
    return NextResponse.json(post);
  } catch (error) {
    console.error('Error updating blog post:', error);
    return NextResponse.json({ error: 'Failed to update blog post' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (!slug) {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
    }

    const success = await cmsSheetsService.deleteBlogPost(slug);

    if (!success) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    cache.invalidatePattern('^cms:blog:');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting blog post:', error);
    return NextResponse.json({ error: 'Failed to delete blog post' }, { status: 500 });
  }
}
