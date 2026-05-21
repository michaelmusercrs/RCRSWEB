/**
 * Pull each estimate by its jnid (we already know the last_estimate_jnid).
 * Then for the OTHER estimates in the per-job list, try filtering with
 * /estimates?filter={must:[{term:{number:"E-12044"}}]} via the contact id.
 * Also list files on each contact (not just job) — material order PDFs are
 * often attached to the contact.
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
  { rNum: '10311', jobJnid: 'mbf5ybxu3eoo04j4fhlp5z', contactJnid: 'mbf5ufw4sm7er7vknxubbns', lastEstJnid: 'mc3mlxofu13wkzxiclb3o3f', name: 'Stephen Cutter' },
  { rNum: '10365', jobJnid: 'mbqvktrch01fld5u6c7bc0r', contactJnid: 'mbqvkeg58f9r04tj8ylr8xa', lastEstJnid: 'mbsblfmpe1mj6evp94te9hp', name: 'Brandon Phillips' },
  { rNum: '10549', jobJnid: 'mdggzpfuxcr9jzp0h9tbgp9', contactJnid: 'mdggxwyxi55ypf4zljv6y7c', lastEstJnid: 'mfh38lvfd7q46iaofogktrv', name: 'Patty Smith' },
  { rNum: '10290', jobJnid: 'mb9x9pgzgna61rle1spsfw2', contactJnid: 'mb9x92dorz4th6gdjqu56om', lastEstJnid: 'mf74l4pyx5odi5npj1rt1n5', name: 'Glenn Toups' },
];

async function jn(endpoint) {
  const r = await fetch(`${JN_API_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${JN_API_KEY}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) return { error: `http_${r.status}`, body: (await r.text()).slice(0, 300) };
  return r.json();
}

const outLines = [];
function log(s='') { console.log(s); outLines.push(s); }

for (const t of TARGETS) {
  log('');
  log('='.repeat(80));
  log(`R# ${t.rNum} — ${t.name}`);
  log('='.repeat(80));

  // 1) The last estimate (the most likely approved one)
  log('--- Last estimate (by jnid) ---');
  const est = await jn(`/estimates/${t.lastEstJnid}`);
  if (est?.error) {
    log(`Error: ${est.error}`);
  } else {
    log(`Number: ${est.number}, status: ${est.status_name || est.status}, total: $${est.total}, items: ${(est.items||[]).length}`);
    if (est.description) log(`description: ${String(est.description).slice(0, 400)}`);
    if (Array.isArray(est.items)) {
      for (const it of est.items) {
        const name = it.name || it.description || it.product || '';
        const qty = it.quantity != null ? it.quantity : (it.qty != null ? it.qty : '');
        const u = it.uom || it.unit || it.unit_of_measure || '';
        const total = it.amount || it.total || it.price || '';
        log(`  - [${qty} ${u}] ${String(name).slice(0, 90)} ($${total})`);
      }
    }
    // Look at hidden interesting fields
    const interesting = {};
    for (const [k, v] of Object.entries(est)) {
      if (v == null || v === '' || v === 0 || v === false) continue;
      if (typeof v === 'object' && Array.isArray(v) && v.length === 0) continue;
      if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v||{}).length === 0) continue;
      if (/sqft|square|ridge|hip|valley|length|measure|scope|cf_/i.test(k)) {
        interesting[k] = typeof v === 'object' ? JSON.stringify(v).slice(0,200) : String(v).slice(0,200);
      }
    }
    if (Object.keys(interesting).length) log(`custom: ${JSON.stringify(interesting)}`);
  }

  // 2) All estimates for the contact — filter by primary.id (contact)
  log('--- All estimates for contact ---');
  const filter = { must: [{ term: { 'primary.id': t.contactJnid } }] };
  const res = await jn(`/estimates?filter=${encodeURIComponent(JSON.stringify(filter))}`);
  if (res?.error) {
    log(`Error: ${res.error}`);
  } else {
    const estimates = res.results || [];
    log(`Estimates count: ${estimates.length}`);
    for (const e of estimates) {
      log(`  ${e.number} status=${e.status_name || e.status} total=$${e.total} items=${(e.items||[]).length}`);
      // For each estimate, dump its items
      if (Array.isArray(e.items)) {
        for (const it of e.items) {
          const name = it.name || it.description || it.product || '';
          const qty = it.quantity != null ? it.quantity : (it.qty != null ? it.qty : '');
          const u = it.uom || it.unit || '';
          // Only log items that look interesting for sizing the roof
          const nameStr = String(name);
          if (/ridge|squar|sqft|\blf\b|linear|shingl|felt|underlayment|ice.water/i.test(nameStr)) {
            log(`    > [${qty} ${u}] ${nameStr.slice(0,90)}`);
          }
        }
      }
    }
  }

  // 3) Files for the JOB
  log('--- Files on the job ---');
  const fjob = await jn(`/files?filter=${encodeURIComponent(JSON.stringify({must:[{term:{'related.id': t.jobJnid }}]}))}&sort=-created_at&limit=200`);
  if (fjob?.error) {
    log(`Error: ${fjob.error}`);
  } else {
    const files = fjob.results || [];
    log(`Total files: ${files.length}`);
    // Look for material-order / EagleView / measurement-related filenames
    const interesting = files.filter(f => /material|order|eagle|view|hover|roofr|measure|sqft|squar|ridge|pdf/i.test((f.filename || '') + ' ' + (f.description || '')));
    log(`Interesting files (material/measurement): ${interesting.length}`);
    for (const f of interesting.slice(0, 25)) {
      log(`  - ${f.filename || '(no name)'} | ${f.content_type || ''} | ${f.size || 0}B | desc=${(f.description || '').slice(0,80)}`);
    }
    // Show first 10 PDFs regardless
    const pdfs = files.filter(f => /\.pdf$/i.test(f.filename || '') || /pdf/i.test(f.content_type || ''));
    log(`Total PDFs: ${pdfs.length}`);
    for (const f of pdfs.slice(0, 15)) {
      log(`  PDF: ${f.filename} (${f.size || 0}B)`);
    }
  }

  // 4) Files for the CONTACT
  log('--- Files on the contact ---');
  const fcon = await jn(`/files?filter=${encodeURIComponent(JSON.stringify({must:[{term:{'primary.id': t.contactJnid }}]}))}&sort=-created_at&limit=100`);
  if (fcon?.error) {
    log(`Error: ${fcon.error}`);
  } else {
    const files = fcon.results || [];
    log(`Contact files: ${files.length}`);
    const interesting = files.filter(f => /material|order|eagle|view|hover|roofr|measure|sqft|squar|ridge/i.test((f.filename || '') + ' ' + (f.description || '')));
    log(`Interesting contact files: ${interesting.length}`);
    for (const f of interesting.slice(0, 20)) {
      log(`  - ${f.filename || '(no name)'} | ${f.content_type || ''} | desc=${(f.description || '').slice(0,80)}`);
    }
  }
}

const outPath = path.join(process.cwd(), 'scripts', 'investigate-4-estimates-files-2026-05-21.log');
fs.writeFileSync(outPath, outLines.join('\n'));
console.log('');
console.log(`Wrote ${outPath}`);
