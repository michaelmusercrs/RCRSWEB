/**
 * Test: deriveScheduledDate must turn Special Instructions text into the
 * right Chicago-calendar delivery date, and fall back to the next business
 * day (Mon–Sat) when no date is present.
 *
 * Run: node --experimental-strip-types tests/delivery-date-parser.test.mjs
 * (imports the REAL function from lib/delivery-date-parser.ts)
 */
import { deriveScheduledDate } from '../lib/delivery-date-parser.ts';

let failed = 0;
function check(label, got, expected) {
  const ok = got === expected;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  expected=${expected}  got=${got}`);
}

// receivedAt instants are noon UTC = morning Chicago, so the Chicago calendar
// date equals the ISO date and the cases read naturally.
const WED_APR_1 = '2026-04-01T12:00:00.000Z';  // Wednesday
const SAT_APR_4 = '2026-04-04T12:00:00.000Z';  // Saturday
const MON_DEC_28 = '2026-12-28T12:00:00.000Z'; // Monday, late December

// ── Tier 1: explicit dates ─────────────────────────────────────────────────
{
  const r = deriveScheduledDate('Deliver by Monday 4/6', '', WED_APR_1);
  check('"Deliver by Monday 4/6" date', r.date, '2026-04-06');
  check('"Deliver by Monday 4/6" source', r.source, 'parsed');
}
check('"deliver on 4/10/2026"', deriveScheduledDate('deliver on 4/10/2026', '', WED_APR_1).date, '2026-04-10');
check('2-digit year "drop 4/10/26"', deriveScheduledDate('drop 4/10/26', '', WED_APR_1).date, '2026-04-10');
// Dec order for "1/5" must roll into NEXT year, not 11 months into the past.
check('Dec year-rollover "Deliver 1/5"', deriveScheduledDate('Deliver 1/5', '', MON_DEC_28).date, '2027-01-05');
// Fractions must never be read as dates.
check('fraction "3/4 plywood" ignored → default', deriveScheduledDate('include 3/4 plywood sheets', '', WED_APR_1).source, 'default');
check('inch fraction "1/2” boot" ignored → default', deriveScheduledDate('add one 1/2” boot', '', WED_APR_1).source, 'default');
// Anchored fraction line still finds the REAL date later in the text.
check('mixed line "3/4 plywood, deliver 4/9"', deriveScheduledDate('need 3/4 plywood, deliver 4/9', '', WED_APR_1).date, '2026-04-09');

// ── Tier 2: weekday only ───────────────────────────────────────────────────
check('"Deliver Friday" from Wed', deriveScheduledDate('Deliver Friday', '', WED_APR_1).date, '2026-04-03');
check('"Deliver Monday" from Sat', deriveScheduledDate('Deliver Monday', '', SAT_APR_4).date, '2026-04-06');
// Same weekday as receipt = today (fail-visible on the board, not hidden 7 days).
check('"Deliver Wednesday" ON Wed = today', deriveScheduledDate('Deliver Wednesday', '', WED_APR_1).date, '2026-04-01');
check('earliest weekday wins "Monday or Tuesday"', deriveScheduledDate('Deliver Monday or Tuesday', '', SAT_APR_4).date, '2026-04-06');

// ── Tier 3: relative ───────────────────────────────────────────────────────
check('"ASAP" = received day', deriveScheduledDate('ASAP please', '', WED_APR_1).date, '2026-04-01');
check('"today"', deriveScheduledDate('need it today', '', WED_APR_1).date, '2026-04-01');
check('"tomorrow" from Wed', deriveScheduledDate('deliver tomorrow', '', WED_APR_1).date, '2026-04-02');
// "next day" from Saturday skips Sunday.
check('"next day" from Sat → Mon', deriveScheduledDate('next day delivery', '', SAT_APR_4).date, '2026-04-06');

// ── Tier 4: default = next business day (Mon–Sat) ──────────────────────────
{
  const r = deriveScheduledDate('', '', WED_APR_1);
  check('no instructions from Wed → Thu', r.date, '2026-04-02');
  check('no instructions source', r.source, 'default');
}
// Saturday receipt: next business day is MONDAY (Sunday is not a working day).
check('Saturday receipt → Monday', deriveScheduledDate('', '', SAT_APR_4).date, '2026-04-06');
check('garbage text → default', deriveScheduledDate('call gate code 4482', '', WED_APR_1).source, 'default');
check('bad receivedAt still returns a date', /^\d{4}-\d{2}-\d{2}$/.test(deriveScheduledDate('', '', 'not-a-date').date), true);

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
