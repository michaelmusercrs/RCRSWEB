/**
 * Chris View — public read-only API.
 *
 * Mirror of /api/portal/admin/database but without the auth gate. Lives
 * alongside /chrisview the same way /trip lives alongside /api/trip:
 * intentionally public per owner's choice. Returns the same aggregated
 * data files; no write paths.
 *
 * GET /api/chrisview?type=overview|customers|vendors|reps|commissions|transactions
 */
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import transactionsByRep from '@/data/transactions-by-rep.json';
import transactionsByCustomer from '@/data/transactions-by-customer.json';
import transactionsByVendor from '@/data/transactions-by-vendor.json';
import transactionsMonthly from '@/data/transactions-monthly.json';
import transactionsMeta from '@/data/transactions-meta.json';
import companyOverview from '@/data/company-overview.json';
import commissions from '@/data/commissions.json';
import meetingNumbersAll from '@/data/meeting-numbers-all.json';
import meetingNumbers2026 from '@/data/meeting-numbers-2026.json';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface CommissionRow {
  salesRep: string;
  date: string;
  amount: number;
  balance?: number;
  jobNumber?: string;
  customer?: string;
}

interface Tx {
  date: string;
  type: string;
  num: string;
  amount: number;
  accountType: string;
  customer: string;
  vendor: string;
  salesRep: string;
  posting: boolean;
  employee?: string;
  project?: string;
}

