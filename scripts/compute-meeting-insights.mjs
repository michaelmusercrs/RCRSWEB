/**
 * Compute pattern / correlation / attendance / prediction stats from the
 * Monday meeting numbers + commission ledger.
 *
 * Per Michael's spec (project_chrisview_analytics_roadmap.md):
 *
 *   Inspected = roofs inspected that week
 *   Damaged   = inspections with enough damage to file a claim
 *   Signed    = signed contract or contingency
 *   Approved  = adjuster-approved claims that week
 *   Gutter    = gutter / gutter-guard estimates presented
 *   Goal      = inspection target set for NEXT week
 *   Present   = 1 = present, 0/blank = absent, E/EX/EXC/EXCUSED = excused
 *               (excused weeks don't count toward attendance %)
 *               (weeks BEFORE a rep first appeared on the sheet don't count)
 *   Home Show = home-show leads ran
 *   Referrals = jobs NOT from the office
 *   $$$$$     = revenue dollars (accrual basis)
 *
 * Outputs data/meeting-insights.json.
 */
import fs from 'fs';

const all = JSON.parse(fs.readFileSync('data/meeting-numbers-all.json', 'utf8'));
const m26 = JSON.parse(fs.readFileSync('data/meeting-numbers-2026.json', 'utf8'));
const commissions = JSON.parse(fs.readFileSync('data/commissions.json', 'utf8'));
const monthly = JSON.parse(fs.readFileSync('data/transactions-monthly.json', 'utf8'));

const meetings = [...all, ...m26]; // shape identical

function num(v) {
  if (v == null || v === '') return 0;
  const s = String(v).replace(/[$,\s]/g, '');
  if (!s || /^[a-z]/i.test(s)) return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function presence(v) {
  const s = String(v ?? '').trim().toUpperCase();
  if (s === '1' || s === 'P' || s === 'PRESENT') return 'present';
  if (/^E(X(C(USED)?)?)?$/.test(s) || s === 'EXC' || s === 'EXCUSED') return 'excused';
  // 0, blank, anything else = absent
  return 'absent';
}

// ---------------------------------------------------------------------------
// 1. Per-rep weekly rollups + attendance
// ---------------------------------------------------------------------------

// Group by rep
const byRep = {};
for (const r of meetings) {
  const rep = (r.repName || '').trim();
  if (!rep) continue;
  if (!byRep[rep]) byRep[rep] = [];
  byRep[rep].push({
    date: r.meetingDate,
    inspected: num(r.Inspected),
    damage: num(r.Damage),
    signed: num(r.Signed),
    approved: num(r.Approved),
    gutter: num(r.Gutter),
    goal: num(r.Goal),
    revenue: num(r.$$$$$),
    referrals: num(r.Referrals),
    homeShow: num(r['Home Show']),
    presence: presence(r.Present),
  });
}

// Per-rep attendance + per-rep totals
const repStats = [];
for (const [rep, weeks] of Object.entries(byRep)) {
  // Sort chronologically
  weeks.sort((a, b) => a.date.localeCompare(b.date));
  const firstWeek = weeks[0]?.date || '';
  const lastWeek = weeks[weeks.length - 1]?.date || '';

  let present = 0, absent = 0, excused = 0;
  let totals = { inspected: 0, damage: 0, signed: 0, approved: 0, gutter: 0, goal: 0, revenue: 0, referrals: 0, homeShow: 0 };
  for (const w of weeks) {
    if (w.presence === 'present') present++;
    else if (w.presence === 'excused') excused++;
    else absent++;
    totals.inspected += w.inspected;
    totals.damage += w.damage;
    totals.signed += w.signed;
    totals.approved += w.approved;
    totals.gutter += w.gutter;
    totals.goal += w.goal;
    totals.revenue += w.revenue;
    totals.referrals += w.referrals;
    totals.homeShow += w.homeShow;
  }
  const denom = present + absent; // excused doesn't count per spec
  const attendanceRate = denom > 0 ? present / denom : 0;
  // Efficiency ratios
  const damageRate = totals.inspected > 0 ? totals.damage / totals.inspected : 0;
  const closeRate = totals.damage > 0 ? totals.signed / totals.damage : 0;
  const approveRate = totals.signed > 0 ? totals.approved / totals.signed : 0;
  const revenuePerSigned = totals.signed > 0 ? totals.revenue / totals.signed : 0;

  repStats.push({
    rep,
    weeksOnTeam: weeks.length,
    firstWeek,
    lastWeek,
    present, absent, excused,
    attendanceRate: Math.round(attendanceRate * 1000) / 10, // as percent with 1 decimal
    totals: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, Math.round(v * 100) / 100])),
    damageRate: Math.round(damageRate * 1000) / 10,
    closeRate: Math.round(closeRate * 1000) / 10,
    approveRate: Math.round(approveRate * 1000) / 10,
    revenuePerSigned: Math.round(revenuePerSigned * 100) / 100,
  });
}
repStats.sort((a, b) => b.totals.signed - a.totals.signed);

