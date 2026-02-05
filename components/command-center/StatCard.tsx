'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

const statCardVariants = cva(
  'relative overflow-hidden rounded-lg border p-6 transition-all duration-200 hover:shadow-lg',
  {
    variants: {
      variant: {
        default: 'bg-[#242424] border-gray-700 text-white',
        success: 'bg-[#242424] border-green-500/50 text-white',
        warning: 'bg-[#242424] border-yellow-500/50 text-white',
        danger: 'bg-[#242424] border-red-500/50 text-white',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const iconContainerVariants = cva(
  'flex h-12 w-12 items-center justify-center rounded-lg',
  {
    variants: {
      variant: {
        default: 'bg-brand-green/20 text-brand-green',
        success: 'bg-green-500/20 text-green-400',
        warning: 'bg-yellow-500/20 text-yellow-400',
        danger: 'bg-red-500/20 text-red-400',
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
}

/**
 * StatCard component for displaying metrics with optional trend indicators.
 * Used in dashboards to show KPIs, statistics, and performance metrics.
 */
const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, variant, title, value, change, icon: Icon, description, ...props }, ref) => {
    // Determine trend direction
    const getTrendIcon = () => {
      if (change === undefined || change === null) return null;
      if (change > 0) return <TrendingUp className="h-4 w-4" />;
      if (change < 0) return <TrendingDown className="h-4 w-4" />;
      return <Minus className="h-4 w-4" />;
    };

    const getTrendColor = () => {
      if (change === undefined || change === null) return '';
      if (change > 0) return 'text-green-400';
      if (change < 0) return 'text-red-400';
      return 'text-gray-400';
    };

    const formatChange = () => {
      if (change === undefined || change === null) return '';
      const sign = change > 0 ? '+' : '';
      return `${sign}${change.toFixed(1)}%`;
    };

    return (
      <div
        ref={ref}
        className={cn(statCardVariants({ variant }), className)}
        {...props}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-400">{title}</p>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="text-3xl font-bold tracking-tight">{value}</p>
              {change !== undefined && change !== null && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-sm font-medium',
                    getTrendColor()
                  )}
                  aria-label={`${change > 0 ? 'Increased' : change < 0 ? 'Decreased' : 'No change'} by ${Math.abs(change).toFixed(1)} percent`}
                >
                  {getTrendIcon()}
                  {formatChange()}
                </span>
              )}
            </div>
            {description && (
              <p className="mt-2 text-sm text-gray-500">{description}</p>
            )}
          </div>
          {Icon && (
            <div className={cn(iconContainerVariants({ variant }))}>
              <Icon className="h-6 w-6" aria-hidden="true" />
            </div>
          )}
        </div>

        {/* Decorative gradient accent based on variant */}
        <div
          className={cn(
            'absolute bottom-0 left-0 h-1 w-full',
            variant === 'success' && 'bg-gradient-to-r from-green-500 to-green-400',
            variant === 'warning' && 'bg-gradient-to-r from-yellow-500 to-yellow-400',
            variant === 'danger' && 'bg-gradient-to-r from-red-500 to-red-400',
            (!variant || variant === 'default') && 'bg-gradient-to-r from-brand-green to-green-400'
          )}
          aria-hidden="true"
        />
      </div>
    );
  }
);

StatCard.displayName = 'StatCard';

export { StatCard, statCardVariants };
