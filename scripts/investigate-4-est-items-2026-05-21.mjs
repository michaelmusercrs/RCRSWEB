/**
 * Re-fetch estimates via /estimates?filter=related.id (the working path)
 * and dump ALL line items + sqft/ridge/measurements.
 */
import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env.local');
fs.readFileSync(envPath, 'utf8').split('\n').forEach((l) => {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) {
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
});

const JN_API_KEY = process.env.JOBNIMBUS_API_KEY;
const JN_API_URL = process.env.JOBNIMBUS_API_URL || 'https://app.jobnimbus.com/api1';

const TARGETS = [
  { rNum: '10311', jobJnid: 'mbf5ybxu3eoo04j4fhlp5z', name: 'Stephen Cutter' },
  { rNum: '10365', jobJnid: 'mbqvktrch01fld5u6c7bc0r', name: 'Brandon Phillips' },
  { rNum: '10549', jobJnid: 'mdggzpfuxcr9jzp0h9tbgp9', name: 'Patty Smith' },
  { rNum: '10290', jobJnid: 'mb9x9pgzgna61rle1spsfw2', name: 'Glenn Toups' },
];

async function jn(endpoint) {
  const r = await fetch(`${JN_API_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${JN_API_KEY}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) return { error: `http_${r.status}`, body: (await r.text()).slice(0, 300) };
  return r.json();
}

const outLines = [];
function log(s='') { console.log(s); outLines.push(s); }

for (const t of TARGETS) {
  log('');
  log('='.repeat(80));
  log(`R# ${t.rNum} — ${t.name} — jobJnid ${t.jobJnid}`);
  log('='.repeat(80));

  const filter = { must: [{ term: { 'related.id': t.jobJnid } }] };
  const res = await jn(`/estimates?filter=${encodeURIComponent(JSON.stringify(filter))}`);
  if (res?.error) {
    log(`Error: ${res.error}`);
    continue;
  }
  const estimates = res.results || [];
  log(`Estimates: ${estimates.length}`);

  for (const e of estimates) {
    log('');
    log(`--- Estimate ${e.number} (status=${e.status_name || e.status}, total=$${e.total}) ---`);
    if (e.description) log(`description: ${String(e.description).slice(0, 400)}`);
    log(`Available estimate keys: ${Object.keys(e).join(', ')}`);
    if (Array.isArray(e.items)) {
      log(`Items: ${e.items.length}`);
      for (const it of e.items) {
        const name = it.name || it.description || it.product || '';
        const qty = it.quantity != null ? it.quantity : (it.qty != null ? it.qty : '');
        const u = it.uom || it.unit || it.unit_of_measure || '';
        const total = it.amount || it.total || it.price || '';
        log(`  - [qty=${qty} ${u}] ${String(name).slice(0, 100)} ($${total})`);
      }
    } else {
      log(`No items array — keys: ${Object.keys(e)}`);
    }

    // Check for sections (sometimes JN nests items in sections)
    if (Array.isArray(e.sections)) {
      log(`Sections: ${e.sections.length}`);
      for (const s of e.sections) {
        log(`  Section: ${s.name || ''}`);
        if (Array.isArray(s.items)) {
          for (const it of s.items) {
            const name = it.name || it.description || '';
            const qty = it.quantity || it.qty || '';
            const u = it.uom || it.unit || '';
            log(`    - [qty=${qty} ${u}] ${String(name).slice(0, 100)}`);
          }
        }
      }
    }
  }
}

const outPath = path.join(process.cwd(), 'scripts', 'investigate-4-est-items-2026-05-21.log');
fs.writeFileSync(outPath, outLines.join('\n'));
console.log('');
console.log(`Wrote ${outPath}`);
