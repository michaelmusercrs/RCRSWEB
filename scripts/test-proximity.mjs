/**
 * Smoke test for the geo-tagged customer list + lead-distro proximity.
 * Pulls Geocoded_Contacts from the master sheet, geocodes a few test
 * addresses via Nominatim (free), prints closest 3 + counts within 1/5/10 mi.
 */
import fs from 'fs';
import path from 'path';
import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';

const envPath = path.join(process.cwd(), '.env.local');
fs.readFileSync(envPath, 'utf8').split('\n').forEach(l => {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) {
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
});

const MASTER_SHEET_ID =
  process.env.GOOGLE_SHEETS_ID ||
  process.env.GOOGLE_SHEET_ID ||
  '1uMEdtHo3xMu2gs21p7dYAgYiPWuCZ3s4a8YU-gJZ31s';
const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!email || !key) {
  console.error('Missing Google credentials in .env.local');
  process.exit(1);
}

const auth = new JWT({
  email,
  key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

// Haversine distance in miles
function haversine(lat1, lng1, lat2, lng2) {
  const R = 3958.8; // earth radius mi
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
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

const TEST_ADDRESSES = [
  '1819 5th Ave N, Birmingham, AL 35203',
  '2828 University Blvd, Tuscaloosa, AL 35401',
  '320 Church St SW, Huntsville, AL 35801',
];

async function main() {
  console.log('=== Loading Geocoded_Contacts from master sheet ===');
  const doc = new GoogleSpreadsheet(MASTER_SHEET_ID, auth);
  await doc.loadInfo();
  console.log(`Master sheet: "${doc.title}"`);

  const sheet = doc.sheetsByTitle['Geocoded_Contacts'];
  if (!sheet) {
    console.log('!! Geocoded_Contacts tab does NOT exist on the master sheet.');
    console.log('   Available tabs:', doc.sheetsByIndex.map(s => s.title).join(', '));
    process.exit(2);
  }

  const rows = await sheet.getRows();
  console.log(`Geocoded_Contacts row count: ${rows.length}`);

  if (rows.length === 0) {
    console.log('!! Sheet exists but is empty. Run POST /api/admin/populate-geocoded to backfill from JN.');
    process.exit(3);
  }

  const contacts = rows
    .map(r => ({
      jnid: r.get('jnid') || '',
      name: r.get('name') || '',
      address: r.get('address') || '',
      lat: parseFloat(r.get('lat') || ''),
      lng: parseFloat(r.get('lng') || ''),
      type: r.get('type') || '',
      salesRep: r.get('salesRep') || '',
      jobStatus: r.get('jobStatus') || '',
      lastInteraction: r.get('lastInteraction') || '',
    }))
    .filter(c => !Number.isNaN(c.lat) && !Number.isNaN(c.lng));

  console.log(`Valid lat/lng records: ${contacts.length}`);

  // Quick stats
  const byType = {};
  const byRep = {};
  for (const c of contacts) {
    byType[c.type || 'unknown'] = (byType[c.type || 'unknown'] || 0) + 1;
    if (c.salesRep) byRep[c.salesRep] = (byRep[c.salesRep] || 0) + 1;
  }
  console.log('By type:', byType);
  console.log('By rep (top 10):',
    Object.entries(byRep)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([r, n]) => `${r}=${n}`)
      .join(', ')
  );

  for (const addr of TEST_ADDRESSES) {
    console.log(`\n=== Test address: ${addr} ===`);
    await new Promise(r => setTimeout(r, 1200)); // Nominatim 1 req/sec
    const g = await geocodeNominatim(addr);
    if (!g) {
      console.log('  Geocode FAILED');
      continue;
    }
    console.log(`  -> ${g.lat.toFixed(5)}, ${g.lng.toFixed(5)}  (${g.displayName})`);

    const scored = contacts
      .map(c => ({ ...c, distance: haversine(g.lat, g.lng, c.lat, c.lng) }))
      .sort((a, b) => a.distance - b.distance);

    const within1 = scored.filter(c => c.distance <= 1).length;
    const within5 = scored.filter(c => c.distance <= 5).length;
    const within10 = scored.filter(c => c.distance <= 10).length;
    console.log(`  Within 1mi: ${within1} | 5mi: ${within5} | 10mi: ${within10}`);

    console.log('  Closest 3:');
    for (const c of scored.slice(0, 3)) {
      const date = c.lastInteraction ? c.lastInteraction.slice(0, 10) : '—';
      console.log(
        `   ${c.distance.toFixed(2)}mi | ${c.name || '(no name)'} | rep=${c.salesRep || '—'} | type=${c.type || '—'} | status=${c.jobStatus || '—'} | last=${date}`
      );
    }
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
