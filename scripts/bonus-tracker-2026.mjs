// RCRS 2026 H1 Trip Program Tracker
// ----------------------------------------------------------------------------
// Source of truth: ONLY the spreadsheet at the path below.
//
// Bonus model: REPLACEMENT. Highest single tier crossed in a month is the
// bonus added to the rep's trip-fund "pot." Above $500K: linear +$1,000 per
// additional $100K, CAPPED at $1M month = max +$9,000 to pot.
// (Anti-loophole: anything above $1M in a single month still tops out at $9K.)
//
// Trip qualification: $400K cumulative H1 (Jan 1 - Jun 30). Below = $0 paid.
//
// Snapshot system:
//  - Saves on every change (hash-based dedup, no duplicates)
//  - Multiple per day allowed (filename includes timestamp)
//  - Detects retroactive changes vs previous snapshot, logs them

import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const XLSX_PATH = process.env.XLSX_PATH || 'C:/Users/Michael/Downloads/2026 Sales Numbers by Month (3).xlsx';
const cfg = JSON.parse(fs.readFileSync('data/competition-config.json', 'utf8'));
const tiers = cfg.monthlyBonusTiers;
const TRIP_THRESHOLD = cfg.awardsTrip.threshold;
const ABOVE_500K_RATE = 1000;
const MONTHLY_CAP_AMOUNT = 1000000;  // $1M month
const MONTHLY_CAP_BONUS = 9000;      // +$9K to pot — anti-loophole hard cap

// REPLACEMENT bonus: highest tier crossed wins (lower tiers don't add).
// $200K month = $1,200 (the $200K tier — does not include lower tiers).
// Linear above $500K (+$1K per $100K), capped at $1M month = $9K total.
function bonusReplacement(amount) {
  let bonus = 0;
  let topTier = null;
  for (const t of tiers) {
    if (amount >= t.threshold) { bonus = t.bonus; topTier = t.label; }
  }
  if (amount > 500000) {
    const capped = Math.min(amount, MONTHLY_CAP_AMOUNT);
    const extra = Math.floor((capped - 500000) / 100000);
    if (extra > 0) {
      bonus += extra * ABOVE_500K_RATE;
      topTier = `$${Math.floor(capped / 100000) * 100}K (linear)`;
    }
    if (amount >= MONTHLY_CAP_AMOUNT) {
      bonus = MONTHLY_CAP_BONUS;
      topTier = '$1M+ (capped)';
    }
  }
  return { bonus, topTier };
}

// ---------- Load spreadsheet ----------
const wb = XLSX.readFile(XLSX_PATH);
const months = wb.SheetNames.map(s => s.trim());
const reps = {};
for (const sheetName of wb.SheetNames) {
  const month = sheetName.trim();
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
  for (const row of rows) {
    const rep = String(row[0] || '').trim();
    const rev = Number(row[1]) || 0;
    if (!rep || rev <= 0) continue;
    if (!reps[rep]) reps[rep] = {};
    reps[rep][month] = (reps[rep][month] || 0) + rev;
  }
}

// ---------- Build summary ----------
const summary = Object.entries(reps).map(([rep, byMonth]) => {
  const breakdown = months.map(m => {
    const rev = byMonth[m] || 0;
    const repl = bonusReplacement(rev);
    return {
      month: m,
      revenue: rev,
      tier: repl.topTier,
      bonus: repl.bonus,
    };
  });
  const ytd = breakdown.reduce((s, r) => s + r.revenue, 0);
  const accrued = breakdown.reduce((s, r) => s + r.bonus, 0);
  const qualified = ytd >= TRIP_THRESHOLD;
  return {
    rep,
    ytd,
    breakdown,
    accruedTripBudget: accrued,
    qualifiedForTrip: qualified,
    actualTripBudget: qualified ? accrued : 0,
    gapToTrip: Math.max(0, TRIP_THRESHOLD - ytd),
    pctToTrip: Math.min(100, (ytd / TRIP_THRESHOLD) * 100),
  };
}).sort((a, b) => b.ytd - a.ytd);

const totalAccrued = summary.reduce((s, r) => s + r.accruedTripBudget, 0);
const totalToBePaid = summary.filter(r => r.qualifiedForTrip).reduce((s, r) => s + r.actualTripBudget, 0);

// ---------- Snapshot system ----------
function repsHash(reps) {
  const minimal = reps.map(r => ({ rep: r.rep, ytd: r.ytd, accrued: r.accruedTripBudget, monthly: r.breakdown.map(b => [b.month, b.revenue]) }));
  return crypto.createHash('sha256').update(JSON.stringify(minimal)).digest('hex').slice(0, 16);
}

function loadSnapshots() {
  const histDir = 'data/history';
  if (!fs.existsSync(histDir)) return [];
  return fs.readdirSync(histDir)
    .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(histDir, f), 'utf8')))
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
}

function detectChanges(prevSnapshot, currentReps) {
  if (!prevSnapshot) return { isFirst: true, changes: [] };
  const changes = [];
  const prevMap = {};
  for (const pr of prevSnapshot.reps) {
    prevMap[pr.rep] = {};
    for (const m of pr.monthly) prevMap[pr.rep][m.month] = m.revenue;
  }
  const currMap = {};
  for (const cr of currentReps) {
    currMap[cr.rep] = {};
    for (const b of cr.breakdown) currMap[cr.rep][b.month] = b.revenue;
  }
  // Find changes
  const allReps = new Set([...Object.keys(prevMap), ...Object.keys(currMap)]);
  for (const rep of allReps) {
    const prev = prevMap[rep] || {};
    const curr = currMap[rep] || {};
    const allMonths = new Set([...Object.keys(prev), ...Object.keys(curr)]);
    for (const m of allMonths) {
      const oldVal = prev[m] || 0;
      const newVal = curr[m] || 0;
      if (Math.abs(oldVal - newVal) > 0.01) {
        const type = oldVal === 0 ? 'added' : newVal === 0 ? 'removed' : 'modified';
        changes.push({ rep, month: m, oldValue: oldVal, newValue: newVal, delta: newVal - oldVal, type });
      }
    }
  }
  return { isFirst: false, changes };
}

