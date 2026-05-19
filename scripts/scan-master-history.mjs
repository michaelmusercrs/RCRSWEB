/**
 * Scan every tab on the master sheet for historical data:
 * - tabs with date columns reaching pre-2026
 * - tabs with names suggesting year/history/meeting
 * - tabs with high non-empty row counts
 */
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
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

const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID, auth);
await doc.loadInfo();

console.log(`Master sheet: ${doc.title}`);
console.log(`Tabs: ${doc.sheetsByIndex.length}\n`);

// Tabs we already know about, skip
const skip = new Set([
  'team-members-import', 'images', 'page-views', 'profile-views',
  'Inventory_Snapshot_2026-05-15_0200',
  'Inventory_Snapshot_2026-05-15_0221',
  'Inventory_Snapshot_2026-05-15_2007_historical_close',
  'Inventory_Snapshot_2026-05-15_2050_post_restock_recon',
  'blog-posts', 'Blog_Posts', 'Email Captures',
]);

// Excel serial date → ISO. Sheets uses 1899-12-30 epoch.
const EPOCH = new Date(Date.UTC(1899, 11, 30));
function serialToIso(n) {
  if (typeof n !== 'number' || !isFinite(n)) return null;
  const d = new Date(EPOCH.getTime() + n * 86400000);
  return d.toISOString().slice(0, 10);
}

function looksLikeDate(s) {
  if (typeof s === 'number') {
    if (s > 30000 && s < 60000) return serialToIso(s); // 1982 to 2064
    return null;
  }
  const str = String(s || '').trim();
  if (!str) return null;
  // YYYY-MM-DD
  let m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  // M/D/YYYY or MM/DD/YYYY
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  return null;
}

const results = [];

for (const sheet of doc.sheetsByIndex) {
  if (skip.has(sheet.title)) continue;
  // Restrict to row 1..200 to keep API calls cheap
  const maxRows = Math.min(sheet.rowCount, 1500);
  const maxCols = Math.min(sheet.columnCount, 10);
  try {
    await sheet.loadCells(`A1:${String.fromCharCode(64 + maxCols)}${maxRows}`);
  } catch (err) {
    console.log(`  [SKIP] ${sheet.title}: ${err.message.slice(0, 60)}`);
    continue;
  }

  // Scan column 0 + column 1 for date-shaped values; track earliest/latest
  let earliest = null;
  let latest = null;
  let nonEmpty = 0;
  let datedRows = 0;

  for (let r = 0; r < maxRows; r++) {
    for (let c = 0; c < Math.min(maxCols, 4); c++) {
      let val = sheet.getCell(r, c).value;
      const iso = looksLikeDate(val);
      if (iso) {
        datedRows++;
        if (!earliest || iso < earliest) earliest = iso;
        if (!latest || iso > latest) latest = iso;
        break; // one date per row is enough
      }
    }
    const v = sheet.getCell(r, 0).value;
    if (v != null && String(v).trim()) nonEmpty++;
  }

  results.push({
    title: sheet.title,
    nonEmpty,
    datedRows,
    earliest,
    latest,
  });
}

// Filter to interesting ones: has dates AND earliest is pre-2026
const historical = results
  .filter(r => r.datedRows > 5 && r.earliest && r.earliest < '2026-01-01')
  .sort((a, b) => (a.earliest || '').localeCompare(b.earliest || ''));

console.log('=== Tabs with dates reaching before 2026 ===');
console.log('tab'.padEnd(35), 'rows'.padStart(6), 'dated'.padStart(6), 'earliest'.padStart(12), 'latest'.padStart(12));
for (const r of historical) {
  console.log(
    r.title.padEnd(35),
    String(r.nonEmpty).padStart(6),
    String(r.datedRows).padStart(6),
    (r.earliest || '').padStart(12),
    (r.latest || '').padStart(12),
  );
}

// Also report tabs with lots of rows but no dates — might be meeting-style by-rep aggregates
const bigNoDates = results
  .filter(r => r.nonEmpty > 50 && r.datedRows === 0)
  .sort((a, b) => b.nonEmpty - a.nonEmpty);

console.log('\n=== High-volume tabs without obvious dates (could be by-rep aggregates) ===');
for (const r of bigNoDates.slice(0, 20)) {
  console.log(r.title.padEnd(35), String(r.nonEmpty).padStart(6));
}

console.log('\nDone.');
