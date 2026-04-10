/**
 * Blog Loader - Merges static blogData with CMS (Google Sheets) posts
 * 
 * Static posts from blogData.ts are always available as a baseline.
 * CMS posts from Google Sheets are layered on top, with CMS versions
 * taking priority when slugs overlap.
 */

import { blogPostIndex } from './blogPostIndex';
import { getBlogPostContent, getAllBlogPostsWithContent } from './blogContent';

interface UnifiedBlogPost {
  id: string | number;
  slug: string;
  title: string;
  date: string;
  author: string;
  image: string;
  keywords: string | string[];
  excerpt: string;
  content: string;
  published?: boolean;
}

/**
 * Get all published blog posts, merging static + CMS sources.
 * CMS posts override static posts with the same slug.
 */
export async function getAllBlogPosts(): Promise<UnifiedBlogPost[]> {
  // Start with static posts
  const postsBySlug = new Map<string, UnifiedBlogPost>();

  const staticPosts = getAllBlogPostsWithContent();
  for (const post of staticPosts) {
    postsBySlug.set(post.slug, { ...post, published: true });
  }

  // Try to load CMS posts from Google Sheets
  try {
    const { cmsSheetsService } = await import('./cms-sheets-service');
    const cmsPosts = await cmsSheetsService.getBlogPosts();

    for (const cmsPost of cmsPosts) {
      if (cmsPost.published && cmsPost.slug) {
        postsBySlug.set(cmsPost.slug, cmsPost);
      }
    }
  } catch (error) {
    // CMS unavailable — fall back to static posts only
    console.warn('CMS blog posts unavailable, using static data:', error instanceof Error ? error.message : error);
  }

  // Convert to array and sort by date descending
  const allPosts = Array.from(postsBySlug.values());
  allPosts.sort((a, b) => {
    const dateA = new Date(a.date).getTime() || 0;
    const dateB = new Date(b.date).getTime() || 0;
    return dateB - dateA;
  });

  return allPosts;
}

/**
 * Get a single blog post by slug (CMS first, then static fallback).
 */
export async function getBlogPostBySlug(slug: string): Promise<UnifiedBlogPost | null> {
  // Try CMS first
  try {
    const { cmsSheetsService } = await import('./cms-sheets-service');
    const cmsPost = await cmsSheetsService.getBlogPostBySlug(slug);
    if (cmsPost && cmsPost.published) return cmsPost;
  } catch {
    // CMS unavailable
  }

  // Fall back to static
  const staticPost = getBlogPostContent(slug);
  return staticPost ? { ...staticPost, published: true } : null;
}
