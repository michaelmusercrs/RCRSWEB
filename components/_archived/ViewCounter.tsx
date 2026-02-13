'use client';

/**
 * View Counter Badge
 * Displays view count with animated number
 */

import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';

export interface ViewCounterProps {
  count: number;
  label?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'compact' | 'detailed';
  animated?: boolean;
}

export default function ViewCounter({
  count,
  label = 'views',
  showIcon = true,
  size = 'md',
  variant = 'default',
  animated = true,
}: ViewCounterProps) {
  const [displayCount, setDisplayCount] = useState(0);

  // Animate count up
  useEffect(() => {
    if (!animated) {
      setDisplayCount(count);
      return;
    }

    let start = 0;
    const end = count;
    const duration = 1000; // 1 second
    const increment = end / (duration / 16); // 60fps

    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setDisplayCount(end);
        clearInterval(timer);
      } else {
        setDisplayCount(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [count, animated]);

  // Size styles
  const sizes = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  // Format number with commas
  const formattedCount = displayCount.toLocaleString();

  if (variant === 'compact') {
    return (
      <div
        className={`inline-flex items-center gap-1 ${sizes[size]} bg-neutral-900 text-brand-green rounded-full font-bold border border-brand-green/20`}
      >
        {showIcon && <Eye className={iconSizes[size]} />}
        <span>{formattedCount}</span>
      </div>
    );
  }

  if (variant === 'detailed') {
    return (
      <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-neutral-900 to-neutral-950 rounded-lg border border-neutral-800 hover:border-brand-green/30 transition-all duration-300 hover-lift">
        <div className="p-3 bg-brand-green/10 rounded-full">
          <Eye className="h-6 w-6 text-brand-green" />
        </div>
        <div>
          <p className="text-2xl font-black text-white">{formattedCount}</p>
          <p className="text-xs text-neutral-400 uppercase tracking-wider">{label}</p>
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <div
      className={`inline-flex items-center gap-2 ${sizes[size]} bg-neutral-900 text-neutral-300 rounded-full border border-neutral-800 hover:border-brand-green/50 hover:text-brand-green transition-all duration-300`}
    >
      {showIcon && <Eye className={iconSizes[size]} />}
      <span className="font-bold">{formattedCount}</span>
      <span className="text-neutral-500">{label}</span>
    </div>
  );
}

/**
 * Profile View Counter
 * Shows views with this week/month breakdown
 */
export function ProfileViewCounter({
  totalViews,
  viewsThisWeek,
  viewsThisMonth,
}: {
  totalViews: number;
  viewsThisWeek: number;
  viewsThisMonth: number;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <ViewCounter
        count={totalViews}
        label="total views"
        variant="compact"
        size="md"
      />
      <ViewCounter
        count={viewsThisWeek}
        label="this week"
        variant="compact"
        size="sm"
      />
      <ViewCounter
        count={viewsThisMonth}
        label="this month"
        variant="compact"
        size="sm"
      />
    </div>
  );
}
