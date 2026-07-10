/**
 * Probe: verify the JobNimbus /files READ shape and (gated) WRITE payload so
 * lib/jobnimbus-service.ts uploadFileToJob stays backed by a live-verified shape.
 *
 * Modes:
 *   node scripts/test-jn-file-upload.mjs [R-XXXXX]          → READ-ONLY probe
 *   node scripts/test-jn-file-upload.mjs --write [R-XXXXX]  → WRITE probe
 *
 * The WRITE probe posts a 1x1 transparent PNG named RCRS-UPLOAD-TEST-DELETE.png
 * (description marks it as a safe-to-delete automated probe), confirms it
 * appears in GET /files for the job, then DELETEs it. Owner-authorized
 * 2026-07-10. JN is a LIVE production CRM — the write probe targets R-99001
 * if it exists, else falls back to R-11305 (or the job passed as argv).
 *
 * ── VERIFIED WRITE CONTRACT (live probe, 2026-07-10) ───────────────────────
 *   POST /files succeeds as plain JSON (multipart NOT needed):
 *     {
 *       data: '<base64>',
 *       filename: 'name.png',
 *       content_type: 'image/png',        // honored; inferred from ext if omitted
 *       description: '...',
 *       type: 2,                          // numeric JN FileTypeId — 2 = Photo.
 *                                         // Full enum (returned by the API on a
 *                                         // bad type): 1 Document, 2 Photo,
 *                                         // 3 Email Attachment, 4 Estimate,
 *                                         // 5 EagleView, 8 Invoice, 9 Contract,
 *                                         // 10 Payment, 11 Insurance Summary,
 *                                         // 13 Permit, 16 JOB BREAKDOWN,
 *                                         // 18 Customer Acceptance Form,
 *                                         // 24 Completed Photos
 *       related: ['<jobJnid>', '<contactJnid>'],  // PLAIN JNID STRINGS!
 *       persist: true,
 *       is_active: true,
 *     }
 *   → 200 with the created record: JN expands related into {id,type,name},
 *     derives `primary` (the job) + owners/sales_rep from it, and sets
 *     record_type/record_type_name from the numeric `type`.
 *
 *   Shapes that DO NOT work (all tried live):
 *     - related: [{ id }] / [{ jnid }] / [{ id, type:'job' }]
 *         → HTTP 500 "Attempt to relate to invalid document"
 *     - related: { jnid } (single object) or primary: {...}
 *         → HTTP 200 but the relation is SILENTLY DROPPED (orphan file)
 *     - type: 'jnid' or any string → 400 listing valid FileTypeIds
 *     - record_type_name alone (no `type`) does NOT create the relation
 *     - multipart/form-data → 500 "Invalid parameters"
 *
 *   DELETE /files/{jnid} → 200 {"msg":"success"} — verified cleanup path.
 *   ⚠️ A DELETE fired within ~1s of the POST can return 200 yet silently
 *   no-op (observed live: the record survived and stayed on the job). Wait a
 *   few seconds after create before deleting, and re-check afterward.
 *   GET /files/{jnid} returns the BINARY, not metadata; metadata comes from
 *   GET /files?filter={term:{jnid}}. List key is `files`, NOT `results`.
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
const JN_URL = process.env.JOBNIMBUS_API_URL || 'https://app.jobnimbus.com/api1';
if (!JN_KEY) {
  console.error('JOBNIMBUS_API_KEY missing from .env.local');
  process.exit(1);
}

const HEADERS = { Authorization: `Bearer ${JN_KEY}`, 'Content-Type': 'application/json' };

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const jobArg = args.find(a => !a.startsWith('--'));
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJson(pathAndQuery) {
  const res = await fetch(`${JN_URL}${pathAndQuery}`, { headers: HEADERS });
  if (!res.ok) {
    console.log(`  HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return null;
  }
  return res.json();
}

async function findJob(jobNumber) {
  const filter = { must: [{ term: { number: jobNumber } }] };
  const data = await getJson(`/jobs?filter=${encodeURIComponent(JSON.stringify(filter))}`);
  return data?.results?.[0] || null;
}

// GET /files returns { count, files } — list key is `files`, NOT `results`
// (verified 2026-07-10). pickList tolerates both in case JN ever normalizes.
const pickList = (data) => data?.files || data?.results || [];

async function filesForJob(jobJnid, limit = 5) {
  const filter = { must: [{ term: { 'related.id': jobJnid } }] };
  return getJson(`/files?filter=${encodeURIComponent(JSON.stringify(filter))}&sort=-created_at&limit=${limit}`);
}

// ─── READ-ONLY PROBE ─────────────────────────────────────────────────────────
if (!WRITE) {
  const jobNumber = jobArg || 'R-11305';
  console.log(`=== READ probe — job ${jobNumber} ===`);
  const job = await findJob(jobNumber);
  if (!job) {
    console.error(`No JN job found for ${jobNumber}.`);
    process.exit(1);
  }
  console.log(`  jnid: ${job.jnid}  name: ${job.name}  primary.id: ${job.primary?.id}`);

  const jobFiles = await filesForJob(job.jnid, 3);
  console.log(`\n=== GET /files for job (count: ${jobFiles?.count ?? '(none)'}) ===`);
  for (const f of pickList(jobFiles)) {
    console.log(JSON.stringify({
      jnid: f.jnid, filename: f.filename, record_type_name: f.record_type_name,
      content_type: f.content_type, upload_status: f.upload_status,
      is_active: f.is_active, related: f.related,
    }, null, 2));
  }
  process.exit(0);
}

// ─── WRITE PROBE (owner-authorized) ──────────────────────────────────────────
console.log('=== WRITE probe ===');
let job = await findJob(jobArg || 'R-99001');
if (!job && !jobArg) {
  console.log('  R-99001 not found — falling back to R-11305');
  job = await findJob('R-11305');
}
if (!job) {
  console.error('No target job resolvable. Aborting.');
  process.exit(1);
}
const jobJnid = job.jnid;
const contactJnid = job.primary?.id || job.jnid;
console.log(`  target job: ${job.number} "${job.name}" jnid=${jobJnid} contact=${contactJnid}`);

const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const FILENAME = 'RCRS-UPLOAD-TEST-DELETE.png';

// THE verified payload — mirrors lib/jobnimbus-service.ts uploadFileToJob.
const payload = {
  data: TINY_PNG_B64,
  filename: FILENAME,
  content_type: 'image/png',
  description: '[RCRS automated upload probe — safe to delete]',
  type: 2, // Photo
  related: Array.from(new Set([jobJnid, contactJnid])),
  persist: true,
  is_active: true,
};

console.log('\n--- POST /files (verified payload shape) ---');
const res = await fetch(`${JN_URL}/files`, {
  method: 'POST',
  headers: HEADERS,
  body: JSON.stringify(payload),
});
const text = await res.text();
console.log(`  HTTP ${res.status}: ${text.slice(0, 800)}`);
if (!res.ok) {
  console.error('\nPOST /files FAILED — the verified contract may have changed. See above.');
  process.exit(1);
}
const created = JSON.parse(text);
console.log(`  created jnid=${created.jnid} record_type_name=${created.record_type_name}`);
console.log(`  related: ${JSON.stringify(created.related)}`);

// ─── Confirm it appears on the job (ES index needs a beat) ──────────────────
await sleep(6000);
const after = await filesForJob(jobJnid, 5);
const found = pickList(after).find(f => f.jnid === created.jnid);
console.log(`\n=== verify: GET /files for job — probe file ${found ? 'FOUND' : 'NOT FOUND'} (count ${after?.count}) ===`);

// ─── Cleanup: DELETE the probe file ──────────────────────────────────────────
console.log(`\n=== cleanup: DELETE /files/${created.jnid} ===`);
const del = await fetch(`${JN_URL}/files/${created.jnid}`, { method: 'DELETE', headers: HEADERS });
console.log(`  HTTP ${del.status}: ${(await del.text()).slice(0, 300)}`);
if (!del.ok) {
  console.log(`  DELETE failed — delete ${FILENAME} manually from job ${job.number} in the JN UI.`);
}
