/**
 * DEPRECATED: This file is a backward-compatibility shim.
 *
 * Blog data has been split for performance:
 *   - blogPostIndex.ts  (~47KB)  Metadata only (titles, slugs, dates, excerpts)
 *   - blogContent.ts    (~468KB) Full post content keyed by slug
 *
 * Prefer importing from those files directly:
 *   import { blogPostIndex } from '@/lib/blogPostIndex';       // for listings, sitemaps
 *   import { getBlogPostContent } from '@/lib/blogContent';    // for individual post pages
 *
 * This shim re-exports `blogPosts` (full posts with content) so that any
 * remaining import of `blogData` still compiles, but new code should NOT use it.
 */

export type { BlogPost, BlogPostMeta, BlogMetadata } from './blogPostIndex';
export { blogMetadata } from './blogPostIndex';
export { getAllBlogPostsWithContent as _getAllFull } from './blogContent';

import { getAllBlogPostsWithContent } from './blogContent';

/** @deprecated Use blogPostIndex for metadata or getBlogPostContent() for a single post */
export const blogPosts = getAllBlogPostsWithContent();

/** @deprecated Use getBlogPostMeta() or getBlogPostContent() */
export function getBlogPost(slug: string) {
  return blogPosts.find(post => post.slug === slug);
}

/** @deprecated Use getAllBlogSlugs() from blogPostIndex */
export function getAllBlogSlugs(): string[] {
  return blogPosts.map(post => post.slug);
}

/** @deprecated Use getRecentPostsMeta() from blogPostIndex */
export function getRecentPosts(count: number = 5) {
  return [...blogPosts].reverse().slice(0, count);
}

/** @deprecated Use getPostsByAuthorMeta() from blogPostIndex */
export function getPostsByAuthor(author: string) {
  return blogPosts.filter(post => post.author === author);
}
