/**
 * scan-suspect-lf-quantities-2026-05-21.mjs
 *
 * Step 5 — sanity scan: for every SKU registered with `linearFeetPerUnit`
 * in lib/normalize-line-item-qty.ts, scan ALL non-voided master Tickets
 * for line items whose qty exceeds the sane threshold (default 50 for
 * Ridge Vent). REPORT suspects only — DO NOT auto-fix. Owner will review.
 *
 * Read-only. NO writes. NO emails.
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

// Mirror of INVENTORY_UOM_HINTS in lib/normalize-line-item-qty.ts. Kept as
// a static map here so the script is self-contained (.mjs imports of .ts
// require a build step). If you add new LF-based SKUs to the helper, mirror
// them here too.
const UOM_HINTS = {
  'INV-0005': { unitOfMeasure: 'stick', linearFeetPerUnit: 4, suspiciousQtyThreshold: 50, name: 'Ridge Vent 4LF' },
};
// Legacy ID aliases
UOM_HINTS['item-127'] = UOM_HINTS['INV-0005'];
UOM_HINTS['VENT-RIDGE-4'] = UOM_HINTS['INV-0005'];

function getHint(line) {
  if (line.productId && UOM_HINTS[line.productId]) return UOM_HINTS[line.productId];
  if (line.legacyId && UOM_HINTS[line.legacyId]) return UOM_HINTS[line.legacyId];
  if (line.productName && /ridge\s*vent/i.test(String(line.productName))) return UOM_HINTS['INV-0005'];
  return null;
}

const sheetsId = process.env.GOOGLE_SHEETS_ID || process.env.DELIVERY_SHEETS_ID;
const auth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim(),
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
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

const suspects = [];
let scannedRows = 0;
let scannedLines = 0;

// Known-fixed ticket IDs from the 2026-05-21 fix. Listed in the report
// purely so reviewers can see they were already resolved.
const KNOWN_FIXED = new Set(['TKT-R-10923', 'TKT-R-10993', 'TKT-R-10997', 'TKT-R-11223']);

for (const row of rows) {
  const ticketId = (row.get('ticketId') || '').trim();
  if (!ticketId) continue;
  const status = (row.get('status') || '').toLowerCase().trim();
  if (status === 'voided') continue;
  scannedRows++;
  const type = String(row.get('type') || row.get('ticketType') || '').toLowerCase().trim();
  const refNumber = (
    row.get('referenceNumber') || row.get('rNumber') || row.get('jobNumber') || row.get('R#') || row.get('jobId') || ''
  ).trim();
  const matsRaw = row.get('materialsJson') || '';
  if (!matsRaw) continue;
  let mats;
  try {
    mats = JSON.parse(matsRaw);
  } catch {
    continue;
  }
  if (!Array.isArray(mats)) continue;

  for (const line of mats) {
    scannedLines++;
    const hint = getHint(line);
    if (!hint) continue;
    if (!hint.suspiciousQtyThreshold) continue;
    const qty = Number(line.quantity ?? line.qty ?? 0);
    if (qty > hint.suspiciousQtyThreshold) {
      suspects.push({
        ticketId,
        status,
        type,
        referenceNumber: refNumber,
        productId: line.productId,
        productName: line.productName,
        qty,
        threshold: hint.suspiciousQtyThreshold,
        impliedSticks: Math.round(qty / hint.linearFeetPerUnit),
        ratioToThreshold: Math.round((qty / hint.suspiciousQtyThreshold) * 100) / 100,
        alreadyFixed: KNOWN_FIXED.has(ticketId),
      });
    }
  }
}

// Sort: not-yet-fixed first, then by qty desc
suspects.sort((a, b) => {
  if (a.alreadyFixed !== b.alreadyFixed) return a.alreadyFixed ? 1 : -1;
  return b.qty - a.qty;
});

console.log('\n=== Suspect LF quantities scan — 2026-05-21 ===\n');
console.log(`Scanned ${scannedRows} non-voided ticket rows / ${scannedLines} line items`);
console.log(`Found ${suspects.length} suspect line items (qty > threshold for LF-based SKU)`);
console.log('');
if (suspects.length === 0) {
  console.log('No suspects.');
} else {
  console.log('ticketId            type        productId   name              qty   threshold  → sticks   fixed?');
  console.log('-'.repeat(110));
  for (const s of suspects) {
    console.log(
      `${s.ticketId.padEnd(20)} ${(s.type || '').padEnd(10)} ${s.productId || '?'} ${(s.productName || '').padEnd(18).slice(0, 18)} ${String(s.qty).padStart(5)}   ${String(s.threshold).padStart(7)}  → ${String(s.impliedSticks).padStart(6)}    ${s.alreadyFixed ? 'YES' : 'NO'}`,
    );
  }
}

const outPath = path.join(process.cwd(), 'scripts', 'scan-suspect-lf-quantities-2026-05-21.json');
fs.writeFileSync(
  outPath,
  JSON.stringify(
    {
      scannedAt: new Date().toISOString(),
      scannedRows,
      scannedLines,
      uomHints: UOM_HINTS,
      knownFixedTickets: Array.from(KNOWN_FIXED),
      suspectCount: suspects.length,
      newSuspects: suspects.filter((s) => !s.alreadyFixed),
      previouslyFixed: suspects.filter((s) => s.alreadyFixed),
    },
    null,
    2,
  ),
);
console.log(`\nWrote ${outPath}`);
