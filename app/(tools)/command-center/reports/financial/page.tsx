'use client';

/**
 * RCRS Command Center - Financial Reports Dashboard
 *
 * Comprehensive financial reporting from CFO perspective:
 * - Revenue by rep and period
 * - Profit margins and job profitability
 * - AR aging and outstanding invoices
 * - Budget vs actual tracking
 * - Cash flow indicators
 *
 * Role-based: Requires reports.view permission (Admin/Owner only for full access)
 */

import * as React from 'react';
import Link from 'next/link';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  BarChart3,
  PieChart,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  RefreshCw,
  Download,
  Calendar,
  Filter,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { hasPermission } from '@/lib/permissions';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

interface FinancialSummary {
  totalRevenue: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  revenueYTD: number;
  monthOverMonthGrowth: number;
  grossProfit: number;
  netProfit: number;
  grossMargin: number;
  netMargin: number;
  pipelineValue: number;
  accountsReceivable: number;
  overdueInvoices: number;
  overdueAmount: number;
  cashInflow: number;
  cashOutflow: number;
  netCashFlow: number;
}

interface RevenueByRep {
  repId: string;
  repName: string;
  totalRevenue: number;
  totalCommissions: number;
  jobCount: number;
  avgJobValue: number;
  closeRate: number;
  percentOfTotal: number;
}

interface RevenueByPeriod {
  period: string;
  periodLabel: string;
  revenue: number;
  costs: number;
  profit: number;
  margin: number;
  jobCount: number;
}

interface InvoiceAgingBucket {
  bucket: string;
  label: string;
  count: number;
  amount: number;
  percentOfTotal: number;
}

interface FinancialAlert {
  alertId: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  amount?: number;
}

