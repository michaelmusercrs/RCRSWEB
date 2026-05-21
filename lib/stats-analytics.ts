/**
 * Quick-fact stats. Composes the same source files as history-analytics
 * but surfaces top/bottom lists and "biggest ever" trivia rather than
 * time series.
 */
import { promises as fs } from 'fs';
import path from 'path';

interface MonthlyTx { month: string; revenue: number; expense: number; invoiceCount: number }
interface Commission { salesRep: string; date: string; amount: number; jobNumber?: string; customer?: string }
interface Review { name: string; salesRep?: string; date: string; rating: number; text: string }
interface LTV { customer: string; total: number; invoiceCount: number; firstDate: string; lastDate: string }

export interface StatsResponse {
  generatedAt: string;
  topMonthsByRevenue: Array<{ month: string; revenue: number; invoices: number; avgInvoice: number }>;
  topMonthsByProfit: Array<{ month: string; revenue: number; expense: number; net: number }>;
  worstMonthsByLoss: Array<{ month: string; revenue: number; expense: number; net: number }>;
  topYearsByRevenue: Array<{ year: string; revenue: number; expense: number; net: number; margin: number }>;
  topCommissionPayments: Array<{ date: string; amount: number; rep: string; customer: string; jobNumber?: string }>;
  topLifetimeReps: Array<{ rep: string; total: number; paymentCount: number; firstDate: string; lastDate: string }>;
  topCustomersLifetime: Array<{ customer: string; total: number; invoices: number; firstDate: string; lastDate: string }>;
  reviewMomentum: {
    bestSingleMonth: { month: string; count: number };
    last12moTotal: number;
    last24moTotal: number;
    fiveStarShare: number;
    avgRatingLifetime: number;
  };
  records: {
    biggestCommissionEver: { date: string; amount: number; rep: string; customer: string };
    biggestRevenueMonth: { month: string; revenue: number };
    biggestProfitMonth: { month: string; net: number };
    worstLossMonth: { month: string; net: number };
    longestTenureRep: { rep: string; years: number; firstDate: string; lastDate: string };
    highestPayingYear: { year: string; commissions: number };
  };
}