// ---------------------------------------------------------------------------
// 2. Company-wide weekly series (everyone summed) for correlation analysis
// ---------------------------------------------------------------------------

const byWeek = new Map();
for (const r of meetings) {
  if (!r.meetingDate) continue;
  const w = byWeek.get(r.meetingDate) || { date: r.meetingDate, inspected: 0, damage: 0, signed: 0, approved: 0, gutter: 0, goal: 0, revenue: 0, referrals: 0, homeShow: 0, presentCount: 0, absentCount: 0, excusedCount: 0 };
  w.inspected += num(r.Inspected);
  w.damage += num(r.Damage);
  w.signed += num(r.Signed);
  w.approved += num(r.Approved);
  w.gutter += num(r.Gutter);
  w.goal += num(r.Goal);
  w.revenue += num(r.$$$$$);
  w.referrals += num(r.Referrals);
  w.homeShow += num(r['Home Show']);
  const p = presence(r.Present);
  if (p === 'present') w.presentCount++;
  else if (p === 'excused') w.excusedCount++;
  else w.absentCount++;
  byWeek.set(r.meetingDate, w);
}
const weekly = Array.from(byWeek.values()).sort((a, b) => a.date.localeCompare(b.date));

// ---------------------------------------------------------------------------
// 3. Correlation analysis — Pearson r at various lags
// ---------------------------------------------------------------------------

function pearson(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return 0;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i]; sy += ys[i];
    sxx += xs[i] * xs[i]; syy += ys[i] * ys[i];
    sxy += xs[i] * ys[i];
  }
  const num = n * sxy - sx * sy;
  const den = Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy));
  return den === 0 ? 0 : num / den;
}

function correlateLag(series, fromKey, toKey, maxLag) {
  const out = [];
  for (let lag = 0; lag <= maxLag; lag++) {
    const xs = [];
    const ys = [];
    for (let i = 0; i + lag < series.length; i++) {
      xs.push(series[i][fromKey]);
      ys.push(series[i + lag][toKey]);
    }
    out.push({ lag, weeks: xs.length, r: Math.round(pearson(xs, ys) * 100) / 100 });
  }
  return out;
}

// signed -> approved at lag 0..6 weeks
const signedToApproved = correlateLag(weekly, 'signed', 'approved', 8);
// inspected -> signed at lag 0..4
const inspectedToSigned = correlateLag(weekly, 'inspected', 'signed', 6);
// signed -> revenue (next 4-8 weeks since revenue is reported same week of contract)
const signedToRevenue = correlateLag(weekly, 'signed', 'revenue', 8);
// damage -> signed (closing rate effect)
const damageToSigned = correlateLag(weekly, 'damage', 'signed', 4);
// goal (set last week) vs inspected (this week) → did setting higher goals hit
const goalToInspected = (() => {
  const out = [];
  for (let lag = 1; lag <= 4; lag++) {
    const xs = [], ys = [];
    for (let i = 0; i + lag < weekly.length; i++) {
      xs.push(weekly[i].goal);
      ys.push(weekly[i + lag].inspected);
    }
    out.push({ lag, weeks: xs.length, r: Math.round(pearson(xs, ys) * 100) / 100 });
  }
  return out;
})();

// ---------------------------------------------------------------------------
// 4. Predictive signals — look at last 4 weeks, compare to recent average
// ---------------------------------------------------------------------------

function average(arr, key) {
  if (!arr.length) return 0;
  return arr.reduce((s, x) => s + x[key], 0) / arr.length;
}

const recent4 = weekly.slice(-4);
const prev12 = weekly.slice(-16, -4);
const baselineAdjuster = average(prev12, 'approved');
const recentAdjuster = average(recent4, 'approved');
const adjusterDelta = baselineAdjuster > 0 ? (recentAdjuster - baselineAdjuster) / baselineAdjuster : 0;

// Forward signal: signedToRevenue best lag (highest r) tells us the expected
// commission impact window. We'll use that with the recent signed delta.
const baselineSigned = average(prev12, 'signed');
const recentSigned = average(recent4, 'signed');
const signedDelta = baselineSigned > 0 ? (recentSigned - baselineSigned) / baselineSigned : 0;

const bestSignedToRevLag = signedToRevenue.reduce((best, x) => (Math.abs(x.r) > Math.abs(best.r) ? x : best), { r: 0, lag: 0 });

