'use client';

/**
 * RCRS Command Center - Customer Breakdown Sheets
 *
 * Manages customer job breakdowns with materials, labor, and cost tracking.
 * Links to JobNimbus jobs and generates invoices.
 *
 * Role-based: Requires billing.view permission
 */

import * as React from 'react';
import {
  ClipboardList,
  Search,
  Filter,
  Plus,
  FileText,
  Package,
  Wrench,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Loader2,
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  X,
  Lock,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { hasPermission } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import BreakdownSheet from '@/components/command-center/BreakdownSheet';

// Types
interface BreakdownSummary {
  breakdownId: string;
  customerId: string;
  customerName: string;
  jobName: string;
  jobAddress: string;
  status: 'active' | 'pending_invoice' | 'invoiced' | 'closed';
  materialsPrice: number;
  laborCost: number;
  totalPrice: number;
  profitMargin: number;
  invoiceId?: string;
  lockedBy?: string;
  lockedByName?: string;
  lockedAt?: string;
  approvalStatus?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BreakdownDetail {
  breakdownId: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress: string;
  customerCity: string;
  customerState: string;
  customerZip: string;
  jobId: string;
  jobNimbusId?: string;
  jobName: string;
  jobAddress: string;
  projectManagerName: string;
  materials: any[];
  materialsCost: number;
  materialsPrice: number;
  materialMargin: number;
  laborEntries: any[];
  laborCost: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  discountReason?: string;
  totalCost: number;
  totalPrice: number;
  profitMargin: number;
  status: string;
  invoiceId?: string;
  lockedBy?: string;
  lockedByName?: string;
  lockedAt?: string;
  changeLog?: any[];
  requiresApproval?: boolean;
  approvalStatus?: string | null;
  approvalSubmittedByName?: string;
  approvalSubmittedAt?: string;
  approvalDecidedByName?: string;
  approvalDecidedAt?: string;
  approvalRejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

interface BreakdownStats {
  total: number;
  active: number;
  pendingInvoice: number;
  invoiced: number;
  totalMaterialsValue: number;
  totalLaborValue: number;
  totalValue: number;
  averageMargin: number;
}

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { color: string; label: string }> = {
    active: { color: 'bg-brand-green/20 text-blue-400', label: 'Active' },
    pending_invoice: { color: 'bg-orange-500/20 text-orange-400', label: 'Pending Invoice' },
    invoiced: { color: 'bg-lime-500/20 text-lime-400', label: 'Invoiced' },
    closed: { color: 'bg-zinc-500/20 text-zinc-400', label: 'Closed' },
    pending_approval: { color: 'bg-purple-500/20 text-purple-400', label: 'Pending Approval' }
  };

  const config = configs[status] || configs.active;

  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
      config.color
    )}>
      {config.label}
    </span>
  );
}

