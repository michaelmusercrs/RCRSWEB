/**
 * Probe: learn the JobNimbus /files shape so uploadFileToJob's POST payload
 * can be verified before it's ever wired into a production path.
 *
 * READ-ONLY. This script only GETs. The actual write-probe (POST /files) is
 * commented out at the bottom — JN is a LIVE production CRM and a POST here
 * creates a real file on a real customer job. Do not uncomment during demos
 * or without picking a safe internal/test job first.
 *
 * Run: node scripts/test-jn-file-upload.mjs [R-XXXXX]
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

async function getJson(pathAndQuery) {
  const res = await fetch(`${JN_URL}${pathAndQuery}`, { headers: HEADERS });
  if (!res.ok) {
    console.log(`  HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return null;
  }
  return res.json();
}

// --- 1. Find a job to inspect (default R-10997 — known-good from prior probes)
const jobNumber = process.argv[2] || 'R-10997';
console.log(`=== Looking up job ${jobNumber} ===`);
const jobFilter = { must: [{ term: { number: jobNumber } }] };
const jobData = await getJson(`/jobs?filter=${encodeURIComponent(JSON.stringify(jobFilter))}`);
const job = jobData?.results?.[0];
if (!job) {
  console.error(`No JN job found for ${jobNumber} — pass a different number as argv[2].`);
  process.exit(1);
}
console.log(`  jnid: ${job.jnid}  name: ${job.name}  primary.id: ${job.primary?.id}`);

// NOTE (verified 2026-07-10): GET /files returns { count, files } — the list
// key is `files`, NOT `results` like /jobs and /activities. `pickList`
// tolerates both in case JN ever normalizes it.
const pickList = (data) => data?.files || data?.results || [];

// --- 2. GET /files for that job — this response shape is what a POST must produce
console.log(`\n=== GET /files for job ${job.jnid} (related.id filter) ===`);
const fileFilter = { must: [{ term: { 'related.id': job.jnid } }] };
const jobFiles = await getJson(
  `/files?filter=${encodeURIComponent(JSON.stringify(fileFilter))}&sort=-created_at&limit=3`,
);
console.log(`  count: ${jobFiles?.count ?? '(none)'}`);
for (const f of pickList(jobFiles)) {
  const { exif, ...rest } = f; // exif is huge and irrelevant
  console.log(JSON.stringify(rest, null, 2));
}

// --- 3. Bare GET /files — global shape + every field JN stores on a file record
console.log('\n=== GET /files?limit=2 (global — full field inventory) ===');
const anyFiles = await getJson('/files?limit=2');
console.log(`  total files in account: ${anyFiles?.count ?? '?'}`);
const sample = pickList(anyFiles)[0];
if (sample) {
  console.log('  fields present on a file record:');
  console.log('  ' + Object.keys(sample).sort().join(', '));
  const { exif, ...rest } = sample;
  console.log('\n  full sample record (exif stripped):');
  console.log(JSON.stringify(rest, null, 2));
}

console.log(`
=== FINDINGS (verified from live GET, 2026-07-10) ===
  1. List response key is \`files\`, NOT \`results\`. (Heads-up: the generic
     read methods in lib/jobnimbus-service.ts that parse /files via
     \`.results\` — getFiles / getFilesForJob / getAttachmentsForContact —
     therefore see empty lists. Separate bug, not touched by this task.)
  2. \`related\` is an ARRAY of { id, name, number, type } — job relation uses
     type: 'job'. \`primary\` mirrors the job and is derived by JN.
  3. \`record_type_name\` is a JN file CATEGORY ('Photo', 'Permit', ...).
  4. Records carry no \`url\` field — download appears to be a separate
     endpoint (likely GET /files/{jnid}), so don't expect a URL on create.
  5. Interesting write-relevant fields on records: is_uploading,
     upload_status ('completed'), is_private, is_active.

=== STILL UNVERIFIED (needs the gated write-probe below) ===
  A. Whether POST /files accepts JSON with base64 in \`data\` (api1-docs
     style) or requires multipart/form-data.
  B. Whether the POST relation shape is related:[{id}] (matching GET) —
     current best guess in uploadFileToJob — or {jnid} like /activities.
`);

// =============================================================================
// WRITE-PROBE — INTENTIONALLY DISABLED
// =============================================================================
// JN is a live production CRM: a POST /files creates a REAL file on a REAL
// customer job that office staff will see. Only run this after:
//   1. Reviewing the GET findings above and adjusting the payload,
//   2. Choosing a safe target (an internal/test job, NOT a customer job),
//   3. Being ready to delete the file from the JN UI afterward.
//
// To run: replace TEST_JOB_JNID/TEST_CONTACT_JNID with the safe job's ids,
// uncomment, and run once. The 1x1 transparent PNG below is the smallest
// possible harmless payload.
//
// const TEST_JOB_JNID = 'REPLACE_ME';
// const TEST_CONTACT_JNID = 'REPLACE_ME';
// const TINY_PNG_B64 =
//   'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
// const postRes = await fetch(`${JN_URL}/files`, {
//   method: 'POST',
//   headers: HEADERS,
//   body: JSON.stringify({
//     data: TINY_PNG_B64,
//     filename: 'jn-upload-probe.png',
//     content_type: 'image/png',
//     related: [{ id: TEST_JOB_JNID }, { id: TEST_CONTACT_JNID }],
//     record_type_name: 'Photo',
//     persist: true,
//     is_active: true,
//   }),
// });
// console.log('POST /files →', postRes.status, await postRes.text());
