/**
 * One-shot: cross-reference reviews-master.json against JN contacts to
 * label each review with the estimate-delivery method (in-person vs
 * online) and write data/reviews-by-method.json.
 *
 * Matching is fuzzy by full reviewer name → JN contact display_name.
 * For each matched contact, pulls the activities + estimates and applies
 * the same in-person/online certainty rules as lib/jn-deep-funnel.ts.
 *
 * Run: node scripts/reviews-by-method.mjs
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

async function jn(endpoint) {
  const r = await fetch(`${JN_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${JN_KEY}`, 'Content-Type': 'application/json' },
  });
  if (!r.ok) throw new Error(`JN ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

const reviews = JSON.parse(fs.readFileSync('data/reviews-master.json', 'utf8')).reviews;
console.log(`Loaded ${reviews.length} reviews`);

// Group by name (some reviewers leave two reviews)
const byName = new Map();
for (const r of reviews) {
  const key = (r.name || '').trim();
  if (!key) continue;
  if (!byName.has(key)) byName.set(key, []);
  byName.get(key).push(r);
}
console.log(`${byName.size} distinct reviewer names`);

const SYSTEM_AUTHORS_RE = /system|automation|webhook|portal|jobnimbus\b|^api\b|^email$/i;
const OFFICE = ['sara hill', 'destin', 'tia muse', 'tia morris', 'boston', 'office'];

function isOffice(name) {
  const lower = (name || '').toLowerCase();
  return OFFICE.some(o => lower.includes(o));
}

async function classifyContact(contact) {
  const [actP, actR, ests] = await Promise.all([
    jn(`/activities?filter=${encodeURIComponent(JSON.stringify({ must: [{ term: { 'primary.id': contact.jnid } }] }))}&sort=date_created&limit=100`).catch(() => ({})),
    jn(`/activities?filter=${encodeURIComponent(JSON.stringify({ must: [{ term: { 'related.id': contact.jnid } }] }))}&sort=date_created&limit=100`).catch(() => ({})),
    jn(`/estimates?filter=${encodeURIComponent(JSON.stringify({ must: [{ term: { 'primary.id': contact.jnid } }] }))}&sort=date_created&limit=5`).catch(() => ({})),
  ]);
  const seen = new Set();
  const acts = [];
  for (const a of [...(actP.results || []), ...(actR.results || [])]) {
    if (a.jnid && !seen.has(a.jnid)) { seen.add(a.jnid); acts.push(a); }
  }
  acts.sort((a, b) => (a.date_created || 0) - (b.date_created || 0));
  const firstEst = (ests.results || [])[0];
  if (!firstEst) return { certainty: 'no_estimate', estimateDate: null, evidence: 'No estimate on file' };

  const estDate = firstEst.date_created || 0;
  const before = acts.filter(a => (a.date_created || 0) < estDate);
  const completedAppt = before.find(a =>
    /appointment|appt|visit|inspection/i.test(a.record_type_name || '') &&
    /completed|done|complete/i.test(a.status || '') &&
    estDate - (a.date_created || 0) < 7 * 86400,
  );
  const meetingNote = before.find(a =>
    (a.record_type_name || '') === 'Note' &&
    /\b(met|meeting|visited|inspection|inspected|in.person|on.site|stopped by|came out|presented)\b/i.test(a.note || ''),
  );
  if (completedAppt) {
    return { certainty: 'in_person_high', estimateDate: new Date(estDate * 1000).toISOString().slice(0, 10), evidence: `completed appt ${new Date((completedAppt.date_created || 0) * 1000).toISOString().slice(0, 10)}` };
  }
  if (meetingNote) {
    return { certainty: 'in_person_probable', estimateDate: new Date(estDate * 1000).toISOString().slice(0, 10), evidence: `meeting note "${(meetingNote.note || '').slice(0, 60)}"` };
  }
  const emailNear = acts.find(a => /email/i.test(a.record_type_name || '') && Math.abs((a.date_created || 0) - estDate) < 86400);
  if (emailNear) {
    return { certainty: 'online_high', estimateDate: new Date(estDate * 1000).toISOString().slice(0, 10), evidence: 'email within 24h of estimate' };
  }
  return { certainty: 'online_probable', estimateDate: new Date(estDate * 1000).toISOString().slice(0, 10), evidence: 'no meeting note or appt before estimate' };
}

const labeled = [];
const missed = [];
let i = 0;
for (const [name, rs] of byName) {
  i++;
  if (i % 20 === 0) process.stdout.write(`  ${i}/${byName.size}\r`);
  try {
    // Search by name — JN doesn't have a name search, so use the q param
    const search = await jn(`/contacts?q=${encodeURIComponent(name)}&limit=5`).catch(() => ({}));
    const matches = (search.results || []).filter(c => {
      const candidate = (c.display_name || `${c.first_name || ''} ${c.last_name || ''}`).trim().toLowerCase();
      return candidate === name.toLowerCase() || candidate.includes(name.toLowerCase());
    });
    if (matches.length === 0) {
      missed.push({ name, reason: 'no JN match' });
      continue;
    }
    // Take the oldest matching contact (most likely the actual customer)
    const contact = matches.sort((a, b) => (a.date_created || 0) - (b.date_created || 0))[0];
    const cls = await classifyContact(contact);
    for (const r of rs) {
      labeled.push({
        reviewId: r.id,
        name: r.name,
        date: r.date,
        rating: r.rating,
        salesRep: r.salesRep,
        contactJnid: contact.jnid,
        certainty: cls.certainty,
        estimateDate: cls.estimateDate,
        evidence: cls.evidence,
      });
    }
  } catch (e) {
    missed.push({ name, reason: String(e).slice(0, 100) });
  }
}
console.log();
console.log(`Matched: ${labeled.length} reviews`);
console.log(`Missed: ${missed.length} reviewers`);

const byCert = {};
for (const l of labeled) {
  if (!byCert[l.certainty]) byCert[l.certainty] = { count: 0, total: 0, fiveStar: 0, sub4: 0 };
  byCert[l.certainty].count++;
  byCert[l.certainty].total += l.rating;
  if (l.rating === 5) byCert[l.certainty].fiveStar++;
  if (l.rating <= 3) byCert[l.certainty].sub4++;
}
const summary = Object.entries(byCert).map(([k, v]) => ({
  certainty: k,
  reviews: v.count,
  avgRating: Math.round((v.total / v.count) * 100) / 100,
  fiveStarPct: Math.round((v.fiveStar / v.count) * 1000) / 10,
  lowRatings: v.sub4,
}));
console.log('\nBy certainty:');
console.table(summary);

fs.writeFileSync('data/reviews-by-method.json', JSON.stringify({
  generatedAt: new Date().toISOString().slice(0, 10),
  totalReviews: reviews.length,
  matched: labeled.length,
  missed: missed.length,
  summary,
  labeled,
  missedSample: missed.slice(0, 20),
}, null, 2));
console.log('Wrote data/reviews-by-method.json');
