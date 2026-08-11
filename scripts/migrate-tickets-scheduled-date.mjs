/**
 * Inc-0 migration: append the delivery-schedule columns to the Tickets tab.
 *
 *   scheduledDate | scheduleSource | overdueAt
 *
 * WHY THIS MUST RUN BEFORE THE CODE DEPLOYS: getOrCreateSheet only writes a
 * header row when it CREATES a tab — it never appends columns to an existing
 * header. And google-spreadsheet v5 silently DROPS any row key that has no
 * matching header cell. So until these headers physically exist, every
 * scheduledDate the app writes would vanish without an error.
 *
 * Idempotent — headers already present → no-op. Existing columns are never
 * moved or renamed (new columns are appended at the end, matching the
 * TICKET_HEADERS order in lib/ticket-sheet-service.ts).
 *
 * DRY RUN by default. Run with --apply to write:
 *   node scripts/migrate-tickets-scheduled-date.mjs           # dry run
 *   node scripts/migrate-tickets-scheduled-date.mjs --apply   # writes headers
 */
import { config } from 'dotenv';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

config({ path: '.env.local', quiet: true });

const APPLY = process.argv.includes('--apply');
const NEW_HEADERS = ['scheduledDate', 'scheduleSource', 'overdueAt'];

const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID, auth);
await doc.loadInfo();

const sheet = doc.sheetsByTitle['Tickets'];
if (!sheet) {
  console.error('FATAL: Tickets tab not found');
  process.exit(1);
}

await sheet.loadHeaderRow();
const existing = sheet.headerValues || [];
console.log(`Tickets tab: ${existing.length} existing headers, columnCount=${sheet.columnCount}`);
console.log(`Current headers: ${existing.join(', ')}`);

const missing = NEW_HEADERS.filter(h => !existing.includes(h));
if (missing.length === 0) {
  console.log('All schedule headers already present — nothing to do.');
  process.exit(0);
}

const target = [...existing, ...missing];
console.log(`\nWill append: ${missing.join(', ')}`);
console.log(`Resulting header row (${target.length} cols): ${target.join(', ')}`);

if (!APPLY) {
  console.log('\nDRY RUN — no changes written. Re-run with --apply to migrate.');
  process.exit(0);
}

// The grid must physically have enough columns before setHeaderRow can fill them.
if (sheet.columnCount < target.length) {
  console.log(`Resizing grid ${sheet.columnCount} → ${target.length} columns…`);
  await sheet.resize({ rowCount: sheet.rowCount, columnCount: target.length });
}

await sheet.setHeaderRow(target);
console.log(`DONE — appended ${missing.length} header(s). Tickets tab now has ${target.length} columns.`);
