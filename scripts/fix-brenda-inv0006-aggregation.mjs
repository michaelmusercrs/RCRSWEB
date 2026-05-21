/**
 * Spot-fix: aggregate Brenda Langham's INV-0006 line in Inventory_Deductions_Log
 *
 * The this-week fix script (fix-2026-05-21-this-week.mjs) deduped per
 * (ticketId, productName) BEFORE summing duplicate line items, so
 * TKT-R-11223 with 3 lines of "1 1/2 Black Bullet Boot" ended up with
 * qtyDelta=-1 in the log instead of -3.
 *
 * This patch finds that row, updates qtyDelta -1 -> -3 and adjusts
 * qtyBefore so qtyBefore + qtyDelta = qtyAfter remains consistent.
 *
 * Idempotent: if qtyDelta is already -3 (or != -1), skip.
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

const { JWT } = await import('google-auth-library');
const { GoogleSpreadsheet } = await import('google-spreadsheet');

const sheetsId = process.env.GOOGLE_SHEETS_ID || process.env.DELIVERY_SHEETS_ID;
const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim(),
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const doc = new GoogleSpreadsheet(sheetsId, auth);
await doc.loadInfo();

const sheet = doc.sheetsByTitle['Inventory_Deductions_Log'];
if (!sheet) {
  console.error('Inventory_Deductions_Log tab not found.');
  process.exit(1);
}
await sheet.loadHeaderRow();
const rows = await sheet.getRows();

const TARGET_TICKET = 'TKT-R-11223';
const TARGET_NAME_LOWER = '1 1/2 black bullet boot'; // matches log productName lowercase
const NEW_DELTA = -3;

const match = rows.find(r =>
  r.get('ticketId') === TARGET_TICKET &&
  (r.get('productName') || '').toLowerCase().includes('1 1/2') &&
  (r.get('productName') || '').toLowerCase().includes('bullet boot')
);

if (!match) {
  console.error(`No row found for ${TARGET_TICKET} + 1 1/2 Black Bullet Boot.`);
  process.exit(1);
}

const currentDelta = parseInt(match.get('qtyDelta'), 10);
const qtyAfter = parseInt(match.get('qtyAfter'), 10);

if (currentDelta === NEW_DELTA) {
  console.log(`Already at qtyDelta=${NEW_DELTA}; no change.`);
  process.exit(0);
}
if (currentDelta !== -1) {
  console.error(`Unexpected qtyDelta=${currentDelta}; expected -1. Aborting to be safe.`);
  process.exit(1);
}

const newBefore = qtyAfter + Math.abs(NEW_DELTA);
match.set('qtyDelta', String(NEW_DELTA));
match.set('qtyBefore', String(newBefore));
await match.save();

console.log(`Updated ${TARGET_TICKET} ${match.get('productName')}: qtyDelta -1 -> ${NEW_DELTA}, qtyBefore -> ${newBefore} (qtyAfter ${qtyAfter} unchanged)`);
