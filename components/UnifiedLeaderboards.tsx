/**
 * UnifiedLeaderboards
 * ----------------------------------------------------------------------------
 * Server-component-friendly rendering widget that displays all THREE separate
 * RCRS leaderboards side-by-side:
 *
 *   1. Commission Board (gold)  — QB 1099 cash paid YTD (data/commissions.json)
 *   2. Sales Board (blue)       — Monday meeting accrual ($$$$$ column)
 *   3. Weekly Board (green)     — rep self-report (doors, appts, signed)
 *
 * HARD RULE (from project_rcrs_leaderboards memory):
 *   These boards have DIFFERENT SOURCES and DIFFERENT NUMBERS. They MUST
 *   never be combined into a single total. The colored top-borders and the
 *   "Different sources — never combined" subtext make the rule visible.
 *
 * Data flow: this widget does NOT fetch. The caller pre-fetches via
 * `lib/leaderboard-data.ts#fetchUnifiedLeaderboards` (or an API route that
 * wraps it) and passes the data in as props. Pure rendering.
 *
 * The widget itself uses no hooks, so it's safe to render inside either a
 * server component or a client component (parent decides).
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Trophy,
  TrendingUp,
  Activity,
  Crown,
  Medal,
  Award,
  ChevronRight,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// PUBLIC TYPES
// =============================================================================

export interface LeaderRow {
  rank: number;
  name: string;
  /** Raw numeric value (currency in cents or count) */
  value: number;
  /** Optional pre-formatted display string. Wins over `value` for the label. */
  valueFormatted?: string;
  /** 0..1 share of leader's value, used for the bar */
  pctOfLeader?: number;
  /** Secondary label, e.g. "12 signed" */
  subtitle?: string;
  /** Optional avatar image */
  avatarUrl?: string;
}

export interface CommissionBoard {
  period: string;
  year?: string;
  leaders: LeaderRow[];
  viewAllHref?: string;
}

export interface SalesBoard {
  period: string;
  year?: string;
  leaders: LeaderRow[];
  viewAllHref?: string;
}

export interface WeeklyBoard {
  period: string;
  weekOf?: string;
  leaders: LeaderRow[];
  viewAllHref?: string;
}

export interface UnifiedLeaderboardsProps {
  commission?: CommissionBoard;
  sales?: SalesBoard;
  weekly?: WeeklyBoard;
  /** Default true. Shows "QB 1099 cash paid YTD" etc. source subtitle */
  showSource?: boolean;
  /** Default false. Tighter padding, hide subtitles, top-3 only */
  compact?: boolean;
}

// =============================================================================
// INTERNAL TYPES
// =============================================================================

type BoardKind = 'commission' | 'sales' | 'weekly';

interface BoardConfig {
  kind: BoardKind;
  title: string;
  /** Tailwind border + text classes used for the colored top-stripe + icon */
  borderClass: string;
  accentTextClass: string;
  iconBg: string;
  /** Hex value used for the inline-styled progress bar (Tailwind can't see arbitrary runtime values) */
  accentHex: string;
  /** When showSource=true, the source-label that appears under the title */
  sourceLabel: string;
  icon: React.ElementType;
  /** Whether the `value` is currency. Affects formatting fallback. */
  isCurrency: boolean;
}

// =============================================================================
// CONFIG — colors map to the three-leaderboards rule (memory)
// =============================================================================

