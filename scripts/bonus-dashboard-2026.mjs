// Generates an interactive HTML dashboard from data/bonus-tracker-2026.json
// Source data comes ONLY from "2026 Sales Numbers - with Totals.xlsx" via the
// upstream bonus-tracker-2026.mjs script.
//
// Bonus model: REPLACEMENT (highest single tier wins per month). Linear above $500K.
// Trip qualification: $400K H1. Below = $0 paid.
//
// Features:
//  - Per-rep delta framing ("you just added $X to your trip pot, total $Y")
//  - Snapshot history viewer
//  - Visible change log with retroactive-change flagging
//  - Smart upload UI: diff detection vs current data, override + log
//  - Notification toggles (built, off)
//  - Cash-out at 75% (lower than trip value)

import fs from 'fs';
import path from 'path';

const DATA_PATH = 'data/bonus-tracker-2026.json';
// Write directly to public/ so /trip serves the latest dashboard.
const OUT_PATH = 'public/trip.html';
// Also keep the legacy trip-dashboard.html in sync for direct-link compat.
const LEGACY_OUT_PATH = 'public/trip-dashboard.html';
const TODAY = new Date('2026-05-11');
const H1_END = new Date('2026-06-30');
const CASH_OUT_PCT = 0.75;

const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
const cfg = JSON.parse(fs.readFileSync('data/competition-config.json', 'utf8'));
const months = ['January', 'February', 'March', 'April', 'May'];
const monthsCompleted = 5;
const daysLeftH1 = Math.ceil((H1_END - TODAY) / (1000 * 60 * 60 * 24));
const weeksLeftH1 = Math.round(daysLeftH1 / 7);
const monthsLeftH1 = 2;

// ---------- Compute per-rep stats ----------
for (const r of data.reps) {
  const revs = r.breakdown.map(b => b.revenue);
  const activeMonths = revs.filter(v => v > 0).length;
  const tieredMonths = r.breakdown.filter(b => b.bonus > 0).length;
  const bestMonth = [...r.breakdown].sort((a, b) => b.revenue - a.revenue)[0];
  const monthlyAvg = activeMonths ? r.ytd / activeMonths : 0;
  const monthlyAvgIncluding0 = r.ytd / monthsCompleted;
  const projectedH1AtCurrentPace = r.ytd + (monthlyAvgIncluding0 * monthsLeftH1);
  const neededPerMonth = r.qualifiedForTrip ? 0 : (data.tripThreshold - r.ytd) / monthsLeftH1;
  const neededPerWeek = r.qualifiedForTrip ? 0 : (data.tripThreshold - r.ytd) / weeksLeftH1;
  const consistency = (tieredMonths / monthsCompleted) * 100;
  const bestMonthBeatGap = bestMonth.revenue >= (data.tripThreshold - r.ytd);
  const wouldQualifyIfBestRepeats = (r.ytd + bestMonth.revenue * monthsLeftH1) >= data.tripThreshold;

  r.stats = {
    activeMonths, tieredMonths, bestMonth, monthlyAvg, monthlyAvgIncluding0,
    projectedH1AtCurrentPace, neededPerMonth, neededPerWeek, consistency,
    bestMonthBeatGap, wouldQualifyIfBestRepeats,
  };
}

// ---------- Awards ----------
const awards = {
  topProducer: [...data.reps].sort((a, b) => b.ytd - a.ytd)[0],
  biggestMonth: data.reps.flatMap(r => r.breakdown.map(b => ({ rep: r.rep, ...b })))
    .sort((a, b) => b.revenue - a.revenue)[0],
  mostConsistent: [...data.reps].filter(r => r.stats.activeMonths >= 2)
    .sort((a, b) => b.stats.consistency - a.stats.consistency)[0],
  highestSingleTier: data.reps.flatMap(r => r.breakdown.filter(b => b.bonus > 0).map(b => ({ rep: r.rep, ...b })))
    .sort((a, b) => b.bonus - a.bonus)[0],
  fastestStarter: [...data.reps].filter(r => r.breakdown[0].revenue > 0)
    .sort((a, b) => b.breakdown[0].revenue - a.breakdown[0].revenue)[0],
  bestAprilSurge: [...data.reps].filter(r => r.breakdown[3].revenue > 0)
    .sort((a, b) => b.breakdown[3].revenue - a.breakdown[3].revenue)[0],
  comebackKid: [...data.reps].filter(r => !r.qualifiedForTrip && r.stats.wouldQualifyIfBestRepeats)
    .sort((a, b) => a.gapToTrip - b.gapToTrip)[0],
};

// ---------- Load snapshots + change log ----------
const histDir = 'data/history';
let snapshots = [];
if (fs.existsSync(histDir)) {
  snapshots = fs.readdirSync(histDir)
    .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(histDir, f), 'utf8')))
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
}
const lastSnapshot = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;

let changeLog = [];
if (fs.existsSync('data/change-log.json')) {
  changeLog = JSON.parse(fs.readFileSync('data/change-log.json', 'utf8'));
}

// ---------- Compute per-rep DELTA from last snapshot (motivational framing) ----------
for (const r of data.reps) {
  if (lastSnapshot) {
    const prev = lastSnapshot.reps.find(p => p.rep === r.rep);
    r.delta = prev ? {
      ytdDelta: r.ytd - prev.ytd,
      accruedDelta: r.accruedTripBudget - prev.accrued,
      isNew: false,
      previousAccrued: prev.accrued,
      previousYtd: prev.ytd,
    } : {
      ytdDelta: r.ytd,
      accruedDelta: r.accruedTripBudget,
      isNew: true,
      previousAccrued: 0,
      previousYtd: 0,
    };
  } else {
    r.delta = null;
  }
}

