/**
 * Refresh-all-data — one command, every data source.
 *
 * Runs the per-source refresh scripts in the right order and prints a
 * compact summary at the end. Re-run after a fresh QuickBooks export
 * lands in ~/Downloads or after Sara updates the meeting sheet.
 *
 *   node scripts/refresh-all-data.mjs
 *
 * Then `git add data/ && git commit && vercel deploy --prod --yes`.
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const steps = [
  { name: 'Meeting numbers 2026', script: 'sync-meeting-numbers-2026.mjs' },
  { name: 'Sales 2026 YTD',       script: 'pull-2026-sales.mjs' },
  { name: 'Sales 2026 monthly',   script: 'pull-2026-monthly.mjs' },
  { name: 'Commissions (full)',   script: 'refresh-commissions-full.mjs' },
  { name: 'Transactions ledger',  script: 'aggregate-transactions.mjs' },
];

function runOne(scriptName) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const proc = spawn('node', [path.join(__dirname, scriptName)], {
      cwd: path.dirname(__dirname),
      stdio: 'inherit',
    });
    proc.on('exit', code => {
      const dur = ((Date.now() - start) / 1000).toFixed(1);
      if (code === 0) resolve(dur);
      else reject(new Error(`${scriptName} exited ${code} after ${dur}s`));
    });
    proc.on('error', reject);
  });
}

const results = [];
let overallStart = Date.now();

for (const s of steps) {
  console.log(`\n══════════════════════════════════════════════════`);
  console.log(`  ${s.name}  (${s.script})`);
  console.log(`══════════════════════════════════════════════════`);
  try {
    const dur = await runOne(s.script);
    results.push({ name: s.name, ok: true, dur });
  } catch (err) {
    results.push({ name: s.name, ok: false, err: err.message });
    console.error(`\n[FAIL] ${s.name}: ${err.message}`);
  }
}

const overallDur = ((Date.now() - overallStart) / 1000).toFixed(1);
console.log(`\n══════════════════════════════════════════════════`);
console.log(`  SUMMARY — total ${overallDur}s`);
console.log(`══════════════════════════════════════════════════`);
for (const r of results) {
  const status = r.ok ? '✓' : '✗';
  const detail = r.ok ? `${r.dur}s` : r.err;
  console.log(`  ${status}  ${r.name.padEnd(30)} ${detail}`);
}

const failed = results.filter(r => !r.ok).length;
if (failed > 0) {
  console.error(`\n${failed} step(s) failed. Fix and re-run.`);
  process.exit(1);
}

console.log(`\nNext: review data/ changes, then commit + deploy:`);
console.log(`  git add data/`);
console.log(`  git commit -m "Refresh data"`);
console.log(`  vercel deploy --prod --yes`);
