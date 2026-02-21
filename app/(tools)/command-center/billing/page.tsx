'use client';

/**
 * RCRS Command Center - Billing Management
 *
 * Displays billing overview, invoices, payment tracking, and financial summaries.
 * Primary tool for Office staff to manage customer billing.
 * Fetches real data from /api/portal/billing
 *
 * Role-based: Requires billing.view permission
 */

import * as React from 'react';
import Link from 'next/link';
import {
  CreditCard,
  DollarSign,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  Download,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  RefreshCw,
  ClipboardList,
  TrendingUp,
  Package,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { hasPermission } from '@/lib/permissions';
import { cn } from '@/lib/utils';

// Types for billing data
interface BillingStats {
  totalOutstanding: number;
  paidThisMonth: number;
  overdueCount: number;
  pendingCount: number;
  totalRecords: number;
  unbilledMaterials: number;
}

interface BillingRecord {
  id: string;
  ticketId?: string;
  jobId?: string;
  jobName: string;
  jobAddress: string;
  transactionType: string;
  totalCost: number;
  totalPrice: number;
  status: string;
  createdAt: string;
  billedAt?: string;
}

// Default fallback data (used only if API fails)
const DEFAULT_STATS: BillingStats = {
  totalOutstanding: 0,
  paidThisMonth: 0,
  overdueCount: 0,
  pendingCount: 0,
  totalRecords: 0,
  unbilledMaterials: 0,
};

// Stat card component
interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: number; isPositive: boolean };
  color: 'lime' | 'blue' | 'red' | 'orange';
}

function StatCard({ title, value, icon: Icon, trend, color }: StatCardProps) {
  const colorClasses = {
    lime: 'bg-lime-500/10 text-lime-400',
    blue: 'bg-brand-green/10 text-blue-400',
    red: 'bg-red-500/10 text-red-400',
    orange: 'bg-orange-500/10 text-orange-400',
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-400">{title}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
          {trend && (
            <div className="mt-2 flex items-center gap-1">
              {trend.isPositive ? (
                <ArrowUpRight size={16} className="text-lime-400" />
              ) : (
                <ArrowDownRight size={16} className="text-red-400" />
              )}
              <span className={cn(
                'text-sm font-medium',
                trend.isPositive ? 'text-lime-400' : 'text-red-400'
              )}>
                {trend.value}% from last month
              </span>
            </div>
          )}
        </div>
        <div className={cn('rounded-lg p-3', colorClasses[color])}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const statusStyles = {
    paid: 'bg-lime-500/20 text-lime-400',
    pending: 'bg-brand-green/20 text-blue-400',
    overdue: 'bg-red-500/20 text-red-400',
  };

  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium capitalize',
      statusStyles[status as keyof typeof statusStyles] || 'bg-zinc-500/20 text-zinc-400'
    )}>
      {status === 'paid' && <CheckCircle2 size={12} />}
      {status === 'pending' && <Clock size={12} />}
      {status === 'overdue' && <AlertTriangle size={12} />}
      {status}
    </span>
  );
}

