/**
 * Meeting numbers historical analysis.
 *
 * Source: data/meeting-numbers-all.json (~2,590 weekly per-rep rows from
 * Monday meeting sheet, 2019-01 → 2025-12). Per-rep weekly self-reports
 * of: Inspected, Damage found, Signed (contracts), $$$$$ (accrual revenue),
 * Approved (insurance), Goal, Referrals, Agents touched, Present, Home Show.
 *
 * Note: this is the accrual track. Real commission/cash is in
 * data/commissions.json + transactions-monthly.json. The two often
 * differ — meeting numbers are what the rep claimed Monday morning;
 * actual revenue is what QB booked. Per [[project-rcrs-leaderboards]],
 * never combine them.
 */
import { promises as fs } from 'fs';
import path from 'path';

interface MeetingRow {
  meetingDate: string;
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
  tabName: string;
}

function parseN(v: unknown): number {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').replace(/[,$]/g, '').trim();
  if (!s || s.toLowerCase() === 'e' || s.toLowerCase() === 'ex' || s.toLowerCase() === 'exc' || s.toLowerCase() === 'excused') return 0;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export interface MeetingHistoryResponse {
  generatedAt: string;
  dateRange: { first: string; last: string; weeks: number };
  byYear: Array<{
    year: string;
    inspected: number;
    damage: number;
    signed: number;
    accrualRevenue: number;
    approved: number;
    referrals: number;
    agents: number;
    repWeeks: number;
    distinctReps: number;
    damageRate: number;       // damage / inspected
    closeRate: number;        // signed / damage
    avgRevPerSigned: number;  // accrualRevenue / signed
  }>;
  byMonth: Array<{ month: string; inspected: number; damage: number; signed: number; accrualRevenue: number }>;
  topRepsLifetime: Array<{
    rep: string;
    weeks: number;
    inspected: number;
    damage: number;
    signed: number;
    accrualRevenue: number;
    avgRevPerWeek: number;
    avgInspectedPerWeek: number;
    closeRate: number;
    firstWeek: string;
    lastWeek: string;
    daysActive: number;
  }>;
  bestWeeks: Array<{
    meetingDate: string;
    rep: string;
    inspected: number;
    signed: number;
    accrualRevenue: number;
    referrals: number;
  }>;
  attendance: {
    yearly: Array<{ year: string; sessions: number; present: number; presentPct: number }>;
    perRep: Array<{ rep: string; sessions: number; present: number; presentPct: number }>;
  };
  funnel: {
    lifetimeInspected: number;
    lifetimeDamage: number;
    lifetimeSigned: number;
    lifetimeAccrual: number;
    damageRate: number;
    closeRate: number;
    avgRevPerSigned: number;
  };
}

export async function getMeetingHistory(): Promise<MeetingHistoryResponse> {
  const allFile = path.join(process.cwd(), 'data', 'meeting-numbers-all.json');
  const yearFile = path.join(process.cwd(), 'data', 'meeting-numbers-2026.json');
  const [allRaw, yearRaw] = await Promise.all([
    fs.readFile(allFile, 'utf8').then(JSON.parse) as Promise<MeetingRow[]>,
    fs.readFile(yearFile, 'utf8').then(JSON.parse).catch(() => [] as MeetingRow[]) as Promise<MeetingRow[]>,
  ]);
  // Merge: drop any overlapping (meetingDate + repName) from allRaw so the
  // current-year file wins for rows it covers.
  const overlapKeys = new Set(yearRaw.map(r => `${r.meetingDate}|${r.repName}`));
  const raw: MeetingRow[] = [
    ...allRaw.filter(r => !overlapKeys.has(`${r.meetingDate}|${r.repName}`)),
    ...yearRaw,
  ];

  const yearMap = new Map<string, { inspected: number; damage: number; signed: number; revenue: number; approved: number; referrals: number; agents: number; repWeeks: number; reps: Set<string> }>();
  const monthMap = new Map<string, { inspected: number; damage: number; signed: number; revenue: number }>();
  const repMap = new Map<string, { weeks: number; inspected: number; damage: number; signed: number; revenue: number; first: string; last: string }>();
  let allDates: string[] = [];

  for (const r of raw) {
    const d = r.meetingDate || '';
    if (!d) continue;
    allDates.push(d);
    const y = d.slice(0, 4);
    const ym = d.slice(0, 7);
    if (!yearMap.has(y)) yearMap.set(y, { inspected: 0, damage: 0, signed: 0, revenue: 0, approved: 0, referrals: 0, agents: 0, repWeeks: 0, reps: new Set() });
    const ya = yearMap.get(y)!;
    ya.inspected += parseN(r.Inspected);
    ya.damage += parseN(r.Damage);
    ya.signed += parseN(r.Signed);
    ya.revenue += parseN(r['$$$$$']);
    ya.approved += parseN(r.Approved);
    ya.referrals += parseN(r.Referrals);
    ya.agents += parseN(r.Agents);
    ya.repWeeks++;
    if (r.repName) ya.reps.add(r.repName);

    if (!monthMap.has(ym)) monthMap.set(ym, { inspected: 0, damage: 0, signed: 0, revenue: 0 });
    const ma = monthMap.get(ym)!;
    ma.inspected += parseN(r.Inspected);
    ma.damage += parseN(r.Damage);
    ma.signed += parseN(r.Signed);
    ma.revenue += parseN(r['$$$$$']);

    const rep = (r.repName || '').trim();
    if (rep) {
      if (!repMap.has(rep)) repMap.set(rep, { weeks: 0, inspected: 0, damage: 0, signed: 0, revenue: 0, first: d, last: d });
      const x = repMap.get(rep)!;
      x.weeks++;
      x.inspected += parseN(r.Inspected);
      x.damage += parseN(r.Damage);
      x.signed += parseN(r.Signed);
      x.revenue += parseN(r['$$$$$']);
      if (d < x.first) x.first = d;
      if (d > x.last) x.last = d;
    }
  }
  allDates.sort();

  const byYear = Array.from(yearMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([year, v]) => ({
      year,
      inspected: v.inspected,
      damage: v.damage,
      signed: v.signed,
      accrualRevenue: Math.round(v.revenue),
      approved: v.approved,
      referrals: v.referrals,
      agents: v.agents,
      repWeeks: v.repWeeks,
      distinctReps: v.reps.size,
      damageRate: v.inspected > 0 ? Math.round((v.damage / v.inspected) * 1000) / 10 : 0,
      closeRate: v.damage > 0 ? Math.round((v.signed / v.damage) * 1000) / 10 : 0,
      avgRevPerSigned: v.signed > 0 ? Math.round(v.revenue / v.signed) : 0,
    }));

  const byMonth = Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({
      month,
      inspected: v.inspected,
      damage: v.damage,
      signed: v.signed,
      accrualRevenue: Math.round(v.revenue),
    }));

  const topRepsLifetime = Array.from(repMap.entries())
    .map(([rep, v]) => ({
      rep,
      weeks: v.weeks,
      inspected: v.inspected,
      damage: v.damage,
      signed: v.signed,
      accrualRevenue: Math.round(v.revenue),
      avgRevPerWeek: v.weeks > 0 ? Math.round(v.revenue / v.weeks) : 0,
      avgInspectedPerWeek: v.weeks > 0 ? Math.round((v.inspected / v.weeks) * 10) / 10 : 0,
      closeRate: v.damage > 0 ? Math.round((v.signed / v.damage) * 1000) / 10 : 0,
      firstWeek: v.first,
      lastWeek: v.last,
      daysActive: v.first && v.last
        ? Math.floor((new Date(v.last).getTime() - new Date(v.first).getTime()) / 86400000)
        : 0,
    }))
    .filter(r => r.accrualRevenue > 0)
    .sort((a, b) => b.accrualRevenue - a.accrualRevenue);

  // Best single rep-weeks by accrual
  const bestWeeks = raw
    .map(r => ({
      meetingDate: r.meetingDate,
      rep: r.repName,
      inspected: parseN(r.Inspected),
      signed: parseN(r.Signed),
      accrualRevenue: parseN(r['$$$$$']),
      referrals: parseN(r.Referrals),
    }))
    .filter(r => r.accrualRevenue > 0)
    .sort((a, b) => b.accrualRevenue - a.accrualRevenue)
    .slice(0, 20);

  // Attendance — count Present field. Per [[project-attendance-rules]]:
  // present=1, blank/0=absent, E/EX/EXC/EXCUSED=excused (doesn't count to denominator)
  const isExcused = (v: string | undefined) => {
    const s = String(v ?? '').trim().toUpperCase();
    return s === 'E' || s === 'EX' || s === 'EXC' || s === 'EXCUSED';
  };
  const isPresent = (v: string | undefined) => {
    const s = String(v ?? '').trim();
    return s === '1' || s.toLowerCase() === 'yes' || s.toLowerCase() === 'p';
  };

  const yearAttend = new Map<string, { sessions: number; present: number }>();
  const repAttend = new Map<string, { sessions: number; present: number }>();
  for (const r of raw) {
    if (isExcused(r.Present)) continue;
    const y = (r.meetingDate || '').slice(0, 4);
    if (!yearAttend.has(y)) yearAttend.set(y, { sessions: 0, present: 0 });
    const ya = yearAttend.get(y)!;
    ya.sessions++;
    if (isPresent(r.Present)) ya.present++;

    const rep = r.repName;
    if (rep) {
      if (!repAttend.has(rep)) repAttend.set(rep, { sessions: 0, present: 0 });
      const ra = repAttend.get(rep)!;
      ra.sessions++;
      if (isPresent(r.Present)) ra.present++;
    }
  }
  const attendance = {
    yearly: Array.from(yearAttend.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([year, v]) => ({
        year,
        sessions: v.sessions,
        present: v.present,
        presentPct: v.sessions > 0 ? Math.round((v.present / v.sessions) * 1000) / 10 : 0,
      })),
    perRep: Array.from(repAttend.entries())
      .map(([rep, v]) => ({
        rep,
        sessions: v.sessions,
        present: v.present,
        presentPct: v.sessions > 0 ? Math.round((v.present / v.sessions) * 1000) / 10 : 0,
      }))
      .filter(r => r.sessions >= 10)
      .sort((a, b) => b.presentPct - a.presentPct),
  };

  const totalInsp = byYear.reduce((s, y) => s + y.inspected, 0);
  const totalDmg = byYear.reduce((s, y) => s + y.damage, 0);
  const totalSign = byYear.reduce((s, y) => s + y.signed, 0);
  const totalRev = byYear.reduce((s, y) => s + y.accrualRevenue, 0);

  return {
    generatedAt: new Date().toISOString().slice(0, 10),
    dateRange: {
      first: allDates[0] || '',
      last: allDates[allDates.length - 1] || '',
      weeks: raw.length,
    },
    byYear,
    byMonth,
    topRepsLifetime,
    bestWeeks,
    attendance,
    funnel: {
      lifetimeInspected: totalInsp,
      lifetimeDamage: totalDmg,
      lifetimeSigned: totalSign,
      lifetimeAccrual: totalRev,
      damageRate: totalInsp > 0 ? Math.round((totalDmg / totalInsp) * 1000) / 10 : 0,
      closeRate: totalDmg > 0 ? Math.round((totalSign / totalDmg) * 1000) / 10 : 0,
      avgRevPerSigned: totalSign > 0 ? Math.round(totalRev / totalSign) : 0,
    },
  };
}