// =============================================================================
// Utility Functions
// =============================================================================

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(2)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`;
  }
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

// =============================================================================
// Components
// =============================================================================

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  change?: number;
  icon: React.ReactNode;
  color: 'lime' | 'blue' | 'orange' | 'red' | 'purple';
}

function KPICard({ title, value, subtitle, change, icon, color }: KPICardProps) {
  const colorClasses = {
    lime: 'bg-lime-500/10 text-lime-400',
    blue: 'bg-brand-green/10 text-blue-400',
    orange: 'bg-orange-500/10 text-orange-400',
    red: 'bg-red-500/10 text-red-400',
    purple: 'bg-purple-500/10 text-purple-400',
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-400">{title}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
          {(subtitle || change !== undefined) && (
            <div className="mt-2 flex items-center gap-2">
              {change !== undefined && (
                <span className={cn(
                  'flex items-center text-sm font-medium',
                  change >= 0 ? 'text-lime-400' : 'text-red-400'
                )}>
                  {change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {formatPercent(change)}
                </span>
              )}
              {subtitle && <span className="text-sm text-zinc-500">{subtitle}</span>}
            </div>
          )}
        </div>
        <div className={cn('rounded-lg p-3', colorClasses[color])}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function AgingChart({ data }: { data: InvoiceAgingBucket[] }) {
  const maxAmount = Math.max(...data.map(d => d.amount));

  return (
    <div className="space-y-3">
      {data.map((bucket) => (
        <div key={bucket.bucket}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-zinc-400">{bucket.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">{formatCurrency(bucket.amount)}</span>
              <span className="text-xs text-zinc-500">({bucket.count})</span>
            </div>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                bucket.bucket === 'current' ? 'bg-lime-500' :
                bucket.bucket === '1-30' ? 'bg-yellow-500' :
                bucket.bucket === '31-60' ? 'bg-orange-500' :
                bucket.bucket === '61-90' ? 'bg-red-400' :
                'bg-red-600'
              )}
              style={{ width: `${maxAmount > 0 ? (bucket.amount / maxAmount) * 100 : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function RevenueChart({ data }: { data: RevenueByPeriod[] }) {
  const maxRevenue = Math.max(...data.map(d => d.revenue));

  return (
    <div className="flex items-end justify-between gap-2 h-48">
      {data.slice(-12).map((period, idx) => {
        const height = maxRevenue > 0 ? (period.revenue / maxRevenue) * 100 : 0;
        return (
          <div key={period.period} className="flex-1 flex flex-col items-center group">
            <div className="relative w-full flex-1 flex items-end">
              <div
                className="w-full bg-lime-500/80 rounded-t transition-all group-hover:bg-lime-400"
                style={{ height: `${height}%`, minHeight: period.revenue > 0 ? '4px' : '0' }}
              />
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-800 px-2 py-1 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {formatCurrency(period.revenue)}
              </div>
            </div>
            <span className="text-xs text-zinc-500 mt-2 truncate w-full text-center">
              {period.periodLabel.split(' ')[0]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function RepPerformanceTable({ data }: { data: RevenueByRep[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-800 text-left text-sm text-zinc-500">
            <th className="px-4 py-3 font-medium">#</th>
            <th className="px-4 py-3 font-medium">Sales Rep</th>
            <th className="px-4 py-3 font-medium text-right">Revenue</th>
            <th className="px-4 py-3 font-medium text-right">Jobs</th>
            <th className="px-4 py-3 font-medium text-right">Avg Value</th>
            <th className="px-4 py-3 font-medium text-right">% of Total</th>
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 10).map((rep, index) => (
            <tr
              key={rep.repId}
              className="border-b border-zinc-800 transition-colors hover:bg-zinc-800/50"
            >
              <td className="px-4 py-3">
                <span className={cn(
                  'font-bold',
                  index === 0 && 'text-yellow-400',
                  index === 1 && 'text-neutral-500',
                  index === 2 && 'text-orange-500'
                )}>
                  {index + 1}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                    index === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                    index === 1 ? 'bg-gray-400/20 text-neutral-400' :
                    index === 2 ? 'bg-orange-500/20 text-orange-400' :
                    'bg-zinc-700 text-neutral-400'
                  )}>
                    {rep.repName.charAt(0)}
                  </div>
                  <span className="font-medium text-white">{rep.repName}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="font-semibold text-lime-400">{formatCurrency(rep.totalRevenue)}</span>
              </td>
              <td className="px-4 py-3 text-right text-zinc-300">{rep.jobCount}</td>
              <td className="px-4 py-3 text-right text-zinc-300">{formatCurrency(rep.avgJobValue)}</td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <div className="w-16 h-2 bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-lime-500 rounded-full"
                      style={{ width: `${Math.min(rep.percentOfTotal, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm text-zinc-400">{rep.percentOfTotal.toFixed(1)}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AlertsList({ alerts }: { alerts: FinancialAlert[] }) {
  const severityColors = {
    critical: 'border-red-500/30 bg-red-500/10',
    warning: 'border-orange-500/30 bg-orange-500/10',
    info: 'border-blue-500/30 bg-brand-green/10',
  };

  const severityIcons = {
    critical: <AlertTriangle className="text-red-400" size={18} />,
    warning: <AlertTriangle className="text-orange-400" size={18} />,
    info: <CheckCircle2 className="text-blue-400" size={18} />,
  };

  if (alerts.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-500">
        <CheckCircle2 className="mx-auto h-10 w-10 mb-2 text-lime-400" />
        <p>No financial alerts at this time</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <div
          key={alert.alertId}
          className={cn(
            'rounded-lg border p-4',
            severityColors[alert.severity]
          )}
        >
          <div className="flex items-start gap-3">
            {severityIcons[alert.severity]}
            <div className="flex-1">
              <h4 className="font-medium text-white">{alert.title}</h4>
              <p className="text-sm text-zinc-400 mt-1">{alert.description}</p>
              {alert.amount && (
                <p className="text-sm font-medium text-white mt-2">
                  Amount: {formatCurrency(alert.amount)}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function FinancialReportsPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [dateRange, setDateRange] = React.useState<string>('this-year');

  const [summary, setSummary] = React.useState<FinancialSummary | null>(null);
  const [revenueByRep, setRevenueByRep] = React.useState<RevenueByRep[]>([]);
  const [revenueByPeriod, setRevenueByPeriod] = React.useState<RevenueByPeriod[]>([]);
  const [invoiceAging, setInvoiceAging] = React.useState<InvoiceAgingBucket[]>([]);
  const [alerts, setAlerts] = React.useState<FinancialAlert[]>([]);

  // Permission check
  const userRole = (user?.role === 'owner' || user?.role === 'admin') ? 'Owner' :
                   user?.role === 'office' ? 'Office' :
                   user?.role === 'project_manager' ? 'Manager' :
                   user?.role === 'driver' ? 'Driver' : 'Sales';
  const canView = hasPermission(userRole as 'Owner' | 'Admin' | 'Manager' | 'Sales' | 'Driver' | 'Office', 'reports.view');
  const isAdmin = user?.role === 'owner' || user?.role === 'admin';

  const fetchData = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [summaryRes, repRes, periodRes, agingRes, alertsRes] = await Promise.all([
        fetch('/api/command-center/financial?action=summary'),
        fetch('/api/command-center/financial?action=revenue-by-rep'),
        fetch('/api/command-center/financial?action=revenue-by-period&groupBy=month&periods=12'),
        fetch('/api/command-center/financial?action=invoice-aging'),
        fetch('/api/command-center/financial?action=alerts'),
      ]);

      if (summaryRes.ok) {
        const data = await summaryRes.json();
        if (data.success) setSummary(data.data);
      }

      if (repRes.ok) {
        const data = await repRes.json();
        if (data.success) setRevenueByRep(data.data || []);
      }

      if (periodRes.ok) {
        const data = await periodRes.json();
        if (data.success) setRevenueByPeriod(data.data || []);
      }

      if (agingRes.ok) {
        const data = await agingRes.json();
        if (data.success) setInvoiceAging(data.data || []);
      }

      if (alertsRes.ok) {
        const data = await alertsRes.json();
        if (data.success) setAlerts(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching financial data:', err);
      setError('Failed to load financial data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (canView) {
      fetchData();
    }
  }, [canView, fetchData]);

  if (!canView) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <DollarSign className="mx-auto h-12 w-12 text-zinc-600" />
          <h2 className="mt-4 text-xl font-semibold text-white">Access Restricted</h2>
          <p className="mt-2 text-zinc-400">
            You do not have permission to view Financial Reports.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/command-center/reports" className="text-zinc-400 hover:text-white">
              Reports
            </Link>
            <ChevronRight size={16} className="text-zinc-600" />
            <span className="text-white">Financial</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-white">Financial Overview</h1>
          <p className="mt-1 text-zinc-400">
            Revenue tracking, profit margins, AR aging, and financial KPIs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-zinc-500" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
            >
              <option value="this-month">This Month</option>
              <option value="this-quarter">This Quarter</option>
              <option value="this-year">This Year</option>
              <option value="all">All Time</option>
            </select>
          </div>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg bg-lime-500 px-4 py-2 font-medium text-zinc-900 transition-colors hover:bg-lime-400">
            <Download size={18} />
            Export
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-lime-400" />
          <span className="ml-2 text-zinc-400">Loading financial data...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <span className="text-red-400">{error}</span>
            </div>
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-2 rounded-lg bg-red-500/20 px-3 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30"
            >
              <RefreshCw size={14} />
              Retry
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      {!isLoading && summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Revenue This Month"
            value={formatCurrency(summary.revenueThisMonth)}
            change={summary.monthOverMonthGrowth}
            subtitle="vs last month"
            icon={<DollarSign size={24} />}
            color="lime"
          />
          <KPICard
            title="Gross Margin"
            value={`${summary.grossMargin.toFixed(1)}%`}
            subtitle={summary.grossMargin >= 25 ? 'Healthy' : 'Below target'}
            icon={<TrendingUp size={24} />}
            color={summary.grossMargin >= 25 ? 'blue' : 'orange'}
          />
          <KPICard
            title="Accounts Receivable"
            value={formatCurrency(summary.accountsReceivable)}
            subtitle={`${summary.overdueInvoices} overdue`}
            icon={<Clock size={24} />}
            color={summary.overdueInvoices > 0 ? 'orange' : 'blue'}
          />
          <KPICard
            title="Net Cash Flow"
            value={formatCurrency(summary.netCashFlow)}
            subtitle="This month"
            icon={summary.netCashFlow >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
            color={summary.netCashFlow >= 0 ? 'lime' : 'red'}
          />
        </div>
      )}

      {/* Main Grid */}
      {!isLoading && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Revenue Trend Chart */}
          <div className="lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Revenue Trend</h2>
              <span className="text-sm text-zinc-500">Last 12 months</span>
            </div>
            {revenueByPeriod.length > 0 ? (
              <RevenueChart data={revenueByPeriod} />
            ) : (
              <div className="h-48 flex items-center justify-center text-zinc-500">
                No revenue data available
              </div>
            )}
          </div>

          {/* AR Aging */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">AR Aging</h2>
              <PieChart size={20} className="text-zinc-500" />
            </div>
            {invoiceAging.length > 0 ? (
              <AgingChart data={invoiceAging} />
            ) : (
              <div className="h-48 flex items-center justify-center text-zinc-500">
                No AR data available
              </div>
            )}
          </div>
        </div>
      )}

      {/* Revenue by Rep and Alerts */}
      {!isLoading && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Revenue by Rep */}
          <div className="lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-800 p-4">
              <h2 className="text-lg font-semibold text-white">Revenue by Sales Rep</h2>
              <Link
                href="/command-center/sales"
                className="text-sm font-medium text-lime-400 hover:text-lime-300"
              >
                View All
              </Link>
            </div>
            {revenueByRep.length > 0 ? (
              <RepPerformanceTable data={revenueByRep} />
            ) : (
              <div className="p-8 text-center text-zinc-500">
                No sales rep data available
              </div>
            )}
          </div>

          {/* Alerts */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Financial Alerts</h2>
              <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">
                {alerts.filter(a => a.severity === 'critical').length} Critical
              </span>
            </div>
            <AlertsList alerts={alerts.slice(0, 5)} />
            {alerts.length > 5 && (
              <button className="mt-4 w-full rounded-lg border border-zinc-700 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white">
                View All {alerts.length} Alerts
              </button>
            )}
          </div>
        </div>
      )}

      {/* Additional Metrics (Admin Only) */}
      {!isLoading && isAdmin && summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm font-medium text-zinc-400">YTD Revenue</p>
            <p className="mt-2 text-2xl font-bold text-white">{formatCurrency(summary.revenueYTD)}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm font-medium text-zinc-400">Gross Profit</p>
            <p className="mt-2 text-2xl font-bold text-lime-400">{formatCurrency(summary.grossProfit)}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm font-medium text-zinc-400">Pipeline Value</p>
            <p className="mt-2 text-2xl font-bold text-blue-400">{formatCurrency(summary.pipelineValue)}</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-sm font-medium text-zinc-400">Overdue Amount</p>
            <p className="mt-2 text-2xl font-bold text-red-400">{formatCurrency(summary.overdueAmount)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
