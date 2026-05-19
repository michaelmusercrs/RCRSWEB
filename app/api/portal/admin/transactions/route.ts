/**
 * Transaction Search API
 *
 * Backs the /portal/admin/transactions and /command-center/finance/transactions
 * pages. Filters the slim transaction ledger (data/transactions.json — every
 * past-dated QB transaction since 2018) server-side, paginated.
 *
 * GET /api/portal/admin/transactions?q=&type=&from=&to=&minAmount=&maxAmount=&rep=&page=&pageSize=
 *
 * Response: { hits, total, page, pageSize, totals, meta }
 */
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { requireAuth } from '@/lib/auth-service';
import transactionsMeta from '@/data/transactions-meta.json';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

// Lazy-load the 9 MB transactions.json once per cold start; subsequent requests
// reuse the in-memory copy. Avoids bundling it into the function payload.
let _allTransactions: Tx[] | null = null;
async function loadTransactions(): Promise<Tx[]> {
  if (_allTransactions) return _allTransactions;
  const file = path.join(process.cwd(), 'data', 'transactions.json');
  const raw = await fs.readFile(file, 'utf8');
  _allTransactions = JSON.parse(raw) as Tx[];
  return _allTransactions;
}

const ALLOWED_ROLES = new Set([
  'owner', 'admin', 'office', 'manager',
]);

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;
  if (!ALLOWED_ROLES.has(auth.user.role)) {
    return NextResponse.json(
      { error: 'Owner / admin / office / manager role required' },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim().toLowerCase();
  const type = (searchParams.get('type') || '').trim();
  const from = (searchParams.get('from') || '').trim();
  const to = (searchParams.get('to') || '').trim();
  const minAmount = parseFloat(searchParams.get('minAmount') || '');
  const maxAmount = parseFloat(searchParams.get('maxAmount') || '');
  const rep = (searchParams.get('rep') || '').trim().toLowerCase();
  const customer = (searchParams.get('customer') || '').trim().toLowerCase();
  const vendor = (searchParams.get('vendor') || '').trim().toLowerCase();
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1);
  const pageSize = Math.min(
    Math.max(parseInt(searchParams.get('pageSize') || '50', 10) || 50, 1),
    500,
  );

  const all = await loadTransactions();
  const filtered: Tx[] = [];
  let runningTotal = 0;
  let runningAbsTotal = 0;

  for (const t of all) {
    if (type && t.type !== type) continue;
    if (from && t.date < from) continue;
    if (to && t.date > to) continue;
    if (Number.isFinite(minAmount) && t.amount < minAmount) continue;
    if (Number.isFinite(maxAmount) && t.amount > maxAmount) continue;
    if (rep && !t.salesRep.toLowerCase().includes(rep)) continue;
    if (customer && !t.customer.toLowerCase().includes(customer)) continue;
    if (vendor && !t.vendor.toLowerCase().includes(vendor)) continue;
    if (q) {
      const hay =
        `${t.num} ${t.customer} ${t.vendor} ${t.salesRep} ${t.employee || ''} ${t.project || ''} ${t.accountType}`
          .toLowerCase();
      if (!hay.includes(q)) continue;
    }
    filtered.push(t);
    runningTotal += t.amount;
    runningAbsTotal += Math.abs(t.amount);
  }

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const hits = filtered.slice(start, start + pageSize);

  // Facet counts (over the filtered result) — capped to keep the response small
  const typeCounts: Record<string, number> = {};
  const repCounts: Record<string, number> = {};
  for (const t of filtered) {
    if (t.type) typeCounts[t.type] = (typeCounts[t.type] || 0) + 1;
    if (t.salesRep) repCounts[t.salesRep] = (repCounts[t.salesRep] || 0) + 1;
  }

  return NextResponse.json({
    hits,
    total,
    page,
    pageSize,
    totals: {
      netAmount: Math.round(runningTotal * 100) / 100,
      absTotal: Math.round(runningAbsTotal * 100) / 100,
    },
    facets: {
      types: Object.entries(typeCounts).sort((a, b) => b[1] - a[1]),
      reps: Object.entries(repCounts).sort((a, b) => b[1] - a[1]).slice(0, 30),
    },
    meta: transactionsMeta,
  });
}
