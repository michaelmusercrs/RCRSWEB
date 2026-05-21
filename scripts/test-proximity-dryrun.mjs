/**
 * In-memory proximity dry-run. Pulls JN contacts directly (no sheet write),
 * filters those with built-in geo, runs proximity against test addresses.
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
  console.error('Missing JOBNIMBUS_API_KEY');
  process.exit(1);
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function geocodeNominatim(address) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'RCRS-proximity-smoketest/1.0 (michael@rcrsal.com)' },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), displayName: data[0].display_name };
}

async function fetchJNPage(from, size) {
  const url = `${JN_URL}/contacts?from=${from}&size=${size}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${JN_KEY}` } });
  if (!res.ok) {
    throw new Error(`JN ${res.status} ${res.statusText} — ${await res.text()}`);
  }
  return res.json();
}

const TEST_ADDRESSES = [
  '1819 5th Ave N, Birmingham, AL 35203',
  '2828 University Blvd, Tuscaloosa, AL 35401',
  '320 Church St SW, Huntsville, AL 35801',
];

async function main() {
  console.log('=== Pulling JN contact pages (in-memory, no sheet writes) ===');
  const all = [];
  // Pull 5 pages of 100 to get a decent corpus
  for (let page = 0; page < 5; page++) {
    const from = page * 100;
    const data = await fetchJNPage(from, 100);
    const results = data.results || data.contacts || [];
    if (!results.length) break;
    all.push(...results);
    console.log(`  page ${page}: +${results.length} (total ${all.length})`);
    if (results.length < 100) break;
  }

  // JN actually returns geo.lon (not geo.lng) — accept either.
  const withGeo = all.filter(c => {
    const lat = c.geo?.lat;
    const lng = c.geo?.lng ?? c.geo?.lon;
    return typeof lat === 'number' && typeof lng === 'number';
  });
  console.log(`Total fetched: ${all.length}  |  with built-in geo: ${withGeo.length}`);

  if (!withGeo.length) {
    console.log('Sample raw record keys:', Object.keys(all[0] || {}).slice(0, 30));
    console.log('Sample geo field:', all[0]?.geo);
    return;
  }

  const contacts = withGeo.map(c => {
    const status = c.status_name || c.status || '';
    const sl = status.toLowerCase();
    let type = 'contact';
    if (sl.includes('complete') || sl.includes('closed')) type = 'install';
    else if (sl.includes('lead') || sl.includes('new')) type = 'lead';
    return {
      jnid: c.jnid,
      name: c.display_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown',
      address: [c.address_line1, c.city, c.state_text, c.zip].filter(Boolean).join(', '),
      lat: c.geo.lat,
      lng: c.geo.lng ?? c.geo.lon,
      type,
      salesRep: c.sales_rep_name || '',
      jobStatus: status,
      lastInteraction: c.date_status_change
        ? new Date(c.date_status_change * 1000).toISOString()
        : c.date_updated
          ? new Date(c.date_updated * 1000).toISOString()
          : '',
    };
  });

  for (const addr of TEST_ADDRESSES) {
    console.log(`\n=== Test: ${addr} ===`);
    await new Promise(r => setTimeout(r, 1200));
    const g = await geocodeNominatim(addr);
    if (!g) { console.log('  geocode failed'); continue; }
    console.log(`  -> ${g.lat.toFixed(5)}, ${g.lng.toFixed(5)}`);

    const scored = contacts
      .map(c => ({ ...c, distance: haversine(g.lat, g.lng, c.lat, c.lng) }))
      .sort((a, b) => a.distance - b.distance);

    const w1 = scored.filter(c => c.distance <= 1).length;
    const w5 = scored.filter(c => c.distance <= 5).length;
    const w10 = scored.filter(c => c.distance <= 10).length;
    console.log(`  Within 1mi: ${w1} | 5mi: ${w5} | 10mi: ${w10}  (sample of ${contacts.length})`);

    console.log('  Closest 3:');
    for (const c of scored.slice(0, 3)) {
      const date = c.lastInteraction ? c.lastInteraction.slice(0, 10) : '—';
      console.log(`   ${c.distance.toFixed(2)}mi | ${c.name} | rep=${c.salesRep || '—'} | type=${c.type} | status=${c.jobStatus || '—'} | last=${date}`);
    }
  }
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
