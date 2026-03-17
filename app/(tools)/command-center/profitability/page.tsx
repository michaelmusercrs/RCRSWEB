'use client';

/**
 * RCRS Command Center - Job Profitability Dashboard
 *
 * Per-job cost tracking, margin analysis, trend charts,
 * and rep-level profitability breakdowns.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Loader2,
  Users,
  Package,
  Wrench,
  Building2,
  Layers,
  Eye,
  Calendar,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types (mirroring service types for client use)
// ---------------------------------------------------------------------------

interface CostItem {
  id: string;
  description: string;
  category: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  vendor?: string;
  invoiceNumber?: string;
  date: string;
}

interface JobCosts {
  jobId: string;
  customerName: string;
  address: string;
  repSlug: string;
  repName: string;
  contractAmount: number;
  additionalWork: number;
  insurancePayout?: number;
  totalRevenue: number;
  materials: CostItem[];
  labor: CostItem[];
  subcontractors: CostItem[];
  overhead: CostItem[];
  other: CostItem[];
  totalCosts: number;
  grossProfit: number;
  grossMargin: number;
  netProfit: number;
  netMargin: number;
  commissionRate: number;
  commissionAmount: number;
  status: 'estimating' | 'in_progress' | 'completed' | 'reconciled';
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface ProfitabilityAnalytics {
  totalJobs: number;
  totalRevenue: number;
  totalCosts: number;
  totalProfit: number;
  avgGrossMargin: number;
  avgNetMargin: number;
  byRep: {
    repSlug: string;
    repName: string;
    jobs: number;
    revenue: number;
    profit: number;
    margin: number;
  }[];
  byMonth: {
    month: string;
    revenue: number;
    costs: number;
    profit: number;
    margin: number;
  }[];
  byMaterial: {
    material: string;
    totalCost: number;
    avgPerJob: number;
  }[];
  mostProfitable: {
    jobId: string;
    customerName: string;
    margin: number;
  }[];
  leastProfitable: {
    jobId: string;
    customerName: string;
    margin: number;
  }[];
}

type SortField = 'customerName' | 'totalRevenue' | 'totalCosts' | 'netProfit' | 'netMargin' | 'status' | 'createdAt';
type SortDir = 'asc' | 'desc';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    estimating: 'Estimating',
    in_progress: 'In Progress',
    completed: 'Completed',
    reconciled: 'Reconciled',
  };
  return map[s] || s;
}

function statusColor(s: string): string {
  const map: Record<string, string> = {
    estimating: 'bg-yellow-500/20 text-yellow-400',
    in_progress: 'bg-blue-500/20 text-blue-400',
    completed: 'bg-green-500/20 text-green-400',
    reconciled: 'bg-purple-500/20 text-purple-400',
  };
  return map[s] || 'bg-zinc-500/20 text-zinc-400';
}

function marginColor(margin: number, target: number = 25): string {
  if (margin >= target) return 'text-green-400';
  if (margin >= target * 0.7) return 'text-yellow-400';
  return 'text-red-400';
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
  color = 'lime',
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof DollarSign;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'lime' | 'blue' | 'purple' | 'orange' | 'red';
}) {
  const bg: Record<string, string> = {
    lime: 'bg-lime-500/10 text-lime-400',
    blue: 'bg-blue-500/10 text-blue-400',
    purple: 'bg-purple-500/10 text-purple-400',
    orange: 'bg-orange-500/10 text-orange-400',
    red: 'bg-red-500/10 text-red-400',
  };

  return (
    <div className="rounded-xl border border-white/10 bg-neutral-900 p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-400">{label}</p>
          <p className="mt-2 text-2xl font-bold text-white truncate">{value}</p>
          {sub && (
            <div className="mt-1.5 flex items-center gap-1 text-sm">
              {trend === 'up' && <ArrowUpRight size={14} className="text-green-400" />}
              {trend === 'down' && <ArrowDownRight size={14} className="text-red-400" />}
              <span className={trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-zinc-500'}>
                {sub}
              </span>
            </div>
          )}
        </div>
        <div className={`rounded-lg p-3 ${bg[color]}`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Text-based bar chart for monthly revenue vs costs
// ---------------------------------------------------------------------------

function MonthlyTrendChart({ data }: { data: ProfitabilityAnalytics['byMonth'] }) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-zinc-500">No monthly data available</p>;
  }

  const maxVal = Math.max(...data.map((d) => Math.max(d.revenue, d.costs)), 1);

  return (
    <div className="space-y-3">
      {data.slice(-12).map((m) => {
        const revW = Math.max((m.revenue / maxVal) * 100, 2);
        const costW = Math.max((m.costs / maxVal) * 100, 2);
        const monthLabel = new Date(m.month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

        return (
          <div key={m.month} className="group">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-400 w-16">{monthLabel}</span>
              <div className="flex items-center gap-3">
                <span className="text-green-400">{fmt(m.profit)}</span>
                <span className="text-zinc-500">{fmtPct(m.margin)}</span>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-14 text-right text-[10px] text-zinc-600">Rev</span>
                <div className="flex-1 h-3 rounded-full bg-neutral-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#39FF14]/60 transition-all"
                    style={{ width: `${revW}%` }}
                  />
                </div>
                <span className="w-16 text-right text-[10px] text-zinc-500">{fmt(m.revenue)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-14 text-right text-[10px] text-zinc-600">Cost</span>
                <div className="flex-1 h-3 rounded-full bg-neutral-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-red-500/50 transition-all"
                    style={{ width: `${costW}%` }}
                  />
                </div>
                <span className="w-16 text-right text-[10px] text-zinc-500">{fmt(m.costs)}</span>
              </div>
            </div>
          </div>
        );
      })}
      <div className="flex items-center justify-center gap-6 pt-2 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded-full bg-[#39FF14]/60" /> Revenue
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded-full bg-red-500/50" /> Costs
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cost Category Breakdown
// ---------------------------------------------------------------------------

function CostBreakdown({ jobs }: { jobs: JobCosts[] }) {
  const totals = useMemo(() => {
    let materials = 0, labor = 0, subs = 0, overhead = 0, other = 0;
    jobs.forEach((j) => {
      materials += j.materials.reduce((s, c) => s + c.totalCost, 0);
      labor += j.labor.reduce((s, c) => s + c.totalCost, 0);
      subs += j.subcontractors.reduce((s, c) => s + c.totalCost, 0);
      overhead += j.overhead.reduce((s, c) => s + c.totalCost, 0);
      other += j.other.reduce((s, c) => s + c.totalCost, 0);
    });
    return { materials, labor, subs, overhead, other };
  }, [jobs]);

  const grand = totals.materials + totals.labor + totals.subs + totals.overhead + totals.other;
  if (grand === 0) {
    return <p className="py-8 text-center text-sm text-zinc-500">No cost data available</p>;
  }

  const cats = [
    { label: 'Materials', value: totals.materials, icon: Package, color: 'bg-blue-500' },
    { label: 'Labor', value: totals.labor, icon: Users, color: 'bg-green-500' },
    { label: 'Subcontractors', value: totals.subs, icon: Wrench, color: 'bg-purple-500' },
    { label: 'Overhead', value: totals.overhead, icon: Building2, color: 'bg-orange-500' },
    { label: 'Other', value: totals.other, icon: Layers, color: 'bg-zinc-500' },
  ];

  return (
    <div className="space-y-3">
      {cats.map((c) => {
        const pct = (c.value / grand) * 100;
        return (
          <div key={c.label} className="flex items-center gap-3">
            <c.icon size={16} className="shrink-0 text-zinc-400" />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-zinc-300">{c.label}</span>
                <span className="text-white font-medium">{fmt(c.value)} <span className="text-zinc-500 text-xs">({pct.toFixed(1)}%)</span></span>
              </div>
              <div className="h-2 w-full rounded-full bg-neutral-800 overflow-hidden">
                <div className={`h-full rounded-full ${c.color}/60 transition-all`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        );
      })}
      <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-3 text-sm font-semibold">
        <span className="text-zinc-400">Total Costs</span>
        <span className="text-white">{fmt(grand)}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Job Detail Modal
// ---------------------------------------------------------------------------

function JobDetailModal({ job, onClose }: { job: JobCosts; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-white/10 bg-neutral-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">{job.customerName}</h3>
            <p className="text-sm text-zinc-400">{job.address}</p>
            <p className="text-xs text-zinc-500 mt-1">Rep: {job.repName} &middot; {statusLabel(job.status)}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-500 hover:text-white hover:bg-white/10 text-xl leading-none">&times;</button>
        </div>

        {/* Revenue breakdown */}
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-white/5 bg-neutral-800 p-3 text-center">
            <p className="text-xs text-zinc-500">Contract</p>
            <p className="text-sm font-bold text-white">{fmt(job.contractAmount)}</p>
          </div>
          <div className="rounded-lg border border-white/5 bg-neutral-800 p-3 text-center">
            <p className="text-xs text-zinc-500">Add&apos;l Work</p>
            <p className="text-sm font-bold text-white">{fmt(job.additionalWork)}</p>
          </div>
          <div className="rounded-lg border border-white/5 bg-neutral-800 p-3 text-center">
            <p className="text-xs text-zinc-500">Insurance</p>
            <p className="text-sm font-bold text-white">{fmt(job.insurancePayout || 0)}</p>
          </div>
        </div>

        {/* Margins */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-white/5 bg-neutral-800 p-3">
            <p className="text-xs text-zinc-500">Gross Margin</p>
            <p className={`text-lg font-bold ${marginColor(job.grossMargin)}`}>{fmtPct(job.grossMargin)}</p>
            <p className="text-xs text-zinc-500">{fmt(job.grossProfit)} profit</p>
          </div>
          <div className="rounded-lg border border-white/5 bg-neutral-800 p-3">
            <p className="text-xs text-zinc-500">Net Margin</p>
            <p className={`text-lg font-bold ${marginColor(job.netMargin)}`}>{fmtPct(job.netMargin)}</p>
            <p className="text-xs text-zinc-500">{fmt(job.netProfit)} profit</p>
          </div>
        </div>

        {/* Commission */}
        <div className="mb-4 rounded-lg border border-white/5 bg-neutral-800 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">Commission ({(job.commissionRate * 100).toFixed(0)}%)</span>
            <span className="text-sm font-bold text-[#39FF14]">{fmt(job.commissionAmount)}</span>
          </div>
        </div>

        {/* Cost items by category */}
        {(['materials', 'labor', 'subcontractors', 'overhead', 'other'] as const).map((cat) => {
          const items = job[cat];
          if (items.length === 0) return null;
          const catLabel = cat.charAt(0).toUpperCase() + cat.slice(1);
          return (
            <div key={cat} className="mb-3">
              <h4 className="mb-2 text-sm font-semibold text-zinc-300">{catLabel}</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/5 text-zinc-500">
                      <th className="py-1.5 text-left font-medium">Description</th>
                      <th className="py-1.5 text-right font-medium">Qty</th>
                      <th className="py-1.5 text-right font-medium">Unit</th>
                      <th className="py-1.5 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b border-white/5">
                        <td className="py-1.5 text-zinc-300">{item.description}</td>
                        <td className="py-1.5 text-right text-zinc-400">{item.quantity}</td>
                        <td className="py-1.5 text-right text-zinc-400">{fmt(item.unitCost)}</td>
                        <td className="py-1.5 text-right text-white font-medium">{fmt(item.totalCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

        {job.notes && (
          <div className="mt-3 rounded-lg bg-neutral-800 p-3">
            <p className="text-xs text-zinc-500 mb-1">Notes</p>
            <p className="text-sm text-zinc-300">{job.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

const TARGET_MARGIN = 25;

export default function ProfitabilityPage() {
  // Data state
  const [jobs, setJobs] = useState<JobCosts[]>([]);
  const [analytics, setAnalytics] = useState<ProfitabilityAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Detail view
  const [selectedJob, setSelectedJob] = useState<JobCosts | null>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<'overview' | 'jobs' | 'reps'>('overview');

  // ---------------------------------------------------------------------------
  // Fetch data
  // ---------------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (dateStart) qs.set('startDate', dateStart);
      if (dateEnd) qs.set('endDate', dateEnd);

      const [jobsRes, analyticsRes] = await Promise.all([
        fetch('/api/profitability'),
        fetch(`/api/profitability/analytics?${qs.toString()}`),
      ]);

      if (!jobsRes.ok || !analyticsRes.ok) throw new Error('Failed to fetch profitability data');

      const jobsData = await jobsRes.json();
      const analyticsData = await analyticsRes.json();

      setJobs(jobsData.data || []);
      setAnalytics(analyticsData.data || null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [dateStart, dateEnd]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---------------------------------------------------------------------------
  // Filtered & sorted jobs
  // ---------------------------------------------------------------------------

  const filteredJobs = useMemo(() => {
    let list = [...jobs];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (j) =>
          j.customerName.toLowerCase().includes(q) ||
          j.address.toLowerCase().includes(q) ||
          j.repName.toLowerCase().includes(q) ||
          j.jobId.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'all') {
      list = list.filter((j) => j.status === statusFilter);
    }

    if (dateStart) list = list.filter((j) => j.createdAt >= dateStart);
    if (dateEnd) list = list.filter((j) => j.createdAt <= dateEnd);

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'customerName':
          cmp = a.customerName.localeCompare(b.customerName);
          break;
        case 'totalRevenue':
          cmp = a.totalRevenue - b.totalRevenue;
          break;
        case 'totalCosts':
          cmp = a.totalCosts - b.totalCosts;
          break;
        case 'netProfit':
          cmp = a.netProfit - b.netProfit;
          break;
        case 'netMargin':
          cmp = a.netMargin - b.netMargin;
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
        case 'createdAt':
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [jobs, search, statusFilter, dateStart, dateEnd, sortField, sortDir]);

  // Margin alerts: jobs below target margin
  const alertJobs = useMemo(
    () => jobs.filter((j) => j.netMargin < TARGET_MARGIN && j.status !== 'estimating'),
    [jobs]
  );

  // ---------------------------------------------------------------------------
  // Sort handler
  // ---------------------------------------------------------------------------

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronDown size={12} className="text-zinc-600" />;
    return sortDir === 'asc' ? (
      <ChevronUp size={12} className="text-[#39FF14]" />
    ) : (
      <ChevronDown size={12} className="text-[#39FF14]" />
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#39FF14]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
        <AlertTriangle size={32} className="text-red-400" />
        <p className="text-zinc-400">{error}</p>
        <button onClick={fetchData} className="rounded-lg bg-[#39FF14]/20 px-4 py-2 text-sm font-medium text-[#39FF14] hover:bg-[#39FF14]/30">
          Retry
        </button>
      </div>
    );
  }

  const an = analytics;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Job Profitability</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Track costs, margins, and profitability across all jobs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-zinc-300 hover:bg-neutral-800"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Revenue"
          value={an ? fmt(an.totalRevenue) : '--'}
          sub={an ? `${an.totalJobs} jobs` : undefined}
          icon={DollarSign}
          color="lime"
        />
        <KpiCard
          label="Total Costs"
          value={an ? fmt(an.totalCosts) : '--'}
          sub={an && an.totalRevenue > 0 ? `${((an.totalCosts / an.totalRevenue) * 100).toFixed(1)}% of revenue` : undefined}
          icon={TrendingDown}
          color="red"
        />
        <KpiCard
          label="Net Profit"
          value={an ? fmt(an.totalProfit) : '--'}
          sub={an ? `${fmtPct(an.avgNetMargin)} avg margin` : undefined}
          trend={an && an.totalProfit > 0 ? 'up' : an && an.totalProfit < 0 ? 'down' : 'neutral'}
          icon={TrendingUp}
          color="blue"
        />
        <KpiCard
          label="Avg Gross Margin"
          value={an ? fmtPct(an.avgGrossMargin) : '--'}
          sub={an ? `Target: ${fmtPct(TARGET_MARGIN)}` : undefined}
          trend={an && an.avgGrossMargin >= TARGET_MARGIN ? 'up' : 'down'}
          icon={BarChart3}
          color="purple"
        />
      </div>

      {/* Margin Alerts */}
      {alertJobs.length > 0 && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={18} className="text-yellow-400" />
            <h3 className="text-sm font-semibold text-yellow-400">
              Margin Alerts &mdash; {alertJobs.length} job{alertJobs.length > 1 ? 's' : ''} below {TARGET_MARGIN}% target
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {alertJobs.slice(0, 8).map((j) => (
              <button
                key={j.jobId}
                onClick={() => setSelectedJob(j)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-yellow-500/10 px-3 py-1.5 text-xs font-medium text-yellow-300 hover:bg-yellow-500/20"
              >
                {j.customerName}
                <span className={`font-bold ${marginColor(j.netMargin)}`}>{fmtPct(j.netMargin)}</span>
              </button>
            ))}
            {alertJobs.length > 8 && (
              <span className="inline-flex items-center px-2 py-1.5 text-xs text-zinc-500">
                +{alertJobs.length - 8} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-neutral-900 border border-white/10 p-1 w-fit">
        {(['overview', 'jobs', 'reps'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-[#39FF14]/20 text-[#39FF14]'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab === 'overview' ? 'Overview' : tab === 'jobs' ? 'Job Breakdown' : 'By Rep'}
          </button>
        ))}
      </div>

      {/* ======= Overview Tab ======= */}
      {activeTab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Monthly Trend */}
          <div className="rounded-xl border border-white/10 bg-neutral-900 p-5">
            <h2 className="mb-4 text-lg font-semibold text-white">Monthly Revenue vs Costs</h2>
            <MonthlyTrendChart data={an?.byMonth || []} />
          </div>

          {/* Cost Category Breakdown */}
          <div className="rounded-xl border border-white/10 bg-neutral-900 p-5">
            <h2 className="mb-4 text-lg font-semibold text-white">Cost Category Breakdown</h2>
            <CostBreakdown jobs={jobs} />
          </div>

          {/* Top 5 Most Profitable */}
          <div className="rounded-xl border border-white/10 bg-neutral-900 p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <TrendingUp size={18} className="text-green-400" />
              Most Profitable Jobs
            </h2>
            {an && an.mostProfitable.length > 0 ? (
              <div className="space-y-2">
                {an.mostProfitable.map((j, i) => (
                  <div key={j.jobId} className="flex items-center justify-between rounded-lg bg-neutral-800 px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/20 text-xs font-bold text-green-400">
                        {i + 1}
                      </span>
                      <span className="text-sm text-zinc-300">{j.customerName}</span>
                    </div>
                    <span className="text-sm font-bold text-green-400">{fmtPct(j.margin)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-zinc-500">No data</p>
            )}
          </div>

          {/* Top 5 Least Profitable */}
          <div className="rounded-xl border border-white/10 bg-neutral-900 p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <TrendingDown size={18} className="text-red-400" />
              Least Profitable Jobs
            </h2>
            {an && an.leastProfitable.length > 0 ? (
              <div className="space-y-2">
                {an.leastProfitable.map((j, i) => (
                  <div key={j.jobId} className="flex items-center justify-between rounded-lg bg-neutral-800 px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/20 text-xs font-bold text-red-400">
                        {i + 1}
                      </span>
                      <span className="text-sm text-zinc-300">{j.customerName}</span>
                    </div>
                    <span className={`text-sm font-bold ${marginColor(j.margin)}`}>{fmtPct(j.margin)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-zinc-500">No data</p>
            )}
          </div>

          {/* Top Materials by Cost */}
          {an && an.byMaterial.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-neutral-900 p-5 lg:col-span-2">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                <Package size={18} className="text-blue-400" />
                Top Materials by Cost
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-zinc-500">
                      <th className="py-2 text-left font-medium">Material</th>
                      <th className="py-2 text-right font-medium">Total Cost</th>
                      <th className="py-2 text-right font-medium">Avg per Job</th>
                    </tr>
                  </thead>
                  <tbody>
                    {an.byMaterial.map((m) => (
                      <tr key={m.material} className="border-b border-white/5">
                        <td className="py-2 text-zinc-300 capitalize">{m.material}</td>
                        <td className="py-2 text-right text-white font-medium">{fmt(m.totalCost)}</td>
                        <td className="py-2 text-right text-zinc-400">{fmt(m.avgPerJob)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======= Jobs Tab ======= */}
      {activeTab === 'jobs' && (
        <div className="rounded-xl border border-white/10 bg-neutral-900">
          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-3 border-b border-white/10 p-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customer, address, rep..."
                className="w-full rounded-lg border border-white/10 bg-neutral-800 py-2 pl-9 pr-3 text-sm text-white placeholder-zinc-500 focus:border-[#39FF14] focus:outline-none focus:ring-1 focus:ring-[#39FF14]"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-zinc-500" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-white/10 bg-neutral-800 px-3 py-2 text-sm text-white focus:border-[#39FF14] focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="estimating">Estimating</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="reconciled">Reconciled</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-zinc-500" />
              <input
                type="date"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                className="rounded-lg border border-white/10 bg-neutral-800 px-3 py-2 text-sm text-white focus:border-[#39FF14] focus:outline-none"
              />
              <span className="text-zinc-500 text-xs">to</span>
              <input
                type="date"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                className="rounded-lg border border-white/10 bg-neutral-800 px-3 py-2 text-sm text-white focus:border-[#39FF14] focus:outline-none"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase text-zinc-500">
                  {([
                    ['customerName', 'Customer'],
                    ['totalRevenue', 'Revenue'],
                    ['totalCosts', 'Costs'],
                    ['netProfit', 'Net Profit'],
                    ['netMargin', 'Margin'],
                    ['status', 'Status'],
                    ['createdAt', 'Date'],
                  ] as [SortField, string][]).map(([field, label]) => (
                    <th
                      key={field}
                      className="cursor-pointer px-4 py-3 text-left font-medium hover:text-zinc-300 select-none"
                      onClick={() => handleSort(field)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {label}
                        <SortIcon field={field} />
                      </span>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-zinc-500">
                      {jobs.length === 0 ? 'No job cost data yet. Add jobs to start tracking profitability.' : 'No jobs match your filters'}
                    </td>
                  </tr>
                ) : (
                  filteredJobs.map((job) => (
                    <tr
                      key={job.jobId}
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-white">{job.customerName}</p>
                          <p className="text-xs text-zinc-500 truncate max-w-[200px]">{job.address}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white font-medium">{fmt(job.totalRevenue)}</td>
                      <td className="px-4 py-3 text-zinc-400">{fmt(job.totalCosts)}</td>
                      <td className={`px-4 py-3 font-medium ${job.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {fmt(job.netProfit)}
                      </td>
                      <td className={`px-4 py-3 font-bold ${marginColor(job.netMargin)}`}>
                        {fmtPct(job.netMargin)}
                        {job.netMargin < TARGET_MARGIN && job.status !== 'estimating' && (
                          <AlertTriangle size={12} className="inline ml-1 text-yellow-400" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(job.status)}`}>
                          {statusLabel(job.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">
                        {new Date(job.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedJob(job)}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#39FF14] hover:bg-[#39FF14]/10"
                        >
                          <Eye size={12} />
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Summary footer */}
          {filteredJobs.length > 0 && (
            <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-sm">
              <span className="text-zinc-500">{filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''}</span>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-zinc-500">
                  Total: <span className="text-white font-medium">{fmt(filteredJobs.reduce((s, j) => s + j.totalRevenue, 0))}</span>
                </span>
                <span className="text-zinc-500">
                  Profit: <span className="text-green-400 font-medium">{fmt(filteredJobs.reduce((s, j) => s + j.netProfit, 0))}</span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======= By Rep Tab ======= */}
      {activeTab === 'reps' && (
        <div className="rounded-xl border border-white/10 bg-neutral-900">
          <div className="border-b border-white/10 p-4">
            <h2 className="text-lg font-semibold text-white">Profit by Sales Rep</h2>
            <p className="text-sm text-zinc-400">Performance breakdown per representative</p>
          </div>

          {an && an.byRep.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase text-zinc-500">
                    <th className="px-4 py-3 text-left font-medium">Rep</th>
                    <th className="px-4 py-3 text-right font-medium">Jobs</th>
                    <th className="px-4 py-3 text-right font-medium">Revenue</th>
                    <th className="px-4 py-3 text-right font-medium">Profit</th>
                    <th className="px-4 py-3 text-right font-medium">Margin</th>
                    <th className="px-4 py-3 text-left font-medium">Performance</th>
                  </tr>
                </thead>
                <tbody>
                  {an.byRep.map((rep, idx) => {
                    const maxRev = Math.max(...an.byRep.map((r) => r.revenue), 1);
                    const barW = (rep.revenue / maxRev) * 100;
                    return (
                      <tr key={rep.repSlug} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#39FF14]/20 text-xs font-bold text-[#39FF14]">
                              {idx + 1}
                            </span>
                            <span className="font-medium text-white">{rep.repName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-400">{rep.jobs}</td>
                        <td className="px-4 py-3 text-right text-white font-medium">{fmt(rep.revenue)}</td>
                        <td className={`px-4 py-3 text-right font-medium ${rep.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {fmt(rep.profit)}
                        </td>
                        <td className={`px-4 py-3 text-right font-bold ${marginColor(rep.margin)}`}>
                          {fmtPct(rep.margin)}
                        </td>
                        <td className="px-4 py-3 min-w-[150px]">
                          <div className="h-3 w-full rounded-full bg-neutral-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#39FF14]/50 transition-all"
                              style={{ width: `${barW}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-4 py-12 text-center text-zinc-500">No rep data available</div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {selectedJob && <JobDetailModal job={selectedJob} onClose={() => setSelectedJob(null)} />}
    </div>
  );
}
