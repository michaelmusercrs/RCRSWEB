/**
 * Per-rep unified scorecard. Composes:
 *   - Lifetime + last-12mo + YTD 1099 commissions (data/commissions.json)
 *   - Reviews count + avg rating + 5-star % + low-rating count (data/reviews-master.json)
 *
 * Read-only, file-based — no JN calls. Active-rep list pulled from
 * the global memory (Hunter, Aaron, Greg, Brendon, Adam, Joseph, Rick,
 * Alijah, Travis). Reps not on this list still surface but are tagged
 * "(historical)".
 */
import { promises as fs } from 'fs';
import path from 'path';

// Active 1099 sales reps (per global memory)
const ACTIVE_REPS = new Set([
  'hunter rivers', 'aaron lussi', 'greg muse', 'brendon muse',
  'adam rudell', 'joseph dowd', 'rick', 'alijah coleman', 'alijah',
  'travis wages',
].map(s => s.toLowerCase()));

// Mappings — review names sometimes don't match commission names exactly
const NAME_NORMALIZE: Record<string, string> = {
  'rick': 'Rick',
  'alijah': 'Alijah Coleman',
  'richard  geahr': 'Richard Geahr',
  'richard geahr': 'Richard Geahr',
};

function normalize(name: string): string {
  const k = (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return NAME_NORMALIZE[k] || name.trim().replace(/\s+/g, ' ');
}

interface Commission { salesRep: string; date: string; amount: number; }
interface RawReview { salesRep?: string; rating: number; date: string; }

export interface RepScorecard {
  rep: string;
  isActive: boolean;
  // Commissions
  lifetimeCommission: number;
  last12moCommission: number;
  ytdCommission: number;
  paymentCount: number;
  lastPaymentDate: string | null;
  daysSinceLastPayment: number | null;
  // Reviews
  reviewCount: number;
  avgRating: number;
  fiveStarPct: number;
  lowRatings: number;
  last12moReviews: number;
  lastReviewDate: string | null;
  // Composite
  reviewToPaymentRatio: number;   // reviews per 100 payments
  recentEarnings: 'top' | 'high' | 'mid' | 'low' | 'inactive';
  recentReviews: 'top' | 'high' | 'mid' | 'low' | 'none';
}

export interface ScorecardResponse {
  generatedAt: string;
  totalActiveReps: number;
  reps: RepScorecard[];
  totals: {
    lifetimeCommission: number;
    last12moCommission: number;
    ytdCommission: number;
    reviews: number;
  };
}

export async function getRepScorecards(): Promise<ScorecardResponse> {
  const [commJson, reviewJson] = await Promise.all([
    fs.readFile(path.join(process.cwd(), 'data', 'commissions.json'), 'utf8'),
    fs.readFile(path.join(process.cwd(), 'data', 'reviews-master.json'), 'utf8'),
  ]);
  const commissions: Commission[] = JSON.parse(commJson);
  const reviews: RawReview[] = JSON.parse(reviewJson).reviews;

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const oneYearAgo = new Date(now); oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  // Aggregate commissions
  interface CommAgg { lifetime: number; ytd: number; last12mo: number; count: number; latestDate: string | null }
  const commByRep = new Map<string, CommAgg>();
  for (const c of commissions) {
    const rep = normalize(c.salesRep || '');
    if (!rep) continue;
    const d = c.date ? new Date(c.date) : null;
    if (!commByRep.has(rep)) commByRep.set(rep, { lifetime: 0, ytd: 0, last12mo: 0, count: 0, latestDate: null });
    const agg = commByRep.get(rep)!;
    agg.lifetime += c.amount || 0;
    agg.count++;
    if (d && d >= yearStart) agg.ytd += c.amount || 0;
    if (d && d >= oneYearAgo) agg.last12mo += c.amount || 0;
    if (d && (!agg.latestDate || c.date > agg.latestDate)) agg.latestDate = c.date;
  }

  // Aggregate reviews
  interface RevAgg { count: number; total: number; fiveStar: number; sub4: number; last12mo: number; latestDate: string | null }
  const revByRep = new Map<string, RevAgg>();
  for (const r of reviews) {
    const rep = normalize(r.salesRep || '');
    if (!rep) continue;
    const d = r.date ? new Date(r.date) : null;
    if (!revByRep.has(rep)) revByRep.set(rep, { count: 0, total: 0, fiveStar: 0, sub4: 0, last12mo: 0, latestDate: null });
    const agg = revByRep.get(rep)!;
    agg.count++;
    agg.total += r.rating || 0;
    if (r.rating === 5) agg.fiveStar++;
    if (r.rating <= 3) agg.sub4++;
    if (d && d >= oneYearAgo) agg.last12mo++;
    if (d && (!agg.latestDate || r.date > agg.latestDate)) agg.latestDate = r.date;
  }

  // Union of reps from either source
  const allReps = new Set<string>([...commByRep.keys(), ...revByRep.keys()]);

  const reps: RepScorecard[] = Array.from(allReps).map(rep => {
    const c = commByRep.get(rep) || { lifetime: 0, ytd: 0, last12mo: 0, count: 0, latestDate: null };
    const r = revByRep.get(rep) || { count: 0, total: 0, fiveStar: 0, sub4: 0, last12mo: 0, latestDate: null };
    const isActive = ACTIVE_REPS.has(rep.toLowerCase());
    const latestComm = c.latestDate ? new Date(c.latestDate) : null;
    const latestRev = r.latestDate ? new Date(r.latestDate) : null;
    const daysSinceLastPayment = latestComm
      ? Math.floor((now.getTime() - latestComm.getTime()) / 86400000)
      : null;

    return {
      rep,
      isActive,
      lifetimeCommission: Math.round(c.lifetime),
      last12moCommission: Math.round(c.last12mo),
      ytdCommission: Math.round(c.ytd),
      paymentCount: c.count,
      lastPaymentDate: c.latestDate,
      daysSinceLastPayment,
      reviewCount: r.count,
      avgRating: r.count > 0 ? Math.round((r.total / r.count) * 100) / 100 : 0,
      fiveStarPct: r.count > 0 ? Math.round((r.fiveStar / r.count) * 1000) / 10 : 0,
      lowRatings: r.sub4,
      last12moReviews: r.last12mo,
      lastReviewDate: r.latestDate,
      reviewToPaymentRatio: c.count > 0 ? Math.round((r.count / c.count) * 1000) / 10 : 0,
      recentEarnings: 'inactive',
      recentReviews: 'none',
    };
  });

  // Tag recentEarnings based on last-12mo commission tertiles among ACTIVE reps
  const activeReps = reps.filter(r => r.isActive).sort((a, b) => b.last12moCommission - a.last12moCommission);
  for (let i = 0; i < activeReps.length; i++) {
    const r = activeReps[i];
    if (r.last12moCommission === 0) { r.recentEarnings = 'inactive'; continue; }
    if (i === 0) r.recentEarnings = 'top';
    else if (i < activeReps.length / 3) r.recentEarnings = 'high';
    else if (i < (2 * activeReps.length) / 3) r.recentEarnings = 'mid';
    else r.recentEarnings = 'low';
  }
  // recentReviews: tier among active reps by last-12mo reviews
  const activeByReviews = reps.filter(r => r.isActive).sort((a, b) => b.last12moReviews - a.last12moReviews);
  for (let i = 0; i < activeByReviews.length; i++) {
    const r = activeByReviews[i];
    if (r.last12moReviews === 0) { r.recentReviews = 'none'; continue; }
    if (i === 0) r.recentReviews = 'top';
    else if (i < activeByReviews.length / 3) r.recentReviews = 'high';
    else if (i < (2 * activeByReviews.length) / 3) r.recentReviews = 'mid';
    else r.recentReviews = 'low';
  }

  reps.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return b.last12moCommission - a.last12moCommission;
  });

  return {
    generatedAt: new Date().toISOString().slice(0, 10),
    totalActiveReps: reps.filter(r => r.isActive).length,
    reps,
    totals: {
      lifetimeCommission: Math.round(reps.reduce((s, r) => s + r.lifetimeCommission, 0)),
      last12moCommission: Math.round(reps.reduce((s, r) => s + r.last12moCommission, 0)),
      ytdCommission: Math.round(reps.reduce((s, r) => s + r.ytdCommission, 0)),
      reviews: reps.reduce((s, r) => s + r.reviewCount, 0),
    },
  };
}
