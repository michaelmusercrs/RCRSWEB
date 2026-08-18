// One-off: preview how the backlog GAF QuickMeasure reports match to JN jobs.
// Read-only against JobNimbus. No writes. Node 18+ (global fetch).
//   node scripts/gaf-backlog-preview.mjs
import fs from 'node:fs';

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}
loadEnv();
const KEY = process.env.JOBNIMBUS_API_KEY;
const BASE = process.env.JOBNIMBUS_API_URL || 'https://app.jobnimbus.com/api1';
if (!KEY) { console.error('No JOBNIMBUS_API_KEY'); process.exit(1); }

const REPORTS = [
  { order: '5487530', date: '2026-08-14', rep: 'aaron',  addr: '800 County Rd 859, Mentone, AL 35984' },
  { order: '5473519', date: '2026-08-12', rep: 'greg',   addr: '233 Maple Cir, Hartselle, AL 35640' },
  { order: '5463955', date: '2026-08-11', rep: 'travis', addr: '10204 SE Everest Dr, Huntsville, AL 35803' },
  { order: '5460882', date: '2026-08-10', rep: 'greg',   addr: '138 Given Cove, Laceys Spring, AL 35754' },
  { order: '5435203', date: '2026-08-05', rep: 'aaron',  addr: '7485 Moores Mill Rd, Huntsville, AL 35811' },
  { order: '5428209', date: '2026-08-04', rep: 'aaron',  addr: '26936 Mary Sue Ln, Athens, AL 35613' },
  { order: '5421845', date: '2026-08-03', rep: 'greg',   addr: '498 Co Rd 125, Albertville, AL 35951' },
  { order: '5420991', date: '2026-08-03', rep: 'greg',   addr: '279 Joe Hope Dr, Geraldine, AL 35974' },
];

const SUFFIX = { rd:'road', dr:'drive', st:'street', ave:'avenue', ln:'lane', ct:'court', cir:'circle', cr:'circle', blvd:'boulevard', hwy:'highway', pkwy:'parkway', pl:'place', cv:'cove', co:'county', n:'north', s:'south', e:'east', w:'west', ne:'northeast', nw:'northwest', se:'southeast', sw:'southwest' };
const norm = s => (s||'').toLowerCase().replace(/[.,#]/g,' ').replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(Boolean).map(t=>SUFFIX[t]||t).join(' ').trim();
const houseNo = s => ((s||'').trim().match(/^(\d+)/)||[])[1]||'';
const parse = raw => { const c=(raw||'').replace(/,?\s*USA\s*$/i,'').trim(); const p=c.split(',').map(x=>x.trim()); const zip=(c.match(/\b(\d{5})\b/)||[])[1]||''; return { street:norm(p[0]||''), house:houseNo(p[0]||''), city:norm(p[1]||''), zip }; };

async function jobsByZip(zip) {
  const filter = { must: [{ term: { zip } }] };
  const url = `${BASE}/jobs?filter=${encodeURIComponent(JSON.stringify(filter))}&size=100`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' } });
  if (!res.ok) return { err: `HTTP ${res.status}`, results: [] };
  const j = await res.json();
  return { results: j.results || [] };
}

const results = [];
for (const r of REPORTS) {
  const t = parse(r.addr);
  let line = { ...r, zip: t.zip, match: 'NO MATCH', jobName: '', score: 0, rep_on_job: '' };
  try {
    const { results: jobs, err } = await jobsByZip(t.zip);
    if (err) { line.match = `ERROR ${err}`; results.push(line); continue; }
    let best = null;
    for (const job of jobs) {
      const ja = { street: norm(job.address_line1||''), house: houseNo(job.address_line1||''), city: norm(job.city||''), zip: (job.zip||'').slice(0,5) };
      let score = 0;
      if (ja.street && ja.street === t.street) score += 0.7;
      if (ja.house && ja.house === t.house) score += 0.15;
      if (t.zip && ja.zip === t.zip) score += 0.2;
      if (t.city && ja.city === t.city) score += 0.05;
      if (!best || score > best.score) best = { score, job };
    }
    if (best && best.score >= 0.85) {
      line.match = best.job.number || best.job.jnid;
      line.jobName = best.job.name || '';
      line.rep_on_job = best.job.sales_rep_name || '';
      line.score = +best.score.toFixed(2);
    } else if (best && best.score >= 0.55) {
      line.match = `MAYBE ${best.job.number || ''}`;
      line.jobName = best.job.name || '';
      line.score = +best.score.toFixed(2);
    }
    line.zipJobCount = jobs.length;
  } catch (e) {
    line.match = `ERROR ${e.message}`;
  }
  results.push(line);
}

console.log('\nORDER      DATE        REP     MATCH            SCORE  ZIPJOBS  ADDRESS');
for (const r of results) {
  console.log(
    `${r.order}  ${r.date}  ${(r.rep||'').padEnd(6)}  ${String(r.match).padEnd(15)}  ${String(r.score).padEnd(5)}  ${String(r.zipJobCount??'-').padEnd(7)}  ${r.addr}${r.jobName?`  [${r.jobName}]`:''}`
  );
}
console.log('\nsummary:', JSON.stringify({
  total: results.length,
  matched: results.filter(r => /^R-|^\d/.test(String(r.match)) && !String(r.match).startsWith('MAYBE')).length,
  maybe: results.filter(r => String(r.match).startsWith('MAYBE')).length,
  noMatch: results.filter(r => r.match === 'NO MATCH').length,
}, null, 0));
