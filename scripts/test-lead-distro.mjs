/**
 * Single-address lead-distro tester. Pulls JN contacts in-memory (with the
 * geo.lon/geo.lng fix applied), runs the real scoring algorithm, and prints:
 *   - geocoded coords
 *   - nearest 3 contacts
 *   - within 1/5/10 mi counts
 *   - per-rep score breakdown (install/contact proximity + other factors)
 *   - winning rep (or round-robin fallback flag)
 *
 * Usage: node scripts/test-lead-distro.mjs "ADDRESS HERE"
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

if (!JN_KEY) { console.error('Missing JOBNIMBUS_API_KEY'); process.exit(1); }

const address = process.argv.slice(2).join(' ').trim();
if (!address) {
  console.error('Usage: node scripts/test-lead-distro.mjs "1234 Some St, City, ST 12345"');
  process.exit(1);
}

// Mirror data/lead-distro-config.json
const CFG = {
  weights: { installProximity: 30, contactProximity: 15, doorKnockRecency: 10, referralBonus: 25, meetingAttendance: 10, closeRate: 5, responseTime: 5 },
  thresholds: { proximityRadiusMiles: 2.0, recentInteractionDays: 90, staleInteractionDays: 730, clearWinnerGapPercent: 10 },
};

// Active sales reps from lib/team-roles.ts
const REPS = [
  { slug: 'hunter',  name: 'Hunter Rivers' },
  { slug: 'aaron',   name: 'Aaron Lussi' },
  { slug: 'greg',    name: 'Greg Muse' },
  { slug: 'brendon', name: 'Brendon Muse' },
  { slug: 'adam',    name: 'Adam Rudell' },
  { slug: 'joseph',  name: 'Joseph Dowd' },
  { slug: 'alijah',  name: 'Alijah' },
  { slug: 'travis',  name: 'Travis Wages' },
];
const MS_PER_DAY = 86400000;

function haversine(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function repSlug(name) {
  return (name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function recencyMul(iso, now) {
  // Exponential decay: 0.1 + 0.9*exp(-days/180). Mirrors the prod algorithm.
  if (!iso) return 0.1;
  const t = new Date(iso).getTime();
  if (isNaN(t)) return 0.1;
  const days = Math.max(0, (now - t) / MS_PER_DAY);
  return Math.max(0.1, 0.1 + 0.9 * Math.exp(-days / 180));
}

function classifyType(status) {
  const sl = (status || '').toLowerCase();
  if (sl.includes('complete') || sl.includes('closed') || sl.includes('paid')) return 'install';
  if (sl.includes('lead') || sl.includes('new')) return 'lead';
  return 'contact';
}

function scoreProximity(records, leadLat, leadLng, radius, now) {
  let best = 0, bestExp = '', nearby = 0;
  for (const c of records) {
    const d = haversine(leadLat, leadLng, c.lat, c.lng);
    if (d > radius) continue;
    nearby++;
    const distScore = 1 - d / radius;
    const recency = recencyMul(c.lastInteraction, now);
    const combined = distScore * recency;
    if (combined > best) { best = combined; bestExp = `${c.name} ${d.toFixed(2)}mi (recency ${recency.toFixed(1)}x)`; }
  }
  if (nearby === 0) return { score: 0, explanation: `none within ${radius}mi` };
  return { score: Math.min(best, 1), explanation: `${nearby} within ${radius}mi · best: ${bestExp}` };
}

async function geocodeNominatim(addr) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr)}&format=json&limit=1`;
  const res = await fetch(url, { headers: { 'User-Agent': 'RCRS-distro-test/1.0' } });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), displayName: data[0].display_name };
}

async function fetchAllJN() {
  const all = [];
  let page = 0;
  while (page < 200) {
    const url = `${JN_URL}/contacts?from=${page * 100}&size=100`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${JN_KEY}` } });
    if (!res.ok) {
      // JN returns 400 past its max `from` window — treat as end of data
      if (all.length > 0) break;
      throw new Error(`JN ${res.status}`);
    }
    const data = await res.json();
    const results = data.results || data.contacts || [];
    if (!results.length) break;
    all.push(...results);
    if (results.length < 100) break;
    page++;
  }
  return all;
}

function pad(s, n) { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length); }

async function main() {
  console.log(`\n===========================================================`);
  console.log(`LEAD: ${address}`);
  console.log(`===========================================================`);

  const geo = await geocodeNominatim(address);
  if (!geo) { console.log('Geocode FAILED'); return; }
  console.log(`Coords: ${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}`);
  console.log(`Match : ${geo.displayName}`);

  process.stdout.write(`\nPulling JN contacts... `);
  const raw = await fetchAllJN();
  const contacts = raw
    .map(c => {
      const lat = c.geo?.lat;
      const lng = c.geo?.lng ?? c.geo?.lon;
      if (typeof lat !== 'number' || typeof lng !== 'number') return null;
      const status = c.status_name || c.status || '';
      return {
        jnid: c.jnid,
        name: c.display_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown',
        lat, lng,
        type: classifyType(status),
        salesRep: repSlug(c.sales_rep_name),
        salesRepName: c.sales_rep_name || '',
        jobStatus: status,
        lastInteraction: c.date_status_change ? new Date(c.date_status_change * 1000).toISOString()
                       : c.date_updated ? new Date(c.date_updated * 1000).toISOString() : '',
      };
    })
    .filter(Boolean);
  console.log(`${raw.length} fetched · ${contacts.length} with geo`);

  const now = Date.now();
  const scored = contacts.map(c => ({ ...c, distance: haversine(geo.lat, geo.lng, c.lat, c.lng) }))
                         .sort((a, b) => a.distance - b.distance);

  const w01 = scored.filter(c => c.distance <= 0.1).length;
  const w02 = scored.filter(c => c.distance <= 0.2).length;
  const w03 = scored.filter(c => c.distance <= 0.3).length;
  const w05 = scored.filter(c => c.distance <= 0.5).length;
  console.log(`\nWithin 0.1mi: ${w01}  |  0.2mi: ${w02}  |  0.3mi: ${w03}  |  0.5mi: ${w05}`);

  console.log(`\nNearest 3 contacts (any rep):`);
  console.log(`  ${pad('dist', 7)}${pad('name', 25)}${pad('rep', 12)}${pad('type', 10)}${pad('status', 22)}date`);
  for (const c of scored.slice(0, 3)) {
    const date = c.lastInteraction ? c.lastInteraction.slice(0, 10) : '—';
    console.log(`  ${pad(c.distance.toFixed(2) + 'mi', 7)}${pad(c.name.slice(0, 24), 25)}${pad(c.salesRep || '—', 12)}${pad(c.type, 10)}${pad((c.jobStatus || '—').slice(0, 21), 22)}${date}`);
  }

  // Per-rep scoring (radius from config = 2mi)
  console.log(`\nPer-rep scoring (radius ${CFG.thresholds.proximityRadiusMiles}mi, real algorithm):`);
  console.log(`  ${pad('rep', 10)}${pad('total', 8)}${pad('install×30', 12)}${pad('contact×15', 12)}${pad('knock×10', 11)}${pad('attend×10', 11)}${pad('close×5', 9)}resp×5`);

  const repResults = [];
  // Match by full JN name OR firstName-only OR firstName-lastName slug
  for (const rep of REPS) {
    const repFirstSlug = rep.slug; // e.g. 'aaron'
    const repFullSlug  = repSlug(rep.name); // e.g. 'aaron-lussi'
    const mine = contacts.filter(c =>
      c.salesRep === repFirstSlug ||
      c.salesRep === repFullSlug ||
      c.salesRepName === rep.name ||
      c.salesRepName?.toLowerCase().startsWith(rep.name.split(' ')[0].toLowerCase() + ' ')
    );
    const installs = mine.filter(c => c.type === 'install');
    const contactish = mine.filter(c => c.type === 'contact' || c.type === 'lead' || c.type === 'referral');
    const knocks = mine.filter(c => c.type === 'door_knock');

    const ip = scoreProximity(installs, geo.lat, geo.lng, CFG.thresholds.proximityRadiusMiles, now);
    const cp = scoreProximity(contactish, geo.lat, geo.lng, CFG.thresholds.proximityRadiusMiles, now);
    const dk = scoreProximity(knocks, geo.lat, geo.lng, CFG.thresholds.proximityRadiusMiles, now);

    // No sheet data available offline — use the algorithm's default values
    const attendance = 0.5;  // insufficient data fallback
    const closeRate  = 0.5;
    const respTime   = 0.5;

    const total =
      ip.score * CFG.weights.installProximity +
      cp.score * CFG.weights.contactProximity +
      dk.score * CFG.weights.doorKnockRecency +
      attendance * CFG.weights.meetingAttendance +
      closeRate  * CFG.weights.closeRate +
      respTime   * CFG.weights.responseTime;

    repResults.push({ rep, ip, cp, dk, attendance, closeRate, respTime, total, myContactCount: mine.length });
  }

  repResults.sort((a, b) => b.total - a.total);
  for (const r of repResults) {
    console.log(`  ${pad(r.rep.slug, 10)}${pad(r.total.toFixed(2), 8)}${pad((r.ip.score * 30).toFixed(2), 12)}${pad((r.cp.score * 15).toFixed(2), 12)}${pad((r.dk.score * 10).toFixed(2), 11)}${pad((r.attendance * 10).toFixed(2), 11)}${pad((r.closeRate * 5).toFixed(2), 9)}${(r.respTime * 5).toFixed(2)}`);
  }

  // Winner logic mirrors lead-distribution-service.ts
  const top = repResults[0];
  const second = repResults[1];
  const gapPct = (CFG.thresholds.clearWinnerGapPercent ?? 10) / 100;
  const clearWinner = top.total > 0 && (!second || (top.total - second.total) / top.total > gapPct);
  console.log(`\n→ ASSIGNED: ${top.rep.name} (${top.rep.slug})  score=${top.total.toFixed(2)}`);
  console.log(`  Method  : ${clearWinner ? `algorithm (clear winner, >${(gapPct*100).toFixed(0)}% gap)` : `round-robin tiebreaker (gap < ${(gapPct*100).toFixed(0)}%)`}`);
  // Reason string — emulates buildReasonString in prod
  const factors = [
    { name: 'installProximity', score: top.ip.score * CFG.weights.installProximity, expl: top.ip.explanation },
    { name: 'contactProximity', score: top.cp.score * CFG.weights.contactProximity, expl: top.cp.explanation },
    { name: 'doorKnockRecency', score: top.dk.score * CFG.weights.doorKnockRecency, expl: top.dk.explanation },
  ].filter(f => f.score > 0).sort((a, b) => b.score - a.score);
  if (factors.length) {
    const bits = factors.slice(0, 2).map(f => `${f.name} ${f.score.toFixed(1)} (${f.expl})`);
    console.log(`  Reason  : ${top.rep.name}: ${bits.join(' + ')}`);
  } else {
    console.log(`  Reason  : ${top.rep.name}: no proximity hit — selected via tiebreaker`);
  }
  if (second) {
    console.log(`  Runner-up: ${second.rep.name} (${second.rep.slug}) score=${second.total.toFixed(2)}  gap=${((top.total - second.total) / top.total * 100).toFixed(1)}%`);
  }

  // Show the rep's nearest record specifically (sanity check) — use the same lenient matcher
  const repFullSlug = repSlug(top.rep.name);
  const repFirst = top.rep.name.split(' ')[0].toLowerCase();
  const repNearest = scored.filter(c =>
    c.salesRep === top.rep.slug ||
    c.salesRep === repFullSlug ||
    c.salesRepName === top.rep.name ||
    c.salesRepName?.toLowerCase().startsWith(repFirst + ' ')
  ).slice(0, 1)[0];
  if (repNearest) {
    console.log(`  ${top.rep.slug}'s nearest record: ${repNearest.name} at ${repNearest.distance.toFixed(2)}mi (${repNearest.type}, ${repNearest.jobStatus || '—'}, last=${repNearest.lastInteraction?.slice(0, 10) || '—'})`);
  } else {
    console.log(`  ${top.rep.slug} has 0 geo-tagged records in JN`);
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
