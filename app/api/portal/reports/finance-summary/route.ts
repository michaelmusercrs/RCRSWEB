/**
 * Finance Summary API
 *
 * GET /api/portal/reports/finance-summary?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Owner / admin only. Provides a consolidated P&L snapshot for the Finance
 * Dashboard. Aggregates three data sources:
 *
 *   1. CustomerBreakdowns (via listBreakdowns) — Revenue, COGS (material +
 *      labor), overhead, and profit per job.
 *   2. commissions.json — 1099 commission payouts (a *different* number from
 *      breakdown commissions; this is what QuickBooks says went out the door).
 *   3. UnifiedInventoryService.getInventoryValue() — current inventory at cost.
 *
 * The response is structured so the front-end Finance Dashboard can render
 * KPI cards, quick-link counts, and a 12-month trend bar chart without
 * further computation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRoleAtLeast } from '@/lib/auth-service';
import { listBreakdowns } from '@/lib/customer-breakdown-service';
import { unifiedInventoryService } from '@/lib/unified-inventory-service';
import commissionsData from '@/data/commissions.json';

// ─── Types ──────────────────────────────────────────────────────────────

interface CommissionRaw {
  salesRep: string;
  date: string;   // MM/DD/YYYY or MM/DD/YY
  amount: number;
  balance: number;
  jobNumber: string;
  customer: string;
}

interface MonthBucket {
  month: string; // YYYY-MM
  revenue: number;
  profit: number;
  cogs: number;
  commissions: number;
  jobCount: number;
}

interface FinanceSummary {
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number;          // grossProfit / revenue (0–1)
  commissions: number;
  overhead: number;
  netProfit: number;            // revenue - cogs - commissions - overhead
  inventoryValue: number;       // current stock at cost
  jobCount: number;
  monthly: MonthBucket[];
}

// ─── Helpers ────────────────────────────────────────────────────────────

function parseDateOrNull(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/** Parse MM/DD/YYYY or MM/DD/YY → Date */
function parseCommDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.trim().split('/');
  if (parts.length !== 3) return null;
  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  let year = parseInt(parts[2], 10);
  if (isNaN(month) || isNaN(day) || isNaN(year)) return null;
  if (year < 100) year += 2000;
  return new Date(year, month - 1, day);
}

function toYMD(iso: string | undefined): string {
  if (!iso) return '';
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  if (match) return match[1];
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function toYM(iso: string | undefined): string {
  return toYMD(iso).slice(0, 7);
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // SECURITY 2026-05-20: cost/commission/finance data — owner/admin/office/manager tier only.
  // Richard ('driver') is allowed by slug per cost-visibility rule.
  const auth = await requireRoleAtLeast(['owner', 'admin', 'office', 'manager']);
  if (!auth.authenticated) return auth.response;

  const url = new URL(req.url);
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');

  // Default: current calendar month
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0); // last day of month

  const from = parseDateOrNull(fromParam) || defaultFrom;
  const to = parseDateOrNull(toParam) || defaultTo;
  const fromBound = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0);
  const toBound = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999);

  // ── 1. Breakdowns (Revenue + COGS + overhead) ─────────────────────────

  let allBreakdowns: Awaited<ReturnType<typeof listBreakdowns>> = [];
  try {
    allBreakdowns = await listBreakdowns();
  } catch (err) {
    console.error('[finance-summary] listBreakdowns failed:', err);
  }

  const inRange = allBreakdowns.filter(({ breakdown }) => {
    const ymd = toYMD(breakdown.dateInstalled);
    if (!ymd) return false;
    const d = new Date(ymd);
    return !isNaN(d.getTime()) && d >= fromBound && d <= toBound;
  });

  let totalRevenue = 0;
  let totalMaterial = 0;
  let totalLabor = 0;
  let totalOverhead = 0;

  const monthlyMap = new Map<string, MonthBucket>();

  for (const { breakdown, totals } of inRange) {
    const rev = Number(totals.jobTotal) || 0;
    const mat = Number(totals.materialSubtotal) || 0;
    const lab = Number(totals.laborTotal) || 0;
    const oh = Number(totals.overheadTotal) || 0;

    totalRevenue += rev;
    totalMaterial += mat;
    totalLabor += lab;
    totalOverhead += oh;

    const ym = toYM(breakdown.dateInstalled);
    if (ym) {
      const bucket = monthlyMap.get(ym) || { month: ym, revenue: 0, profit: 0, cogs: 0, commissions: 0, jobCount: 0 };
      bucket.revenue += rev;
      bucket.cogs += mat + lab;
      bucket.profit += rev - mat - lab - oh;
      bucket.jobCount += 1;
      monthlyMap.set(ym, bucket);
    }
  }

  const totalCOGS = totalMaterial + totalLabor;
  const grossProfit = totalRevenue - totalCOGS;

  // ── 2. Commissions from commissions.json ──────────────────────────────

  let totalCommissions = 0;
  const comms = commissionsData as CommissionRaw[];
  for (const c of comms) {
    const d = parseCommDate(c.date);
    if (!d) continue;
    if (d >= fromBound && d <= toBound) {
      totalCommissions += Number(c.amount) || 0;
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const bucket = monthlyMap.get(ym) || { month: ym, revenue: 0, profit: 0, cogs: 0, commissions: 0, jobCount: 0 };
      bucket.commissions += Number(c.amount) || 0;
      monthlyMap.set(ym, bucket);
    }
  }

  // ── 3. Inventory value ────────────────────────────────────────────────

  let inventoryValue = 0;
  try {
    const inv = await unifiedInventoryService.getInventoryValue();
    inventoryValue = inv.totalCost;
  } catch (err) {
    console.error('[finance-summary] getInventoryValue failed:', err);
  }

  // ── Assemble ──────────────────────────────────────────────────────────

  const netProfit = totalRevenue - totalCOGS - totalCommissions - totalOverhead;

  const monthly: MonthBucket[] = Array.from(monthlyMap.values()).sort((a, b) =>
    a.month.localeCompare(b.month)
  );

  const summary: FinanceSummary = {
    revenue: r2(totalRevenue),
    cogs: r2(totalCOGS),
    grossProfit: r2(grossProfit),
    grossMargin: totalRevenue > 0 ? r2(grossProfit / totalRevenue) : 0,
    commissions: r2(totalCommissions),
    overhead: r2(totalOverhead),
    netProfit: r2(netProfit),
    inventoryValue: r2(inventoryValue),
    jobCount: inRange.length,
    monthly,
  };

  return NextResponse.json(
    { success: true, range: { from: fromBound.toISOString().slice(0, 10), to: toBound.toISOString().slice(0, 10) }, ...summary },
    {
      headers: {
        'Cache-Control': 'private, max-age=60',
      },
    }
  );
}
