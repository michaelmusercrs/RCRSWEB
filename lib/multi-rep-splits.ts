/**
 * Multi-Rep Commission Split Visibility
 *
 * Detects commission "splits" — jobs where two or more reps received a
 * commission payment for the same job. Today this is buried in the
 * 1099 transaction detail. Surfacing it lets Chris see handoffs,
 * mentor/training partner splits, and overrides paid via BCM /
 * Roof Angel / Rudys at a glance.
 *
 * Detection strategy
 * ------------------
 * The raw `data/commissions.json` rows have these fields:
 *   { salesRep, date, amount, balance, jobNumber, customer }
 * There is NO entity / memo column in this denormalized export, so we
 * use TWO complementary signals:
 *
 *   1. JOB-NUMBER GROUPING (primary). Group all non-zero commission
 *      rows by `jobNumber`; any job that has 2+ DISTINCT reps tagged is
 *      a split candidate. This is the strongest signal — QB only writes
 *      a row per commission disbursement.
 *
 *   2. CUSTOMER-FIELD KEYWORD SCAN (secondary). Some early rows have
 *      no jobNumber but the customer string itself contains "split",
 *      "shared", "override", "%", or "50/50". We flag those rows
 *      individually as `memoFlagged` so they show up even without a
 *      partner.
 *
 * Be honest about edge cases
 * --------------------------
 * A job with two rows for the same rep (initial pay + supplement) is
 * NOT a split — we only flag when distinct reps are involved. But we
 * can't tell apart "true split" (handoff) from "rep paid twice in
 * weird ways" without the memo line. Surface the data, let the human
 * inspect the per-job payment table.
 *
 * Output is sheet-cache-aware via slug `multi-rep-splits` (re-uses the
 * shared chrisview cache infra).
 */

import { withChrisviewCache } from './chrisview-sheet-cache';

// ---------------------------------------------------------------------------
// Source row shape (matches data/commissions.json on disk)
// ---------------------------------------------------------------------------
interface CommissionRow {
  salesRep: string;
  date: string;          // MM/DD/YYYY
  amount: number;
  balance: number;
  jobNumber: string;
  customer: string;
}

// ---------------------------------------------------------------------------
// Rep-name normalization. Mirrors scripts/extract-division-leader-checks.mjs
// so an LLC and its human owner roll up to one identity.
// ---------------------------------------------------------------------------
const REP_MAP: Record<string, string> = {
  'BCM Contracting LLC': 'Brendon Muse',
  'Rudys Roofing Insights LLC': 'Adam Rudell',
  'Roof Angel, LLC': 'Aaron Lussi',
  'Roof Angel LLC': 'Aaron Lussi',
  'Jeremy T. Wages': 'Travis Wages',
  'Jeremy T Wages': 'Travis Wages',
  'Gregory Ray Muse': 'Greg Muse',
  'Antony Barton Roberts': 'Bart Roberts',
  'Boykin Dream Big Win Big LLC': 'Aaron Boykin',
  'BPB Contracting LLC': 'Brandon Bradford',
  'Richard  Geahr': 'Richard Geahr', // double-space in source
};

function normalizeRep(raw: string): string {
  const trimmed = (raw || '').trim();
  if (REP_MAP[trimmed]) return REP_MAP[trimmed];
  // Collapse interior double-spaces (Richard  Geahr -> Richard Geahr)
  return trimmed.replace(/\s+/g, ' ');
}

// Memo-style keywords. Customer field is mostly addresses but occasionally
// carries notes — we surface those rows even without a partner rep.
const MEMO_SPLIT_PATTERN =
  /\bsplit\b|\bshared\b|\boverride\b|\btrail\b(?!ing\b)|\bpartner\b|50\s*\/\s*50|\bmentor\b|%/i;

// ---------------------------------------------------------------------------
// Public output types
// ---------------------------------------------------------------------------
export interface SplitPayment {
  rep: string;
  amount: number;
  date: string;
  customer: string;
  memoFlagged?: boolean;
}

export interface SplitJob {
  jobNumber: string;
  customer: string;       // first non-empty customer string we saw
  totalPaid: number;
  payments: SplitPayment[];
  partners: string[];     // distinct normalized reps on this job
  firstPaidDate: string;
  lastPaidDate: string;
}

export interface RepSplitStats {
  rep: string;
  splitJobCount: number;     // # of jobs where this rep shared credit
  splitAmount: number;       // $ paid to this rep on those split jobs
  soloJobCount: number;      // # of jobs where this rep was the only rep paid
  soloAmount: number;
  splitShare: number;        // splitAmount / (splitAmount + soloAmount), 0-1
  topPartners: Array<{ partner: string; jobCount: number; totalAmount: number }>;
}

