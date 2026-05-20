/**
 * Chris View — TV Leaderboard data endpoint.
 *
 * Aggregates the three RCRS leaderboards (Commission / Sales / Weekly) plus
 * a recent-activity ticker for the office TV at /chrisview/board.
 *
 * Public-read like the rest of /chrisview (middleware.ts allows
 * /api/chrisview/*). Whitelisted by `/chrisview` already being public-read;
 * every field we expose here is ALREADY reachable via:
 *   - /api/chrisview?type=reps         (rep names + commissionTotal + invoiceTotal)
 *   - /api/chrisview?type=charts       (salesActivityWeeks: meeting $$$$$ accrual)
 *   - /api/chrisview?type=recent       (last 20 transactions w/ party + rep + amount)
 * No NEW data surface is created.
 *
 * Per [[project_rcrs_leaderboards]]: three boards are DIFFERENT NUMBERS and
 * must never be combined. Each block in the response is independently sourced:
 *   - commission : QB 1099 source       (data/commissions.json)
 *   - sales      : Monday accrual $$$$$ (data/meeting-numbers-*.json)
 *   - weekly     : current-week signs   (data/meeting-numbers-2026.json, latest week)
 *
 * Cached 60s s-maxage so 10 TVs polling don't multiply DB load.
 */

import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import commissions from '@/data/commissions.json';
import meetingNumbersAll from '@/data/meeting-numbers-all.json';
import meetingNumbers2026 from '@/data/meeting-numbers-2026.json';
import transactionsByRep from '@/data/transactions-by-rep.json';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface CommissionRow {
  salesRep: string;
  date: string;       // "MM/DD/YYYY"
  amount: number;
  balance?: number;
  jobNumber?: string;
  customer?: string;
}

interface MeetingRow {
  meetingDate?: string;   // "YYYY-MM-DD"
  repName?: string;
  Inspected?: string;
  Signed?: string;
  $$$$$?: string;
}

interface Tx {
  date: string;       // "YYYY-MM-DD"
  type: string;
  num: string;
  amount: number;
  accountType: string;
  customer: string;
  vendor: string;
  salesRep: string;
  posting: boolean;
  employee?: string;
  project?: string;
}

interface LeaderEntry {
  rank: number;
  name: string;
  value: number;
  /** value as percent of leader (0-1). #1 is always 1.0. */
  pctOfLeader: number;
  /** Optional subtitle, e.g. "3 signed" or "$42K" — depends on board. */
  subtitle?: string;
}

interface ActivityEntry {
  date: string;
  label: string;     // human "Invoice I-6144" or "Payment"
  party: string;     // customer or vendor
  rep: string;
  amount: number;
  positive: boolean; // for color tint
}

interface BoardResponse {
  generatedAt: string;
  commission: {
    period: 'YTD';
    year: string;
    leaders: LeaderEntry[];
  };
  sales: {
    period: 'YTD-Monday-Accrual';
    year: string;
    leaders: LeaderEntry[];
  };
  weekly: {
    period: 'Latest-Meeting-Week';
    weekOf: string | null;
    leaders: LeaderEntry[];
  };
  activity: {
    items: ActivityEntry[];
  };
}

let _allTransactions: Tx[] | null = null;
async function loadTransactions(): Promise<Tx[]> {
  if (_allTransactions) return _allTransactions;
  const file = path.join(process.cwd(), 'data', 'transactions.json');
  const raw = await fs.readFile(file, 'utf8');
  _allTransactions = JSON.parse(raw) as Tx[];
  return _allTransactions;
}

