'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

const statCardVariants = cva(
  'relative overflow-hidden rounded-xl border p-5 transition-all duration-200',
  {
    variants: {
      variant: {
        default: 'bg-zinc-900 border-zinc-800 hover:border-zinc-700',
        success: 'bg-zinc-900 border-green-500/30 hover:border-green-500/50',
        warning: 'bg-zinc-900 border-yellow-500/30 hover:border-yellow-500/50',
        danger: 'bg-zinc-900 border-red-500/30 hover:border-red-500/50',
        info: 'bg-zinc-900 border-blue-500/30 hover:border-blue-500/50',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const iconContainerVariants = cva(
  'flex h-11 w-11 items-center justify-center rounded-lg shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-lime-500/15 text-lime-400',
        success: 'bg-green-500/15 text-green-400',
        warning: 'bg-yellow-500/15 text-yellow-400',
        danger: 'bg-red-500/15 text-red-400',
        info: 'bg-blue-500/15 text-blue-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface StatCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statCardVariants> {
  /** Card title/label */
  title: string;
  /** Main value to display */
  value: string | number;
  /** Optional percentage change (positive or negative) */
  change?: number;
  /** Optional Lucide icon component */
  icon?: LucideIcon;
  /** Optional description text below the value */
  description?: string;
  /** Loading state */
  loading?: boolean;
  /** Compact mode */
  compact?: boolean;
}

/**
 * StatCard component for displaying metrics with optional trend indicators.
 * Used in dashboards to show KPIs, statistics, and performance metrics.
 */
const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, variant, title, value, change, icon: Icon, description, loading = false, compact = false, ...props }, ref) => {
    // Determine trend direction
    const getTrendIcon = () => {
      if (change === undefined || change === null) return null;
      if (change > 0) return <TrendingUp className="h-3.5 w-3.5" />;
      if (change < 0) return <TrendingDown className="h-3.5 w-3.5" />;
      return <Minus className="h-3.5 w-3.5" />;
    };

    const getTrendColor = () => {
      if (change === undefined || change === null) return '';
      if (change > 0) return 'text-green-400';
      if (change < 0) return 'text-red-400';
      return 'text-zinc-400';
    };

    const formatChange = () => {
      if (change === undefined || change === null) return '';
      const sign = change > 0 ? '+' : '';
      return `${sign}${change.toFixed(1)}%`;
    };

    // Loading skeleton
    if (loading) {
      return (
        <div
          ref={ref}
          className={cn(statCardVariants({ variant }), className)}
          {...props}
        >
          <div className="animate-pulse">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-3">
                <div className="h-4 w-20 rounded bg-zinc-800" />
                <div className="h-7 w-16 rounded bg-zinc-800" />
                {!compact && <div className="h-3 w-24 rounded bg-zinc-800" />}
              </div>
              <div className={cn(iconContainerVariants({ variant }), 'bg-zinc-800')} />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(statCardVariants({ variant }), className)}
        {...props}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-400 truncate">{title}</p>
            <div className={cn('flex items-baseline gap-2', compact ? 'mt-1' : 'mt-2')}>
              <p className="text-2xl font-bold tracking-tight text-white">{value}</p>
              {change !== undefined && change !== null && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-xs font-medium',
                    getTrendColor()
                  )}
                  aria-label={`${change > 0 ? 'Increased' : change < 0 ? 'Decreased' : 'No change'} by ${Math.abs(change).toFixed(1)} percent`}
                >
                  {getTrendIcon()}
                  {formatChange()}
                </span>
              )}
            </div>
            {description && !compact && (
              <p className="mt-1.5 text-xs text-zinc-500">{description}</p>
            )}
          </div>
          {Icon && (
            <div className={cn(iconContainerVariants({ variant }))}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
          )}
        </div>

        {/* Decorative gradient accent based on variant */}
        <div
          className={cn(
            'absolute bottom-0 left-0 h-0.5 w-full',
            variant === 'success' && 'bg-gradient-to-r from-green-500 to-green-400',
            variant === 'warning' && 'bg-gradient-to-r from-yellow-500 to-yellow-400',
            variant === 'danger' && 'bg-gradient-to-r from-red-500 to-red-400',
            variant === 'info' && 'bg-gradient-to-r from-blue-500 to-blue-400',
            (!variant || variant === 'default') && 'bg-gradient-to-r from-lime-500 to-lime-400'
          )}
          aria-hidden="true"
        />
      </div>
    );
  }
);

StatCard.displayName = 'StatCard';

export { StatCard, statCardVariants };
