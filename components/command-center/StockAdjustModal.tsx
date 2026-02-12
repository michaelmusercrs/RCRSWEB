'use client';

/**
 * RCRS Command Center - Stock Adjustment Modal
 *
 * A modal component for adjusting inventory stock levels.
 * Features:
 * - Current quantity display
 * - +/- buttons for quick adjustment
 * - Manual quantity input
 * - Required reason field with preset options
 * - New quantity preview
 * - Loading state during submission
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import * as React from 'react';
import {
  X,
  Plus,
  Minus,
  Package,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface InventoryItemBasic {
  sku: string;
  name: string;
  quantity: number;
  minStock: number;
  unit?: string;
  imageUrl?: string;
}

export interface StockAdjustModalProps {
  /** The inventory item to adjust */
  item: InventoryItemBasic;
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when adjustment is submitted */
  onSubmit: (sku: string, adjustment: number, reason: string) => Promise<void> | void;
  /** Whether the submission is in progress */
  isSubmitting?: boolean;
}

// =============================================================================
// REASON OPTIONS
// =============================================================================

const REASON_OPTIONS = [
  { value: 'Sold', label: 'Sold' },
  { value: 'Restocked', label: 'Restocked' },
  { value: 'Damaged', label: 'Damaged' },
  { value: 'Returned', label: 'Returned' },
  { value: 'Correction', label: 'Correction' },
  { value: 'Used on Job', label: 'Used on Job' },
  { value: 'Other', label: 'Other' },
];

// =============================================================================
// COMPONENT
// =============================================================================

export function StockAdjustModal({
  item,
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
}: StockAdjustModalProps) {
  // State
  const [adjustment, setAdjustment] = React.useState(0);
  const [reason, setReason] = React.useState('');
  const [customReason, setCustomReason] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  // Refs
  const modalRef = React.useRef<HTMLDivElement>(null);

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setAdjustment(0);
      setReason('');
      setCustomReason('');
      setError(null);
    }
  }, [isOpen]);

  // Handle escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  // Prevent body scroll when modal is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Calculate new quantity
  const newQuantity = Math.max(0, item.quantity + adjustment);
  const isLowStock = newQuantity <= item.minStock;
  const willBeOutOfStock = newQuantity === 0;

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (adjustment === 0) {
      setError('Adjustment cannot be zero');
      return;
    }

    const finalReason = reason === 'Other' ? customReason : reason;
    if (!finalReason.trim()) {
      setError('Please select or enter a reason');
      return;
    }

    try {
      await onSubmit(item.sku, adjustment, finalReason);
    } catch (err) {
      setError('Failed to adjust stock. Please try again.');
    }
  };

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node) && !isSubmitting) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="w-full max-w-md overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl my-auto max-h-[90vh] max-h-[90dvh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <h2 id="modal-title" className="text-lg font-semibold text-white">
            Adjust Stock
          </h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Content */}
          <div className="p-6">
            {/* Item Info */}
            <div className="flex items-center gap-4 rounded-lg bg-zinc-800/50 p-4">
              <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Package className="h-7 w-7 text-zinc-600" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-white truncate">{item.name}</h3>
                <p className="font-mono text-sm text-zinc-500">{item.sku}</p>
              </div>
            </div>

            {/* Current vs New Quantity */}
            <div className="mt-6 flex items-center justify-center gap-6">
              <div className="text-center">
                <p className="text-xs uppercase tracking-wider text-zinc-500">
                  Current
                </p>
                <p className="mt-1 text-3xl font-bold text-zinc-400">
                  {item.quantity}
                </p>
              </div>

              <ArrowRight className="h-6 w-6 text-zinc-600" />

              <div className="text-center">
                <p className="text-xs uppercase tracking-wider text-zinc-500">
                  New
                </p>
                <p
                  className={cn(
                    'mt-1 text-3xl font-bold',
                    willBeOutOfStock && 'text-red-400',
                    isLowStock && !willBeOutOfStock && 'text-yellow-400',
                    !isLowStock && 'text-lime-400'
                  )}
                >
                  {newQuantity}
                </p>
              </div>
            </div>

            {/* Warning Messages */}
            {willBeOutOfStock && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>This will set the item to out of stock</span>
              </div>
            )}
            {isLowStock && !willBeOutOfStock && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-yellow-500/10 p-3 text-sm text-yellow-400">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>This will put the item below minimum stock level</span>
              </div>
            )}

            {/* Adjustment Input */}
            <div className="mt-6">
              <label className="text-sm font-medium text-zinc-400">
                Adjustment
              </label>
              <div className="mt-2 flex items-center gap-3">
                {/* Decrease Button */}
                <button
                  type="button"
                  onClick={() => setAdjustment((a) => a - 1)}
                  disabled={newQuantity === 0}
                  className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/20 text-red-400 transition-colors hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Minus className="h-5 w-5" />
                </button>

                {/* Input */}
                <div className="relative flex-1">
                  <input
                    type="number"
                    value={adjustment}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      // Prevent setting below -quantity (would result in negative stock)
                      setAdjustment(Math.max(-item.quantity, val));
                    }}
                    className={cn(
                      'w-full rounded-lg border bg-zinc-800 px-4 py-3 text-center text-xl font-bold text-white focus:outline-none focus:ring-2',
                      adjustment > 0 && 'border-green-500/50 focus:ring-green-500',
                      adjustment < 0 && 'border-red-500/50 focus:ring-red-500',
                      adjustment === 0 && 'border-zinc-700 focus:ring-lime-500'
                    )}
                  />
                  {adjustment !== 0 && (
                    <span
                      className={cn(
                        'absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium',
                        adjustment > 0 && 'text-green-400',
                        adjustment < 0 && 'text-red-400'
                      )}
                    >
                      {adjustment > 0 ? '+' : ''}
                      {adjustment}
                    </span>
                  )}
                </div>

                {/* Increase Button */}
                <button
                  type="button"
                  onClick={() => setAdjustment((a) => a + 1)}
                  className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/20 text-green-400 transition-colors hover:bg-green-500/30"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>

              {/* Quick Adjust Buttons */}
              <div className="mt-3 flex flex-wrap gap-2">
                {[-10, -5, 5, 10].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      const newAdj = adjustment + val;
                      setAdjustment(Math.max(-item.quantity, newAdj));
                    }}
                    disabled={val < 0 && newQuantity + val < 0}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                      val > 0
                        ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                        : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                    )}
                  >
                    {val > 0 ? '+' : ''}
                    {val}
                  </button>
                ))}
                {adjustment !== 0 && (
                  <button
                    type="button"
                    onClick={() => setAdjustment(0)}
                    className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-700"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Reason Selection */}
            <div className="mt-6">
              <label className="text-sm font-medium text-zinc-400">
                Reason <span className="text-red-400">*</span>
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
              >
                <option value="">Select a reason...</option>
                {REASON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Custom Reason Input */}
              {reason === 'Other' && (
                <input
                  type="text"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Enter reason..."
                  className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white placeholder:text-zinc-600 focus:border-lime-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
                  autoFocus
                />
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 border-t border-zinc-800 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 font-medium text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || adjustment === 0}
              className={cn(
                'flex-1 rounded-lg px-4 py-2.5 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                adjustment >= 0
                  ? 'bg-lime-500 text-zinc-900 hover:bg-lime-400'
                  : 'bg-red-500 text-white hover:bg-red-600'
              )}
            >
              {isSubmitting
                ? 'Adjusting...'
                : adjustment >= 0
                ? 'Add Stock'
                : 'Remove Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

StockAdjustModal.displayName = 'StockAdjustModal';

export default StockAdjustModal;