// ---------- Personalized insights ----------
function insights(r) {
  const out = { wins: [], gaps: [], suggestions: [], motivation: '', deltaMessage: null };
  const s = r.stats;
  const d = r.delta;

  // Delta-based motivational message
  if (d && d.accruedDelta > 0) {
    out.deltaMessage = `Since the last update, you added <strong>+$${d.accruedDelta.toLocaleString()}</strong> to your trip fund — bringing your pot to <strong>$${r.accruedTripBudget.toLocaleString()}</strong> toward a peaceful vacation.`;
  } else if (d && d.ytdDelta > 0 && d.accruedDelta === 0) {
    out.deltaMessage = `Since the last update, you closed <strong>+$${Math.round(d.ytdDelta).toLocaleString()}</strong> in sales. One more push to clear $50K and the pot starts growing.`;
  } else if (d && d.isNew) {
    out.deltaMessage = `Welcome to the board. Every $50K month adds to your trip fund.`;
  }

  if (r.qualifiedForTrip) out.wins.push(`Already QUALIFIED with $${Math.round(r.ytd).toLocaleString()} sold.`);
  if (s.bestMonth.revenue >= 200000) out.wins.push(`Posted ${s.bestMonth.month} at $${Math.round(s.bestMonth.revenue).toLocaleString()} — proves $200K+ months are in your wheelhouse.`);
  else if (s.bestMonth.revenue >= 100000) out.wins.push(`Best month: ${s.bestMonth.month} = $${Math.round(s.bestMonth.revenue).toLocaleString()}, six-figure performance.`);
  else if (s.bestMonth.revenue >= 50000) out.wins.push(`Best month: ${s.bestMonth.month} = $${Math.round(s.bestMonth.revenue).toLocaleString()}, tier money earned.`);
  if (r.accruedTripBudget >= 1000) out.wins.push(`Trip fund pot: $${r.accruedTripBudget.toLocaleString()}.`);
  if (s.consistency >= 75) out.wins.push(`${s.tieredMonths} of ${monthsCompleted} months hit tier — elite consistency.`);

  if (s.activeMonths < monthsCompleted) {
    const dark = monthsCompleted - s.activeMonths;
    out.gaps.push(`${dark} of ${monthsCompleted} months had zero sales. Every dark month is tier money missed.`);
  }
  if (s.activeMonths > 0 && s.tieredMonths < s.activeMonths) {
    out.gaps.push(`${s.activeMonths - s.tieredMonths} active month(s) stayed under $50K — close-but-no-tier.`);
  }
  if (!r.qualifiedForTrip && s.projectedH1AtCurrentPace < data.tripThreshold) {
    const shortBy = Math.round(data.tripThreshold - s.projectedH1AtCurrentPace);
    out.gaps.push(`At current pace you finish H1 at ~$${Math.round(s.projectedH1AtCurrentPace).toLocaleString()} — $${shortBy.toLocaleString()} short of the trip.`);
  }

  if (!r.qualifiedForTrip) {
    out.suggestions.push(`Average $${Math.round(s.neededPerMonth).toLocaleString()}/month for May+June (~$${Math.round(s.neededPerWeek).toLocaleString()}/week) to qualify.`);
    if (s.bestMonthBeatGap) out.suggestions.push(`ONE more month like ${s.bestMonth.month} closes the gap entirely.`);
    else if (s.wouldQualifyIfBestRepeats) out.suggestions.push(`Repeat your ${s.bestMonth.month} performance both May AND June and you're qualified.`);
    if (s.bestMonth.revenue < 50000) out.suggestions.push(`No month has cleared $50K yet — first $50K month puts $100 in your pot.`);
  } else {
    out.suggestions.push(`Trip locked. Now climb tiers — bigger months = bigger pot.`);
    if (s.bestMonth.revenue < 300000) out.suggestions.push(`Push for $300K month (+$2,000) — you've shown $200K is in range.`);
    if (r.ytd >= 500000) out.suggestions.push(`$500K → $1M month: linear +$1,000 per additional $100K, capped at +$9,000 (max @ $1M month).`);
  }

  if (r.qualifiedForTrip) out.motivation = "You're in. Now make the trip bigger.";
  else if (s.wouldQualifyIfBestRepeats) out.motivation = `You've PROVEN you can do this. Repeat ${s.bestMonth.month}.`;
  else if (r.stats.activeMonths >= 1) out.motivation = `On the board. Scale it up.`;
  else out.motivation = `The bar is $400K cumulative H1 — get on the board.`;
  return out;
}
for (const r of data.reps) r.insights = insights(r);

// ---------- LLC mapping ----------
const LLC = {
  Brendon: 'BCM Contracting LLC', Aaron: 'Roof Angel, LLC',
  Adam: 'Rudys Roofing Insights LLC', Greg: 'Gregory Ray Muse',
  Travis: 'Jeremy T. Wages',
};

// ---------- Aggregate ----------
const totalTeam = data.reps.reduce((s, r) => s + r.ytd, 0);
const teamAvg = totalTeam / data.reps.length;
const qualifiedCount = data.reps.filter(r => r.qualifiedForTrip).length;
const totalAccrued = data.reps.reduce((s, r) => s + r.accruedTripBudget, 0);
const totalToBePaid = data.reps.filter(r => r.qualifiedForTrip).reduce((s, r) => s + r.actualTripBudget, 0);
const totalForfeitedSoFar = totalAccrued - totalToBePaid;

