'use client';

import * as React from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DateRangePeriod =
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'biannual'
  | 'year'
  | 'all'
  | 'custom';

export interface DateRangeFilterProps {
  /** Currently selected period */
  value: string;
  /** Callback when period changes; includes customRange when value is 'custom' */
  onChange: (period: string, customRange?: { start: string; end: string }) => void;
  /** Start/end dates for custom range (YYYY-MM-DD strings) */
  customRange?: { start: string; end: string };
  /** Smaller variant for embedding inside widget cards */
  compact?: boolean;
  /** Additional CSS classes on the root element */
  className?: string;
}

// ---------------------------------------------------------------------------
// Period definitions
// ---------------------------------------------------------------------------

interface PeriodOption {
  value: DateRangePeriod;
  label: string;
  shortLabel: string;
}

const PERIODS: PeriodOption[] = [
  { value: 'day', label: 'Today', shortLabel: 'Day' },
  { value: 'week', label: 'This Week', shortLabel: 'Week' },
  { value: 'month', label: 'This Month', shortLabel: 'Month' },
  { value: 'quarter', label: 'This Quarter', shortLabel: 'Qtr' },
  { value: 'biannual', label: 'This Half', shortLabel: 'Half' },
  { value: 'year', label: 'This Year', shortLabel: 'Year' },
  { value: 'all', label: 'All Time', shortLabel: 'All' },
  { value: 'custom', label: 'Custom', shortLabel: 'Custom' },
];

// ---------------------------------------------------------------------------
// Helper: compute concrete Date range for any period
// ---------------------------------------------------------------------------

/**
 * Returns `{ start: Date, end: Date }` for the given period string.
 *
 * - `day`      — today 00:00 to 23:59:59.999
 * - `week`     — Monday 00:00 of the current ISO week through Sunday 23:59
 * - `month`    — first of month through last day of month
 * - `quarter`  — first day of current calendar quarter through last day
 * - `biannual` — Jan 1 – Jun 30 (H1) or Jul 1 – Dec 31 (H2)
 * - `year`     — Jan 1 through Dec 31 of the current year
 * - `all`      — Jan 1 2000 through Dec 31 2099
 * - `custom`   — parses the supplied `customRange` strings
 */
