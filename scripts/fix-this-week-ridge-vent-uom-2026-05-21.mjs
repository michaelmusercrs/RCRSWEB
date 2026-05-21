/**
 * fix-this-week-ridge-vent-uom-2026-05-21.mjs
 *
 * Owner directive 2026-05-21. The material-order PDF parser accepted Ridge
 * Vent qty in LINEAR FEET on four tickets this week. Each value is 4× the
 * intended stick count (the Ridge Vent 4LF SKU is stocked by stick; each
 * stick = 4 LF).
 *
 * Target tickets:
 *   TKT-R-10923 (Chuck)    Ridge Vent qty=88  → 22 sticks
 *   TKT-R-10993 (Joy)      Ridge Vent qty=88  → 22 sticks
 *   TKT-R-10997 (Leanna)   Ridge Vent qty=48  → 12 sticks
 *   TKT-R-11223 (Brenda)   Ridge Vent qty=40  → 10 sticks
 *
 * For each row:
 *   - Parse materialsJson
 *   - Find Ridge Vent line items (productId === 'INV-0005' OR productName
 *     contains 'Ridge Vent' OR legacyId === 'item-127')
 *   - Divide qty by 4 (round to nearest integer)
 *   - Append note: "; Ridge Vent qty corrected 2026-05-21: LF→sticks (÷4).
 *     Original entry was in linear feet."
 *
 * Idempotent — if a target ticket's Ridge Vent qty is already ≤ 30, skip it.
 *
 * NO emails / notifications / alerts. NO touching of Invoices,
 * Job_Breakdowns, CustomerBreakdowns, Inventory_Products, or Delivery
 * Schedule. Direct sheet writes to the Tickets tab only.
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

const TARGET_TICKET_IDS = [
  'TKT-R-10923',
  'TKT-R-10993',
  'TKT-R-10997',
  'TKT-R-11223',
];
const LF_PER_STICK = 4;
const ALREADY_FIXED_THRESHOLD = 30; // if qty ≤ 30, treat as already in stick units
const RIDGE_VENT_CORRECTION_NOTE =
  'Ridge Vent qty corrected 2026-05-21: LF→sticks (÷4). Original entry was in linear feet.';

function isRidgeVent(line) {
  if (!line) return false;
  if (line.productId === 'INV-0005') return true;
  if (line.legacyId === 'item-127') return true;
  if (line.productId === 'item-127') return true;
  if (line.productName && /ridge\s*vent/i.test(String(line.productName))) return true;
  return false;
}

const sheetsId = process.env.GOOGLE_SHEETS_ID || process.env.DELIVERY_SHEETS_ID;
const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim(),
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const doc = new GoogleSpreadsheet(sheetsId, auth);
await doc.loadInfo();

const sheet = doc.sheetsByTitle['Tickets'];
if (!sheet) {
  console.error('Tickets tab not found.');
  process.exit(1);
}
await sheet.loadHeaderRow();
const rows = await sheet.getRows();

const results = [];

for (const targetId of TARGET_TICKET_IDS) {
  const row = rows.find((r) => (r.get('ticketId') || '').trim() === targetId);
  if (!row) {
    results.push({ ticketId: targetId, status: 'not_found' });
    continue;
  }
  const status = (row.get('status') || '').toLowerCase().trim();
  if (status === 'voided') {
    results.push({ ticketId: targetId, status: 'skipped_voided' });
    continue;
  }
  const matsRaw = row.get('materialsJson') || '';
  let mats;
  try {
    mats = JSON.parse(matsRaw);
  } catch (e) {
    results.push({ ticketId: targetId, status: 'parse_failed', error: String(e) });
    continue;
  }
  if (!Array.isArray(mats)) {
    results.push({ ticketId: targetId, status: 'materialsJson_not_array' });
    continue;
  }

  let modifiedAny = false;
  const lineChanges = [];
  const updatedMats = mats.map((line) => {
    if (!isRidgeVent(line)) return line;
    const origQty = Number(line.quantity ?? line.qty ?? 0);
    if (origQty <= ALREADY_FIXED_THRESHOLD) {
      // Idempotent: already in stick units
      lineChanges.push({
        productName: line.productName,
        productId: line.productId,
        before: origQty,
        after: origQty,
        action: 'skipped_already_fixed',
      });
      return line;
    }
    const newQty = Math.round(origQty / LF_PER_STICK);
    const updated = { ...line };
    // Use whichever qty key the row actually has — keep both in sync if both present.
    if ('quantity' in line) updated.quantity = newQty;
    if ('qty' in line) updated.qty = newQty;
    // Recompute line totals if cost/price are present.
    const unitCost = Number(line.unitCost ?? 0);
    const unitPrice = Number(line.unitPrice ?? 0);
    if (unitCost) updated.totalCost = Math.round(unitCost * newQty * 100) / 100;
    if (unitPrice) updated.totalPrice = Math.round(unitPrice * newQty * 100) / 100;
    modifiedAny = true;
    lineChanges.push({
      productName: line.productName,
      productId: line.productId,
      before: origQty,
      after: newQty,
      action: 'divided_by_4',
    });
    return updated;
  });

  if (!modifiedAny) {
    results.push({
      ticketId: targetId,
      status: 'no_change_needed',
      lineChanges,
    });
    continue;
  }

  // Recompute totalCost/totalPrice on the row (sum of line totals where present).
  let newTotalCost = 0;
  let newTotalPrice = 0;
  for (const line of updatedMats) {
    if (typeof line.totalCost === 'number') newTotalCost += line.totalCost;
    if (typeof line.totalPrice === 'number') newTotalPrice += line.totalPrice;
  }

  // Append correction note. Idempotent: don't duplicate if already present.
  const existingNotes = (row.get('notes') || '').trim();
  const newNote = `; ${RIDGE_VENT_CORRECTION_NOTE}`;
  let updatedNotes;
  if (existingNotes.includes(RIDGE_VENT_CORRECTION_NOTE)) {
    updatedNotes = existingNotes;
  } else if (existingNotes) {
    updatedNotes = existingNotes + newNote;
  } else {
    updatedNotes = RIDGE_VENT_CORRECTION_NOTE;
  }

  row.set('materialsJson', JSON.stringify(updatedMats));
  row.set('notes', updatedNotes);
  // Only update totals if they were previously non-zero (avoid overwriting
  // intentional 0s from price-less return tickets etc.)
  if (newTotalCost > 0) row.set('totalCost', String(Math.round(newTotalCost * 100) / 100));
  if (newTotalPrice > 0) row.set('totalPrice', String(Math.round(newTotalPrice * 100) / 100));

  await row.save();

  results.push({
    ticketId: targetId,
    status: 'updated',
    lineChanges,
    notesAppended: !existingNotes.includes(RIDGE_VENT_CORRECTION_NOTE),
    newTotalCost: newTotalCost > 0 ? Math.round(newTotalCost * 100) / 100 : null,
    newTotalPrice: newTotalPrice > 0 ? Math.round(newTotalPrice * 100) / 100 : null,
  });
}

console.log('\n=== Ridge Vent UoM fix — 2026-05-21 ===\n');
for (const r of results) {
  console.log(`${r.ticketId}: ${r.status}`);
  if (r.lineChanges) {
    for (const lc of r.lineChanges) {
      console.log(
        `  - ${lc.productName || lc.productId}: ${lc.before} → ${lc.after} (${lc.action})`,
      );
    }
  }
  if (r.error) console.log(`  ERROR: ${r.error}`);
}

const outPath = path.join(
  process.cwd(),
  'scripts',
  'fix-this-week-ridge-vent-uom-2026-05-21.json',
);
fs.writeFileSync(
  outPath,
  JSON.stringify(
    {
      ranAt: new Date().toISOString(),
      targetTicketIds: TARGET_TICKET_IDS,
      lfPerStick: LF_PER_STICK,
      results,
    },
    null,
    2,
  ),
);
console.log(`\nWrote ${outPath}`);
