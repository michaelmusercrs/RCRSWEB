'use client';

/**
 * RCRS Command Center - Billing Management
 *
 * Displays billing overview, invoices, payment tracking, and financial summaries.
 * Primary tool for Office staff to manage customer billing.
 *
 * Role-based: Requires billing.view permission
 */

import * as React from 'react';
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
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { hasPermission } from '@/lib/permissions';
import { cn } from '@/lib/utils';

// Demo billing data
const BILLING_STATS = {
  totalOutstanding: 47850.00,
  paidThisMonth: 128450.00,
  overdueInvoices: 3,
  pendingPayments: 12,
};

const RECENT_INVOICES = [
  {
    id: 'INV-2026-0142',
    customer: 'John Smith',
    address: '123 Main St, Hartselle, AL',
    amount: 8500.00,
    status: 'paid',
    dueDate: '2026-01-28',
    paidDate: '2026-01-25',
  },
  {
    id: 'INV-2026-0141',
    customer: 'Sarah Johnson',
    address: '456 Oak Ave, Decatur, AL',
    amount: 12750.00,
    status: 'pending',
    dueDate: '2026-02-10',
    paidDate: null,
  },
  {
    id: 'INV-2026-0140',
    customer: 'Mike Williams',
    address: '789 Pine St, Huntsville, AL',
    amount: 6200.00,
    status: 'overdue',
    dueDate: '2026-01-20',
    paidDate: null,
  },
  {
    id: 'INV-2026-0139',
    customer: 'Jennifer Davis',
    address: '321 Elm Rd, Athens, AL',
    amount: 15400.00,
    status: 'paid',
    dueDate: '2026-01-15',
    paidDate: '2026-01-14',
  },
  {
    id: 'INV-2026-0138',
    customer: 'Robert Brown',
    address: '654 Maple Dr, Madison, AL',
    amount: 9800.00,
    status: 'pending',
    dueDate: '2026-02-05',
    paidDate: null,
  },
];

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
    blue: 'bg-blue-500/10 text-blue-400',
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
    pending: 'bg-blue-500/20 text-blue-400',
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

  // Check permission
  const userRole = (user?.role === 'owner' || user?.role === 'admin') ? 'Owner' :
                   user?.role === 'office' ? 'Office' :
                   user?.role === 'project_manager' ? 'Manager' :
                   user?.role === 'driver' ? 'Driver' : 'Sales';
  const canView = hasPermission(userRole as 'Owner' | 'Admin' | 'Manager' | 'Sales' | 'Driver' | 'Office', 'billing.view');
  const canEdit = hasPermission(userRole as 'Owner' | 'Admin' | 'Manager' | 'Sales' | 'Driver' | 'Office', 'billing.edit');

  // Filter invoices
  const filteredInvoices = RECENT_INVOICES.filter(invoice => {
    const matchesSearch = invoice.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          invoice.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          invoice.address.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
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
        {canEdit && (
          <button className="inline-flex items-center gap-2 rounded-lg bg-lime-500 px-4 py-2 font-medium text-zinc-900 transition-colors hover:bg-lime-400">
            <Plus size={18} />
            Create Invoice
          </button>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Outstanding"
          value={`$${BILLING_STATS.totalOutstanding.toLocaleString()}`}
          icon={DollarSign}
          color="orange"
        />
        <StatCard
          title="Paid This Month"
          value={`$${BILLING_STATS.paidThisMonth.toLocaleString()}`}
          icon={CheckCircle2}
          trend={{ value: 12, isPositive: true }}
          color="lime"
        />
        <StatCard
          title="Overdue Invoices"
          value={BILLING_STATS.overdueInvoices}
          icon={AlertTriangle}
          color="red"
        />
        <StatCard
          title="Pending Payments"
          value={BILLING_STATS.pendingPayments}
          icon={Clock}
          color="blue"
        />
      </div>

      {/* Invoices Table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900">
        {/* Table Header */}
        <div className="border-b border-zinc-800 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-white">Recent Invoices</h2>
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
              {filteredInvoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="border-b border-zinc-800 transition-colors hover:bg-zinc-800/50"
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-zinc-500" />
                      <span className="font-medium text-white">{invoice.id}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div>
                      <p className="font-medium text-white">{invoice.customer}</p>
                      <p className="text-sm text-zinc-500">{invoice.address}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="font-semibold text-white">
                      ${invoice.amount.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={invoice.status} />
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-400">
                    {new Date(invoice.dueDate).toLocaleDateString('en-US', {
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
              ))}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-3">
          <p className="text-sm text-zinc-500">
            Showing {filteredInvoices.length} of {RECENT_INVOICES.length} invoices
          </p>
          <div className="flex gap-2">
            <button className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800">
              Previous
            </button>
            <button className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800">
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
