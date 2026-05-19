/**
 * Sync data/meeting-numbers-2026.json with ALL 2026 Monday tabs from the
 * source meeting sheet. Replaces the per-rep rows shape produced by the
 * portal's syncFromSheet() (lib/meeting-numbers-service.ts).
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

const sheetId = process.env.MONDAY_MEETING_SHEET_ID || '1tEbMVUrvrRIkptISumvIrcgUhSWN5X2ldYro9ADTXF0';
const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');

if (!email || !key) { console.error('Missing Google creds'); process.exit(1); }

function tabDate(t) {
  const m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const [, mo, d, y] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

const auth = new JWT({ email, key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
const doc = new GoogleSpreadsheet(sheetId, auth);
await doc.loadInfo();

const COLUMNS = ['Inspected', 'Damage', 'Signed', 'Repair', 'Gutter', '$$$$$', 'Approved', 'Goal', 'Referrals', 'Agents', 'Present', 'Home Show'];

const records = [];
const tabsProcessed = [];
const today = new Date().toISOString().slice(0, 10);

for (const sheet of doc.sheetsByIndex) {
  const date = tabDate(sheet.title);
  if (!date) continue;
  if (!date.startsWith('2026')) continue;
  if (date > today) continue; // skip future Mondays — empty templates

  await sheet.loadCells();
  // Find header row by scanning for "Inspected" in first 4 rows
  let headerRow = -1;
  let headerMap = {};
  for (let r = 0; r < Math.min(4, sheet.rowCount); r++) {
    for (let c = 0; c < Math.min(sheet.columnCount, 13); c++) {
      const v = String(sheet.getCell(r, c).value || '').trim();
      if (v.toLowerCase() === 'inspected') {
        headerRow = r;
        for (let cc = 0; cc < Math.min(sheet.columnCount, 13); cc++) {
          headerMap[String(sheet.getCell(r, cc).value || '').trim()] = cc;
        }
        break;
      }
    }
    if (headerRow >= 0) break;
  }
  if (headerRow < 0) {
    console.warn(`  [SKIP] ${sheet.title}: no header row found`);
    continue;
  }

  const repCol = 0;
  let tabRecords = 0;
  for (let r = headerRow + 1; r < sheet.rowCount; r++) {
    const repName = String(sheet.getCell(r, repCol).value || '').trim();
    if (!repName) continue;
    // Skip totals row
    if (/^total/i.test(repName)) continue;
    const rec = {
      meetingDate: date,
      tabName: sheet.title,
      repName,
    };
    let hasData = false;
    for (const col of COLUMNS) {
      const c = headerMap[col];
      if (c == null) {
        rec[col] = '';
        continue;
      }
      const cell = sheet.getCell(r, c);
      const v = cell.value;
      const s = v == null ? '' : String(v);
      rec[col] = s;
      if (s.trim()) hasData = true;
    }
    if (hasData) {
      records.push(rec);
      tabRecords++;
    }
  }
  tabsProcessed.push({ tab: sheet.title, date, records: tabRecords });
  console.log(`  ${sheet.title.padEnd(12)} ${date}  ${tabRecords} records`);
}

records.sort((a, b) => a.meetingDate.localeCompare(b.meetingDate) || a.repName.localeCompare(b.repName));

fs.writeFileSync('data/meeting-numbers-2026.json', JSON.stringify(records, null, 2));
console.log(`\nWrote ${records.length} records across ${tabsProcessed.length} Monday tabs to data/meeting-numbers-2026.json`);
console.log(`Date range: ${tabsProcessed[0]?.date} → ${tabsProcessed[tabsProcessed.length - 1]?.date}`);
