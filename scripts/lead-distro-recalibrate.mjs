/**
 * Lead Distro Recalibration — quarterly weight-tuning recommendations.
 *
 * Method (the realistic substitute for "self-tuning AI routing"):
 *   1. Pull last 90 days of Lead_Distribution_Log + Lead_Outcome_Log
 *   2. Join on logId
 *   3. For each closed outcome (won / lost / ghosted), record the winning
 *      rep's factor breakdown (from the log's `factors` JSON column)
 *   4. For each factor, compute its average contribution among closed-won
 *      assignments vs closed-lost. Factors that meaningfully correlate with
 *      winning get a weight-bump recommendation.
 *   5. Output a recommendation table with confidence (sample size) and
 *      "what would have maximized closing rate" — never auto-applied.
 *
 * Usage: node scripts/lead-distro-recalibrate.mjs [--days=90] [--out=docs/lead-distro-recalibration-{date}.md]
 *
 * The output file is read by the admin UI's Calibration Recommendations panel.
 */
import fs from 'fs';
import path from 'path';
import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';

// ─── env loader ──────────────────────────────────────────────────────────
const envPath = path.join(process.cwd(), '.env.local');
fs.readFileSync(envPath, 'utf8').split('\n').forEach(l => {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) {
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
});

// ─── args ────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  })
);
const WINDOW_DAYS = parseInt(args.days || '90', 10);
const todayStr = new Date().toISOString().slice(0, 10);
const OUT_PATH = args.out || `docs/lead-distro-recalibration-${todayStr}.md`;

const SHEET_ID = process.env.GOOGLE_SHEETS_ID || process.env.GOOGLE_SHEET_ID || '1uMEdtHo3xMu2gs21p7dYAgYiPWuCZ3s4a8YU-gJZ31s';
const SA_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const SA_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
if (!SA_EMAIL || !SA_KEY) {
  console.error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY');
  process.exit(1);
}

