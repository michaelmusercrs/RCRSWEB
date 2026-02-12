'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Page title */
  title: string;
  /** Optional subtitle/description */
  description?: string;
  /** Optional icon */
  icon?: LucideIcon;
  /** Icon color class */
  iconColor?: string;
  /** Back button config */
  backHref?: string;
  /** Breadcrumb items */
  breadcrumbs?: BreadcrumbItem[];
  /** Action buttons (rendered on the right) */
  actions?: React.ReactNode;
  /** Compact mode with less padding */
  compact?: boolean;
}

/**
 * PageHeader component for consistent page titles and navigation.
 * Includes support for breadcrumbs, back button, and action buttons.
 */
function PageHeader({
  title,
  description,
  icon: Icon,
  iconColor = 'text-lime-400',
  backHref,
  breadcrumbs,
  actions,
  compact = false,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between',
        compact ? 'mb-4' : 'mb-6',
        className
      )}
      {...props}
    >
      <div className="space-y-1">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-2 text-sm text-zinc-400 mb-2">
            {breadcrumbs.map((item, index) => (
              <React.Fragment key={index}>
                {index > 0 && <span className="text-zinc-600">/</span>}
                {item.href ? (
                  <Link
                    href={item.href}
                    className="hover:text-white transition-colors"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-zinc-300">{item.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}

        {/* Title Row */}
        <div className="flex items-center gap-3">
          {backHref && (
            <Link
              href={backHref}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
          )}

          {Icon && (
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800', iconColor.replace('text-', 'text-').includes('/') ? '' : iconColor.replace('text-', 'bg-') + '/20')}>
              <Icon className={cn('h-5 w-5', iconColor)} />
            </div>
          )}

          <div>
            <h1 className={cn('font-bold text-white', compact ? 'text-xl' : 'text-2xl')}>
              {title}
            </h1>
            {description && (
              <p className="text-sm text-zinc-400 mt-0.5">{description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      {actions && (
        <div className="flex items-center gap-3 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

export { PageHeader };
export type { PageHeaderProps, BreadcrumbItem };
