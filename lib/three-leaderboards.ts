/**
 * "Three leaderboards" composite — pulls the same per-rep numbers
 * from three different sources and displays them side-by-side.
 *
 * The whole point: these numbers DIFFER and that's not a bug.
 * Per [[project-rcrs-leaderboards]]:
 *   - Commission leaderboard: QB 1099 actual cash paid
 *   - Sales leaderboard:     Monday meeting accrual ($$$$$)
 *   - Weekly leaderboard:    Self-reported weekly numbers (signed × accrual)
 *
 * Each measures a different point in the lifecycle, so totals
 * will diverge. Showing them side-by-side prevents the
 * "wait why is Aaron $4.3M on one and $712K on the other" question.
 */
import { promises as fs } from 'fs';
import path from 'path';

interface Commission { salesRep: string; date: string; amount: number }
interface MeetingRow {
  meetingDate: string; repName: string;
  '$$$$$': string; Signed: string; Inspected: string;
}

function parseN(v: unknown): number {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').replace(/[,$]/g, '').trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export interface ThreeLeaderboardsResponse {
  generatedAt: string;
  windowMonths: number;
  windowLabel: string;
  commission: Array<{ rep: string; total: number; paymentCount: number }>;       // QB 1099 cash
  salesAccrual: Array<{ rep: string; total: number; weeks: number; signed: number }>;  // Monday meeting $$$$$
  perWeekAvg: Array<{ rep: string; avgAccrualPerWeek: number; avgSignedPerWeek: number; weeks: number }>;
  // Side-by-side join (matched by name fuzzy)
  joined: Array<{
    rep: string;
    commissionCash: number | null;
    meetingAccrual: number | null;
    avgWeekly: number | null;
    signedThisWindow: number | null;
  }>;
}

const NAME_KEY: Record<string, string> = {
  // Mapping QB / commissions names → meeting-numbers names
  'aaron lussi': 'Aaron',
  'hunter rivers': 'Hunter',
  'greg muse': 'Greg',
  'brendon muse': 'Brendon',
  'adam rudell': 'Rudy',
  'rick': 'Rick',
  'richard geahr': 'Richard',
  'richard  geahr': 'Richard',
  'john cordonis': 'John',
  'ryan butcher': 'Ryan',
  'wess (former)': 'Wess',
  'christopher wess cozelos': 'Wess',
  'tim hall': 'Tim',
  'david thomas': 'David',
  'travis wages': 'Travis',
  'alijah coleman': 'Alijah',
};

