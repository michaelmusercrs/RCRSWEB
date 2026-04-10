/**
 * RCRS Sales Portal - My Commissions API
 *
 * Returns the logged-in sales rep's commission history from data/commissions.json.
 * Admins / owners / managers can optionally pass ?rep=<name> to view another rep.
 *
 * Response:
 *   {
 *     success: true,
 *     repName,
 *     summary: { ytd, month, quarter, lastPayoutDate, totalCount },
 *     rows: [{ date, amount, balance, jobNumber, customer, status }]
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { resolveCommissionName } from '@/lib/team-roles';
import commissionsData from '@/data/commissions.json';

interface RawCommission {
  salesRep: string;
  date: string;
  amount: number;
  balance: number;
  jobNumber?: string;
  customer?: string;
}

interface CommissionRow {
  date: string;         // original MM/DD/YYYY string
  parsedDate: string;   // YYYY-MM-DD for sorting
  amount: number;
  balance: number;
  jobNumber: string;
  customer: string;
  status: 'paid' | 'pending' | 'zero';
}

function isAdminLike(role: string): boolean {
  return role === 'owner' || role === 'admin' || role === 'manager';
}

/** Parse MM/DD/YYYY (or MM/DD/YY) into a YYYY-MM-DD ISO string, or null. */
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

/** Normalize names for comparison (case-insensitive, first-name fallback). */
function namesMatch(recordName: string, targetName: string): boolean {
  if (!recordName || !targetName) return false;
  const a = resolveCommissionName(recordName).toLowerCase().trim();
  const b = resolveCommissionName(targetName).toLowerCase().trim();
  if (a === b) return true;
  // First-name fallback (Monday sheet often uses "Rick", "Alijah", etc.)
  const aFirst = a.split(/\s+/)[0];
  const bFirst = b.split(/\s+/)[0];
  if (aFirst && bFirst && aFirst === bFirst) {
    // Only match first-name if one side has no last name
    if (a.split(/\s+/).length === 1 || b.split(/\s+/).length === 1) return true;
  }
  return false;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const { searchParams } = new URL(request.url);
  const requestedRep = searchParams.get('rep')?.trim() || '';
  const repName =
    requestedRep && isAdminLike(auth.user.role) ? requestedRep : auth.user.name;

  const raw = commissionsData as RawCommission[];
  const rows: CommissionRow[] = [];

  for (const rec of raw) {
    if (!namesMatch(rec.salesRep, repName)) continue;
    const iso = parseDateToIso(rec.date);
    if (!iso) continue;
    const amount = Number(rec.amount) || 0;
    const balance = Number(rec.balance) || 0;
    rows.push({
      date: rec.date,
      parsedDate: iso,
      amount,
      balance,
      jobNumber: rec.jobNumber || '',
      customer: rec.customer || '',
      status: amount === 0 ? 'zero' : balance > 0 ? 'pending' : 'paid',
    });
  }

  // Newest first
  rows.sort((a, b) => b.parsedDate.localeCompare(a.parsedDate));

  // Summary calculations
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const quarter = Math.floor(month / 3);

  let ytd = 0;
  let monthTotal = 0;
  let quarterTotal = 0;
  let lastPayoutDate = '';

  for (const r of rows) {
    const [y, m] = r.parsedDate.split('-').map(Number);
    const rowQuarter = Math.floor((m - 1) / 3);
    if (y === year) ytd += r.amount;
    if (y === year && m - 1 === month) monthTotal += r.amount;
    if (y === year && rowQuarter === quarter) quarterTotal += r.amount;
    if (!lastPayoutDate && r.amount > 0) lastPayoutDate = r.parsedDate;
  }

  return NextResponse.json({
    success: true,
    repName,
    summary: {
      ytd,
      month: monthTotal,
      quarter: quarterTotal,
      lastPayoutDate,
      totalCount: rows.length,
    },
    rows,
  });
}
