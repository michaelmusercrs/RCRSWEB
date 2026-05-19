/**
 * Admin Database API — unified read across all aggregated data.
 *
 * GET /api/portal/admin/database?type=overview|customers|vendors|reps|commissions
 *
 * Owner/admin/office/manager only. Returns small JSON suitable for
 * client-side rendering on the /portal/admin/database dashboard.
 */
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { requireAuth } from '@/lib/auth-service';
import transactionsByRep from '@/data/transactions-by-rep.json';
import transactionsByCustomer from '@/data/transactions-by-customer.json';
import transactionsByVendor from '@/data/transactions-by-vendor.json';
import transactionsMonthly from '@/data/transactions-monthly.json';
import transactionsMeta from '@/data/transactions-meta.json';
import companyOverview from '@/data/company-overview.json';
import commissions from '@/data/commissions.json';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set(['owner', 'admin', 'office', 'manager']);

interface CommissionRow {
  salesRep: string;
  date: string;
  amount: number;
  balance?: number;
  jobNumber?: string;
  customer?: string;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;
  if (!ALLOWED.has(auth.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const type = (searchParams.get('type') || 'overview').trim();
  const q = (searchParams.get('q') || '').trim().toLowerCase();
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1);
  const pageSize = Math.min(
    Math.max(parseInt(searchParams.get('pageSize') || '50', 10) || 50, 1),
    500,
  );

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
    case 'monthly':
      return NextResponse.json({ rows: transactionsMonthly, total: transactionsMonthly.length });
    default:
      return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
  }
}

function paginate<T>(rows: T[], page: number, pageSize: number) {
  const total = rows.length;
  const start = (page - 1) * pageSize;
  return {
    rows: rows.slice(start, start + pageSize),
    total,
    page,
    pageSize,
  };
}

function buildOverview() {
  const o = companyOverview;
  const monthly = transactionsMonthly as Array<{
    month: string;
    netRevenue: number;
    expense: number;
    invoiceCount: number;
  }>;
  const last12 = monthly.slice(-12);
  const last12Revenue = last12.reduce((s, m) => s + m.netRevenue, 0);
  const last12Expense = last12.reduce((s, m) => s + m.expense, 0);

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
    last12Revenue: Math.round(last12Revenue * 100) / 100,
    last12Expense: Math.round(last12Expense * 100) / 100,
  };
}

function filterCustomers(q: string) {
  const all = transactionsByCustomer as Array<{
    customer: string;
    total: number;
    invoiceCount: number;
  }>;
  if (!q) return all;
  return all.filter(c => c.customer.toLowerCase().includes(q));
}

function filterVendors(q: string) {
  const all = transactionsByVendor as Array<{
    vendor: string;
    total: number;
    txCount: number;
  }>;
  if (!q) return all;
  return all.filter(v => v.vendor.toLowerCase().includes(q));
}

function buildReps(q: string) {
  const repRows = transactionsByRep as Array<{
    rep: string;
    invoiceTotal: number;
    invoiceCount: number;
  }>;
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
      avgInvoice: r.invoiceCount > 0
        ? Math.round((r.invoiceTotal / r.invoiceCount) * 100) / 100
        : 0,
      commissionTotal: Math.round(cm.total * 100) / 100,
      commissionCount: cm.count,
    };
  });
  // Also include reps that only show up in commissions (e.g. inactive)
  const repNames = new Set(out.map(r => r.rep));
  for (const [rep, cm] of commissionByRep.entries()) {
    if (!repNames.has(rep)) {
      out.push({
        rep,
        invoiceTotal: 0,
        invoiceCount: 0,
        avgInvoice: 0,
        commissionTotal: Math.round(cm.total * 100) / 100,
        commissionCount: cm.count,
      });
    }
  }
  out.sort((a, b) => b.invoiceTotal - a.invoiceTotal);
  if (!q) return out;
  return out.filter(r => r.rep.toLowerCase().includes(q));
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
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }
  // Sort newest first by date (MM/DD/YYYY → ISO compare)
  const isoOf = (d?: string) => {
    if (!d) return '';
    const [m, dd, y] = d.split('/');
    return y && m && dd ? `${y}-${m.padStart(2, '0')}-${dd.padStart(2, '0')}` : '';
  };
  return [...rows].sort((a, b) => isoOf(b.date).localeCompare(isoOf(a.date)));
}

// Lazy-load the slim transactions ledger only when explicitly requested via
// /api/portal/admin/transactions — this endpoint never touches it.
void fs; void path;
