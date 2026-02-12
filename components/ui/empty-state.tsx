'use client';

import * as React from 'react';
import Link from 'next/link';
import { LucideIcon, Package, Search, AlertCircle, FileX, Inbox, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Title text */
  title: string;
  /** Description text */
  description?: string;
  /** Lucide icon to display */
  icon?: LucideIcon;
  /** Action button config */
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  /** Secondary action */
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * EmptyState component for displaying when no data is available.
 * Provides helpful guidance and actions to users.
 */
function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  secondaryAction,
  size = 'md',
  className,
  ...props
}: EmptyStateProps) {
  const sizeClasses = {
    sm: {
      container: 'py-6',
      icon: 'h-10 w-10',
      iconWrapper: 'h-16 w-16',
      title: 'text-base',
      description: 'text-sm',
      button: 'px-4 py-2 text-sm',
    },
    md: {
      container: 'py-10',
      icon: 'h-12 w-12',
      iconWrapper: 'h-20 w-20',
      title: 'text-lg',
      description: 'text-sm',
      button: 'px-5 py-2.5 text-sm',
    },
    lg: {
      container: 'py-16',
      icon: 'h-16 w-16',
      iconWrapper: 'h-24 w-24',
      title: 'text-xl',
      description: 'text-base',
      button: 'px-6 py-3 text-base',
    },
  };

  const sizes = sizeClasses[size];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        sizes.container,
        className
      )}
      {...props}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-2xl bg-zinc-800/50 mb-4',
          sizes.iconWrapper
        )}
      >
        <Icon className={cn('text-zinc-500', sizes.icon)} />
      </div>

      <h3 className={cn('font-semibold text-white mb-1', sizes.title)}>
        {title}
      </h3>

      {description && (
        <p className={cn('text-zinc-400 max-w-sm mb-4', sizes.description)}>
          {description}
        </p>
      )}

      {(action || secondaryAction) && (
        <div className="flex items-center gap-3 mt-2">
          {action && action.href && (
            <Link
              href={action.href}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg bg-lime-500 text-zinc-900 font-medium hover:bg-lime-400 transition-colors',
                sizes.button
              )}
            >
              <Plus className="h-4 w-4" />
              {action.label}
            </Link>
          )}
          {action && !action.href && (
            <button
              type="button"
              onClick={action.onClick}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg bg-lime-500 text-zinc-900 font-medium hover:bg-lime-400 transition-colors',
                sizes.button
              )}
            >
              <Plus className="h-4 w-4" />
              {action.label}
            </button>
          )}
          {secondaryAction && secondaryAction.href && (
            <Link
              href={secondaryAction.href}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 font-medium hover:bg-zinc-700 hover:text-white transition-colors',
                sizes.button
              )}
            >
              {secondaryAction.label}
            </Link>
          )}
          {secondaryAction && !secondaryAction.href && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 font-medium hover:bg-zinc-700 hover:text-white transition-colors',
                sizes.button
              )}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Pre-configured empty states for common scenarios
 */

function NoResults({
  searchTerm,
  onClear,
  ...props
}: Omit<EmptyStateProps, 'title' | 'icon'> & { searchTerm?: string; onClear?: () => void }) {
  return (
    <EmptyState
      icon={Search}
      title="No results found"
      description={
        searchTerm
          ? `No items match "${searchTerm}". Try adjusting your search or filters.`
          : 'No items match your current filters. Try adjusting your criteria.'
      }
      secondaryAction={onClear ? { label: 'Clear filters', onClick: onClear } : undefined}
      {...props}
    />
  );
}

function NoData({
  entityName = 'items',
  ...props
}: Omit<EmptyStateProps, 'title' | 'icon'> & { entityName?: string }) {
  return (
    <EmptyState
      icon={Package}
      title={`No ${entityName} yet`}
      description={`Get started by creating your first ${entityName.replace(/s$/, '')}.`}
      {...props}
    />
  );
}

function ErrorState({
  error,
  onRetry,
  ...props
}: Omit<EmptyStateProps, 'title' | 'icon'> & { error?: string; onRetry?: () => void }) {
  return (
    <EmptyState
      icon={AlertCircle}
      title="Something went wrong"
      description={error || 'An error occurred while loading data. Please try again.'}
      action={onRetry ? { label: 'Try again', onClick: onRetry } : undefined}
      {...props}
    />
  );
}

function NotFound({ ...props }: Omit<EmptyStateProps, 'title' | 'icon'>) {
  return (
    <EmptyState
      icon={FileX}
      title="Page not found"
      description="The page you're looking for doesn't exist or has been moved."
      action={{ label: 'Go back home', href: '/' }}
      {...props}
    />
  );
}

export { EmptyState, NoResults, NoData, ErrorState, NotFound };
