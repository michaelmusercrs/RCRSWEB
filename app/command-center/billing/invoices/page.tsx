'use client';

/**
 * RCRS Command Center - Invoice Management
 *
 * Full invoice management page with list view, detail view, and actions.
 * Allows viewing, sending, and marking invoices as paid.
 *
 * Role-based: Requires billing.view permission
 */

import * as React from 'react';
import {
  FileText,
  Search,
  Filter,
  Download,
  Plus,
  Send,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  DollarSign,
  Calendar,
  RefreshCw,
  Loader2,
  ArrowLeft,
  ChevronRight,
  X,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { hasPermission } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import InvoiceGenerator from '@/components/command-center/InvoiceGenerator';

// Types
interface Invoice {
  invoiceId: string;
  invoiceNumber: string;
  breakdownId: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  billingAddress: string;
  billingCity: string;
  billingState: string;
  billingZip: string;
  jobId: string;
  jobName: string;
  jobAddress: string;
  lineItems: any[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  discountReason?: string;
  total: number;
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled' | 'disputed';
  dueDate: string;
  paidDate?: string;
  paidAmount?: number;
  paymentMethod?: string;
  createdAt: string;
  createdByName: string;
  sentAt?: string;
  sentTo?: string;
  notes: string[];
  terms?: string;
}

interface InvoiceSummary {
  total: number;
  draft: number;
  sent: number;
  viewed: number;
  paid: number;
  overdue: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { color: string; icon: any }> = {
    draft: { color: 'bg-zinc-500/20 text-zinc-400', icon: FileText },
    sent: { color: 'bg-brand-green/20 text-blue-400', icon: Send },
    viewed: { color: 'bg-purple-500/20 text-purple-400', icon: Eye },
    paid: { color: 'bg-lime-500/20 text-lime-400', icon: CheckCircle2 },
    overdue: { color: 'bg-red-500/20 text-red-400', icon: AlertTriangle },
    cancelled: { color: 'bg-zinc-500/20 text-zinc-500', icon: X },
    disputed: { color: 'bg-orange-500/20 text-orange-400', icon: AlertTriangle }
  };

  const config = configs[status] || configs.draft;
  const Icon = config.icon;

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize',
      config.color
    )}>
      <Icon size={12} />
      {status}
    </span>
  );
}