export default function BillingPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [stats, setStats] = React.useState<BillingStats>(DEFAULT_STATS);
  const [records, setRecords] = React.useState<BillingRecord[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Check permission
  const userRole = (user?.role === 'owner' || user?.role === 'admin') ? 'Owner' :
                   user?.role === 'office' ? 'Office' :
                   user?.role === 'project_manager' ? 'Manager' :
                   user?.role === 'driver' ? 'Driver' : 'Sales';
  const canView = hasPermission(userRole as 'Owner' | 'Admin' | 'Manager' | 'Sales' | 'Driver' | 'Office', 'billing.view');
  const canEdit = hasPermission(userRole as 'Owner' | 'Admin' | 'Manager' | 'Sales' | 'Driver' | 'Office', 'billing.edit');

  // Fetch data from API
  const fetchBillingData = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch dashboard stats
      const statsRes = await fetch('/api/portal/billing?action=dashboard');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats({
          totalOutstanding: statsData.totalOutstanding || 0,
          paidThisMonth: statsData.paidThisMonth || 0,
          overdueCount: statsData.overdueCount || 0,
          pendingCount: statsData.pendingCount || 0,
          totalRecords: statsData.totalRecords || 0,
          unbilledMaterials: statsData.unbilledMaterials || 0,
        });
      }

      // Fetch billing records
      const recordsRes = await fetch('/api/portal/billing?action=records');
      if (recordsRes.ok) {
        const recordsData = await recordsRes.json();
        setRecords(recordsData.records || []);
      }
    } catch (err) {
      console.error('Error fetching billing data:', err);
      setError('Failed to load billing data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (canView) {
      fetchBillingData();
    }
  }, [canView, fetchBillingData]);

  // Filter records
  const filteredRecords = records.filter(record => {
    const matchesSearch = record.jobName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          record.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          record.jobAddress.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || record.status.toLowerCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (!canView) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <CreditCard className="mx-auto h-12 w-12 text-zinc-600" />
          <h2 className="mt-4 text-xl font-semibold text-white">Access Restricted</h2>
          <p className="mt-2 text-zinc-400">
            You do not have permission to view Billing.
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
          <h1 className="text-2xl font-bold text-white">Billing & Invoices</h1>
          <p className="mt-1 text-zinc-400">
            Manage invoices, track payments, and view financial summaries
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/command-center/billing/invoices"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
          >
            <FileText size={18} />
            View Invoices
          </Link>
          {canEdit && (
            <Link
              href="/command-center/billing/invoices"
              className="inline-flex items-center gap-2 rounded-lg bg-lime-500 px-4 py-2 font-medium text-zinc-900 transition-colors hover:bg-lime-400"
            >
              <Plus size={18} />
              Create Invoice
            </Link>
          )}
        </div>
      </div>

      {/* Quick Links */}
      {!isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/command-center/billing/invoices"
            className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-800/50"
          >
            <div className="rounded-lg bg-brand-green/10 p-3 text-blue-400">
              <FileText size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-white">Invoices</h3>
              <p className="text-sm text-zinc-400">View and manage all invoices</p>
            </div>
          </Link>
          <Link
            href="/command-center/billing/breakdowns"
            className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-800/50"
          >
            <div className="rounded-lg bg-purple-500/10 p-3 text-purple-400">
              <ClipboardList size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-white">Customer Breakdowns</h3>
              <p className="text-sm text-zinc-400">Job cost sheets and materials</p>
            </div>
          </Link>
          <Link
            href="/command-center/reports"
            className="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-800/50"
          >
            <div className="rounded-lg bg-lime-500/10 p-3 text-lime-400">
              <TrendingUp size={24} />
            </div>
            <div>
              <h3 className="font-semibold text-white">Financial Reports</h3>
              <p className="text-sm text-zinc-400">Profit margins and analytics</p>
            </div>
          </Link>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-lime-400" />
          <span className="ml-2 text-zinc-400">Loading billing data...</span>
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
              onClick={fetchBillingData}
              className="inline-flex items-center gap-2 rounded-lg bg-red-500/20 px-3 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30"
            >
              <RefreshCw size={14} />
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      {!isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Outstanding"
            value={`$${stats.totalOutstanding.toLocaleString()}`}
            icon={DollarSign}
            color="orange"
          />
          <StatCard
            title="Paid This Month"
            value={`$${stats.paidThisMonth.toLocaleString()}`}
            icon={CheckCircle2}
            color="lime"
          />
          <StatCard
            title="Overdue Records"
            value={stats.overdueCount}
            icon={AlertTriangle}
            color="red"
          />
          <StatCard
            title="Pending Records"
            value={stats.pendingCount}
            icon={Clock}
            color="blue"
          />
        </div>
      )}

      {/* Billing Records Table */}
      {!isLoading && (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900">
        {/* Table Header */}
        <div className="border-b border-zinc-800 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-white">Billing Records</h2>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {/* Search */}
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search invoices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-10 pr-4 text-sm text-white placeholder-zinc-500 focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500 sm:w-64"
                />
              </div>
              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <Filter size={18} className="text-zinc-500" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
                >
                  <option value="all">All Status</option>
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
              {/* Export Button */}
              <button className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white">
                <Download size={16} />
                Export
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-sm text-zinc-500">
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Due Date</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                    No billing records found
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr
                    key={record.id}
                    className="border-b border-zinc-800 transition-colors hover:bg-zinc-800/50"
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-zinc-500" />
                        <span className="font-medium text-white">{record.id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium text-white">{record.jobName}</p>
                        <p className="text-sm text-zinc-500">{record.jobAddress}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-semibold text-white">
                        ${record.totalPrice.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={record.status.toLowerCase()} />
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-400">
                      {new Date(record.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-4">
                      <button className="rounded-lg px-3 py-1.5 text-sm font-medium text-lime-400 transition-colors hover:bg-lime-500/10">
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-3">
          <p className="text-sm text-zinc-500">
            Showing {filteredRecords.length} of {records.length} records
          </p>
          <div className="flex gap-2">
            <button
              onClick={fetchBillingData}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