function saveSnapshot(payload) {
  const histDir = 'data/history';
  if (!fs.existsSync(histDir)) fs.mkdirSync(histDir, { recursive: true });

  const now = new Date();
  const hash = repsHash(payload.reps);
  const snapshots = loadSnapshots();
  const last = snapshots[snapshots.length - 1];

  if (last && last.hash === hash) {
    console.log('\n[Snapshot] No change since last snapshot (' + last.capturedAt + ') - skipping.');
    return { saved: false, changes: [] };
  }

  // Detect retroactive changes
  const { isFirst, changes } = detectChanges(last, payload.reps);
  const retroactiveChanges = changes.filter(c => c.type === 'modified' || (c.type === 'removed'));
  const newAdditions = changes.filter(c => c.type === 'added');

  const ts = now.toISOString().replace(/[:.]/g, '-');
  const dateStr = now.toISOString().slice(0, 10);
  const snapshotPath = path.join(histDir, `snapshot-${ts}.json`);

  const snapshot = {
    capturedAt: now.toISOString(),
    capturedDate: dateStr,
    source: XLSX_PATH,
    hash,
    teamTotal: payload.reps.reduce((s, r) => s + r.ytd, 0),
    qualifiedCount: payload.reps.filter(r => r.qualifiedForTrip).length,
    totalAccrued: payload.reps.reduce((s, r) => s + r.accruedTripBudget, 0),
    reps: payload.reps.map(r => ({
      rep: r.rep,
      ytd: r.ytd,
      monthly: r.breakdown.map(b => ({ month: b.month, revenue: b.revenue, bonus: b.bonus })),
      accrued: r.accruedTripBudget,
      qualified: r.qualifiedForTrip,
      pct: r.pctToTrip,
    })),
    isFirst,
    previousHash: last ? last.hash : null,
    previousCapturedAt: last ? last.capturedAt : null,
    changes,
    retroactiveCount: retroactiveChanges.length,
    additionCount: newAdditions.length,
  };
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
  console.log('\n[Snapshot] Saved: ' + snapshotPath);

  // Append to change log
  if (changes.length > 0) {
    const logPath = 'data/change-log.json';
    let log = [];
    if (fs.existsSync(logPath)) log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    log.push({
      timestamp: now.toISOString(),
      snapshotHash: hash,
      previousHash: last ? last.hash : null,
      additions: newAdditions.length,
      modifications: retroactiveChanges.length,
      changes,
    });
    fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
    console.log('[Change Log] ' + newAdditions.length + ' new + ' + retroactiveChanges.length + ' retroactive changes logged');

    if (retroactiveChanges.length > 0) {
      console.log('\n[!] RETROACTIVE CHANGES DETECTED:');
      for (const c of retroactiveChanges) {
        console.log(`    ${c.rep} ${c.month}: $${c.oldValue.toLocaleString()} -> $${c.newValue.toLocaleString()} (${c.delta > 0 ? '+' : ''}$${Math.round(c.delta).toLocaleString()})`);
      }
    }
  }
  return { saved: true, changes };
}

// ---------- Output to console ----------
const fmtCents = n => '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

console.log('\n================================================================================');
console.log('  RCRS 2026 H1 TRIP PROGRAM (REPLACEMENT model)');
console.log('  Source: ' + path.basename(XLSX_PATH));
console.log('  Period: ' + cfg.currentPeriod.start + '  to  ' + cfg.currentPeriod.end);
console.log('================================================================================\n');

const W = { rep: 12, ytd: 14, accr: 12, status: 14 };
console.log('Rep'.padEnd(W.rep) + 'H1 YTD'.padStart(W.ytd) + 'Accrued (replacement)'.padStart(W.accr + 8) + 'Trip'.padStart(W.status));
console.log('-'.repeat(W.rep + W.ytd + W.accr + 8 + W.status));
for (const r of summary) {
  console.log(
    r.rep.padEnd(W.rep) +
    fmtCents(r.ytd).padStart(W.ytd) +
    ('$' + r.accruedTripBudget.toLocaleString()).padStart(W.accr + 8) +
    (r.qualifiedForTrip ? 'QUALIFIED' : 'pending').padStart(W.status)
  );
}
console.log('-'.repeat(W.rep + W.ytd + W.accr + 8 + W.status));
console.log('Total accrued: $' + totalAccrued.toLocaleString() + '  |  Will pay (qualified only): $' + totalToBePaid.toLocaleString());

const payload = {
  source: XLSX_PATH,
  generatedAt: new Date().toISOString(),
  period: cfg.currentPeriod,
  tripThreshold: TRIP_THRESHOLD,
  bonusModel: 'replacement',
  monthlyTiers: tiers,
  aboveCapRate: { perStep: 100000, bonusPerStep: ABOVE_500K_RATE, startsAbove: 500000 },
  reps: summary,
  totalAccrued,
  totalToBePaid,
};

fs.writeFileSync('data/bonus-tracker-2026.json', JSON.stringify(payload, null, 2));
console.log('\nSaved: data/bonus-tracker-2026.json');

const result = saveSnapshot(payload);
if (result.changes.length > 0) {
  console.log(`[Summary] ${result.changes.length} total cell changes since last snapshot`);
}
