/**
 * Year-over-year comparison from data/transactions-monthly.json.
 * For each calendar month, lines up the same month across every
 * year in the dataset, computes YoY deltas, and surfaces YTD pace
 * vs same period in prior years.
 */
import { promises as fs } from 'fs';
import path from 'path';

interface MonthlyTx {
  month: string;
  revenue: number;
  expense: number;
  invoiceCount: number;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface YoYResponse {
  generatedAt: string;
  yearsAvailable: string[];
  currentYear: string;
  monthsCompleted: number;
  monthlyGrid: Array<{
    monthNum: number;
    monthName: string;
    byYear: Record<string, { revenue: number; expense: number; net: number; invoices: number }>;
  }>;
  ytdComparison: Array<{
    year: string;
    revenueThroughMonth: number;
    expenseThroughMonth: number;
    netThroughMonth: number;
    invoicesThroughMonth: number;
  }>;
  paceVsLastYear: {
    revenue: number;            // % delta vs same period prior year
    expense: number;
    net: number;
    invoices: number;
  };
  bestMonthByYear: Array<{ year: string; bestMonth: string; revenue: number }>;
  worstMonthByYear: Array<{ year: string; worstMonth: string; revenue: number }>;
  growthYoY: Array<{ year: string; annualRevenue: number; pctVsPrior: number | null }>;
}

export async function getYoYCompare(): Promise<YoYResponse> {
  const txJson = await fs.readFile(path.join(process.cwd(), 'data', 'transactions-monthly.json'), 'utf8');
  const monthly: MonthlyTx[] = JSON.parse(txJson);
  // Apply sheet-driven corrections on the monthly array up front so every
  // downstream aggregation (YoY, growth, monthly grid) reflects the same
  // corrected numbers. See lib/data-corrections.ts.
  {
    const { applyMonthlyCorrections } = await import('./data-corrections');
    await applyMonthlyCorrections(monthly as unknown as Array<{ month: string; revenue?: number; expense?: number }>);
  }

  const allYears = new Set<string>();
  for (const m of monthly) allYears.add(m.month.slice(0, 4));
  const yearsAvailable = Array.from(allYears).sort();
  const today = new Date();
  const currentYear = today.getFullYear().toString();
  const currentMonth = today.getMonth() + 1; // 1-indexed
  // Months completed in the current year. If we're mid-month, the current
  // month is still incomplete; YTD comparison uses completed months only.
  const monthsCompleted = Math.max(0, currentMonth - 1);

  // Build month grid: for each calendar month 1..12, by year
  const grid = new Map<number, Record<string, { revenue: number; expense: number; net: number; invoices: number }>>();
  for (let m = 1; m <= 12; m++) grid.set(m, {});
  for (const tx of monthly) {
    const [y, mStr] = tx.month.split('-');
    const m = parseInt(mStr, 10);
    if (!grid.get(m)) continue;
    grid.get(m)![y] = {
      revenue: Math.round(tx.revenue || 0),
      expense: Math.round(tx.expense || 0),
      net: Math.round((tx.revenue || 0) - (tx.expense || 0)),
      invoices: tx.invoiceCount || 0,
    };
  }
  const monthlyGrid = Array.from(grid.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([monthNum, byYear]) => ({
      monthNum,
      monthName: MONTH_NAMES[monthNum - 1],
      byYear,
    }));

  // YTD comparison — sum first N months for each year, where N = monthsCompleted
  const ytdComparison = yearsAvailable.map(y => {
    let rev = 0, exp = 0, net = 0, inv = 0;
    for (let m = 1; m <= monthsCompleted; m++) {
      const monthKey = `${y}-${String(m).padStart(2, '0')}`;
      const tx = monthly.find(t => t.month === monthKey);
      if (!tx) continue;
      rev += tx.revenue || 0;
      exp += tx.expense || 0;
      net += (tx.revenue || 0) - (tx.expense || 0);
      inv += tx.invoiceCount || 0;
    }
    return {
      year: y,
      revenueThroughMonth: Math.round(rev),
      expenseThroughMonth: Math.round(exp),
      netThroughMonth: Math.round(net),
      invoicesThroughMonth: inv,
    };
  });

  // Pace vs last year (same period)
  const thisYear = ytdComparison.find(y => y.year === currentYear);
  const priorYear = ytdComparison.find(y => y.year === (parseInt(currentYear, 10) - 1).toString());
  const paceVsLastYear = {
    revenue: priorYear && priorYear.revenueThroughMonth > 0
      ? Math.round(((((thisYear?.revenueThroughMonth ?? 0) - priorYear.revenueThroughMonth) / priorYear.revenueThroughMonth) * 1000)) / 10
      : 0,
    expense: priorYear && priorYear.expenseThroughMonth > 0
      ? Math.round(((((thisYear?.expenseThroughMonth ?? 0) - priorYear.expenseThroughMonth) / priorYear.expenseThroughMonth) * 1000)) / 10
      : 0,
    net: priorYear && Math.abs(priorYear.netThroughMonth) > 0
      ? Math.round(((((thisYear?.netThroughMonth ?? 0) - priorYear.netThroughMonth) / Math.abs(priorYear.netThroughMonth)) * 1000)) / 10
      : 0,
    invoices: priorYear && priorYear.invoicesThroughMonth > 0
      ? Math.round(((((thisYear?.invoicesThroughMonth ?? 0) - priorYear.invoicesThroughMonth) / priorYear.invoicesThroughMonth) * 1000)) / 10
      : 0,
  };

  // Best + worst month per year
  const bestMonthByYear: Array<{ year: string; bestMonth: string; revenue: number }> = [];
  const worstMonthByYear: Array<{ year: string; worstMonth: string; revenue: number }> = [];
  for (const y of yearsAvailable) {
    const months = monthly.filter(t => t.month.startsWith(y + '-')).filter(t => (t.revenue || 0) > 0);
    if (!months.length) continue;
    const best = months.reduce((a, b) => (b.revenue || 0) > (a.revenue || 0) ? b : a);
    const worst = months.reduce((a, b) => (b.revenue || 0) < (a.revenue || 0) ? b : a);
    bestMonthByYear.push({ year: y, bestMonth: best.month, revenue: Math.round(best.revenue || 0) });
    worstMonthByYear.push({ year: y, worstMonth: worst.month, revenue: Math.round(worst.revenue || 0) });
  }

  // Annual revenue + YoY growth %
  const annualRevenue = new Map<string, number>();
  for (const tx of monthly) {
    const y = tx.month.slice(0, 4);
    annualRevenue.set(y, (annualRevenue.get(y) || 0) + (tx.revenue || 0));
  }
  const sortedYears = Array.from(annualRevenue.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const growthYoY = sortedYears.map(([y, rev], i) => {
    const prior = i > 0 ? sortedYears[i - 1][1] : 0;
    return {
      year: y,
      annualRevenue: Math.round(rev),
      pctVsPrior: prior > 0 ? Math.round(((rev - prior) / prior) * 1000) / 10 : null,
    };
  });

  return {
    generatedAt: new Date().toISOString().slice(0, 10),
    yearsAvailable,
    currentYear,
    monthsCompleted,
    monthlyGrid,
    ytdComparison,
    paceVsLastYear,
    bestMonthByYear,
    worstMonthByYear,
    growthYoY,
  };
}
