'use client';

/**
 * BreakdownSheet Component
 *
 * Displays and manages a customer breakdown sheet with materials, labor, and totals.
 * Used in the billing section of the Command Center.
 */

import * as React from 'react';
import {
  Package,
  Wrench,
  DollarSign,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  FileText,
  ExternalLink,
  Loader2,
  TrendingUp,
  Calculator,
  AlertTriangle,
  Check,
  Lock,
  Unlock,
  Send,
  ChevronDown,
  ChevronUp,
  Clock,
  History,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface MaterialEntry {
  productId: string;
  productName: string;
  description?: string;
  quantity: number;
  unit: string;
  costPrice: number;
  sellPrice: number;
  totalCost: number;
  totalPrice: number;
  addedAt: string;
  addedByName: string;
  fromInventory: boolean;
  inventoryDeducted: boolean;
}

interface LaborEntry {
  laborId: string;
  laborType: string;
  description: string;
  hours: number;
  rate: number;
  total: number;
  workerName: string;
  workDate: string;
  addedAt?: string;
}

interface BreakdownChange {
  changeId: string;
  action: string;
  description: string;
  changedBy: string;
  changedByName: string;
  changedAt: string;
  previousValue?: string;
  newValue?: string;
}

interface Breakdown {
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
  materials: MaterialEntry[];
  materialsCost: number;
  materialsPrice: number;
  materialMargin: number;
  laborEntries: LaborEntry[];
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
  changeLog?: BreakdownChange[];
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

interface BreakdownSheetProps {
  breakdown: Breakdown;
  onAddMaterial?: (productId: string, quantity: number) => Promise<void>;
  onRemoveMaterial?: (productId: string) => Promise<void>;
  onAddLabor?: (labor: any) => Promise<void>;
  onRemoveLabor?: (laborId: string) => Promise<void>;
  onApplyDiscount?: (amount: number, reason: string) => Promise<void>;
  onGenerateInvoice?: () => Promise<void>;
  onDeductInventory?: () => Promise<void>;
  onLock?: () => Promise<void>;
  onUnlock?: () => Promise<void>;
  onSubmitForApproval?: () => Promise<void>;
  currentUserId?: string;
  canEdit?: boolean;
  showCosts?: boolean; // Show internal cost prices (for managers)
  isLoading?: boolean;
}

export default function BreakdownSheet({
  breakdown,
  onAddMaterial,
  onRemoveMaterial,
  onAddLabor,
  onRemoveLabor,
  onApplyDiscount,
  onGenerateInvoice,
  onDeductInventory,
  onLock,
  onUnlock,
  onSubmitForApproval,
  currentUserId,
  canEdit = false,
  showCosts = false,
  isLoading = false,
}: BreakdownSheetProps) {
  const [activeTab, setActiveTab] = React.useState<'materials' | 'labor'>('materials');
  const [showAddMaterialModal, setShowAddMaterialModal] = React.useState(false);
  const [showAddLaborModal, setShowAddLaborModal] = React.useState(false);
  const [showDiscountModal, setShowDiscountModal] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const [showChangeLog, setShowChangeLog] = React.useState(false);

  // Lock state
  const isLockedByMe = breakdown.lockedBy === currentUserId;
  const isLockedByOther = !!(breakdown.lockedBy && breakdown.lockedBy !== currentUserId);
  const isLockExpired = breakdown.lockedAt
    ? Date.now() - new Date(breakdown.lockedAt).getTime() > 15 * 60 * 1000
    : false;
  const isEffectivelyLocked = isLockedByOther && !isLockExpired;

  // Check if an item was changed recently (within 24 hours)
  const isRecentlyChanged = (dateString?: string): boolean => {
    if (!dateString) return false;
    const changeTime = new Date(dateString).getTime();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    return Date.now() - changeTime < twentyFourHours;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-blue-500/20 text-blue-400',
      pending_invoice: 'bg-orange-500/20 text-orange-400',
      invoiced: 'bg-lime-500/20 text-lime-400',
      closed: 'bg-zinc-500/20 text-zinc-400'
    };

    return (
      <span className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium capitalize',
        styles[status] || styles.active
      )}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  const handleGenerateInvoice = async () => {
    if (!onGenerateInvoice) return;
    setProcessing(true);
    try {
      await onGenerateInvoice();
    } finally {
      setProcessing(false);
    }
  };

  const handleDeductInventory = async () => {
    if (!onDeductInventory) return;
    setProcessing(true);
    try {
      await onDeductInventory();
    } finally {
      setProcessing(false);
    }
  };

  const handleLock = async () => {
    if (!onLock) return;
    setProcessing(true);
    try {
      await onLock();
    } finally {
      setProcessing(false);
    }
  };

  const handleUnlock = async () => {
    if (!onUnlock) return;
    setProcessing(true);
    try {
      await onUnlock();
    } finally {
      setProcessing(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!onSubmitForApproval) return;
    setProcessing(true);
    try {
      await onSubmitForApproval();
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Lock Indicator Banner */}
      {breakdown.lockedBy && (
        <div className={cn(
          'flex items-center justify-between rounded-lg px-4 py-3 text-sm',
          isLockedByMe
            ? 'border border-lime-500/30 bg-lime-500/10'
            : isLockExpired
              ? 'border border-zinc-600 bg-zinc-800'
              : 'border border-yellow-500/30 bg-yellow-500/10'
        )}>
          <div className="flex items-center gap-2">
            <Lock size={16} className={cn(
              isLockedByMe ? 'text-lime-400' : isLockExpired ? 'text-zinc-400' : 'text-yellow-400'
            )} />
            <span className={cn(
              isLockedByMe ? 'text-lime-400' : isLockExpired ? 'text-zinc-400' : 'text-yellow-400'
            )}>
              {isLockedByMe
                ? 'You have this breakdown locked for editing'
                : isLockExpired
                  ? `Lock by ${breakdown.lockedByName} has expired`
                  : `Locked for editing by ${breakdown.lockedByName}`
              }
            </span>
            {breakdown.lockedAt && (
              <span className="text-zinc-500 text-xs">
                since {new Date(breakdown.lockedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
          {(isLockedByMe || isLockExpired) && onUnlock && (
            <button
              onClick={handleUnlock}
              disabled={processing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-600"
            >
              {processing ? <Loader2 size={14} className="animate-spin" /> : <Unlock size={14} />}
              Unlock
            </button>
          )}
        </div>
      )}

      {/* Approval Status Banner */}
      {breakdown.approvalStatus === 'pending' && (
        <div className="flex items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm">
          <ShieldAlert size={16} className="text-orange-400" />
          <span className="text-orange-400">
            Pending approval - submitted by {breakdown.approvalSubmittedByName}
            {breakdown.approvalSubmittedAt && (
              <span className="text-orange-400/60"> on {formatDate(breakdown.approvalSubmittedAt)}</span>
            )}
          </span>
        </div>
      )}
      {breakdown.approvalStatus === 'approved' && (
        <div className="flex items-center gap-2 rounded-lg border border-lime-500/30 bg-lime-500/10 px-4 py-3 text-sm">
          <ShieldCheck size={16} className="text-lime-400" />
          <span className="text-lime-400">
            Approved by {breakdown.approvalDecidedByName}
            {breakdown.approvalDecidedAt && (
              <span className="text-lime-400/60"> on {formatDate(breakdown.approvalDecidedAt)}</span>
            )}
          </span>
        </div>
      )}
      {breakdown.approvalStatus === 'rejected' && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">
          <ShieldX size={16} className="text-red-400" />
          <span className="text-red-400">
            Rejected by {breakdown.approvalDecidedByName}
            {breakdown.approvalRejectionReason && (
              <span className="text-red-400/80">: {breakdown.approvalRejectionReason}</span>
            )}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          {/* Customer & Job Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white">{breakdown.customerName}</h2>
              {getStatusBadge(breakdown.status)}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-zinc-500">Job</p>
                <p className="font-medium text-white">{breakdown.jobName}</p>
                <p className="text-sm text-zinc-400">{breakdown.jobAddress}</p>
              </div>
              <div>
                <p className="text-sm text-zinc-500">Customer Address</p>
                <p className="text-sm text-zinc-400">
                  {breakdown.customerAddress}<br />
                  {breakdown.customerCity}, {breakdown.customerState} {breakdown.customerZip}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-zinc-500">PM: </span>
                <span className="text-zinc-300">{breakdown.projectManagerName}</span>
              </div>
              <div>
                <span className="text-zinc-500">Created: </span>
                <span className="text-zinc-300">{formatDate(breakdown.createdAt)}</span>
              </div>
              {breakdown.jobNimbusId && (
                <a
                  href={`https://app.jobnimbus.com/jobs/${breakdown.jobNimbusId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-lime-400 hover:text-lime-300"
                >
                  View in JobNimbus
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg bg-zinc-800 p-3 text-center">
              <p className="text-xs text-zinc-500 uppercase">Materials</p>
              <p className="text-lg font-bold text-white">{formatCurrency(breakdown.materialsPrice)}</p>
            </div>
            <div className="rounded-lg bg-zinc-800 p-3 text-center">
              <p className="text-xs text-zinc-500 uppercase">Labor</p>
              <p className="text-lg font-bold text-white">{formatCurrency(breakdown.laborCost)}</p>
            </div>
            <div className="rounded-lg bg-zinc-800 p-3 text-center">
              <p className="text-xs text-zinc-500 uppercase">Total</p>
              <p className="text-lg font-bold text-lime-400">{formatCurrency(breakdown.totalPrice)}</p>
            </div>
            {showCosts && (
              <div className="rounded-lg bg-zinc-800 p-3 text-center">
                <p className="text-xs text-zinc-500 uppercase">Margin</p>
                <p className={cn(
                  'text-lg font-bold',
                  breakdown.profitMargin >= 20 ? 'text-lime-400' :
                  breakdown.profitMargin >= 10 ? 'text-orange-400' : 'text-red-400'
                )}>
                  {breakdown.profitMargin.toFixed(1)}%
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {canEdit && breakdown.status === 'active' && (
          <div className="mt-6 flex flex-wrap gap-3 border-t border-zinc-800 pt-4">
            {/* Lock/Unlock Buttons */}
            {!breakdown.lockedBy && onLock && (
              <button
                onClick={handleLock}
                disabled={processing}
                className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700"
              >
                {processing ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                Lock for Editing
              </button>
            )}
            {isLockedByMe && onUnlock && (
              <button
                onClick={handleUnlock}
                disabled={processing}
                className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-lime-400 transition-colors hover:bg-zinc-700"
              >
                {processing ? <Loader2 size={16} className="animate-spin" /> : <Unlock size={16} />}
                Unlock
              </button>
            )}

            {/* Edit buttons - disabled if locked by someone else */}
            <button
              onClick={() => setShowAddMaterialModal(true)}
              disabled={isEffectivelyLocked}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700",
                isEffectivelyLocked && "opacity-50 cursor-not-allowed"
              )}
            >
              <Package size={16} />
              Add Material
            </button>
            <button
              onClick={() => setShowAddLaborModal(true)}
              disabled={isEffectivelyLocked}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700",
                isEffectivelyLocked && "opacity-50 cursor-not-allowed"
              )}
            >
              <Wrench size={16} />
              Add Labor
            </button>
            <button
              onClick={() => setShowDiscountModal(true)}
              disabled={isEffectivelyLocked}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700",
                isEffectivelyLocked && "opacity-50 cursor-not-allowed"
              )}
            >
              <DollarSign size={16} />
              Apply Discount
            </button>
            <div className="flex-1" />

            {/* Submit for Approval */}
            {onSubmitForApproval && breakdown.approvalStatus !== 'pending' && (
              <button
                onClick={handleSubmitForApproval}
                disabled={processing || isEffectivelyLocked}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-500/20 px-3 py-2 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-500/30 disabled:opacity-50"
              >
                {processing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Submit for Approval
              </button>
            )}

            {breakdown.materials.some(m => m.fromInventory && !m.inventoryDeducted) && (
              <button
                onClick={handleDeductInventory}
                disabled={processing || isEffectivelyLocked}
                className="inline-flex items-center gap-2 rounded-lg bg-orange-500/20 px-3 py-2 text-sm font-medium text-orange-400 transition-colors hover:bg-orange-500/30 disabled:opacity-50"
              >
                {processing ? <Loader2 size={16} className="animate-spin" /> : <AlertTriangle size={16} />}
                Deduct Inventory
              </button>
            )}
            {!breakdown.invoiceId && (
              <button
                onClick={handleGenerateInvoice}
                disabled={processing || breakdown.materials.length === 0 || isEffectivelyLocked}
                className="inline-flex items-center gap-2 rounded-lg bg-lime-500 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-lime-400 disabled:opacity-50"
              >
                {processing ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                Generate Invoice
              </button>
            )}
          </div>
        )}

        {breakdown.invoiceId && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-lime-500/10 px-4 py-3 text-sm">
            <Check size={16} className="text-lime-400" />
            <span className="text-lime-400">
              Invoice generated: {breakdown.invoiceId}
            </span>
            <a
              href={`/api/invoices/${breakdown.invoiceId}?format=html`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 inline-flex items-center gap-1 text-lime-300 hover:text-lime-200"
            >
              View Invoice
              <ExternalLink size={14} />
            </a>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-800">
        <button
          onClick={() => setActiveTab('materials')}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
            activeTab === 'materials'
              ? 'border-b-2 border-lime-500 text-lime-400'
              : 'text-zinc-400 hover:text-zinc-300'
          )}
        >
          <Package size={16} />
          Materials ({breakdown.materials.length})
        </button>
        <button
          onClick={() => setActiveTab('labor')}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
            activeTab === 'labor'
              ? 'border-b-2 border-lime-500 text-lime-400'
              : 'text-zinc-400 hover:text-zinc-300'
          )}
        >
          <Wrench size={16} />
          Labor ({breakdown.laborEntries.length})
        </button>
      </div>

      {/* Materials Table */}
      {activeTab === 'materials' && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-sm text-zinc-500">
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium text-center">Qty</th>
                  {showCosts && (
                    <th className="px-4 py-3 font-medium text-right">Cost</th>
                  )}
                  <th className="px-4 py-3 font-medium text-right">Price</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  {showCosts && (
                    <th className="px-4 py-3 font-medium text-right">Margin</th>
                  )}
                  <th className="px-4 py-3 font-medium">Status</th>
                  {canEdit && <th className="px-4 py-3 font-medium w-16"></th>}
                </tr>
              </thead>
              <tbody>
                {breakdown.materials.length === 0 ? (
                  <tr>
                    <td colSpan={showCosts ? 8 : 6} className="px-4 py-8 text-center text-zinc-500">
                      No materials added yet
                    </td>
                  </tr>
                ) : (
                  breakdown.materials.map((material) => {
                    const margin = material.sellPrice > 0
                      ? ((material.sellPrice - material.costPrice) / material.sellPrice) * 100
                      : 0;
                    const recentlyAdded = isRecentlyChanged(material.addedAt);

                    return (
                      <tr
                        key={material.productId}
                        className={cn(
                          "border-b border-zinc-800 transition-colors hover:bg-zinc-800/50",
                          recentlyAdded && "border-l-2 border-l-lime-500"
                        )}
                      >
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-white">{material.productName}</p>
                            {material.description && (
                              <p className="text-xs text-zinc-500">{material.description}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-zinc-300">
                          {material.quantity} {material.unit}
                        </td>
                        {showCosts && (
                          <td className="px-4 py-3 text-right text-zinc-400">
                            {formatCurrency(material.costPrice)}
                          </td>
                        )}
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {formatCurrency(material.sellPrice)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-white">
                          {formatCurrency(material.totalPrice)}
                        </td>
                        {showCosts && (
                          <td className={cn(
                            'px-4 py-3 text-right font-medium',
                            margin >= 20 ? 'text-lime-400' :
                            margin >= 10 ? 'text-orange-400' : 'text-red-400'
                          )}>
                            {margin.toFixed(1)}%
                          </td>
                        )}
                        <td className="px-4 py-3">
                          {material.fromInventory ? (
                            material.inventoryDeducted ? (
                              <span className="inline-flex items-center gap-1 text-xs text-lime-400">
                                <Check size={12} /> Deducted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-orange-400">
                                <AlertTriangle size={12} /> Pending
                              </span>
                            )
                          ) : (
                            <span className="text-xs text-zinc-500">Custom</span>
                          )}
                        </td>
                        {canEdit && (
                          <td className="px-4 py-3">
                            <button
                              onClick={() => onRemoveMaterial?.(material.productId)}
                              className="rounded p-1 text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
              {breakdown.materials.length > 0 && (
                <tfoot>
                  <tr className="border-t border-zinc-700 bg-zinc-800/50">
                    <td className="px-4 py-3 font-medium text-zinc-400">
                      Materials Subtotal
                    </td>
                    <td colSpan={showCosts ? 3 : 2}></td>
                    <td className="px-4 py-3 text-right font-bold text-white">
                      {formatCurrency(breakdown.materialsPrice)}
                    </td>
                    {showCosts && (
                      <td className={cn(
                        'px-4 py-3 text-right font-bold',
                        breakdown.materialMargin >= 20 ? 'text-lime-400' :
                        breakdown.materialMargin >= 10 ? 'text-orange-400' : 'text-red-400'
                      )}>
                        {breakdown.materialMargin.toFixed(1)}%
                      </td>
                    )}
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Labor Table */}
      {activeTab === 'labor' && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-sm text-zinc-500">
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Worker</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium text-center">Hours</th>
                  <th className="px-4 py-3 font-medium text-right">Rate</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  {canEdit && <th className="px-4 py-3 font-medium w-16"></th>}
                </tr>
              </thead>
              <tbody>
                {breakdown.laborEntries.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 7 : 6} className="px-4 py-8 text-center text-zinc-500">
                      No labor entries added yet
                    </td>
                  </tr>
                ) : (
                  breakdown.laborEntries.map((labor) => {
                    const recentlyAdded = isRecentlyChanged(labor.addedAt);
                    return (
                    <tr
                      key={labor.laborId}
                      className={cn(
                        "border-b border-zinc-800 transition-colors hover:bg-zinc-800/50",
                        recentlyAdded && "border-l-2 border-l-lime-500"
                      )}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-white">{labor.description}</p>
                          <span className="inline-block mt-1 text-xs bg-zinc-700 text-zinc-400 px-2 py-0.5 rounded">
                            {labor.laborType}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-300">{labor.workerName}</td>
                      <td className="px-4 py-3 text-zinc-400">{formatDate(labor.workDate)}</td>
                      <td className="px-4 py-3 text-center text-zinc-300">{labor.hours}</td>
                      <td className="px-4 py-3 text-right text-zinc-300">
                        {formatCurrency(labor.rate)}/hr
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-white">
                        {formatCurrency(labor.total)}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <button
                            onClick={() => onRemoveLabor?.(labor.laborId)}
                            className="rounded p-1 text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                    );
                  })
                )}
              </tbody>
              {breakdown.laborEntries.length > 0 && (
                <tfoot>
                  <tr className="border-t border-zinc-700 bg-zinc-800/50">
                    <td colSpan={5} className="px-4 py-3 font-medium text-zinc-400">
                      Labor Subtotal
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-white">
                      {formatCurrency(breakdown.laborCost)}
                    </td>
                    {canEdit && <td></td>}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Totals Summary */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Calculator size={20} />
          Summary
        </h3>

        <div className="space-y-3">
          <div className="flex justify-between text-zinc-400">
            <span>Materials Subtotal</span>
            <span>{formatCurrency(breakdown.materialsPrice)}</span>
          </div>
          <div className="flex justify-between text-zinc-400">
            <span>Labor Subtotal</span>
            <span>{formatCurrency(breakdown.laborCost)}</span>
          </div>
          <div className="flex justify-between text-zinc-300 border-t border-zinc-800 pt-3">
            <span>Subtotal</span>
            <span className="font-medium">{formatCurrency(breakdown.subtotal)}</span>
          </div>

          {breakdown.discountAmount > 0 && (
            <div className="flex justify-between text-orange-400">
              <span>Discount {breakdown.discountReason && `(${breakdown.discountReason})`}</span>
              <span>-{formatCurrency(breakdown.discountAmount)}</span>
            </div>
          )}

          <div className="flex justify-between text-zinc-400">
            <span>Tax ({breakdown.taxRate}%)</span>
            <span>{formatCurrency(breakdown.taxAmount)}</span>
          </div>

          <div className="flex justify-between text-xl font-bold text-white border-t border-zinc-700 pt-3">
            <span>Total</span>
            <span className="text-lime-400">{formatCurrency(breakdown.totalPrice)}</span>
          </div>

          {showCosts && (
            <>
              <div className="border-t border-zinc-800 pt-3 mt-3">
                <div className="flex justify-between text-zinc-500 text-sm">
                  <span>Our Cost</span>
                  <span>{formatCurrency(breakdown.totalCost)}</span>
                </div>
                <div className="flex justify-between text-lime-400 text-sm mt-1">
                  <span>Profit</span>
                  <span>{formatCurrency(breakdown.totalPrice - breakdown.totalCost)}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-zinc-500 text-sm">Profit Margin</span>
                  <span className={cn(
                    'text-lg font-bold flex items-center gap-1',
                    breakdown.profitMargin >= 20 ? 'text-lime-400' :
                    breakdown.profitMargin >= 10 ? 'text-orange-400' : 'text-red-400'
                  )}>
                    <TrendingUp size={16} />
                    {breakdown.profitMargin.toFixed(1)}%
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Change Log */}
      {breakdown.changeLog && breakdown.changeLog.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900">
          <button
            onClick={() => setShowChangeLog(!showChangeLog)}
            className="flex w-full items-center justify-between px-6 py-4 text-left"
          >
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <History size={20} />
              Change Log ({breakdown.changeLog.length})
            </h3>
            {showChangeLog ? (
              <ChevronUp size={20} className="text-zinc-400" />
            ) : (
              <ChevronDown size={20} className="text-zinc-400" />
            )}
          </button>

          {showChangeLog && (
            <div className="border-t border-zinc-800 px-6 py-4">
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {[...breakdown.changeLog].reverse().map((change) => {
                  const isRecent = isRecentlyChanged(change.changedAt);
                  const actionColors: Record<string, string> = {
                    addMaterial: 'text-lime-400',
                    addCustomMaterial: 'text-lime-400',
                    removeMaterial: 'text-red-400',
                    addLabor: 'text-blue-400',
                    removeLabor: 'text-red-400',
                    applyDiscount: 'text-orange-400',
                    lock: 'text-yellow-400',
                    unlock: 'text-zinc-400',
                    submitForApproval: 'text-blue-400',
                    approve: 'text-lime-400',
                    reject: 'text-red-400',
                  };

                  return (
                    <div
                      key={change.changeId}
                      className={cn(
                        "flex items-start gap-3 rounded-lg bg-zinc-800/50 p-3 text-sm",
                        isRecent && "border-l-2 border-l-lime-500"
                      )}
                    >
                      <Clock size={14} className="mt-0.5 shrink-0 text-zinc-500" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn(
                            'font-medium',
                            actionColors[change.action] || 'text-zinc-300'
                          )}>
                            {change.action.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                          <span className="text-zinc-500">by {change.changedByName}</span>
                          <span className="text-zinc-600 text-xs">
                            {new Date(change.changedAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-1 text-zinc-400">{change.description}</p>
                        {(change.previousValue || change.newValue) && (
                          <div className="mt-1 flex items-center gap-2 text-xs">
                            {change.previousValue && (
                              <span className="text-red-400/70 line-through">{change.previousValue}</span>
                            )}
                            {change.previousValue && change.newValue && (
                              <span className="text-zinc-600">&rarr;</span>
                            )}
                            {change.newValue && (
                              <span className="text-lime-400/70">{change.newValue}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
