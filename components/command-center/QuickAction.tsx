'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const quickActionVariants = cva(
  'inline-flex flex-col items-center justify-center gap-2 rounded-lg border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-zinc-800 border-gray-700 text-gray-200 hover:bg-gray-700/50 hover:border-brand-green/50 focus:ring-brand-green',
        primary:
          'bg-brand-green/10 border-brand-green/30 text-brand-green hover:bg-brand-green/20 hover:border-brand-green focus:ring-brand-green',
        success:
          'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20 hover:border-green-500 focus:ring-green-500',
        warning:
          'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 hover:border-yellow-500 focus:ring-yellow-500',
        danger:
          'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500 focus:ring-red-500',
        ghost:
          'bg-transparent border-transparent text-gray-400 hover:bg-gray-700/30 hover:text-gray-200 focus:ring-gray-500',
      },
      size: {
        sm: 'w-20 h-20 p-2 text-xs',
        md: 'w-24 h-24 p-3 text-sm',
        lg: 'w-32 h-32 p-4 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

const iconSizeMap = {
  sm: 'h-5 w-5',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

export interface QuickActionProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof quickActionVariants> {
  /** Lucide icon component to display */
  icon: LucideIcon;
  /** Action label text */
  label: string;
  /** Optional badge/count to display */
  badge?: string | number;
  /** Loading state */
  loading?: boolean;
}

/**
 * QuickAction component for dashboard quick actions and shortcuts.
 * Displays an icon with label in a card-like button format.
 *
 * @example
 * <QuickAction icon={Plus} label="New Order" onClick={handleNewOrder} />
 * <QuickAction icon={Package} label="Inventory" variant="primary" badge={5} />
 * <QuickAction icon={Truck} label="Deliveries" variant="warning" disabled />
 */
const QuickAction = React.forwardRef<HTMLButtonElement, QuickActionProps>(
  (
    {
      className,
      variant,
      size = 'md',
      icon: Icon,
      label,
      badge,
      loading = false,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(quickActionVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-label={label}
        {...props}
      >
        <div className="relative">
          {loading ? (
            <div
              className={cn(
                'animate-spin rounded-full border-2 border-current border-t-transparent',
                iconSizeMap[size || 'md']
              )}
              aria-hidden="true"
            />
          ) : (
            <Icon className={cn(iconSizeMap[size || 'md'])} aria-hidden="true" />
          )}
          {badge !== undefined && !loading && (
            <span
              className={cn(
                'absolute -top-2 -right-2 flex items-center justify-center rounded-full bg-brand-green text-black text-xs font-bold',
                size === 'sm' ? 'h-4 w-4 min-w-4' : 'h-5 w-5 min-w-5'
              )}
              aria-label={`${badge} items`}
            >
              {typeof badge === 'number' && badge > 99 ? '99+' : badge}
            </span>
          )}
        </div>
        <span className="text-center leading-tight font-medium truncate max-w-full px-1">
          {label}
        </span>
      </button>
    );
  }
);

QuickAction.displayName = 'QuickAction';

/**
 * QuickActionGroup component for organizing multiple quick actions.
 */
export interface QuickActionGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional title for the action group */
  title?: string;
}

const QuickActionGroup = React.forwardRef<HTMLDivElement, QuickActionGroupProps>(
  ({ className, title, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('space-y-3', className)} {...props}>
        {title && (
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
            {title}
          </h3>
        )}
        <div className="flex flex-wrap gap-3">{children}</div>
      </div>
    );
  }
);

QuickActionGroup.displayName = 'QuickActionGroup';

export { QuickAction, QuickActionGroup, quickActionVariants };
