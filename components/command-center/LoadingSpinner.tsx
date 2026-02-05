'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const spinnerVariants = cva(
  'animate-spin rounded-full border-2 border-current border-t-transparent',
  {
    variants: {
      size: {
        sm: 'h-4 w-4',
        md: 'h-6 w-6',
        lg: 'h-8 w-8',
        xl: 'h-12 w-12',
      },
      spinnerColor: {
        default: 'text-brand-green',
        white: 'text-white',
        gray: 'text-gray-400',
        primary: 'text-primary',
      },
    },
    defaultVariants: {
      size: 'md',
      spinnerColor: 'default',
    },
  }
);

type SpinnerVariantProps = VariantProps<typeof spinnerVariants>;

export interface LoadingSpinnerProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'color'>,
    SpinnerVariantProps {
  /** Accessible label for screen readers */
  label?: string;
  /** Whether to center the spinner in its container */
  centered?: boolean;
}

/**
 * LoadingSpinner component for indicating loading states.
 * Uses brand green color by default with smooth CSS animation.
 *
 * @example
 * <LoadingSpinner />
 * <LoadingSpinner size="lg" />
 * <LoadingSpinner size="sm" color="white" label="Loading data..." />
 * <LoadingSpinner centered />
 */
const LoadingSpinner = React.forwardRef<HTMLDivElement, LoadingSpinnerProps>(
  ({ className, size, spinnerColor, label = 'Loading', centered = false, ...props }, ref) => {
    const spinner = (
      <div
        ref={ref}
        role="status"
        aria-label={label}
        className={cn(
          spinnerVariants({ size, spinnerColor }),
          className
        )}
        {...props}
      >
        <span className="sr-only">{label}</span>
      </div>
    );

    if (centered) {
      return (
        <div className="flex items-center justify-center w-full h-full min-h-[100px]">
          {spinner}
        </div>
      );
    }

    return spinner;
  }
);

LoadingSpinner.displayName = 'LoadingSpinner';

/**
 * LoadingOverlay component for full-page or container loading states.
 * Renders a semi-transparent overlay with centered spinner.
 */
export interface LoadingOverlayProps extends LoadingSpinnerProps {
  /** Whether overlay is visible */
  show?: boolean;
  /** Optional loading text to display */
  text?: string;
  /** Whether to use fixed positioning (full page) or absolute (container) */
  fullPage?: boolean;
}

const LoadingOverlay = React.forwardRef<HTMLDivElement, LoadingOverlayProps>(
  ({ show = true, text, fullPage = false, size = 'lg', ...spinnerProps }, ref) => {
    if (!show) return null;

    return (
      <div
        ref={ref}
        className={cn(
          'inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm',
          fullPage ? 'fixed' : 'absolute'
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Loading"
      >
        <LoadingSpinner size={size} {...spinnerProps} />
        {text && (
          <p className="mt-4 text-sm font-medium text-gray-300">{text}</p>
        )}
      </div>
    );
  }
);

LoadingOverlay.displayName = 'LoadingOverlay';

export { LoadingSpinner, LoadingOverlay, spinnerVariants };
