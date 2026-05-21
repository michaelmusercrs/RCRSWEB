/**
 * investigate-4-jn-deeper-2026-05-21.mjs
 *
 * READ-ONLY. Deeper JN dive on 4 jobs — dump ALL custom fields + full
 * descriptions + the estimate descriptions (which usually contain squares).
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
  { rNum: '10311', jnid: 'mbf5ybxu3eoo04j4fhlp5z', estIds: ['E-12044','E-12026','E-11961'] },
  { rNum: '10365', jnid: 'mbqvktrch01fld5u6c7bc0r', estIds: ['E-11993'] },
  { rNum: '10549', jnid: 'mdggzpfuxcr9jzp0h9tbgp9', estIds: ['E-12593','E-12419'] },
  { rNum: '10290', jnid: 'mb9x9pgzgna61rle1spsfw2', estIds: ['E-12400','E-12251','E-12250','E-12249','E-11930'] },
];

async function jn(endpoint) {
  const url = `${JN_API_URL}${endpoint}`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${JN_API_KEY}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) {
    return { error: `http_${r.status}`, body: (await r.text()).slice(0, 300) };
  }
  return r.json();
}

const outLines = [];
function log(s='') { console.log(s); outLines.push(s); }

for (const t of TARGETS) {
  log('');
  log('='.repeat(80));
  log(`R# ${t.rNum} — jnid ${t.jnid}`);
  log('='.repeat(80));

  // Fetch full job
  const job = await jn(`/jobs/${t.jnid}`);
  if (job?.error) {
    log(`Job fetch error: ${job.error}`);
    continue;
  }

  // Dump ALL keys — not just the typed shape — to find sqft / squares / ridge custom fields
  log('All job keys (with non-empty values):');
  const allKeys = Object.keys(job).sort();
  for (const k of allKeys) {
    const v = job[k];
    if (v == null || v === '' || v === 0 || v === false) continue;
    if (typeof v === 'object' && Array.isArray(v) && v.length === 0) continue;
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) continue;
    let display;
    if (typeof v === 'object') display = JSON.stringify(v).slice(0, 200);
    else display = String(v).slice(0, 200);
    log(`  ${k}: ${display}`);
  }

  // Fetch each estimate by number — try filtering by number field
  log('');
  log('Estimates (full):');
  for (const eNum of t.estIds) {
    const filter = { must: [{ term: { number: eNum } }] };
    const r = await jn(`/estimates?filter=${encodeURIComponent(JSON.stringify(filter))}`);
    if (r?.error) {
      log(`  ${eNum}: ERROR ${r.error}`);
      continue;
    }
    const est = (r.results || [])[0];
    if (!est) {
      log(`  ${eNum}: not found`);
      continue;
    }
    log(`  ${eNum} — status=${est.status_name || est.status}, total=$${est.total}, items=${(est.items || []).length}`);
    if (est.description) log(`    description: ${String(est.description).slice(0, 500)}`);
    // Dump line items — these usually have unit, quantity, name with "X squares" or sqft
    if (Array.isArray(est.items)) {
      for (const item of est.items) {
        const name = item.name || item.description || item.product || '';
        if (!name) continue;
        const qty = item.quantity || item.qty || '';
        const u = item.uom || item.unit || '';
        const total = item.amount || item.total || item.price || '';
        // log every line item
        log(`    - [${qty} ${u}] ${name.slice(0, 80)} ($${total})`);
      }
    }
    // Look for cost-codes that might be hidden
    const otherKeys = Object.keys(est).filter(k => !['jnid','number','status','status_name','total','tax','amount','description','items','date_signed','date_estimate','date_sent','date_created','date_updated','public_url','pdf_url','customer','related','primary','created_by','sales_rep','sales_rep_name','external_id','class','is_archived','is_active','signed_by','signed_date','address_line1','address_line2','city','state_text','zip','country_name','template','recid','type','record_type','record_type_name','last_estimator','cost','margin'].includes(k));
    if (otherKeys.length > 0) {
      const filtered = {};
      for (const k of otherKeys) {
        if (job[k] == null || job[k] === '' || job[k] === 0 || job[k] === false) continue;
        filtered[k] = est[k];
      }
      // only log keys with interesting content
      const interesting = Object.entries(filtered).filter(([k,v]) =>
        /sqft|square|ridge|hip|valley|length|measure|scope|cf_/i.test(k)
        && v != null && v !== '' && v !== 0
      );
      if (interesting.length) {
        log(`    custom keys: ${JSON.stringify(Object.fromEntries(interesting))}`);
      }
    }
  }
}

const outPath = path.join(process.cwd(), 'scripts', 'investigate-4-jn-deeper-2026-05-21.log');
fs.writeFileSync(outPath, outLines.join('\n'));
console.log('');
console.log(`Wrote ${outPath}`);
