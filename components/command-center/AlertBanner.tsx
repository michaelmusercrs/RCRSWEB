'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import {
  Info,
  CheckCircle,
  AlertTriangle,
  XCircle,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const alertBannerVariants = cva(
  'relative w-full rounded-lg border px-4 py-3 flex items-start gap-3 transition-all duration-200',
  {
    variants: {
      type: {
        info: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
        success: 'bg-green-500/10 border-green-500/30 text-green-300',
        warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
        error: 'bg-red-500/10 border-red-500/30 text-red-300',
      },
    },
    defaultVariants: {
      type: 'info',
    },
  }
);

const iconMap = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
};

const iconColorMap = {
  info: 'text-blue-400',
  success: 'text-green-400',
  warning: 'text-yellow-400',
  error: 'text-red-400',
};

export interface AlertBannerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertBannerVariants> {
  /** Type of alert */
  type?: 'info' | 'success' | 'warning' | 'error';
  /** Alert title */
  title?: string;
  /** Alert message/description */
  message: string;
  /** Whether the alert can be dismissed */
  dismissible?: boolean;
  /** Callback when alert is dismissed */
  onDismiss?: () => void;
  /** Optional custom icon */
  icon?: React.ReactNode;
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * AlertBanner component for displaying full-width alerts and notifications.
 * Supports info, success, warning, and error states with optional dismiss functionality.
 *
 * @example
 * <AlertBanner type="success" title="Success!" message="Your changes have been saved." />
 * <AlertBanner type="error" message="Something went wrong." dismissible onDismiss={() => {}} />
 * <AlertBanner
 *   type="warning"
 *   title="Warning"
 *   message="Your session is about to expire."
 *   action={{ label: 'Extend', onClick: extendSession }}
 * />
 */
const AlertBanner = React.forwardRef<HTMLDivElement, AlertBannerProps>(
  (
    {
      className,
      type = 'info',
      title,
      message,
      dismissible = false,
      onDismiss,
      icon,
      action,
      ...props
    },
    ref
  ) => {
    const [isVisible, setIsVisible] = React.useState(true);

    const handleDismiss = () => {
      setIsVisible(false);
      onDismiss?.();
    };

    if (!isVisible) return null;

    const IconComponent = iconMap[type];

    return (
      <div
        ref={ref}
        role="alert"
        aria-live={type === 'error' ? 'assertive' : 'polite'}
        className={cn(alertBannerVariants({ type }), className)}
        {...props}
      >
        {/* Icon */}
        <div className={cn('flex-shrink-0 mt-0.5', iconColorMap[type])}>
          {icon || <IconComponent className="h-5 w-5" aria-hidden="true" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {title && (
            <h3 className="text-sm font-semibold mb-0.5">{title}</h3>
          )}
          <p className="text-sm opacity-90">{message}</p>
          {action && (
            <button
              onClick={action.onClick}
              className={cn(
                'mt-2 text-sm font-medium underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-offset-2 rounded',
                type === 'info' && 'text-blue-400 focus:ring-blue-400',
                type === 'success' && 'text-green-400 focus:ring-green-400',
                type === 'warning' && 'text-yellow-400 focus:ring-yellow-400',
                type === 'error' && 'text-red-400 focus:ring-red-400'
              )}
            >
              {action.label}
            </button>
          )}
        </div>

        {/* Dismiss button */}
        {dismissible && (
          <button
            onClick={handleDismiss}
            className={cn(
              'flex-shrink-0 rounded-full p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent',
              type === 'info' && 'hover:bg-blue-500/20 focus:ring-blue-400',
              type === 'success' && 'hover:bg-green-500/20 focus:ring-green-400',
              type === 'warning' && 'hover:bg-yellow-500/20 focus:ring-yellow-400',
              type === 'error' && 'hover:bg-red-500/20 focus:ring-red-400'
            )}
            aria-label="Dismiss alert"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }
);

AlertBanner.displayName = 'AlertBanner';

export { AlertBanner, alertBannerVariants };
