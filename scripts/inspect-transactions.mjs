import XLSX from 'xlsx';

const wb = XLSX.readFile(process.argv[2]);
const sheet = wb.Sheets[wb.SheetNames[0]];
const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

let headerRow = -1;
for (let r = 0; r < 20; r++) {
  if (String(raw[r]?.[0] || '').trim() === 'Transaction type') { headerRow = r; break; }
}

const types = {};
const accountTypes = {};
const reps = {};
const customers = {};
const vendors = {};
let totalAmount = 0;
let txCount = 0;

const EPOCH = new Date(Date.UTC(1899, 11, 30));
function dateOf(v) {
  if (typeof v === 'number' && v > 30000 && v < 100000) {
    const d = new Date(EPOCH.getTime() + v * 86400000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  }
  if (typeof v === 'string') {
    const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
  }
  return null;
}

for (let r = headerRow + 1; r < raw.length; r++) {
  const row = raw[r] || [];
  const date = dateOf(row[1]);
  if (!date) continue;
  if (date > '2026-05-19') continue; // skip future-dated
  txCount++;
  const amount = parseFloat(String(row[4] || '0').replace(/[$,]/g, '')) || 0;
  totalAmount += amount;
  const type = String(row[0] || '').trim();
  types[type] = (types[type] || 0) + 1;
  const acc = String(row[7] || '').trim();
  if (acc) accountTypes[acc] = (accountTypes[acc] || 0) + 1;
  const rep = String(row[12] || '').trim();
  if (rep) reps[rep] = (reps[rep] || 0) + 1;
  const cust = String(row[8] || '').trim();
  if (cust) customers[cust] = (customers[cust] || 0) + 1;
  const vend = String(row[10] || '').trim();
  if (vend) vendors[vend] = (vendors[vend] || 0) + 1;
}

console.log(`Past-dated transactions: ${txCount}`);
console.log(`Total amount: $${totalAmount.toFixed(2)}`);
console.log(`\nBy type:`); Object.entries(types).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k.padEnd(30)} ${v}`));
console.log(`\nBy account type:`); Object.entries(accountTypes).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k.padEnd(30)} ${v}`));
console.log(`\nBy sales rep (top 15):`); Object.entries(reps).sort((a,b)=>b[1]-a[1]).slice(0,15).forEach(([k,v]) => console.log(`  ${k.padEnd(30)} ${v}`));
console.log(`\nUnique customers: ${Object.keys(customers).length}`);
console.log(`Unique vendors: ${Object.keys(vendors).length}`);
