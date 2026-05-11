// One-shot: rebuild the source XLSX from the PDF numbers Michael delivered,
// then run bonus-tracker + bonus-dashboard to regenerate public/trip.html.
import XLSX from 'xlsx';

const data = {
  January: [
    ['Aaron', 75615.62],
    ['Rudy', 59571.48],
    ['Brendon', 17753.88],
    ['Greg', 22813.08],
    ['Hunter', 669.50],
  ],
  February: [
    ['Aaron', 40183.42],
    ['Rudy', 41589.28],
    ['Brendon', 5498.89],
    ['Greg', 6474.45],
    ['Hunter', 72481.15],
    ['Travis', 12120.52],
  ],
  March: [
    ['Aaron', 27534.49],
    ['Brendon', 16843.12],
    ['Greg', 177810.03],
    ['Hunter', 20408.64],
    ['Travis', 37074.81],
  ],
  April: [
    ['Aaron', 64724.28],
    ['Alijah', 125626.00],
    ['Brendon', 450.00],
    ['Greg', 261333.12],
    ['Hunter', 206600.68],
    ['Rick', 13035.97],
    ['Travis', 22999.46],
  ],
  May: [
    ['Aaron', 1150.00],
    ['Brendon', 1200.00],
    ['Greg', 73292.27],
    ['Hunter', 1447.00],
    ['Travis', 13129.62],
  ],
};

const wb = XLSX.utils.book_new();
for (const [month, rows] of Object.entries(data)) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, month);
}
const out = 'C:/Users/Michael/Downloads/2026 Sales Numbers by Month (3).xlsx';
XLSX.writeFile(wb, out);
console.log('Wrote', out);
