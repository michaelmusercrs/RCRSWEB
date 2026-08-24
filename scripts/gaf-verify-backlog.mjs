// Read-only verification: show the GAF queue state, and for each attached
// report confirm the PDF + summary note are actually on the JobNimbus job.
//   node scripts/gaf-verify-backlog.mjs
import fs from 'node:fs';
import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';

for (const f of ['.env.local', '.env']) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const KEY = process.env.JOBNIMBUS_API_KEY;
const BASE = process.env.JOBNIMBUS_API_URL || 'https://app.jobnimbus.com/api1';

const jwt = new JWT({ email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, key: (process.env.GOOGLE_PRIVATE_KEY||'').replace(/\\n/g,'\n'), scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID, jwt);
await doc.loadInfo();
const sheet = doc.sheetsByTitle['GAF_Report_Queue'];
const rows = sheet ? await sheet.getRows({ limit: 100000 }) : [];

const byStatus = {};
for (const r of rows) { const s = r.get('status')||'?'; byStatus[s]=(byStatus[s]||0)+1; }
console.log(`QUEUE: ${rows.length} reports · ${JSON.stringify(byStatus)}\n`);

async function jnFiles(jnid) {
  const filter = { must: [{ term: { 'related.id': jnid } }] };
  const r = await fetch(`${BASE}/files?filter=${encodeURIComponent(JSON.stringify(filter))}&size=50`, { headers: { Authorization: `Bearer ${KEY}` } });
  if (!r.ok) return { err: `HTTP ${r.status}` };
  const j = await r.json();
  return { files: j.files || j.results || [] };
}
async function jnNotes(jnid) {
  const filter = { must: [{ term: { 'related.id': jnid } }] };
  const r = await fetch(`${BASE}/activities?filter=${encodeURIComponent(JSON.stringify(filter))}&size=50`, { headers: { Authorization: `Bearer ${KEY}` } });
  if (!r.ok) return { err: `HTTP ${r.status}` };
  const j = await r.json();
  return { acts: j.activity || j.results || j.activities || [] };
}

for (const r of rows) {
  const order = r.get('orderNumber'), status = r.get('status'), job = r.get('jobNumber'), jnid = r.get('jobJnid'), addr = r.get('address');
  const wantFile = `GAF-QuickMeasure-${order}.pdf`;
  if (jnid) {
    const { files, err } = await jnFiles(jnid);
    const hasPdf = files ? files.some(f => (f.filename||'')===wantFile) : false;
    const { acts } = await jnNotes(jnid);
    const hasNote = acts ? acts.some(a => (a.note||'').includes('Material Order Cheat-Sheet') || (a.note||'').includes(`Order #${order}`)) : false;
    console.log(`${status.padEnd(9)} ${(job||'—').padEnd(9)} ${addr}`);
    console.log(`   PDF on job: ${hasPdf?'✅ '+wantFile:'❌ not found'+(err?` (${err})`:'')}   |   summary note: ${hasNote?'✅':'❌'}`);
  } else {
    console.log(`${status.padEnd(9)} ${'—'.padEnd(9)} ${addr}`);
    console.log(`   (no JN job matched — needs a job created)`);
  }
}
