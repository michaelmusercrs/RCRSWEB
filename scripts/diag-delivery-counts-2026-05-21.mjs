/**
 * One-off diagnostic for delivery ticket distribution by ID prefix + status.
 * READ-ONLY.
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
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim(),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEETS_ID, auth);
await doc.loadInfo();
const t = doc.sheetsByTitle['Tickets'];
const rows = await t.getRows();

const groups = {
  TKT_LEGACY: { active: 0, voided: 0 },
  TKT_R: { active: 0, voided: 0 },
  TKT_only: { active: 0, voided: 0 },
  RESTOCK: { active: 0, voided: 0 },
  other: { active: 0, voided: 0 },
};
const activeTKTonly = [];
let activeUnitsTotal = 0;
const unitsByGroupActive = { TKT_LEGACY:0, TKT_R:0, TKT_only:0, RESTOCK:0, other:0 };
for (const r of rows) {
  const type = (r.get('ticketType') || '').toLowerCase().trim();
  if (type !== 'delivery') continue;
  const id = (r.get('ticketId') || '').toString();
  const status = (r.get('status') || '').toLowerCase().trim();
  const key = id.startsWith('TKT-LEGACY-')
    ? 'TKT_LEGACY'
    : id.startsWith('TKT-R-')
    ? 'TKT_R'
    : id.startsWith('TKT-')
    ? 'TKT_only'
    : id.startsWith('RESTOCK-')
    ? 'RESTOCK'
    : 'other';
  const slot = status === 'voided' ? 'voided' : 'active';
  groups[key][slot]++;
  if (slot === 'active') {
    let units = 0;
    try { for (const it of JSON.parse(r.get('materialsJson')||'[]')) units += Math.abs(Number(it.qty??0)); } catch {}
    unitsByGroupActive[key] += units;
  }
  if (status !== 'voided' && (key === 'TKT_only' || key === 'TKT_R')) {
    let units = 0;
    try {
      const arr = JSON.parse(r.get('materialsJson') || '[]');
      for (const it of arr) units += Math.abs(Number(it.qty ?? 0));
    } catch {}
    activeTKTonly.push({
      id,
      createdAt: r.get('createdAt'),
      createdBy: r.get('createdBy'),
      units,
    });
    activeUnitsTotal += units;
  }
}
console.log('Counts:', JSON.stringify(groups, null, 2));
console.log('Active units by group:', JSON.stringify(unitsByGroupActive, null, 2));

// Dup check
const idCount = {};
for (const r of rows) {
  const id = (r.get('ticketId') || '').toString();
  if (!id.startsWith('TKT-LEGACY-')) continue;
  idCount[id] = (idCount[id] || 0) + 1;
}
const dups = Object.entries(idCount).filter(([, c]) => c > 1);
console.log(`Duplicate TKT-LEGACY-* ticketIds: ${dups.length}`);
for (const [id, c] of dups.slice(0, 20)) console.log(`  ${id}: ${c} rows`);
console.log(`Distinct TKT-LEGACY-* ticketIds: ${Object.keys(idCount).length}`);
console.log(`Total TKT-LEGACY-* rows: ${Object.values(idCount).reduce((a,b)=>a+b,0)}`);
console.log('');
console.log(`Active TKT-* (non-LEGACY, non-R-) deliveries: ${activeTKTonly.length}`);
console.log(`  total units across them: ${activeUnitsTotal}`);
console.log(`  first 15:`);
for (const x of activeTKTonly.slice(0, 15)) {
  console.log(`    ${x.id}  createdAt=${x.createdAt}  createdBy=${x.createdBy}`);
}