const BOARDS: Record<BoardKind, BoardConfig> = {
  commission: {
    kind: 'commission',
    title: 'Commission',
    borderClass: 'border-t-[3px] border-t-[#fbbf24]', // gold
    accentTextClass: 'text-[#fbbf24]',
    iconBg: 'bg-[#fbbf24]/15',
    accentHex: '#fbbf24',
    sourceLabel: 'QB 1099 cash paid YTD',
    icon: Trophy,
    isCurrency: true,
  },
  sales: {
    kind: 'sales',
    title: 'Sales',
    borderClass: 'border-t-[3px] border-t-[#0066CC]', // brand-blue
    accentTextClass: 'text-[#3b9bff]',
    iconBg: 'bg-[#0066CC]/15',
    accentHex: '#3b9bff',
    sourceLabel: 'Monday meeting $$$$$ accrual',
    icon: TrendingUp,
    isCurrency: true,
  },
  weekly: {
    kind: 'weekly',
    title: 'Weekly',
    borderClass: 'border-t-[3px] border-t-[#39FF14]', // brand-green
    accentTextClass: 'text-[#39FF14]',
    iconBg: 'bg-[#39FF14]/15',
    accentHex: '#39FF14',
    sourceLabel: 'Rep self-report (doors / appts / signed)',
    icon: Activity,
    isCurrency: false,
  },
};

// =============================================================================
// FORMATTERS
// =============================================================================

const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const intFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

function formatValue(row: LeaderRow, isCurrency: boolean): string {
  if (row.valueFormatted) return row.valueFormatted;
  if (isCurrency) {
    // Compact for >= 10K so the cards don't blow out
    if (row.value >= 100000) return `$${(row.value / 1000).toFixed(0)}K`;
    if (row.value >= 10000) return `$${(row.value / 1000).toFixed(1)}K`;
    return currencyFmt.format(row.value);
  }
  return intFmt.format(row.value);
}

// =============================================================================
// RANK BADGE
// =============================================================================

function RankBadge({ rank }: { rank: number }) {
  // Podium ring: gold/silver/bronze for ranks 1/2/3
  const ringColor =
    rank === 1
      ? 'ring-2 ring-yellow-400 bg-yellow-400/15 text-yellow-300'
      : rank === 2
      ? 'ring-2 ring-zinc-300 bg-zinc-300/10 text-zinc-200'
      : rank === 3
      ? 'ring-2 ring-orange-500 bg-orange-500/15 text-orange-300'
      : 'bg-zinc-800 text-zinc-400';

  const Icon =
    rank === 1 ? Crown : rank === 2 ? Medal : rank === 3 ? Award : null;

  return (
    <div
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
        ringColor,
      )}
      aria-label={`Rank ${rank}`}
    >
      {Icon ? <Icon size={14} /> : <span>#{rank}</span>}
    </div>
  );
}

// =============================================================================
// SINGLE-BOARD CARD
// =============================================================================

interface BoardCardProps {
  config: BoardConfig;
  leaders: LeaderRow[];
  /** Period label e.g. "YTD 2026" or "Week of May 19" */
  period: string;
  viewAllHref?: string;
  showSource: boolean;
  compact: boolean;
}

function BoardCard({
  config,
  leaders,
  period,
  viewAllHref,
  showSource,
  compact,
}: BoardCardProps) {
  const Icon = config.icon;
  const topN = compact ? 3 : 5;
  const visible = leaders.slice(0, topN);

  return (
    <section
      aria-label={`${config.title} leaderboard`}
      className={cn(
        'rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden flex flex-col',
        config.borderClass,
      )}
    >
      {/* Header */}
      <header className={cn('px-4', compact ? 'py-3' : 'py-4', 'border-b border-zinc-800')}>
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
              config.iconBg,
            )}
          >
            <Icon size={18} className={config.accentTextClass} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-white leading-tight">
              {config.title} Leaderboard
            </h3>
            {showSource && !compact && (
              <p className="text-xs text-zinc-500 mt-0.5 truncate">
                {config.sourceLabel}
              </p>
            )}
          </div>
        </div>
        <p className={cn('text-xs text-zinc-500 mt-2', compact && 'mt-1')}>
          {period}
        </p>
      </header>

      {/* Rows */}
      <div className={cn('flex-1', compact ? 'p-3' : 'p-4')}>
        {visible.length === 0 ? (
          <EmptyState />
        ) : (
          <ol className="space-y-2">
            {visible.map((row) => (
              <LeaderRowItem
                key={`${row.rank}-${row.name}`}
                row={row}
                isCurrency={config.isCurrency}
                accentClass={config.accentTextClass}
                accentHex={config.accentHex}
                compact={compact}
              />
            ))}
          </ol>
        )}
      </div>

      {/* Footer */}
      {viewAllHref && visible.length > 0 && (
        <footer className="border-t border-zinc-800 px-4 py-2.5">
          <Link
            href={viewAllHref}
            className={cn(
              'inline-flex items-center gap-1 text-xs font-medium hover:underline',
              config.accentTextClass,
            )}
          >
            View full {config.title.toLowerCase()} board
            <ChevronRight size={14} />
          </Link>
        </footer>
      )}
    </section>
  );
}

