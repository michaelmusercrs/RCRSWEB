/**
 * Job Profitability Report API
 *
 * GET /api/portal/reports/profitability?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Owner/admin only. Aggregates every CustomerBreakdown in the requested
 * window into summary KPIs, per-rep performance, per-month trend, and a
 * sorted job detail list. This is the backing API for the Job Profitability
 * report dashboard used by ownership to see true per-job profit (revenue
 * minus materials, labor, overhead, and permit) alongside the commission
 * splits that went out the door.
 *
 * The authoritative data source is `listBreakdowns()` from
 * `lib/customer-breakdown-service.ts`, which returns the persisted
 * CustomerBreakdown + CalculatedTotals for every R-number job we have
 * priced through the breakdown tool. No other data source — we want one
 * canonical "what did we actually make on this job?" number per row.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { listBreakdowns } from '@/lib/customer-breakdown-service';

// ─── Types (API contract) ────────────────────────────────────────────────

interface JobRow {
  rNumber: string;
  customerName: string;
  salesRep: string;
  dateInstalled: string;
  status: string;
  jobTotal: number;
  materialCost: number;
  laborCost: number;
  overhead: number;
  permit: number;
  jobProfit: number;
  profitMargin: number; // jobProfit / jobTotal
  salesRepCommission: number;
  presCommission: number;
  vpCommission: number;
  companyRetained: number;
}

interface RepRow {
  salesRep: string;
  jobCount: number;
  totalRevenue: number;
  totalProfit: number;
  totalCommission: number;
  avgProfitPercent: number;
}

interface MonthRow {
  month: string; // YYYY-MM
  jobCount: number;
  revenue: number;
  profit: number;
  margin: number; // profit / revenue
}

interface Summary {
  totalJobs: number;
  totalRevenue: number;
  totalMaterialCost: number;
  totalLaborCost: number;
  totalOverhead: number;
  totalProfit: number;
  totalRepCommission: number;
  totalPresCommission: number;
  totalVpCommission: number;
  totalCompanyRetained: number;
  avgProfitMargin: number;
  avgProfitPercentDisplay: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function parseDateOrNull(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function toYMD(iso: string | undefined): string {
  if (!iso) return '';
  // Accept "YYYY-MM-DD" or ISO datetime — grab the date portion
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  if (match) return match[1];
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function toYM(iso: string | undefined): string {
  const ymd = toYMD(iso);
  return ymd.slice(0, 7); // YYYY-MM
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  const url = new URL(req.url);
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');

  // Default window: last 90 days ending today
  const now = new Date();
  const defaultTo = new Date(now);
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 90);

  const from = parseDateOrNull(fromParam) || defaultFrom;
  const to = parseDateOrNull(toParam) || defaultTo;
  // Normalize to day boundaries so "to" is inclusive of its day
  const fromBound = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0);
  const toBound = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999);

  let all: Awaited<ReturnType<typeof listBreakdowns>> = [];
  try {
    all = await listBreakdowns();
  } catch (err) {
    console.error('[reports/profitability] listBreakdowns failed:', err);
    all = [];
  }

  // Filter by dateInstalled in range. Breakdowns without a dateInstalled
  // are excluded from the report — a job with no install date cannot be
  // bucketed in a time window and including it would skew the trend.
  const inRange = all.filter(({ breakdown }) => {
    const ymd = toYMD(breakdown.dateInstalled);
    if (!ymd) return false;
    const d = new Date(ymd);
    if (isNaN(d.getTime())) return false;
    return d >= fromBound && d <= toBound;
  });

  // Build job rows
  const jobs: JobRow[] = inRange.map(({ breakdown, totals }) => {
    const jobTotal = Number(totals.jobTotal) || 0;
    const profit = Number(totals.jobProfit) || 0;
    const profitMargin = jobTotal > 0 ? profit / jobTotal : 0;
    return {
      rNumber: breakdown.rNumber || '',
      customerName: breakdown.customerName || '',
      salesRep: breakdown.salesRep || 'Unassigned',
      dateInstalled: toYMD(breakdown.dateInstalled),
      status: breakdown.status || 'unknown',
      jobTotal,
      materialCost: Number(totals.materialSubtotal) || 0,
      laborCost: Number(totals.laborTotal) || 0,
      overhead: Number(totals.overheadTotal) || 0,
      permit: Number(totals.permit) || 0,
      jobProfit: profit,
      profitMargin,
      salesRepCommission: Number(totals.salesRepCommission) || 0,
      presCommission: Number(totals.presCommission) || 0,
      vpCommission: Number(totals.vpCommission) || 0,
      companyRetained: Number(totals.companyRetained) || 0,
    };
  });

  // Sort by profit margin descending (best margins first)
  jobs.sort((a, b) => b.profitMargin - a.profitMargin);

  // ─── Aggregate: summary ────────────────────────────────────────────────
  const summary: Summary = {
    totalJobs: jobs.length,
    totalRevenue: 0,
    totalMaterialCost: 0,
    totalLaborCost: 0,
    totalOverhead: 0,
    totalProfit: 0,
    totalRepCommission: 0,
    totalPresCommission: 0,
    totalVpCommission: 0,
    totalCompanyRetained: 0,
    avgProfitMargin: 0,
    avgProfitPercentDisplay: 0,
  };

  let marginSum = 0;
  let percentDisplaySum = 0;

  for (const j of jobs) {
    summary.totalRevenue += j.jobTotal;
    summary.totalMaterialCost += j.materialCost;
    summary.totalLaborCost += j.laborCost;
    summary.totalOverhead += j.overhead;
    summary.totalProfit += j.jobProfit;
    summary.totalRepCommission += j.salesRepCommission;
    summary.totalPresCommission += j.presCommission;
    summary.totalVpCommission += j.vpCommission;
    summary.totalCompanyRetained += j.companyRetained;
    marginSum += j.profitMargin;
    percentDisplaySum += j.jobTotal > 0 ? (j.salesRepCommission / j.jobTotal) * 100 : 0;
  }

  if (jobs.length > 0) {
    summary.avgProfitMargin = marginSum / jobs.length;
    summary.avgProfitPercentDisplay = percentDisplaySum / jobs.length;
  }

  // Round money fields for cleaner client display
  summary.totalRevenue = round2(summary.totalRevenue);
  summary.totalMaterialCost = round2(summary.totalMaterialCost);
  summary.totalLaborCost = round2(summary.totalLaborCost);
  summary.totalOverhead = round2(summary.totalOverhead);
  summary.totalProfit = round2(summary.totalProfit);
  summary.totalRepCommission = round2(summary.totalRepCommission);
  summary.totalPresCommission = round2(summary.totalPresCommission);
  summary.totalVpCommission = round2(summary.totalVpCommission);
  summary.totalCompanyRetained = round2(summary.totalCompanyRetained);

  // ─── Aggregate: byRep ──────────────────────────────────────────────────
  const repMap = new Map<
    string,
    { jobCount: number; totalRevenue: number; totalProfit: number; totalCommission: number; marginSum: number }
  >();

  for (const j of jobs) {
    const key = j.salesRep || 'Unassigned';
    const entry = repMap.get(key) || {
      jobCount: 0,
      totalRevenue: 0,
      totalProfit: 0,
      totalCommission: 0,
      marginSum: 0,
    };
    entry.jobCount += 1;
    entry.totalRevenue += j.jobTotal;
    entry.totalProfit += j.jobProfit;
    entry.totalCommission += j.salesRepCommission;
    entry.marginSum += j.profitMargin * 100; // avg profit % of revenue
    repMap.set(key, entry);
  }

  const byRep: RepRow[] = Array.from(repMap.entries())
    .map(([salesRep, e]) => ({
      salesRep,
      jobCount: e.jobCount,
      totalRevenue: round2(e.totalRevenue),
      totalProfit: round2(e.totalProfit),
      totalCommission: round2(e.totalCommission),
      avgProfitPercent: e.jobCount > 0 ? round2(e.marginSum / e.jobCount) : 0,
    }))
    .sort((a, b) => b.totalProfit - a.totalProfit);

  // ─── Aggregate: byMonth ────────────────────────────────────────────────
  const monthMap = new Map<string, { jobCount: number; revenue: number; profit: number }>();
  for (const j of jobs) {
    const ym = toYM(j.dateInstalled);
    if (!ym) continue;
    const entry = monthMap.get(ym) || { jobCount: 0, revenue: 0, profit: 0 };
    entry.jobCount += 1;
    entry.revenue += j.jobTotal;
    entry.profit += j.jobProfit;
    monthMap.set(ym, entry);
  }

  const byMonth: MonthRow[] = Array.from(monthMap.entries())
    .map(([month, e]) => ({
      month,
      jobCount: e.jobCount,
      revenue: round2(e.revenue),
      profit: round2(e.profit),
      margin: e.revenue > 0 ? e.profit / e.revenue : 0,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return NextResponse.json({
    success: true,
    range: {
      from: fromBound.toISOString().slice(0, 10),
      to: toBound.toISOString().slice(0, 10),
    },
    summary,
    jobs,
    byRep,
    byMonth,
  });
}
