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
import inventoryProducts from '@/data/inventory-products.json';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Clone the imported monthly array + apply sheet-driven corrections.
// Imports are immutable, and we share the corrected snapshot across the
// three call sites (buildOverview, buildCharts, buildTransactions).
async function getCorrectedMonthly(): Promise<Array<{
  month: string; revenue: number; netRevenue: number; expense: number; invoiceCount: number;
}>> {
  const raw = transactionsMonthly as Array<{ month: string; revenue: number; netRevenue: number; expense: number; invoiceCount: number }>;
  const clone = raw.map(r => ({ ...r }));
  const { applyMonthlyCorrections } = await import('@/lib/data-corrections');
  // applyMonthlyCorrections rewrites `revenue` / `expense` based on the
  // sheet. Mirror the revenue correction onto `netRevenue` so downstream
  // charts that consume `netRevenue` see the corrected number too.
  const beforeRev = clone.map(c => c.revenue);
  await applyMonthlyCorrections(clone as unknown as Array<{ month: string; revenue?: number; expense?: number }>);
  for (let i = 0; i < clone.length; i++) {
    const delta = clone[i].revenue - beforeRev[i];
    if (delta !== 0) clone[i].netRevenue = (clone[i].netRevenue || 0) + delta;
  }
  return clone;
}

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
        return NextResponse.json(await buildOverview());
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
        return NextResponse.json(await buildCharts());
      case 'inventory':
        return NextResponse.json(buildInventory(q));
      case 'yearComparison':
        return NextResponse.json(await buildYearComparison());
      case 'recent':
        return NextResponse.json(await buildRecentActivity(20));
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

async function buildOverview() {
  const o = companyOverview;
  const monthly = await getCorrectedMonthly();
  const last12 = monthly.slice(-12);

  // Customer concentration risk — top N customers as % of lifetime invoiced.
  // High concentration = revenue is fragile if a big customer leaves.
  const sortedCust = (transactionsByCustomer as Array<{ customer: string; total: number }>)
    .map(c => c.total)
    .sort((a, b) => b - a);
  const totalCustRevenue = sortedCust.reduce((s, v) => s + v, 0);
  const concentration = {
    top5Share: totalCustRevenue > 0 ? (sortedCust.slice(0, 5).reduce((s, v) => s + v, 0) / totalCustRevenue) : 0,
    top10Share: totalCustRevenue > 0 ? (sortedCust.slice(0, 10).reduce((s, v) => s + v, 0) / totalCustRevenue) : 0,
    top20Share: totalCustRevenue > 0 ? (sortedCust.slice(0, 20).reduce((s, v) => s + v, 0) / totalCustRevenue) : 0,
    totalCustomers: (transactionsByCustomer as Array<unknown>).length,
  };

  // Rep concentration — how reliant we are on top sales reps
  const sortedReps = (transactionsByRep as Array<{ rep: string; invoiceTotal: number }>)
    .map(r => r.invoiceTotal)
    .sort((a, b) => b - a);
  const totalRepRevenue = sortedReps.reduce((s, v) => s + v, 0);
  const repConcentration = {
    top3Share: totalRepRevenue > 0 ? (sortedReps.slice(0, 3).reduce((s, v) => s + v, 0) / totalRepRevenue) : 0,
    top5Share: totalRepRevenue > 0 ? (sortedReps.slice(0, 5).reduce((s, v) => s + v, 0) / totalRepRevenue) : 0,
  };
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
    concentration,
    repConcentration,
  };
}

// Last N transactions for the overview "recent activity" feed
async function buildRecentActivity(limit: number): Promise<{
  rows: Array<{
    date: string; type: string; num: string; amount: number;
    party: string; rep: string;
  }>;
}> {
  const all = await loadTransactions();
  const rows = all
    .slice(0, Math.min(limit, 100))
    .map(t => ({
      date: t.date,
      type: t.type,
      num: t.num,
      amount: t.amount,
      party: t.customer || t.vendor || t.employee || '',
      rep: t.salesRep || '',
    }));
  return { rows };
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

async function buildCharts() {
  const monthly = await getCorrectedMonthly();

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

  // Year race — each year as a cumulative-through-month series so they
  // can be overlaid on one chart. CFO compares "where was 2025 by April"
  // vs "where is 2026 by April" at a glance.
  const byYearMonth: Record<string, Record<number, number>> = {};
  for (const m of monthly) {
    const [y, mm] = m.month.split('-').map(Number);
    const ys = String(y);
    if (!byYearMonth[ys]) byYearMonth[ys] = {};
    byYearMonth[ys][mm] = m.netRevenue;
  }
  const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const yearRace = monthNamesShort.map((name, idx) => {
    const monthNum = idx + 1;
    const row: Record<string, string | number> = { month: name };
    for (const ys of Object.keys(byYearMonth).sort()) {
      let cum = 0;
      for (let mm = 1; mm <= monthNum; mm++) {
        cum += byYearMonth[ys][mm] || 0;
      }
      row[ys] = Math.round(cum * 100) / 100;
    }
    return row;
  });

  // Seasonality — average revenue per calendar month across all years.
  // Tells Chris "August historically does $X, are we ahead/behind?"
  const seasonality: Record<number, { sum: number; count: number; expense: number; ec: number }> = {};
  for (const m of monthly) {
    const [, mm] = m.month.split('-').map(Number);
    if (!seasonality[mm]) seasonality[mm] = { sum: 0, count: 0, expense: 0, ec: 0 };
    seasonality[mm].sum += m.netRevenue;
    seasonality[mm].count += 1;
    seasonality[mm].expense += m.expense;
    seasonality[mm].ec += 1;
  }
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const seasonalityRows = monthNames.map((name, idx) => {
    const s = seasonality[idx + 1] || { sum: 0, count: 0, expense: 0, ec: 0 };
    return {
      month: name,
      monthNum: idx + 1,
      avgRevenue: s.count > 0 ? Math.round((s.sum / s.count) * 100) / 100 : 0,
      avgExpense: s.ec > 0 ? Math.round((s.expense / s.ec) * 100) / 100 : 0,
      yearCount: s.count,
    };
  });

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
    seasonality: seasonalityRows,
    yearRace,
    yearRaceYears: Object.keys(byYearMonth).sort(),
  };
}