// =============================================================================
// LEADER ROW
// =============================================================================

interface LeaderRowItemProps {
  row: LeaderRow;
  isCurrency: boolean;
  accentClass: string;
  accentHex: string;
  compact: boolean;
}

function LeaderRowItem({
  row,
  isCurrency,
  accentClass,
  accentHex,
  compact,
}: LeaderRowItemProps) {
  const pct = Math.max(0, Math.min(1, row.pctOfLeader ?? 0));
  const pctPercent = Math.round(pct * 100);

  return (
    <li className="flex items-center gap-2.5">
      <RankBadge rank={row.rank} />

      {/* Avatar */}
      <div className="h-8 w-8 shrink-0 rounded-full bg-zinc-800 overflow-hidden flex items-center justify-center">
        {row.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.avatarUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <User size={14} className="text-zinc-500" />
        )}
      </div>

      {/* Name + bar */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium text-white truncate">
            {row.name}
          </span>
          <span className={cn('text-sm font-semibold whitespace-nowrap', accentClass)}>
            {formatValue(row, isCurrency)}
          </span>
        </div>
        {/* Progress bar — pct-of-leader. Arbitrary hex via inline style so
            Tailwind's JIT doesn't need to know about it at build time. */}
        <div className="mt-1 h-1 w-full rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pctPercent}%`,
              backgroundColor: accentHex,
            }}
          />
        </div>
        {!compact && row.subtitle && (
          <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{row.subtitle}</p>
        )}
      </div>
    </li>
  );
}

// =============================================================================
// EMPTY STATE — never fabricate; just say "no data yet"
// =============================================================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="h-10 w-10 rounded-full bg-zinc-800/60 flex items-center justify-center mb-2">
        <Trophy size={18} className="text-zinc-600" />
      </div>
      <p className="text-sm text-zinc-400 font-medium">No data yet</p>
      <p className="text-xs text-zinc-600 mt-0.5">
        Numbers will appear once the source has entries.
      </p>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function UnifiedLeaderboards({
  commission,
  sales,
  weekly,
  showSource = true,
  compact = false,
}: UnifiedLeaderboardsProps) {
  return (
    <div className="space-y-3">
      {/* Helper text — explicit "never combined" rule */}
      {showSource && (
        <p className="text-[11px] text-zinc-500 uppercase tracking-wider">
          Three boards · Different sources · Never combined
        </p>
      )}

      {/* 3-up grid on lg+, stack below */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <BoardCard
          config={BOARDS.commission}
          leaders={commission?.leaders ?? []}
          period={
            commission?.period ??
            (commission?.year ? `YTD ${commission.year}` : 'YTD')
          }
          viewAllHref={commission?.viewAllHref}
          showSource={showSource}
          compact={compact}
        />
        <BoardCard
          config={BOARDS.sales}
          leaders={sales?.leaders ?? []}
          period={
            sales?.period ??
            (sales?.year ? `YTD ${sales.year}` : 'YTD')
          }
          viewAllHref={sales?.viewAllHref}
          showSource={showSource}
          compact={compact}
        />
        <BoardCard
          config={BOARDS.weekly}
          leaders={weekly?.leaders ?? []}
          period={
            weekly?.period ??
            (weekly?.weekOf ? `Week of ${weekly.weekOf}` : 'This week')
          }
          viewAllHref={weekly?.viewAllHref}
          showSource={showSource}
          compact={compact}
        />
      </div>
    </div>
  );
}
