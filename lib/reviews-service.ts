/**
 * Reviews Service
 * Pulls reviews from Google Sheets (Reviews tab) as the source of truth.
 * Falls back to hardcoded reviewsData.ts if Sheets unavailable.
 */

import { googleSheetsService, isGoogleSheetsConfigured } from './google-sheets-service';
import { generalReviews, reviewsByRep, type Review } from './reviewsData';

let cachedReviews: Review[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function sheetRowToReview(row: Record<string, string>): Review {
  return {
    id: row.id || '',
    name: row.name || '',
    date: row.date || '',
    rating: parseInt(row.rating) || 5,
    text: row.text || '',
    salesRep: row.salesRep || undefined,
    source: row.source || 'Google',
  };
}

async function getAllReviewsFromSheets(): Promise<Review[] | null> {
  if (!isGoogleSheetsConfigured()) return null;

  try {
    const rows = await googleSheetsService.getReviews({ approvedOnly: true });
    if (rows.length === 0) return null; // Empty sheet = fall back to hardcoded
    return rows
      .filter(r => r.visible === 'true' || r.visible === 'TRUE')
      .map(sheetRowToReview);
  } catch {
    return null;
  }
}

/**
 * Get all reviews, preferring Google Sheets, falling back to hardcoded.
 */
export async function getAllReviews(): Promise<Review[]> {
  // Check cache
  if (cachedReviews && Date.now() - cacheTime < CACHE_TTL) {
    return cachedReviews;
  }

  // Try sheets first
  const sheetReviews = await getAllReviewsFromSheets();
  if (sheetReviews && sheetReviews.length > 0) {
    cachedReviews = sheetReviews;
    cacheTime = Date.now();
    return sheetReviews;
  }

  // Fall back to hardcoded
  const allHardcoded: Review[] = [
    ...generalReviews,
    ...Object.values(reviewsByRep).flat(),
  ];
  cachedReviews = allHardcoded;
  cacheTime = Date.now();
  return allHardcoded;
}

/**
 * Get reviews for a specific rep.
 */
export async function getReviewsForRepAsync(repSlug: string, count: number = 3): Promise<Review[]> {
  const all = await getAllReviews();
  const repReviews = all.filter(r => {
    // Match by repSlug from sheet data or by salesRep name from hardcoded
    const row = r as any;
    if (row.repSlug) return row.repSlug === repSlug;
    // Fallback: check the reviewsByRep mapping
    return (reviewsByRep[repSlug] || []).some(hr => hr.id === r.id);
  });

  if (repReviews.length >= count) return repReviews.slice(0, count);

  // Fill with general reviews
  const general = all.filter(r => !r.salesRep);
  const needed = count - repReviews.length;
  return [...repReviews, ...general.slice(0, needed)];
}

/**
 * Get featured reviews for home page.
 */
export async function getFeaturedReviewsAsync(count: number = 6): Promise<Review[]> {
  const all = await getAllReviews();

  // Prefer reviews marked as featured (from sheet), then rep-specific, then general
  const featured = all.filter((r: any) => r.featured === true || r.featured === 'true');
  if (featured.length >= count) return featured.slice(0, count);

  // Get one per rep for variety
  const repSlugs = ['aaron', 'brendon', 'chris-muse', 'hunter', 'michael-muse', 'greg'];
  const byRep: Review[] = [];
  for (const slug of repSlugs) {
    const repReview = all.find(r => {
      const row = r as any;
      return row.repSlug === slug || (reviewsByRep[slug] || []).some(hr => hr.id === r.id);
    });
    if (repReview && !featured.some(f => f.id === repReview.id)) {
      byRep.push(repReview);
    }
  }

  const combined = [...featured, ...byRep];
  if (combined.length >= count) return combined.slice(0, count);

  // Fill remaining
  const remaining = all.filter(r => !combined.some(c => c.id === r.id));
  return [...combined, ...remaining].slice(0, count);
}
