/**
 * Quick sanity check: read the Geocoded_Contacts tab and report column coverage
 * + a few sample rows so we can eyeball that the new fields landed.
 */
import fs from 'fs';
import path from 'path';
import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';

const envPath = path.join(process.cwd(), '.env.local');
fs.readFileSync(envPath, 'utf8').split('\n').forEach(l => {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) { let v = m[2]; if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1); process.env[m[1]] = v; }
});

const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const doc = new GoogleSpreadsheet(
  process.env.GOOGLE_SHEETS_ID || process.env.GOOGLE_SHEET_ID || '1uMEdtHo3xMu2gs21p7dYAgYiPWuCZ3s4a8YU-gJZ31s',
  auth
);
await doc.loadInfo();
const sheet = doc.sheetsByTitle['Geocoded_Contacts'];
const rows = await sheet.getRows();
const headers = sheet.headerValues;

console.log(`Total rows: ${rows.length}`);
console.log(`Columns (${headers.length}): ${headers.join(', ')}`);

// Coverage per column (% non-empty)
const counts = Object.fromEntries(headers.map(h => [h, 0]));
for (const r of rows) {
  for (const h of headers) {
    const v = r.get(h);
    if (v != null && v !== '' && v !== 'false') counts[h]++;
  }
}

console.log(`\nColumn coverage (% non-empty / not "false"):`);
for (const h of headers) {
  const pct = ((counts[h] / rows.length) * 100).toFixed(1);
  console.log(`  ${pct.padStart(6)}%  ${h}`);
}

// Sample 3 random rows
console.log(`\n=== 3 sample rows ===`);
const samples = [rows[0], rows[Math.floor(rows.length / 2)], rows[rows.length - 1]];
for (const r of samples) {
  console.log(`\n-- ${r.get('name')} (${r.get('jnid')}) --`);
  for (const h of headers) {
    const v = r.get(h);
    if (v && v !== 'false') console.log(`  ${h}: ${String(v).slice(0, 80)}`);
  }
}
