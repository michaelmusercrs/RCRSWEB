// Quick local test of the materials parser against the actual PDF text
// extracted by Apps Script (from R10997 / M-4330).

const SAMPLE = `River City Roofing Solutions, Inc. 3325 Central Pkwy
Decatur, AL 35603
(256) 274-8530
Job #R-10997 - Leanna Hooper. 1352 CR-1422
Cullman, AL 35058
M A T E R I A L O R D E R
Sales Representative
Greg Muse
(256) 221-1809
greg@rivercityroofingsolutions.com
Material Order # M-4330 Date 5/13/2026
Qty Cost
Materials
Item Description Unit of Measure
1 1/4 Coil Nails 2 boxes Box 2.00 64.90 Button Caps 1 bucket Bucke 1.00 29.15
Ridge Vent 12 pieces 48 ft.
LF 48.00 2.55
IKO StormShield Ice & Water 1 roll roll 1.00 114.22 Premium Synthetic Felt 2 rolls roll 2.00 79.86 Bullet Boot 3" (Black) 2x Pcs. 2.00 38.29 Sealant (Clear) 2 tubes Tubes 2.00 10.00 Zipper Boot 1x 1 1.00 48.00
Total Cost 699.87
S P E C I A L I N S T R U C T I O N S
Greg is salesman
Jesus is roofer
Deliver by Monday 5/18, Tuesday install `;

// Compile the parser TS on the fly using esbuild? simpler: just re-import.
// Use a relative import that Node can handle.
const url = new URL('../lib/material-order-email-parser.ts', import.meta.url);

// Can't directly import .ts in node. Inline the relevant logic for the test.
function parseDollar(s) {
  const cleaned = s.replace(/[$,]/g, '').trim();
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

const lines = SAMPLE.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

const MATERIAL_ORDER_RE = /Material\s*Order\s*#?\s*(M-?\d+)/i;
const TOTAL_RE = /Total\s*Cost\s*\$?([\d,]+\.\d{2})/i;

let startIdx = lines.findIndex(l => /^Materials?$/i.test(l.trim()));
if (startIdx < 0) startIdx = lines.findIndex(l => /\bItem\b/i.test(l) && /\bDescription\b/i.test(l));
if (startIdx < 0) startIdx = lines.findIndex(l => /^Qty\s+Cost\s*$/i.test(l.trim()));
if (startIdx < 0) startIdx = lines.findIndex(l => MATERIAL_ORDER_RE.test(l));

let endIdx = lines.findIndex((l, i) => i > startIdx && TOTAL_RE.test(l));
if (endIdx < 0) endIdx = lines.length;

console.log(`startIdx=${startIdx} (${lines[startIdx]})`);
console.log(`endIdx=${endIdx} (${lines[endIdx]})`);

const sectionText = lines
  .slice(startIdx + 1, endIdx)
  .filter(l => !/^(Item|Description|Unit of Measure|Materials?|Qty\s+Cost)\s*$/i.test(l.trim()))
  .join(' ')
  .replace(/\s+/g, ' ')
  .trim();

console.log('\nSection text to parse:');
console.log(`  "${sectionText}"\n`);

const cleaned = sectionText.replace(/^\s*Item\s+Description\s+Unit\s+of\s+Measure\s+/i, '');
const itemEndRe = /([\w.]{1,16})\s+([\d,]+(?:\.\d{1,2})?)\s+([\d,]+\.\d{1,2})(?=\s+[A-Z]|\s*$)/g;
let cursor = 0;
let match;
const materials = [];
while ((match = itemEndRe.exec(cleaned)) !== null) {
  const [whole, unit, qtyStr, costStr] = match;
  const matchStart = match.index;
  const head = cleaned.slice(cursor, matchStart).trim();
  cursor = matchStart + whole.length;
  if (!head) continue;
  materials.push({
    itemName: head,
    description: '',
    unit,
    quantity: parseDollar(qtyStr),
    unitCost: parseDollar(costStr),
  });
}

console.log(`Parsed ${materials.length} materials:`);
materials.forEach((m, i) =>
  console.log(`  ${i + 1}. "${m.itemName}" | desc="${m.description}" | unit=${m.unit} | qty=${m.quantity} | cost=$${m.unitCost}`)
);
