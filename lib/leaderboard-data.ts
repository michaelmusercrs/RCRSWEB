/**
 * Unified-Leaderboards data helper
 * ----------------------------------------------------------------------------
 * Server-only. Produces the data shape consumed by
 * `components/UnifiedLeaderboards.tsx`.
 *
 * Reads from the three CANONICAL sources (hard rule — never combine):
 *   1. Commission Board — data/commissions.json (QB 1099 cash paid YTD)
 *   2. Sales Board      — Monday meeting accrual ($$$$$ column) via
 *                          meetingNumbersService
 *   3. Weekly Board     — rep self-report via
 *                          googleSheetsService.getRepWeeklyNumbers
 *
 * NOTE: This module uses `fs` and is NOT safe to import into a client
 * component. Use it from a server component, an API route, or
 * `getServerSideProps`-equivalent contexts only.
 */

import * as fs from 'fs';
import * as path from 'path';
import { meetingNumbersService } from './meeting-numbers-service';
import { googleSheetsService } from './google-sheets-service';
import { resolveCommissionName } from './team-roles';
import type { LeaderRow } from '@/components/UnifiedLeaderboards';

// =============================================================================
// CONSTANTS — must match the existing leaderboard route exclusion rules
// =============================================================================

const EXCLUDED_FROM_LEADERBOARD = [
  'michael',
  'chris',
  'sara',
  'john',
  'bart',
  'rudy',
  'tae',
  'destin',
  'tia',
  'boston',
];

const TOP_N = 10; // Pull a bit more than the widget shows so View All works

// =============================================================================
// TYPES
// =============================================================================

interface CommissionRecord {
  salesRep: string;
  date: string; // MM/DD/YYYY
  amount: number;
  balance?: number;
  jobNumber?: string;
  customer?: string;
}

export interface UnifiedLeaderboardsData {
  commission: {
    period: string;
    year: string;
    leaders: LeaderRow[];
  };
  sales: {
    period: string;
    year: string;
    leaders: LeaderRow[];
  };
  weekly: {
    period: string;
    weekOf: string;
    leaders: LeaderRow[];
  };
}

// =============================================================================
// DATE HELPERS
// =============================================================================

