/**
 * Deep audit of office-created leads — last 30 days.
 *
 * For each contact created by office staff in the window:
 *   1. List the contact's identifying info
 *   2. Fetch ALL activities related to that contact (no type filter)
 *   3. Fetch the related job(s)
 *   4. For each job, fetch ALL activities (no filter)
 *   5. Dump every activity with author, type, status, date, note preview
 *
 * Saves data/lead-response-audit.json + prints a summary.
 *
 * Goal: figure out what the previous analyzer was missing. Maybe
 *   - Activity types we filtered out (Set Appt? Visit? Custom?)
 *   - Status changes that ARE manual rep work
 *   - Activities on the JOB record only (not the contact)
 *   - Activities where the rep is `created_by` (uid) but `created_by_name`
 *     is set to office staff (auto-assigned)
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

const OFFICE_STAFF = [
  'sara hill', 'destin mccary', 'destin mc cary', 'tia muse morris', 'tia morris', 'tia muse',
  'sara', 'destin', 'tia', 'office', 'boston',
];

function isOffice(name) {
  const lower = (name || '').toLowerCase().trim();
  return OFFICE_STAFF.some(s => lower === s || lower.includes(s));
}

async function jnFetch(endpoint) {
  const res = await fetch(`${JN_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${JN_KEY}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`JN ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

const now = Math.floor(Date.now() / 1000);
const since30 = now - 30 * 86400;
console.log(`Pulling contacts created since ${new Date(since30 * 1000).toISOString().slice(0, 10)}...`);

// 1. Pull contacts
const contacts = [];
let offset = 0;
let officeContactCount = 0;
while (offset < 2000) {
  const res = await jnFetch(`/contacts?limit=100&offset=${offset}&sort=-date_created`);
  const page = res.results || [];
  if (!page.length) break;
  let outOfRange = false;
  for (const c of page) {
    if ((c.date_created || 0) < since30) { outOfRange = true; break; }
    if (!isOffice(c.created_by_name || '')) continue;
    if (!c.sales_rep_name) continue;
    // Skip personal-referral sources
    const src = (c.source_name || '').toLowerCase();
    if (src.includes('referral') || src.includes('personal')) continue;
    officeContactCount++;
    contacts.push(c);
  }
  if (outOfRange) break;
  offset += 100;
}
console.log(`Found ${officeContactCount} office-created contacts in last 30 days.`);

// 2. For each contact: pull every activity on the contact AND any related jobs
const seenActivityIds = new Set();
const out = [];
let leadsWithAnyActivity = 0;
let leadsWithNoActivity = 0;

for (let i = 0; i < contacts.length; i++) {
  const c = contacts[i];
  if (i % 10 === 0) process.stdout.write(`  scanning ${i}/${contacts.length}\r`);

  // All activities filtered by primary.id OR related.id pointing at the contact
  const [byPrimary, byRelated] = await Promise.all([
    jnFetch(`/activities?filter=${encodeURIComponent(JSON.stringify({ must: [{ term: { 'primary.id': c.jnid } }] }))}&sort=date_created&limit=100`).catch(() => ({})),
    jnFetch(`/activities?filter=${encodeURIComponent(JSON.stringify({ must: [{ term: { 'related.id': c.jnid } }] }))}&sort=date_created&limit=100`).catch(() => ({})),
  ]);
  const contactActs = [];
  for (const a of [...(byPrimary.results || byPrimary.activity || []), ...(byRelated.results || byRelated.activity || [])]) {
    if (a.jnid && !seenActivityIds.has(a.jnid)) {
      seenActivityIds.add(a.jnid);
      contactActs.push(a);
    }
  }

  // Pull jobs for this contact
  const jobsRes = await jnFetch(`/jobs?filter=${encodeURIComponent(JSON.stringify({ must: [{ term: { 'primary.id': c.jnid } }] }))}&limit=10`).catch(() => ({}));
  const jobs = jobsRes.results || [];

  // For each job, get ALL activities
  const jobActs = [];
  for (const j of jobs) {
    const [jobPrim, jobRel] = await Promise.all([
      jnFetch(`/activities?filter=${encodeURIComponent(JSON.stringify({ must: [{ term: { 'primary.id': j.jnid } }] }))}&sort=date_created&limit=100`).catch(() => ({})),
      jnFetch(`/activities?filter=${encodeURIComponent(JSON.stringify({ must: [{ term: { 'related.id': j.jnid } }] }))}&sort=date_created&limit=100`).catch(() => ({})),
    ]);
    for (const a of [...(jobPrim.results || jobPrim.activity || []), ...(jobRel.results || jobRel.activity || [])]) {
      if (a.jnid && !seenActivityIds.has(a.jnid)) {
        seenActivityIds.add(a.jnid);
        jobActs.push({ ...a, _jobNumber: j.number });
      }
    }
  }

  const allActs = [...contactActs, ...jobActs].sort((a, b) => (a.date_created || 0) - (b.date_created || 0));
  // De-dup again (some activities show under both contact and job)
  const allUnique = [];
  const seen2 = new Set();
  for (const a of allActs) {
    if (a.jnid && !seen2.has(a.jnid)) {
      seen2.add(a.jnid);
      allUnique.push(a);
    }
  }

  const repName = (c.sales_rep_name || '').trim();
  const actsAfterCreate = allUnique.filter(a => (a.date_created || 0) > (c.date_created || 0));
  const repActs = actsAfterCreate.filter(a => {
    const author = (a.created_by_name || '').toLowerCase();
    if (!author) return false;
    if (isOffice(author)) return false;
    if (/system|automation|webhook|portal|jobnimbus|api/.test(author)) return false;
    return true;
  });

  if (allUnique.length > 0) leadsWithAnyActivity++;
  else leadsWithNoActivity++;

  out.push({
    contactJnid: c.jnid,
    contactName: c.display_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.jnid,
    contactCreatedAt: new Date((c.date_created || 0) * 1000).toISOString(),
    createdBy: c.created_by_name,
    rep: repName,
    source: c.source_name || '',
    leadStatus: c.status_name || '',
    jobCount: jobs.length,
    jobNumbers: jobs.map(j => j.number).filter(Boolean),
    totalActivities: allUnique.length,
    activitiesAfterCreate: actsAfterCreate.length,
    repActivities: repActs.length,
    firstRepActivity: repActs[0] ? {
      type: repActs[0].record_type_name,
      author: repActs[0].created_by_name,
      date: new Date((repActs[0].date_created || 0) * 1000).toISOString(),
      noteSnip: (repActs[0].note || '').slice(0, 80),
      minutesAfterLead: repActs[0].date_created && c.date_created
        ? Math.round((repActs[0].date_created - c.date_created) / 60)
        : null,
    } : null,
    allActivityTypes: [...new Set(allUnique.map(a => a.record_type_name).filter(Boolean))],
    allAuthors: [...new Set(allUnique.map(a => a.created_by_name).filter(Boolean))],
    activities: allUnique.map(a => ({
      type: a.record_type_name,
      author: a.created_by_name,
      date: new Date((a.date_created || 0) * 1000).toISOString(),
      status: a.status,
      noteSnip: (a.note || '').slice(0, 200),
      onJobNumber: a._jobNumber,
    })),
  });
}
console.log();
console.log(`\nDone.`);
console.log(`  Total office leads (last 30d): ${officeContactCount}`);
console.log(`  Leads with ANY activity:       ${leadsWithAnyActivity}`);
console.log(`  Leads with NO activity at all: ${leadsWithNoActivity}`);

// Aggregate activity types seen
const typeCounts = {};
const authorCounts = {};
for (const r of out) {
  for (const t of r.allActivityTypes) typeCounts[t] = (typeCounts[t] || 0) + 1;
  for (const a of r.allAuthors) authorCounts[a] = (authorCounts[a] || 0) + 1;
}
console.log(`\nActivity types seen across all leads (leads-with-that-type / 30):`);
Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).forEach(([t, n]) =>
  console.log(`  ${t.padEnd(40)} ${n} leads`),
);
console.log(`\nAuthors seen across all leads:`);
Object.entries(authorCounts).sort((a, b) => b[1] - a[1]).slice(0, 30).forEach(([a, n]) =>
  console.log(`  ${a.padEnd(40)} ${n} leads`),
);

const summary = {
  generatedAt: new Date().toISOString().slice(0, 10),
  windowDays: 30,
  totalLeads: officeContactCount,
  leadsWithAnyActivity,
  leadsWithNoActivity,
  pctWithActivity: officeContactCount > 0 ? Math.round((leadsWithAnyActivity / officeContactCount) * 1000) / 10 : 0,
  activityTypesSeen: Object.fromEntries(Object.entries(typeCounts).sort((a, b) => b[1] - a[1])),
  authorsSeen: Object.fromEntries(Object.entries(authorCounts).sort((a, b) => b[1] - a[1])),
  leads: out,
};

fs.writeFileSync('data/lead-response-audit.json', JSON.stringify(summary, null, 2));
console.log(`\nWrote data/lead-response-audit.json (${out.length} leads with full activity breakdown)`);
