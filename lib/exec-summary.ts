/**
 * Executive summary — headline numbers from every data source on one page.
 * Designed for screenshot-sharing: every KPI on one screen, no scrolling
 * required at desktop width.
 */
import { promises as fs } from 'fs';
import path from 'path';

interface MonthlyTx { month: string; revenue: number; expense: number; invoiceCount: number }
interface Commission { salesRep: string; date: string; amount: number; customer?: string }
interface Review { salesRep?: string; date: string; rating: number }

export interface ExecSummaryResponse {
  generatedAt: string;
  asOf: string;
  lifetime: { revenue: number; expense: number; netCash: number; margin: number; invoices: number; avgInvoice: number; customers: number };
  ytd: { revenue: number; expense: number; netCash: number; margin: number; invoices: number; vsPriorYearPct: number | null; monthsCompleted: number };
  last12mo: { revenue: number; expense: number; netCash: number; commissionsPaid: number; reviews: number; fiveStarReviews: number; avgRating: number | null };
  records: {
    bestMonth: { month: string; revenue: number };
    bestYear: { year: string; revenue: number };
    worstLossMonth: { month: string; net: number };
    biggestCommission: { date: string; amount: number; rep: string; customer: string };
    longestTenureRep: { rep: string; years: number };
    topCustomerLifetime: { customer: string; total: number };
  };
  reps: {
    activeCount: number;
    top5Last12mo: Array<{ rep: string; commissions: number }>;
  };
  reviews: { total: number; fiveStarPct: number; avgRating: number; bestSingleMonth: { month: string; count: number } };
}