/** Convert MM/DD/YYYY -> YYYY-MM-DD for string comparison */
function commissionDateToIso(dateStr: string): string {
  const parts = (dateStr || '').split('/');
  if (parts.length !== 3) return '';
  const [mm, dd, yyyy] = parts;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function today(): Date {
  return new Date();
}

function getCurrentYear(): number {
  return today().getFullYear();
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Returns the Monday of the ISO week containing the given date. */
function mondayOf(d: Date): Date {
  const day = d.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(d.getDate() + diff);
  m.setHours(0, 0, 0, 0);
  return m;
}

/** Current ISO week string YYYY-Wnn (matches the RepWeeklyNumbers sheet format). */
function currentIsoWeek(d: Date = today()): string {
  // ISO week calc
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(
    ((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${target.getUTCFullYear()}-W${pad2(weekNum)}`;
}

function humanWeekOf(d: Date = today()): string {
  const m = mondayOf(d);
  return m.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// =============================================================================
// COMMON UTILS
// =============================================================================

function isExcluded(repName: string): boolean {
  const name = (repName || '').toLowerCase().trim();
  if (!name) return true;
  return EXCLUDED_FROM_LEADERBOARD.some((bad) => name === bad || name.startsWith(`${bad} `));
}

function buildLeaderRows(
  entries: Array<{ name: string; value: number; subtitle?: string }>,
): LeaderRow[] {
  if (entries.length === 0) return [];
  const sorted = [...entries].sort((a, b) => b.value - a.value);
  const leader = sorted[0].value || 1; // avoid div-by-zero
  return sorted.slice(0, TOP_N).map((e, i) => ({
    rank: i + 1,
    name: e.name,
    value: Math.round(e.value),
    pctOfLeader: leader > 0 ? e.value / leader : 0,
    subtitle: e.subtitle,
  }));
}

// =============================================================================
// COMMISSION BOARD — QB 1099 cash YTD from data/commissions.json
// =============================================================================

function loadCommissionLeaders(year: number): LeaderRow[] {
  const filePath = path.join(process.cwd(), 'data', 'commissions.json');
  let records: CommissionRecord[] = [];

  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf-8');
    records = JSON.parse(raw);
  } catch (err) {
    console.error('[leaderboard-data] commissions.json read failed:', err);
    return [];
  }

  const yearPrefix = String(year);
  const ytdStart = `${yearPrefix}-01-01`;
  const ytdEnd = `${yearPrefix}-12-31`;

  const byRep = new Map<string, number>();
  for (const rec of records) {
    if (!rec.amount || rec.amount <= 0) continue;
    const iso = commissionDateToIso(rec.date);
    if (!iso || iso < ytdStart || iso > ytdEnd) continue;
    const canonical = resolveCommissionName(rec.salesRep);
    if (isExcluded(canonical)) continue;
    byRep.set(canonical, (byRep.get(canonical) || 0) + rec.amount);
  }

  const entries = Array.from(byRep.entries()).map(([name, value]) => ({ name, value }));
  return buildLeaderRows(entries);
}

// =============================================================================
// SALES BOARD — Monday meeting $$$$$ accrual YTD
// =============================================================================

function loadSalesLeaders(year: number): LeaderRow[] {
  try {
    const ytdStart = `${year}-01-01`;
    const ytdEnd = `${year}-12-31`;
    const entries = meetingNumbersService.getLeaderboard('revenue', {
      startDate: ytdStart,
      endDate: ytdEnd,
    });

    const mapped = entries
      .filter((e) => !isExcluded(e.repName))
      .filter((e) => e.value > 0)
      .map((e) => ({
        name: e.repName,
        value: e.value,
        subtitle: `${e.totals.signed || 0} signed`,
      }));

    return buildLeaderRows(mapped);
  } catch (err) {
    console.error('[leaderboard-data] meetingNumbersService failure:', err);
    return [];
  }
}

// =============================================================================
// WEEKLY BOARD — rep self-report (this week)
// =============================================================================

async function loadWeeklyLeaders(): Promise<LeaderRow[]> {
  const week = currentIsoWeek();
  try {
    const records = await googleSheetsService.getRepWeeklyNumbers({
      weekStart: week,
      weekEnd: week,
    });

    const byRep = new Map<
      string,
      { doors: number; appts: number; signed: number; revenue: number }
    >();

    for (const r of records) {
      if (isExcluded(r.repName)) continue;
      const cur = byRep.get(r.repName) || { doors: 0, appts: 0, signed: 0, revenue: 0 };
      cur.doors += r.doorsKnocked || 0;
      cur.appts += r.appointmentsSet || 0;
      cur.signed += r.contractsSigned || 0;
      cur.revenue += r.revenueClosed || 0;
      byRep.set(r.repName, cur);
    }

    // Composite weekly activity score: doors + (appts*5) + (signed*25)
    // Weighting reflects roughly the relative effort/outcome value.
    const entries = Array.from(byRep.entries()).map(([name, stats]) => ({
      name,
      value: stats.doors + stats.appts * 5 + stats.signed * 25,
      subtitle: `${stats.signed} signed · ${stats.appts} appts · ${stats.doors} doors`,
    }));

    return buildLeaderRows(entries);
  } catch (err) {
    console.error('[leaderboard-data] getRepWeeklyNumbers failure:', err);
    return [];
  }
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Pull data for all three leaderboards in parallel.
 *
 * Each board falls back to an empty leader list on failure — the widget will
 * render its "No data yet" empty state. We never fabricate.
 */
export async function fetchUnifiedLeaderboards(): Promise<UnifiedLeaderboardsData> {
  const year = getCurrentYear();
  const yearStr = String(year);
  const weekOf = humanWeekOf();

  // Run independent reads in parallel
  const [commissionLeaders, salesLeaders, weeklyLeaders] = await Promise.all([
    Promise.resolve(loadCommissionLeaders(year)),
    Promise.resolve(loadSalesLeaders(year)),
    loadWeeklyLeaders(),
  ]);

  return {
    commission: {
      period: `YTD ${yearStr}`,
      year: yearStr,
      leaders: commissionLeaders,
    },
    sales: {
      period: `YTD ${yearStr}`,
      year: yearStr,
      leaders: salesLeaders,
    },
    weekly: {
      period: `Week of ${weekOf}`,
      weekOf,
      leaders: weeklyLeaders,
    },
  };
}
