/**
 * Print the union of all keys present across a sample of JN contacts,
 * so we can pick which columns are worth pulling into Geocoded_Contacts.
 */
import fs from 'fs';
import path from 'path';
const envPath = path.join(process.cwd(), '.env.local');
fs.readFileSync(envPath, 'utf8').split('\n').forEach(l => {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) { let v = m[2]; if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1); process.env[m[1]] = v; }
});
const JN_KEY = process.env.JOBNIMBUS_API_KEY;
const JN_URL = process.env.JOBNIMBUS_API_URL || 'https://app.jobnimbus.com/api1';

async function fetchPage(from, size) {
  const res = await fetch(`${JN_URL}/contacts?from=${from}&size=${size}`, {
    headers: { Authorization: `Bearer ${JN_KEY}` },
  });
  return (await res.json()).results || [];
}

const sample = await fetchPage(0, 500);
const keysSeen = new Map(); // key -> nonNull count
for (const r of sample) {
  for (const [k, v] of Object.entries(r)) {
    if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
    keysSeen.set(k, (keysSeen.get(k) || 0) + 1);
  }
}
const ranked = [...keysSeen.entries()].sort((a, b) => b[1] - a[1]);
console.log(`Sample size: ${sample.length}`);
console.log('Key -- nonNullCount');
for (const [k, n] of ranked) console.log(`  ${n.toString().padStart(4)}  ${k}`);

// Show one record's sample values for the most populated keys
const top = ranked.slice(0, 25).map(([k]) => k);
console.log('\nSample values from record[0]:');
for (const k of top) {
  let v = sample[0][k];
  if (typeof v === 'object') v = JSON.stringify(v).slice(0, 80);
  else if (typeof v === 'string') v = v.slice(0, 80);
  console.log(`  ${k}: ${v}`);
}
