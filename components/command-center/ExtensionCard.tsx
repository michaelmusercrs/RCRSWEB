'use client';

/**
 * RCRS Command Center - Extension Card Component
 *
 * Displays a phone extension with status indicator, role badge,
 * and optional quick actions. Used in phone system pages.
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import * as React from 'react';
import { Phone, Voicemail, PhoneForwarded, PhoneOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Extension, ExtensionStatus } from '@/lib/phone-data';

// =============================================================================
// TYPES
// =============================================================================

export interface ExtensionCardProps {
  /** Extension data */
  extension: Extension;
  /** Whether to show the email address */
  showEmail?: boolean;
  /** Whether to show action buttons */
  showActions?: boolean;
  /** Callback when call button is clicked */
  onCall?: (extension: Extension) => void;
  /** Callback when card is clicked */
  onClick?: (extension: Extension) => void;
  /** Whether this card is selected */
  selected?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// STATUS CONFIG
// =============================================================================

const STATUS_CONFIG: Record<
  ExtensionStatus,
  { color: string; bgColor: string; label: string; pulseColor?: string }
> = {
  online: {
    color: 'bg-lime-500',
    bgColor: 'bg-lime-500/10',
    label: 'Available',
    pulseColor: 'bg-lime-400',
  },
  busy: {
    color: 'bg-yellow-500',
    bgColor: 'bg-yellow-500/10',
    label: 'On Call',
    pulseColor: 'bg-yellow-400',
  },
  ringing: {
    color: 'bg-blue-500',
    bgColor: 'bg-blue-500/10',
    label: 'Ringing',
    pulseColor: 'bg-blue-400',
  },
  dnd: {
    color: 'bg-red-500',
    bgColor: 'bg-red-500/10',
    label: 'Do Not Disturb',
  },
  offline: {
    color: 'bg-zinc-500',
    bgColor: 'bg-zinc-500/10',
    label: 'Offline',
  },
};