function buildInventory(q: string) {
  type Item = {
    'Item ID'?: string; Name?: string; Description?: string; Cost?: number; Price?: number;
    Unit?: string; Category?: string; Supplier?: string; Location?: string;
    Quantity?: number; MinStock?: number; MaxStock?: number;
  };
  const items = inventoryProducts as Item[];
  const rows = items.map(i => {
    const qty = i.Quantity || 0;
    const cost = i.Cost || 0;
    const price = i.Price || 0;
    return {
      id: i['Item ID'] || '',
      name: i.Name || '',
      description: i.Description || '',
      category: i.Category || '',
      supplier: i.Supplier || '',
      location: i.Location || '',
      unit: i.Unit || '',
      qty,
      minStock: i.MinStock || 0,
      cost,
      price,
      stockValue: Math.round(qty * cost * 100) / 100,
      potentialRevenue: Math.round(qty * price * 100) / 100,
      margin: price > 0 ? Math.round(((price - cost) / price) * 1000) / 10 : 0,
      lowStock: qty < (i.MinStock || 0),
    };
  });
  const filtered = q
    ? rows.filter(r => `${r.name} ${r.description} ${r.category} ${r.supplier}`.toLowerCase().includes(q))
    : rows;
  const totalStockValue = filtered.reduce((s, r) => s + r.stockValue, 0);
  const totalPotentialRevenue = filtered.reduce((s, r) => s + r.potentialRevenue, 0);
  return {
    rows: filtered,
    total: filtered.length,
    summary: {
      totalStockValue: Math.round(totalStockValue * 100) / 100,
      totalPotentialRevenue: Math.round(totalPotentialRevenue * 100) / 100,
      lowStockCount: filtered.filter(r => r.lowStock).length,
    },
  };
}

async function buildYearComparison() {
  const monthly = await getCorrectedMonthly();
  // Build a (year, week-of-year) -> revenue map so we can compare apples-to-apples
  const yearTotals: Record<string, { revenue: number; expense: number; invoices: number }> = {};
  for (const m of monthly) {
    const y = m.month.slice(0, 4);
    if (!yearTotals[y]) yearTotals[y] = { revenue: 0, expense: 0, invoices: 0 };
    yearTotals[y].revenue += m.netRevenue;
    yearTotals[y].expense += m.expense;
    yearTotals[y].invoices += m.invoiceCount;
  }
  // Year-to-date through current month for each year (so we can compare like windows)
  const now = new Date();
  const currentMonthIdx = now.getMonth() + 1;
  const ytdByYear: Record<string, { revenue: number; expense: number; invoices: number }> = {};
  for (const m of monthly) {
    const [y, mm] = m.month.split('-').map(Number);
    if (mm > currentMonthIdx) continue;
    if (!ytdByYear[String(y)]) ytdByYear[String(y)] = { revenue: 0, expense: 0, invoices: 0 };
    ytdByYear[String(y)].revenue += m.netRevenue;
    ytdByYear[String(y)].expense += m.expense;
    ytdByYear[String(y)].invoices += m.invoiceCount;
  }

  const rows = Object.entries(yearTotals)
    .map(([year, t]) => {
      const ytd = ytdByYear[year] || { revenue: 0, expense: 0, invoices: 0 };
      return {
        year,
        revenueYear: Math.round(t.revenue * 100) / 100,
        expenseYear: Math.round(t.expense * 100) / 100,
        netYear: Math.round((t.revenue - t.expense) * 100) / 100,
        invoicesYear: t.invoices,
        revenueYTD: Math.round(ytd.revenue * 100) / 100,
        netYTD: Math.round((ytd.revenue - ytd.expense) * 100) / 100,
        invoicesYTD: ytd.invoices,
      };
    })
    .sort((a, b) => b.year.localeCompare(a.year));

  return { rows, currentMonth: currentMonthIdx };
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
