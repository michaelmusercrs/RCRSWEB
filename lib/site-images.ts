/**
 * Site-wide image lookup. Every public-facing image goes through here.
 *
 * Usage:
 *   const img = getImage('city-decatur-hero');
 *   <img src={img.url} alt={img.alt} width={img.widthPx} height={img.heightPx} />
 *
 * With fallback chain:
 *   const img = getImageWithFallback(
 *     `city-${slug}-hero`,
 *     'city-default-hero',
 *     'site-hero-default',
 *   );
 *
 * For social-preview images (OG):
 *   const og = getOgImage('/blog/gutter-cleaning-tips', 'blog-gutter-cleaning-tips-cover');
 *
 * Reads from the Site_Images sheet via a 60s in-memory cache. Invalidate
 * after an admin approval flip so the new image takes effect immediately.
 */
import { googleSheetsService, type SiteImageRecord } from './google-sheets-service';

export interface SiteImage {
  key: string;
  url: string;
  alt: string;
  caption: string;
  aspectRatio: string;
  widthPx: number;
  heightPx: number;
  category: string;
  subcategory: string;
}

const CACHE_TTL_MS = 60_000;
let _cache: SiteImageRecord[] | null = null;
let _cacheLoadedAt = 0;

function recordToImage(r: SiteImageRecord): SiteImage {
  return {
    key: r.key,
    url: r.url,
    alt: r.alt,
    caption: r.caption,
    aspectRatio: r.aspectRatio,
    widthPx: parseInt(r.widthPx, 10) || 0,
    heightPx: parseInt(r.heightPx, 10) || 0,
    category: r.category,
    subcategory: r.subcategory,
  };
}

async function loadCache(): Promise<SiteImageRecord[]> {
  if (_cache && Date.now() - _cacheLoadedAt < CACHE_TTL_MS) return _cache;
  try {
    _cache = await googleSheetsService.getSiteImages({ approvedOnly: true });
    _cacheLoadedAt = Date.now();
    return _cache;
  } catch (err) {
    console.warn('[site-images] cache load failed:', err);
    return _cache || [];
  }
}

export function invalidateSiteImagesCache(): void {
  _cache = null;
  _cacheLoadedAt = 0;
}

/**
 * Get one image by key. Returns null if not found OR not approved.
 * Use getImageWithFallback() when you want a defensive fallback chain.
 */
export async function getImage(key: string): Promise<SiteImage | null> {
  const all = await loadCache();
  const found = all.find(r => r.key === key);
  if (!found) return null;
  return recordToImage(found);
}

/**
 * Get the first available image from a list of candidate keys.
 *
 *   getImageWithFallback('city-decatur-hero', 'city-default-hero', 'site-hero-default')
 *
 * Returns null only if NONE of the keys resolved to an approved image.
 */
export async function getImageWithFallback(...keys: string[]): Promise<SiteImage | null> {
  const all = await loadCache();
  for (const key of keys) {
    const found = all.find(r => r.key === key);
    if (found) return recordToImage(found);
  }
  return null;
}

/**
 * Get the OG image for a page. Tries page-specific first, then category
 * default, then site default. This is the helper that solves the
 * "zero per-page OG images" finding from the inventory.
 *
 * Examples:
 *   getOgImage('/blog/gutter-cleaning-tips', 'blog-gutter-cleaning-tips-cover')
 *     → blog-gutter-cleaning-tips-cover → og-blog-default → og-site-default
 *
 *   getOgImage('/service-areas/decatur', 'city-decatur-hero')
 *     → city-decatur-hero → og-city-default → og-site-default
 */
export async function getOgImage(pagePath: string, contextKey?: string): Promise<SiteImage | null> {
  const candidates: string[] = [];
  if (contextKey) candidates.push(contextKey);

  // Path-based category inference
  if (pagePath.startsWith('/blog/')) candidates.push('og-blog-default');
  else if (pagePath.startsWith('/service-areas/') || pagePath.startsWith('/roofing-contractor/')) candidates.push('og-city-default');
  else if (pagePath.startsWith('/services/')) candidates.push('og-service-default');
  else if (pagePath.startsWith('/team')) candidates.push('og-team-default');

  candidates.push('og-site-default');
  return getImageWithFallback(...candidates);
}

/**
 * SYNCHRONOUS variant — for non-async contexts (e.g. Next.js metadata).
 * Reads from the IN-MEMORY cache only; returns null if cache hasn't been
 * primed yet. Call primeSiteImagesCache() once at startup if you need
 * synchronous lookups during SSR metadata generation.
 */
export function getImageSync(key: string): SiteImage | null {
  if (!_cache) return null;
  const found = _cache.find(r => r.key === key);
  return found ? recordToImage(found) : null;
}

/**
 * Force-load the cache. Call from any hot path (or from a startup
 * hook) where you'd rather take the sheet-read hit up front.
 */
export async function primeSiteImagesCache(): Promise<void> {
  await loadCache();
}

/**
 * For migration scripts and admin tools — fetches the FULL registry
 * regardless of approval status.
 */
export async function getAllSiteImagesRaw(options?: { category?: string; subcategory?: string }): Promise<SiteImageRecord[]> {
  return googleSheetsService.getSiteImages(options);
}

/**
 * Convenience: all image rows in a single category, approved only.
 */
export async function getImagesByCategory(category: string): Promise<SiteImage[]> {
  const all = await loadCache();
  return all.filter(r => r.category === category).map(recordToImage);
}
