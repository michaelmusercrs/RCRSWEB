import XLSX from 'xlsx';
const src = process.argv[2];
const wb = XLSX.readFile(src);
console.log('Sheets:', wb.SheetNames);
const sheet = wb.Sheets[wb.SheetNames[0]];
const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
const maxCols = Math.max(...raw.map(r => (r ? r.length : 0)));
console.log('Rows:', raw.length, 'maxCols:', maxCols);
console.log('Header row 4 (all cols):');
(raw[4]||[]).forEach((v, i) => console.log('  col', i, ':', String(v).slice(0,30)));

console.log('\nSample transaction row 6 (all cols):');
(raw[6]||[]).forEach((v, i) => console.log('  col', i, ':', String(v).slice(0,40)));

// Find dates spanning years
const dates = [];
for (const r of raw) {
  if (!r) continue;
  for (let c = 0; c < (r.length||0); c++) {
    const v = r[c];
    if (typeof v === 'number' && v > 30000 && v < 60000) {
      const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
      dates.push(d.toISOString().slice(0,10));
      break;
    }
    if (typeof v === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v.trim())) {
      const [m,d,y] = v.trim().split('/');
      dates.push(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`);
      break;
    }
  }
}
const years = {};
dates.forEach(d => { const y = d.slice(0,4); years[y] = (years[y]||0)+1; });
console.log('\nDates by year:', JSON.stringify(years, null, 2));
console.log('Earliest:', dates.sort()[0], 'Latest:', dates.sort().slice(-1)[0]);