const payload = {
  generatedAt: new Date().toISOString(),
  today: TODAY.toISOString().slice(0, 10),
  daysLeftH1, weeksLeftH1, monthsLeftH1,
  months,
  monthsCompleted,
  reps: data.reps.map(r => ({ ...r, llc: LLC[r.rep] || null })),
  awards,
  team: { totalTeam, teamAvg, qualifiedCount, totalAccrued, totalToBePaid, totalForfeitedSoFar },
  config: data,
  snapshots: snapshots.map(s => ({ capturedAt: s.capturedAt, capturedDate: s.capturedDate, hash: s.hash, teamTotal: s.teamTotal, qualifiedCount: s.qualifiedCount, totalAccrued: s.totalAccrued, retroactiveCount: s.retroactiveCount || 0, additionCount: s.additionCount || 0 })),
  changeLog: changeLog.slice(-50),  // last 50 change entries
  cashOutPct: CASH_OUT_PCT,
  // Compact map for upload-side diff: rep -> month -> revenue
  currentDataMap: Object.fromEntries(data.reps.map(r => [r.rep, Object.fromEntries(r.breakdown.map(b => [b.month, b.revenue]))])),
};

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>RCRS 2026 H1 Trip Program — Live Dashboard</title>
<script>
// Unregister any old service worker that may be intercepting /trip and serving
// a cached portal page from before this route existed. Runs once per session.
(function(){
  try {
    var key = '__trip_sw_nuked_v1';
    if (sessionStorage.getItem(key)) return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function(regs){
        var had = regs.length > 0;
        Promise.all(regs.map(function(r){ return r.unregister(); })).then(function(){
          var clearCaches = window.caches
            ? caches.keys().then(function(keys){
                return Promise.all(keys.map(function(k){ return caches.delete(k); }));
              })
            : Promise.resolve();
          clearCaches.then(function(){
            sessionStorage.setItem(key, '1');
            if (had) location.reload();
          });
        });
      });
    }
  } catch(e) {}
})();
</script>
<script src="/vendor/chart.umd.min.js"></script>
<script src="/vendor/xlsx.full.min.js"></script>
<style>
  :root {
    --green: #39FF14; --green-dim: #2dd010; --blue: #0066CC;
    --bg: #0a0e14; --bg2: #131820; --bg3: #1c2330;
    --text: #e6edf3; --text-dim: #8b95a5;
    --warn: #ff9500; --bad: #ff453a; --gold: #ffd60a;
  }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, system-ui, "Segoe UI", Inter, sans-serif; background: var(--bg); color: var(--text); padding: 20px; line-height: 1.5; }
  h1 { color: var(--green); margin: 0 0 4px; font-size: 28px; letter-spacing: -.5px; }
  h2 { color: var(--green); margin: 32px 0 12px; font-size: 18px; border-bottom: 1px solid #2a3342; padding-bottom: 8px; }
  h3 { margin: 18px 0 8px; color: var(--text); font-size: 16px; }
  .sub { color: var(--text-dim); font-size: 13px; margin-bottom: 16px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
  .badge-green { background: rgba(57,255,20,.15); color: var(--green); border: 1px solid rgba(57,255,20,.3); }
  .badge-warn { background: rgba(255,149,0,.15); color: var(--warn); border: 1px solid rgba(255,149,0,.3); }
  .badge-bad { background: rgba(255,69,58,.15); color: var(--bad); border: 1px solid rgba(255,69,58,.3); }
  .badge-gold { background: rgba(255,214,10,.15); color: var(--gold); border: 1px solid rgba(255,214,10,.3); }

  .hero { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 24px; }
  .stat { background: var(--bg2); padding: 16px; border-radius: 10px; border: 1px solid #2a3342; }
  .stat-label { color: var(--text-dim); font-size: 11px; text-transform: uppercase; letter-spacing: .5px; }
  .stat-value { font-size: 24px; font-weight: 700; color: var(--green); margin-top: 4px; }
  .stat-sub { color: var(--text-dim); font-size: 12px; margin-top: 4px; }

  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
  @media (max-width: 800px) { .grid-2 { grid-template-columns: 1fr; } }

  .card { background: var(--bg2); padding: 20px; border-radius: 12px; border: 1px solid #2a3342; }
  .chart-card { background: var(--bg2); padding: 20px; border-radius: 12px; border: 1px solid #2a3342; position: relative; display: flex; flex-direction: column; }
  .chart-card h3 { flex: 0 0 auto; }
  .chart-card .chart-wrap { position: relative; flex: 1 1 auto; height: 320px; }
  .chart-card canvas { max-width: 100%; }

  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { padding: 8px 10px; text-align: right; border-bottom: 1px solid #2a3342; }
  th:first-child, td:first-child { text-align: left; }
  th { color: var(--text-dim); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; }
  tbody tr:hover { background: var(--bg3); cursor: pointer; }

  .rep-card { background: linear-gradient(135deg, var(--bg2), var(--bg3)); padding: 24px; border-radius: 14px; border: 1px solid #2a3342; transition: transform .2s, border-color .2s; }
  .rep-card:hover { transform: translateY(-2px); border-color: var(--green); }
  .rep-card.qualified { border-color: var(--green); box-shadow: 0 0 20px rgba(57,255,20,.1); }
  .rep-name { font-size: 22px; font-weight: 700; color: var(--green); margin-bottom: 2px; }
  .rep-llc { color: var(--text-dim); font-size: 12px; margin-bottom: 14px; }

  .progress { background: #1a2030; height: 18px; border-radius: 9px; overflow: hidden; margin: 8px 0; position: relative; }
  .progress-bar { background: linear-gradient(90deg, var(--green-dim), var(--green)); height: 100%; transition: width .8s; }
  .progress-bar.warn { background: linear-gradient(90deg, #cc7a00, var(--warn)); }
  .progress-bar.bad { background: linear-gradient(90deg, #cc2a22, var(--bad)); }
  .progress-label { position: absolute; top: 0; left: 0; right: 0; text-align: center; font-size: 11px; line-height: 18px; color: #fff; font-weight: 600; text-shadow: 0 0 4px rgba(0,0,0,.7); }

  .insight-list { margin: 8px 0; padding: 0; list-style: none; }
  .insight-list li { padding: 6px 0 6px 22px; position: relative; font-size: 13px; }
  .insight-list li::before { position: absolute; left: 0; top: 6px; }
  .wins li::before { content: "✓"; color: var(--green); font-weight: 700; }
  .gaps li::before { content: "!"; color: var(--warn); font-weight: 700; padding-left: 4px; }
  .suggestions li::before { content: "→"; color: var(--blue); font-weight: 700; }
  .motivation { margin-top: 14px; padding: 12px; background: rgba(57,255,20,.08); border-left: 3px solid var(--green); border-radius: 4px; font-style: italic; color: var(--green); font-size: 13px; }
  .delta-card { margin: 10px 0 14px; padding: 12px; background: linear-gradient(135deg, rgba(255,214,10,.1), rgba(57,255,20,.08)); border-left: 3px solid var(--gold); border-radius: 4px; font-size: 13px; }
  .section-label { color: var(--text-dim); font-size: 11px; text-transform: uppercase; letter-spacing: .5px; margin-top: 14px; margin-bottom: 6px; }
  .tier-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; border-bottom: 1px dotted #2a3342; }
  .tier-row:last-child { border: 0; }
  .tier-row .lbl { color: var(--text-dim); }
  .tier-row .val { color: var(--green); font-weight: 600; }

  .award-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
  .award { background: linear-gradient(135deg, rgba(255,214,10,.08), rgba(57,255,20,.08)); padding: 14px; border-radius: 10px; border: 1px solid rgba(255,214,10,.2); }
  .award-title { font-size: 11px; color: var(--gold); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 4px; }
  .award-winner { font-size: 18px; font-weight: 700; color: var(--text); }
  .award-detail { color: var(--text-dim); font-size: 12px; margin-top: 4px; }

  .heatmap-cell { padding: 8px; text-align: center; border-radius: 4px; font-size: 11px; font-weight: 600; }
  .heat-0 { background: #1a2030; color: var(--text-dim); }
  .heat-1 { background: rgba(255,69,58,.2); color: var(--bad); }
  .heat-2 { background: rgba(255,149,0,.25); color: var(--warn); }
  .heat-3 { background: rgba(57,255,20,.2); color: var(--green); }
  .heat-4 { background: rgba(57,255,20,.4); color: #fff; font-weight: 700; }
  .heat-5 { background: rgba(57,255,20,.7); color: #000; font-weight: 700; }

  .small-table th, .small-table td { padding: 5px 8px; }
  .footer { color: var(--text-dim); font-size: 11px; margin-top: 32px; padding-top: 16px; border-top: 1px solid #2a3342; }

  .upload-zone { border: 2px dashed #2a3342; border-radius: 12px; padding: 40px; text-align: center; transition: all .2s; cursor: pointer; background: var(--bg2); }
  .upload-zone:hover, .upload-zone.dragover { border-color: var(--green); background: rgba(57,255,20,.04); }
  .upload-zone input { display: none; }
  .upload-icon { font-size: 32px; color: var(--text-dim); }
  .upload-msg { color: var(--text-dim); font-size: 13px; margin-top: 8px; }

  .toggle { display: inline-block; position: relative; width: 44px; height: 22px; }
  .toggle input { opacity: 0; width: 0; height: 0; }
  .toggle-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: #2a3342; border-radius: 22px; transition: .3s; }
  .toggle-slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: .3s; }
  .toggle input:checked + .toggle-slider { background: var(--green); }
  .toggle input:checked + .toggle-slider:before { transform: translateX(22px); }
  .toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px dotted #2a3342; }

  .delta-good { color: var(--green); }
  .delta-bad { color: var(--bad); }
  .delta-warn { color: var(--warn); }
  .delta-add { color: var(--green); }
  .delta-mod { color: var(--warn); }
  .delta-rm { color: var(--bad); }

  .policy-box { background: rgba(0,102,204,.06); border-left: 3px solid var(--blue); padding: 14px 18px; border-radius: 4px; margin: 10px 0; font-size: 13px; }
  .policy-box strong { color: var(--green); }
  .danger-box { background: rgba(255,69,58,.06); border-left: 3px solid var(--bad); padding: 14px 18px; border-radius: 4px; margin: 10px 0; font-size: 13px; }
  .winner-box { background: rgba(57,255,20,.06); border-left: 3px solid var(--green); padding: 14px 18px; border-radius: 4px; margin: 10px 0; font-size: 13px; font-style: italic; color: var(--green); font-weight: 600; }
  .warn-box { background: rgba(255,149,0,.06); border-left: 3px solid var(--warn); padding: 14px 18px; border-radius: 4px; margin: 10px 0; font-size: 13px; }

  .btn { display: inline-block; padding: 10px 18px; border-radius: 8px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; transition: all .15s; margin-right: 8px; }
  .btn-primary { background: var(--green); color: #000; }
  .btn-primary:hover { background: #5fff45; }
  .btn-warn { background: var(--warn); color: #000; }
  .btn-warn:hover { background: #ffaa3d; }
  .btn-secondary { background: var(--bg3); color: var(--text); border: 1px solid #2a3342; }
  .btn-secondary:hover { background: #252d3d; }

  .diff-table td { vertical-align: top; }
  .diff-table input[type="number"] { background: var(--bg3); border: 1px solid #2a3342; color: var(--text); padding: 4px 6px; border-radius: 4px; width: 110px; text-align: right; }
  .diff-row-add { background: rgba(57,255,20,.05); }
  .diff-row-mod { background: rgba(255,149,0,.05); }
  .diff-row-rm { background: rgba(255,69,58,.05); }

  .changelog-entry { padding: 12px; border-bottom: 1px solid #2a3342; font-size: 13px; }
  .changelog-entry:last-child { border-bottom: 0; }
  .changelog-time { color: var(--text-dim); font-size: 11px; }
</style>
</head>
<body>

<h1>RCRS 2026 H1 Trip Program</h1>
<div class="sub">
  Live dashboard · Source: <code>2026 Sales Numbers - with Totals.xlsx</code> · Generated ${new Date().toLocaleString()} ·
  ${daysLeftH1} days left in H1 (~${weeksLeftH1} weeks, ${monthsLeftH1} months) ·
  Trip qualification = $400K cumulative Jan 1 – Jun 30
</div>

<!-- HERO -->
<div class="hero">
  <div class="stat"><div class="stat-label">Team H1 YTD</div><div class="stat-value">$${Math.round(totalTeam).toLocaleString()}</div><div class="stat-sub">across ${data.reps.length} reps</div></div>
  <div class="stat"><div class="stat-label">Team Average</div><div class="stat-value">$${Math.round(teamAvg).toLocaleString()}</div><div class="stat-sub">per rep YTD</div></div>
  <div class="stat"><div class="stat-label">Qualified for Trip</div><div class="stat-value">${qualifiedCount} / ${data.reps.length}</div><div class="stat-sub">${(qualifiedCount/data.reps.length*100).toFixed(0)}% of team</div></div>
  <div class="stat"><div class="stat-label">Total Accrued</div><div class="stat-value">$${totalAccrued.toLocaleString()}</div><div class="stat-sub">$${totalToBePaid.toLocaleString()} locked, $${totalForfeitedSoFar.toLocaleString()} pending</div></div>
  <div class="stat"><div class="stat-label">Top Producer</div><div class="stat-value">${awards.topProducer.rep}</div><div class="stat-sub">$${Math.round(awards.topProducer.ytd).toLocaleString()}</div></div>
  <div class="stat"><div class="stat-label">Biggest Month</div><div class="stat-value">$${Math.round(awards.biggestMonth.revenue).toLocaleString()}</div><div class="stat-sub">${awards.biggestMonth.rep} - ${awards.biggestMonth.month}</div></div>
</div>

<!-- AWARDS -->
<h2>🏆 Superlatives</h2>
<div class="award-grid">
  <div class="award"><div class="award-title">👑 Top Producer</div><div class="award-winner">${awards.topProducer.rep}</div><div class="award-detail">$${Math.round(awards.topProducer.ytd).toLocaleString()} YTD</div></div>
  <div class="award"><div class="award-title">🔥 Biggest Single Month</div><div class="award-winner">${awards.biggestMonth.rep}</div><div class="award-detail">${awards.biggestMonth.month} - $${Math.round(awards.biggestMonth.revenue).toLocaleString()}</div></div>
  <div class="award"><div class="award-title">🎯 Most Consistent</div><div class="award-winner">${awards.mostConsistent ? awards.mostConsistent.rep : '—'}</div><div class="award-detail">${awards.mostConsistent ? awards.mostConsistent.stats.tieredMonths + ' of ' + monthsCompleted + ' months tier hit' : '—'}</div></div>
  <div class="award"><div class="award-title">💰 Highest Tier Hit</div><div class="award-winner">${awards.highestSingleTier ? awards.highestSingleTier.rep : '—'}</div><div class="award-detail">${awards.highestSingleTier ? awards.highestSingleTier.tier + ' in ' + awards.highestSingleTier.month + ' (+$' + awards.highestSingleTier.bonus.toLocaleString() + ')' : '—'}</div></div>
  <div class="award"><div class="award-title">🚀 Best January Start</div><div class="award-winner">${awards.fastestStarter ? awards.fastestStarter.rep : '—'}</div><div class="award-detail">${awards.fastestStarter ? '$' + Math.round(awards.fastestStarter.breakdown[0].revenue).toLocaleString() + ' Jan' : '—'}</div></div>
  <div class="award"><div class="award-title">🌟 April Surge</div><div class="award-winner">${awards.bestAprilSurge ? awards.bestAprilSurge.rep : '—'}</div><div class="award-detail">${awards.bestAprilSurge ? '$' + Math.round(awards.bestAprilSurge.breakdown[3].revenue).toLocaleString() + ' April' : '—'}</div></div>
  ${awards.comebackKid ? `<div class="award"><div class="award-title">💪 Comeback Candidate</div><div class="award-winner">${awards.comebackKid.rep}</div><div class="award-detail">Best month would close their gap if repeated</div></div>` : ''}
</div>

<!-- CHARTS -->
<h2>📊 Sales Charts</h2>
<div class="grid-2">
  <div class="chart-card"><h3>YTD Sales by Rep</h3><div class="chart-wrap"><canvas id="ytdChart"></canvas></div></div>
  <div class="chart-card"><h3>Trip Progress (toward $400K)</h3><div class="chart-wrap"><canvas id="tripChart"></canvas></div></div>
</div>
<div class="grid-2" style="margin-top: 16px;">
  <div class="chart-card"><h3>Monthly Sales Trend</h3><div class="chart-wrap"><canvas id="trendChart"></canvas></div></div>
  <div class="chart-card"><h3>Monthly Team Total (Stacked)</h3><div class="chart-wrap"><canvas id="teamMonthChart"></canvas></div></div>
</div>

<!-- HEATMAP -->
<h2>🔥 Tier Heatmap (highest tier reached each month)</h2>
<div class="card">
  <table>
    <thead><tr><th>Rep</th>${months.map(m => `<th style="text-align:center">${m}</th>`).join('')}<th>Tier Hits</th><th>Pot</th></tr></thead>
    <tbody>
      ${data.reps.map(r => {
        const cells = r.breakdown.map(b => {
          const tierIdx = b.bonus === 0 ? (b.revenue > 0 ? 1 : 0) :
            b.bonus <= 350 ? 2 : b.bonus <= 1450 ? 3 : b.bonus <= 3250 ? 4 : 5;
          const txt = b.bonus > 0 ? `${b.tier}<br>+$${b.bonus.toLocaleString()}` : (b.revenue > 0 ? `$${(b.revenue/1000).toFixed(0)}K` : '—');
          return `<td><div class="heatmap-cell heat-${tierIdx}">${txt}</div></td>`;
        }).join('');
        return `<tr><td><strong>${r.rep}</strong></td>${cells}<td>${r.stats.tieredMonths}/${monthsCompleted}</td><td><strong>$${r.accruedTripBudget.toLocaleString()}</strong></td></tr>`;
      }).join('')}
    </tbody>
  </table>
  <p class="sub" style="margin-top:8px">Color = pot growth that month. Highest tier reached wins — a $200K month adds $1,200 to the pot.</p>
</div>

<!-- INDIVIDUAL CARDS -->
<h2>👤 Individual Rep Breakdown</h2>
<div class="grid-3">
  ${data.reps.map(r => {
    const ins = r.insights;
    const llc = LLC[r.rep];
    const pct = r.pctToTrip;
    const barClass = r.qualifiedForTrip ? '' : pct >= 50 ? 'warn' : 'bad';
    const statusBadge = r.qualifiedForTrip ? '<span class="badge badge-green">QUALIFIED</span>' : pct >= 50 ? '<span class="badge badge-warn">PENDING</span>' : '<span class="badge badge-bad">BEHIND</span>';
    return `
    <div class="rep-card ${r.qualifiedForTrip ? 'qualified' : ''}">
      <div class="rep-name">${r.rep} ${statusBadge}</div>
      <div class="rep-llc">${llc || '<em>(no LLC on file)</em>'}</div>

      ${ins.deltaMessage ? `<div class="delta-card">${ins.deltaMessage}</div>` : ''}

      <div class="section-label">Trip Progress</div>
      <div class="progress"><div class="progress-bar ${barClass}" style="width: ${pct}%"></div><div class="progress-label">${pct.toFixed(1)}% to $400K</div></div>
      <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-dim)">
        <span>$${Math.round(r.ytd).toLocaleString()} YTD</span>
        <span>${r.qualifiedForTrip ? 'Qualified ✓' : 'Gap: $' + Math.round(r.gapToTrip).toLocaleString()}</span>
      </div>

      <div class="section-label">Stats</div>
      <div class="tier-row"><span class="lbl">Best month</span><span class="val">${r.stats.bestMonth.month} - $${Math.round(r.stats.bestMonth.revenue).toLocaleString()}</span></div>
      <div class="tier-row"><span class="lbl">Active months</span><span class="val">${r.stats.activeMonths} of ${monthsCompleted}</span></div>
      <div class="tier-row"><span class="lbl">Tier hits</span><span class="val">${r.stats.tieredMonths} of ${monthsCompleted}</span></div>
      <div class="tier-row"><span class="lbl">Avg / active month</span><span class="val">$${Math.round(r.stats.monthlyAvg).toLocaleString()}</span></div>
      <div class="tier-row"><span class="lbl">Projected H1 finish</span><span class="val">$${Math.round(r.stats.projectedH1AtCurrentPace).toLocaleString()}</span></div>
      ${!r.qualifiedForTrip ? `<div class="tier-row"><span class="lbl">Need / month to qualify</span><span class="val">$${Math.round(r.stats.neededPerMonth).toLocaleString()}</span></div>` : ''}
      ${!r.qualifiedForTrip ? `<div class="tier-row"><span class="lbl">Need / week to qualify</span><span class="val">$${Math.round(r.stats.neededPerWeek).toLocaleString()}</span></div>` : ''}
      <div class="tier-row"><span class="lbl">Trip fund pot</span><span class="val">$${r.accruedTripBudget.toLocaleString()}</span></div>

      ${ins.wins.length ? `<div class="section-label">✓ Wins</div><ul class="insight-list wins">${ins.wins.map(w => `<li>${w}</li>`).join('')}</ul>` : ''}
      ${ins.gaps.length ? `<div class="section-label">! Gaps</div><ul class="insight-list gaps">${ins.gaps.map(g => `<li>${g}</li>`).join('')}</ul>` : ''}
      ${ins.suggestions.length ? `<div class="section-label">→ Suggestions</div><ul class="insight-list suggestions">${ins.suggestions.map(s => `<li>${s}</li>`).join('')}</ul>` : ''}
      <div class="motivation">${ins.motivation}</div>
    </div>`;
  }).join('')}
</div>

<!-- WHAT-IT-TAKES -->
<h2>🔮 What It Would Take (May + June)</h2>
<div class="card">
  <p class="sub">For each pending rep: $/month and $/week needed to qualify by Jun 30.</p>
  <table>
    <thead><tr><th>Rep</th><th>Gap</th><th>$/month</th><th>$/week</th><th>Best month</th><th>If best repeats once</th><th>Verdict</th></tr></thead>
    <tbody>
      ${data.reps.filter(r => !r.qualifiedForTrip).sort((a, b) => a.gapToTrip - b.gapToTrip).map(r => {
        const oneRepeat = r.ytd + r.stats.bestMonth.revenue;
        const verdict = oneRepeat >= data.tripThreshold ? '<span class="badge badge-green">REACHABLE — 1 big month</span>' :
                        r.stats.wouldQualifyIfBestRepeats ? '<span class="badge badge-warn">REACHABLE — 2 big months</span>' :
                        '<span class="badge badge-bad">NEEDS NEW HIGH</span>';
        return `<tr><td><strong>${r.rep}</strong></td><td>$${Math.round(r.gapToTrip).toLocaleString()}</td><td>$${Math.round(r.stats.neededPerMonth).toLocaleString()}</td><td>$${Math.round(r.stats.neededPerWeek).toLocaleString()}</td><td>$${Math.round(r.stats.bestMonth.revenue).toLocaleString()} (${r.stats.bestMonth.month})</td><td>$${Math.round(oneRepeat).toLocaleString()}</td><td>${verdict}</td></tr>`;
      }).join('')}
    </tbody>
  </table>
</div>

<!-- RANKINGS -->
<h2>🏅 Multi-Lens Rankings</h2>
<div class="grid-3">
  <div class="card"><h3>By YTD Total</h3><table class="small-table">${[...data.reps].sort((a,b)=>b.ytd-a.ytd).map((r,i) => `<tr><td>${i+1}. ${r.rep}</td><td>$${Math.round(r.ytd).toLocaleString()}</td></tr>`).join('')}</table></div>
  <div class="card"><h3>By Best Single Month</h3><table class="small-table">${[...data.reps].sort((a,b)=>b.stats.bestMonth.revenue-a.stats.bestMonth.revenue).map((r,i) => `<tr><td>${i+1}. ${r.rep}</td><td>$${Math.round(r.stats.bestMonth.revenue).toLocaleString()}</td></tr>`).join('')}</table></div>
  <div class="card"><h3>By Avg per Active Month</h3><table class="small-table">${[...data.reps].sort((a,b)=>b.stats.monthlyAvg-a.stats.monthlyAvg).map((r,i) => `<tr><td>${i+1}. ${r.rep}</td><td>$${Math.round(r.stats.monthlyAvg).toLocaleString()}</td></tr>`).join('')}</table></div>
  <div class="card"><h3>By Consistency %</h3><table class="small-table">${[...data.reps].sort((a,b)=>b.stats.consistency-a.stats.consistency).map((r,i) => `<tr><td>${i+1}. ${r.rep}</td><td>${r.stats.consistency.toFixed(0)}%</td></tr>`).join('')}</table></div>
  <div class="card"><h3>By Trip Fund Pot</h3><table class="small-table">${[...data.reps].sort((a,b)=>b.accruedTripBudget-a.accruedTripBudget).map((r,i) => `<tr><td>${i+1}. ${r.rep}</td><td>$${r.accruedTripBudget.toLocaleString()}</td></tr>`).join('')}</table></div>
  <div class="card"><h3>By % to Trip</h3><table class="small-table">${[...data.reps].sort((a,b)=>b.pctToTrip-a.pctToTrip).map((r,i) => `<tr><td>${i+1}. ${r.rep}</td><td>${r.pctToTrip.toFixed(1)}%</td></tr>`).join('')}</table></div>
</div>

<!-- PROGRAM RULES (consolidated) -->
<h2>📋 Program Rules &amp; Definitions</h2>
<div class="card">
  <h3>Monthly Bonus Tiers — Trip Fund Pot Growth</h3>
  <p class="sub">Highest single tier reached in a month adds that bonus to your pot. Bigger month = bigger pot.</p>
  ${data.monthlyTiers.map(t => `<div class="tier-row"><span class="lbl">Hit $${(t.threshold/1000).toFixed(0)}K in a single month</span><span class="val">+$${t.bonus.toLocaleString()} to pot</span></div>`).join('')}
  <div class="tier-row"><span class="lbl"><strong>$500K → $1M</strong> (linear, +$1,000 per additional $100K)</span><span class="val">capped at +$9,000 (max @ $1M month)</span></div>
  <div class="policy-box" style="margin-top:14px"><strong>Examples:</strong> $200K month = +$1,200 to pot. $700K month = $4,000 ($500K tier) + $2,000 (linear) = <strong>+$6,000 to pot</strong>. $1M month = <strong>+$9,000 (cap)</strong>. Anything above $1M in a single month still tops out at $9,000.</div>

  <h3 style="margin-top:24px">Trip Rules &amp; Restrictions</h3>
  <ul class="insight-list">
    <li class="suggestions" style="padding-left:22px;position:relative">→ Hit <strong>$400K cumulative</strong> Jan 1 – Jun 30 to qualify. <strong>$400K total must be reached</strong> — anything below = no payout, accrued bonuses forfeited.</li>
    <li class="suggestions" style="padding-left:22px;position:relative">→ Trip must be scheduled <strong>30–60 days following the end of the comp</strong>, unless approved by owners.</li>
    <li class="suggestions" style="padding-left:22px;position:relative">→ RCRS books wherever rep wants. Total flexibility within budget — Frontier or first-class Delta is rep's call.</li>
    <li class="suggestions" style="padding-left:22px;position:relative">→ Cash for small spend (excursions, on-the-ground items) issued before/during.</li>
    <li class="suggestions" style="padding-left:22px;position:relative">→ H2 (Jul 1 – Dec 31) starts over for the next trip cycle.</li>
    <li class="suggestions" style="padding-left:22px;position:relative">→ <strong>Sale Definition:</strong> a sale counts the month the contract is signed AND the deposit is received. The same revenue cannot be moved between months.</li>
  </ul>

  <h3 style="margin-top:24px">Cancellation / Returned Deposit</h3>
  <div class="danger-box">If a deposit is returned (deal canceled), revenue is removed from <strong>the month the deposit was originally received</strong>. Tier bonuses recalculate. If the cancellation drops the rep below qualification, the difference is clawed back from the trip pot. Sheet-side log captures every change.</div>

  <h3 style="margin-top:24px">Cash-Out Option (discretionary)</h3>
  <p class="sub">RCRS prefers the rep takes the trip. Break + cultural energy is worth more than cash. Cash-out is available case-by-case for qualified reps who can't travel.</p>
  <div class="tier-row"><span class="lbl">Cash payout</span><span class="val">${(CASH_OUT_PCT*100).toFixed(0)}% of trip pot</span></div>
  <div class="tier-row"><span class="lbl">Why discounted?</span><span class="val">Encourages taking the trip</span></div>
  <p class="sub" style="margin-top:10px">Example: $5,400 pot → trip 100% covered up to $5,400, OR $${Math.round(5400 * CASH_OUT_PCT).toLocaleString()} cash. Decided 1-on-1 with leadership. Not advertised as automatic.</p>

  <h3 style="margin-top:24px">Trip Spending — what's in</h3>
  <p class="sub">Total flexibility within accrued pot:</p>
  <ul class="insight-list">
    <li class="wins" style="padding-left:22px;position:relative">✓ Flights (any class)</li>
    <li class="wins" style="padding-left:22px;position:relative">✓ Hotel / accommodations (any tier)</li>
    <li class="wins" style="padding-left:22px;position:relative">✓ Meals, drinks (any spend — $4K bottle of Bub if you want)</li>
    <li class="wins" style="padding-left:22px;position:relative">✓ Excursions, activities</li>
    <li class="wins" style="padding-left:22px;position:relative">✓ Ground transport (rental, Uber, etc.)</li>
    <li class="wins" style="padding-left:22px;position:relative">✓ Cash for on-the-ground items</li>
  </ul>
  <p class="sub" style="font-size:11px;margin-top:8px"><em>Tax note: trip value may be reportable to rep as taxable benefit. Discuss with bookkeeper before booking.</em></p>
</div>

<!-- ADMIN-ONLY SECTIONS (visible only with ?admin=1) -->
<div id="adminOnly" style="display:none">

<!-- SNAPSHOT HISTORY -->
<h2>📅 Snapshot History &amp; Trends</h2>
<div class="card">
  <p class="sub">Every change to the underlying spreadsheet creates a new snapshot. Hash-based dedup means no duplicates. ${snapshots.length} snapshot(s) on file.</p>
  ${snapshots.length === 0 ? '<p>No history yet.</p>' :
    `<table class="small-table">
      <thead><tr><th>Captured</th><th>Team Total</th><th>Total Accrued</th><th>Qualified</th><th>vs Previous</th><th>Changes</th></tr></thead>
      <tbody>
        ${snapshots.slice().reverse().slice(0, 20).map((h, i, arr) => {
          const realIdx = snapshots.length - 1 - i;
          const prev = realIdx > 0 ? snapshots[realIdx - 1] : null;
          const delta = prev ? h.teamTotal - prev.teamTotal : null;
          const deltaStr = delta === null ? '—' : (delta > 0 ? `<span class="delta-good">+$${Math.round(delta).toLocaleString()}</span>` : delta < 0 ? `<span class="delta-bad">-$${Math.round(-delta).toLocaleString()}</span>` : 'no change');
          const ts = new Date(h.capturedAt).toLocaleString();
          const changeStr = (h.additionCount || 0) + (h.retroactiveCount || 0) === 0 ? '—' : `${h.additionCount || 0} new${h.retroactiveCount ? `, <span class="delta-warn">${h.retroactiveCount} retro</span>` : ''}`;
          return `<tr><td>${ts}</td><td>$${Math.round(h.teamTotal).toLocaleString()}</td><td>$${(h.totalAccrued||0).toLocaleString()}</td><td>${h.qualifiedCount}</td><td>${deltaStr}</td><td>${changeStr}</td></tr>`;
        }).join('')}
      </tbody>
    </table>
    <div class="chart-card" style="margin-top:16px"><h3>Team Total &amp; Pot Growth Over Time</h3><div class="chart-wrap"><canvas id="historyChart"></canvas></div></div>`
  }
</div>

<!-- CHANGE LOG -->
<h2>📝 Change Log (last ${changeLog.length} entries)</h2>
<div class="card">
  <p class="sub">Every modification — including retroactive changes to past months — is logged here.</p>
  ${changeLog.length === 0 ? '<p class="sub">No changes logged yet. Modifications appear here when the underlying sheet changes.</p>' :
    changeLog.slice().reverse().slice(0, 20).map(entry => {
      const retro = entry.changes.filter(c => c.type === 'modified' || c.type === 'removed');
      const adds = entry.changes.filter(c => c.type === 'added');
      return `<div class="changelog-entry">
        <div class="changelog-time">${new Date(entry.timestamp).toLocaleString()}</div>
        <div><strong>${adds.length} new</strong> entry/entries${retro.length ? `, <span class="delta-warn"><strong>${retro.length} retroactive</strong></span> change(s)` : ''}</div>
        ${retro.length ? `<div style="margin-top:6px;font-size:12px">${retro.map(c => `<div>• <strong>${c.rep}</strong> ${c.month}: $${c.oldValue.toLocaleString()} → $${c.newValue.toLocaleString()} <span class="${c.delta>0?'delta-good':'delta-bad'}">(${c.delta>0?'+':''}$${Math.round(c.delta).toLocaleString()})</span></div>`).join('')}</div>` : ''}
      </div>`;
    }).join('')
  }
</div>

<!-- FILE UPLOAD -->
<h2>📤 Upload New Spreadsheet</h2>
<div class="card">
  <p class="sub">Drop a new <code>2026 Sales Numbers by Month.xlsx</code> file here. The dashboard will:
    <strong>1)</strong> parse the new file, <strong>2)</strong> compare to current data,
    <strong>3)</strong> flag any retroactive changes (numbers that shifted for past months),
    <strong>4)</strong> let you confirm, override individual cells, or cancel.
    Same format expected: one tab per month, column A = rep name, column B = revenue.</p>
  <label class="upload-zone" id="uploadZone">
    <input type="file" id="fileInput" accept=".xlsx,.xls" />
    <div class="upload-icon">📁</div>
    <div><strong>Click or drop XLSX here</strong></div>
    <div class="upload-msg">Tabs = months · Column A = rep · Column B = revenue</div>
  </label>
  <div id="uploadResult"></div>
</div>

<!-- NOTIFICATIONS (DISABLED) -->
<h2>🔔 Notifications (configured, off)</h2>
<div class="card">
  <p class="sub">Notification infrastructure is ready but disabled. Toggle on when you're ready.</p>
  <div class="toggle-row">
    <div><strong>Pot growth text</strong> to each rep when their pot increases<br><span class="sub">"+$X added to your trip fund — total $Y toward a peaceful vacation."</span></div>
    <label class="toggle"><input type="checkbox" disabled><span class="toggle-slider"></span></label>
  </div>
  <div class="toggle-row">
    <div><strong>Tier-cross alert</strong> to leadership<br><span class="sub">When a rep crosses a tier mid-month</span></div>
    <label class="toggle"><input type="checkbox" disabled><span class="toggle-slider"></span></label>
  </div>
  <div class="toggle-row">
    <div><strong>Trip-qualified celebration</strong><br><span class="sub">Auto-post to GroupMe when a rep crosses $400K</span></div>
    <label class="toggle"><input type="checkbox" disabled><span class="toggle-slider"></span></label>
  </div>
  <div class="toggle-row">
    <div><strong>Retroactive change alert</strong> to leadership<br><span class="sub">When a prior-month number changes after upload</span></div>
    <label class="toggle"><input type="checkbox" disabled><span class="toggle-slider"></span></label>
  </div>
  <div class="toggle-row">
    <div><strong>End-of-month roll-up</strong> email to leadership<br><span class="sub">Standings, deltas, projection</span></div>
    <label class="toggle"><input type="checkbox" disabled><span class="toggle-slider"></span></label>
  </div>
</div>

</div><!-- /adminOnly -->

<div class="footer">
  Source: <code>2026 Sales Numbers - with Totals.xlsx</code> ·
  Tier table: <code>data/competition-config.json</code> ·
  Generators: <code>scripts/bonus-tracker-2026.mjs</code> + <code>scripts/bonus-dashboard-2026.mjs</code> ·
  Snapshots: <code>data/history/</code> ·
  Change log: <code>data/change-log.json</code>
</div>

<script>
// Admin-only sections: revealed via ?admin=1 in URL
const IS_ADMIN = (function(){
  try {
    var params = new URLSearchParams(window.location.search);
    if (params.get('admin') === '1') {
      var el = document.getElementById('adminOnly');
      if (el) el.style.display = 'block';
      return true;
    }
  } catch(e) {}
  return false;
})();

const PAYLOAD = ${JSON.stringify(payload)};

Chart.defaults.color = '#8b95a5';
Chart.defaults.borderColor = '#2a3342';
Chart.defaults.font.family = "-apple-system, system-ui, 'Segoe UI', Inter, sans-serif";

const repNames = PAYLOAD.reps.map(r => r.rep);
const repColors = PAYLOAD.reps.map(r => r.qualifiedForTrip ? '#39FF14' : r.pctToTrip >= 50 ? '#ff9500' : '#ff453a');
const palette = ['#39FF14', '#0066CC', '#ff9500', '#ffd60a', '#ff453a', '#bf5af2', '#64d2ff', '#ff6482'];

const COMMON = { responsive: true, maintainAspectRatio: false };

new Chart(document.getElementById('ytdChart'), {
  type: 'bar',
  data: { labels: repNames, datasets: [{ label: 'YTD', data: PAYLOAD.reps.map(r => Math.round(r.ytd)), backgroundColor: repColors }] },
  options: { ...COMMON, indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => '$' + c.raw.toLocaleString() } } }, scales: { x: { ticks: { callback: v => '$' + (v/1000).toFixed(0) + 'K' }, grid: { color: '#1c2330' } }, y: { grid: { display: false } } } }
});

new Chart(document.getElementById('tripChart'), {
  type: 'bar',
  data: { labels: repNames, datasets: [{ label: '%', data: PAYLOAD.reps.map(r => r.pctToTrip.toFixed(1)), backgroundColor: repColors }] },
  options: { ...COMMON, indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.raw + '% to $400K' } } }, scales: { x: { max: 100, ticks: { callback: v => v + '%' }, grid: { color: '#1c2330' } }, y: { grid: { display: false } } } }
});

new Chart(document.getElementById('trendChart'), {
  type: 'line',
  data: { labels: PAYLOAD.months, datasets: PAYLOAD.reps.map((r, i) => ({ label: r.rep, data: r.breakdown.map(b => Math.round(b.revenue)), borderColor: palette[i % palette.length], backgroundColor: palette[i % palette.length] + '22', tension: .3, pointRadius: 4 })) },
  options: { ...COMMON, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10 } }, tooltip: { callbacks: { label: c => c.dataset.label + ': $' + c.raw.toLocaleString() } } }, scales: { y: { ticks: { callback: v => '$' + (v/1000).toFixed(0) + 'K' }, grid: { color: '#1c2330' } } } }
});

new Chart(document.getElementById('teamMonthChart'), {
  type: 'bar',
  data: { labels: PAYLOAD.months, datasets: PAYLOAD.reps.map((r, i) => ({ label: r.rep, data: r.breakdown.map(b => Math.round(b.revenue)), backgroundColor: palette[i % palette.length] })) },
  options: { ...COMMON, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10 } }, tooltip: { callbacks: { label: c => c.dataset.label + ': $' + c.raw.toLocaleString() } } }, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ticks: { callback: v => '$' + (v/1000).toFixed(0) + 'K' }, grid: { color: '#1c2330' } } } }
});

if (IS_ADMIN && PAYLOAD.snapshots && PAYLOAD.snapshots.length > 0 && document.getElementById('historyChart')) {
  new Chart(document.getElementById('historyChart'), {
    type: 'line',
    data: {
      labels: PAYLOAD.snapshots.map(h => new Date(h.capturedAt).toLocaleDateString() + ' ' + new Date(h.capturedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})),
      datasets: [
        { label: 'Team Total Sales', data: PAYLOAD.snapshots.map(h => Math.round(h.teamTotal)), borderColor: '#39FF14', backgroundColor: 'rgba(57,255,20,.1)', fill: true, tension: .3, yAxisID: 'y' },
        { label: 'Total Accrued Pot', data: PAYLOAD.snapshots.map(h => Math.round(h.totalAccrued || 0)), borderColor: '#ffd60a', backgroundColor: 'rgba(255,214,10,.1)', fill: false, tension: .3, yAxisID: 'y1' }
      ]
    },
    options: { ...COMMON, plugins: { legend: { position: 'bottom' } }, scales: { y: { type: 'linear', position: 'left', ticks: { callback: v => '$' + (v/1000).toFixed(0) + 'K' }, grid: { color: '#1c2330' } }, y1: { type: 'linear', position: 'right', ticks: { callback: v => '$' + v.toLocaleString() }, grid: { drawOnChartArea: false } } } }
  });
}

// ---------- File upload with diff detection ----------
const zone = document.getElementById('uploadZone');
const input = document.getElementById('fileInput');
const result = document.getElementById('uploadResult');
let pendingUpload = null;

['dragenter', 'dragover'].forEach(e => zone.addEventListener(e, ev => { ev.preventDefault(); zone.classList.add('dragover'); }));
['dragleave', 'drop'].forEach(e => zone.addEventListener(e, ev => { ev.preventDefault(); zone.classList.remove('dragover'); }));
zone.addEventListener('drop', ev => { if (ev.dataTransfer.files.length) handleFile(ev.dataTransfer.files[0]); });
input.addEventListener('change', ev => { if (ev.target.files.length) handleFile(ev.target.files[0]); });

function handleFile(file) {
  result.innerHTML = '<p class="sub">Reading ' + file.name + '...</p>';
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const newMonths = wb.SheetNames.map(s => s.trim());
      const newData = {};
      for (const sheetName of wb.SheetNames) {
        const month = sheetName.trim();
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
        for (const row of rows) {
          const rep = String(row[0] || '').trim();
          const rev = Number(row[1]) || 0;
          if (!rep || rev <= 0) continue;
          if (!newData[rep]) newData[rep] = {};
          newData[rep][month] = (newData[rep][month] || 0) + rev;
        }
      }
      pendingUpload = { fileName: file.name, newData, newMonths };
      renderDiff(file.name, newData, newMonths);
    } catch (err) {
      result.innerHTML = '<div class="danger-box">Error parsing file: ' + err.message + '</div>';
    }
  };
  reader.readAsArrayBuffer(file);
}

function renderDiff(fileName, newData, newMonths) {
  const current = PAYLOAD.currentDataMap;
  const allReps = new Set([...Object.keys(current), ...Object.keys(newData)]);
  const allMonths = new Set([...PAYLOAD.months, ...newMonths]);

  const adds = [], mods = [], rms = [], unchanged = [];
  for (const rep of allReps) {
    const cur = current[rep] || {};
    const nw = newData[rep] || {};
    for (const m of allMonths) {
      const oldV = cur[m] || 0;
      const newV = nw[m] || 0;
      if (Math.abs(oldV - newV) < 0.01) { if (oldV > 0) unchanged.push({rep, m, val: oldV}); continue; }
      if (oldV === 0 && newV > 0) adds.push({ rep, m, oldV, newV });
      else if (oldV > 0 && newV === 0) rms.push({ rep, m, oldV, newV });
      else mods.push({ rep, m, oldV, newV });
    }
  }

  const totalCur = Object.values(current).reduce((s, r) => s + Object.values(r).reduce((a,b) => a+b, 0), 0);
  const totalNew = Object.values(newData).reduce((s, r) => s + Object.values(r).reduce((a,b) => a+b, 0), 0);

  let html = '<div class="card" style="margin-top:14px">';
  html += '<h3>Diff Analysis: ' + fileName + '</h3>';
  html += '<p class="sub">Current team total: $' + Math.round(totalCur).toLocaleString() + ' &nbsp;→&nbsp; New: $' + Math.round(totalNew).toLocaleString() + ' (delta: ' + (totalNew-totalCur >= 0 ? '+' : '') + '$' + Math.round(totalNew-totalCur).toLocaleString() + ')</p>';

  if (rms.length > 0) {
    html += '<div class="danger-box"><strong>⚠ ' + rms.length + ' entry/entries DELETED</strong> (revenue removed from previously-recorded months). This may indicate cancellations or sheet errors.</div>';
  }
  if (mods.length > 0) {
    html += '<div class="warn-box"><strong>⚠ ' + mods.length + ' RETROACTIVE change(s)</strong> — numbers shifted for previously-recorded months. Review carefully:</div>';
  }
  if (adds.length === 0 && mods.length === 0 && rms.length === 0) {
    html += '<div class="winner-box">✓ No changes detected. New file is identical to current data.</div>';
  }

  if (adds.length || mods.length || rms.length) {
    html += '<table class="diff-table" style="margin-top:14px">';
    html += '<thead><tr><th>Type</th><th>Rep</th><th>Month</th><th>Current</th><th>New (editable)</th><th>Delta</th></tr></thead><tbody>';
    const all = [...mods.map(x => ({...x, type: 'mod'})), ...rms.map(x => ({...x, type: 'rm'})), ...adds.map(x => ({...x, type: 'add'}))];
    for (let i = 0; i < all.length; i++) {
      const x = all[i];
      const cls = x.type === 'add' ? 'diff-row-add' : x.type === 'mod' ? 'diff-row-mod' : 'diff-row-rm';
      const lbl = x.type === 'add' ? '<span class="delta-add">+ NEW</span>' : x.type === 'mod' ? '<span class="delta-mod">~ MODIFIED</span>' : '<span class="delta-rm">- REMOVED</span>';
      const delta = x.newV - x.oldV;
      html += '<tr class="' + cls + '"><td>' + lbl + '</td><td><strong>' + x.rep + '</strong></td><td>' + x.m + '</td><td>$' + x.oldV.toLocaleString() + '</td><td><input type="number" id="cell-' + i + '" value="' + x.newV + '" data-rep="' + x.rep + '" data-month="' + x.m + '" data-orig="' + x.oldV + '"></td><td class="' + (delta>=0?'delta-good':'delta-bad') + '">' + (delta>=0?'+':'') + '$' + Math.round(delta).toLocaleString() + '</td></tr>';
    }
    html += '</tbody></table>';
    html += '<div style="margin-top:16px">';
    html += '<button class="btn btn-primary" onclick="confirmUpload()">Accept &amp; Save Changes</button>';
    html += '<button class="btn btn-secondary" onclick="cancelUpload()">Cancel</button>';
    html += '<p class="sub" style="margin-top:10px">Edit individual cells above to override. Then "Accept" downloads a corrected XLSX you can drop in <code>Downloads/</code> + run the tracker scripts to persist. Either way, this action will be entered in the change log.</p>';
    html += '</div>';
  }
  html += '</div>';
  result.innerHTML = html;
}

function logAction(action, details) {
  const log = JSON.parse(localStorage.getItem('rcrs_dashboard_log') || '[]');
  log.push({ timestamp: new Date().toISOString(), action, details });
  localStorage.setItem('rcrs_dashboard_log', JSON.stringify(log));
  console.log('[Dashboard Log]', action, details);
}

function confirmUpload() {
  if (!pendingUpload) return;

  // Collect any user-overridden values
  const overrides = {};
  document.querySelectorAll('.diff-table input[type="number"]').forEach(inp => {
    const rep = inp.dataset.rep;
    const month = inp.dataset.month;
    const orig = parseFloat(inp.dataset.orig);
    const value = parseFloat(inp.value);
    if (!overrides[rep]) overrides[rep] = {};
    overrides[rep][month] = value;
  });

  // Build corrected dataset = newData + overrides
  const corrected = JSON.parse(JSON.stringify(pendingUpload.newData));
  for (const rep in overrides) {
    if (!corrected[rep]) corrected[rep] = {};
    for (const m in overrides[rep]) {
      const v = overrides[rep][m];
      if (v > 0) corrected[rep][m] = v;
      else delete corrected[rep][m];
    }
  }

  // Build new XLSX with corrected data
  const wb = XLSX.utils.book_new();
  const allMonths = new Set();
  for (const rep in corrected) for (const m in corrected[rep]) allMonths.add(m);
  for (const m of [...allMonths].sort((a, b) => {
    const monthOrder = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return monthOrder.indexOf(a) - monthOrder.indexOf(b);
  })) {
    const rows = [];
    for (const rep in corrected) {
      if (corrected[rep][m]) rows.push([rep, corrected[rep][m]]);
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, m);
  }
  XLSX.writeFile(wb, '2026 Sales Numbers - with Totals.xlsx');

  logAction('upload-confirmed', { fileName: pendingUpload.fileName, overrideCount: Object.keys(overrides).length });
  result.innerHTML = '<div class="winner-box">✓ Corrected file downloaded as <strong>2026 Sales Numbers - with Totals.xlsx</strong>.<br><br>To persist:<br>1. Move it to <code>C:\\\\Users\\\\Michael\\\\Downloads\\\\</code> (replace existing).<br>2. Run: <code>node scripts/bonus-tracker-2026.mjs &amp;&amp; node scripts/bonus-dashboard-2026.mjs</code><br>3. Refresh this page.<br><br>Action logged to localStorage.</div>';
  pendingUpload = null;
}

function cancelUpload() {
  logAction('upload-cancelled', { fileName: pendingUpload ? pendingUpload.fileName : null });
  result.innerHTML = '<div class="warn-box">Upload cancelled. Action logged.</div>';
  pendingUpload = null;
}
</script>
</body>
</html>`;

const outDir = path.dirname(OUT_PATH);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(OUT_PATH, html);
fs.writeFileSync(LEGACY_OUT_PATH, html);
console.log('Dashboard written to: ' + OUT_PATH);
console.log('File size: ' + (fs.statSync(OUT_PATH).size / 1024).toFixed(1) + ' KB');
console.log('Snapshots: ' + snapshots.length);
console.log('Change log entries: ' + changeLog.length);
