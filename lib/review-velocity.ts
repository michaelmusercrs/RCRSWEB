/**
 * Review-velocity analysis — answers "of every completed job, what
 * percentage led to a Google review?"
 *
 * Why this exists: SEO monitor flags reviews as our biggest weakness
 * (47 lifetime visible vs 800+ for top competitors per project memory).
 * Reality is worse — we have 317 lifetime reviews across ~3,000
 * completed jobs (10.6% ask-and-receive rate). Per rep that rate
 * varies wildly; this page surfaces the gaps so the reps who close
 * the most jobs but ask the fewest reviews get a nudge.
 *
 * "Completed job" proxy:
 *   - Primary: posted Invoice records in data/transactions.json
 *     (one invoice = one job billed = job is done). De-duped on
 *     (project || customer) so multi-line jobs count once.
 *   - These are filtered by `posting:true` and exclude "VOIDED INVOICE"
 *     reps. Same `salesRep` field shape as commissions.json so name
 *     normalization works across both.
 *
 * Cheap (no JN calls) — reads from static JSON files shipped with the repo.
 * Sheet-cache aware via slug 'review-velocity' (mirrors lib/jn-deep-funnel.ts
 * lines 155-180).
 */
import { promises as fs } from 'fs';
import path from 'path';

// Name normalization — review names sometimes don't match invoice names exactly.
// Identical to lib/rep-scorecard.ts so the two pages agree on rep identity.
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

// Active reps list (same as lib/rep-scorecard.ts)
const ACTIVE_REPS = new Set([
  'hunter rivers', 'aaron lussi', 'greg muse', 'brendon muse',
  'adam rudell', 'joseph dowd', 'rick', 'alijah coleman', 'alijah',
  'travis wages',
].map(s => s.toLowerCase()));

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
interface RawTxn {
  date: string;
  type: string;
  num?: string;
  amount: number;
  accountType?: string;
  customer?: string;
  vendor?: string;
  salesRep?: string;
  posting?: boolean;
  project?: string;
}

export interface VelocityRepRow {
  rep: string;
  isActive: boolean;
  lifetimeJobs: number;
  lifetimeReviews: number;
  lifetimeRate: number;        // % (reviews / jobs * 100), 1 decimal
  last12moJobs: number;
  last12moReviews: number;
  last12moRate: number;
  last90dJobs: number;
  last90dReviews: number;
  last90dRate: number;
  lastReviewDate: string | null;
  daysSinceLastReview: number | null;
  lastJobDate: string | null;
  gap: 'flag' | 'ok' | 'great';
}

export interface VelocityYearRow {
  year: string;
  jobs: number;
  reviews: number;
  rate: number; // %
}

export interface ReviewVelocity {
  generatedAt: string;
  source: string;
  totals: {
    jobs: number;
    reviews: number;
    reviewRate: number;       // %
    last12moJobs: number;
    last12moReviews: number;
    last12moRate: number;
    last90dJobs: number;
    last90dReviews: number;
    last90dRate: number;
    gapFlagCount: number;     // # of active reps marked 'flag'
    distinctReps: number;
  };
  byRep: VelocityRepRow[];
  byYear: VelocityYearRow[];
  askThemToAsk: VelocityRepRow[]; // top 5 candidates: high recent job count, low recent review rate
}

const SHEET_CACHE_MAX_AGE_MS = 90 * 60 * 1000;
let _cache: { data: ReviewVelocity; at: number } | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

