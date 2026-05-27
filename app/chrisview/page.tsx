'use client';

/**
 * Chris View — public RCRS database dashboard.
 *
 * Same data as /portal/admin/database but no auth gate. Lives at
 * /chrisview alongside /trip (intentional public read-only access per
 * owner's choice). Includes a Transactions tab with full-ledger search
 * since this is meant for one-stop drill-down.
 */

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  Search,
  Loader2,
  Database,
  Users,
  Truck,
  UserCheck,
  DollarSign,
  TrendingUp,
  Briefcase,
  Receipt,
  Building2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Calendar,
  X,
  BarChart3,
  LineChart as LineChartIcon,
  Download,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  ComposedChart,
  AreaChart,
  Area,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';

const PIE_COLORS = ['#39FF14', '#60a5fa', '#fbbf24', '#fb7185', '#a78bfa', '#22d3ee', '#f97316', '#10b981', '#ec4899', '#6366f1', '#84cc16'];

type TabId = 'overview' | 'charts' | 'transactions' | 'customers' | 'vendors' | 'reps' | 'commissions' | 'inventory';

const VALID_TABS: readonly TabId[] = ['overview', 'charts', 'transactions', 'customers', 'vendors', 'reps', 'commissions', 'inventory'];

interface InventoryRow {
  id: string; name: string; description: string; category: string; supplier: string;
  location: string; unit: string; qty: number; minStock: number; cost: number; price: number;
  stockValue: number; potentialRevenue: number; margin: number; lowStock: boolean;
}
interface InventoryData {
  rows: InventoryRow[];
  total: number;
  summary: { totalStockValue: number; totalPotentialRevenue: number; lowStockCount: number };
}

interface YearComparisonRow {
  year: string; revenueYear: number; expenseYear: number; netYear: number; invoicesYear: number;
  revenueYTD: number; netYTD: number; invoicesYTD: number;
}

interface ChartsData {
  byYear: Array<{ year: string; revenue: number; expense: number; net: number; invoiceCount: number }>;
  last24: Array<{ month: string; revenue: number; expense: number; net: number; invoiceCount: number }>;
  cumulativeRevenue: Array<{ month: string; cumulative: number }>;
  topReps: Array<{ name: string; value: number; count: number }>;
  topVendors: Array<{ name: string; value: number; count: number }>;
  topCustomers: Array<{ name: string; value: number; count: number }>;
  projection: {
    currentYear: string; daysElapsed: number; daysInYear: number;
    ytdRevenue: number; ytdExpense: number; ytdNet: number;
    annualizedRevenue: number; runRateAnnualized: number; runRate3moAvg: number;
    lastYearRevenue: number; lastYearProrated: number;
    yoyDeltaProrated: number; forecastVsLastYear: number;
  };
  commissionsByYear: Array<{ year: string; total: number }>;
  expenseBreakdown: Array<{ name: string; value: number }>;
  cogsBreakdown: Array<{ name: string; value: number }>;
  salesActivityWeeks: Array<{ date: string; inspected: number; signed: number; revenue: number }>;
  salesActivityByYear: Array<{ year: string; inspected: number; signed: number; revenue: number }>;
  seasonality: Array<{ month: string; monthNum: number; avgRevenue: number; avgExpense: number; yearCount: number }>;
  yearRace: Array<Record<string, string | number>>;
  yearRaceYears: string[];
}

interface OverviewData {
  meta: { generatedAt: string; source: string; totalTransactions: number; dateRange: { earliest: string; latest: string } };
  lifetime: {
    totalIncome: number; grossProfit: number; grossMargin: number; netIncome: number;
    accountsReceivable: number; cashOnHand: number; assets: number; liabilities: number; equity: number;
    salesCommissionTotal: number; subcontractorPayTotal: number; jobMaterialsTotal: number;
    payrollTotal: number; advertisingTotal: number;
  };
  counts: { transactions: number; customers: number; vendors: number; reps: number; commissionRows: number; months: number };
  last12: Array<{ month: string; netRevenue: number; expense: number; invoiceCount: number }>;
  last12Revenue: number; last12Expense: number;
  concentration?: { top5Share: number; top10Share: number; top20Share: number; totalCustomers: number };
  repConcentration?: { top3Share: number; top5Share: number };
}
interface Customer { customer: string; total: number; invoiceCount: number; }
interface Vendor { vendor: string; total: number; txCount: number; }
interface Rep { rep: string; invoiceTotal: number; invoiceCount: number; avgInvoice: number; commissionTotal: number; commissionCount: number; }
interface CommissionRow { salesRep: string; date: string; amount: number; jobNumber?: string; customer?: string; }
interface Tx {
  date: string; type: string; num: string; amount: number;
  accountType: string; customer: string; vendor: string; salesRep: string;
  posting: boolean; employee?: string; project?: string;
}

