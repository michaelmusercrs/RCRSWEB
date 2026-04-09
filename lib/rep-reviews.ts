/**
 * Per-rep review aggregation.
 *
 * Loads the master review JSON and computes per-rep stats:
 *   - total reviews
 *   - 5-star count, average
 *   - last review date
 *   - days since last review
 *   - reviews in last 30 / 90 days
 *
 * Used by the leaderboard, team profile pages, and the rep accountability widget.
 */

import type { Review } from './reviewsData';

// Statically import the master JSON. Next.js bundles it at build time so the
// data is available without filesystem reads at request time.
import master from '../data/reviews-master.json';

interface MasterReviewRow {
  id: string;
  name: string;
  date: string;
  rating: number;
  text: string;
  salesRep: string;
  repSlug: string;
  source: string;
}

interface MasterPayload {
  generated: string;
  count: number;
  fiveStarCount: number;
  averageRating: number;
  reviews: MasterReviewRow[];
}

const PAYLOAD = master as MasterPayload;

/**
 * Raw master review rows including the canonical repSlug. Use this when you need
 * to filter or aggregate by rep slug — getMasterReviews() drops the slug to match
 * the public Review type used by the /reviews page.
 */
export function getMasterReviewsRaw(): MasterReviewRow[] {
  return PAYLOAD.reviews;
}

/** All reviews from the master JSON, normalized to the Review shape. */
export function getMasterReviews(): Review[] {
  return PAYLOAD.reviews.map((r) => ({
    id: r.id,
    name: r.name,
    date: r.date,
    rating: r.rating,
    text: r.text,
    salesRep: r.salesRep || undefined,
    source: r.source || 'Google',
  }));
}

/** Aggregate stats across the entire master set. */
export function getMasterStats() {
  return {
    total: PAYLOAD.count,
    fiveStar: PAYLOAD.fiveStarCount,
    averageRating: PAYLOAD.averageRating,
    generated: PAYLOAD.generated,
  };
}

export interface RepReviewStats {
  /** Canonical rep slug (matches TEAM_MEMBERS slug). */
  slug: string;
  /** Display name. */
  name: string;
  /** Total reviews mentioning this rep. */
  total: number;
  /** Number of 5-star reviews. */
  fiveStar: number;
  /** Average rating across all this rep's reviews. */
  averageRating: number;
  /** ISO date of the most recent review (YYYY-MM-DD), or null if none. */
  lastReviewDate: string | null;
  /** Days since last review, or null. */
  daysSinceLastReview: number | null;
  /** Reviews in the last 30 days. */
  last30Days: number;
  /** Reviews in the last 90 days. */
  last90Days: number;
  /** Reviews in the last 365 days. */
  last365Days: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysAgo(dateStr: string, now: number): number {
  const d = new Date(dateStr).getTime();
  if (Number.isNaN(d)) return Infinity;
  return Math.floor((now - d) / MS_PER_DAY);
}

/** Compute stats for one rep slug. */
export function getRepReviewStats(slug: string): RepReviewStats {
  const all = PAYLOAD.reviews.filter((r) => r.repSlug === slug);
  if (all.length === 0) {
    return {
      slug,
      name: '',
      total: 0,
      fiveStar: 0,
      averageRating: 0,
      lastReviewDate: null,
      daysSinceLastReview: null,
      last30Days: 0,
      last90Days: 0,
      last365Days: 0,
    };
  }

  const now = Date.now();
  const sorted = [...all].sort((a, b) => b.date.localeCompare(a.date));
  const lastDate = sorted[0].date;
  const daysSince = daysAgo(lastDate, now);

  return {
    slug,
    name: sorted[0].salesRep || slug,
    total: all.length,
    fiveStar: all.filter((r) => r.rating === 5).length,
    averageRating: Number((all.reduce((s, r) => s + r.rating, 0) / all.length).toFixed(2)),
    lastReviewDate: lastDate,
    daysSinceLastReview: daysSince,
    last30Days: all.filter((r) => daysAgo(r.date, now) <= 30).length,
    last90Days: all.filter((r) => daysAgo(r.date, now) <= 90).length,
    last365Days: all.filter((r) => daysAgo(r.date, now) <= 365).length,
  };
}

/** Get all reviews for a specific rep, newest first. */
export function getReviewsForRep(slug: string): Review[] {
  return PAYLOAD.reviews
    .filter((r) => r.repSlug === slug)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((r) => ({
      id: r.id,
      name: r.name,
      date: r.date,
      rating: r.rating,
      text: r.text,
      salesRep: r.salesRep || undefined,
      source: r.source || 'Google',
    }));
}

/**
 * Compute stats for many reps in one pass. Returns sorted by total desc.
 * Pass an array of {slug, name} to ensure reps with zero reviews still appear.
 */
export function getAllRepStats(reps: Array<{ slug: string; name: string }>): RepReviewStats[] {
  return reps
    .map((r) => {
      const stats = getRepReviewStats(r.slug);
      // Use the team-member display name when the rep has no reviews yet
      if (!stats.name) stats.name = r.name;
      return stats;
    })
    .sort((a, b) => b.total - a.total);
}

/**
 * Reps who haven't received a review in over `daysThreshold` days.
 * Used by the accountability widget — flags reps that need a review request push.
 */
export function getRepsNeedingReviews(
  reps: Array<{ slug: string; name: string }>,
  daysThreshold = 90,
): RepReviewStats[] {
  return getAllRepStats(reps).filter(
    (s) => s.daysSinceLastReview === null || s.daysSinceLastReview > daysThreshold,
  );
}