// Project monthly revenue impact using transactionsMonthly recent baseline
const monthlyAvg = (() => {
  const lastFew = monthly.slice(-6);
  return lastFew.length > 0
    ? lastFew.reduce((s, m) => s + m.netRevenue, 0) / lastFew.length
    : 0;
})();
const projectedNextMonth = Math.round(monthlyAvg * (1 + signedDelta * 0.5) * 100) / 100;
// (We dampen by 0.5 because not all signed translates to billed revenue same month)

// ---------------------------------------------------------------------------
// 5. Goal column study
// ---------------------------------------------------------------------------

// Bin weeks by goal-set range and see avg inspected the following week
const goalBins = { 'low (1-3)': { goalSum: 0, count: 0, nextInspected: 0 }, 'mid (4-7)': { goalSum: 0, count: 0, nextInspected: 0 }, 'high (8+)': { goalSum: 0, count: 0, nextInspected: 0 } };
for (let i = 0; i < weekly.length - 1; i++) {
  const goal = weekly[i].goal;
  if (goal <= 0) continue;
  const nextInsp = weekly[i + 1].inspected;
  const bin = goal <= 3 ? 'low (1-3)' : goal <= 7 ? 'mid (4-7)' : 'high (8+)';
  goalBins[bin].goalSum += goal;
  goalBins[bin].count += 1;
  goalBins[bin].nextInspected += nextInsp;
}
const goalStudy = Object.entries(goalBins).map(([bin, v]) => ({
  bin,
  weeks: v.count,
  avgGoal: v.count > 0 ? Math.round((v.goalSum / v.count) * 10) / 10 : 0,
  avgInspectedNextWeek: v.count > 0 ? Math.round((v.nextInspected / v.count) * 10) / 10 : 0,
  hitRate: v.count > 0 && v.goalSum > 0 ? Math.round((v.nextInspected / v.goalSum) * 1000) / 10 : 0,
}));

// ---------------------------------------------------------------------------
// 6. Save
// ---------------------------------------------------------------------------

const out = {
  generatedAt: new Date().toISOString().slice(0, 10),
  meetingWeeks: weekly.length,
  weekly: weekly.slice(-52).map(w => ({
    ...w,
    inspected: Math.round(w.inspected),
    signed: Math.round(w.signed),
    approved: Math.round(w.approved),
    revenue: Math.round(w.revenue * 100) / 100,
  })),
  repStats,
  correlation: {
    signedToApproved,
    inspectedToSigned,
    signedToRevenue,
    damageToSigned,
    goalToInspected,
  },
  prediction: {
    baselineAdjuster: Math.round(baselineAdjuster * 10) / 10,
    recentAdjuster: Math.round(recentAdjuster * 10) / 10,
    adjusterDeltaPct: Math.round(adjusterDelta * 1000) / 10,
    baselineSigned: Math.round(baselineSigned * 10) / 10,
    recentSigned: Math.round(recentSigned * 10) / 10,
    signedDeltaPct: Math.round(signedDelta * 1000) / 10,
    bestSignedToRevLag,
    monthlyAvg: Math.round(monthlyAvg * 100) / 100,
    projectedNextMonth,
    interpretation:
      signedDelta < -0.15
        ? `Signed contracts down ${Math.abs(Math.round(signedDelta * 100))}% vs 12-week baseline. Expect commission softness ~4-6 weeks out.`
        : signedDelta > 0.15
        ? `Signed contracts up ${Math.round(signedDelta * 100)}% vs 12-week baseline. Expect commission lift ~4-6 weeks out.`
        : `Signed contracts within ±15% of baseline — flat outlook 4-6 weeks out.`,
  },
  goalStudy,
};

fs.writeFileSync('data/meeting-insights.json', JSON.stringify(out, null, 2));
console.log('Wrote data/meeting-insights.json');
console.log(`  ${weekly.length} weeks of data, ${repStats.length} reps`);
console.log(`  Best lag signed → approved:`, signedToApproved.reduce((b, x) => Math.abs(x.r) > Math.abs(b.r) ? x : b, { r: 0 }));
console.log(`  Best lag signed → revenue:`, bestSignedToRevLag);
console.log(`  Best lag goal → next inspected:`, goalToInspected.reduce((b, x) => Math.abs(x.r) > Math.abs(b.r) ? x : b, { r: 0 }));
console.log(`  Recent adjuster vs baseline: ${out.prediction.adjusterDeltaPct}%`);
console.log(`  Recent signed vs baseline:   ${out.prediction.signedDeltaPct}%`);
console.log(`  Goal study:`);
for (const g of goalStudy) console.log(`    ${g.bin.padEnd(12)} weeks=${g.weeks}  avgGoal=${g.avgGoal}  avgNextInsp=${g.avgInspectedNextWeek}  hitRate=${g.hitRate}%`);