function fmtMoney(n: number): string {
  const abs = Math.abs(n); const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

// CSV export — handles quoting cells with commas/quotes/newlines
function downloadCSV(filename: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv =
    headers.map(esc).join(',') + '\n' +
    rows.map(r => r.map(esc).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function fmtMoneyExact(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}
function fmtPercent(n: number): string { return `${(n * 100).toFixed(1)}%`; }

// --- Analytics Hub --------------------------------------------------------
// All sibling /chrisview/* pages, surfaced as the FIRST thing visible on
// /chrisview itself per the 2026-05-21 owner brief: stop hiding new pages
// behind a tab. Pages flagged `wip` are greyed out — they exist as routes
// but the data isn't trustworthy enough to publish until further work.
interface HubLink {
  href: string;
  title: string;
  description: string;
  highlight?: string;
  wip?: string; // when set, render greyed + show the reason on hover
}
const HUB_GROUPS: { label: string; items: HubLink[] }[] = [
  {
    label: 'Sales performance',
    items: [
      { href: '/chrisview/funnel', title: 'Deep Funnel', description: 'Lead → estimate → signed → paid with certainty labels' },
      { href: '/chrisview/close-rates', title: 'Estimate Close Rates', description: 'By delivery channel, insurance vs retail, contact method, rep' },
      { href: '/chrisview/response-times', title: 'Lead Response Times', description: 'How fast each rep contacts office-created leads' },
      { href: '/chrisview/aging', title: 'Estimate Aging Queue', description: 'Open estimates rotting in the pipeline — by days idle', highlight: 'NEW' },
      { href: '/chrisview/leaderboards', title: 'Three Leaderboards', description: 'Commission / Sales accrual / Per-week — three views of the same revenue' },
      { href: '/chrisview/scorecard', title: 'Rep Scorecard', description: 'Composite per-rep card: commissions × reviews × quality' },
      { href: '/chrisview/win-loss', title: 'Win/Loss Per Project', description: 'Per-project win rate (deduped by R-number — multiple estimates count as 1). Stalled-pipeline follow-up list', highlight: 'NEW' },
      { href: '/chrisview/cohorts', title: 'Cohort Close Rate (most accurate)', description: 'Monthly cohorts observed at maturity — won ÷ total. Reveals the TRUE historical close rate (~47% vs the window-based 75% optical illusion)', highlight: 'TRUE%' },
      { href: '/chrisview/estimate-delivery', title: 'Estimate Delivery', description: '5-category certainty score (certain-emailed → certain-in-person). Compares close rate per delivery mode. Settles the email-vs-meeting question.', highlight: 'NEW' },
      { href: '/chrisview/storm-response', title: 'Storm → Job Response', description: 'Hail Recon storms overlaid on JN lead/job creation. 14-day / 25-mile match window', highlight: 'NEW' },
    ],
  },
  {
    label: 'Customers & growth',
    items: [
      { href: '/chrisview/ltv', title: 'Customer Lifetime Value', description: 'LTV per customer, cohort repeat rate by year', highlight: '32% repeat' },
      { href: '/chrisview/lead-sources', title: 'Lead Source Effectiveness', description: 'Close rate per source + top reps per source' },
      { href: '/chrisview/referral-network', title: 'Referral Network', description: 'Who refers leads to whom — source bucketing + top referrer people', highlight: 'NEW' },
      { href: '/chrisview/reviews', title: 'Reviews by Rep', description: '317 reviews 2018-2025 with low-review detail panel' },
      { href: '/chrisview/review-velocity', title: 'Review Ask Rate', description: '9.8% lifetime ask rate, 0% last 90 days. Hunter\'s last review: 2022', highlight: 'NEW' },
      { href: '/chrisview/cac', title: 'Customer Acquisition Cost', description: 'Lifetime ad spend per channel ÷ customers acquired. LTV-to-CAC ratio. Red flags rows below 3:1', highlight: 'NEW' },
      {
        href: '/chrisview/segmented-ltv',
        title: 'Segmented LTV',
        description: 'LTV split insurance vs retail — which segment is more loyal?',
        wip: 'Only ~7.5% of QB customers cleanly match a JN contact, and JN insurance fields are sparse on the matched ones. Building a QB-memo-based classifier instead.',
      },
    ],
  },
  {
    label: 'Profit & cashflow',
    items: [
      { href: '/chrisview/cashflow', title: 'Cash Flow Forecast', description: '6-month forecast with seasonal multipliers + runway' },
      {
        href: '/chrisview/insurance',
        title: 'Insurance Deep Dive',
        description: 'Per-carrier RCV/ACV/deductible, days-to-approve, adjuster turnaround.',
        wip: 'JN custom field "Claim Number" is only populated on ~0.1% of recent jobs (10 of 10K probed 2026-05-21). Office needs to backfill claim numbers + carrier + RCV/ACV/deductible on JN job records for the page to be meaningful.',
      },
      { href: '/chrisview/lifecycle', title: 'Job Lifecycle', description: 'Days to contract/install/paid, trips per job, rework, 90-day unpaid AR' },
      { href: '/chrisview/leaders', title: 'Division Leader Checks', description: 'Recruiter / override commission payments by recipient and year' },
      { href: '/chrisview/multi-rep-splits', title: 'Multi-Rep Commission Splits', description: '320 split jobs / $2.15M / 168 unique pairings', highlight: 'NEW' },
      {
        href: '/chrisview/margin',
        title: 'True Margin Per Job',
        description: 'Revenue minus materials + subs + commission per job.',
        wip: 'data/job-costs.json is empty — only commission is deducted right now, which reads ~89% margin. Waiting on the post-2026-05-15 sheet backfill of material + sub cost per job before publishing.',
      },
    ],
  },
  {
    label: 'Operations & people',
    items: [
      { href: '/chrisview/insights', title: 'Meeting Insights', description: 'Pattern detection in Monday meeting data — predictions, attendance, goal study' },
      { href: '/chrisview/meetings', title: 'Meeting History', description: 'All-time annual funnel, per-rep career, best rep-weeks, attendance trends' },
      { href: '/chrisview/rep-churn', title: 'Rep Churn Early Warning', description: 'Recent activity vs own baseline — composite risk score per rep', highlight: 'NEW' },
      { href: '/chrisview/subs', title: 'Subcontractor Performance', description: 'Lifetime sub spend, check counts, inactive flags ($6.6M / 13 subs)' },
      { href: '/chrisview/capacity', title: 'Crew Capacity', description: 'Installs/deliveries/inspections scheduled per week via TeamUp; gap days, busiest crew, upcoming installs', highlight: 'NEW' },
      {
        href: '/chrisview/onboarding',
        title: 'Rookie Ramp Curve',
        description: 'Weeks-to-first-signed per rep vs the historical median baseline.',
        wip: 'A rep\'s first meeting-sheet appearance IS effectively their first signed contract (they only get added once they\'re producing). Need a separate hire-date data source before this metric is trustworthy.',
      },
    ],
  },
  {
    label: 'History & records',
    items: [
      { href: '/chrisview/history', title: 'All-Time History', description: '8yr revenue/expense/margin, monthly + quarterly, seasonality heatmap' },
      { href: '/chrisview/compare', title: 'Year-over-Year Compare', description: 'Monthly grid year × month, YTD pace, growth rates' },
      { href: '/chrisview/stats', title: 'Stats & Records', description: 'Best months, biggest commission payments, top lifetime earners, all-time superlatives' },
      { href: '/chrisview/summary', title: 'Executive Summary', description: 'One-screen: lifetime, YTD, last-12mo, records, top reps, reviews' },
      { href: '/chrisview/menu', title: 'Full Menu (printable list)', description: 'All pages as a flat grid for printing or sharing' },
    ],
  },
];

function AnalyticsHub() {
  return (
    <section className="space-y-5 mb-6">
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-[#39FF14]/20 rounded-xl p-5">
        <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
          <LineChartIcon className="w-5 h-5 text-[#39FF14]" />
          Specialized analytics
        </h2>
        <p className="text-zinc-400 text-sm">
          Each tile is a focused view over QB / JN / Monday meeting data. Tiles with
          <span className="inline-block text-[10px] font-mono text-amber-300 bg-amber-400/10 px-1.5 py-0.5 rounded mx-1">WIP</span>
          are still being researched — the data isn't trustworthy yet, so we publish the page but flag it. Hover for the gap reason.
          The classic database tabs (Overview / Charts / Transactions / etc.) are below.
        </p>
      </div>

      {HUB_GROUPS.map(group => (
        <div key={group.label}>
          <h3 className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">{group.label}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {group.items.map(item => {
              const isWip = !!item.wip;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  title={isWip ? item.wip : undefined}
                  className={`group rounded-lg p-3.5 transition-all border ${
                    isWip
                      ? 'bg-zinc-950 border-zinc-800/60 opacity-50 hover:opacity-80 hover:border-amber-400/30'
                      : 'bg-zinc-900 border-zinc-800 hover:border-[#39FF14]/40 hover:bg-zinc-800/40'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <h4 className={`text-sm font-semibold ${isWip ? 'text-zinc-300' : 'text-white'}`}>{item.title}</h4>
                    {isWip ? (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded text-amber-300 bg-amber-400/10 shrink-0 ml-2">WIP</span>
                    ) : item.highlight ? (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded text-[#39FF14] bg-[#39FF14]/10 shrink-0 ml-2">{item.highlight}</span>
                    ) : null}
                  </div>
                  <p className={`text-xs leading-relaxed ${isWip ? 'text-zinc-500' : 'text-zinc-400'}`}>{item.description}</p>
                  {isWip && (
                    <p className="text-[10px] text-amber-400/70 mt-1.5 italic">
                      Not yet trustworthy — {item.wip}
                    </p>
                  )}
                </a>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}

function ChrisViewPageInner() {
  // Tab lives in the URL (?tab=charts) so the page is shareable and
  // browser back/forward navigates between tabs. Falls back to overview
  // for missing or invalid values.
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const urlTab = searchParams.get('tab');
  const tab: TabId = urlTab && (VALID_TABS as readonly string[]).includes(urlTab)
    ? (urlTab as TabId)
    : 'overview';
  const setTab = useCallback((newTab: TabId) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newTab === 'overview') params.delete('tab');
    else params.set('tab', newTab);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, router, pathname]);

  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Tx-specific filters
  const [txType, setTxType] = useState('');
  const [txRep, setTxRep] = useState('');
  const [txCustomer, setTxCustomer] = useState('');
  const [txVendor, setTxVendor] = useState('');
  const [txFrom, setTxFrom] = useState('');
  const [txTo, setTxTo] = useState('');

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [charts, setCharts] = useState<ChartsData | null>(null);
  const [customers, setCustomers] = useState<{ rows: Customer[]; total: number } | null>(null);
  const [vendors, setVendors] = useState<{ rows: Vendor[]; total: number } | null>(null);
  const [reps, setReps] = useState<{ rows: Rep[]; total: number } | null>(null);
  const [commissionsData, setCommissionsData] = useState<{ rows: CommissionRow[]; total: number } | null>(null);
  const [transactionsData, setTransactionsData] = useState<{
    rows: Tx[]; total: number;
    totals?: { netAmount: number; absTotal: number };
    facets?: { types: Array<[string, number]> };
  } | null>(null);
  const [inventory, setInventory] = useState<InventoryData | null>(null);
  const [yearComparison, setYearComparison] = useState<{ rows: YearComparisonRow[]; currentMonth: number } | null>(null);
  const [recent, setRecent] = useState<{ rows: Array<{ date: string; type: string; num: string; amount: number; party: string; rep: string }> } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ type: tab });
      if (q) params.set('q', q);
      if (tab !== 'overview') {
        params.set('page', String(page));
        params.set('pageSize', String(pageSize));
      }
      if (tab === 'transactions') {
        if (txType) params.set('txType', txType);
        if (txRep) params.set('rep', txRep);
        if (txCustomer) params.set('customer', txCustomer);
        if (txVendor) params.set('vendor', txVendor);
        if (txFrom) params.set('from', txFrom);
        if (txTo) params.set('to', txTo);
      }
      const res = await fetch(`/api/chrisview?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      switch (tab) {
        case 'overview': setOverview(data); break;
        case 'charts': setCharts(data); break;
        case 'customers': setCustomers(data); break;
        case 'vendors': setVendors(data); break;
        case 'reps': setReps(data); break;
        case 'commissions': setCommissionsData(data); break;
        case 'transactions': setTransactionsData(data); break;
        case 'inventory': setInventory(data); break;
      }
      // Year comparison + recent activity loaded alongside overview
      if (tab === 'overview') {
        if (!yearComparison) {
          try {
            const ycRes = await fetch('/api/chrisview?type=yearComparison');
            if (ycRes.ok) setYearComparison(await ycRes.json());
          } catch { /* non-critical */ }
        }
        if (!recent) {
          try {
            const rRes = await fetch('/api/chrisview?type=recent');
            if (rRes.ok) setRecent(await rRes.json());
          } catch { /* non-critical */ }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [tab, q, page, txType, txRep, txCustomer, txVendor, txFrom, txTo]);

  useEffect(() => {
    const id = setTimeout(fetchData, 250);
    return () => clearTimeout(id);
  }, [fetchData]);

  useEffect(() => { setPage(1); }, [tab, q, txType, txRep, txCustomer, txVendor, txFrom, txTo]);

  const currentTotal = useMemo(() => {
    switch (tab) {
      case 'customers': return customers?.total;
      case 'vendors': return vendors?.total;
      case 'reps': return reps?.total;
      case 'commissions': return commissionsData?.total;
      case 'transactions': return transactionsData?.total;
      default: return undefined;
    }
  }, [tab, customers, vendors, reps, commissionsData, transactionsData]);

  const totalPages = currentTotal ? Math.max(1, Math.ceil(currentTotal / pageSize)) : 1;

  const clearTxFilters = () => {
    setTxType(''); setTxRep(''); setTxCustomer(''); setTxVendor(''); setTxFrom(''); setTxTo(''); setQ('');
  };

  const [exporting, setExporting] = useState(false);
  // Fetch every matching row (cap 10k) then write CSV
  const exportCurrent = useCallback(async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ type: tab, page: '1', pageSize: '10000' });
      if (q) params.set('q', q);
      if (tab === 'transactions') {
        if (txType) params.set('txType', txType);
        if (txRep) params.set('rep', txRep);
        if (txCustomer) params.set('customer', txCustomer);
        if (txVendor) params.set('vendor', txVendor);
        if (txFrom) params.set('from', txFrom);
        if (txTo) params.set('to', txTo);
      }
      const res = await fetch(`/api/chrisview?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const today = new Date().toISOString().slice(0, 10);
      const stamp = `rcrs-${tab}-${today}.csv`;

      switch (tab) {
        case 'transactions': {
          const rows = (data.rows as Tx[]).map(t => [
            t.date, t.type, t.num, t.amount, t.accountType, t.customer, t.vendor, t.salesRep, t.employee || '', t.project || '',
          ]);
          downloadCSV(stamp, ['date', 'type', 'num', 'amount', 'accountType', 'customer', 'vendor', 'salesRep', 'employee', 'project'], rows);
          break;
        }
        case 'customers': {
          const rows = (data.rows as Customer[]).map(c => [c.customer, c.total, c.invoiceCount]);
          downloadCSV(stamp, ['customer', 'lifetimeInvoiced', 'invoiceCount'], rows);
          break;
        }
        case 'vendors': {
          const rows = (data.rows as Vendor[]).map(v => [v.vendor, v.total, v.txCount]);
          downloadCSV(stamp, ['vendor', 'lifetimeSpend', 'txCount'], rows);
          break;
        }
        case 'reps': {
          const rows = (data.rows as Rep[]).map(r => [r.rep, r.invoiceTotal, r.invoiceCount, r.avgInvoice, r.commissionTotal, r.commissionCount]);
          downloadCSV(stamp, ['rep', 'lifetimeInvoiced', 'invoiceCount', 'avgInvoice', 'commissionPaid', 'commissionCount'], rows);
          break;
        }
        case 'commissions': {
          const rows = (data.rows as CommissionRow[]).map(c => [c.date, c.salesRep, c.amount, c.jobNumber || '', c.customer || '']);
          downloadCSV(stamp, ['date', 'salesRep', 'amount', 'checkNumber', 'customer'], rows);
          break;
        }
        case 'inventory': {
          const rows = (data.rows as InventoryRow[]).map(r => [r.id, r.name, r.category, r.supplier, r.qty, r.unit, r.cost, r.price, r.stockValue, r.margin, r.lowStock ? 'YES' : '']);
          downloadCSV(stamp, ['id', 'name', 'category', 'supplier', 'qty', 'unit', 'cost', 'price', 'stockValue', 'margin%', 'lowStock'], rows);
          break;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  }, [tab, q, txType, txRep, txCustomer, txVendor, txFrom, txTo]);

  const canExport = ['transactions', 'customers', 'vendors', 'reps', 'commissions', 'inventory'].includes(tab);

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-zinc-800 bg-zinc-950 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4 flex-wrap">
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Database className="w-5 h-5 text-[#39FF14]" />
            RCRS — Chris View
          </h1>
          {overview?.meta && (
            <span className="text-xs text-zinc-500 ml-auto">
              {overview.meta.totalTransactions.toLocaleString()} txns ·{' '}
              {overview.meta.dateRange.earliest} → {overview.meta.dateRange.latest} ·{' '}
              refreshed {overview.meta.generatedAt}
            </span>
          )}
          {canExport && (
            <button
              onClick={exportCurrent}
              disabled={exporting || loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#39FF14]/10 border border-[#39FF14]/30 text-[#39FF14] hover:bg-[#39FF14]/20 rounded-lg text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              title={`Download the current ${tab} view as CSV`}
            >
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Export CSV
            </button>
          )}
        </div>
      </header>

      <nav className="border-b border-zinc-800 bg-zinc-950">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap gap-1 overflow-x-auto">
          {[
            { id: 'overview' as TabId, label: 'Overview', icon: TrendingUp },
            { id: 'charts' as TabId, label: 'Charts & Projections', icon: BarChart3 },
            { id: 'transactions' as TabId, label: 'Transactions', icon: Receipt },
            { id: 'customers' as TabId, label: 'Customers', icon: Users },
            { id: 'vendors' as TabId, label: 'Vendors', icon: Truck },
            { id: 'reps' as TabId, label: 'Sales Reps', icon: UserCheck },
            { id: 'commissions' as TabId, label: 'Commissions', icon: DollarSign },
            { id: 'inventory' as TabId, label: 'Inventory', icon: Briefcase },
          ].map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setQ(''); clearTxFilters(); }}
                className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 -mb-px transition-colors whitespace-nowrap ${
                  active ? 'border-[#39FF14] text-[#39FF14]' : 'border-transparent text-zinc-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {error && (
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded text-red-300 text-sm">{error}</div>
        )}

        {/* Analytics hub shown only on the Overview tab. The hub is large
            enough that always-rendering it on every tab buried the active
            tab's content below it — making tab clicks feel like nothing
            happened. Overview is the natural home for the hub. */}
        {tab === 'overview' && <AnalyticsHub />}

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <>
            {!overview && loading && (
              <div className="text-center py-12 text-zinc-500">
                <Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading…
              </div>
            )}
            {overview && (
              <>
                {/* Executive summary — one-paragraph at-a-glance */}
                <section className="bg-gradient-to-br from-[#39FF14]/10 via-zinc-900 to-zinc-900 border border-[#39FF14]/30 rounded-xl p-5">
                  <h2 className="text-sm font-semibold text-[#39FF14] uppercase tracking-wide mb-2">
                    Executive Summary
                  </h2>
                  <p className="text-sm text-zinc-200 leading-relaxed">
                    <strong className="text-white">Lifetime revenue {fmtMoney(overview.lifetime.totalIncome)}</strong>
                    {' '}with{' '}
                    <strong className={overview.lifetime.netIncome >= 0 ? 'text-[#39FF14]' : 'text-red-400'}>
                      {fmtMoney(overview.lifetime.netIncome)} cumulative net income
                    </strong>
                    {' '}({fmtPercent(overview.lifetime.netIncome / overview.lifetime.totalIncome)} net margin,{' '}
                    {fmtPercent(overview.lifetime.grossMargin)} gross margin).
                    {' Top customer concentration is '}
                    {overview.concentration && overview.concentration.top5Share < 0.25 ? (
                      <span className="text-[#39FF14]">healthy at {fmtPercent(overview.concentration.top5Share)} (top 5)</span>
                    ) : overview.concentration ? (
                      <span className="text-amber-400">elevated at {fmtPercent(overview.concentration.top5Share)} (top 5)</span>
                    ) : null}
                    {' '}across {overview.concentration?.totalCustomers || 0}+ customers.
                    {overview.repConcentration && (
                      <>
                        {' '}Rep concentration is{' '}
                        {overview.repConcentration.top3Share > 0.4 ? (
                          <span className="text-amber-400">high at {fmtPercent(overview.repConcentration.top3Share)} (top 3 reps)</span>
                        ) : (
                          <span className="text-[#39FF14]">healthy at {fmtPercent(overview.repConcentration.top3Share)} (top 3 reps)</span>
                        )}.
                      </>
                    )}
                    {' '}Cash on hand:{' '}<strong className="text-white">{fmtMoney(overview.lifetime.cashOnHand)}</strong>
                    {' against '}<strong className="text-amber-300">{fmtMoney(overview.lifetime.accountsReceivable)}</strong> outstanding A/R.
                    {' '}Last 12 months: <strong className="text-[#39FF14]">{fmtMoney(overview.last12Revenue)}</strong> revenue,{' '}
                    <strong className="text-red-300">{fmtMoney(overview.last12Expense)}</strong> expense
                    {' '}({fmtMoney(overview.last12Revenue - overview.last12Expense)} net).
                  </p>
                </section>

                <section>
                  <h2 className="text-sm font-semibold text-[#39FF14] uppercase tracking-wide mb-2">Lifetime — All Time</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Kpi label="Revenue" value={fmtMoney(overview.lifetime.totalIncome)} sub={fmtMoneyExact(overview.lifetime.totalIncome)} highlight />
                    <Kpi label="Gross Profit" value={fmtMoney(overview.lifetime.grossProfit)} sub={`${fmtPercent(overview.lifetime.grossMargin)} margin`} />
                    <Kpi label="Net Income" value={fmtMoney(overview.lifetime.netIncome)} sub={fmtMoneyExact(overview.lifetime.netIncome)} negative={overview.lifetime.netIncome < 0} />
                    <Kpi label="A/R Outstanding" value={fmtMoney(overview.lifetime.accountsReceivable)} sub={fmtMoneyExact(overview.lifetime.accountsReceivable)} />
                  </div>
                </section>

                <section>
                  <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-2">Balance Sheet</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Kpi label="Cash on Hand" value={fmtMoney(overview.lifetime.cashOnHand)} />
                    <Kpi label="Total Assets" value={fmtMoney(overview.lifetime.assets)} />
                    <Kpi label="Liabilities" value={fmtMoney(overview.lifetime.liabilities)} />
                    <Kpi label="Equity" value={fmtMoney(overview.lifetime.equity)} />
                  </div>
                </section>

                <section>
                  <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-2">Where the Money Went</h2>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <Kpi label="Job Materials" value={fmtMoney(overview.lifetime.jobMaterialsTotal)} />
                    <Kpi label="Subcontractor Pay" value={fmtMoney(overview.lifetime.subcontractorPayTotal)} />
                    <Kpi label="Sales Commission" value={fmtMoney(overview.lifetime.salesCommissionTotal)} />
                    <Kpi label="Payroll" value={fmtMoney(overview.lifetime.payrollTotal)} />
                    <Kpi label="Advertising" value={fmtMoney(overview.lifetime.advertisingTotal)} />
                  </div>
                </section>

                <section>
                  <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-2">
                    Last 12 Months · Revenue {fmtMoney(overview.last12Revenue)} · Expense {fmtMoney(overview.last12Expense)}
                  </h2>
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                        <tr>
                          <th className="text-left py-2 px-3 font-medium">Month</th>
                          <th className="text-right py-2 px-3 font-medium">Revenue</th>
                          <th className="text-right py-2 px-3 font-medium">Expense</th>
                          <th className="text-right py-2 px-3 font-medium">Net</th>
                          <th className="text-right py-2 px-3 font-medium">Invoices</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800">
                        {overview.last12.map(m => {
                          const net = m.netRevenue - m.expense;
                          return (
                            <tr key={m.month} className="hover:bg-zinc-800/30">
                              <td className="py-2 px-3 font-mono text-xs text-zinc-300">{m.month}</td>
                              <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{fmtMoneyExact(m.netRevenue)}</td>
                              <td className="py-2 px-3 text-right tabular-nums text-red-400">{fmtMoneyExact(m.expense)}</td>
                              <td className={`py-2 px-3 text-right tabular-nums ${net >= 0 ? 'text-white' : 'text-red-400'}`}>{fmtMoneyExact(net)}</td>
                              <td className="py-2 px-3 text-right text-zinc-400">{m.invoiceCount}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Concentration risk */}
                {(overview.concentration || overview.repConcentration) && (
                  <section>
                    <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-2">
                      Concentration Risk
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      {overview.concentration && (
                        <>
                          <Kpi label="Top 5 customers" value={fmtPercent(overview.concentration.top5Share)} sub="of lifetime revenue" />
                          <Kpi label="Top 10 customers" value={fmtPercent(overview.concentration.top10Share)} sub="of lifetime revenue" />
                          <Kpi label="Top 20 customers" value={fmtPercent(overview.concentration.top20Share)} sub={`of ${overview.concentration.totalCustomers}+ customers`} />
                        </>
                      )}
                      {overview.repConcentration && (
                        <>
                          <Kpi label="Top 3 reps" value={fmtPercent(overview.repConcentration.top3Share)} sub="of lifetime invoiced" />
                          <Kpi label="Top 5 reps" value={fmtPercent(overview.repConcentration.top5Share)} sub="of lifetime invoiced" />
                        </>
                      )}
                    </div>
                  </section>
                )}

                {/* Year-over-year YTD comparison */}
                {yearComparison && yearComparison.rows.length > 0 && (
                  <section>
                    <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-2">
                      YTD Comparison Through Month {yearComparison.currentMonth}
                    </h2>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                          <tr>
                            <th className="text-left py-2 px-3 font-medium">Year</th>
                            <th className="text-right py-2 px-3 font-medium">YTD Revenue (same window)</th>
                            <th className="text-right py-2 px-3 font-medium">YTD Net</th>
                            <th className="text-right py-2 px-3 font-medium">YTD Invoices</th>
                            <th className="text-right py-2 px-3 font-medium">Full Year Revenue</th>
                            <th className="text-right py-2 px-3 font-medium">Full Year Net</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                          {yearComparison.rows.map(r => (
                            <tr key={r.year} className="hover:bg-zinc-800/30">
                              <td className="py-2 px-3 font-mono text-xs text-zinc-300">{r.year}</td>
                              <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{fmtMoneyExact(r.revenueYTD)}</td>
                              <td className={`py-2 px-3 text-right tabular-nums ${r.netYTD >= 0 ? 'text-white' : 'text-red-400'}`}>{fmtMoneyExact(r.netYTD)}</td>
                              <td className="py-2 px-3 text-right text-zinc-400">{r.invoicesYTD}</td>
                              <td className="py-2 px-3 text-right tabular-nums text-zinc-300">{fmtMoneyExact(r.revenueYear)}</td>
                              <td className={`py-2 px-3 text-right tabular-nums ${r.netYear >= 0 ? 'text-zinc-300' : 'text-red-400'}`}>{fmtMoneyExact(r.netYear)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                {/* Recent transactions */}
                {recent && recent.rows.length > 0 && (
                  <section>
                    <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-2">
                      Recent Activity — Last 20 Transactions
                    </h2>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                          <tr>
                            <th className="text-left py-2 px-3 font-medium">Date</th>
                            <th className="text-left py-2 px-3 font-medium">Type</th>
                            <th className="text-left py-2 px-3 font-medium">#</th>
                            <th className="text-right py-2 px-3 font-medium">Amount</th>
                            <th className="text-left py-2 px-3 font-medium">Party</th>
                            <th className="text-left py-2 px-3 font-medium">Rep</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                          {recent.rows.map((t, i) => (
                            <tr key={i} className="hover:bg-zinc-800/30">
                              <td className="py-2 px-3 font-mono text-xs text-zinc-300">{t.date}</td>
                              <td className="py-2 px-3 text-xs">{t.type}</td>
                              <td className="py-2 px-3 font-mono text-xs text-zinc-400">{t.num || '—'}</td>
                              <td className={`py-2 px-3 text-right tabular-nums ${t.amount >= 0 ? 'text-[#39FF14]' : 'text-red-400'}`}>
                                {fmtMoneyExact(t.amount)}
                              </td>
                              <td className="py-2 px-3 text-zinc-300">{t.party || '—'}</td>
                              <td className="py-2 px-3 text-xs text-zinc-400">{t.rep || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1">
                      Click <button onClick={() => setTab('transactions')} className="text-[#39FF14] underline">Transactions tab</button> for the full 56K-row ledger with filters.
                    </p>
                  </section>
                )}

                <section>
                  <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-2">Data Catalog</h2>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                    <Catalog label="Transactions" count={overview.counts.transactions} icon={Receipt} onClick={() => setTab('transactions')} />
                    <Catalog label="Customers" count={overview.counts.customers} icon={Users} onClick={() => setTab('customers')} extra="top 200" />
                    <Catalog label="Vendors" count={overview.counts.vendors} icon={Building2} onClick={() => setTab('vendors')} extra="top 200" />
                    <Catalog label="Sales Reps" count={overview.counts.reps} icon={UserCheck} onClick={() => setTab('reps')} />
                    <Catalog label="Commissions" count={overview.counts.commissionRows} icon={DollarSign} onClick={() => setTab('commissions')} />
                    <Catalog label="Months" count={overview.counts.months} icon={Briefcase} extra="of data" />
                  </div>
                </section>
              </>
            )}
          </>
        )}

        {/* CHARTS & PROJECTIONS */}
        {tab === 'charts' && (
          <>
            {!charts && loading && (
              <div className="text-center py-12 text-zinc-500">
                <Loader2 className="w-5 h-5 animate-spin inline mr-2" />Loading charts…
              </div>
            )}
            {charts && (
              <>
                {/* Projection cards */}
                <section>
                  <h2 className="text-sm font-semibold text-[#39FF14] uppercase tracking-wide mb-2">
                    {charts.projection.currentYear} Forecast — based on {charts.projection.daysElapsed}/{charts.projection.daysInYear} days of data
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Kpi label="YTD Revenue" value={fmtMoney(charts.projection.ytdRevenue)} sub={fmtMoneyExact(charts.projection.ytdRevenue)} highlight />
                    <Kpi label="Annualized (YTD pace)" value={fmtMoney(charts.projection.annualizedRevenue)} sub={fmtMoneyExact(charts.projection.annualizedRevenue)} />
                    <Kpi label="3-Month Run Rate × 12" value={fmtMoney(charts.projection.runRateAnnualized)} sub={`avg ${fmtMoneyExact(charts.projection.runRate3moAvg)}/mo`} />
                    <Kpi
                      label="vs Last Year Same Window"
                      value={`${charts.projection.yoyDeltaProrated >= 0 ? '+' : ''}${charts.projection.yoyDeltaProrated}%`}
                      sub={`LY: ${fmtMoneyExact(charts.projection.lastYearProrated)}`}
                      negative={charts.projection.yoyDeltaProrated < 0}
                    />
                  </div>
                </section>

                {/* Last 24 months — revenue / expense / net composed */}
                <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <LineChartIcon className="w-4 h-4 text-[#39FF14]" />
                    Last 24 Months — Revenue vs Expense
                  </h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={charts.last24} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis dataKey="month" stroke="#71717a" fontSize={11} />
                        <YAxis stroke="#71717a" fontSize={11} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                        <Tooltip
                          contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                          formatter={(v: number | undefined) => v != null ? fmtMoneyExact(v) : '—'}
                        />
                        <Legend />
                        <Bar dataKey="revenue" fill="#39FF14" name="Revenue" opacity={0.85} />
                        <Bar dataKey="expense" fill="#ef4444" name="Expense" opacity={0.75} />
                        <Line type="monotone" dataKey="net" stroke="#60a5fa" strokeWidth={2} name="Net" dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                {/* Annual revenue + net side by side */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-[#39FF14]" />
                      Annual Revenue (2018–{charts.projection.currentYear})
                    </h3>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={charts.byYear} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                          <XAxis dataKey="year" stroke="#71717a" fontSize={11} />
                          <YAxis stroke="#71717a" fontSize={11} tickFormatter={v => `$${(v / 1_000_000).toFixed(1)}M`} />
                          <Tooltip
                            contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                            formatter={(v: number | undefined) => v != null ? fmtMoneyExact(v) : '—'}
                          />
                          <Bar dataKey="revenue" name="Revenue">
                            {charts.byYear.map((y, i) => (
                              <Cell key={i} fill={y.year === charts.projection.currentYear ? '#fbbf24' : '#39FF14'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1">
                      {charts.projection.currentYear} is YTD (in-progress, shown amber).
                    </p>
                  </div>

                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-[#39FF14]" />
                      Annual Net Income
                    </h3>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={charts.byYear} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                          <XAxis dataKey="year" stroke="#71717a" fontSize={11} />
                          <YAxis stroke="#71717a" fontSize={11} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                          <Tooltip
                            contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                            formatter={(v: number | undefined) => v != null ? fmtMoneyExact(v) : '—'}
                          />
                          <Bar dataKey="net" name="Net">
                            {charts.byYear.map((y, i) => (
                              <Cell key={i} fill={y.net >= 0 ? '#39FF14' : '#ef4444'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </section>

                {/* Year race — each year's cumulative pace overlaid */}
                <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <LineChartIcon className="w-4 h-4 text-[#39FF14]" />
                    Year Race — Cumulative Revenue by Month, Every Year
                  </h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={charts.yearRace} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis dataKey="month" stroke="#71717a" fontSize={11} />
                        <YAxis stroke="#71717a" fontSize={11} tickFormatter={v => `$${(v / 1_000_000).toFixed(1)}M`} />
                        <Tooltip
                          contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                          formatter={(v: number | undefined) => v != null ? fmtMoneyExact(v) : '—'}
                        />
                        <Legend />
                        {charts.yearRaceYears.map((y, i) => {
                          const isCurrent = y === charts.projection.currentYear;
                          return (
                            <Line
                              key={y}
                              type="monotone"
                              dataKey={y}
                              stroke={isCurrent ? '#fbbf24' : PIE_COLORS[i % PIE_COLORS.length]}
                              strokeWidth={isCurrent ? 3 : 1.5}
                              dot={false}
                              name={y}
                            />
                          );
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Current year ({charts.projection.currentYear}) shown in amber/thick. Compare against any prior year at any month.
                  </p>
                </section>

                {/* Cumulative revenue area chart */}
                <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#39FF14]" />
                    Cumulative Revenue Since Inception
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={charts.cumulativeRevenue} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis dataKey="month" stroke="#71717a" fontSize={10} tickFormatter={(v: string) => v.slice(0, 4)} interval={11} />
                        <YAxis stroke="#71717a" fontSize={11} tickFormatter={v => `$${(v / 1_000_000).toFixed(0)}M`} />
                        <Tooltip
                          contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                          formatter={(v: number | undefined) => v != null ? fmtMoneyExact(v) : '—'}
                        />
                        <Area type="monotone" dataKey="cumulative" stroke="#39FF14" fill="#39FF14" fillOpacity={0.2} name="Cumulative Revenue" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                {/* Top reps + top vendors horizontal bars */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-[#39FF14]" />
                      Top 15 Sales Reps — Lifetime Invoiced
                    </h3>
                    <div className="h-96">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={charts.topReps} layout="vertical" margin={{ top: 8, right: 8, bottom: 8, left: 100 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                          <XAxis type="number" stroke="#71717a" fontSize={10} tickFormatter={v => `$${(v / 1_000_000).toFixed(1)}M`} />
                          <YAxis type="category" dataKey="name" stroke="#71717a" fontSize={10} width={100} />
                          <Tooltip
                            contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                            formatter={(v: number | undefined) => v != null ? fmtMoneyExact(v) : '—'}
                          />
                          <Bar dataKey="value" fill="#39FF14" name="Invoiced" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Truck className="w-4 h-4 text-[#39FF14]" />
                      Top 15 Vendors — Lifetime Spend
                    </h3>
                    <div className="h-96">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={charts.topVendors} layout="vertical" margin={{ top: 8, right: 8, bottom: 8, left: 100 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                          <XAxis type="number" stroke="#71717a" fontSize={10} tickFormatter={v => `$${(v / 1_000_000).toFixed(1)}M`} />
                          <YAxis type="category" dataKey="name" stroke="#71717a" fontSize={10} width={100} />
                          <Tooltip
                            contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                            formatter={(v: number | undefined) => v != null ? fmtMoneyExact(v) : '—'}
                          />
                          <Bar dataKey="value" fill="#fb7185" name="Spend" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </section>

                {/* COGS + Operating expense breakdown (pie charts) */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-[#39FF14]" />
                      COGS Breakdown — Lifetime
                    </h3>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={charts.cogsBreakdown}
                            dataKey="value"
                            nameKey="name"
                            outerRadius={100}
                            label={({ name, percent }: { name?: string; percent?: number }) =>
                              `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
                            labelLine={false}
                            fontSize={11}
                          >
                            {charts.cogsBreakdown.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                            formatter={(v: number | undefined) => v != null ? fmtMoneyExact(v) : '—'}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-[#39FF14]" />
                      Operating Expense Breakdown — Lifetime
                    </h3>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={charts.expenseBreakdown}
                            dataKey="value"
                            nameKey="name"
                            outerRadius={100}
                            label={({ name, percent }: { name?: string; percent?: number }) =>
                              `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
                            labelLine={false}
                            fontSize={11}
                          >
                            {charts.expenseBreakdown.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                            formatter={(v: number | undefined) => v != null ? fmtMoneyExact(v) : '—'}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </section>

                {/* Sales activity from Monday meeting numbers */}
                <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#39FF14]" />
                    Sales Activity — Last 26 Monday Meetings
                  </h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={charts.salesActivityWeeks} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis dataKey="date" stroke="#71717a" fontSize={10} interval={2} />
                        <YAxis yAxisId="left" stroke="#71717a" fontSize={11} />
                        <YAxis yAxisId="right" orientation="right" stroke="#71717a" fontSize={11} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                        <Tooltip
                          contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                        />
                        <Legend />
                        <Bar yAxisId="left" dataKey="inspected" fill="#60a5fa" name="Inspected" />
                        <Bar yAxisId="left" dataKey="signed" fill="#39FF14" name="Signed" />
                        <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#fbbf24" strokeWidth={2} name="Revenue $" dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                {/* Seasonality chart */}
                <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#39FF14]" />
                    Seasonality — Average Revenue per Calendar Month (across all years)
                  </h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={charts.seasonality} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis dataKey="month" stroke="#71717a" fontSize={11} />
                        <YAxis stroke="#71717a" fontSize={11} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                        <Tooltip
                          contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                          formatter={(v: number | undefined) => v != null ? fmtMoneyExact(v) : '—'}
                        />
                        <Legend />
                        <Bar dataKey="avgRevenue" fill="#39FF14" name="Avg revenue/month" />
                        <Bar dataKey="avgExpense" fill="#ef4444" name="Avg expense/month" opacity={0.7} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Higher bars = historically stronger months. Useful for spotting whether the current month is on/off the seasonal pattern.
                  </p>
                </section>

                {/* Sales activity by year */}
                <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[#39FF14]" />
                    Sales Activity by Year — Monday Meeting Numbers
                  </h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={charts.salesActivityByYear} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis dataKey="year" stroke="#71717a" fontSize={11} />
                        <YAxis yAxisId="left" stroke="#71717a" fontSize={11} />
                        <YAxis yAxisId="right" orientation="right" stroke="#71717a" fontSize={11} tickFormatter={v => `$${(v / 1_000_000).toFixed(1)}M`} />
                        <Tooltip
                          contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                        />
                        <Legend />
                        <Bar yAxisId="left" dataKey="inspected" fill="#60a5fa" name="Inspected" />
                        <Bar yAxisId="left" dataKey="signed" fill="#39FF14" name="Signed" />
                        <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#fbbf24" strokeWidth={2} name="Revenue $" dot={true} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                {/* Top customers + commissions by year */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#39FF14]" />
                      Top 15 Customers — Lifetime Invoiced
                    </h3>
                    <div className="h-96">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={charts.topCustomers} layout="vertical" margin={{ top: 8, right: 8, bottom: 8, left: 120 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                          <XAxis type="number" stroke="#71717a" fontSize={10} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
                          <YAxis type="category" dataKey="name" stroke="#71717a" fontSize={10} width={120} />
                          <Tooltip
                            contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                            formatter={(v: number | undefined) => v != null ? fmtMoneyExact(v) : '—'}
                          />
                          <Bar dataKey="value" fill="#60a5fa" name="Invoiced" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-[#39FF14]" />
                      Commission Payouts by Year
                    </h3>
                    <div className="h-96">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={charts.commissionsByYear} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                          <XAxis dataKey="year" stroke="#71717a" fontSize={11} />
                          <YAxis stroke="#71717a" fontSize={11} tickFormatter={v => `$${(v / 1_000_000).toFixed(1)}M`} />
                          <Tooltip
                            contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}
                            formatter={(v: number | undefined) => v != null ? fmtMoneyExact(v) : '—'}
                          />
                          <Bar dataKey="total" fill="#fbbf24" name="Commissions Paid" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </section>
              </>
            )}
          </>
        )}

        {/* TRANSACTIONS */}
        {tab === 'transactions' && (
          <>
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Filter className="w-4 h-4 text-[#39FF14]" /> Filters
                </h2>
                <button onClick={clearTxFilters} className="text-xs text-zinc-400 hover:text-white flex items-center gap-1">
                  <X className="w-3 h-3" /> Clear all
                </button>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text" value={q} onChange={e => setQ(e.target.value)}
                  placeholder="Search check #, customer, vendor, rep, project, account…"
                  className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                <select value={txType} onChange={e => setTxType(e.target.value)} className="px-2 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm">
                  <option value="">All types</option>
                  {transactionsData?.facets?.types.map(([t, n]) => (
                    <option key={t} value={t}>{t} ({n})</option>
                  ))}
                </select>
                <input type="text" value={txRep} onChange={e => setTxRep(e.target.value)} placeholder="Sales rep" className="px-2 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm" />
                <input type="text" value={txCustomer} onChange={e => setTxCustomer(e.target.value)} placeholder="Customer" className="px-2 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm" />
                <input type="text" value={txVendor} onChange={e => setTxVendor(e.target.value)} placeholder="Vendor" className="px-2 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm" />
                <div className="relative">
                  <Calendar className="w-3.5 h-3.5 text-zinc-500 absolute left-2 top-1/2 -translate-y-1/2" />
                  <input type="date" value={txFrom} onChange={e => setTxFrom(e.target.value)} className="w-full pl-7 pr-2 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm" />
                </div>
                <div className="relative">
                  <Calendar className="w-3.5 h-3.5 text-zinc-500 absolute left-2 top-1/2 -translate-y-1/2" />
                  <input type="date" value={txTo} onChange={e => setTxTo(e.target.value)} className="w-full pl-7 pr-2 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm" />
                </div>
              </div>
            </section>

            {transactionsData && (
              <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi label="Matches" value={transactionsData.total.toLocaleString()} />
                <Kpi label="Net (signed)" value={fmtMoney(transactionsData.totals?.netAmount || 0)} sub={fmtMoneyExact(transactionsData.totals?.netAmount || 0)} negative={(transactionsData.totals?.netAmount || 0) < 0} />
                <Kpi label="Absolute" value={fmtMoney(transactionsData.totals?.absTotal || 0)} sub={fmtMoneyExact(transactionsData.totals?.absTotal || 0)} />
                <Kpi label="Page" value={`${page} / ${totalPages}`} />
              </section>
            )}

            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Date</th>
                      <th className="text-left py-2 px-3 font-medium">Type</th>
                      <th className="text-left py-2 px-3 font-medium">#</th>
                      <th className="text-right py-2 px-3 font-medium">Amount</th>
                      <th className="text-left py-2 px-3 font-medium">Customer / Vendor</th>
                      <th className="text-left py-2 px-3 font-medium">Rep</th>
                      <th className="text-left py-2 px-3 font-medium">Account</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {loading && (
                      <tr><td colSpan={7} className="py-6 text-center text-zinc-500"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Loading…</td></tr>
                    )}
                    {!loading && transactionsData?.rows.length === 0 && (
                      <tr><td colSpan={7} className="py-6 text-center text-zinc-500">No matches.</td></tr>
                    )}
                    {!loading && transactionsData?.rows.map((t, i) => (
                      <tr key={`${t.date}-${t.type}-${t.num}-${i}`} className="hover:bg-zinc-800/30">
                        <td className="py-2 px-3 font-mono text-xs text-zinc-300">{t.date}</td>
                        <td className="py-2 px-3 text-xs">{t.type}</td>
                        <td className="py-2 px-3 font-mono text-xs text-zinc-400">{t.num || '—'}</td>
                        <td className={`py-2 px-3 text-right tabular-nums ${t.amount >= 0 ? 'text-[#39FF14]' : 'text-red-400'}`}>{fmtMoneyExact(t.amount)}</td>
                        <td className="py-2 px-3">
                          {t.customer && <div className="text-zinc-200">{t.customer}</div>}
                          {t.vendor && <div className="text-zinc-400 text-xs">{t.vendor}</div>}
                          {t.employee && <div className="text-zinc-500 text-xs">emp: {t.employee}</div>}
                          {!t.customer && !t.vendor && !t.employee && <span className="text-zinc-600">—</span>}
                        </td>
                        <td className="py-2 px-3 text-xs">{t.salesRep || <span className="text-zinc-600">—</span>}</td>
                        <td className="py-2 px-3 text-xs text-zinc-400">{t.accountType || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {transactionsData && totalPages > 1 && (
                <Pagination page={page} totalPages={totalPages} total={transactionsData.total} pageSize={pageSize} loading={loading} setPage={setPage} />
              )}
            </section>
          </>
        )}

        {/* INVENTORY */}
        {tab === 'inventory' && (
          <>
            {inventory && (
              <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Kpi label="Items" value={inventory.total.toString()} />
                <Kpi label="Stock Value (cost)" value={fmtMoney(inventory.summary.totalStockValue)} sub={fmtMoneyExact(inventory.summary.totalStockValue)} highlight />
                <Kpi label="Potential Revenue" value={fmtMoney(inventory.summary.totalPotentialRevenue)} sub={`${inventory.summary.lowStockCount} low-stock`} />
              </section>
            )}
            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text" value={q} onChange={e => setQ(e.target.value)}
                placeholder="Search inventory by name / category / supplier…"
                className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
              />
            </div>
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Item</th>
                      <th className="text-left py-2 px-3 font-medium">Category</th>
                      <th className="text-left py-2 px-3 font-medium">Supplier</th>
                      <th className="text-right py-2 px-3 font-medium">Qty</th>
                      <th className="text-right py-2 px-3 font-medium">Cost</th>
                      <th className="text-right py-2 px-3 font-medium">Price</th>
                      <th className="text-right py-2 px-3 font-medium">Stock value</th>
                      <th className="text-right py-2 px-3 font-medium">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {loading && (
                      <tr><td colSpan={8} className="py-6 text-center text-zinc-500"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Loading…</td></tr>
                    )}
                    {!loading && inventory?.rows.length === 0 && (
                      <tr><td colSpan={8} className="py-6 text-center text-zinc-500">No items.</td></tr>
                    )}
                    {!loading && inventory?.rows.map(r => (
                      <tr key={r.id} className={`hover:bg-zinc-800/30 ${r.lowStock ? 'bg-amber-500/5' : ''}`}>
                        <td className="py-2 px-3">
                          <div className="font-medium">{r.name}</div>
                          {r.description && <div className="text-xs text-zinc-500">{r.description}</div>}
                        </td>
                        <td className="py-2 px-3 text-xs text-zinc-400">{r.category}</td>
                        <td className="py-2 px-3 text-xs text-zinc-400">{r.supplier}</td>
                        <td className={`py-2 px-3 text-right tabular-nums ${r.lowStock ? 'text-amber-400' : 'text-zinc-300'}`}>
                          {r.qty} {r.unit}
                          {r.lowStock && <div className="text-[10px] text-amber-500">low (min {r.minStock})</div>}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-300">{fmtMoneyExact(r.cost)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-300">{fmtMoneyExact(r.price)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-[#39FF14]">{fmtMoneyExact(r.stockValue)}</td>
                        <td className="py-2 px-3 text-right tabular-nums text-zinc-400">{r.margin}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {/* Other search tabs */}
        {tab !== 'overview' && tab !== 'transactions' && tab !== 'charts' && tab !== 'inventory' && (
          <>
            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text" value={q} onChange={e => setQ(e.target.value)}
                placeholder={`Search ${tab}…`}
                className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-[#39FF14]/50"
              />
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                {tab === 'customers' && (
                  <SimpleTable
                    columns={['Customer', 'Lifetime invoiced', 'Invoices']}
                    rows={(customers?.rows || []).map(c => [c.customer, fmtMoneyExact(c.total), String(c.invoiceCount)])}
                    valueColors={['', 'text-[#39FF14]', '']}
                    loading={loading}
                  />
                )}
                {tab === 'vendors' && (
                  <SimpleTable
                    columns={['Vendor', 'Lifetime spend', 'Transactions']}
                    rows={(vendors?.rows || []).map(v => [v.vendor, fmtMoneyExact(v.total), String(v.txCount)])}
                    valueColors={['', 'text-red-300', '']}
                    loading={loading}
                  />
                )}
                {tab === 'reps' && (
                  <SimpleTable
                    columns={['Rep', 'Lifetime invoiced', 'Invoices', 'Avg invoice', 'Commission paid', 'Comm txns']}
                    rows={(reps?.rows || []).map(r => [r.rep, fmtMoneyExact(r.invoiceTotal), String(r.invoiceCount), fmtMoneyExact(r.avgInvoice), fmtMoneyExact(r.commissionTotal), String(r.commissionCount)])}
                    valueColors={['', 'text-[#39FF14]', '', '', 'text-amber-300', '']}
                    loading={loading}
                  />
                )}
                {tab === 'commissions' && (
                  <SimpleTable
                    columns={['Date', 'Rep', 'Amount', 'Check #', 'Customer / Entity']}
                    rows={(commissionsData?.rows || []).map(c => [c.date, c.salesRep, fmtMoneyExact(c.amount), c.jobNumber || '—', c.customer || '—'])}
                    valueColors={['', '', c => (c?.toString().startsWith('-') ? 'text-red-400' : 'text-[#39FF14]'), '', '']}
                    loading={loading}
                  />
                )}
              </div>
              {currentTotal && totalPages > 1 && (
                <Pagination page={page} totalPages={totalPages} total={currentTotal} pageSize={pageSize} loading={loading} setPage={setPage} />
              )}
            </div>
          </>
        )}

      </main>
    </div>
  );
}

// useSearchParams must live inside a Suspense boundary so Next.js doesn't
// bail out of static optimization at build time.
export default function ChrisViewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <ChrisViewPageInner />
    </Suspense>
  );
}

function Kpi({ label, value, sub, highlight, negative }: { label: string; value: string; sub?: string; highlight?: boolean; negative?: boolean }) {
  return (
    <div className={`rounded-xl p-4 border ${highlight ? 'bg-gradient-to-br from-[#39FF14]/10 to-zinc-900 border-[#39FF14]/30' : 'bg-zinc-900 border-zinc-800'}`}>
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${negative ? 'text-red-400' : 'text-white'}`}>{value}</div>
      {sub && <div className="text-[10px] text-zinc-500 mt-1">{sub}</div>}
    </div>
  );
}

function Catalog({ label, count, icon: Icon, onClick, extra }: { label: string; count: number; icon: React.ComponentType<{ className?: string }>; onClick?: () => void; extra?: string }) {
  return (
    <button onClick={onClick} disabled={!onClick} className={`bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-left transition-colors ${onClick ? 'hover:border-[#39FF14]/40 cursor-pointer' : 'opacity-70'}`}>
      <div className="flex items-center gap-2 text-zinc-400">
        <Icon className="w-4 h-4" />
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-xl font-bold text-white mt-1">{count.toLocaleString()}</div>
      {extra && <div className="text-[10px] text-zinc-500 mt-0.5">{extra}</div>}
    </button>
  );
}

function SimpleTable({
  columns, rows, valueColors, loading,
}: {
  columns: string[];
  rows: string[][];
  valueColors?: Array<string | ((v: string) => string)>;
  loading: boolean;
}) {
  return (
    <table className="w-full text-sm">
      <thead className="text-xs text-zinc-500 uppercase tracking-wide bg-zinc-950 border-b border-zinc-800">
        <tr>
          {columns.map((c, i) => (
            <th key={c} className={`py-2 px-3 font-medium ${i === 0 ? 'text-left' : 'text-right'}`}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-800">
        {loading && (
          <tr><td colSpan={columns.length} className="py-6 text-center text-zinc-500"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Loading…</td></tr>
        )}
        {!loading && rows.length === 0 && (
          <tr><td colSpan={columns.length} className="py-6 text-center text-zinc-500">No matches.</td></tr>
        )}
        {!loading && rows.map((row, idx) => (
          <tr key={idx} className="hover:bg-zinc-800/30">
            {row.map((cell, cidx) => {
              const color = valueColors?.[cidx];
              const cls = typeof color === 'function' ? color(cell) : color || '';
              const isMoney = cidx > 0 && /^[\-$]/.test(cell);
              return (
                <td key={cidx} className={`py-2 px-3 ${cidx === 0 ? 'text-left font-medium' : `text-right ${isMoney ? 'tabular-nums' : ''}`} ${cls}`}>
                  {cell}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Pagination({ page, totalPages, total, pageSize, loading, setPage }: {
  page: number; totalPages: number; total: number; pageSize: number; loading: boolean;
  setPage: (fn: (p: number) => number) => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800 text-sm">
      <div className="text-zinc-400">
        Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total.toLocaleString()}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1 || loading}
          className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 flex items-center gap-1">
          <ChevronLeft className="w-4 h-4" /> Prev
        </button>
        <span className="text-zinc-400">{page} / {totalPages}</span>
        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages || loading}
          className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-300 hover:bg-zinc-700 disabled:opacity-40 flex items-center gap-1">
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
