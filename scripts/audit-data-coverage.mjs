/**
 * Cross-check what's in the source Google Sheet vs our local JSON snapshots.
 * Reports: tab list, date range, gaps between source and snapshot.
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

const MEETING_SHEET_ID = '1tEbMVUrvrRIkptISumvIrcgUhSWN5X2ldYro9ADTXF0';
const MASTER_SHEET_ID = process.env.GOOGLE_SHEETS_ID;
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

async function listTabs(sheetId, label) {
  const doc = new GoogleSpreadsheet(sheetId, auth);
  await doc.loadInfo();
  const tabs = doc.sheetsByIndex.map(s => ({
    title: s.title,
    rows: s.rowCount,
  }));
  console.log(`\n=== ${label} (${sheetId}) ===`);
  console.log(`Total tabs: ${tabs.length}`);
  return tabs;
}

// Monday tab name pattern: M.DD.YYYY
function parseMondayTab(title) {
  const m = title.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const [, mo, da, yr] = m;
  return `${yr}-${mo.padStart(2, '0')}-${da.padStart(2, '0')}`;
}

console.log('Today:', new Date().toISOString().slice(0, 10));

// Monday meeting sheet
const meetingTabs = await listTabs(MEETING_SHEET_ID, 'Monday Meeting Numbers');
const mondayDates = meetingTabs
  .map(t => ({ title: t.title, date: parseMondayTab(t.title) }))
  .filter(t => t.date)
  .sort((a, b) => a.date.localeCompare(b.date));

console.log(`Monday-tab count: ${mondayDates.length}`);
if (mondayDates.length) {
  console.log(`  Earliest Monday tab: ${mondayDates[0].title} (${mondayDates[0].date})`);
  console.log(`  Latest Monday tab:   ${mondayDates[mondayDates.length - 1].title} (${mondayDates[mondayDates.length - 1].date})`);
}

// Group by year
const byYear = {};
for (const t of mondayDates) {
  const y = t.date.slice(0, 4);
  byYear[y] = (byYear[y] || 0) + 1;
}
console.log('  Tabs per year:', JSON.stringify(byYear));

// Non-Monday tabs (config / archives)
const nonMonday = meetingTabs.filter(t => !parseMondayTab(t.title));
console.log(`  Non-Monday tabs (${nonMonday.length}):`, nonMonday.slice(0, 12).map(t => t.title).join(', '));

// What's missing from local snapshot
const local2026 = JSON.parse(fs.readFileSync('data/meeting-numbers-2026.json', 'utf8'));
const localAll = JSON.parse(fs.readFileSync('data/meeting-numbers-all.json', 'utf8'));
const localDates = new Set(localAll.map(r => r.meetingDate).concat(local2026.map(r => r.meetingDate)));

const missingFromLocal = mondayDates.filter(t => !localDates.has(t.date));
console.log(`\n  Monday tabs in source but NOT in local JSON: ${missingFromLocal.length}`);
if (missingFromLocal.length <= 30) {
  missingFromLocal.forEach(t => console.log(`    - ${t.title}  (${t.date})`));
} else {
  console.log(`    (showing first 20):`);
  missingFromLocal.slice(0, 20).forEach(t => console.log(`    - ${t.title}  (${t.date})`));
  console.log(`    ... and ${missingFromLocal.length - 20} more`);
}

// Master sheet basics
if (MASTER_SHEET_ID) {
  const masterTabs = await listTabs(MASTER_SHEET_ID, 'Master RCRS Sheet');
  console.log('  Tab titles:', masterTabs.map(t => t.title).join(', '));

  // Commissions tab vs local snapshot
  const commTab = masterTabs.find(t => t.title.toLowerCase() === 'commissions');
  if (commTab) {
    const doc = new GoogleSpreadsheet(MASTER_SHEET_ID, auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle['Commissions'];
    const rows = await sheet.getRows();
    console.log(`\n  Commissions tab rows: ${rows.length}`);
    const dates = rows
      .map(r => r.get('date') || r.get('Date'))
      .filter(Boolean)
      .map(d => {
        const [mo, da, yr] = String(d).split('/');
        if (!yr) return null;
        return `${yr.padStart(4, '20')}-${mo.padStart(2, '0')}-${da.padStart(2, '0')}`;
      })
      .filter(Boolean)
      .sort();
    if (dates.length) {
      console.log(`    Earliest: ${dates[0]}`);
      console.log(`    Latest:   ${dates[dates.length - 1]}`);
    }
    const local = JSON.parse(fs.readFileSync('data/commissions.json', 'utf8'));
    console.log(`    Local snapshot rows: ${local.length}`);
    console.log(`    Source > local? ${rows.length > local.length ? 'YES — ' + (rows.length - local.length) + ' rows newer' : 'in sync or older'}`);
  } else {
    console.log('  (No Commissions tab found on master sheet)');
  }
}