const ROLE_CONFIG: Record<string, { color: string; bgColor: string }> = {
  Owner: { color: 'text-amber-400', bgColor: 'bg-amber-500/20' },
  Admin: { color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
  Manager: { color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  User: { color: 'text-zinc-400', bgColor: 'bg-zinc-500/20' },
};

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * ExtensionCard - Display phone extension information
 */
export function ExtensionCard({
  extension,
  showEmail = false,
  showActions = false,
  onCall,
  onClick,
  selected = false,
  size = 'md',
  className,
}: ExtensionCardProps) {
  const statusConfig = STATUS_CONFIG[extension.status];
  const roleConfig = ROLE_CONFIG[extension.role] || ROLE_CONFIG.User;
  const isClickable = !!onClick;
  const showPulse = extension.status === 'online' || extension.status === 'ringing';

  // Size-based styling
  const sizeClasses = {
    sm: {
      container: 'p-3',
      extension: 'text-lg',
      name: 'text-sm',
      icon: 'h-4 w-4',
    },
    md: {
      container: 'p-4',
      extension: 'text-2xl',
      name: 'text-base',
      icon: 'h-5 w-5',
    },
    lg: {
      container: 'p-5',
      extension: 'text-3xl',
      name: 'text-lg',
      icon: 'h-6 w-6',
    },
  };

  const sizes = sizeClasses[size];

  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCall?.(extension);
  };

  const handleClick = () => {
    onClick?.(extension);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick?.(extension);
    }
  };

  return (
    <div
      className={cn(
        'relative rounded-xl border bg-zinc-900 transition-all duration-200',
        sizes.container,
        isClickable && 'cursor-pointer hover:border-zinc-600 hover:bg-zinc-800/70',
        selected
          ? 'border-lime-500/50 ring-1 ring-lime-500/20'
          : 'border-zinc-800',
        className
      )}
      onClick={isClickable ? handleClick : undefined}
      onKeyDown={handleKeyDown}
      tabIndex={isClickable ? 0 : undefined}
      role={isClickable ? 'button' : undefined}
      aria-selected={selected}
    >
      <div className="flex items-start gap-4">
        {/* Extension Number */}
        <div className="flex flex-col items-center">
          <span
            className={cn(
              'font-mono font-bold text-white',
              sizes.extension
            )}
          >
            {extension.extension}
          </span>
          {/* Status indicator */}
          <div className="mt-1 flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              {showPulse && statusConfig.pulseColor && (
                <span
                  className={cn(
                    'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
                    statusConfig.pulseColor
                  )}
                />
              )}
              <span
                className={cn(
                  'relative inline-flex h-2.5 w-2.5 rounded-full',
                  statusConfig.color
                )}
              />
            </span>
            <span className="text-xs text-zinc-500">{statusConfig.label}</span>
          </div>
        </div>

        {/* Extension Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3
              className={cn(
                'truncate font-semibold text-white',
                sizes.name
              )}
            >
              {extension.name}
            </h3>
            {/* Role Badge */}
            <span
              className={cn(
                'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                roleConfig.bgColor,
                roleConfig.color
              )}
            >
              {extension.role}
            </span>
          </div>

          {showEmail && (
            <p className="mt-0.5 truncate text-sm text-zinc-500">
              {extension.email}
            </p>
          )}

          {extension.department && (
            <p className="mt-1 text-xs text-zinc-600">
              {extension.department}
            </p>
          )}

          {/* Feature Indicators */}
          <div className="mt-2 flex items-center gap-2">
            {extension.voicemailEnabled && (
              <div
                className="flex items-center gap-1 text-zinc-500"
                title="Voicemail Enabled"
              >
                <Voicemail className="h-3.5 w-3.5" />
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {showActions && (
          <div className="flex shrink-0 flex-col gap-2">
            {extension.status !== 'offline' && extension.status !== 'dnd' ? (
              <button
                onClick={handleCall}
                className={cn(
                  'flex items-center justify-center rounded-lg p-2 transition-colors',
                  'bg-lime-500/10 text-lime-400 hover:bg-lime-500/20'
                )}
                title={`Call ${extension.name}`}
                aria-label={`Call ${extension.name} at extension ${extension.extension}`}
              >
                <Phone className={sizes.icon} />
              </button>
            ) : (
              <div
                className={cn(
                  'flex items-center justify-center rounded-lg p-2',
                  'bg-zinc-800 text-zinc-600'
                )}
                title="Unavailable"
              >
                <PhoneOff className={sizes.icon} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// COMPACT VARIANT
// =============================================================================

export interface ExtensionCardCompactProps {
  /** Extension data */
  extension: Extension;
  /** Ring delay (if part of ring group) */
  ringDelay?: number;
  /** Callback when clicked */
  onClick?: (extension: Extension) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ExtensionCardCompact - Smaller inline display of extension
 */
export function ExtensionCardCompact({
  extension,
  ringDelay,
  onClick,
  className,
}: ExtensionCardCompactProps) {
  const statusConfig = STATUS_CONFIG[extension.status];
  const isClickable = !!onClick;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2',
        isClickable && 'cursor-pointer transition-colors hover:border-zinc-700 hover:bg-zinc-800/50',
        className
      )}
      onClick={() => onClick?.(extension)}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      {/* Status Dot */}
      <span
        className={cn('h-2 w-2 shrink-0 rounded-full', statusConfig.color)}
        title={statusConfig.label}
      />

      {/* Extension Number */}
      <span className="font-mono text-sm font-semibold text-lime-400">
        {extension.extension}
      </span>

      {/* Name */}
      <span className="min-w-0 flex-1 truncate text-sm text-white">
        {extension.name}
      </span>

      {/* Ring Delay Badge */}
      {ringDelay !== undefined && (
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
            ringDelay === 0
              ? 'bg-lime-500/20 text-lime-400'
              : 'bg-zinc-700 text-zinc-400'
          )}
        >
          {ringDelay === 0 ? 'Immediate' : `+${ringDelay}s`}
        </span>
      )}
    </div>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

ExtensionCard.displayName = 'ExtensionCard';
ExtensionCardCompact.displayName = 'ExtensionCardCompact';
