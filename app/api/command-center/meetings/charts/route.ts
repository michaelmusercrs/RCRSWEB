/**
 * RCRS Command Center - Meeting Charts Data API
 *
 * Provides pre-computed chart data from meeting numbers (sales) and
 * commission payouts for rendering graphs in the Monday meeting presentation.
 *
 * GET /api/command-center/meetings/charts
 * Query params:
 *   - period: 'week' | 'month' | 'quarter' | 'year' (default: 'year')
 *
 * Returns: revenue trend, commission trend, rep comparisons, key metrics,
 * quarterly breakdowns — all filtered by the requested period.
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import * as path from 'path';
import { requireAuth } from '@/lib/auth-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================================
// Types
// ============================================================================

interface RawMeetingRecord {
  meetingDate: string;
  tabName: string;
  repName: string;
  Inspected: string;
  Damage: string;
  Signed: string;
  Repair: string;
  Gutter: string;
  '$$$$$': string;
  Approved: string;
  Goal: string;
  Referrals: string;
  Agents: string;
  Present: string;
  'Home Show': string;
}

interface CommissionRecord {
  salesRep: string;
  date: string;
  amount: number;
  balance: number;
  jobNumber: string;
  customer: string;
}

interface ParsedMeeting {
  meetingDate: string;
  repName: string;
  inspected: number;
  damage: number;
  signed: number;
  revenue: number;
  approved: number;
}

// ============================================================================
// NON-SALES filter (Michael, Chris, Sara, Boston never on leaderboards)
// ============================================================================

const NON_SALES = ['michael', 'chris', 'sara', 'boston', 'michael muse', 'chris muse', 'sara hill', 'boston muse'];

function isSalesRep(name: string): boolean {
  return !NON_SALES.some(n => name.toLowerCase().includes(n));
}

// ============================================================================
// Data helpers
// ============================================================================

function parseNum(val: string | undefined | null): number {
  if (!val || val.trim() === '') return 0;
  const cleaned = val.replace(/[$,]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function loadMeetingData(): ParsedMeeting[] {
  const allPath = path.join(process.cwd(), 'data', 'meeting-numbers-all.json');
  const yearPath = path.join(process.cwd(), 'data', 'meeting-numbers-2026.json');

  let rawRecords: RawMeetingRecord[] = [];

  if (existsSync(allPath)) {
    rawRecords = JSON.parse(readFileSync(allPath, 'utf-8'));
  }
  if (existsSync(yearPath)) {
    const yearRecords: RawMeetingRecord[] = JSON.parse(readFileSync(yearPath, 'utf-8'));
    rawRecords = [...rawRecords, ...yearRecords];
  }

  // Deduplicate by meetingDate+repName (keep entry with more data)
  const keyMap = new Map<string, RawMeetingRecord>();
  for (const r of rawRecords) {
    const key = `${r.meetingDate}|${r.repName}`;
    const existing = keyMap.get(key);
    if (!existing) {
      keyMap.set(key, r);
    } else {
      const countFields = (rec: RawMeetingRecord) =>
        [rec.Inspected, rec.Damage, rec.Signed, rec['$$$$$'], rec.Approved].filter(v => v && v.trim() !== '' && v !== '0').length;
      if (countFields(r) > countFields(existing)) {
        keyMap.set(key, r);
      }
    }
  }

  return Array.from(keyMap.values()).map(raw => ({
    meetingDate: raw.meetingDate,
    repName: raw.repName,
    inspected: parseNum(raw.Inspected),
    damage: parseNum(raw.Damage),
    signed: parseNum(raw.Signed),
    revenue: parseNum(raw['$$$$$']),
    approved: parseNum(raw.Approved),
  }));
}

function loadCommissionData(): CommissionRecord[] {
  const commPath = path.join(process.cwd(), 'data', 'commissions.json');
  if (!existsSync(commPath)) return [];
  return JSON.parse(readFileSync(commPath, 'utf-8'));
}

// ============================================================================
// Date helpers
// ============================================================================

function getQuarter(date: Date): number {
  return Math.floor(date.getMonth() / 3) + 1;
}

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function getMonthKey(dateStr: string): string {
  return dateStr.substring(0, 7); // YYYY-MM
}

function getQuarterKey(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getFullYear()}-Q${getQuarter(d)}`;
}

function getYearKey(dateStr: string): string {
  return dateStr.substring(0, 4);
}

// ============================================================================
// Revenue trend builder
// ============================================================================

function buildRevenueTrend(meetings: ParsedMeeting[], period: string) {
  const buckets = new Map<string, { label: string; revenue: number; inspected: number; damage: number; signed: number }>();

  for (const m of meetings) {
    let key: string;
    let label: string;

    switch (period) {
      case 'week': {
        key = getWeekStart(new Date(m.meetingDate + 'T00:00:00'));
        const d = new Date(key + 'T00:00:00');
        label = `${d.getMonth() + 1}/${d.getDate()}`;
        break;
      }
      case 'month': {
        key = getMonthKey(m.meetingDate);
        const [y, mo] = key.split('-');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        label = `${months[parseInt(mo) - 1]} ${y.slice(2)}`;
        break;
      }
      case 'quarter': {
        key = getQuarterKey(m.meetingDate);
        label = key;
        break;
      }
      default: {
        key = getYearKey(m.meetingDate);
        label = key;
        break;
      }
    }

    const existing = buckets.get(key) || { label, revenue: 0, inspected: 0, damage: 0, signed: 0 };
    existing.revenue += m.revenue;
    existing.inspected += m.inspected;
    existing.damage += m.damage;
    existing.signed += m.signed;
    buckets.set(key, existing);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
}

// ============================================================================
// Commission trend builder
// ============================================================================

function buildCommissionTrend(commissions: CommissionRecord[], period: string) {
  const buckets = new Map<string, { label: string; commissions: number; transactions: number }>();

  for (const c of commissions) {
    if (!c.date) continue;

    // Parse MM/DD/YYYY date format
    const parts = c.date.split('/');
    if (parts.length !== 3) continue;
    const isoDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;

    let key: string;
    let label: string;

    switch (period) {
      case 'week': {
        key = getWeekStart(new Date(isoDate + 'T00:00:00'));
        const d = new Date(key + 'T00:00:00');
        label = `${d.getMonth() + 1}/${d.getDate()}`;
        break;
      }
      case 'month': {
        key = getMonthKey(isoDate);
        const [y, mo] = key.split('-');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        label = `${months[parseInt(mo) - 1]} ${y.slice(2)}`;
        break;
      }
      case 'quarter': {
        key = getQuarterKey(isoDate);
        label = key;
        break;
      }
      default: {
        key = getYearKey(isoDate);
        label = key;
        break;
      }
    }

    const existing = buckets.get(key) || { label, commissions: 0, transactions: 0 };
    existing.commissions += c.amount || 0;
    existing.transactions += 1;
    buckets.set(key, existing);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
}

// ============================================================================
// Rep comparison builders
// ============================================================================

function buildRepSalesComparison(meetings: ParsedMeeting[], period: string) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentQuarter = getQuarter(now);

  // Filter to period
  const filtered = meetings.filter(m => {
    const d = new Date(m.meetingDate + 'T00:00:00');
    const year = d.getFullYear();
    switch (period) {
      case 'week': {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return d >= weekAgo;
      }
      case 'month':
        return year === currentYear && d.getMonth() === currentMonth;
      case 'quarter':
        return year === currentYear && getQuarter(d) === currentQuarter;
      default:
        return year === currentYear;
    }
  });

  // Aggregate by rep
  const repTotals = new Map<string, number>();
  for (const m of filtered) {
    if (!isSalesRep(m.repName)) continue;
    repTotals.set(m.repName, (repTotals.get(m.repName) || 0) + m.revenue);
  }

  return Array.from(repTotals.entries())
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 15);
}

function buildRepCommissionComparison(commissions: CommissionRecord[], period: string) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentQuarter = getQuarter(now);

  const filtered = commissions.filter(c => {
    if (!c.date) return false;
    const parts = c.date.split('/');
    if (parts.length !== 3) return false;
    const d = new Date(`${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}T00:00:00`);
    const year = d.getFullYear();
    switch (period) {
      case 'week': {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return d >= weekAgo;
      }
      case 'month':
        return year === currentYear && d.getMonth() === currentMonth;
      case 'quarter':
        return year === currentYear && getQuarter(d) === currentQuarter;
      default:
        return year === currentYear;
    }
  });

  // Aggregate by rep
  const repTotals = new Map<string, number>();
  for (const c of filtered) {
    if (!isSalesRep(c.salesRep)) continue;
    repTotals.set(c.salesRep, (repTotals.get(c.salesRep) || 0) + (c.amount || 0));
  }

  return Array.from(repTotals.entries())
    .map(([name, commissions]) => ({ name, commissions }))
    .filter(r => r.commissions > 0)
    .sort((a, b) => b.commissions - a.commissions)
    .slice(0, 15);
}

// ============================================================================
// Quarterly breakdown (current year)
// ============================================================================

function buildQuarterlyBreakdown(meetings: ParsedMeeting[], commissions: CommissionRecord[]) {
  const currentYear = new Date().getFullYear();

  const quarters = [
    { label: 'Q1', revenue: 0, commissions: 0 },
    { label: 'Q2', revenue: 0, commissions: 0 },
    { label: 'Q3', revenue: 0, commissions: 0 },
    { label: 'Q4', revenue: 0, commissions: 0 },
  ];

  for (const m of meetings) {
    const d = new Date(m.meetingDate + 'T00:00:00');
    if (d.getFullYear() === currentYear) {
      const q = getQuarter(d) - 1;
      quarters[q].revenue += m.revenue;
    }
  }

  for (const c of commissions) {
    if (!c.date) continue;
    const parts = c.date.split('/');
    if (parts.length !== 3) continue;
    const year = parseInt(parts[2]);
    if (year === currentYear) {
      const month = parseInt(parts[0]);
      const q = Math.floor((month - 1) / 3);
      quarters[q].commissions += c.amount || 0;
    }
  }

  return quarters;
}

// ============================================================================
// GET handler
// ============================================================================

export async function GET(req: NextRequest) {
  // SECURITY 2026-05-20: was unauthenticated — leaked revenue/commission
  // trend charts, per-rep comparisons, and quarterly breakdowns. Gate to
  // any authenticated team member as the minimum.
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || 'year';

    if (!['week', 'month', 'quarter', 'year'].includes(period)) {
      return NextResponse.json({ success: false, error: 'Invalid period. Use: week, month, quarter, year' }, { status: 400 });
    }

    const meetings = loadMeetingData();
    const commissions = loadCommissionData();

    // For week/month views, limit revenue trend data to current year
    let trendMeetings = meetings;
    let trendCommissions = commissions;
    const currentYear = new Date().getFullYear();

    if (period === 'week') {
      // Last 12 weeks
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 84);
      const cutoffStr = cutoff.toISOString().split('T')[0];
      trendMeetings = meetings.filter(m => m.meetingDate >= cutoffStr);
      trendCommissions = commissions.filter(c => {
        if (!c.date) return false;
        const parts = c.date.split('/');
        if (parts.length !== 3) return false;
        const iso = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
        return iso >= cutoffStr;
      });
    } else if (period === 'month') {
      // Current year only for monthly view
      trendMeetings = meetings.filter(m => m.meetingDate.startsWith(String(currentYear)));
      trendCommissions = commissions.filter(c => {
        if (!c.date) return false;
        const parts = c.date.split('/');
        return parts.length === 3 && parseInt(parts[2]) === currentYear;
      });
    } else if (period === 'quarter') {
      // Last 3 years for quarterly view
      const minYear = currentYear - 2;
      trendMeetings = meetings.filter(m => parseInt(m.meetingDate.substring(0, 4)) >= minYear);
      trendCommissions = commissions.filter(c => {
        if (!c.date) return false;
        const parts = c.date.split('/');
        return parts.length === 3 && parseInt(parts[2]) >= minYear;
      });
    }

    const data = {
      period,
      revenueTrend: buildRevenueTrend(trendMeetings, period),
      commissionTrend: buildCommissionTrend(trendCommissions, period),
      repSales: buildRepSalesComparison(meetings, period),
      repCommissions: buildRepCommissionComparison(commissions, period),
      keyMetrics: buildRevenueTrend(trendMeetings, period), // same structure, includes inspected/damage/signed
      quarterly: buildQuarterlyBreakdown(meetings, commissions),
      dataRange: {
        meetingsFrom: meetings.length > 0 ? meetings.reduce((min, m) => m.meetingDate < min ? m.meetingDate : min, meetings[0].meetingDate) : null,
        meetingsTo: meetings.length > 0 ? meetings.reduce((max, m) => m.meetingDate > max ? m.meetingDate : max, meetings[0].meetingDate) : null,
        commissionsCount: commissions.length,
        meetingsCount: meetings.length,
      },
    };

    return NextResponse.json({ success: true, data }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to generate chart data' },
      { status: 500 }
    );
  }
}
