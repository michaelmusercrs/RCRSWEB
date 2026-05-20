/**
 * RCRS Commission Reconciliation Report API
 *
 * GET /api/portal/reports/commissions?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Admin/Owner-only. Reads data/commissions.json, filters by date range,
 * groups by (resolved) sales rep name, and returns summary + per-rep breakdown.
 *
 * Response shape:
 * {
 *   success: true,
 *   dateRange: { from, to },
 *   summary: { totalPaid, repCount, avgPerRep, totalTransactions },
 *   byRep: [{ repName, jobCount, earned, paid, outstanding, rows: [...] }],
 *   rawRows: [{ date, parsedDate, salesRep, amount, balance, jobNumber, customer }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRoleAtLeast } from '@/lib/auth-service';
import { resolveCommissionName, isInternalSalesRep } from '@/lib/team-roles';
import commissionsData from '@/data/commissions.json';

interface RawCommission {
  salesRep: string;
  date: string;
  amount: number;
  balance: number;
  jobNumber?: string;
  customer?: string;
}

interface RowOut {
  date: string;
  parsedDate: string;
  salesRep: string;
  amount: number;
  balance: number;
  jobNumber: string;
  customer: string;
}

interface ByRepEntry {
  repName: string;
  jobCount: number;
  earned: number;
  paid: number;
  outstanding: number;
  rows: RowOut[];
}

/** Parse MM/DD/YYYY -> YYYY-MM-DD */
function parseDateToIso(dateStr: string): string | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.trim().split('/');
  if (parts.length !== 3) return null;
  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  let year = parseInt(parts[2], 10);
  if (isNaN(month) || isNaN(day) || isNaN(year)) return null;
  if (year < 100) year = 2000 + year;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export async function GET(request: NextRequest) {
  // SECURITY 2026-05-20: cost/commission data — owner/admin/office/manager tier only.
  // Richard ('driver') is allowed by slug per cost-visibility rule.
  const auth = await requireRoleAtLeast(['owner', 'admin', 'office', 'manager']);
  if (!auth.authenticated) return auth.response;

  const { searchParams } = new URL(request.url);

  // Default date range: first day of current month to today
  const now = new Date();
  const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const defaultTo = now.toISOString().slice(0, 10);
  const from = searchParams.get('from') || defaultFrom;
  const to = searchParams.get('to') || defaultTo;

  const raw = commissionsData as RawCommission[];
  const filteredRows: RowOut[] = [];

  for (const rec of raw) {
    const iso = parseDateToIso(rec.date);
    if (!iso) continue;
    if (iso < from || iso > to) continue;
    const resolved = resolveCommissionName(rec.salesRep);
    filteredRows.push({
      date: rec.date,
      parsedDate: iso,
      salesRep: resolved,
      amount: Number(rec.amount) || 0,
      balance: Number(rec.balance) || 0,
      jobNumber: rec.jobNumber || '',
      customer: rec.customer || '',
    });
  }

  // Sort by date desc
  filteredRows.sort((a, b) => b.parsedDate.localeCompare(a.parsedDate));

  // Group by resolved rep name
  const repMap = new Map<string, ByRepEntry>();
  let totalPaid = 0;
  let totalTransactions = 0;

  for (const row of filteredRows) {
    totalTransactions++;
    totalPaid += row.amount;

    if (!repMap.has(row.salesRep)) {
      repMap.set(row.salesRep, {
        repName: row.salesRep,
        jobCount: 0,
        earned: 0,
        paid: 0,
        outstanding: 0,
        rows: [],
      });
    }
    const entry = repMap.get(row.salesRep)!;
    entry.jobCount++;
    entry.earned += row.amount + Math.max(0, row.balance);
    entry.paid += row.amount;
    entry.outstanding += Math.max(0, row.balance);
    entry.rows.push(row);
  }

  // Sort reps by paid descending
  const byRep = Array.from(repMap.values()).sort((a, b) => b.paid - a.paid);

  const repCount = byRep.length;
  const avgPerRep = repCount > 0 ? totalPaid / repCount : 0;

  return NextResponse.json({
    success: true,
    dateRange: { from, to },
    summary: {
      totalPaid,
      repCount,
      avgPerRep,
      totalTransactions,
    },
    byRep,
    rawRows: filteredRows,
  });
}
