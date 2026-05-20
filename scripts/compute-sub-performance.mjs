/**
 * Compute subcontractor performance from QB transactions + commissions.
 * Subs identified by:
 *   - Receiving 1099 payments (in commissions.json with "QuickBooks 1099 - Sub LLC" customer)
 *   - Names containing common sub indicators: Contracting, Roofing, LLC, Inc, Construction
 *   - Receiving Bills/Bill Payments rather than Commission checks
 * NOT subs (sales reps with their own LLC): BCM, Rudy's, Roof Angel, BPB,
 *   Boykin Dream — these are 1099 reps, kept separate.
 */
import fs from 'fs';

const commissions = JSON.parse(fs.readFileSync('data/commissions.json', 'utf8'));
const monthly = JSON.parse(fs.readFileSync('data/transactions-monthly.json', 'utf8'));

// Sales-rep LLCs that get paid 1099 but are NOT subs
const REP_LLCS = new Set([
  'BCM Contracting LLC',
  'Rudys Roofing Insights LLC',
  'Roof Angel, LLC',
  'Roof Angel LLC',
  'Jeremy T. Wages',
  'Jeremy T Wages',
  'Gregory Ray Muse',
  'Antony Barton Roberts',
  'Boykin Dream Big Win Big LLC',
  'BPB Contracting LLC',
]);

// Heuristic for "is sub" — entity name pattern + receives many payments
function looksLikeSub(entityName) {
  if (REP_LLCS.has(entityName)) return false;
  if (/Contracting|Construction|Roofing|Builders|Carpentry|Framing|Demo/i.test(entityName)) return true;
  // Spanish names + LLCs typical for crews
  if (/Hernandez|Gonzalez|Lopez|Rodriguez|Martinez|Garcia|Perez|Mendoza|Ramirez|Sanchez|Compuzano|Bernal/i.test(entityName)) return true;
  return false;
}

// Build per-entity rollups
const byEntity = {};
for (const r of commissions) {
  const entity = (r.customer || '').replace('QuickBooks 1099 - ', '').trim();
  if (!entity) continue;
  if (REP_LLCS.has(entity)) continue;
  if (!looksLikeSub(entity)) continue;
  if (!byEntity[entity]) byEntity[entity] = { entity, total: 0, checks: 0, dates: [], jobs: new Set() };
  byEntity[entity].total += r.amount || 0;
  byEntity[entity].checks += 1;
  if (r.date) byEntity[entity].dates.push(r.date);
  if (r.jobNumber) byEntity[entity].jobs.add(r.jobNumber);
}

const subs = Object.values(byEntity).map(s => {
  const isoDates = s.dates.map(d => {
    const [m, dd, y] = d.split('/');
    return y && m && dd ? `${y}-${m.padStart(2, '0')}-${dd.padStart(2, '0')}` : '';
  }).filter(Boolean).sort();
  return {
    entity: s.entity,
    total: Math.round(s.total * 100) / 100,
    checks: s.checks,
    avgCheck: s.checks > 0 ? Math.round((s.total / s.checks) * 100) / 100 : 0,
    firstPaid: isoDates[0] || '',
    lastPaid: isoDates[isoDates.length - 1] || '',
    jobsCount: s.jobs.size,
  };
}).sort((a, b) => b.total - a.total);

const totalSpend = subs.reduce((s, x) => s + x.total, 0);
const totalChecks = subs.reduce((s, x) => s + x.checks, 0);

// Recent activity — last 90 days
const cutoff = new Date();
cutoff.setDate(cutoff.getDate() - 90);
const cutoffIso = cutoff.toISOString().slice(0, 10);

const recentSubs = subs.map(s => {
  const recentChecks = commissions
    .filter(r => {
      const entity = (r.customer || '').replace('QuickBooks 1099 - ', '').trim();
      if (entity !== s.entity) return false;
      const [m, dd, y] = (r.date || '').split('/');
      const iso = y && m && dd ? `${y}-${m.padStart(2, '0')}-${dd.padStart(2, '0')}` : '';
      return iso >= cutoffIso;
    });
  return {
    ...s,
    recentChecks: recentChecks.length,
    recentTotal: Math.round(recentChecks.reduce((sum, r) => sum + (r.amount || 0), 0) * 100) / 100,
  };
});

const out = {
  generatedAt: new Date().toISOString().slice(0, 10),
  totalSubs: subs.length,
  totalSpend: Math.round(totalSpend * 100) / 100,
  totalChecks,
  subs: recentSubs,
};

fs.writeFileSync('data/sub-performance.json', JSON.stringify(out, null, 2));
console.log(`Wrote data/sub-performance.json`);
console.log(`Total subs identified: ${subs.length}`);
console.log(`Lifetime sub spend: $${totalSpend.toFixed(2)}`);
console.log(`Top 10 subs:`);
for (const s of subs.slice(0, 10)) {
  console.log(`  ${s.entity.padEnd(40)} $${s.total.toFixed(2).padStart(12)}  (${s.checks} checks, ${s.firstPaid} → ${s.lastPaid})`);
}
