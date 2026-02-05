'use client';

/**
 * RCRS Command Center - Inventory Card Component
 *
 * A card component for displaying inventory items in a grid view.
 * Features:
 * - Product image with fallback
 * - SKU and name display
 * - Category badge
 * - Stock level with progress bar indicator
 * - Low stock warning badge
 * - Quick adjust buttons (+1, -1)
 * - Optional cost/price display
 * - Click to navigate to detail page
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Package,
  Plus,
  Minus,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface InventoryItem {
  sku: string;
  name: string;
  description?: string;
  category: string;
  quantity: number;
  minStock: number;
  maxStock?: number;
  unit?: string;
  location?: string;
  imageUrl?: string;
  cost?: number;
  price?: number;
}

export interface InventoryCardProps {
  /** The inventory item to display */
  item: InventoryItem;
  /** Whether to show cost column */
  showCost?: boolean;
  /** Whether to show price column */
  showPrice?: boolean;
  /** Callback when adjust stock button is clicked */
  onAdjust?: () => void;
  /** Callback when quick adjust buttons are clicked */
  onQuickAdjust?: (delta: number) => void;
  /** Callback when edit button is clicked */
  onEdit?: () => void;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function InventoryCard({
  item,
  showCost = false,
  showPrice = false,
  onAdjust,
  onQuickAdjust,
  onEdit,
  className,
}: InventoryCardProps) {
  // Calculate stock status
  const isLowStock = item.quantity <= item.minStock;
  const isWarningStock =
    item.quantity <= item.minStock * 1.5 && item.quantity > item.minStock;
  const isOutOfStock = item.quantity === 0;

  // Calculate stock percentage for progress bar
  const maxStock = item.maxStock || item.minStock * 3;
  const stockPercentage = Math.min(100, (item.quantity / maxStock) * 100);

  // Calculate margin if both cost and price are available and visible
  const hasMargin = showCost && showPrice && item.cost != null && item.price != null;
  const margin = hasMargin
    ? ((item.price! - item.cost!) / item.price!) * 100
    : 0;

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border bg-zinc-900 transition-all duration-200 hover:shadow-lg',
        isOutOfStock && 'border-red-500/50 bg-red-500/5',
        isLowStock && !isOutOfStock && 'border-yellow-500/50',
        !isLowStock && !isOutOfStock && 'border-zinc-800 hover:border-zinc-700',
        className
      )}
    >
      {/* Image Section */}
      <Link href={`/command-center/inventory/${item.sku}`}>
        <div className="relative aspect-square overflow-hidden bg-zinc-800">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Package className="h-16 w-16 text-zinc-700" />
            </div>
          )}

          {/* Stock Badge Overlay */}
          {(isOutOfStock || isLowStock) && (
            <div className="absolute left-2 top-2">
              {isOutOfStock ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2.5 py-1 text-xs font-bold text-white shadow-lg">
                  OUT OF STOCK
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/90 px-2 py-1 text-xs font-semibold text-black shadow-lg">
                  <AlertTriangle className="h-3 w-3" />
                  Low Stock
                </span>
              )}
            </div>
          )}

          {/* Category Badge */}
          <div className="absolute bottom-2 right-2">
            <span className="rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
              {item.category}
            </span>
          </div>
        </div>
      </Link>

      {/* Content Section */}
      <div className="p-4">
        {/* SKU */}
        <p className="font-mono text-xs text-zinc-500">{item.sku}</p>

        {/* Name */}
        <Link href={`/command-center/inventory/${item.sku}`}>
          <h3 className="mt-1 font-semibold text-white line-clamp-2 hover:text-lime-400">
            {item.name}
          </h3>
        </Link>

        {/* Description */}
        {item.description && (
          <p className="mt-1 text-xs text-zinc-500 line-clamp-1">
            {item.description}
          </p>
        )}

        {/* Stock Level */}
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">Stock</span>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'text-lg font-bold',
                  isOutOfStock && 'text-red-400',
                  isLowStock && !isOutOfStock && 'text-yellow-400',
                  isWarningStock && 'text-yellow-400',
                  !isLowStock && !isWarningStock && 'text-lime-400'
                )}
              >
                {item.quantity}
              </span>
              <span className="text-xs text-zinc-600">
                / {item.minStock} min
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300',
                isOutOfStock && 'bg-red-500',
                isLowStock && !isOutOfStock && 'bg-yellow-500',
                isWarningStock && !isLowStock && 'bg-yellow-500',
                !isLowStock && !isWarningStock && 'bg-lime-500'
              )}
              style={{ width: `${stockPercentage}%` }}
            />
          </div>
        </div>

        {/* Price/Cost Row */}
        {(showCost || showPrice) && (
          <div className="mt-3 flex items-center justify-between border-t border-zinc-800 pt-3">
            {showCost && item.cost != null && (
              <div>
                <p className="text-xs text-zinc-500">Cost</p>
                <p className="font-medium text-zinc-400">
                  ${item.cost.toFixed(2)}
                </p>
              </div>
            )}
            {showPrice && item.price != null && (
              <div className={showCost ? 'text-right' : ''}>
                <p className="text-xs text-zinc-500">Price</p>
                <p className="font-semibold text-lime-400">
                  ${item.price.toFixed(2)}
                </p>
              </div>
            )}
            {hasMargin && (
              <div className="text-right">
                <p className="text-xs text-zinc-500">Margin</p>
                <p className="font-medium text-green-400">
                  {margin.toFixed(0)}%
                </p>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-4 flex items-center gap-2">
          {/* Quick Adjust Buttons */}
          {onQuickAdjust && (
            <>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onQuickAdjust(-1);
                }}
                disabled={item.quantity === 0}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/20 text-red-400 transition-colors hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                title="Remove 1"
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onQuickAdjust(1);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/20 text-green-400 transition-colors hover:bg-green-500/30"
                title="Add 1"
              >
                <Plus className="h-4 w-4" />
              </button>
            </>
          )}

          {/* Adjust Stock Button */}
          {onAdjust && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAdjust();
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-zinc-800 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
            >
              <RefreshCw className="h-4 w-4" />
              Adjust
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

InventoryCard.displayName = 'InventoryCard';

export default InventoryCard;