// Stat card component
function StatCard({ title, value, subValue, icon: Icon, color }: {
  title: string;
  value: string | number;
  subValue?: string;
  icon: any;
  color: 'lime' | 'blue' | 'purple' | 'orange';
}) {
  const colorClasses = {
    lime: 'bg-lime-500/10 text-lime-400',
    blue: 'bg-brand-green/10 text-blue-400',
    purple: 'bg-purple-500/10 text-purple-400',
    orange: 'bg-orange-500/10 text-orange-400',
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-400">{title}</p>
          <p className="mt-2 text-2xl font-bold text-white">{value}</p>
          {subValue && <p className="mt-1 text-xs text-zinc-500">{subValue}</p>}
        </div>
        <div className={cn('rounded-lg p-3', colorClasses[color])}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}

export default function BreakdownsPage() {
  const { user } = useAuth();
  const [breakdowns, setBreakdowns] = React.useState<BreakdownSummary[]>([]);
  const [stats, setStats] = React.useState<BreakdownStats | null>(null);
  const [selectedBreakdown, setSelectedBreakdown] = React.useState<BreakdownDetail | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = React.useState(false);

  // Check permissions
  const userRole = (user?.role === 'owner' || user?.role === 'admin') ? 'Owner' :
                   user?.role === 'office' ? 'Office' :
                   user?.role === 'project_manager' ? 'Manager' :
                   user?.role === 'driver' ? 'Driver' : 'Sales';
  const canView = hasPermission(userRole as any, 'billing.view');
  const canEdit = hasPermission(userRole as any, 'billing.edit');
  const showCosts = ['Owner', 'Admin', 'Manager', 'Office'].includes(userRole);

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

  // Fetch breakdowns
  const fetchBreakdowns = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      // pending_approval is a client-side filter on approvalStatus, not a breakdown status
      if (statusFilter !== 'all' && statusFilter !== 'pending_approval') {
        params.set('status', statusFilter);
      }

      const response = await fetch(`/api/breakdown?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch breakdowns');

      const data = await response.json();
      let fetchedBreakdowns = data.breakdowns || [];

      // Client-side filter for pending_approval
      if (statusFilter === 'pending_approval') {
        fetchedBreakdowns = fetchedBreakdowns.filter(
          (b: BreakdownSummary) => b.approvalStatus === 'pending'
        );
      }

      setBreakdowns(fetchedBreakdowns);
      setStats(data.summary || null);
    } catch (err: any) {
      console.error('Error fetching breakdowns:', err);
      setError(err.message || 'Failed to load breakdowns');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  React.useEffect(() => {
    if (canView) {
      fetchBreakdowns();
    }
  }, [canView, fetchBreakdowns]);

  // Fetch breakdown detail
  const fetchBreakdownDetail = async (breakdownId: string, customerId: string) => {
    try {
      setIsLoadingDetail(true);
      const response = await fetch(`/api/breakdown/${customerId}?breakdownId=${breakdownId}`);
      if (!response.ok) throw new Error('Failed to fetch breakdown details');

      const data = await response.json();
      setSelectedBreakdown(data.breakdown);
    } catch (err: any) {
      console.error('Error fetching breakdown:', err);
      alert(err.message || 'Failed to load breakdown details');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Filter breakdowns
  const filteredBreakdowns = breakdowns.filter(breakdown => {
    const searchLower = searchTerm.toLowerCase();
    return (
      breakdown.customerName.toLowerCase().includes(searchLower) ||
      breakdown.jobName.toLowerCase().includes(searchLower) ||
      breakdown.jobAddress.toLowerCase().includes(searchLower)
    );
  });

  // Handle generate invoice
  const handleGenerateInvoice = async () => {
    if (!selectedBreakdown) return;

    try {
      const response = await fetch('/api/invoices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          breakdownId: selectedBreakdown.breakdownId,
          createdBy: user?.userId || 'unknown',
          createdByName: user?.name || 'Unknown User'
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate invoice');
      }

      const data = await response.json();
      alert(`Invoice ${data.invoice.invoiceNumber} generated successfully!`);

      // Refresh data
      fetchBreakdownDetail(selectedBreakdown.breakdownId, selectedBreakdown.customerId);
      fetchBreakdowns();
    } catch (err: any) {
      console.error('Error generating invoice:', err);
      alert(err.message || 'Failed to generate invoice');
    }
  };

  // Handle add material
  const handleAddMaterial = async (productId: string, quantity: number) => {
    if (!selectedBreakdown) return;

    try {
      const response = await fetch(`/api/breakdown/${selectedBreakdown.customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addMaterial',
          breakdownId: selectedBreakdown.breakdownId,
          productId,
          quantity,
          addedBy: user?.userId || 'unknown',
          addedByName: user?.name || 'Unknown User'
        })
      });

      if (!response.ok) throw new Error('Failed to add material');

      const data = await response.json();
      setSelectedBreakdown(data.breakdown);
      fetchBreakdowns();
    } catch (err: any) {
      console.error('Error adding material:', err);
      alert(err.message || 'Failed to add material');
    }
  };

  // Handle remove material
  const handleRemoveMaterial = async (productId: string) => {
    if (!selectedBreakdown) return;

    try {
      const response = await fetch(`/api/breakdown/${selectedBreakdown.customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'removeMaterial',
          breakdownId: selectedBreakdown.breakdownId,
          productId,
          removedBy: user?.userId || 'unknown',
          removedByName: user?.name || 'Unknown User'
        })
      });

      if (!response.ok) throw new Error('Failed to remove material');

      const data = await response.json();
      setSelectedBreakdown(data.breakdown);
      fetchBreakdowns();
    } catch (err: any) {
      console.error('Error removing material:', err);
      alert(err.message || 'Failed to remove material');
    }
  };

  // Handle deduct inventory
  const handleDeductInventory = async () => {
    if (!selectedBreakdown) return;

    try {
      const response = await fetch(`/api/breakdown/${selectedBreakdown.customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deductInventory',
          breakdownId: selectedBreakdown.breakdownId,
          deductedBy: user?.userId || 'unknown',
          deductedByName: user?.name || 'Unknown User'
        })
      });

      if (!response.ok) throw new Error('Failed to deduct inventory');

      const data = await response.json();
      if (data.errors?.length > 0) {
        alert(`Some items failed to deduct:\n${data.errors.join('\n')}`);
      } else {
        alert('Inventory deducted successfully!');
      }

      fetchBreakdownDetail(selectedBreakdown.breakdownId, selectedBreakdown.customerId);
    } catch (err: any) {
      console.error('Error deducting inventory:', err);
      alert(err.message || 'Failed to deduct inventory');
    }
  };

  // Handle lock
  const handleLock = async () => {
    if (!selectedBreakdown) return;

    try {
      const response = await fetch(`/api/breakdown/${selectedBreakdown.customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'lock',
          breakdownId: selectedBreakdown.breakdownId,
          userId: user?.userId || 'unknown',
          userName: user?.name || 'Unknown User'
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to lock breakdown');
      }

      const data = await response.json();
      setSelectedBreakdown(data.breakdown);
    } catch (err: any) {
      console.error('Error locking breakdown:', err);
      alert(err.message || 'Failed to lock breakdown');
    }
  };

  // Handle unlock
  const handleUnlock = async () => {
    if (!selectedBreakdown) return;

    try {
      const response = await fetch(`/api/breakdown/${selectedBreakdown.customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unlock',
          breakdownId: selectedBreakdown.breakdownId,
          userId: user?.userId || 'unknown'
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to unlock breakdown');
      }

      const data = await response.json();
      setSelectedBreakdown(data.breakdown);
    } catch (err: any) {
      console.error('Error unlocking breakdown:', err);
      alert(err.message || 'Failed to unlock breakdown');
    }
  };

  // Handle submit for approval
  const handleSubmitForApproval = async () => {
    if (!selectedBreakdown) return;

    try {
      const response = await fetch(`/api/breakdown/${selectedBreakdown.customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submitForApproval',
          breakdownId: selectedBreakdown.breakdownId,
          submittedBy: user?.userId || 'unknown',
          submittedByName: user?.name || 'Unknown User'
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit for approval');
      }

      const data = await response.json();
      setSelectedBreakdown(data.breakdown);
      alert('Breakdown submitted for approval successfully!');
      fetchBreakdowns();
    } catch (err: any) {
      console.error('Error submitting for approval:', err);
      alert(err.message || 'Failed to submit for approval');
    }
  };

  if (!canView) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <ClipboardList className="mx-auto h-12 w-12 text-zinc-600" />
          <h2 className="mt-4 text-xl font-semibold text-white">Access Restricted</h2>
          <p className="mt-2 text-zinc-400">
            You do not have permission to view breakdowns.
          </p>
        </div>
      </div>
    );
  }

  // Detail view
  if (selectedBreakdown) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setSelectedBreakdown(null)}
          className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={18} />
          Back to Breakdowns
        </button>

        {isLoadingDetail ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-lime-400" />
            <span className="ml-2 text-zinc-400">Loading breakdown...</span>
          </div>
        ) : (
          <BreakdownSheet
            breakdown={selectedBreakdown}
            onAddMaterial={handleAddMaterial}
            onRemoveMaterial={handleRemoveMaterial}
            onGenerateInvoice={handleGenerateInvoice}
            onDeductInventory={handleDeductInventory}
            onLock={handleLock}
            onUnlock={handleUnlock}
            onSubmitForApproval={handleSubmitForApproval}
            currentUserId={user?.userId}
            canEdit={canEdit && selectedBreakdown.status === 'active'}
            showCosts={showCosts}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Customer Breakdowns</h1>
          <p className="mt-1 text-zinc-400">
            Manage job cost sheets, materials, and labor tracking
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/command-center/billing"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
          >
            <DollarSign size={18} />
            Billing Dashboard
          </a>
          {canEdit && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-lime-500 px-4 py-2 font-medium text-zinc-900 transition-colors hover:bg-lime-400"
            >
              <Plus size={18} />
              New Breakdown
            </button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-lime-400" />
          <span className="ml-2 text-zinc-400">Loading breakdowns...</span>
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
              onClick={fetchBreakdowns}
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
          {/* Stats */}
          {stats && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Active Breakdowns"
                value={stats.active}
                icon={ClipboardList}
                color="blue"
              />
              <StatCard
                title="Total Materials"
                value={formatCurrency(stats.totalMaterialsValue)}
                icon={Package}
                color="purple"
              />
              <StatCard
                title="Total Labor"
                value={formatCurrency(stats.totalLaborValue)}
                icon={Wrench}
                color="orange"
              />
              <StatCard
                title="Avg Margin"
                value={`${stats.averageMargin.toFixed(1)}%`}
                subValue={formatCurrency(stats.totalValue) + ' total value'}
                icon={TrendingUp}
                color="lime"
              />
            </div>
          )}

          {/* Filters */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {['all', 'active', 'pending_invoice', 'invoiced', 'closed', 'pending_approval'].map((status) => (
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
                    {status === 'pending_invoice' ? 'Pending Invoice' :
                     status === 'pending_approval' ? 'Pending Approval' :
                     status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search breakdowns..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 pl-10 pr-4 text-sm text-white placeholder-zinc-500 focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500 sm:w-64"
                />
              </div>
            </div>
          </div>

          {/* Breakdowns Table */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-sm text-zinc-500">
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Job</th>
                    <th className="px-4 py-3 font-medium text-right">Materials</th>
                    <th className="px-4 py-3 font-medium text-right">Labor</th>
                    <th className="px-4 py-3 font-medium text-right">Total</th>
                    {showCosts && <th className="px-4 py-3 font-medium text-right">Margin</th>}
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Updated</th>
                    <th className="px-4 py-3 font-medium w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBreakdowns.length === 0 ? (
                    <tr>
                      <td colSpan={showCosts ? 9 : 8} className="px-4 py-8 text-center text-zinc-500">
                        No breakdowns found
                      </td>
                    </tr>
                  ) : (
                    filteredBreakdowns.map((breakdown) => (
                      <tr
                        key={breakdown.breakdownId}
                        onClick={() => fetchBreakdownDetail(breakdown.breakdownId, breakdown.customerId)}
                        className="border-b border-zinc-800 transition-colors hover:bg-zinc-800/50 cursor-pointer"
                      >
                        <td className="px-4 py-4">
                          <p className="font-medium text-white">{breakdown.customerName}</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-zinc-300">{breakdown.jobName}</p>
                          <p className="text-xs text-zinc-500">{breakdown.jobAddress}</p>
                        </td>
                        <td className="px-4 py-4 text-right text-zinc-300">
                          {formatCurrency(breakdown.materialsPrice)}
                        </td>
                        <td className="px-4 py-4 text-right text-zinc-300">
                          {formatCurrency(breakdown.laborCost)}
                        </td>
                        <td className="px-4 py-4 text-right font-semibold text-white">
                          {formatCurrency(breakdown.totalPrice)}
                        </td>
                        {showCosts && (
                          <td className={cn(
                            'px-4 py-4 text-right font-medium',
                            breakdown.profitMargin >= 20 ? 'text-lime-400' :
                            breakdown.profitMargin >= 10 ? 'text-orange-400' : 'text-red-400'
                          )}>
                            {breakdown.profitMargin.toFixed(1)}%
                          </td>
                        )}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <StatusBadge status={breakdown.status} />
                            {breakdown.lockedBy && (
                              <span title={`Locked by ${breakdown.lockedByName}`}>
                                <Lock size={14} className="text-yellow-400" />
                              </span>
                            )}
                            {breakdown.approvalStatus === 'pending' && (
                              <span title="Pending Approval">
                                <ShieldAlert size={14} className="text-purple-400" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-zinc-400">
                          {formatDate(breakdown.updatedAt)}
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
                Showing {filteredBreakdowns.length} of {breakdowns.length} breakdowns
              </p>
              <button
                onClick={fetchBreakdowns}
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
