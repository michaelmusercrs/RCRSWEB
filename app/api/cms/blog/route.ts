import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { cmsSheetsService } from '@/lib/cms-sheets-service';
import { cache, CACHE_TTL } from '@/lib/cache';

const BLOG_TTL = 30 * 60 * 1000; // 30 minutes

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    if (slug) {
      const cacheKey = `cms:blog:${slug}`;
      const cached = cache.get(cacheKey);
      if (cached) return NextResponse.json(cached);

      const post = await cmsSheetsService.getBlogPostBySlug(slug);
      if (!post) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }
      cache.set(cacheKey, post, BLOG_TTL);
      return NextResponse.json(post);
    }

    const cacheKey = 'cms:blog:all';
    const cached = cache.get(cacheKey);
    if (cached) return NextResponse.json(cached);

    const posts = await cmsSheetsService.getBlogPosts();
    cache.set(cacheKey, posts, BLOG_TTL);
    return NextResponse.json(posts);
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