export interface RepPair {
  rep1: string;
  rep2: string;
  jobCount: number;
  totalAmount: number;       // combined paid to both on shared jobs
}

export interface MemoFlaggedRow {
  rep: string;
  date: string;
  amount: number;
  customer: string;
  jobNumber: string;
  matchedTerm: string;
}

export interface MultiRepSplitsResult {
  generatedAt: string;
  totalCommissionRows: number;
  totalNonZeroRows: number;
  totalSplitJobs: number;
  totalSplitPayments: number;
  totalSplitAmount: number;
  uniquePairings: number;
  splitJobs: SplitJob[];
  byRep: RepSplitStats[];
  pairs: RepPair[];
  memoFlagged: MemoFlaggedRow[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function toISO(mdY: string): string {
  // MM/DD/YYYY -> YYYY-MM-DD (best-effort; bad rows return original)
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((mdY || '').trim());
  if (!m) return mdY;
  return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Core compute. Pure function — pass in the rows and get the result.
// ---------------------------------------------------------------------------
export function computeSplits(rows: CommissionRow[]): MultiRepSplitsResult {
  const totalCommissionRows = rows.length;
  const nonZero = rows.filter(r => r.amount && r.jobNumber);
  const totalNonZeroRows = nonZero.length;

  // ---- Pass 1: bucket payments by jobNumber ---------------------------
  const byJob = new Map<string, SplitPayment[]>();
  const customerByJob = new Map<string, string>();
  for (const r of nonZero) {
    const rep = normalizeRep(r.salesRep);
    if (!rep) continue;
    const key = r.jobNumber.trim();
    if (!byJob.has(key)) byJob.set(key, []);
    byJob.get(key)!.push({
      rep,
      amount: round2(r.amount),
      date: r.date,
      customer: r.customer,
      memoFlagged: MEMO_SPLIT_PATTERN.test(r.customer) || undefined,
    });
    if (!customerByJob.has(key) && r.customer) {
      customerByJob.set(key, r.customer);
    }
  }

  // ---- Pass 2: classify split vs solo jobs ----------------------------
  const splitJobs: SplitJob[] = [];
  const soloJobsByRep = new Map<string, { count: number; amount: number }>();

  for (const [jobNumber, payments] of byJob.entries()) {
    const distinctReps = new Set(payments.map(p => p.rep));
    const totalPaid = round2(payments.reduce((s, p) => s + p.amount, 0));

    if (distinctReps.size >= 2) {
      const sorted = [...payments].sort((a, b) =>
        toISO(a.date).localeCompare(toISO(b.date)),
      );
      splitJobs.push({
        jobNumber,
        customer: customerByJob.get(jobNumber) || '',
        totalPaid,
        payments: sorted,
        partners: [...distinctReps].sort((a, b) => a.localeCompare(b)),
        firstPaidDate: sorted[0]?.date || '',
        lastPaidDate: sorted[sorted.length - 1]?.date || '',
      });
    } else {
      // Solo job — credit the single rep
      const rep = [...distinctReps][0];
      const cur = soloJobsByRep.get(rep) || { count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += totalPaid;
      soloJobsByRep.set(rep, cur);
    }
  }

  // Sort split jobs newest-last-paid first
  splitJobs.sort((a, b) => toISO(b.lastPaidDate).localeCompare(toISO(a.lastPaidDate)));

  // ---- Pass 3: per-rep stats + pair counts ----------------------------
  const repAgg = new Map<string, {
    splitJobs: Set<string>;
    splitAmount: number;
    partners: Map<string, { jobs: Set<string>; amount: number }>;
  }>();
  const pairAgg = new Map<string, { rep1: string; rep2: string; jobs: Set<string>; amount: number }>();

  for (const job of splitJobs) {
    // per-rep split totals (only amount paid TO that rep on this job)
    const repPaidOnJob = new Map<string, number>();
    for (const p of job.payments) {
      repPaidOnJob.set(p.rep, (repPaidOnJob.get(p.rep) || 0) + p.amount);
    }
    for (const rep of job.partners) {
      if (!repAgg.has(rep)) {
        repAgg.set(rep, { splitJobs: new Set(), splitAmount: 0, partners: new Map() });
      }
      const a = repAgg.get(rep)!;
      a.splitJobs.add(job.jobNumber);
      a.splitAmount += repPaidOnJob.get(rep) || 0;

      // partner contributions
      for (const other of job.partners) {
        if (other === rep) continue;
        if (!a.partners.has(other)) {
          a.partners.set(other, { jobs: new Set(), amount: 0 });
        }
        const pa = a.partners.get(other)!;
        pa.jobs.add(job.jobNumber);
        pa.amount += repPaidOnJob.get(other) || 0;
      }
    }

    // unordered pair aggregation
    const reps = [...job.partners];
    for (let i = 0; i < reps.length; i++) {
      for (let j = i + 1; j < reps.length; j++) {
        const [a, b] = [reps[i], reps[j]].sort((x, y) => x.localeCompare(y));
        const key = `${a}|||${b}`;
        if (!pairAgg.has(key)) {
          pairAgg.set(key, { rep1: a, rep2: b, jobs: new Set(), amount: 0 });
        }
        const p = pairAgg.get(key)!;
        p.jobs.add(job.jobNumber);
        p.amount += job.totalPaid;
      }
    }
  }

  const byRep: RepSplitStats[] = [];
  const allReps = new Set<string>([...repAgg.keys(), ...soloJobsByRep.keys()]);
  for (const rep of allReps) {
    const splitInfo = repAgg.get(rep);
    const soloInfo = soloJobsByRep.get(rep);
    const splitAmount = round2(splitInfo?.splitAmount || 0);
    const soloAmount = round2(soloInfo?.amount || 0);
    const totalAmount = splitAmount + soloAmount;
    const topPartners = splitInfo
      ? [...splitInfo.partners.entries()]
          .map(([partner, info]) => ({
            partner,
            jobCount: info.jobs.size,
            totalAmount: round2(info.amount),
          }))
          .sort((a, b) => b.jobCount - a.jobCount || b.totalAmount - a.totalAmount)
          .slice(0, 5)
      : [];
    byRep.push({
      rep,
      splitJobCount: splitInfo?.splitJobs.size || 0,
      splitAmount,
      soloJobCount: soloInfo?.count || 0,
      soloAmount,
      splitShare: totalAmount > 0 ? Math.round((splitAmount / totalAmount) * 1000) / 1000 : 0,
      topPartners,
    });
  }
  // Sort: most split jobs first, then by split $
  byRep.sort((a, b) => b.splitJobCount - a.splitJobCount || b.splitAmount - a.splitAmount);

  const pairs: RepPair[] = [...pairAgg.values()]
    .map(p => ({
      rep1: p.rep1,
      rep2: p.rep2,
      jobCount: p.jobs.size,
      totalAmount: round2(p.amount),
    }))
    .sort((a, b) => b.jobCount - a.jobCount || b.totalAmount - a.totalAmount);

  // ---- Pass 4: standalone memo-flagged rows ---------------------------
  // Surface ANY row whose customer field hits the memo pattern, even if
  // it's already inside a split job (helps the user spot the explicit
  // "split with X" rows fast).
  const memoFlagged: MemoFlaggedRow[] = [];
  for (const r of rows) {
    if (!r.amount) continue;
    const m = r.customer?.match(MEMO_SPLIT_PATTERN);
    if (!m) continue;
    memoFlagged.push({
      rep: normalizeRep(r.salesRep),
      date: r.date,
      amount: round2(r.amount),
      customer: r.customer,
      jobNumber: r.jobNumber,
      matchedTerm: m[0],
    });
  }
  memoFlagged.sort((a, b) => toISO(b.date).localeCompare(toISO(a.date)));

  const totalSplitPayments = splitJobs.reduce((s, j) => s + j.payments.length, 0);
  const totalSplitAmount = round2(splitJobs.reduce((s, j) => s + j.totalPaid, 0));

  return {
    generatedAt: new Date().toISOString(),
    totalCommissionRows,
    totalNonZeroRows,
    totalSplitJobs: splitJobs.length,
    totalSplitPayments,
    totalSplitAmount,
    uniquePairings: pairs.length,
    splitJobs,
    byRep,
    pairs,
    memoFlagged,
  };
}

// ---------------------------------------------------------------------------
// Public entry-point. Reads the bundled JSON and runs through the
// shared chrisview sheet cache. The compute is cheap (~50 ms on 15k
// rows) but the cache keeps the chrisview index page snappy.
// ---------------------------------------------------------------------------
export async function getMultiRepSplits(): Promise<MultiRepSplitsResult> {
  const { payload } = await withChrisviewCache<MultiRepSplitsResult>(
    'multi-rep-splits',
    async () => {
      const rowsModule = await import('@/data/commissions.json');
      const rows = (rowsModule.default ?? rowsModule) as unknown as CommissionRow[];
      return computeSplits(rows);
    },
  );
  return payload;
}
