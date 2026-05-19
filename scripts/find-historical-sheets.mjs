/**
 * Find the source sheet(s) holding pre-2026 meeting numbers (2019-2025).
 * Strategy:
 *  1. Search Drive (via service account) for sheets with "MEETING NUMBERS"
 *     or year-based titles
 *  2. Also check master sheet for MeetingNumbers_* tabs
 *  3. Report sheet IDs + URLs so we can wire one into the sync
 */
import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';
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

const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
const masterId = process.env.GOOGLE_SHEETS_ID;

const auth = new JWT({
  email,
  key,
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets.readonly',
    'https://www.googleapis.com/auth/drive.readonly',
  ],
});

// Use the Drive REST API directly via fetch — googleapis isn't installed.
const driveToken = await auth.getAccessToken();
async function driveSearch(q) {
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&pageSize=50&fields=${encodeURIComponent('files(id,name,modifiedTime,owners(emailAddress))')}&corpora=allDrives&includeItemsFromAllDrives=true&supportsAllDrives=true`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${driveToken.token || driveToken}` } });
  if (!res.ok) {
    throw new Error(`Drive ${res.status}: ${await res.text()}`);
  }
  return (await res.json()).files || [];
}

console.log('Searching Drive for meeting-number-related sheets…');
const queries = [
  "mimeType='application/vnd.google-apps.spreadsheet' and name contains 'MEETING NUMBERS'",
  "mimeType='application/vnd.google-apps.spreadsheet' and name contains 'meeting numbers'",
  "mimeType='application/vnd.google-apps.spreadsheet' and name contains 'monday'",
  "mimeType='application/vnd.google-apps.spreadsheet' and name contains 'MONDAY'",
  "mimeType='application/vnd.google-apps.spreadsheet' and name contains '2025 MEETING'",
  "mimeType='application/vnd.google-apps.spreadsheet' and name contains 'RCRS' and name contains 'MEETING'",
  "mimeType='application/vnd.google-apps.spreadsheet' and name contains 'master'",
  "mimeType='application/vnd.google-apps.spreadsheet' and name contains 'sales'",
];

const seen = new Set();
for (const q of queries) {
  try {
    const files = await driveSearch(q);
    for (const f of files) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      const owner = f.owners?.[0]?.emailAddress || '—';
      console.log(`  ${f.id}  ${f.modifiedTime}  ${owner}  "${f.name}"`);
    }
  } catch (err) {
    console.log(`  (query failed: ${err.message})`);
  }
}

console.log('\nLooking at master sheet for MeetingNumbers_* tabs…');
try {
  const doc = new GoogleSpreadsheet(masterId, auth);
  await doc.loadInfo();
  const candidates = doc.sheetsByIndex.filter(s =>
    /^MeetingNumbers_|^MEETING|MondayMeeting|monday.*meeting/i.test(s.title),
  );
  for (const s of candidates) {
    console.log(`  [tab on master] "${s.title}" (rowCount=${s.rowCount})`);
  }
  if (candidates.length === 0) {
    console.log('  No matching tabs on master sheet.');
  }
} catch (err) {
  console.log('  master sheet probe failed:', err.message);
}

console.log('\nDone. Promising IDs above can be added to MONDAY_MEETING_HISTORICAL_SHEET_IDS in .env.local.');