export async function getExecSummary(): Promise<ExecSummaryResponse> {
  const [txJson, commJson, revJson, ltvJson] = await Promise.all([
    fs.readFile(path.join(process.cwd(), 'data', 'transactions-monthly.json'), 'utf8'),
    fs.readFile(path.join(process.cwd(), 'data', 'commissions.json'), 'utf8'),
    fs.readFile(path.join(process.cwd(), 'data', 'reviews-master.json'), 'utf8'),
    fs.readFile(path.join(process.cwd(), 'data', 'customer-ltv.json'), 'utf8').catch(() => '{}'),
  ]);
  const monthly: MonthlyTx[] = JSON.parse(txJson);
  {
    const { applyMonthlyCorrections } = await import('./data-corrections');
    await applyMonthlyCorrections(monthly as unknown as Array<{ month: string; revenue?: number; expense?: number }>);
  }
  const commissions: Commission[] = JSON.parse(commJson);
  const reviewsRaw = JSON.parse(revJson);
  const reviews: Review[] = reviewsRaw.reviews || [];
  const ltv = (() => { try { return JSON.parse(ltvJson); } catch { return {}; } })();

  // Lifetime
  const totRev = monthly.reduce((s, m) => s + (m.revenue || 0), 0);
  const totExp = monthly.reduce((s, m) => s + (m.expense || 0), 0);
  const totInv = monthly.reduce((s, m) => s + (m.invoiceCount || 0), 0);

  // YTD
  const now = new Date();
  const currentYear = now.getFullYear().toString();
  const priorYear = (now.getFullYear() - 1).toString();
  const monthsCompleted = now.getMonth(); // 0..11; 0=Jan in progress
  const ytdMonths = monthly.filter(m => m.month.startsWith(currentYear + '-'));
  const ytdRev = ytdMonths.reduce((s, m) => s + (m.revenue || 0), 0);
  const ytdExp = ytdMonths.reduce((s, m) => s + (m.expense || 0), 0);
  const ytdInv = ytdMonths.reduce((s, m) => s + (m.invoiceCount || 0), 0);

  // Same period prior year
  let priorYtdRev = 0;
  for (let i = 1; i <= monthsCompleted; i++) {
    const key = `${priorYear}-${String(i).padStart(2, '0')}`;
    const tx = monthly.find(m => m.month === key);
    if (tx) priorYtdRev += tx.revenue || 0;
  }
  const ytdRevSamePeriod = monthsCompleted > 0
    ? ytdMonths.filter(m => parseInt(m.month.split('-')[1], 10) <= monthsCompleted).reduce((s, m) => s + (m.revenue || 0), 0)
    : 0;
  const vsPriorYearPct = priorYtdRev > 0
    ? Math.round(((ytdRevSamePeriod - priorYtdRev) / priorYtdRev) * 1000) / 10
    : null;

  // Last 12mo
  const oneYearAgo = new Date(now); oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const oneYearAgoMs = oneYearAgo.getTime();
  const last12Months = monthly.slice(-12);
  const last12Rev = last12Months.reduce((s, m) => s + (m.revenue || 0), 0);
  const last12Exp = last12Months.reduce((s, m) => s + (m.expense || 0), 0);
  const last12Comm = commissions.filter(c => c.date && new Date(c.date).getTime() >= oneYearAgoMs).reduce((s, c) => s + (c.amount || 0), 0);
  const last12Reviews = reviews.filter(r => r.date && new Date(r.date).getTime() >= oneYearAgoMs);
  const last12FiveStar = last12Reviews.filter(r => r.rating === 5).length;
  const avgRating12 = last12Reviews.length > 0
    ? Math.round((last12Reviews.reduce((s, r) => s + (r.rating || 0), 0) / last12Reviews.length) * 100) / 100
    : null;

  // Records
  const bestMonth = [...monthly].sort((a, b) => (b.revenue || 0) - (a.revenue || 0))[0] || { month: '', revenue: 0 };
  const yearMap = new Map<string, number>();
  for (const m of monthly) {
    const y = m.month.slice(0, 4);
    yearMap.set(y, (yearMap.get(y) || 0) + (m.revenue || 0));
  }
  const bestYearEntry = Array.from(yearMap.entries()).sort((a, b) => b[1] - a[1])[0] || ['', 0];

  const monthsWithNet = monthly.map(m => ({ ...m, net: (m.revenue || 0) - (m.expense || 0) }));
  const worstLoss = monthsWithNet.sort((a, b) => a.net - b.net)[0] || { month: '', net: 0 };

  const biggestComm = [...commissions].sort((a, b) => (b.amount || 0) - (a.amount || 0))[0] || { date: '', amount: 0, salesRep: '', customer: '' };
  // tenure
  const repDates = new Map<string, string[]>();
  for (const c of commissions) {
    const rep = (c.salesRep || '').trim();
    if (!rep || !c.date) continue;
    if (!repDates.has(rep)) repDates.set(rep, []);
    repDates.get(rep)!.push(c.date);
  }
  let longestRep = { rep: '', years: 0 };
  for (const [rep, dates] of repDates) {
    const sorted = dates.slice().sort();
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (!first || !last) continue;
    const years = Math.round(((new Date(last).getTime() - new Date(first).getTime()) / (365 * 86400 * 1000)) * 10) / 10;
    if (years > longestRep.years) longestRep = { rep, years };
  }

  const topCust = (ltv.topCustomers || [])[0] || { customer: '', total: 0 };

  // Active rep top 5 (last 12mo commissions)
  const ACTIVE_REPS = new Set(['hunter rivers', 'aaron lussi', 'greg muse', 'brendon muse', 'adam rudell', 'joseph dowd', 'rick', 'alijah coleman', 'travis wages']);
  const recentRepTotals = new Map<string, number>();
  for (const c of commissions) {
    if (!c.date) continue;
    if (new Date(c.date).getTime() < oneYearAgoMs) continue;
    const rep = (c.salesRep || '').trim();
    if (!rep) continue;
    recentRepTotals.set(rep, (recentRepTotals.get(rep) || 0) + (c.amount || 0));
  }
  const top5Active = Array.from(recentRepTotals.entries())
    .filter(([rep]) => ACTIVE_REPS.has(rep.toLowerCase()) || Array.from(ACTIVE_REPS).some(a => rep.toLowerCase().includes(a) || a.includes(rep.toLowerCase())))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([rep, total]) => ({ rep, commissions: Math.round(total) }));

  // Reviews aggregate
  const revMonthMap = new Map<string, number>();
  for (const r of reviews) {
    const m = (r.date || '').slice(0, 7);
    if (!m) continue;
    revMonthMap.set(m, (revMonthMap.get(m) || 0) + 1);
  }
  const bestReviewMonth = Array.from(revMonthMap.entries()).sort((a, b) => b[1] - a[1])[0] || ['', 0];
  const fiveStarTotal = reviews.filter(r => r.rating === 5).length;
  const avgRatingLifetime = reviews.length > 0
    ? Math.round((reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length) * 100) / 100
    : 0;

  return {
    generatedAt: new Date().toISOString().slice(0, 10),
    asOf: new Date().toISOString().slice(0, 10),
    lifetime: {
      revenue: Math.round(totRev),
      expense: Math.round(totExp),
      netCash: Math.round(totRev - totExp),
      margin: totRev > 0 ? Math.round(((totRev - totExp) / totRev) * 1000) / 10 : 0,
      invoices: totInv,
      avgInvoice: totInv > 0 ? Math.round(totRev / totInv) : 0,
      customers: ltv.totalCustomers || 0,
    },
    ytd: {
      revenue: Math.round(ytdRev),
      expense: Math.round(ytdExp),
      netCash: Math.round(ytdRev - ytdExp),
      margin: ytdRev > 0 ? Math.round(((ytdRev - ytdExp) / ytdRev) * 1000) / 10 : 0,
      invoices: ytdInv,
      vsPriorYearPct,
      monthsCompleted,
    },
    last12mo: {
      revenue: Math.round(last12Rev),
      expense: Math.round(last12Exp),
      netCash: Math.round(last12Rev - last12Exp),
      commissionsPaid: Math.round(last12Comm),
      reviews: last12Reviews.length,
      fiveStarReviews: last12FiveStar,
      avgRating: avgRating12,
    },
    records: {
      bestMonth: { month: bestMonth.month, revenue: Math.round(bestMonth.revenue || 0) },
      bestYear: { year: bestYearEntry[0] as string, revenue: Math.round(bestYearEntry[1] as number) },
      worstLossMonth: { month: worstLoss.month, net: Math.round(worstLoss.net) },
      biggestCommission: { date: biggestComm.date || '', amount: Math.round(biggestComm.amount || 0), rep: biggestComm.salesRep || '', customer: (biggestComm.customer || '').slice(0, 60) },
      longestTenureRep: longestRep,
      topCustomerLifetime: { customer: topCust.customer || '', total: Math.round(topCust.total || 0) },
    },
    reps: { activeCount: 9, top5Last12mo: top5Active },
    reviews: {
      total: reviews.length,
      fiveStarPct: reviews.length > 0 ? Math.round((fiveStarTotal / reviews.length) * 1000) / 10 : 0,
      avgRating: avgRatingLifetime,
      bestSingleMonth: { month: bestReviewMonth[0] as string, count: bestReviewMonth[1] as number },
    },
  };
}