function normalize(name: string): string {
  return (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}
function meetingKey(name: string): string {
  const lc = normalize(name);
  return NAME_KEY[lc] || (name || '').trim();
}

export async function getThreeLeaderboards(opts: { months?: number } = {}): Promise<ThreeLeaderboardsResponse> {
  const months = opts.months || 12;
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  const sinceMs = since.getTime();

  const [commJson, mtgJson, mtgYearJson] = await Promise.all([
    fs.readFile(path.join(process.cwd(), 'data', 'commissions.json'), 'utf8'),
    fs.readFile(path.join(process.cwd(), 'data', 'meeting-numbers-all.json'), 'utf8'),
    fs.readFile(path.join(process.cwd(), 'data', 'meeting-numbers-2026.json'), 'utf8').catch(() => '[]'),
  ]);
  const commissions: Commission[] = JSON.parse(commJson);
  const allMeetings: MeetingRow[] = JSON.parse(mtgJson);
  const currentYearMeetings: MeetingRow[] = JSON.parse(mtgYearJson);

  // Commission leaderboard (window-scoped)
  const commByRep = new Map<string, { total: number; count: number }>();
  for (const c of commissions) {
    if (!c.date) continue;
    const d = new Date(c.date);
    if (d.getTime() < sinceMs) continue;
    const rep = (c.salesRep || '').trim();
    if (!rep) continue;
    if (!commByRep.has(rep)) commByRep.set(rep, { total: 0, count: 0 });
    const v = commByRep.get(rep)!;
    v.total += c.amount || 0;
    v.count++;
  }
  const commission = Array.from(commByRep.entries())
    .map(([rep, v]) => ({ rep, total: Math.round(v.total), paymentCount: v.count }))
    .sort((a, b) => b.total - a.total)
    .filter(r => r.total > 0)
    .slice(0, 25);

  // Sales accrual leaderboard (Monday meeting $$$$$)
  const overlap = new Set(currentYearMeetings.map(r => `${r.meetingDate}|${r.repName}`));
  const meetings: MeetingRow[] = [
    ...allMeetings.filter(r => !overlap.has(`${r.meetingDate}|${r.repName}`)),
    ...currentYearMeetings,
  ];
  const accrualByRep = new Map<string, { total: number; weeks: number; signed: number }>();
  for (const r of meetings) {
    if (!r.meetingDate) continue;
    const d = new Date(r.meetingDate);
    if (d.getTime() < sinceMs) continue;
    const rep = (r.repName || '').trim();
    if (!rep) continue;
    if (!accrualByRep.has(rep)) accrualByRep.set(rep, { total: 0, weeks: 0, signed: 0 });
    const v = accrualByRep.get(rep)!;
    v.total += parseN(r['$$$$$']);
    v.signed += parseN(r.Signed);
    v.weeks++;
  }
  const salesAccrual = Array.from(accrualByRep.entries())
    .map(([rep, v]) => ({ rep, total: Math.round(v.total), weeks: v.weeks, signed: v.signed }))
    .filter(r => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 25);

  // Per-week average
  const perWeekAvg = Array.from(accrualByRep.entries())
    .map(([rep, v]) => ({
      rep,
      avgAccrualPerWeek: v.weeks > 0 ? Math.round(v.total / v.weeks) : 0,
      avgSignedPerWeek: v.weeks > 0 ? Math.round((v.signed / v.weeks) * 10) / 10 : 0,
      weeks: v.weeks,
    }))
    .filter(r => r.weeks >= 4 && r.avgAccrualPerWeek > 0)
    .sort((a, b) => b.avgAccrualPerWeek - a.avgAccrualPerWeek)
    .slice(0, 25);

  // Side-by-side join. Anchor on commission names since they're the
  // canonical 1099 records, then map to meeting names via NAME_KEY.
  const commNames = Array.from(commByRep.keys());
  const meetingNames = Array.from(accrualByRep.keys());
  const joined = new Map<string, { commissionCash: number | null; meetingAccrual: number | null; avgWeekly: number | null; signedThisWindow: number | null }>();
  for (const cn of commNames) {
    const mn = meetingKey(cn);
    const c = commByRep.get(cn)?.total || 0;
    const m = accrualByRep.get(mn)?.total || null;
    const ma = accrualByRep.get(mn);
    joined.set(cn, {
      commissionCash: Math.round(c),
      meetingAccrual: m == null ? null : Math.round(m),
      avgWeekly: ma && ma.weeks >= 4 ? Math.round(ma.total / ma.weeks) : null,
      signedThisWindow: ma ? ma.signed : null,
    });
  }
  // Also include meeting names that don't match anyone in commissions
  for (const mn of meetingNames) {
    if (!Array.from(joined.keys()).some(cn => meetingKey(cn) === mn)) {
      const ma = accrualByRep.get(mn)!;
      joined.set(`(${mn})`, {
        commissionCash: null,
        meetingAccrual: Math.round(ma.total),
        avgWeekly: ma.weeks >= 4 ? Math.round(ma.total / ma.weeks) : null,
        signedThisWindow: ma.signed,
      });
    }
  }
  const joinedArr = Array.from(joined.entries())
    .map(([rep, v]) => ({ rep, ...v }))
    .filter(r => r.commissionCash || r.meetingAccrual)
    .sort((a, b) => (b.meetingAccrual || 0) - (a.meetingAccrual || 0));

  return {
    generatedAt: new Date().toISOString().slice(0, 10),
    windowMonths: months,
    windowLabel: `last ${months} months`,
    commission,
    salesAccrual,
    perWeekAvg,
    joined: joinedArr,
  };
}
