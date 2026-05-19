/**
 * Targeted slow scan of master-sheet tabs likely to hold historical meeting
 * data. Sleeps between API calls to avoid 429s.
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

// Tabs most likely to hold meeting/historical data, in priority order.
// MondayNotes, NumberSessions, RepWeeklyNumbers most likely to be it.
const candidates = [
  'MondayNotes',
  'NumberSessions',
  'RepWeeklyNumbers',
  'MeetingNumbers_2026',
  'MeetingPrep',
  'Job_Breakdowns',
  'CustomerBreakdowns',
  'Gamification',
  'JN_Response_Times_2025',
  'JN_Response_Summary_2025',
];

const EPOCH = new Date(Date.UTC(1899, 11, 30));
function serialToIso(n) {
  if (typeof n !== 'number' || !isFinite(n)) return null;
  const d = new Date(EPOCH.getTime() + n * 86400000);
  return d.toISOString().slice(0, 10);
}

function dateOf(v) {
  if (typeof v === 'number' && v > 30000 && v < 60000) return serialToIso(v);
  const s = String(v || '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  return null;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

for (const tabName of candidates) {
  const sheet = doc.sheetsByTitle[tabName];
  if (!sheet) {
    console.log(`\n=== ${tabName} === (no such tab)`);
    continue;
  }
  console.log(`\n=== ${tabName} === (declared rows=${sheet.rowCount}, cols=${sheet.columnCount})`);

  // Throttle to stay under read quota
  await sleep(1500);

  try {
    // Cap range
    const maxRows = Math.min(sheet.rowCount, 600);
    const maxCols = Math.min(sheet.columnCount, 10);
    const colLetter = String.fromCharCode(64 + maxCols);
    await sheet.loadCells(`A1:${colLetter}${maxRows}`);
  } catch (err) {
    console.log(`  load failed: ${err.message.slice(0, 80)}`);
    continue;
  }

  // Print first 3 rows
  for (let r = 0; r < Math.min(3, sheet.rowCount); r++) {
    const vals = [];
    for (let c = 0; c < Math.min(sheet.columnCount, 8); c++) {
      vals.push(String(sheet.getCell(r, c).value || '').slice(0, 18));
    }
    console.log(`  [${r}]`, vals.map(v => v.padEnd(18)).join(' | '));
  }

  // Date span: scan col 0..3 for date-shaped values
  let earliest = null;
  let latest = null;
  let datedRows = 0;
  let nonEmpty = 0;
  for (let r = 0; r < Math.min(sheet.rowCount, 600); r++) {
    const a = sheet.getCell(r, 0).value;
    if (a != null && String(a).trim()) nonEmpty++;
    for (let c = 0; c < Math.min(sheet.columnCount, 4); c++) {
      const iso = dateOf(sheet.getCell(r, c).value);
      if (iso) {
        datedRows++;
        if (!earliest || iso < earliest) earliest = iso;
        if (!latest || iso > latest) latest = iso;
        break;
      }
    }
  }
  console.log(`  rows non-empty: ${nonEmpty}, dated: ${datedRows}, span: ${earliest || '—'} → ${latest || '—'}`);
}