export async function getStats(): Promise<StatsResponse> {
  const [txJson, commJson, revJson, ltvJson] = await Promise.all([
    fs.readFile(path.join(process.cwd(), 'data', 'transactions-monthly.json'), 'utf8'),
    fs.readFile(path.join(process.cwd(), 'data', 'commissions.json'), 'utf8'),
    fs.readFile(path.join(process.cwd(), 'data', 'reviews-master.json'), 'utf8'),
    fs.readFile(path.join(process.cwd(), 'data', 'customer-ltv.json'), 'utf8').catch(() => '[]'),
  ]);
  const monthly: MonthlyTx[] = JSON.parse(txJson);
  {
    const { applyMonthlyCorrections } = await import('./data-corrections');
    await applyMonthlyCorrections(monthly as unknown as Array<{ month: string; revenue?: number; expense?: number }>);
  }
  const commissions: Commission[] = JSON.parse(commJson);
  const reviewsRaw = JSON.parse(revJson);
  const reviews: Review[] = reviewsRaw.reviews || [];
  let ltvRows: LTV[] = [];
  try {
    const parsed = JSON.parse(ltvJson);
    ltvRows = Array.isArray(parsed) ? parsed : (parsed.customers || parsed.topCustomers || []);
  } catch { /* ignore */ }

  // Top months by revenue
  const topMonthsByRevenue = [...monthly]
    .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
    .slice(0, 12)
    .map(m => ({
      month: m.month,
      revenue: Math.round(m.revenue || 0),
      invoices: m.invoiceCount || 0,
      avgInvoice: m.invoiceCount > 0 ? Math.round((m.revenue || 0) / m.invoiceCount) : 0,
    }));

  // Best profit months
  const monthsWithNet = monthly.map(m => ({ ...m, net: (m.revenue || 0) - (m.expense || 0) }));
  const topMonthsByProfit = [...monthsWithNet].sort((a, b) => b.net - a.net).slice(0, 10).map(m => ({
    month: m.month,
    revenue: Math.round(m.revenue || 0),
    expense: Math.round(m.expense || 0),
    net: Math.round(m.net),
  }));
  const worstMonthsByLoss = [...monthsWithNet].sort((a, b) => a.net - b.net).slice(0, 10).map(m => ({
    month: m.month,
    revenue: Math.round(m.revenue || 0),
    expense: Math.round(m.expense || 0),
    net: Math.round(m.net),
  }));

  // Top years
  const yearMap = new Map<string, { revenue: number; expense: number }>();
  for (const m of monthly) {
    const y = m.month.slice(0, 4);
    if (!yearMap.has(y)) yearMap.set(y, { revenue: 0, expense: 0 });
    const v = yearMap.get(y)!;
    v.revenue += m.revenue || 0;
    v.expense += m.expense || 0;
  }
  const topYearsByRevenue = Array.from(yearMap.entries())
    .map(([year, v]) => ({
      year,
      revenue: Math.round(v.revenue),
      expense: Math.round(v.expense),
      net: Math.round(v.revenue - v.expense),
      margin: v.revenue > 0 ? Math.round(((v.revenue - v.expense) / v.revenue) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // Top single commission payments
  const topCommissionPayments = [...commissions]
    .filter(c => c.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 15)
    .map(c => ({
      date: c.date || '',
      amount: Math.round(c.amount),
      rep: c.salesRep || '',
      customer: (c.customer || '').slice(0, 60),
      jobNumber: c.jobNumber,
    }));

  // Top lifetime reps by total commissions
  const repTotals = new Map<string, { total: number; count: number; dates: string[] }>();
  for (const c of commissions) {
    const rep = (c.salesRep || '').trim();
    if (!rep) continue;
    if (!repTotals.has(rep)) repTotals.set(rep, { total: 0, count: 0, dates: [] });
    const v = repTotals.get(rep)!;
    v.total += c.amount || 0;
    v.count++;
    if (c.date) v.dates.push(c.date);
  }
  const topLifetimeReps = Array.from(repTotals.entries())
    .map(([rep, v]) => {
      const sorted = v.dates.slice().sort();
      return {
        rep,
        total: Math.round(v.total),
        paymentCount: v.count,
        firstDate: sorted[0] || '',
        lastDate: sorted[sorted.length - 1] || '',
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);

  // Top customers by lifetime
  const topCustomersLifetime = ltvRows
    .sort((a, b) => (b.total || 0) - (a.total || 0))
    .slice(0, 15)
    .map(c => ({
      customer: c.customer,
      total: Math.round(c.total || 0),
      invoices: c.invoiceCount || 0,
      firstDate: c.firstDate || '',
      lastDate: c.lastDate || '',
    }));

  // Review momentum
  const reviewMonthMap = new Map<string, number>();
  for (const r of reviews) {
    const m = (r.date || '').slice(0, 7);
    if (!m) continue;
    reviewMonthMap.set(m, (reviewMonthMap.get(m) || 0) + 1);
  }
  const topReviewMonth = Array.from(reviewMonthMap.entries()).sort((a, b) => b[1] - a[1])[0] || ['', 0];
  const today = new Date();
  const cutoff12 = new Date(today); cutoff12.setMonth(cutoff12.getMonth() - 12);
  const cutoff24 = new Date(today); cutoff24.setMonth(cutoff24.getMonth() - 24);
  const last12mo = reviews.filter(r => r.date && new Date(r.date) >= cutoff12).length;
  const last24mo = reviews.filter(r => r.date && new Date(r.date) >= cutoff24).length;
  const fiveStar = reviews.filter(r => r.rating === 5).length;
  const avgRating = reviews.length > 0
    ? Math.round((reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length) * 100) / 100
    : 0;

  // Records (peak superlatives)
  const biggestComm = topCommissionPayments[0] || { date: '', amount: 0, rep: '', customer: '' };
  const biggestRev = topMonthsByRevenue[0] || { month: '', revenue: 0 };
  const biggestProfit = topMonthsByProfit[0] || { month: '', net: 0 };
  const worstLoss = worstMonthsByLoss[0] || { month: '', net: 0 };
  const longestTenure = Array.from(repTotals.entries())
    .map(([rep, v]) => {
      const sorted = v.dates.slice().sort();
      const first = sorted[0] || '';
      const last = sorted[sorted.length - 1] || '';
      const years = first && last ? Math.round(((new Date(last).getTime() - new Date(first).getTime()) / (365 * 86400 * 1000)) * 10) / 10 : 0;
      return { rep, years, firstDate: first, lastDate: last };
    })
    .filter(r => r.years > 0)
    .sort((a, b) => b.years - a.years)[0] || { rep: '', years: 0, firstDate: '', lastDate: '' };

  const yearComm = new Map<string, number>();
  for (const c of commissions) {
    if (!c.date) continue;
    const y = new Date(c.date).getFullYear().toString();
    yearComm.set(y, (yearComm.get(y) || 0) + (c.amount || 0));
  }
  const highestPayingYearEntry = Array.from(yearComm.entries()).sort((a, b) => b[1] - a[1])[0] || ['', 0];

  return {
    generatedAt: new Date().toISOString().slice(0, 10),
    topMonthsByRevenue,
    topMonthsByProfit,
    worstMonthsByLoss,
    topYearsByRevenue,
    topCommissionPayments,
    topLifetimeReps,
    topCustomersLifetime,
    reviewMomentum: {
      bestSingleMonth: { month: topReviewMonth[0] as string, count: topReviewMonth[1] as number },
      last12moTotal: last12mo,
      last24moTotal: last24mo,
      fiveStarShare: reviews.length > 0 ? Math.round((fiveStar / reviews.length) * 1000) / 10 : 0,
      avgRatingLifetime: avgRating,
    },
    records: {
      biggestCommissionEver: { date: biggestComm.date, amount: biggestComm.amount, rep: biggestComm.rep, customer: biggestComm.customer },
      biggestRevenueMonth: { month: biggestRev.month, revenue: biggestRev.revenue },
      biggestProfitMonth: { month: biggestProfit.month, net: biggestProfit.net },
      worstLossMonth: { month: worstLoss.month, net: worstLoss.net },
      longestTenureRep: longestTenure,
      highestPayingYear: { year: highestPayingYearEntry[0] as string, commissions: Math.round(highestPayingYearEntry[1] as number) },
    },
  };
}
