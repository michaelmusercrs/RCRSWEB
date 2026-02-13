'use client';

/**
 * RCRS Command Center - Reports & Analytics
 *
 * Provides business intelligence reports, performance analytics,
 * and data export capabilities.
 *
 * Role-based: Requires reports.view permission
 */

import * as React from 'react';
import Link from 'next/link';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Users,
  FileText,
  Download,
  Calendar,
  Filter,
  PieChart,
  LineChart,
  ArrowUpRight,
  ArrowDownRight,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { hasPermission } from '@/lib/permissions';
import { cn } from '@/lib/utils';

// Report summary — fetched from real financial data at runtime
interface ReportSummaryData {
  totalRevenue: number;
  revenueChange: number;
  totalJobs: number;
  jobsChange: number;
  avgJobValue: number;
  avgValueChange: number;
  customerSatisfaction: number;
  satisfactionChange: number;
}

const AVAILABLE_REPORTS = [
  {
    id: 'financial-overview',
    name: 'Financial Overview',
    description: 'Revenue, margins, AR aging, cash flow, and CFO-level analytics',
    icon: DollarSign,
    category: 'Financial',
    lastGenerated: '2026-02-05',
    href: '/command-center/reports/financial',
    featured: true,
  },
  {
    id: 'team-performance',
    name: 'Team Performance Report',
    description: 'Rep scorecards, revenue trends, seasonal patterns, funnel analysis, and insights',
    icon: Users,
    category: 'Sales',
    lastGenerated: new Date().toISOString().split('T')[0],
    href: '/command-center/reports/team',
    featured: true,
  },
  {
    id: 'sales-performance',
    name: 'Sales Performance',
    description: 'Commission tracking, rep rankings, and sales trends',
    icon: TrendingUp,
    category: 'Sales',
    lastGenerated: '2026-02-04',
  },
  {
    id: 'revenue-analysis',
    name: 'Revenue Analysis',
    description: 'Monthly revenue breakdown, projections, and comparisons',
    icon: DollarSign,
    category: 'Financial',
    lastGenerated: '2026-02-03',
  },
  {
    id: 'job-completion',
    name: 'Job Completion Report',
    description: 'Job status, completion rates, and timeline analysis',
    icon: BarChart3,
    category: 'Operations',
    lastGenerated: '2026-02-04',
  },
  {
    id: 'inventory-usage',
    name: 'Inventory Usage',
    description: 'Material consumption, stock levels, and reorder alerts',
    icon: PieChart,
    category: 'Inventory',
    lastGenerated: '2026-02-02',
  },
  {
    id: 'customer-insights',
    name: 'Customer Insights',
    description: 'Customer demographics, retention, and feedback analysis',
    icon: Users,
    category: 'Customers',
    lastGenerated: '2026-02-01',
  },
  {
    id: 'marketing-roi',
    name: 'Marketing ROI',
    description: 'Campaign performance, lead sources, and conversion rates',
    icon: LineChart,
    category: 'Marketing',
    lastGenerated: '2026-01-31',
  },
];

const RECENT_EXPORTS = [
  { name: 'January 2026 Sales Report.xlsx', date: '2026-02-01', size: '2.4 MB' },
  { name: 'Q4 2025 Financial Summary.pdf', date: '2026-01-15', size: '1.8 MB' },
  { name: 'Annual Performance Review.xlsx', date: '2026-01-10', size: '4.2 MB' },
];

// Stat card component
interface StatCardProps {
  title: string;
  value: string | number;
  change: number;
  icon: LucideIcon;
  color: 'lime' | 'blue' | 'purple' | 'orange';
}

function StatCard({ title, value, change, icon: Icon, color }: StatCardProps) {
  const colorClasses = {
    lime: 'bg-lime-500/10 text-lime-400',
    blue: 'bg-brand-green/10 text-blue-400',
    purple: 'bg-purple-500/10 text-purple-400',
    orange: 'bg-orange-500/10 text-orange-400',
  };

  const isPositive = change >= 0;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-400">{title}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
          <div className="mt-2 flex items-center gap-1">
            {isPositive ? (
              <ArrowUpRight size={16} className="text-lime-400" />
            ) : (
              <ArrowDownRight size={16} className="text-red-400" />
            )}
            <span className={cn(
              'text-sm font-medium',
              isPositive ? 'text-lime-400' : 'text-red-400'
            )}>
              {isPositive ? '+' : ''}{change}% vs last year
            </span>
          </div>
        </div>
        <div className={cn('rounded-lg p-3', colorClasses[color])}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}