// Stat card component
function StatCard({ title, value, subValue, color }: {
  title: string;
  value: string | number;
  subValue?: string;
  color: 'lime' | 'blue' | 'red' | 'orange' | 'purple';
}) {
  const colorClasses = {
    lime: 'bg-lime-500/10 text-lime-400 border-lime-500/20',
    blue: 'bg-brand-green/10 text-blue-400 border-blue-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  };

  return (
    <div className={cn('rounded-xl border p-4', colorClasses[color])}>
      <p className="text-sm font-medium opacity-80">{title}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {subValue && <p className="mt-1 text-xs opacity-60">{subValue}</p>}
    </div>
  );
}

export default function InvoicesPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [summary, setSummary] = React.useState<InvoiceSummary | null>(null);
  const [selectedInvoice, setSelectedInvoice] = React.useState<Invoice | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Check permissions
  const userRole = (user?.role === 'owner' || user?.role === 'admin') ? 'Owner' :
                   user?.role === 'office' ? 'Office' :
                   user?.role === 'project_manager' ? 'Manager' :
                   user?.role === 'driver' ? 'Driver' : 'Sales';
  const canView = hasPermission(userRole as any, 'billing.view');
  const canEdit = hasPermission(userRole as any, 'billing.edit');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Fetch invoices
  const fetchInvoices = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      const response = await fetch(`/api/invoices?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch invoices');

      const data = await response.json();
      setInvoices(data.invoices || []);
      setSummary(data.summary || null);
    } catch (err: any) {
      console.error('Error fetching invoices:', err);
      setError(err.message || 'Failed to load invoices');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  React.useEffect(() => {
    if (canView) {
      fetchInvoices();
    }
  }, [canView, fetchInvoices]);

  // Filter invoices by search
  const filteredInvoices = invoices.filter(invoice => {
    const searchLower = searchTerm.toLowerCase();
    return (
      invoice.invoiceNumber.toLowerCase().includes(searchLower) ||
      invoice.customerName.toLowerCase().includes(searchLower) ||
      invoice.jobName.toLowerCase().includes(searchLower)
    );
  });

  // Handle send invoice
  const handleSend = async (email: string) => {
    if (!selectedInvoice) return;

    try {
      const response = await fetch(`/api/invoices/${selectedInvoice.invoiceId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sentTo: email,
          sentBy: user?.userId || 'unknown',
          sentByName: user?.name || 'Unknown User'
        })
      });

      if (!response.ok) throw new Error('Failed to send invoice');

      const data = await response.json();
      setSelectedInvoice(data.invoice);
      fetchInvoices();
    } catch (err: any) {
      console.error('Error sending invoice:', err);
      alert(err.message || 'Failed to send invoice');
    }
  };

  // Handle mark as paid
  const handleMarkPaid = async (amount: number, method: string, reference: string) => {
    if (!selectedInvoice) return;

    try {
      const response = await fetch(`/api/invoices/${selectedInvoice.invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'paid',
          updatedBy: user?.userId || 'unknown',
          updatedByName: user?.name || 'Unknown User',
          paidAmount: amount,
          paymentMethod: method,
          paymentReference: reference
        })
      });

      if (!response.ok) throw new Error('Failed to update invoice');

      const data = await response.json();
      setSelectedInvoice(data.invoice);
      fetchInvoices();
    } catch (err: any) {
      console.error('Error updating invoice:', err);
      alert(err.message || 'Failed to update invoice');
    }
  };

  // Handle copy link
  const handleCopyLink = () => {
    if (!selectedInvoice) return;
    const link = `${window.location.origin}/api/invoices/${selectedInvoice.invoiceId}?format=html`;
    navigator.clipboard.writeText(link);
    alert('Invoice link copied to clipboard');
  };

  if (!canView) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <FileText className="mx-auto h-12 w-12 text-zinc-600" />
          <h2 className="mt-4 text-xl font-semibold text-white">Access Restricted</h2>
          <p className="mt-2 text-zinc-400">
            You do not have permission to view invoices.
          </p>
        </div>
      </div>
    );
  }

  // Detail view
  if (selectedInvoice) {
    return (
      <div className="space-y-6">
        {/* Back button */}
        <button
          onClick={() => setSelectedInvoice(null)}
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={18} />
          Back to Invoices
        </button>

        <InvoiceGenerator
          invoice={selectedInvoice}
          onSend={handleSend}
          onMarkPaid={handleMarkPaid}
          onCopyLink={handleCopyLink}
          canEdit={canEdit}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Invoices</h1>
          <p className="mt-1 text-zinc-400">
            Manage and track customer invoices
          </p>
        </div>
        <a
          href="/command-center/billing"
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
        >
          <DollarSign size={18} />
          Billing Dashboard
        </a>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-lime-400" />
          <span className="ml-2 text-zinc-400">Loading invoices...</span>
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
              onClick={fetchInvoices}
              className="inline-flex items-center gap-2 rounded-lg bg-red-500/20 px-3 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30"
            >
              <RefreshCw size={14} />
              Retry
            </button>
          </div>
        </div>
      )}

      {!isLoading && !error && (
        <>
          {/* Summary Stats */}
          {summary && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard
                title="Total Invoices"
                value={summary.total}
                color="blue"
              />
              <StatCard
                title="Paid"
                value={summary.paid}
                subValue={formatCurrency(summary.paidAmount)}
                color="lime"
              />
              <StatCard
                title="Outstanding"
                value={summary.sent + summary.viewed}
                subValue={formatCurrency(summary.outstandingAmount)}
                color="orange"
              />
              <StatCard
                title="Overdue"
                value={summary.overdue}
                color="red"
              />
              <StatCard
                title="Drafts"
                value={summary.draft}
                color="purple"
              />
            </div>
          )}

          {/* Filters & Search */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {['all', 'draft', 'sent', 'viewed', 'paid', 'overdue'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                      statusFilter === status
                        ? 'bg-lime-500 text-zinc-900'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                    )}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>

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
            </div>
          </div>

          {/* Invoices Table */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-sm text-zinc-500">
                    <th className="px-4 py-3 font-medium">Invoice</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Job</th>
                    <th className="px-4 py-3 font-medium text-right">Amount</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Due Date</th>
                    <th className="px-4 py-3 font-medium w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                        No invoices found
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((invoice) => (
                      <tr
                        key={invoice.invoiceId}
                        onClick={() => setSelectedInvoice(invoice)}
                        className="border-b border-zinc-800 transition-colors hover:bg-zinc-800/50 cursor-pointer"
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <FileText size={16} className="text-zinc-500" />
                            <span className="font-medium text-white">{invoice.invoiceNumber}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-medium text-white">{invoice.customerName}</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-zinc-400">{invoice.jobName}</p>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="font-semibold text-white">
                            {formatCurrency(invoice.total)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={invoice.status} />
                        </td>
                        <td className="px-4 py-4">
                          <span className={cn(
                            'text-sm',
                            new Date(invoice.dueDate) < new Date() && invoice.status !== 'paid'
                              ? 'text-red-400'
                              : 'text-zinc-400'
                          )}>
                            {formatDate(invoice.dueDate)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <ChevronRight size={18} className="text-zinc-600" />
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
                Showing {filteredInvoices.length} of {invoices.length} invoices
              </p>
              <button
                onClick={fetchInvoices}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800"
              >
                <RefreshCw size={14} />
                Refresh
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