export function getDateRangeForPeriod(
  period: string,
  customRange?: { start: string; end: string },
): { start: Date; end: Date } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based

  const startOfDay = (d: Date): Date => {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy;
  };

  const endOfDay = (d: Date): Date => {
    const copy = new Date(d);
    copy.setHours(23, 59, 59, 999);
    return copy;
  };

  switch (period) {
    case 'day': {
      return { start: startOfDay(now), end: endOfDay(now) };
    }

    case 'week': {
      // ISO week: Monday = 1
      const dayOfWeek = now.getDay(); // 0 = Sunday
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { start: startOfDay(monday), end: endOfDay(sunday) };
    }

    case 'month': {
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0); // day 0 of next month = last day of current
      return { start: startOfDay(firstDay), end: endOfDay(lastDay) };
    }

    case 'quarter': {
      const qStart = Math.floor(month / 3) * 3; // 0, 3, 6, or 9
      const firstDay = new Date(year, qStart, 1);
      const lastDay = new Date(year, qStart + 3, 0);
      return { start: startOfDay(firstDay), end: endOfDay(lastDay) };
    }

    case 'biannual': {
      if (month < 6) {
        // H1: Jan 1 – Jun 30
        return {
          start: startOfDay(new Date(year, 0, 1)),
          end: endOfDay(new Date(year, 5, 30)),
        };
      }
      // H2: Jul 1 – Dec 31
      return {
        start: startOfDay(new Date(year, 6, 1)),
        end: endOfDay(new Date(year, 11, 31)),
      };
    }

    case 'year': {
      return {
        start: startOfDay(new Date(year, 0, 1)),
        end: endOfDay(new Date(year, 11, 31)),
      };
    }

    case 'all': {
      return {
        start: new Date(2000, 0, 1, 0, 0, 0, 0),
        end: new Date(2099, 11, 31, 23, 59, 59, 999),
      };
    }

    case 'custom': {
      if (customRange?.start && customRange?.end) {
        // Parse YYYY-MM-DD as local date (avoid UTC offset issues)
        const [sy, sm, sd] = customRange.start.split('-').map(Number);
        const [ey, em, ed] = customRange.end.split('-').map(Number);
        return {
          start: startOfDay(new Date(sy, sm - 1, sd)),
          end: endOfDay(new Date(ey, em - 1, ed)),
        };
      }
      // Fallback: today if no custom range supplied
      return { start: startOfDay(now), end: endOfDay(now) };
    }

    default: {
      return { start: startOfDay(now), end: endOfDay(now) };
    }
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function DateRangeFilter({
  value,
  onChange,
  customRange,
  compact = false,
  className,
}: DateRangeFilterProps) {
  const [localStart, setLocalStart] = React.useState(customRange?.start ?? '');
  const [localEnd, setLocalEnd] = React.useState(customRange?.end ?? '');

  // Keep local custom inputs in sync with prop changes
  React.useEffect(() => {
    if (customRange?.start) setLocalStart(customRange.start);
    if (customRange?.end) setLocalEnd(customRange.end);
  }, [customRange?.start, customRange?.end]);

  // Fire onChange with validated custom range
  const commitCustomRange = React.useCallback(
    (start: string, end: string) => {
      if (start && end) {
        onChange('custom', { start, end });
      }
    },
    [onChange],
  );

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setLocalStart(next);
    commitCustomRange(next, localEnd);
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setLocalEnd(next);
    commitCustomRange(localStart, next);
  };

  // -------------------------------------------------------------------------
  // Mobile dropdown
  // -------------------------------------------------------------------------

  const mobileSelect = (
    <div className="md:hidden">
      <div className="relative">
        <select
          value={value}
          onChange={(e) => {
            const newPeriod = e.target.value;
            if (newPeriod === 'custom') {
              onChange('custom', localStart && localEnd ? { start: localStart, end: localEnd } : undefined);
            } else {
              onChange(newPeriod);
            }
          }}
          className={cn(
            'w-full appearance-none rounded-xl border border-white/10 bg-white/[0.04]',
            'pl-9 pr-9 text-sm text-white',
            'focus:border-brand-green/50 focus:outline-none focus:ring-1 focus:ring-brand-green/30',
            'transition-colors duration-150',
            compact ? 'py-1.5 text-xs' : 'py-2',
          )}
        >
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value} className="bg-zinc-900 text-white">
              {p.label}
            </option>
          ))}
        </select>
        <Calendar
          className={cn(
            'pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400',
            compact ? 'h-3.5 w-3.5' : 'h-4 w-4',
          )}
        />
        <ChevronDown
          className={cn(
            'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400',
            compact ? 'h-3.5 w-3.5' : 'h-4 w-4',
          )}
        />
      </div>
    </div>
  );

  // -------------------------------------------------------------------------
  // Desktop pill buttons
  // -------------------------------------------------------------------------

  const desktopPills = (
    <div className="hidden md:flex">
      <div
        className={cn(
          'inline-flex items-center gap-1 rounded-xl border border-white/5 bg-white/[0.02] p-1',
        )}
      >
        {PERIODS.map((p) => {
          const isActive = value === p.value;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => {
                if (p.value === 'custom') {
                  onChange('custom', localStart && localEnd ? { start: localStart, end: localEnd } : undefined);
                } else {
                  onChange(p.value);
                }
              }}
              className={cn(
                'rounded-lg font-medium transition-all duration-150',
                compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
                isActive
                  ? 'bg-brand-green/15 text-brand-green shadow-sm shadow-brand-green/10'
                  : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200',
              )}
            >
              {compact ? p.shortLabel : p.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  // -------------------------------------------------------------------------
  // Custom date pickers (shown when value === 'custom')
  // -------------------------------------------------------------------------

  const customPickers = value === 'custom' && (
    <div
      className={cn(
        'flex flex-col gap-2 sm:flex-row sm:items-center',
        compact ? 'mt-2' : 'mt-3',
      )}
    >
      <div className="flex items-center gap-2">
        <label
          htmlFor="dr-start"
          className={cn('shrink-0 font-medium text-zinc-400', compact ? 'text-xs' : 'text-sm')}
        >
          From
        </label>
        <input
          id="dr-start"
          type="date"
          value={localStart}
          onChange={handleStartChange}
          className={cn(
            'rounded-lg border border-white/10 bg-white/[0.04] text-white',
            'focus:border-brand-green/50 focus:outline-none focus:ring-1 focus:ring-brand-green/30',
            'transition-colors duration-150',
            compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm',
          )}
        />
      </div>
      <div className="flex items-center gap-2">
        <label
          htmlFor="dr-end"
          className={cn('shrink-0 font-medium text-zinc-400', compact ? 'text-xs' : 'text-sm')}
        >
          To
        </label>
        <input
          id="dr-end"
          type="date"
          value={localEnd}
          min={localStart || undefined}
          onChange={handleEndChange}
          className={cn(
            'rounded-lg border border-white/10 bg-white/[0.04] text-white',
            'focus:border-brand-green/50 focus:outline-none focus:ring-1 focus:ring-brand-green/30',
            'transition-colors duration-150',
            compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm',
          )}
        />
      </div>
      {localStart && localEnd && localStart > localEnd && (
        <p className="text-xs text-red-400">Start date must be before end date</p>
      )}
    </div>
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className={cn('w-full', className)}>
      {mobileSelect}
      {desktopPills}
      {customPickers}
    </div>
  );
}

export default DateRangeFilter;
export type { DateRangeFilterProps as DateRangeFilterPropsType };