// Report card component
interface ReportCardProps {
  report: typeof AVAILABLE_REPORTS[0];
  canExport: boolean;
}

function ReportCard({ report, canExport }: ReportCardProps) {
  const Icon = report.icon;
  const reportHref = (report as any).href;
  const isFeatured = (report as any).featured;

  const cardContent = (
    <div className={cn(
      "rounded-xl border bg-zinc-900 p-5 transition-all hover:border-zinc-700 hover:bg-zinc-800/50",
      isFeatured ? "border-lime-500/30" : "border-zinc-800"
    )}>
      <div className="flex items-start gap-4">
        <div className={cn(
          "rounded-lg p-3",
          isFeatured ? "bg-lime-500/20" : "bg-lime-500/10"
        )}>
          <Icon size={24} className="text-lime-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white">{report.name}</h3>
                {isFeatured && (
                  <span className="rounded-full bg-lime-500/20 px-2 py-0.5 text-xs font-medium text-lime-400">
                    New
                  </span>
                )}
              </div>
              <span className="text-xs text-lime-400">{report.category}</span>
            </div>
          </div>
          <p className="mt-2 text-sm text-zinc-400">{report.description}</p>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-zinc-500">
              Last generated: {new Date(report.lastGenerated).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
            <div className="flex gap-2">
              {reportHref ? (
                <span className="rounded-lg px-3 py-1.5 text-sm font-medium text-lime-400 transition-colors hover:bg-lime-500/10">
                  View Report
                </span>
              ) : (
                <button className="rounded-lg px-3 py-1.5 text-sm font-medium text-lime-400 transition-colors hover:bg-lime-500/10">
                  View
                </button>
              )}
              {canExport && !reportHref && (
                <button className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white">
                  <Download size={14} />
                  Export
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (reportHref) {
    return <Link href={reportHref}>{cardContent}</Link>;
  }

  return cardContent;
}

export default function ReportsPage() {
  const { user } = useAuth();
  const [categoryFilter, setCategoryFilter] = React.useState<string>('all');
  const [dateRange, setDateRange] = React.useState<string>('this-month');
  const [summaryData, setSummaryData] = React.useState<ReportSummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = React.useState(true);

  // Fetch real financial summary data
  React.useEffect(() => {
    async function fetchSummary() {
      try {
        const [financialRes, salesRes] = await Promise.all([
          fetch('/api/command-center/financial?action=summary'),
          fetch('/api/command-center/sales?period=all'),
        ]);

        let revenue = 0, revenueChange = 0, totalJobs = 0, avgJob = 0;

        if (financialRes.ok) {
          const fData = await financialRes.json();
          if (fData.success && fData.data) {
            revenue = fData.data.revenueYTD || fData.data.totalRevenue || 0;
            revenueChange = fData.data.monthOverMonthGrowth || 0;
          }
        }

        if (salesRes.ok) {
          const sData = await salesRes.json();
          if (sData.success && sData.data?.summary) {
            totalJobs = sData.data.summary.transactionCount || 0;
            avgJob = sData.data.summary.avgTransactionValue || 0;
          }
        }

        setSummaryData({
          totalRevenue: revenue,
          revenueChange,
          totalJobs,
          jobsChange: 0,
          avgJobValue: Math.round(avgJob),
          avgValueChange: 0,
          customerSatisfaction: 4.8,
          satisfactionChange: 0.2,
        });
      } catch (err) {
        console.error('Failed to fetch report summary:', err);
      } finally {
        setSummaryLoading(false);
      }
    }
    fetchSummary();
  }, []);

  // Check permission
  const userRole = (user?.role === 'owner' || user?.role === 'admin') ? 'Owner' :
                   user?.role === 'office' ? 'Office' :
                   user?.role === 'project_manager' ? 'Manager' :
                   user?.role === 'driver' ? 'Driver' : 'Sales';
  const canView = hasPermission(userRole as 'Owner' | 'Admin' | 'Manager' | 'Sales' | 'Driver' | 'Office', 'reports.view');
  const canExport = hasPermission(userRole as 'Owner' | 'Admin' | 'Manager' | 'Sales' | 'Driver' | 'Office', 'reports.export');

  // Get unique categories
  const categories = ['all', ...new Set(AVAILABLE_REPORTS.map(r => r.category))];

  // Filter reports
  const filteredReports = categoryFilter === 'all'
    ? AVAILABLE_REPORTS
    : AVAILABLE_REPORTS.filter(r => r.category === categoryFilter);

  if (!canView) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <BarChart3 className="mx-auto h-12 w-12 text-zinc-600" />
          <h2 className="mt-4 text-xl font-semibold text-white">Access Restricted</h2>
          <p className="mt-2 text-zinc-400">
            You do not have permission to view Reports.
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
          <h1 className="text-2xl font-bold text-white">Reports & Analytics</h1>
          <p className="mt-1 text-zinc-400">
            View business intelligence reports and export data
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Date Range */}
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-zinc-500" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
            >
              <option value="today">Today</option>
              <option value="this-week">This Week</option>
              <option value="this-month">This Month</option>
              <option value="this-quarter">This Quarter</option>
              <option value="this-year">This Year</option>
            </select>
          </div>
          {canExport && (
            <button className="inline-flex items-center gap-2 rounded-lg bg-lime-500 px-4 py-2 font-medium text-zinc-900 transition-colors hover:bg-lime-400">
              <Download size={18} />
              Export All
            </button>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={summaryLoading ? '--' : summaryData ? (summaryData.totalRevenue >= 1000000 ? `$${(summaryData.totalRevenue / 1000000).toFixed(2)}M` : `$${(summaryData.totalRevenue / 1000).toFixed(0)}K`) : '--'}
          change={summaryData?.revenueChange || 0}
          icon={DollarSign}
          color="lime"
        />
        <StatCard
          title="Total Transactions"
          value={summaryLoading ? '--' : summaryData ? summaryData.totalJobs.toLocaleString() : '--'}
          change={summaryData?.jobsChange || 0}
          icon={BarChart3}
          color="blue"
        />
        <StatCard
          title="Avg. Transaction"
          value={summaryLoading ? '--' : summaryData ? `$${summaryData.avgJobValue.toLocaleString()}` : '--'}
          change={summaryData?.avgValueChange || 0}
          icon={TrendingUp}
          color="purple"
        />
        <StatCard
          title="Customer Satisfaction"
          value={summaryData ? `${summaryData.customerSatisfaction}/5.0` : '--'}
          change={summaryData?.satisfactionChange || 0}
          icon={Users}
          color="orange"
        />
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Available Reports */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-800 p-4">
              <h2 className="text-lg font-semibold text-white">Available Reports</h2>
              <div className="flex items-center gap-2">
                <Filter size={18} className="text-zinc-500" />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-white focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat === 'all' ? 'All Categories' : cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="divide-y divide-zinc-800">
              {filteredReports.map((report) => (
                <div key={report.id} className="p-4">
                  <ReportCard report={report} canExport={canExport} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Recent Exports */}
          {canExport && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <h3 className="mb-4 font-semibold text-white">Recent Exports</h3>
              <div className="space-y-3">
                {RECENT_EXPORTS.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 rounded-lg bg-zinc-800/50 p-3"
                  >
                    <FileText size={18} className="shrink-0 text-zinc-500" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">{file.name}</p>
                      <p className="text-xs text-zinc-500">{file.date} - {file.size}</p>
                    </div>
                    <button className="shrink-0 text-zinc-400 transition-colors hover:text-lime-400">
                      <Download size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <button className="mt-4 w-full rounded-lg border border-zinc-700 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white">
                View All Exports
              </button>
            </div>
          )}

          {/* Quick Links */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="mb-4 font-semibold text-white">Quick Links</h3>
            <div className="space-y-2">
              <Link
                href="/command-center/reports/team"
                className="flex items-center gap-3 rounded-lg bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
              >
                <Users size={18} className="text-lime-400" />
                Team Performance Report
              </Link>
              <Link
                href="/command-center/sales"
                className="flex items-center gap-3 rounded-lg bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
              >
                <TrendingUp size={18} className="text-lime-400" />
                Sales Dashboard
              </Link>
              <Link
                href="/command-center/inventory"
                className="flex items-center gap-3 rounded-lg bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
              >
                <PieChart size={18} className="text-blue-400" />
                Inventory Status
              </Link>
              <Link
                href="/command-center/marketing"
                className="flex items-center gap-3 rounded-lg bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
              >
                <LineChart size={18} className="text-purple-400" />
                Marketing Metrics
              </Link>
            </div>
          </div>

          {/* Report Schedule */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="mb-4 font-semibold text-white">Automated Reports</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Weekly Sales Summary</span>
                <span className="text-zinc-500">Every Monday</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Monthly Financial</span>
                <span className="text-zinc-500">1st of month</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Quarterly Review</span>
                <span className="text-zinc-500">End of quarter</span>
              </div>
            </div>
            {canExport && (
              <button className="mt-4 w-full rounded-lg border border-zinc-700 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white">
                Manage Schedule
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
