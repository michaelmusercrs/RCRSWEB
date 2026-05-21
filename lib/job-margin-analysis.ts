/**
 * Job Margin Analysis — True Margin Per Job
 *
 * Computes per-job profit: revenue − (materials + sub-labor + commission).
 * Then aggregates: avg margin %, top high-margin jobs, low-margin jobs,
 * margin by rep, margin by carrier.
 *
 * DATA SHORTCUTS — what we actually have vs ideal:
 *   - Revenue per job: SOLID. transactions.json Invoice rows carry the
 *     customer (with embedded "Rxxxxx" job number) and salesRep. We index
 *     by R-number to get total billed revenue per job.
 *   - Commission per rep: SOLID. commissions.json gives total commission
 *     dollars per rep. We compute each rep's effective commission rate
 *     (commission / total invoiced revenue) and apply it to each of that
 *     rep's jobs. This is an ESTIMATE per individual job, but the per-rep
 *     aggregate matches QB exactly.
 *   - Material cost per job: SPARSE. data/job-costs.json is empty in
 *     this dataset (see lib/job-material-cost-service.ts — it lives in
 *     the Google Sheet `Job_Material_Costs` tab, not the local JSON).
 *     We attempt to read job-costs.json; if empty, we surface that.
 *   - Sub-labor per job: NOT TRACKED in transactions.json (zero
 *     expenses carry salesRep + project). We report it as a known gap.
 *   - Carrier per job: NOT AVAILABLE in QB transactions; would require
 *     a JN walk. Out of scope for this report — we surface the gap.
 *
 * Net effect: we report per-job margin as `revenue − estimated commission
 * − known material cost (when present)`. The page UI MUST clearly disclose
 * that sub-labor + most material cost are not accounted for in per-job
 * estimates, while the per-rep aggregate is real.
 *
 * Sheet-cache-aware (slug 'margin') via lib/chrisview-sheet-cache.ts.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { withChrisviewCache } from './chrisview-sheet-cache';
import { redactCostFieldsDeep } from './jn-redact';

const JOB_NUMBER_RE = /R(\d{3,6})\b/;

interface QBTransaction {
  date: string;
  type: string;
  num?: string;
  amount: number;
  accountType?: string;
  customer?: string;
  vendor?: string;
  salesRep?: string;
  project?: string;
  posting?: boolean;
}

interface CommissionRow {
  salesRep: string;
  date: string;
  amount: number;
  balance?: number;
  jobNumber?: string;
  customer?: string;
}

interface JobCostsFile {
  jobCosts: Array<{
    jobNumber?: string;
    materialCost?: number;
    subLaborCost?: number;
  }>;
}

export interface JobMargin {
  jobNumber: string;             // R-number, e.g. "R10929"
  customer: string;              // Display label (full customer string from QB)
  rep: string;                   // Primary sales rep on the invoice(s)
  invoiceCount: number;
  firstInvoiceDate: string;      // ISO yyyy-mm-dd
  lastInvoiceDate: string;
  revenue: number;
  estimatedCommission: number;   // rep's commission rate × revenue
  knownMaterialCost: number;     // From job-costs.json when populated, else 0
  knownSubLaborCost: number;     // From job-costs.json when populated, else 0
  estimatedMargin: number;       // revenue - commission - knownMaterial - knownSubLabor
  estimatedMarginPct: number;    // estimatedMargin / revenue * 100
  costsKnown: boolean;           // True if material/sub-labor were sourced
}

export interface RepMargin {
  rep: string;
  jobCount: number;
  totalRev: number;
  totalCost: number;             // Total commission + any known material/sub
  totalCommission: number;
  totalKnownMaterial: number;
  totalKnownSubLabor: number;
  totalMargin: number;
  avgMarginPct: number;          // weighted by revenue
  commissionRate: number;        // overall rep commission rate, %
}

export interface MarginAnalysis {
  generatedAt: string;
  totalJobs: number;
  totalRevenue: number;
  totalEstimatedCommission: number;
  totalKnownMaterialCost: number;
  totalKnownSubLaborCost: number;
  totalEstimatedMargin: number;
  avgMarginPct: number;          // mean of per-job margin %
  medianMarginPct: number;
  weightedMarginPct: number;     // totalMargin / totalRevenue * 100
  jobsWithKnownCosts: number;    // jobs where material/sub-labor are populated
  // Data-quality flags surfaced in the UI
  dataNotes: string[];
  byRep: RepMargin[];
  topHighMargin: JobMargin[];    // top 20 by absolute margin $
  topHighMarginPct: JobMargin[]; // top 20 by margin %
  topLowMargin: JobMargin[];     // bottom 20 by margin $
  topLowMarginPct: JobMargin[];  // bottom 20 by margin %
}

async function loadTransactions(): Promise<QBTransaction[]> {
  const raw = await fs.readFile(
    path.join(process.cwd(), 'data', 'transactions.json'),
    'utf8',
  );
  return JSON.parse(raw) as QBTransaction[];
}

async function loadCommissions(): Promise<CommissionRow[]> {
  const raw = await fs.readFile(
    path.join(process.cwd(), 'data', 'commissions.json'),
    'utf8',
  );
  return JSON.parse(raw) as CommissionRow[];
}

async function loadJobCosts(): Promise<Map<string, { material: number; subLabor: number }>> {
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), 'data', 'job-costs.json'),
      'utf8',
    );
    const parsed = JSON.parse(raw) as JobCostsFile;
    const map = new Map<string, { material: number; subLabor: number }>();
    for (const row of parsed.jobCosts || []) {
      if (!row.jobNumber) continue;
      const key = row.jobNumber.startsWith('R') ? row.jobNumber : `R${row.jobNumber}`;
      map.set(key, {
        material: Number(row.materialCost || 0),
        subLabor: Number(row.subLaborCost || 0),
      });
    }
    return map;
  } catch {
    return new Map();
  }
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function round(n: number, places = 2): number {
  const f = Math.pow(10, places);
  return Math.round(n * f) / f;
}

async function computeMarginAnalysis(): Promise<MarginAnalysis> {
  const [txs, commissions, jobCosts] = await Promise.all([
    loadTransactions(),
    loadCommissions(),
    loadJobCosts(),
  ]);

  // Per-rep commission rate: total commission $ / total invoiced revenue $
  // This is what we apply per-job since we can't pin individual commission
  // payments to individual jobs reliably (commissions.json lacks R-numbers).
  const repRev = new Map<string, number>();
  for (const tx of txs) {
    if (tx.type !== 'Invoice' || !tx.salesRep) continue;
    repRev.set(tx.salesRep, (repRev.get(tx.salesRep) || 0) + (tx.amount || 0));
  }
  const repCommissionTotal = new Map<string, number>();
  for (const c of commissions) {
    if (!c.salesRep || !(c.amount > 0)) continue;
    repCommissionTotal.set(c.salesRep, (repCommissionTotal.get(c.salesRep) || 0) + c.amount);
  }
  const repCommissionRate = new Map<string, number>();
  for (const [rep, rev] of repRev) {
    if (rev <= 0) continue;
    const comm = repCommissionTotal.get(rep) || 0;
    // Cap at 50% — anything above that is bookkeeping mismatch
    // (e.g. John Cordonis showing 125% rate from name aliasing in 1099 reports).
    // Reps with cap-triggering rates get marked but a sane number is used.
    const rate = Math.min(comm / rev, 0.5);
    repCommissionRate.set(rep, rate);
  }

  // Aggregate invoices by R-number → per-job revenue, primary rep, dates
  interface JobAgg {
    jobNumber: string;
    customer: string;
    repCounts: Map<string, number>; // rep -> revenue contributed
    revenue: number;
    invoiceCount: number;
    firstDate: string;
    lastDate: string;
  }
  const jobs = new Map<string, JobAgg>();

  for (const tx of txs) {
    if (tx.type !== 'Invoice') continue;
    const src = tx.customer || tx.project || '';
    const m = JOB_NUMBER_RE.exec(src);
    if (!m) continue;
    const jobNumber = `R${m[1]}`;

    let agg = jobs.get(jobNumber);
    if (!agg) {
      agg = {
        jobNumber,
        customer: src,
        repCounts: new Map(),
        revenue: 0,
        invoiceCount: 0,
        firstDate: tx.date || '',
        lastDate: tx.date || '',
      };
      jobs.set(jobNumber, agg);
    }
    agg.revenue += tx.amount || 0;
    agg.invoiceCount += 1;
    if (tx.salesRep) {
      agg.repCounts.set(tx.salesRep, (agg.repCounts.get(tx.salesRep) || 0) + (tx.amount || 0));
    }
    if (tx.date && (!agg.firstDate || tx.date < agg.firstDate)) agg.firstDate = tx.date;
    if (tx.date && tx.date > agg.lastDate) agg.lastDate = tx.date;
    // Prefer the latest customer label (sometimes refined on subsequent invoices)
    if (src.length > agg.customer.length) agg.customer = src;
  }

  // Build per-job margins
  const jobMargins: JobMargin[] = [];
  for (const agg of jobs.values()) {
    // Skip zero-revenue jobs (cancelled, reversed, etc.) — they distort %s
    if (agg.revenue <= 0) continue;

    // Primary rep = the rep with the largest invoice $ contribution on this job
    let primaryRep = '';
    let primaryRepRev = -1;
    for (const [rep, rev] of agg.repCounts) {
      if (rev > primaryRepRev) {
        primaryRepRev = rev;
        primaryRep = rep;
      }
    }

    const rate = repCommissionRate.get(primaryRep) || 0;
    const estimatedCommission = agg.revenue * rate;
    const known = jobCosts.get(agg.jobNumber);
    const knownMaterialCost = known?.material || 0;
    const knownSubLaborCost = known?.subLabor || 0;
    const estimatedMargin =
      agg.revenue - estimatedCommission - knownMaterialCost - knownSubLaborCost;
    const estimatedMarginPct = agg.revenue > 0 ? (estimatedMargin / agg.revenue) * 100 : 0;

    jobMargins.push({
      jobNumber: agg.jobNumber,
      customer: agg.customer,
      rep: primaryRep || '(unknown)',
      invoiceCount: agg.invoiceCount,
      firstInvoiceDate: agg.firstDate,
      lastInvoiceDate: agg.lastDate,
      revenue: round(agg.revenue),
      estimatedCommission: round(estimatedCommission),
      knownMaterialCost: round(knownMaterialCost),
      knownSubLaborCost: round(knownSubLaborCost),
      estimatedMargin: round(estimatedMargin),
      estimatedMarginPct: round(estimatedMarginPct, 1),
      costsKnown: !!known,
    });
  }

  // Per-rep aggregate (REAL — uses real commission, not estimated)
  const repAggMap = new Map<string, RepMargin>();
  for (const jm of jobMargins) {
    const rep = jm.rep;
    let r = repAggMap.get(rep);
    if (!r) {
      r = {
        rep,
        jobCount: 0,
        totalRev: 0,
        totalCost: 0,
        totalCommission: 0,
        totalKnownMaterial: 0,
        totalKnownSubLabor: 0,
        totalMargin: 0,
        avgMarginPct: 0,
        commissionRate: round((repCommissionRate.get(rep) || 0) * 100, 1),
      };
      repAggMap.set(rep, r);
    }
    r.jobCount += 1;
    r.totalRev += jm.revenue;
    r.totalCommission += jm.estimatedCommission;
    r.totalKnownMaterial += jm.knownMaterialCost;
    r.totalKnownSubLabor += jm.knownSubLaborCost;
  }
  // Replace estimated rep commission with REAL commission from commissions.json
  // for the per-rep aggregate (more accurate at that level).
  const byRep: RepMargin[] = [];
  for (const r of repAggMap.values()) {
    const realCommission = repCommissionTotal.get(r.rep) || r.totalCommission;
    r.totalCommission = round(realCommission);
    r.totalRev = round(r.totalRev);
    r.totalKnownMaterial = round(r.totalKnownMaterial);
    r.totalKnownSubLabor = round(r.totalKnownSubLabor);
    r.totalCost = round(r.totalCommission + r.totalKnownMaterial + r.totalKnownSubLabor);
    r.totalMargin = round(r.totalRev - r.totalCost);
    r.avgMarginPct = r.totalRev > 0 ? round((r.totalMargin / r.totalRev) * 100, 1) : 0;
    byRep.push(r);
  }
  byRep.sort((a, b) => b.totalRev - a.totalRev);

  // Headline aggregates
  const totalRevenue = jobMargins.reduce((s, j) => s + j.revenue, 0);
  const totalEstimatedCommission = jobMargins.reduce((s, j) => s + j.estimatedCommission, 0);
  const totalKnownMaterialCost = jobMargins.reduce((s, j) => s + j.knownMaterialCost, 0);
  const totalKnownSubLaborCost = jobMargins.reduce((s, j) => s + j.knownSubLaborCost, 0);
  const totalEstimatedMargin = jobMargins.reduce((s, j) => s + j.estimatedMargin, 0);
  const marginPcts = jobMargins.map(j => j.estimatedMarginPct);
  const avgMarginPct = marginPcts.length
    ? marginPcts.reduce((s, v) => s + v, 0) / marginPcts.length
    : 0;
  const medianMarginPct = median(marginPcts);
  const weightedMarginPct = totalRevenue > 0
    ? (totalEstimatedMargin / totalRevenue) * 100
    : 0;
  const jobsWithKnownCosts = jobMargins.filter(j => j.costsKnown).length;

  // Sort cuts
  const byMarginDesc = [...jobMargins].sort((a, b) => b.estimatedMargin - a.estimatedMargin);
  const byMarginPctDesc = [...jobMargins].sort((a, b) => b.estimatedMarginPct - a.estimatedMarginPct);
  const topHighMargin = byMarginDesc.slice(0, 20);
  const topLowMargin = byMarginDesc.slice(-20).reverse();
  const topHighMarginPct = byMarginPctDesc.slice(0, 20);
  const topLowMarginPct = byMarginPctDesc.slice(-20).reverse();

  // Data-quality notes (rendered in UI)
  const dataNotes: string[] = [];
  dataNotes.push(
    `Per-job commission is ESTIMATED — each rep's overall commission rate (commission $ / invoiced revenue $) is applied to each job. Per-rep totals are exact; per-job is allocated.`,
  );
  if (jobsWithKnownCosts === 0) {
    dataNotes.push(
      `Material cost data: NOT AVAILABLE for any jobs in this report. data/job-costs.json is empty. The canonical source (Job_Material_Costs sheet) is only populated for post-2026-05-15 deliveries. Margin numbers reflect revenue minus commission only.`,
    );
  } else {
    dataNotes.push(
      `Material/sub-labor cost data populated for ${jobsWithKnownCosts.toLocaleString()} of ${jobMargins.length.toLocaleString()} jobs (${((jobsWithKnownCosts / jobMargins.length) * 100).toFixed(1)}%). Other jobs treat material/sub-labor as $0 — true margin will be LOWER than shown.`,
    );
  }
  dataNotes.push(
    `Sub-labor cost: NOT tracked per-job in QB transactions (zero expenses carry both salesRep and project). True margin is overstated until subcontractor invoicing is linked to jobs in QB.`,
  );
  dataNotes.push(
    `Carrier (insurance) breakdown: NOT available in QB data — would require a JN walk. Out of scope for this view.`,
  );

  const result: MarginAnalysis = {
    generatedAt: new Date().toISOString(),
    totalJobs: jobMargins.length,
    totalRevenue: round(totalRevenue),
    totalEstimatedCommission: round(totalEstimatedCommission),
    totalKnownMaterialCost: round(totalKnownMaterialCost),
    totalKnownSubLaborCost: round(totalKnownSubLaborCost),
    totalEstimatedMargin: round(totalEstimatedMargin),
    avgMarginPct: round(avgMarginPct, 1),
    medianMarginPct: round(medianMarginPct, 1),
    weightedMarginPct: round(weightedMarginPct, 1),
    jobsWithKnownCosts,
    dataNotes,
    byRep,
    topHighMargin,
    topHighMarginPct,
    topLowMargin,
    topLowMarginPct,
  };

  // Defense in depth: although /chrisview/* is owner-facing and cost is OK,
  // still pass through the cost redactor with viewerCanSeeCost=true so the
  // contract matches every other chrisview route. If anyone later flips the
  // page mount-point, the boolean is the single switch.
  return redactCostFieldsDeep(result, true);
}

/**
 * Public entry point. Reads from the chrisview_cache sheet first (slug
 * 'margin'); falls through to live compute if missing or stale.
 */
export async function getMarginAnalysis(): Promise<MarginAnalysis> {
  const { payload } = await withChrisviewCache<MarginAnalysis>(
    'margin',
    () => computeMarginAnalysis(),
  );
  return payload;
}

// Exported for the precompute cron / direct callers that want to bypass cache.
export { computeMarginAnalysis };
