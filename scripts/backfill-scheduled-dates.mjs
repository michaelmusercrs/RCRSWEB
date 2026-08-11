/**
 * Inc-2 backfill: give every ACTIVE delivery ticket a scheduledDate.
 *
 * For each Tickets row in an active status with a blank scheduledDate,
 * derive the date from the ticket's notes (which carry the order's Special
 * Instructions) via the same deriveScheduledDate the webhook uses, and write
 * scheduledDate + scheduleSource. overdueAt is left blank — the overdue
 * sweep (stalled-tickets digest cron) does the flagging on its next run.
 *
 * Also prints a TRIAGE REPORT of active tickets older than 7 days grouped by
 * status — those are the rows the office should eyeball (stale zombies vs
 * genuinely scheduled-out work) after the backfill.
 *
 * REQUIRES the Inc-0 header migration to have run first
 * (scripts/migrate-tickets-scheduled-date.mjs --apply) — without the headers
 * the writes would silently vanish.
 *
 * DRY RUN by default. Run with --apply to write:
 *   node --experimental-strip-types scripts/backfill-scheduled-dates.mjs           # dry run
 *   node --experimental-strip-types scripts/backfill-scheduled-dates.mjs --apply   # writes
 * (--experimental-strip-types because it imports the real TS parser.)
 */
import { config } from 'dotenv';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { deriveScheduledDate, chicagoDateOf } from '../lib/delivery-date-parser.ts';

config({ path: '.env.local', quiet: true });

const APPLY = process.argv.includes('--apply');
const WRITE_PAUSE_MS = 1100; // ~54 writes/min, under the 60/min Sheets quota
const ACTIVE_STATUSES = new Set([
  'created', 'assigned', 'materials_pulled', 'load_verified', 'en_route', 'arrived',
]);

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
if (!sheet.headerValues.includes('scheduledDate')) {
  console.error('FATAL: scheduledDate header missing — run migrate-tickets-scheduled-date.mjs --apply first.');
  process.exit(1);
}

// v5 gotcha: getRows is bounded by the rowCount cached at loadInfo — always
// pass an explicit big limit so no trailing rows are missed.
const rows = await sheet.getRows({ limit: 100000 });
const active = rows.filter(r =>
  (r.get('ticketType') || 'delivery') === 'delivery' &&
  ACTIVE_STATUSES.has((r.get('status') || '').trim()),
);
console.log(`${rows.length} ticket rows, ${active.length} active deliveries.`);

const pause = () => new Promise(res => setTimeout(res, WRITE_PAUSE_MS));
const todo = active.filter(r => !(r.get('scheduledDate') || '').trim());
console.log(`${todo.length} active tickets have no scheduledDate.\n`);

let written = 0;
for (const r of todo) {
  const ticketId = r.get('ticketId');
  const createdAt = r.get('createdAt') || '';
  const notes = r.get('notes') || '';
  const { date, source, matchedText } = deriveScheduledDate(notes, '', createdAt);
  const label = `${ticketId}  ${r.get('status')}  created=${createdAt.slice(0, 10)}  → ${date} (${source}${matchedText ? `: "${matchedText}"` : ''})`;
  if (!APPLY) {
    console.log(`WOULD SET  ${label}`);
    continue;
  }
  r.set('scheduledDate', date);
  r.set('scheduleSource', source);
  await r.save();
  written++;
  console.log(`SET        ${label}`);
  await pause();
}

// ── Triage report: active tickets >7 days old, grouped by status ───────────
const today = chicagoDateOf(new Date());
const dayMs = 86_400_000;
const stale = active
  .map(r => {
    const createdMs = Date.parse(r.get('createdAt') || '');
    const ageDays = Number.isFinite(createdMs) ? Math.floor((Date.now() - createdMs) / dayMs) : -1;
    return { r, ageDays };
  })
  .filter(x => x.ageDays > 7)
  .sort((a, b) => b.ageDays - a.ageDays);

console.log(`\n════ TRIAGE: ${stale.length} active tickets older than 7 days (as of ${today}) ════`);
const byStatus = new Map();
for (const s of stale) {
  const st = (s.r.get('status') || '?').trim();
  if (!byStatus.has(st)) byStatus.set(st, []);
  byStatus.get(st).push(s);
}
for (const [status, list] of byStatus) {
  console.log(`\n── ${status} (${list.length}) ──`);
  for (const { r, ageDays } of list) {
    console.log(
      `  ${r.get('ticketId')}  ${ageDays}d old  ${r.get('referenceNumber') || '?'}  ` +
      `${(r.get('customerName') || '').slice(0, 30)}  sched=${r.get('scheduledDate') || '(blank)'}`,
    );
  }
}

console.log(APPLY
  ? `\nDONE — wrote scheduledDate on ${written} ticket(s).`
  : `\nDRY RUN — no changes written (${todo.length} pending). Re-run with --apply to write.`);
