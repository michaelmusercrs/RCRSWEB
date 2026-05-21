/**
 * Reviews-quality analysis. Cross-references data/reviews-master.json
 * (Google reviews with attributed sales rep) against the deep-funnel
 * close rate per rep to surface the reps with great close AND great
 * reviews, vs the ones missing one side.
 *
 * Cheap (no JN calls) — reads from the static JSON file shipped with the repo.
 */
import { promises as fs } from 'fs';
import path from 'path';

interface RawReview {
  id: string;
  name: string;
  date: string;
  rating: number;
  text: string;
  salesRep?: string;
  repSlug?: string;
  source?: string;
}

interface RawReviewsFile {
  generated: string;
  count: number;
  fiveStarCount: number;
  averageRating: number;
  reviews: RawReview[];
}

export interface RepReviewRow {
  rep: string;
  reviewCount: number;
  avgRating: number;
  fiveStarCount: number;
  fiveStarPct: number;
  fourPlus: number;
  threeOrLower: number;
  earliestReview: string;
  latestReview: string;
  daysSinceLatest: number;
  isActive: boolean; // true if not labeled "(former)"
  recent12mo: number;
  recent24mo: number;
}

export interface ReviewsQuality {
  generatedAt: string;
  source: string;
  totals: {
    reviews: number;
    averageRating: number;
    fiveStarCount: number;
    fiveStarPct: number;
    attributedCount: number;
    unattributedCount: number;
    distinctReps: number;
    recent12mo: number;
    recent24mo: number;
    earliest: string;
    latest: string;
  };
  byRep: RepReviewRow[];
  byYear: Array<{ year: string; count: number; avgRating: number; fiveStarPct: number }>;
  bySource: Array<{ source: string; count: number; avgRating: number }>;
  lowReviews: Array<{ id: string; rep: string; name: string; date: string; rating: number; text: string }>;
}

export async function getReviewsQuality(): Promise<ReviewsQuality> {
  const filePath = path.join(process.cwd(), 'data', 'reviews-master.json');
  const raw: RawReviewsFile = JSON.parse(await fs.readFile(filePath, 'utf8'));
  const reviews = raw.reviews || [];
  const today = new Date();
  const cutoff12 = new Date(today); cutoff12.setMonth(cutoff12.getMonth() - 12);
  const cutoff24 = new Date(today); cutoff24.setMonth(cutoff24.getMonth() - 24);

  const repMap = new Map<string, RawReview[]>();
  for (const r of reviews) {
    const key = (r.salesRep || '(unattributed)').trim() || '(unattributed)';
    if (!repMap.has(key)) repMap.set(key, []);
    repMap.get(key)!.push(r);
  }

  const byRep: RepReviewRow[] = Array.from(repMap.entries()).map(([rep, rs]) => {
    const dates = rs.map(r => r.date).filter(Boolean).sort();
    const latest = dates[dates.length - 1] || '';
    const earliest = dates[0] || '';
    const fiveStar = rs.filter(r => r.rating === 5).length;
    const fourPlus = rs.filter(r => r.rating >= 4).length;
    const threeOrLower = rs.filter(r => r.rating <= 3).length;
    const avg = rs.reduce((s, r) => s + (r.rating || 0), 0) / rs.length;
    const latestDate = latest ? new Date(latest) : null;
    const daysSinceLatest = latestDate ? Math.floor((today.getTime() - latestDate.getTime()) / 86400000) : 99999;
    return {
      rep,
      reviewCount: rs.length,
      avgRating: Math.round(avg * 100) / 100,
      fiveStarCount: fiveStar,
      fiveStarPct: Math.round((fiveStar / rs.length) * 1000) / 10,
      fourPlus,
      threeOrLower,
      earliestReview: earliest,
      latestReview: latest,
      daysSinceLatest,
      isActive: !/former|inactive/i.test(rep) && rep !== '(unattributed)',
      recent12mo: rs.filter(r => r.date && new Date(r.date) >= cutoff12).length,
      recent24mo: rs.filter(r => r.date && new Date(r.date) >= cutoff24).length,
    };
  }).sort((a, b) => b.reviewCount - a.reviewCount);

  // By year
  const yearMap = new Map<string, RawReview[]>();
  for (const r of reviews) {
    const y = (r.date || '').slice(0, 4) || 'unknown';
    if (!yearMap.has(y)) yearMap.set(y, []);
    yearMap.get(y)!.push(r);
  }
  const byYear = Array.from(yearMap.entries())
    .filter(([y]) => y !== 'unknown')
    .map(([year, rs]) => ({
      year,
      count: rs.length,
      avgRating: Math.round((rs.reduce((s, r) => s + (r.rating || 0), 0) / rs.length) * 100) / 100,
      fiveStarPct: Math.round((rs.filter(r => r.rating === 5).length / rs.length) * 1000) / 10,
    }))
    .sort((a, b) => a.year.localeCompare(b.year));

  // By source
  const sourceMap = new Map<string, RawReview[]>();
  for (const r of reviews) {
    const s = (r.source || 'Unknown').trim();
    if (!sourceMap.has(s)) sourceMap.set(s, []);
    sourceMap.get(s)!.push(r);
  }
  const bySource = Array.from(sourceMap.entries()).map(([source, rs]) => ({
    source,
    count: rs.length,
    avgRating: Math.round((rs.reduce((s, r) => s + (r.rating || 0), 0) / rs.length) * 100) / 100,
  })).sort((a, b) => b.count - a.count);

  // Low-rating reviews (3 stars or below) — every one is worth reading
  const lowReviews = reviews
    .filter(r => r.rating <= 3)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .map(r => ({
      id: r.id,
      rep: r.salesRep || '(unattributed)',
      name: r.name,
      date: r.date,
      rating: r.rating,
      text: r.text || '',
    }));

  const allDates = reviews.map(r => r.date).filter(Boolean).sort();
  const attributed = reviews.filter(r => r.salesRep && r.salesRep.trim()).length;

  return {
    generatedAt: new Date().toISOString().slice(0, 10),
    source: 'data/reviews-master.json',
    totals: {
      reviews: reviews.length,
      averageRating: raw.averageRating,
      fiveStarCount: raw.fiveStarCount,
      fiveStarPct: reviews.length > 0 ? Math.round((raw.fiveStarCount / reviews.length) * 1000) / 10 : 0,
      attributedCount: attributed,
      unattributedCount: reviews.length - attributed,
      distinctReps: byRep.filter(r => r.rep !== '(unattributed)').length,
      recent12mo: reviews.filter(r => r.date && new Date(r.date) >= cutoff12).length,
      recent24mo: reviews.filter(r => r.date && new Date(r.date) >= cutoff24).length,
      earliest: allDates[0] || '',
      latest: allDates[allDates.length - 1] || '',
    },
    byRep,
    byYear,
    bySource,
    lowReviews,
  };
}
