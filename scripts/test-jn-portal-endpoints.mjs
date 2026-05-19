/**
 * Customer-portal JN endpoint smoke test.
 *
 * Verifies that every customer-portal JN read path is using the JSON-encoded
 * filter format that JN's API actually accepts. Exercises the same fetch
 * URLs the live customer dashboard uses.
 */
import fs from 'fs';
import path from 'path';
const envPath = path.join(process.cwd(), '.env.local');
fs.readFileSync(envPath, 'utf8').split('\n').forEach(l => {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) {
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
});

const JN_KEY = process.env.JOBNIMBUS_API_KEY;
const BASE = process.env.JOBNIMBUS_API_URL || 'https://app.jobnimbus.com/api1';

if (!JN_KEY) {
  console.error('No JOBNIMBUS_API_KEY in .env.local');
  process.exit(1);
}

// 1. Pull a real job + its primary contact id to test against.
const jobRes = await fetch(
  `${BASE}/jobs?filter=${encodeURIComponent(JSON.stringify({ must: [{ term: { number: 'R-10997' } }] }))}`,
  { headers: { Authorization: `Bearer ${JN_KEY}` } },
);
const jobJson = await jobRes.json();
const job = jobJson.results?.[0];
if (!job) {
  console.error('Could not load test job R-10997');
  process.exit(1);
}
const customerId = job.primary?.id;
const jobJnid = job.jnid;

console.log(`Test job: ${job.number} "${job.name}"`);
console.log(`Customer id (primary.id): ${customerId}`);
console.log(`Job jnid: ${jobJnid}`);
console.log('---');

async function check(label, url) {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${JN_KEY}` } });
    if (!res.ok) {
      const body = await res.text();
      console.log(`  FAIL  [${res.status}]  ${label}`);
      console.log(`       ${body.slice(0, 200)}`);
      return false;
    }
    const json = await res.json();
    const count = json.count ?? json.results?.length ?? '?';
    console.log(`  OK    [${res.status}]  ${label}  (results=${count})`);
    return true;
  } catch (err) {
    console.log(`  ERR   ${label}: ${err.message}`);
    return false;
  }
}

const byPrimaryId = encodeURIComponent(
  JSON.stringify({ must: [{ term: { 'primary.id': customerId } }] }),
);
const byRelatedId = encodeURIComponent(
  JSON.stringify({ must: [{ term: { 'related.id': jobJnid } }] }),
);

console.log('Customer-portal endpoint shapes (primary.id):');
const results = [];
results.push(await check('GET /jobs?filter=primary.id',      `${BASE}/jobs?filter=${byPrimaryId}`));
results.push(await check('GET /tasks?filter=primary.id',     `${BASE}/tasks?filter=${byPrimaryId}&sort=-date_start`));
results.push(await check('GET /estimates?filter=primary.id', `${BASE}/estimates?filter=${byPrimaryId}`));
results.push(await check('GET /invoices?filter=primary.id',  `${BASE}/invoices?filter=${byPrimaryId}`));
results.push(await check('GET /activities?filter=primary.id (notes-on-contact)', `${BASE}/activities?filter=${byPrimaryId}&sort=-created_at&limit=50`));

console.log('\nJob-scoped endpoint shapes (related.id):');
results.push(await check('GET /activities?filter=related.id', `${BASE}/activities?filter=${byRelatedId}&sort=-created_at&limit=50`));
results.push(await check('GET /files?filter=related.id',      `${BASE}/files?filter=${byRelatedId}&sort=-created_at`));

const passed = results.filter(Boolean).length;
const total = results.length;
console.log(`\n${passed}/${total} endpoints OK`);
process.exit(passed === total ? 0 : 1);