// "MM/DD/YYYY" -> "YYYY-MM-DD" for comparable sort/filter
function commissionDateISO(d: string | undefined): string {
  if (!d) return '';
  const parts = d.split('/');
  if (parts.length !== 3) return '';
  const [m, dd, y] = parts;
  if (!m || !dd || !y) return '';
  return `${y}-${m.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

function rankWithPct(
  rows: Array<{ name: string; value: number; subtitle?: string }>,
): LeaderEntry[] {
  const top = rows[0]?.value || 0;
  return rows.map((r, i) => ({
    rank: i + 1,
    name: r.name,
    value: Math.round(r.value * 100) / 100,
    pctOfLeader: top > 0 ? Math.round((r.value / top) * 1000) / 1000 : 0,
    subtitle: r.subtitle,
  }));
}

function buildCommissionLeaders(): BoardResponse['commission'] {
  const now = new Date();
  const currentYear = String(now.getFullYear());
  const cutoffISO = `${currentYear}-01-01`;

  const totals = new Map<string, number>();
  for (const c of commissions as CommissionRow[]) {
    if (!c.salesRep || !c.amount || c.amount <= 0) continue;
    const iso = commissionDateISO(c.date);
    if (!iso || iso < cutoffISO) continue;
    totals.set(c.salesRep, (totals.get(c.salesRep) || 0) + c.amount);
  }
  // Fallback to lifetime if YTD has no entries yet (early-Jan edge case).
  let usedFallback = false;
  if (totals.size === 0) {
    usedFallback = true;
    for (const c of commissions as CommissionRow[]) {
      if (!c.salesRep || !c.amount || c.amount <= 0) continue;
      totals.set(c.salesRep, (totals.get(c.salesRep) || 0) + c.amount);
    }
  }

  const sorted = Array.from(totals.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return {
    period: 'YTD',
    year: usedFallback ? 'Lifetime' : currentYear,
    leaders: rankWithPct(sorted),
  };
}

function buildSalesLeaders(): BoardResponse['sales'] {
  const now = new Date();
  const currentYear = String(now.getFullYear());
  const all: MeetingRow[] = [
    ...(meetingNumbersAll as MeetingRow[]),
    ...(meetingNumbers2026 as MeetingRow[]),
  ];

  const totals = new Map<string, { value: number; signed: number }>();
  for (const m of all) {
    if (!m.meetingDate || !m.repName) continue;
    if (m.meetingDate.slice(0, 4) !== currentYear) continue;
    const rev = parseFloat(String(m.$$$$$ || '0').replace(/[$,]/g, '')) || 0;
    const signed = parseInt(String(m.Signed || '0'), 10) || 0;
    if (rev <= 0 && signed <= 0) continue;
    const cur = totals.get(m.repName) || { value: 0, signed: 0 };
    cur.value += rev;
    cur.signed += signed;
    totals.set(m.repName, cur);
  }

  const sorted = Array.from(totals.entries())
    .map(([name, v]) => ({
      name,
      value: v.value,
      subtitle: v.signed > 0 ? `${v.signed} signed` : undefined,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return {
    period: 'YTD-Monday-Accrual',
    year: currentYear,
    leaders: rankWithPct(sorted),
  };
}

function buildWeeklyLeaders(): BoardResponse['weekly'] {
  // Find latest meetingDate in 2026 file, then aggregate that week only.
  const rows = meetingNumbers2026 as MeetingRow[];
  let latest = '';
  for (const m of rows) {
    if (m.meetingDate && m.meetingDate > latest) latest = m.meetingDate;
  }
  if (!latest) {
    return { period: 'Latest-Meeting-Week', weekOf: null, leaders: [] };
  }

  const totals = new Map<string, { signed: number; inspected: number; rev: number }>();
  for (const m of rows) {
    if (m.meetingDate !== latest || !m.repName) continue;
    const signed = parseInt(String(m.Signed || '0'), 10) || 0;
    const inspected = parseInt(String(m.Inspected || '0'), 10) || 0;
    const rev = parseFloat(String(m.$$$$$ || '0').replace(/[$,]/g, '')) || 0;
    if (signed <= 0 && inspected <= 0 && rev <= 0) continue;
    const cur = totals.get(m.repName) || { signed: 0, inspected: 0, rev: 0 };
    cur.signed += signed;
    cur.inspected += inspected;
    cur.rev += rev;
    totals.set(m.repName, cur);
  }

  // Rank by signed (primary) then revenue (tiebreaker), then inspected.
  const sorted = Array.from(totals.entries())
    .map(([name, v]) => ({
      name,
      // Use signed as the headline metric for weekly self-report
      value: v.signed,
      subtitle:
        v.rev > 0
          ? `${v.inspected} inspected · $${(v.rev / 1000).toFixed(0)}K`
          : `${v.inspected} inspected`,
      _rev: v.rev,
    }))
    .sort((a, b) => b.value - a.value || b._rev - a._rev)
    .slice(0, 5)
    .map(({ name, value, subtitle }) => ({ name, value, subtitle }));

  return {
    period: 'Latest-Meeting-Week',
    weekOf: latest,
    leaders: rankWithPct(sorted),
  };
}

async function buildActivity(): Promise<BoardResponse['activity']> {
  const all = await loadTransactions();
  // Transactions are newest-first. The transaction file has DAY resolution
  // (no timestamps), so "last 30 minutes" can't be literal — we surface the
  // top 25 most recent ledger entries instead. The /api/chrisview?type=recent
  // endpoint already exposes the same shape (party + rep + amount) publicly.
  const items: ActivityEntry[] = [];
  for (const t of all.slice(0, 25)) {
    const positive = t.amount >= 0;
    const label = t.num ? `${t.type} ${t.num}` : t.type;
    items.push({
      date: t.date,
      label,
      party: t.customer || t.vendor || t.employee || '',
      rep: t.salesRep || '',
      amount: t.amount,
      positive,
    });
  }
  return { items };
}

export async function GET() {
  try {
    const [commission, sales, weekly, activity] = [
      buildCommissionLeaders(),
      buildSalesLeaders(),
      buildWeeklyLeaders(),
      await buildActivity(),
    ];
    // Silence the unused-import warning when transactionsByRep is left in
    // for future "all-time" toggle. Touch it so TS doesn't flag.
    void transactionsByRep;

    const body: BoardResponse = {
      generatedAt: new Date().toISOString(),
      commission,
      sales,
      weekly,
      activity,
    };

    return NextResponse.json(body, {
      headers: {
        // 60s edge cache so 10 TVs polling every 60s = ~1 origin hit/min total
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
