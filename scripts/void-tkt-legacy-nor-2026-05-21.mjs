/**
 * void-tkt-legacy-nor-2026-05-21.mjs
 *
 * Owner directive (2026-05-21):
 *   Empty-R# legacy inventory rows (109 negative-Amount rows, ~517 units total)
 *   were re-imported as master Tickets with ticketId starting `TKT-LEGACY-NOR-`.
 *   Owner identified these as duplicate/correction noise — same-day duplicate
 *   entries when PMs corrected pipe boot qty mistakes. The R#-tagged tickets
 *   already capture the true physical movement.
 *
 * What this script does:
 *   - Find every master Tickets row where ticketId starts `TKT-LEGACY-NOR-`
 *   - Set status='voided'
 *   - Append to notes: `; VOIDED 2026-05-21 — empty-R# legacy entries identified
 *     as duplicate/correction noise per owner. Not real physical movement.`
 *   - Save row-by-row
 *   - Idempotent: rows already voided are skipped
 *
 * NO emails, NO notifications, NO route handlers — direct r.save() only.
 */
import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env.local');
fs.readFileSync(envPath, 'utf8').split('\n').forEach((l) => {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) {
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
});

const { JWT } = await import('google-auth-library');
const { GoogleSpreadsheet } = await import('google-spreadsheet');

const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim(),
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const doc = new GoogleSpreadsheet(
  process.env.GOOGLE_SHEETS_ID || process.env.DELIVERY_SHEETS_ID,
  auth,
);
await doc.loadInfo();

const ticketsSheet = doc.sheetsByTitle['Tickets'];
if (!ticketsSheet) throw new Error('Tickets tab not found');
await ticketsSheet.loadHeaderRow();
const rows = await ticketsSheet.getRows();

const VOID_NOTE = '; VOIDED 2026-05-21 — empty-R# legacy entries identified as duplicate/correction noise per owner. Not real physical movement.';

let scanned = 0;
let matched = 0;
let alreadyVoided = 0;
let voided = 0;
const voidedIds = [];

for (const r of rows) {
  scanned++;
  const id = (r.get('ticketId') || '').trim();
  if (!id.startsWith('TKT-LEGACY-NOR-')) continue;
  matched++;
  const status = (r.get('status') || '').toLowerCase().trim();
  const existingNotes = r.get('notes') || '';
  if (status === 'voided' && existingNotes.includes('VOIDED 2026-05-21 — empty-R# legacy entries')) {
    alreadyVoided++;
    continue;
  }
  r.set('status', 'voided');
  const newNotes = existingNotes ? `${existingNotes}${VOID_NOTE}` : VOID_NOTE.replace(/^; /, '');
  r.set('notes', newNotes);
  await r.save();
  voided++;
  voidedIds.push(id);
}

console.log(`Scanned: ${scanned} rows`);
console.log(`Matched TKT-LEGACY-NOR-*: ${matched}`);
console.log(`Already voided (skipped): ${alreadyVoided}`);
console.log(`Newly voided this run: ${voided}`);

fs.writeFileSync(
  path.join(process.cwd(), 'scripts', 'void-tkt-legacy-nor-2026-05-21.json'),
  JSON.stringify({ scannedAt: new Date().toISOString(), scanned, matched, alreadyVoided, voided, voidedIds }, null, 2),
);
console.log('\nWrote scripts/void-tkt-legacy-nor-2026-05-21.json');