export async function getReviewVelocity(): Promise<ReviewVelocity> {
  if (_cache && Date.now() - _cache.at < CACHE_TTL_MS) return _cache.data;

  // Try sheet cache first.
  try {
    const { readChrisviewCache } = await import('./chrisview-sheet-cache');
    const cached = await readChrisviewCache<ReviewVelocity>('review-velocity');
    if (cached) {
      const age = Date.now() - new Date(cached.generatedAt).getTime();
      if (Number.isFinite(age) && age < SHEET_CACHE_MAX_AGE_MS) {
        _cache = { data: cached.payload, at: Date.now() };
        return cached.payload;
      }
    }
  } catch (err) {
    console.warn('[review-velocity] sheet cache read failed:', err);
  }

  const [txnRaw, revRaw] = await Promise.all([
    fs.readFile(path.join(process.cwd(), 'data', 'transactions.json'), 'utf8'),
    fs.readFile(path.join(process.cwd(), 'data', 'reviews-master.json'), 'utf8'),
  ]);
  const txns: RawTxn[] = JSON.parse(txnRaw);
  const reviewsFile: RawReviewsFile = JSON.parse(revRaw);
  const reviews = reviewsFile.reviews || [];

  const now = new Date();
  const cutoff12 = new Date(now); cutoff12.setMonth(cutoff12.getMonth() - 12);
  const cutoff90 = new Date(now); cutoff90.setDate(cutoff90.getDate() - 90);

  // --- Job extraction: posted invoices, de-duped per (project||customer).
  // A job billed across multiple line-item invoices should count once.
  // Key on rep + project so the same project can still be attributed
  // correctly if it was somehow handled by two reps.
  interface JobEntry { rep: string; date: string; }
  const jobMap = new Map<string, JobEntry>();
  for (const t of txns) {
    if (t.type !== 'Invoice') continue;
    if (!t.posting) continue;
    const rep = (t.salesRep || '').trim();
    if (!rep || rep === 'VOIDED INVOICE') continue;
    const proj = (t.project || t.customer || '').trim();
    const key = proj ? `${rep}::${proj}` : `${rep}::${t.num || t.date}`;
    const existing = jobMap.get(key);
    // Keep earliest date per job — the original "job done" event.
    if (!existing || (t.date && t.date < existing.date)) {
      jobMap.set(key, { rep: normalize(rep), date: t.date });
    }
  }
  const jobs = Array.from(jobMap.values());

  // --- Aggregate jobs by rep.
  interface JobAgg {
    lifetime: number;
    last12mo: number;
    last90d: number;
    latestDate: string | null;
  }
  const jobsByRep = new Map<string, JobAgg>();
  const jobsByYear = new Map<string, number>();
  for (const j of jobs) {
    if (!jobsByRep.has(j.rep)) jobsByRep.set(j.rep, { lifetime: 0, last12mo: 0, last90d: 0, latestDate: null });
    const agg = jobsByRep.get(j.rep)!;
    agg.lifetime++;
    const d = j.date ? new Date(j.date) : null;
    if (d && !isNaN(d.getTime())) {
      if (d >= cutoff12) agg.last12mo++;
      if (d >= cutoff90) agg.last90d++;
      if (!agg.latestDate || j.date > agg.latestDate) agg.latestDate = j.date;
    }
    const yr = (j.date || '').slice(0, 4);
    if (yr) jobsByYear.set(yr, (jobsByYear.get(yr) || 0) + 1);
  }

  // --- Aggregate reviews by rep.
  interface RevAgg {
    lifetime: number;
    last12mo: number;
    last90d: number;
    latestDate: string | null;
  }
  const revByRep = new Map<string, RevAgg>();
  const revByYear = new Map<string, number>();
  for (const r of reviews) {
    const rep = normalize(r.salesRep || '');
    if (!rep) continue;
    if (!revByRep.has(rep)) revByRep.set(rep, { lifetime: 0, last12mo: 0, last90d: 0, latestDate: null });
    const agg = revByRep.get(rep)!;
    agg.lifetime++;
    const d = r.date ? new Date(r.date) : null;
    if (d && !isNaN(d.getTime())) {
      if (d >= cutoff12) agg.last12mo++;
      if (d >= cutoff90) agg.last90d++;
      if (!agg.latestDate || r.date > agg.latestDate) agg.latestDate = r.date;
    }
    const yr = (r.date || '').slice(0, 4);
    if (yr) revByYear.set(yr, (revByYear.get(yr) || 0) + 1);
  }

  // --- Union of reps from either source. Drop unattributed bucket from per-rep
  // table (it'd skew the gap analysis); we still count it in totals.
  const allReps = new Set<string>([...jobsByRep.keys(), ...revByRep.keys()]);

  const byRep: VelocityRepRow[] = Array.from(allReps).map(rep => {
    const j = jobsByRep.get(rep) || { lifetime: 0, last12mo: 0, last90d: 0, latestDate: null };
    const r = revByRep.get(rep) || { lifetime: 0, last12mo: 0, last90d: 0, latestDate: null };
    const lifetimeRate = j.lifetime > 0 ? Math.round((r.lifetime / j.lifetime) * 1000) / 10 : 0;
    const last12moRate = j.last12mo > 0 ? Math.round((r.last12mo / j.last12mo) * 1000) / 10 : 0;
    const last90dRate = j.last90d > 0 ? Math.round((r.last90d / j.last90d) * 1000) / 10 : 0;
    const isActive = ACTIVE_REPS.has(rep.toLowerCase());
    const latestRev = r.latestDate ? new Date(r.latestDate) : null;
    const daysSinceLastReview = latestRev
      ? Math.floor((now.getTime() - latestRev.getTime()) / 86400000)
      : null;

    // Gap classification: flag = at least 8 last-12mo jobs AND last-12mo rate < 5%
    //                    great = last-12mo rate >= 15%
    //                    ok = everything else (incl. low-job reps we can't fairly judge)
    let gap: 'flag' | 'ok' | 'great' = 'ok';
    if (isActive && j.last12mo >= 8 && last12moRate < 5) gap = 'flag';
    else if (isActive && last12moRate >= 15) gap = 'great';

    return {
      rep,
      isActive,
      lifetimeJobs: j.lifetime,
      lifetimeReviews: r.lifetime,
      lifetimeRate,
      last12moJobs: j.last12mo,
      last12moReviews: r.last12mo,
      last12moRate,
      last90dJobs: j.last90d,
      last90dReviews: r.last90d,
      last90dRate,
      lastReviewDate: r.latestDate,
      daysSinceLastReview,
      lastJobDate: j.latestDate,
      gap,
    };
  });

  // Sort: active first, then by last-12mo jobs descending (most-prolific
  // reps at the top — those are the people whose ask-rate matters most).
  byRep.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return b.last12moJobs - a.last12moJobs;
  });

  // --- By-year trend table.
  const allYears = new Set<string>([...jobsByYear.keys(), ...revByYear.keys()]);
  const byYear: VelocityYearRow[] = Array.from(allYears)
    .filter(y => y && y !== 'unknown')
    .sort()
    .map(year => {
      const j = jobsByYear.get(year) || 0;
      const rv = revByYear.get(year) || 0;
      return {
        year,
        jobs: j,
        reviews: rv,
        rate: j > 0 ? Math.round((rv / j) * 1000) / 10 : 0,
      };
    });

  // --- Ask-them-to-ask: top 5 active reps with the most last-12mo jobs
  // whose last-12mo review rate is < 10%. These are the highest-leverage
  // nudges — already closing tons of work, just not asking.
  const askThemToAsk = byRep
    .filter(r => r.isActive && r.last12moJobs >= 5 && r.last12moRate < 10)
    .sort((a, b) => b.last12moJobs - a.last12moJobs)
    .slice(0, 5);

  // --- Totals.
  const totalJobs = jobs.length;
  const totalReviews = reviews.length;
  const total12moJobs = jobs.filter(j => {
    const d = j.date ? new Date(j.date) : null;
    return d && !isNaN(d.getTime()) && d >= cutoff12;
  }).length;
  const total12moReviews = reviews.filter(r => {
    const d = r.date ? new Date(r.date) : null;
    return d && !isNaN(d.getTime()) && d >= cutoff12;
  }).length;
  const total90dJobs = jobs.filter(j => {
    const d = j.date ? new Date(j.date) : null;
    return d && !isNaN(d.getTime()) && d >= cutoff90;
  }).length;
  const total90dReviews = reviews.filter(r => {
    const d = r.date ? new Date(r.date) : null;
    return d && !isNaN(d.getTime()) && d >= cutoff90;
  }).length;

  const result: ReviewVelocity = {
    generatedAt: new Date().toISOString().slice(0, 10),
    source: 'data/transactions.json (invoices) + data/reviews-master.json',
    totals: {
      jobs: totalJobs,
      reviews: totalReviews,
      reviewRate: totalJobs > 0 ? Math.round((totalReviews / totalJobs) * 1000) / 10 : 0,
      last12moJobs: total12moJobs,
      last12moReviews: total12moReviews,
      last12moRate: total12moJobs > 0 ? Math.round((total12moReviews / total12moJobs) * 1000) / 10 : 0,
      last90dJobs: total90dJobs,
      last90dReviews: total90dReviews,
      last90dRate: total90dJobs > 0 ? Math.round((total90dReviews / total90dJobs) * 1000) / 10 : 0,
      gapFlagCount: byRep.filter(r => r.gap === 'flag').length,
      distinctReps: byRep.filter(r => r.lifetimeJobs > 0).length,
    },
    byRep,
    byYear,
    askThemToAsk,
  };

  _cache = { data: result, at: Date.now() };
  return result;
}
