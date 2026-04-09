/**
 * Server-side review loader.
 *
 * Single source of truth for "all reviews currently visible on the site."
 * Order of preference:
 *   1. Reviews tab on the master Google Sheet (200+ rows the user added)
 *   2. Hardcoded reviewsData.ts as a fallback so the page never empties out
 *      if Sheets is unreachable in dev or during a sheet outage.
 *
 * Cached for 5 minutes per ISR-friendly request to avoid hammering Sheets
 * on every page load. Use `forceFresh: true` from a revalidate handler if
 * you need to bust the cache.
 */

import { googleSheetsService } from './google-sheets-service';
import { generalReviews, reviewsByRep, type Review } from './reviewsData';
import { getMasterReviews } from './rep-reviews';

const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedAt = 0;
let cachedReviews: Review[] | null = null;

/**
 * Baseline review set used when the Google Sheet has fewer rows than we already
 * have on disk. The master JSON (data/reviews-master.json, 317 reviews built
 * from RCRS/data CSV exports) is the new ground truth — we used to fall back to
 * a tiny 25-row hardcoded list which would silently downgrade the page.
 */
function getHardcodedReviews(): Review[] {
  const master = getMasterReviews();
  if (master.length > 0) return master;
  // Last-resort fallback if master JSON is missing for any reason
  const all: Review[] = [...generalReviews];
  for (const slug of Object.keys(reviewsByRep)) {
    all.push(...reviewsByRep[slug]);
  }
  return all;
}

function normalizeSheetReview(raw: Record<string, string>, idx: number): Review | null {
  const text = (raw.text || '').trim();
  if (!text) return null; // skip blank rows

  // Rating: accept "5", "5.0", "5 stars", default to 5 if missing/blank
  let rating = 5;
  if (raw.rating) {
    const parsed = parseFloat(raw.rating);
    if (Number.isFinite(parsed) && parsed > 0) {
      rating = Math.round(parsed);
    }
  }

  // Date: accept ISO, MM/DD/YYYY, "Mar 2024", or empty (default to Jan 1 2024 for sort stability)
  let date = raw.date || '';
  if (date) {
    const d = new Date(date);
    if (!Number.isNaN(d.getTime())) {
      date = d.toISOString().slice(0, 10);
    }
  }
  if (!date) date = '2024-01-01';

  return {
    id: raw.id || `sheet-${idx}`,
    name: (raw.name || 'Anonymous').trim(),
    date,
    rating,
    text,
    salesRep: raw.salesRep || undefined,
    source: raw.source || 'Google',
  };
}

export interface ReviewLoadResult {
  reviews: Review[];
  source: 'sheet' | 'hardcoded' | 'merged';
  count: number;
}

/**
 * Load all reviews. Always returns at least the hardcoded set so callers
 * never have to handle an empty result.
 */
export async function loadAllReviews(opts?: { forceFresh?: boolean }): Promise<ReviewLoadResult> {
  // Cache check
  if (!opts?.forceFresh && cachedReviews && Date.now() - cachedAt < CACHE_TTL_MS) {
    return {
      reviews: cachedReviews,
      source: cachedReviews.length > getHardcodedReviews().length ? 'sheet' : 'hardcoded',
      count: cachedReviews.length,
    };
  }

  const hardcoded = getHardcodedReviews();
  let sheetReviews: Review[] = [];

  try {
    // NOTE: we deliberately don't pass `approvedOnly: true` here. The user has
    // 200+ rows in the sheet and most don't have the `approved` column filled
    // in (it's blank). Filtering would drop them. Instead we include
    // everything unless it's explicitly marked rejected (visible=false or
    // approved=false). Blank/missing values are treated as visible.
    const raw = await googleSheetsService.getReviews();
    sheetReviews = raw
      .filter((row) => {
        const visible = (row.visible || '').toLowerCase().trim();
        const approved = (row.approved || '').toLowerCase().trim();
        // Excluded only when explicitly false
        if (visible === 'false' || visible === 'no' || visible === '0') return false;
        if (approved === 'false' || approved === 'no' || approved === '0') return false;
        return true;
      })
      .map((row, idx) => normalizeSheetReview(row, idx))
      .filter((r): r is Review => r !== null);
  } catch (err) {
    console.warn('[reviews-loader] sheet fetch failed, using hardcoded:', err);
  }

  // If the sheet has more reviews than our hardcoded set, use it.
  // Otherwise fall back so we never regress to an empty page during a sheet outage.
  let chosen: Review[];
  let source: ReviewLoadResult['source'];
  if (sheetReviews.length >= hardcoded.length) {
    chosen = sheetReviews;
    source = 'sheet';
  } else if (sheetReviews.length === 0) {
    chosen = hardcoded;
    source = 'hardcoded';
  } else {
    // Merge: dedupe by name+date, prefer sheet rows since they're newest
    const seen = new Set<string>();
    chosen = [];
    for (const r of [...sheetReviews, ...hardcoded]) {
      const key = `${r.name.toLowerCase()}|${r.date}`;
      if (seen.has(key)) continue;
      seen.add(key);
      chosen.push(r);
    }
    source = 'merged';
  }

  // Sort newest first for display
  chosen.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  cachedReviews = chosen;
  cachedAt = Date.now();

  return { reviews: chosen, source, count: chosen.length };
}

/**
 * Featured reviews for the homepage strip — picks `count` highest-rated,
 * most-recent reviews. Falls back to the hardcoded featured set if Sheets
 * is empty.
 */
export async function loadFeaturedReviews(count = 6): Promise<Review[]> {
  const { reviews } = await loadAllReviews();
  if (reviews.length === 0) return [];

  // Prefer 5-star reviews, then by date desc (already sorted)
  const fiveStar = reviews.filter((r) => r.rating === 5);
  const pool = fiveStar.length >= count ? fiveStar : reviews;
  return pool.slice(0, count);
}
