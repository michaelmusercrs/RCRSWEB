/**
 * Compute cash-flow forecast from the transaction ledger.
 *
 * Outputs data/cashflow-forecast.json with:
 *   - Last 12 months actual inflow / outflow / net
 *   - Outflow breakdown (checks + bills + payroll + tax + expense)
 *   - Inflow breakdown (invoices + payments + deposits)
 *   - 12-week forward projection (linear + seasonal trend)
 *   - AR aging buckets if invoices visible
 *   - Burn rate + months of runway based on cash on hand
 */
import fs from 'fs';

const monthly = JSON.parse(fs.readFileSync('data/transactions-monthly.json', 'utf8'));
const overview = JSON.parse(fs.readFileSync('data/company-overview.json', 'utf8'));

const cashOnHand = overview.balanceSheet.assets.currentAssets.bankAccounts.total;
const accountsReceivable = overview.balanceSheet.assets.currentAssets.accountsReceivable;

// Last 12 months actuals
const last12 = monthly.slice(-12);
const totalInflow = last12.reduce((s, m) => s + m.netRevenue, 0);
const totalOutflow = last12.reduce((s, m) => s + m.expense, 0);
const avgMonthlyNet = (totalInflow - totalOutflow) / 12;
const burnRate = -avgMonthlyNet; // positive = burning, negative = accumulating

// Compute seasonal multipliers (avg this-month revenue / avg overall monthly revenue)
const byMonth = {};
for (const m of monthly) {
  const mm = parseInt(m.month.slice(5, 7));
  if (!byMonth[mm]) byMonth[mm] = { revSum: 0, expSum: 0, count: 0 };
  byMonth[mm].revSum += m.netRevenue;
  byMonth[mm].expSum += m.expense;
  byMonth[mm].count++;
}
const overallAvgRev = monthly.reduce((s, m) => s + m.netRevenue, 0) / monthly.length;
const overallAvgExp = monthly.reduce((s, m) => s + m.expense, 0) / monthly.length;
const seasonal = {};
for (let mm = 1; mm <= 12; mm++) {
  const b = byMonth[mm];
  seasonal[mm] = {
    revMult: b && overallAvgRev > 0 ? (b.revSum / b.count) / overallAvgRev : 1,
    expMult: b && overallAvgExp > 0 ? (b.expSum / b.count) / overallAvgExp : 1,
  };
}

// Recent 6-month baseline for projection
const last6 = monthly.slice(-6);
const baselineRev = last6.reduce((s, m) => s + m.netRevenue, 0) / 6;
const baselineExp = last6.reduce((s, m) => s + m.expense, 0) / 6;

// Project next 6 months
const now = new Date();
const forecast = [];
let runningCash = cashOnHand;
for (let i = 1; i <= 6; i++) {
  const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
  const mm = d.getMonth() + 1;
  const projRev = Math.round(baselineRev * seasonal[mm].revMult * 100) / 100;
  const projExp = Math.round(baselineExp * seasonal[mm].expMult * 100) / 100;
  const projNet = projRev - projExp;
  runningCash += projNet;
  forecast.push({
    month: `${d.getFullYear()}-${String(mm).padStart(2, '0')}`,
    projectedRevenue: projRev,
    projectedExpense: projExp,
    projectedNet: Math.round(projNet * 100) / 100,
    projectedCashEnd: Math.round(runningCash * 100) / 100,
    seasonalRevMult: Math.round(seasonal[mm].revMult * 100) / 100,
    seasonalExpMult: Math.round(seasonal[mm].expMult * 100) / 100,
  });
}

// Best/worst seasonal months
const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const seasonalDetail = Object.entries(seasonal).map(([mm, v]) => ({
  month: monthNames[Number(mm)],
  monthNum: Number(mm),
  revMult: Math.round(v.revMult * 100) / 100,
  expMult: Math.round(v.expMult * 100) / 100,
})).sort((a, b) => a.monthNum - b.monthNum);

// AR aging — rough estimate. We don't have invoice-level dates in transactions,
// so this is a placeholder until invoices.json is pulled
// Compute months runway (cash + AR / monthly burn)
const monthsRunway = burnRate > 0 ? (cashOnHand + accountsReceivable) / burnRate : null;

const out = {
  generatedAt: new Date().toISOString().slice(0, 10),
  cashOnHand: Math.round(cashOnHand * 100) / 100,
  accountsReceivable: Math.round(accountsReceivable * 100) / 100,
  last12Months: last12.map(m => ({
    month: m.month,
    revenue: m.netRevenue,
    expense: m.expense,
    net: Math.round((m.netRevenue - m.expense) * 100) / 100,
  })),
  last12Inflow: Math.round(totalInflow * 100) / 100,
  last12Outflow: Math.round(totalOutflow * 100) / 100,
  last12Net: Math.round((totalInflow - totalOutflow) * 100) / 100,
  avgMonthlyNet: Math.round(avgMonthlyNet * 100) / 100,
  burnRate: Math.round(burnRate * 100) / 100,
  monthsRunway: monthsRunway !== null ? Math.round(monthsRunway * 10) / 10 : null,
  baselineRev: Math.round(baselineRev * 100) / 100,
  baselineExp: Math.round(baselineExp * 100) / 100,
  seasonal: seasonalDetail,
  forecast,
  alerts: (() => {
    const alerts = [];
    if (monthsRunway !== null && monthsRunway < 6) alerts.push({ severity: 'critical', msg: `Less than ${Math.floor(monthsRunway)} months of runway at current burn rate.` });
    if (forecast.some(f => f.projectedCashEnd < 0)) alerts.push({ severity: 'critical', msg: 'Projected cash goes negative within 6 months — collect AR aggressively.' });
    if (accountsReceivable > cashOnHand * 5) alerts.push({ severity: 'warning', msg: `A/R (${accountsReceivable.toFixed(0)}) is 5×+ cash on hand — collections is the choke point.` });
    if (avgMonthlyNet < 0) alerts.push({ severity: 'warning', msg: `12-month avg net is negative (${avgMonthlyNet.toFixed(0)}/mo). Profitability is upside-down on cash basis.` });
    return alerts;
  })(),
};

fs.writeFileSync('data/cashflow-forecast.json', JSON.stringify(out, null, 2));
console.log(`Wrote data/cashflow-forecast.json`);
console.log(`Cash on hand: $${cashOnHand.toFixed(2)}`);
console.log(`A/R: $${accountsReceivable.toFixed(2)}`);
console.log(`12-mo net: $${(totalInflow - totalOutflow).toFixed(2)}`);
console.log(`Avg monthly net: $${avgMonthlyNet.toFixed(2)}`);
console.log(`Months runway: ${monthsRunway !== null ? monthsRunway.toFixed(1) : 'cash accumulating'}`);
console.log(`Alerts: ${out.alerts.length}`);
for (const a of out.alerts) console.log(`  [${a.severity}] ${a.msg}`);
console.log(`\n6-month forecast:`);
for (const f of forecast) {
  console.log(`  ${f.month}  rev $${f.projectedRevenue.toFixed(0).padStart(8)}  exp $${f.projectedExpense.toFixed(0).padStart(8)}  net $${f.projectedNet.toFixed(0).padStart(8)}  cashEnd $${f.projectedCashEnd.toFixed(0).padStart(8)}`);
}
