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
