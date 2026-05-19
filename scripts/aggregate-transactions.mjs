/**
 * Read the QuickBooks Transaction List XLSX and roll it up into structured
 * JSON files the portal can consume. Produces:
 *
 *   data/transactions.json           — slim list (all rows, search-friendly)
 *   data/transactions-monthly.json   — per-month revenue / expense / net
 *   data/transactions-by-rep.json    — Invoice totals per sales rep
 *   data/transactions-by-customer.json — top customers by total invoiced
 *   data/transactions-by-vendor.json — top vendors by total spend
 *   data/transactions-meta.json      — generatedAt, source, counts, totals
 *
 * Filters out future-dated entries (anything > today's date).
 *
 * Revenue measure: sum of Invoice amounts minus Credit Memo amounts.
 * Expense measure: Expense + Check + Bill Payment (Check) + Payroll Check +
 *                  Tax Payment + Bill (when paid, but using Bill itself for
 *                  accrual view).
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import XLSX from 'xlsx';

const SOURCE = process.argv[2] || path.join(
  os.homedir(),
  'Downloads',
  'River City Roofing Solutions, Inc._Transaction List (1).xlsx',
);

if (!fs.existsSync(SOURCE)) {
  console.error('Source not found:', SOURCE);
  process.exit(1);
}

const TODAY = new Date().toISOString().slice(0, 10);
console.log(`Source: ${path.basename(SOURCE)}`);
console.log(`Today:  ${TODAY}\n`);

const EPOCH = new Date(Date.UTC(1899, 11, 30));
function dateOf(v) {
  if (typeof v === 'number' && v > 30000 && v < 100000) {
    const d = new Date(EPOCH.getTime() + v * 86400000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
  if (typeof v === 'string') {
    const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
  return null;
}

console.log('Reading XLSX…');
const wb = XLSX.readFile(SOURCE);
const sheet = wb.Sheets[wb.SheetNames[0]];
const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
console.log(`Loaded ${raw.length} rows from sheet.\n`);

let headerRow = -1;
for (let r = 0; r < 20; r++) {
  if (String(raw[r]?.[0] || '').trim() === 'Transaction type') { headerRow = r; break; }
}
if (headerRow < 0) { console.error('No header row found'); process.exit(1); }

const REVENUE_TYPES = new Set(['Invoice', 'Sales Receipt']);
const REVENUE_REVERSAL_TYPES = new Set(['Credit Memo']);
const EXPENSE_TYPES = new Set([
  'Expense', 'Check', 'Bill Payment (Check)', 'Payroll Check', 'Tax Payment',
]);
const ACCRUAL_EXPENSE_TYPES = new Set(['Bill']);
const SKIP_FROM_FLOWS = new Set([
  'Transfer', 'Journal Entry', 'Payroll Adjustment',
  'Inventory Starting Value', 'Inventory Qty Adjust', 'Payroll Refund',
  'Vendor Credit', 'Payment', 'Billable Expense Charge', 'Deposit',
]);

const tx = []; // slim list
const monthly = {}; // 'YYYY-MM' -> { revenue, expense, accrualExpense, ... }
const byRep = {};
const byCustomer = {};
const byVendor = {};

function bumpMonthly(month, key, amount) {
  if (!monthly[month]) {
    monthly[month] = {
      month, revenue: 0, revenueReversal: 0, expense: 0,
      accrualExpense: 0, invoiceCount: 0, expenseCount: 0,
    };
  }
  monthly[month][key] += amount;
}

for (let r = headerRow + 1; r < raw.length; r++) {
  const row = raw[r] || [];
  const date = dateOf(row[1]);
  if (!date) continue;
  if (date > TODAY) continue;

  const type = String(row[0] || '').trim();
  const num = String(row[2] || '').trim();
  const posting = String(row[3] || '').trim();
  const amount = parseFloat(String(row[4] || '0').replace(/[$,]/g, '')) || 0;
  const accountType = String(row[7] || '').trim();
  const customer = String(row[8] || '').trim();
  const employee = String(row[9] || '').trim();
  const vendor = String(row[10] || '').trim();
  const project = String(row[11] || '').trim();
  const salesRep = String(row[12] || '').trim();

  tx.push({
    date, type, num, amount,
    accountType, customer, vendor, salesRep,
    posting: posting === 'Yes',
    ...(employee ? { employee } : {}),
    ...(project ? { project } : {}),
  });

  const month = date.slice(0, 7);
  if (REVENUE_TYPES.has(type)) {
    const abs = Math.abs(amount);
    bumpMonthly(month, 'revenue', abs);
    monthly[month].invoiceCount += 1;
    if (salesRep) {
      byRep[salesRep] = byRep[salesRep] || { rep: salesRep, invoiceTotal: 0, invoiceCount: 0 };
      byRep[salesRep].invoiceTotal += abs;
      byRep[salesRep].invoiceCount += 1;
    }
    if (customer) {
      byCustomer[customer] = byCustomer[customer] || { customer, total: 0, invoiceCount: 0 };
      byCustomer[customer].total += abs;
      byCustomer[customer].invoiceCount += 1;
    }
  } else if (REVENUE_REVERSAL_TYPES.has(type)) {
    bumpMonthly(month, 'revenueReversal', Math.abs(amount));
  } else if (EXPENSE_TYPES.has(type)) {
    bumpMonthly(month, 'expense', Math.abs(amount));
    monthly[month].expenseCount += 1;
    if (vendor) {
      byVendor[vendor] = byVendor[vendor] || { vendor, total: 0, txCount: 0 };
      byVendor[vendor].total += Math.abs(amount);
      byVendor[vendor].txCount += 1;
    }
  } else if (ACCRUAL_EXPENSE_TYPES.has(type)) {
    bumpMonthly(month, 'accrualExpense', Math.abs(amount));
    if (vendor) {
      byVendor[vendor] = byVendor[vendor] || { vendor, total: 0, txCount: 0 };
      byVendor[vendor].total += Math.abs(amount);
      byVendor[vendor].txCount += 1;
    }
  }
  // SKIP_FROM_FLOWS: included in slim list but not in monthly aggregates
}

// Sort + finalize
tx.sort((a, b) => b.date.localeCompare(a.date) || a.type.localeCompare(b.type));

const monthlyArr = Object.values(monthly).sort((a, b) => a.month.localeCompare(b.month));
for (const m of monthlyArr) {
  m.netRevenue = Math.round((m.revenue - m.revenueReversal) * 100) / 100;
  m.netCashFlow = Math.round((m.netRevenue - m.expense) * 100) / 100;
  m.revenue = Math.round(m.revenue * 100) / 100;
  m.revenueReversal = Math.round(m.revenueReversal * 100) / 100;
  m.expense = Math.round(m.expense * 100) / 100;
  m.accrualExpense = Math.round(m.accrualExpense * 100) / 100;
}

const repArr = Object.values(byRep)
  .sort((a, b) => b.invoiceTotal - a.invoiceTotal)
  .map(r => ({ ...r, invoiceTotal: Math.round(r.invoiceTotal * 100) / 100 }));

const customerArr = Object.values(byCustomer)
  .sort((a, b) => b.total - a.total)
  .slice(0, 200)
  .map(c => ({ ...c, total: Math.round(c.total * 100) / 100 }));

const vendorArr = Object.values(byVendor)
  .sort((a, b) => b.total - a.total)
  .slice(0, 200)
  .map(v => ({ ...v, total: Math.round(v.total * 100) / 100 }));

const meta = {
  generatedAt: new Date().toISOString().slice(0, 10),
  source: path.basename(SOURCE),
  totalTransactions: tx.length,
  dateRange: { earliest: tx[tx.length - 1]?.date, latest: tx[0]?.date },
  monthsCovered: monthlyArr.length,
  lifetimeRevenue: monthlyArr.reduce((s, m) => s + m.netRevenue, 0),
  lifetimeExpense: monthlyArr.reduce((s, m) => s + m.expense, 0),
  uniqueReps: repArr.length,
  uniqueCustomersTop200: customerArr.length,
  uniqueVendorsTop200: vendorArr.length,
};
meta.lifetimeRevenue = Math.round(meta.lifetimeRevenue * 100) / 100;
meta.lifetimeExpense = Math.round(meta.lifetimeExpense * 100) / 100;

// Write
fs.writeFileSync('data/transactions.json', JSON.stringify(tx));
fs.writeFileSync('data/transactions-monthly.json', JSON.stringify(monthlyArr, null, 2));
fs.writeFileSync('data/transactions-by-rep.json', JSON.stringify(repArr, null, 2));
fs.writeFileSync('data/transactions-by-customer.json', JSON.stringify(customerArr, null, 2));
fs.writeFileSync('data/transactions-by-vendor.json', JSON.stringify(vendorArr, null, 2));
fs.writeFileSync('data/transactions-meta.json', JSON.stringify(meta, null, 2));

const txMb = (fs.statSync('data/transactions.json').size / 1024 / 1024).toFixed(2);

console.log('Wrote:');
console.log(`  data/transactions.json            (${tx.length} rows, ${txMb} MB)`);
console.log(`  data/transactions-monthly.json    (${monthlyArr.length} months)`);
console.log(`  data/transactions-by-rep.json     (${repArr.length} reps)`);
console.log(`  data/transactions-by-customer.json (top ${customerArr.length})`);
console.log(`  data/transactions-by-vendor.json  (top ${vendorArr.length})`);
console.log(`  data/transactions-meta.json`);
console.log('\nMeta:');
console.log(JSON.stringify(meta, null, 2));

console.log('\nLast 6 months:');
monthlyArr.slice(-6).forEach(m =>
  console.log(`  ${m.month}  rev $${m.netRevenue.toFixed(2).padStart(12)}  exp $${m.expense.toFixed(2).padStart(12)}  net $${m.netCashFlow.toFixed(2).padStart(12)}  (${m.invoiceCount} inv)`),
);
