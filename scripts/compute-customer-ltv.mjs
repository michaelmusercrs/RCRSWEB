/**
 * Compute customer Lifetime Value from the transaction ledger.
 *
 *   - Per customer: total invoiced, # invoices, first/last invoice date,
 *     days as a customer, avg invoice, last-90-day activity
 *   - Repeat customer flag (2+ invoices)
 *   - Cohorts by first-invoice year
 *
 * Outputs data/customer-ltv.json (~1-2 MB depending on customer count).
 */
import fs from 'fs';

const transactions = JSON.parse(fs.readFileSync('data/transactions.json', 'utf8'));

const ISO = d => {
  if (!d) return '';
  // already ISO?
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d;
  return '';
};

const byCustomer = {};
for (const t of transactions) {
  if (t.type !== 'Invoice' && t.type !== 'Sales Receipt') continue;
  if (!t.customer) continue;
  const c = byCustomer[t.customer] = byCustomer[t.customer] || {
    customer: t.customer,
    total: 0,
    count: 0,
    firstDate: '',
    lastDate: '',
    dates: [],
    salesReps: new Set(),
  };
  c.total += Math.abs(t.amount || 0);
  c.count += 1;
  const d = ISO(t.date);
  if (d) c.dates.push(d);
  if (t.salesRep) c.salesReps.add(t.salesRep);
}

const today = new Date().toISOString().slice(0, 10);
const ninetyAgo = new Date(); ninetyAgo.setDate(ninetyAgo.getDate() - 90);
const ninetyAgoIso = ninetyAgo.toISOString().slice(0, 10);

const customers = Object.values(byCustomer).map(c => {
  const dates = c.dates.sort();
  const first = dates[0] || '';
  const last = dates[dates.length - 1] || '';
  const daysAsCustomer = first && last
    ? Math.round((new Date(last).getTime() - new Date(first).getTime()) / 86400000)
    : 0;
  const recentInvoices = dates.filter(d => d >= ninetyAgoIso).length;
  return {
    customer: c.customer,
    total: Math.round(c.total * 100) / 100,
    invoiceCount: c.count,
    firstDate: first,
    lastDate: last,
    daysAsCustomer,
    avgInvoice: c.count > 0 ? Math.round((c.total / c.count) * 100) / 100 : 0,
    recentInvoices,
    isRepeat: c.count >= 2,
    reps: [...c.salesReps].slice(0, 3),
  };
}).sort((a, b) => b.total - a.total);

const repeats = customers.filter(c => c.isRepeat);
const totalCustomers = customers.length;
const repeatCount = repeats.length;
const totalRevenue = customers.reduce((s, c) => s + c.total, 0);
const repeatRevenue = repeats.reduce((s, c) => s + c.total, 0);
const top10Pct = customers.slice(0, Math.floor(customers.length * 0.1));
const top10PctRevenue = top10Pct.reduce((s, c) => s + c.total, 0);

// Cohort by first-invoice year
const cohorts = {};
for (const c of customers) {
  const year = c.firstDate.slice(0, 4);
  if (!year) continue;
  if (!cohorts[year]) cohorts[year] = { year, customers: 0, totalRevenue: 0, repeatCount: 0 };
  cohorts[year].customers += 1;
  cohorts[year].totalRevenue += c.total;
  if (c.isRepeat) cohorts[year].repeatCount += 1;
}
const cohortRows = Object.values(cohorts).map(co => ({
  ...co,
  totalRevenue: Math.round(co.totalRevenue * 100) / 100,
  repeatRate: co.customers > 0 ? Math.round((co.repeatCount / co.customers) * 1000) / 10 : 0,
  avgPerCustomer: co.customers > 0 ? Math.round((co.totalRevenue / co.customers) * 100) / 100 : 0,
})).sort((a, b) => a.year.localeCompare(b.year));

const out = {
  generatedAt: today,
  totalCustomers,
  totalRevenue: Math.round(totalRevenue * 100) / 100,
  repeatCount,
  repeatRevenue: Math.round(repeatRevenue * 100) / 100,
  repeatRate: totalCustomers > 0 ? Math.round((repeatCount / totalCustomers) * 1000) / 10 : 0,
  top10PctRevenueShare: totalRevenue > 0 ? Math.round((top10PctRevenue / totalRevenue) * 1000) / 10 : 0,
  topCustomers: customers.slice(0, 100), // top 100 by lifetime — UI table sample
  repeatCustomers: repeats.slice(0, 100),
  recentBig: customers.filter(c => c.recentInvoices > 0).slice(0, 100),
  // Full per-customer rows — consumers like segmented-ltv need the whole
  // book, not just the top 100. ~3K customers × ~10 fields ≈ 3 MB.
  allCustomers: customers,
  cohorts: cohortRows,
};

fs.writeFileSync('data/customer-ltv.json', JSON.stringify(out, null, 2));
console.log(`Wrote data/customer-ltv.json`);
console.log(`Customers: ${totalCustomers} (${repeatCount} repeat, ${out.repeatRate}%)`);
console.log(`Total invoiced: $${totalRevenue.toFixed(2)}`);
console.log(`Repeat revenue: $${repeatRevenue.toFixed(2)} (${((repeatRevenue/totalRevenue)*100).toFixed(1)}% of total)`);
console.log(`Top 10% of customers = ${out.top10PctRevenueShare}% of revenue`);
console.log(`\nCohorts:`);
for (const c of cohortRows) {
  console.log(`  ${c.year}  ${c.customers} customers, ${c.repeatCount} repeats (${c.repeatRate}%), $${c.totalRevenue.toFixed(2)}, avg $${c.avgPerCustomer.toFixed(2)}/cust`);
}