// ─── sheet read ──────────────────────────────────────────────────────────
const auth = new JWT({
  email: SA_EMAIL,
  key: SA_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const doc = new GoogleSpreadsheet(SHEET_ID, auth);
await doc.loadInfo();

const distroSheet = doc.sheetsByTitle['Lead_Distribution_Log'];
const outcomeSheet = doc.sheetsByTitle['Lead_Outcome_Log'];
if (!distroSheet) {
  console.error('Required sheet missing: Lead_Distribution_Log');
  console.error('Cannot recalibrate without distribution history.');
  process.exit(2);
}

const distroRows = await distroSheet.getRows();
// Outcome sheet may not exist yet if no outcome event has fired. Treat as empty.
const outcomeRows = outcomeSheet ? await outcomeSheet.getRows() : [];
if (!outcomeSheet) {
  console.warn('Note: Lead_Outcome_Log sheet does not exist yet (no outcome events have fired). Report will show "insufficient data" until events accumulate.');
}

// ─── window filter ───────────────────────────────────────────────────────
const cutoff = Date.now() - WINDOW_DAYS * 86400000;
const inWindow = (iso) => iso && new Date(iso).getTime() >= cutoff;

// Build outcome map keyed by logId
const outcomesByLogId = new Map();
for (const r of outcomeRows) {
  outcomesByLogId.set(r.get('logId'), r);
}

// Walk distribution log within window
const FACTOR_NAMES = [
  'installProximity', 'contactProximity', 'doorKnockRecency',
  'referralBonus', 'meetingAttendance', 'closeRate', 'responseTime',
];

const bucket = {
  'closed-won': [],
  'closed-lost': [],
  'ghosted': [],
  'open': [],
  'pending-manager-pick': [],
};

let parsedFactorsCount = 0;
let totalAssignments = 0;

for (const distro of distroRows) {
  if (!inWindow(distro.get('timestamp'))) continue;
  totalAssignments++;
  const logId = distro.get('logId');
  const outcome = outcomesByLogId.get(logId);
  if (!outcome) continue;
  const disposition = outcome.get('finalDisposition') || 'open';
  if (!(disposition in bucket)) continue;

  let factors = {};
  try {
    factors = JSON.parse(distro.get('factors') || '{}');
    parsedFactorsCount++;
  } catch { /* skip malformed rows */ }

  bucket[disposition].push({
    logId,
    leadId: distro.get('leadId'),
    assignedRep: distro.get('assignedRep'),
    timestamp: distro.get('timestamp'),
    factors,
    jobSoldAmount: parseFloat(outcome.get('jobSoldAmount') || '0') || 0,
  });
}

// ─── analysis: average factor contribution by disposition ───────────────
function avgFactorContrib(rows) {
  const sums = Object.fromEntries(FACTOR_NAMES.map(f => [f, 0]));
  const counts = Object.fromEntries(FACTOR_NAMES.map(f => [f, 0]));
  for (const r of rows) {
    for (const f of FACTOR_NAMES) {
      const v = r.factors?.[f]?.score;
      if (typeof v === 'number' && !Number.isNaN(v)) {
        sums[f] += v;
        counts[f]++;
      }
    }
  }
  return FACTOR_NAMES.reduce((acc, f) => {
    acc[f] = counts[f] ? sums[f] / counts[f] : 0;
    return acc;
  }, {});
}

const won = bucket['closed-won'];
const lost = bucket['closed-lost'];
const ghosted = bucket['ghosted'];

const wonAvg = avgFactorContrib(won);
const lostAvg = avgFactorContrib(lost);
const ghostedAvg = avgFactorContrib(ghosted);

// ─── recommendation: factors where won > lost get a bump ─────────────────
// Calibration heuristic: if a factor's average contribution in WON
// assignments meaningfully exceeds its contribution in LOST assignments,
// recommend bumping that factor's weight. If WON < LOST, recommend trimming.
// Minimum sample size to make any recommendation: 10 in each bucket.
const MIN_SAMPLE = 10;
const SIGNIFICANT_DELTA = 0.5; // weighted points

const recommendations = [];
for (const f of FACTOR_NAMES) {
  const delta = wonAvg[f] - lostAvg[f];
  const ghostedDelta = wonAvg[f] - ghostedAvg[f];
  let action = 'hold';
  let rationale = '';
  if (won.length < MIN_SAMPLE || lost.length < MIN_SAMPLE) {
    action = 'insufficient data';
    rationale = `Need ≥${MIN_SAMPLE} closed-won and ≥${MIN_SAMPLE} closed-lost rows; have ${won.length}/${lost.length}.`;
  } else if (delta > SIGNIFICANT_DELTA) {
    action = 'raise';
    rationale = `WON avg ${wonAvg[f].toFixed(2)} vs LOST avg ${lostAvg[f].toFixed(2)} (Δ +${delta.toFixed(2)}). This factor correlates positively with closing.`;
  } else if (delta < -SIGNIFICANT_DELTA) {
    action = 'lower';
    rationale = `WON avg ${wonAvg[f].toFixed(2)} vs LOST avg ${lostAvg[f].toFixed(2)} (Δ ${delta.toFixed(2)}). This factor correlates with NOT closing — over-weighted.`;
  } else {
    action = 'hold';
    rationale = `WON ${wonAvg[f].toFixed(2)} ≈ LOST ${lostAvg[f].toFixed(2)} (Δ ${delta.toFixed(2)}). Within noise; no change recommended.`;
  }
  recommendations.push({ factor: f, action, delta, ghostedDelta, wonAvg: wonAvg[f], lostAvg: lostAvg[f], rationale });
}

// ─── write markdown report ───────────────────────────────────────────────
const lines = [];
lines.push(`# Lead Distro Recalibration — ${todayStr}`);
lines.push('');
lines.push(`**Window:** last ${WINDOW_DAYS} days`);
lines.push(`**Total assignments analyzed:** ${totalAssignments}`);
lines.push(`**With outcome data:** closed-won ${won.length} · closed-lost ${lost.length} · ghosted ${ghosted.length} · still-open ${bucket.open.length} · pending-pick ${bucket['pending-manager-pick'].length}`);
lines.push(`**Parsed factor rows:** ${parsedFactorsCount} of ${totalAssignments}`);
lines.push('');
lines.push('## Method');
lines.push('');
lines.push('For each completed outcome we examined the winning rep\'s factor-score breakdown (the `factors` column on the distribution log). We then averaged each factor\'s contribution across closed-won vs closed-lost outcomes. A factor that contributes meaningfully more to wins than losses is a candidate for a weight increase; the inverse is a candidate for trimming. **Recommendations are never auto-applied** — a manager reviews and decides.');
lines.push('');
lines.push('Heuristic floor: each bucket needs ≥10 rows before any recommendation fires. Below that, the report says "insufficient data" — no recalibration is justified.');
lines.push('');
lines.push('## Recommendations');
lines.push('');
lines.push('| Factor | Action | Δ (won − lost) | won avg | lost avg | Rationale |');
lines.push('|--------|--------|----------------|---------|----------|-----------|');
for (const r of recommendations) {
  lines.push(`| \`${r.factor}\` | **${r.action.toUpperCase()}** | ${r.delta.toFixed(2)} | ${r.wonAvg.toFixed(2)} | ${r.lostAvg.toFixed(2)} | ${r.rationale} |`);
}
lines.push('');
lines.push('## Sample sizes');
lines.push('');
lines.push(`- **Closed-won**: ${won.length}`);
lines.push(`- **Closed-lost**: ${lost.length}`);
lines.push(`- **Ghosted**: ${ghosted.length} (no contact attempt logged — these are leads we never even tried on)`);
lines.push(`- **Still open**: ${bucket.open.length} (not yet resolved; excluded from analysis)`);
lines.push(`- **Pending manager pick**: ${bucket['pending-manager-pick'].length} (suggest-mode; excluded)`);
lines.push('');
lines.push('## How to apply');
lines.push('');
lines.push('1. Open `/portal/admin/lead-distro` in the admin panel.');
lines.push('2. Review the recommendations above. Sanity-check each against your read of the team.');
lines.push('3. For each `RAISE` recommendation, increase that weight by 3–5 points; for each `LOWER`, decrease by the same. Redistribute to factors marked `HOLD`.');
lines.push('4. Use Live Preview on 3–5 known-result addresses to confirm the new weights still produce sensible results.');
lines.push('5. Save. Changes take effect on the next inbound lead.');
lines.push('6. Re-run this script in 90 days. The system learns from outcomes; you tune the response.');
lines.push('');
lines.push(`Script: \`scripts/lead-distro-recalibrate.mjs\` · run any time, no side effects.`);

const outFullPath = path.join(process.cwd(), OUT_PATH);
fs.mkdirSync(path.dirname(outFullPath), { recursive: true });
fs.writeFileSync(outFullPath, lines.join('\n'), 'utf-8');

console.log(`Wrote ${outFullPath}`);
console.log(`Sample sizes: won=${won.length} lost=${lost.length} ghosted=${ghosted.length} open=${bucket.open.length} pending=${bucket['pending-manager-pick'].length}`);
console.log('Recommendations:');
for (const r of recommendations) {
  console.log(`  ${r.factor.padEnd(18)} ${r.action.padEnd(20)} Δ=${r.delta.toFixed(2)}`);
}
