'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const statusBadgeVariants = cva(
  'inline-flex items-center gap-1.5 font-medium rounded-full transition-colors',
  {
    variants: {
      variant: {
        // Semantic variants
        default: 'bg-zinc-700 text-zinc-300',
        success: 'bg-green-500/20 text-green-400',
        warning: 'bg-yellow-500/20 text-yellow-400',
        danger: 'bg-red-500/20 text-red-400',
        info: 'bg-blue-500/20 text-blue-400',

        // Status-specific variants
        pending: 'bg-yellow-500/20 text-yellow-400',
        active: 'bg-green-500/20 text-green-400',
        inactive: 'bg-zinc-700 text-zinc-400',
        completed: 'bg-emerald-500/20 text-emerald-400',
        cancelled: 'bg-red-500/20 text-red-400',

        // Role variants
        owner: 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-400',
        admin: 'bg-red-500/20 text-red-400',
        manager: 'bg-cyan-500/20 text-cyan-400',
        staff: 'bg-emerald-500/20 text-emerald-400',
        driver: 'bg-blue-500/20 text-blue-400',

        // Workflow variants
        created: 'bg-zinc-700 text-zinc-300',
        assigned: 'bg-cyan-500/20 text-cyan-400',
        in_progress: 'bg-blue-500/20 text-blue-400',
        en_route: 'bg-purple-500/20 text-purple-400',
        delivered: 'bg-teal-500/20 text-teal-400',
        billed: 'bg-green-500/20 text-green-400',
        paid: 'bg-emerald-500/20 text-emerald-400',
        overdue: 'bg-red-500/20 text-red-400',
      },
      size: {
        xs: 'px-1.5 py-0.5 text-[10px]',
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-1 text-xs',
        lg: 'px-3 py-1.5 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'sm',
    },
  }
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  /** Show a dot indicator */
  dot?: boolean;
  /** Dot color (defaults to variant color) */
  dotColor?: string;
  /** Make the badge pulsate */
  pulse?: boolean;
}

/**
 * StatusBadge component for displaying status indicators.
 * Supports semantic variants, sizes, and optional dot indicator.
 */
const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ className, variant, size, dot, dotColor, pulse, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(statusBadgeVariants({ variant, size }), className)}
        {...props}
      >
        {dot && (
          <span className="relative flex h-2 w-2">
            {pulse && (
              <span
                className={cn(
                  'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
                  dotColor || 'bg-current'
                )}
              />
            )}
            <span
              className={cn(
                'relative inline-flex h-2 w-2 rounded-full',
                dotColor || 'bg-current'
              )}
            />
          </span>
        )}
        {children}
      </span>
    );
  }
);

StatusBadge.displayName = 'StatusBadge';

/**
 * Helper function to get badge variant from status string
 */
function getStatusVariant(status: string): VariantProps<typeof statusBadgeVariants>['variant'] {
  const statusMap: Record<string, VariantProps<typeof statusBadgeVariants>['variant']> = {
    // Common statuses
    pending: 'pending',
    active: 'active',
    inactive: 'inactive',
    completed: 'completed',
    cancelled: 'cancelled',

    // Workflow statuses
    created: 'created',
    assigned: 'assigned',
    in_progress: 'in_progress',
    en_route: 'en_route',
    delivered: 'delivered',
    billed: 'billed',
    paid: 'paid',
    overdue: 'overdue',

    // Aliases
    done: 'completed',
    finished: 'completed',
    closed: 'completed',
    open: 'active',
    new: 'created',
    processing: 'in_progress',
    shipped: 'en_route',
    expired: 'danger',
    error: 'danger',
    failed: 'danger',
    approved: 'success',
    rejected: 'danger',
    review: 'warning',
    pending_review: 'warning',
    draft: 'default',
  };

  const normalizedStatus = status.toLowerCase().replace(/[- ]/g, '_');
  return statusMap[normalizedStatus] || 'default';
}

/**
 * Format status text for display (convert snake_case to Title Case)
 */
function formatStatus(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export { StatusBadge, statusBadgeVariants, getStatusVariant, formatStatus };
