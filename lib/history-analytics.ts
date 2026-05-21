/**
 * Historical revenue + commission analytics. All from local JSON files
 * (transactions-monthly.json, commissions.json, reviews-master.json).
 * No JN calls. Cheap to compute, safe to ship.
 */
import { promises as fs } from 'fs';
import path from 'path';

interface MonthlyTx {
  month: string;          // YYYY-MM
  revenue: number;
  revenueReversal: number;
  expense: number;
  accrualExpense: number;
  invoiceCount: number;
  expenseCount: number;
  netRevenue: number;
  netCashFlow: number;
}
interface Commission { salesRep: string; date: string; amount: number; jobNumber?: string; customer?: string }
interface Review { salesRep?: string; date: string; rating: number }

export interface HistoryResponse {
  generatedAt: string;
  byYear: Array<{
    year: string;
    revenue: number;
    expense: number;
    netCash: number;
    margin: number; // (rev - exp) / rev
    invoices: number;
    avgInvoice: number;
    commissions: number;
    commissionPayments: number;
    reviews: number;
    reviews5star: number;
  }>;
  byMonth: Array<{ month: string; revenue: number; expense: number; netCash: number; invoices: number; cumulativeRev: number }>;
  byQuarter: Array<{ quarter: string; revenue: number; expense: number; netCash: number; invoices: number }>;
  seasonality: {            // month-of-year breakdown
    months: Array<{ monthNum: number; monthName: string; avgRevenue: number; samples: number }>;
    bestMonth: { name: string; avg: number };
    worstMonth: { name: string; avg: number };
  };
  repHistory: Array<{
    rep: string;
    firstPayment: string;
    lastPayment: string;
    daysOnPayroll: number;
    yearsActive: number;
    totalCommissions: number;
    paymentCount: number;
    peakYear: string;
    peakYearTotal: number;
    isActive: boolean;
  }>;
  lifetime: {
    revenue: number;
    expense: number;
    netCash: number;
    margin: number;
    invoices: number;
    avgInvoice: number;
    commissionPayments: number;
    totalCommissions: number;
    firstMonth: string;
    lastMonth: string;
    monthsActive: number;
  };
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ACTIVE_REPS = new Set([
  'hunter rivers', 'aaron lussi', 'greg muse', 'brendon muse',
  'adam rudell', 'joseph dowd', 'rick', 'alijah coleman',
  'travis wages',
]);

export async function getHistoryAnalytics(): Promise<HistoryResponse> {
  const [txJson, commJson, revJson] = await Promise.all([
    fs.readFile(path.join(process.cwd(), 'data', 'transactions-monthly.json'), 'utf8'),
    fs.readFile(path.join(process.cwd(), 'data', 'commissions.json'), 'utf8'),
    fs.readFile(path.join(process.cwd(), 'data', 'reviews-master.json'), 'utf8'),
  ]);
  const monthlyTx: MonthlyTx[] = JSON.parse(txJson);
  const commissions: Commission[] = JSON.parse(commJson);
  const reviews: Review[] = JSON.parse(revJson).reviews;

  // by year (transactions)
  const yearMap = new Map<string, { revenue: number; expense: number; invoices: number }>();
  for (const m of monthlyTx) {
    const y = m.month.slice(0, 4);
    if (!yearMap.has(y)) yearMap.set(y, { revenue: 0, expense: 0, invoices: 0 });
    const v = yearMap.get(y)!;
    v.revenue += m.revenue || 0;
    v.expense += m.expense || 0;
    v.invoices += m.invoiceCount || 0;
  }

  // commissions by year
  const yearComm = new Map<string, { total: number; count: number }>();
  for (const c of commissions) {
    const y = c.date ? new Date(c.date).getFullYear().toString() : '';
    if (!y) continue;
    if (!yearComm.has(y)) yearComm.set(y, { total: 0, count: 0 });
    const v = yearComm.get(y)!;
    v.total += c.amount || 0;
    v.count++;
  }

  // reviews by year
  const yearRev = new Map<string, { count: number; fiveStar: number }>();
  for (const r of reviews) {
    const y = (r.date || '').slice(0, 4);
    if (!y) continue;
    if (!yearRev.has(y)) yearRev.set(y, { count: 0, fiveStar: 0 });
    const v = yearRev.get(y)!;
    v.count++;
    if (r.rating === 5) v.fiveStar++;
  }

  const byYear = Array.from(yearMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([year, v]) => {
      const c = yearComm.get(year) || { total: 0, count: 0 };
      const rv = yearRev.get(year) || { count: 0, fiveStar: 0 };
      return {
        year,
        revenue: Math.round(v.revenue),
        expense: Math.round(v.expense),
        netCash: Math.round(v.revenue - v.expense),
        margin: v.revenue > 0 ? Math.round(((v.revenue - v.expense) / v.revenue) * 1000) / 10 : 0,
        invoices: v.invoices,
        avgInvoice: v.invoices > 0 ? Math.round(v.revenue / v.invoices) : 0,
        commissions: Math.round(c.total),
        commissionPayments: c.count,
        reviews: rv.count,
        reviews5star: rv.fiveStar,
      };
    });

  // monthly with running total
  let cum = 0;
  const byMonth = monthlyTx
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(m => {
      cum += m.revenue || 0;
      return {
        month: m.month,
        revenue: Math.round(m.revenue || 0),
        expense: Math.round(m.expense || 0),
        netCash: Math.round((m.revenue || 0) - (m.expense || 0)),
        invoices: m.invoiceCount || 0,
        cumulativeRev: Math.round(cum),
      };
    });

  // by quarter
  const quarterMap = new Map<string, { revenue: number; expense: number; invoices: number }>();
  for (const m of monthlyTx) {
    const [year, monthStr] = m.month.split('-');
    const q = Math.ceil(parseInt(monthStr, 10) / 3);
    const key = `${year} Q${q}`;
    if (!quarterMap.has(key)) quarterMap.set(key, { revenue: 0, expense: 0, invoices: 0 });
    const v = quarterMap.get(key)!;
    v.revenue += m.revenue || 0;
    v.expense += m.expense || 0;
    v.invoices += m.invoiceCount || 0;
  }
  const byQuarter = Array.from(quarterMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([quarter, v]) => ({
      quarter,
      revenue: Math.round(v.revenue),
      expense: Math.round(v.expense),
      netCash: Math.round(v.revenue - v.expense),
      invoices: v.invoices,
    }));

  // seasonality
  const monthAgg = new Map<number, { total: number; count: number }>();
  for (const m of monthlyTx) {
    const [, monthStr] = m.month.split('-');
    const mn = parseInt(monthStr, 10);
    if (!monthAgg.has(mn)) monthAgg.set(mn, { total: 0, count: 0 });
    const v = monthAgg.get(mn)!;
    v.total += m.revenue || 0;
    v.count++;
  }
  const seasonalityMonths = Array.from(monthAgg.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([num, v]) => ({
      monthNum: num,
      monthName: MONTH_NAMES[num - 1] || String(num),
      avgRevenue: v.count > 0 ? Math.round(v.total / v.count) : 0,
      samples: v.count,
    }));
  const sortedByAvg = [...seasonalityMonths].sort((a, b) => b.avgRevenue - a.avgRevenue);
  const seasonality = {
    months: seasonalityMonths,
    bestMonth: sortedByAvg.length > 0
      ? { name: sortedByAvg[0].monthName, avg: sortedByAvg[0].avgRevenue }
      : { name: '', avg: 0 },
    worstMonth: sortedByAvg.length > 0
      ? { name: sortedByAvg[sortedByAvg.length - 1].monthName, avg: sortedByAvg[sortedByAvg.length - 1].avgRevenue }
      : { name: '', avg: 0 },
  };

  // rep history
  const repMap = new Map<string, { dates: string[]; total: number; byYear: Map<string, number>; count: number }>();
  for (const c of commissions) {
    const rep = (c.salesRep || '').trim();
    if (!rep) continue;
    if (!repMap.has(rep)) repMap.set(rep, { dates: [], total: 0, byYear: new Map(), count: 0 });
    const r = repMap.get(rep)!;
    if (c.date) r.dates.push(c.date);
    r.total += c.amount || 0;
    r.count++;
    if (c.date) {
      const y = new Date(c.date).getFullYear().toString();
      r.byYear.set(y, (r.byYear.get(y) || 0) + (c.amount || 0));
    }
  }
  const today = new Date();
  const repHistory = Array.from(repMap.entries())
    .map(([rep, d]) => {
      const sorted = d.dates.slice().sort();
      const first = sorted[0] || '';
      const last = sorted[sorted.length - 1] || '';
      const firstDate = first ? new Date(first) : null;
      const lastDate = last ? new Date(last) : null;
      const daysOnPayroll = firstDate && lastDate
        ? Math.floor((lastDate.getTime() - firstDate.getTime()) / 86400000)
        : 0;
      const peakEntry = Array.from(d.byYear.entries()).sort((a, b) => b[1] - a[1])[0] || ['', 0];
      const lc = rep.toLowerCase();
      const isActive = ACTIVE_REPS.has(lc) || Array.from(ACTIVE_REPS).some(a => lc.includes(a) || a.includes(lc));
      return {
        rep,
        firstPayment: first,
        lastPayment: last,
        daysOnPayroll,
        yearsActive: Math.round((daysOnPayroll / 365) * 10) / 10,
        totalCommissions: Math.round(d.total),
        paymentCount: d.count,
        peakYear: peakEntry[0] as string,
        peakYearTotal: Math.round(peakEntry[1] as number),
        isActive,
      };
    })
    .sort((a, b) => b.totalCommissions - a.totalCommissions);

  // lifetime
  const totRev = monthlyTx.reduce((s, m) => s + (m.revenue || 0), 0);
  const totExp = monthlyTx.reduce((s, m) => s + (m.expense || 0), 0);
  const totInv = monthlyTx.reduce((s, m) => s + (m.invoiceCount || 0), 0);
  const totCommissions = commissions.reduce((s, c) => s + (c.amount || 0), 0);
  const months = monthlyTx.map(m => m.month).sort();

  // Apply sheet-driven hand-corrections. A row in chrisview_corrections
  // for e.g. annual:2024:net = -280000 will replace the computed -869K
  // here, and the change flows through to every chart that consumes
  // byYear/byMonth from this lib.
  const { applyAnnualCorrections, applyMonthlyCorrections, getCorrection, lifetimeScope } = await import('./data-corrections');
  // Map to a shape applyAnnualCorrections recognizes (it expects `net` not `netCash`).
  const yearWithNet = byYear.map(y => ({ ...y, net: y.netCash }));
  await applyAnnualCorrections(yearWithNet);
  for (let i = 0; i < byYear.length; i++) {
    byYear[i].revenue = yearWithNet[i].revenue;
    byYear[i].expense = yearWithNet[i].expense;
    byYear[i].netCash = yearWithNet[i].net;
    // Recompute margin since revenue/expense may have been corrected.
    byYear[i].margin = byYear[i].revenue > 0 ? Math.round(((byYear[i].revenue - byYear[i].expense) / byYear[i].revenue) * 1000) / 10 : 0;
  }
  const monthWithNet = byMonth.map(m => ({ ...m, net: m.netCash }));
  await applyMonthlyCorrections(monthWithNet);
  for (let i = 0; i < byMonth.length; i++) {
    byMonth[i].revenue = monthWithNet[i].revenue;
    byMonth[i].expense = monthWithNet[i].expense;
    byMonth[i].netCash = monthWithNet[i].net;
  }
  // Lifetime overrides (rare but supported)
  const totRevCorr = await getCorrection(lifetimeScope('revenue'));
  const totExpCorr = await getCorrection(lifetimeScope('expense'));
  const finalTotRev = totRevCorr && Number.isFinite(parseFloat(totRevCorr.correctedValue)) ? parseFloat(totRevCorr.correctedValue) : totRev;
  const finalTotExp = totExpCorr && Number.isFinite(parseFloat(totExpCorr.correctedValue)) ? parseFloat(totExpCorr.correctedValue) : totExp;

  return {
    generatedAt: new Date().toISOString().slice(0, 10),
    byYear,
    byMonth,
    byQuarter,
    seasonality,
    repHistory,
    lifetime: {
      revenue: Math.round(finalTotRev),
      expense: Math.round(finalTotExp),
      netCash: Math.round(finalTotRev - finalTotExp),
      margin: finalTotRev > 0 ? Math.round(((finalTotRev - finalTotExp) / finalTotRev) * 1000) / 10 : 0,
      invoices: totInv,
      avgInvoice: totInv > 0 ? Math.round(finalTotRev / totInv) : 0,
      commissionPayments: commissions.length,
      totalCommissions: Math.round(totCommissions),
      firstMonth: months[0] || '',
      lastMonth: months[months.length - 1] || '',
      monthsActive: months.length,
    },
  };
}