let _allTransactions: Tx[] | null = null;
async function loadTransactions(): Promise<Tx[]> {
  if (_allTransactions) return _allTransactions;
  const file = path.join(process.cwd(), 'data', 'transactions.json');
  const raw = await fs.readFile(file, 'utf8');
  _allTransactions = JSON.parse(raw) as Tx[];
  return _allTransactions;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = (searchParams.get('type') || 'overview').trim();
  const q = (searchParams.get('q') || '').trim().toLowerCase();
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1);
  const pageSize = Math.min(
    Math.max(parseInt(searchParams.get('pageSize') || '50', 10) || 50, 1),
    500,
  );

  try {
    switch (type) {
      case 'overview':
        return NextResponse.json(buildOverview());
      case 'customers':
        return NextResponse.json(paginate(filterCustomers(q), page, pageSize));
      case 'vendors':
        return NextResponse.json(paginate(filterVendors(q), page, pageSize));
      case 'reps':
        return NextResponse.json(paginate(buildReps(q), page, pageSize));
      case 'commissions':
        return NextResponse.json(
          paginate(filterCommissions(q, searchParams.get('rep')), page, pageSize),
        );
      case 'transactions':
        return NextResponse.json(await filterTransactions(searchParams, page, pageSize));
      case 'charts':
        return NextResponse.json(buildCharts());
      default:
        return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

function paginate<T>(rows: T[], page: number, pageSize: number) {
  return {
    rows: rows.slice((page - 1) * pageSize, page * pageSize),
    total: rows.length,
    page,
    pageSize,
  };
}

function buildOverview() {
  const o = companyOverview;
  const monthly = transactionsMonthly as Array<{
    month: string; netRevenue: number; expense: number; invoiceCount: number;
  }>;
  const last12 = monthly.slice(-12);
  return {
    meta: transactionsMeta,
    lifetime: {
      totalIncome: o.income.total,
      grossProfit: o.grossProfit,
      grossMargin: o.grossMargin,
      netIncome: o.netIncome,
      accountsReceivable: o.balanceSheet.assets.currentAssets.accountsReceivable,
      cashOnHand: o.balanceSheet.assets.currentAssets.bankAccounts.total,
      assets: o.balanceSheet.assets.total,
      liabilities: o.balanceSheet.liabilities.total,
      equity: o.balanceSheet.equity.total,
      salesCommissionTotal: o.cogs.salesCommission.total,
      subcontractorPayTotal: o.cogs.subcontractorPay.total,
      jobMaterialsTotal: o.cogs.jobMaterials.total,
      payrollTotal: o.expenses.payrollExpenses.total,
      advertisingTotal: o.expenses.advertisingMarketing.total,
    },
    counts: {
      transactions: transactionsMeta.totalTransactions,
      customers: transactionsByCustomer.length,
      vendors: transactionsByVendor.length,
      reps: transactionsByRep.length,
      commissionRows: commissions.length,
      months: monthly.length,
    },
    last12,
    last12Revenue: Math.round(last12.reduce((s, m) => s + m.netRevenue, 0) * 100) / 100,
    last12Expense: Math.round(last12.reduce((s, m) => s + m.expense, 0) * 100) / 100,
  };
}

function filterCustomers(q: string) {
  const all = transactionsByCustomer as Array<{ customer: string; total: number; invoiceCount: number }>;
  return q ? all.filter(c => c.customer.toLowerCase().includes(q)) : all;
}

function filterVendors(q: string) {
  const all = transactionsByVendor as Array<{ vendor: string; total: number; txCount: number }>;
  return q ? all.filter(v => v.vendor.toLowerCase().includes(q)) : all;
}

function buildReps(q: string) {
  const repRows = transactionsByRep as Array<{ rep: string; invoiceTotal: number; invoiceCount: number }>;
  const commissionByRep = new Map<string, { total: number; count: number }>();
  for (const c of commissions as CommissionRow[]) {
    if (!c.salesRep) continue;
    const cur = commissionByRep.get(c.salesRep) || { total: 0, count: 0 };
    cur.total += c.amount || 0;
    cur.count += 1;
    commissionByRep.set(c.salesRep, cur);
  }
  const out = repRows.map(r => {
    const cm = commissionByRep.get(r.rep) || { total: 0, count: 0 };
    return {
      rep: r.rep,
      invoiceTotal: r.invoiceTotal,
      invoiceCount: r.invoiceCount,
      avgInvoice: r.invoiceCount > 0 ? Math.round((r.invoiceTotal / r.invoiceCount) * 100) / 100 : 0,
      commissionTotal: Math.round(cm.total * 100) / 100,
      commissionCount: cm.count,
    };
  });
  const repNames = new Set(out.map(r => r.rep));
  for (const [rep, cm] of commissionByRep.entries()) {
    if (!repNames.has(rep)) {
      out.push({
        rep, invoiceTotal: 0, invoiceCount: 0, avgInvoice: 0,
        commissionTotal: Math.round(cm.total * 100) / 100, commissionCount: cm.count,
      });
    }
  }
  out.sort((a, b) => b.invoiceTotal - a.invoiceTotal);
  return q ? out.filter(r => r.rep.toLowerCase().includes(q)) : out;
}

function filterCommissions(q: string, rep: string | null) {
  let rows = commissions as CommissionRow[];
  if (rep) {
    const r = rep.trim().toLowerCase();
    rows = rows.filter(c => c.salesRep?.toLowerCase().includes(r));
  }
  if (q) {
    rows = rows.filter(c =>
      [c.salesRep, c.date, c.jobNumber, c.customer]
        .filter(Boolean).join(' ').toLowerCase().includes(q),
    );
  }
  const isoOf = (d?: string) => {
    if (!d) return '';
    const [m, dd, y] = d.split('/');
    return y && m && dd ? `${y}-${m.padStart(2, '0')}-${dd.padStart(2, '0')}` : '';
  };
  return [...rows].sort((a, b) => isoOf(b.date).localeCompare(isoOf(a.date)));
}

function buildCharts() {
  const monthly = transactionsMonthly as Array<{
    month: string; netRevenue: number; expense: number; invoiceCount: number;
  }>;

  // Per-year aggregates (2018-2026)
  const yearly: Record<string, { year: string; revenue: number; expense: number; net: number; invoiceCount: number }> = {};
  for (const m of monthly) {
    const y = m.month.slice(0, 4);
    if (!yearly[y]) yearly[y] = { year: y, revenue: 0, expense: 0, net: 0, invoiceCount: 0 };
    yearly[y].revenue += m.netRevenue;
    yearly[y].expense += m.expense;
    yearly[y].invoiceCount += m.invoiceCount;
  }
  const byYear = Object.values(yearly).map(y => ({
    ...y,
    revenue: Math.round(y.revenue * 100) / 100,
    expense: Math.round(y.expense * 100) / 100,
    net: Math.round((y.revenue - y.expense) * 100) / 100,
  })).sort((a, b) => a.year.localeCompare(b.year));

  // Last 24 months for the line/area chart
  const last24 = monthly.slice(-24).map(m => ({
    month: m.month,
    revenue: Math.round(m.netRevenue * 100) / 100,
    expense: Math.round(m.expense * 100) / 100,
    net: Math.round((m.netRevenue - m.expense) * 100) / 100,
    invoiceCount: m.invoiceCount,
  }));

  // Cumulative revenue timeline (lifetime)
  let cumulative = 0;
  const cumulativeRevenue = monthly.map(m => {
    cumulative += m.netRevenue;
    return {
      month: m.month,
      cumulative: Math.round(cumulative * 100) / 100,
    };
  });

  // Top entities
  const topReps = (transactionsByRep as Array<{ rep: string; invoiceTotal: number; invoiceCount: number }>)
    .slice(0, 15)
    .map(r => ({ name: r.rep, value: Math.round(r.invoiceTotal * 100) / 100, count: r.invoiceCount }));
  const topVendors = (transactionsByVendor as Array<{ vendor: string; total: number; txCount: number }>)
    .slice(0, 15)
    .map(v => ({ name: v.vendor, value: Math.round(v.total * 100) / 100, count: v.txCount }));
  const topCustomers = (transactionsByCustomer as Array<{ customer: string; total: number; invoiceCount: number }>)
    .slice(0, 15)
    .map(c => ({ name: c.customer, value: Math.round(c.total * 100) / 100, count: c.invoiceCount }));

  // Projection for current year
  const now = new Date();
  const currentYear = String(now.getFullYear());
  const ytdRevenue = byYear.find(y => y.year === currentYear)?.revenue || 0;
  const ytdExpense = byYear.find(y => y.year === currentYear)?.expense || 0;
  const lastYearRevenue = byYear.find(y => y.year === String(now.getFullYear() - 1))?.revenue || 0;

  // Days elapsed in this year (UTC)
  const yearStart = new Date(Date.UTC(now.getFullYear(), 0, 1));
  const daysElapsed = Math.max(
    1,
    Math.floor((now.getTime() - yearStart.getTime()) / 86400000) + 1,
  );
  const daysInYear = 365 + (now.getFullYear() % 4 === 0 ? 1 : 0);

  // Run rate: last 3 fully-completed months × 4 (annualized)
  const lastFullMonths = monthly
    .filter(m => {
      const [y, mm] = m.month.split('-').map(Number);
      const meEnd = new Date(Date.UTC(y, mm, 0));
      return meEnd < new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    })
    .slice(-3);
  const runRate3moAvg = lastFullMonths.length > 0
    ? lastFullMonths.reduce((s, m) => s + m.netRevenue, 0) / lastFullMonths.length
    : 0;

  // YoY growth so far this year
  const lastYearSameWindow = byYear.find(y => y.year === String(now.getFullYear() - 1));
  const lastYearProrated = lastYearSameWindow
    ? (lastYearSameWindow.revenue / daysInYear) * daysElapsed
    : 0;

  const projection = {
    currentYear,
    daysElapsed,
    daysInYear,
    ytdRevenue: Math.round(ytdRevenue * 100) / 100,
    ytdExpense: Math.round(ytdExpense * 100) / 100,
    ytdNet: Math.round((ytdRevenue - ytdExpense) * 100) / 100,
    annualizedRevenue: Math.round((ytdRevenue / daysElapsed) * daysInYear * 100) / 100,
    runRateAnnualized: Math.round(runRate3moAvg * 12 * 100) / 100,
    runRate3moAvg: Math.round(runRate3moAvg * 100) / 100,
    lastYearRevenue: Math.round(lastYearRevenue * 100) / 100,
    lastYearProrated: Math.round(lastYearProrated * 100) / 100,
    yoyDeltaProrated: lastYearProrated > 0
      ? Math.round(((ytdRevenue - lastYearProrated) / lastYearProrated) * 1000) / 10
      : 0,
    forecastVsLastYear: lastYearRevenue > 0
      ? Math.round((((ytdRevenue / daysElapsed) * daysInYear - lastYearRevenue) / lastYearRevenue) * 1000) / 10
      : 0,
  };

  // Commission payouts by year
  const commByYear: Record<string, number> = {};
  for (const c of commissions as Array<{ date: string; amount: number }>) {
    if (!c.date) continue;
    const y = c.date.slice(-4);
    if (!y || y < '2018') continue;
    commByYear[y] = (commByYear[y] || 0) + (c.amount || 0);
  }
  const commissionsByYear = Object.entries(commByYear)
    .map(([year, total]) => ({ year, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => a.year.localeCompare(b.year));

  // Expense category breakdown from QB management report
  const oe = companyOverview.expenses;
  const expenseBreakdown = [
    { name: 'Payroll', value: oe.payrollExpenses.total },
    { name: 'Advertising', value: oe.advertisingMarketing.total },
    { name: 'Insurance', value: oe.insurance.total },
    { name: 'Office / supplies', value: oe.officeSuppliesGeneralExpenses.total },
    { name: 'Truck / fuel', value: oe.truckFuelExpenses.total },
    { name: 'Travel', value: oe.travelExpenses.total },
    { name: 'Lease', value: oe.leasePmtMscRealty },
    { name: 'Utilities', value: oe.utilities.total },
    { name: 'Legal / Pro', value: oe.legalProfessional },
    { name: 'Royalties', value: oe.royaltyExpenses },
    { name: 'Other', value: oe.repairsMaintenance.total + oe.duesSubscriptions.total + oe.bankCharges + oe.giftsFlowers + oe.charitableContributions.total + oe.officeExpenses + oe.badDebts },
  ].sort((a, b) => b.value - a.value);

  // COGS breakdown from QB management report
  const oc = companyOverview.cogs;
  const cogsBreakdown = [
    { name: 'Job Materials', value: oc.jobMaterials.total },
    { name: 'Subcontractor Pay', value: oc.subcontractorPay.total },
    { name: 'Sales Commission', value: oc.salesCommission.total },
    { name: 'Job Permits', value: oc.jobPermitsCityCo },
    { name: 'Aerial Measurements', value: oc.aerialMeasurements },
    { name: 'Workers Comp', value: oc.workersCompensationExpenses },
    { name: 'CC Fees / Misc', value: oc.creditCardMerchantFees + oc.rentalEquipment + oc.ownersPayCommission.total },
  ].sort((a, b) => b.value - a.value);

  // Sales activity (meeting numbers) — last 26 weeks by rep
  type MeetingRow = {
    meetingDate?: string;
    repName?: string;
    Inspected?: string;
    Signed?: string;
    $$$$$?: string;
  };
  const allMeetings = [
    ...(meetingNumbersAll as MeetingRow[]),
    ...(meetingNumbers2026 as MeetingRow[]),
  ];
  // Aggregate by week (meetingDate)
  type WeekAgg = { date: string; inspected: number; signed: number; revenue: number };
  const byWeek = new Map<string, WeekAgg>();
  for (const m of allMeetings) {
    if (!m.meetingDate) continue;
    const w = byWeek.get(m.meetingDate) || { date: m.meetingDate, inspected: 0, signed: 0, revenue: 0 };
    w.inspected += parseInt(String(m.Inspected || '0')) || 0;
    w.signed += parseInt(String(m.Signed || '0')) || 0;
    const rev = parseFloat(String(m.$$$$$ || '0').replace(/[$,]/g, '')) || 0;
    w.revenue += rev;
    byWeek.set(m.meetingDate, w);
  }
  const salesActivityWeeks = Array.from(byWeek.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-26)
    .map(w => ({
      ...w,
      revenue: Math.round(w.revenue * 100) / 100,
    }));

  // Aggregate sales activity by year
  const byActivityYear: Record<string, { year: string; inspected: number; signed: number; revenue: number }> = {};
  for (const m of allMeetings) {
    if (!m.meetingDate) continue;
    const y = m.meetingDate.slice(0, 4);
    if (!byActivityYear[y]) byActivityYear[y] = { year: y, inspected: 0, signed: 0, revenue: 0 };
    byActivityYear[y].inspected += parseInt(String(m.Inspected || '0')) || 0;
    byActivityYear[y].signed += parseInt(String(m.Signed || '0')) || 0;
    const rev = parseFloat(String(m.$$$$$ || '0').replace(/[$,]/g, '')) || 0;
    byActivityYear[y].revenue += rev;
  }
  const salesActivityByYear = Object.values(byActivityYear)
    .map(y => ({ ...y, revenue: Math.round(y.revenue * 100) / 100 }))
    .sort((a, b) => a.year.localeCompare(b.year));

  return {
    byYear,
    last24,
    cumulativeRevenue,
    topReps,
    topVendors,
    topCustomers,
    projection,
    commissionsByYear,
    expenseBreakdown,
    cogsBreakdown,
    salesActivityWeeks,
    salesActivityByYear,
  };
}

async function filterTransactions(searchParams: URLSearchParams, page: number, pageSize: number) {
  const all = await loadTransactions();
  const q = (searchParams.get('q') || '').trim().toLowerCase();
  const type = (searchParams.get('txType') || '').trim();
  const rep = (searchParams.get('rep') || '').trim().toLowerCase();
  const customer = (searchParams.get('customer') || '').trim().toLowerCase();
  const vendor = (searchParams.get('vendor') || '').trim().toLowerCase();
  const from = (searchParams.get('from') || '').trim();
  const to = (searchParams.get('to') || '').trim();

  const filtered: Tx[] = [];
  let net = 0;
  let abs = 0;
  for (const t of all) {
    if (type && t.type !== type) continue;
    if (from && t.date < from) continue;
    if (to && t.date > to) continue;
    if (rep && !t.salesRep.toLowerCase().includes(rep)) continue;
    if (customer && !t.customer.toLowerCase().includes(customer)) continue;
    if (vendor && !t.vendor.toLowerCase().includes(vendor)) continue;
    if (q) {
      const hay = `${t.num} ${t.customer} ${t.vendor} ${t.salesRep} ${t.employee || ''} ${t.project || ''} ${t.accountType}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }
    filtered.push(t);
    net += t.amount;
    abs += Math.abs(t.amount);
  }
  const typeCounts: Record<string, number> = {};
  for (const t of filtered) {
    if (t.type) typeCounts[t.type] = (typeCounts[t.type] || 0) + 1;
  }
  return {
    rows: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
    pageSize,
    totals: { netAmount: Math.round(net * 100) / 100, absTotal: Math.round(abs * 100) / 100 },
    facets: { types: Object.entries(typeCounts).sort((a, b) => b[1] - a[1]) },
  };
}
