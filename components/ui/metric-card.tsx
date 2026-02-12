'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

const metricCardVariants = cva(
  'relative overflow-hidden rounded-xl border p-4 transition-all duration-200',
  {
    variants: {
      variant: {
        default: 'bg-zinc-900 border-zinc-800 hover:border-zinc-700',
        success: 'bg-zinc-900 border-green-500/30 hover:border-green-500/50',
        warning: 'bg-zinc-900 border-yellow-500/30 hover:border-yellow-500/50',
        danger: 'bg-zinc-900 border-red-500/30 hover:border-red-500/50',
        info: 'bg-zinc-900 border-blue-500/30 hover:border-blue-500/50',
        lime: 'bg-zinc-900 border-lime-500/30 hover:border-lime-500/50',
      },
      size: {
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

const iconVariants = cva('flex items-center justify-center rounded-lg', {
  variants: {
    variant: {
      default: 'bg-zinc-800 text-zinc-400',
      success: 'bg-green-500/20 text-green-400',
      warning: 'bg-yellow-500/20 text-yellow-400',
      danger: 'bg-red-500/20 text-red-400',
      info: 'bg-blue-500/20 text-blue-400',
      lime: 'bg-lime-500/20 text-lime-400',
    },
    size: {
      sm: 'h-9 w-9',
      md: 'h-10 w-10',
      lg: 'h-12 w-12',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'md',
  },
});

export interface MetricCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof metricCardVariants> {
  /** Card title/label */
  title: string;
  /** Main value to display */
  value: string | number;
  /** Optional percentage change (positive or negative) */
  change?: number;
  /** Change label (e.g., "vs last week") */
  changeLabel?: string;
  /** Optional Lucide icon component */
  icon?: LucideIcon;
  /** Optional description text below the value */
  description?: string;
  /** Loading state */
  loading?: boolean;
  /** Compact layout */
  compact?: boolean;
}

/**
 * MetricCard component for displaying KPIs and statistics.
 * Features trend indicators, icons, and multiple variants.
 */
const MetricCard = React.forwardRef<HTMLDivElement, MetricCardProps>(
  (
    {
      className,
      variant,
      size,
      title,
      value,
      change,
      changeLabel,
      icon: Icon,
      description,
      loading = false,
      compact = false,
      ...props
    },
    ref
  ) => {
    // Determine trend
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

    if (loading) {
      return (
        <div
          ref={ref}
          className={cn(metricCardVariants({ variant, size }), className)}
          {...props}
        >
          <div className="animate-pulse">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-3">
                <div className="h-4 w-20 rounded bg-zinc-800" />
                <div className="h-7 w-16 rounded bg-zinc-800" />
                {!compact && <div className="h-3 w-24 rounded bg-zinc-800" />}
              </div>
              <div className={cn(iconVariants({ variant, size }), 'bg-zinc-800')} />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(metricCardVariants({ variant, size }), className)}
        {...props}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-400 truncate">{title}</p>
            <div className={cn('flex items-baseline gap-2', compact ? 'mt-1' : 'mt-2')}>
              <p className={cn('font-bold text-white tracking-tight', size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-xl' : 'text-2xl')}>
                {value}
              </p>
              {change !== undefined && change !== null && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-xs font-medium',
                    getTrendColor()
                  )}
                >
                  {getTrendIcon()}
                  {formatChange()}
                </span>
              )}
            </div>
            {description && !compact && (
              <p className="mt-1 text-xs text-zinc-500">
                {description}
                {changeLabel && change !== undefined && (
                  <span className="text-zinc-600"> {changeLabel}</span>
                )}
              </p>
            )}
          </div>
          {Icon && (
            <div className={cn(iconVariants({ variant, size }))}>
              <Icon className={size === 'lg' ? 'h-6 w-6' : size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />
            </div>
          )}
        </div>

        {/* Accent bar */}
        {variant && variant !== 'default' && (
          <div
            className={cn(
              'absolute bottom-0 left-0 h-0.5 w-full',
              variant === 'success' && 'bg-gradient-to-r from-green-500 to-green-400',
              variant === 'warning' && 'bg-gradient-to-r from-yellow-500 to-yellow-400',
              variant === 'danger' && 'bg-gradient-to-r from-red-500 to-red-400',
              variant === 'info' && 'bg-gradient-to-r from-blue-500 to-blue-400',
              variant === 'lime' && 'bg-gradient-to-r from-lime-500 to-lime-400'
            )}
          />
        )}
      </div>
    );
  }
);

MetricCard.displayName = 'MetricCard';

export { MetricCard, metricCardVariants };
