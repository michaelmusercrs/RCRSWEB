'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Crown,
  Medal,
  Award,
  Trophy,
  RefreshCw,
  BarChart3,
  TrendingUp,
  Users,
  DollarSign,
  ClipboardCheck,
  PenTool,
  Hammer,
  Droplets,
  UserPlus,
  Handshake,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

// =============================================================================
// Types
// =============================================================================

interface SalesDashboardLeaderboardProps {
  currentUserEmail?: string;
  currentUserName?: string;
}

interface LeaderboardEntry {
  rank: number;
  repName: string;
  metricValue: number;
  allMetrics: Record<string, number>;
  weeksReported: number;
  weeklyBreakdown: { meetingDate: string; value: number }[];
}

interface LeaderboardResponse {
  success: boolean;
  metric: string;
  metricLabel: string;
  period: string;
  dateRange: { start: string | null; end: string | null };
  leaderboard: LeaderboardEntry[];
  totalReps: number;
  visibilityNote?: string;
  error?: string;
}

// =============================================================================
// Constants
// =============================================================================

type MetricKey = 'revenue' | 'inspected' | 'signed' | 'damage' | 'repair' | 'gutter' | 'referrals' | 'agents';

interface MetricConfig {
  key: MetricKey;
  label: string;
  icon: React.ReactNode;
  format: (val: number) => string;
}

const METRICS: MetricConfig[] = [
  {
    key: 'revenue',
    label: 'Est. Revenue ($$$$$)',
    icon: <DollarSign className="h-3.5 w-3.5" />,
    format: (val: number) => {
      if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
      if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
      return `$${val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    },
  },
  {
    key: 'inspected',
    label: 'Inspected',
    icon: <ClipboardCheck className="h-3.5 w-3.5" />,
    format: (val: number) => val.toLocaleString('en-US'),
  },
  {
    key: 'signed',
    label: 'Signed',
    icon: <PenTool className="h-3.5 w-3.5" />,
    format: (val: number) => val.toLocaleString('en-US'),
  },
  {
    key: 'damage',
    label: 'Damage',
    icon: <Hammer className="h-3.5 w-3.5" />,
    format: (val: number) => val.toLocaleString('en-US'),
  },
  {
    key: 'repair',
    label: 'Repair',
    icon: <Hammer className="h-3.5 w-3.5" />,
    format: (val: number) => val.toLocaleString('en-US'),
  },
  {
    key: 'gutter',
    label: 'Gutter',
    icon: <Droplets className="h-3.5 w-3.5" />,
    format: (val: number) => val.toLocaleString('en-US'),
  },
  {
    key: 'referrals',
    label: 'Referrals',
    icon: <UserPlus className="h-3.5 w-3.5" />,
    format: (val: number) => val.toLocaleString('en-US'),
  },
  {
    key: 'agents',
    label: 'Agents',
    icon: <Handshake className="h-3.5 w-3.5" />,
    format: (val: number) => val.toLocaleString('en-US'),
  },
];

type PeriodKey = 'thisWeek' | 'lastWeek' | 'thisMonth' | 'thisQuarter' | 'thisYear' | 'allTime';

interface PeriodConfig {
  key: PeriodKey;
  label: string;
}

const PERIODS: PeriodConfig[] = [
  { key: 'thisWeek', label: 'This Week' },
  { key: 'lastWeek', label: 'Last Week' },
  { key: 'thisMonth', label: 'This Month' },
  { key: 'thisQuarter', label: 'This Quarter' },
  { key: 'thisYear', label: 'This Year' },
  { key: 'allTime', label: 'All Time' },
];

const PODIUM_COLORS = {
  1: {
    bg: 'bg-gradient-to-b from-yellow-500/30 to-yellow-600/10',
    border: 'border-yellow-500/40',
    circle: 'bg-gradient-to-br from-yellow-400 to-amber-600',
    text: 'text-yellow-400',
    label: 'text-yellow-500/80',
  },
  2: {
    bg: 'bg-gradient-to-b from-gray-400/20 to-gray-500/10',
    border: 'border-gray-400/30',
    circle: 'bg-gradient-to-br from-gray-300 to-gray-500',
    text: 'text-gray-300',
    label: 'text-gray-400/80',
  },
  3: {
    bg: 'bg-gradient-to-b from-orange-500/20 to-orange-600/10',
    border: 'border-orange-500/30',
    circle: 'bg-gradient-to-br from-orange-400 to-amber-700',
    text: 'text-orange-400',
    label: 'text-orange-500/80',
  },
};

// =============================================================================
// Helpers
// =============================================================================

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Determine the effective period. "This Week" resets Monday at 11 AM,
 * so if it is Monday before 11 AM, we should show "Last Week" instead.
 */
function getEffectivePeriod(period: PeriodKey): PeriodKey {
  if (period !== 'thisWeek') return period;
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const hour = now.getHours();
  if (day === 1 && hour < 11) {
    return 'lastWeek';
  }
  return 'thisWeek';
}

function formatRevenue(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function timeAgo(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

// =============================================================================
// Sub-Components
// =============================================================================

/** Horizontal scrollable pill selector for metrics */
function MetricSelector({
  selected,
  onChange,
}: {
  selected: MetricKey;
  onChange: (m: MetricKey) => void;
}) {
  return (
    <div
      className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {METRICS.map(({ key, label, icon }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full transition-all whitespace-nowrap flex-shrink-0',
            selected === key
              ? 'bg-[#39FF14] text-black shadow-[0_0_12px_rgba(57,255,20,0.3)]'
              : 'bg-zinc-800 text-neutral-400 hover:text-white hover:bg-zinc-700'
          )}
        >
          {icon}
          {label}
        </button>
      ))}
    </div>
  );
}

/** Period selector as a second row of smaller pills */
function PeriodSelector({
  selected,
  onChange,
}: {
  selected: PeriodKey;
  onChange: (p: PeriodKey) => void;
}) {
  return (
    <div className="flex gap-1 bg-zinc-900 p-1 rounded-lg overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
      {PERIODS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap flex-shrink-0',
            selected === key
              ? 'bg-[#39FF14] text-black'
              : 'text-neutral-500 hover:text-white hover:bg-zinc-800'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Top 3 mini-podium displayed above the table */
function MiniPodium({
  entries,
  metricConfig,
  currentUserName,
}: {
  entries: LeaderboardEntry[];
  metricConfig: MetricConfig;
  currentUserName?: string;
}) {
  if (entries.length < 3) return null;

  const top3 = entries.slice(0, 3);
  // Display order: 2nd, 1st, 3rd
  const podiumOrder = [top3[1], top3[0], top3[2]];
  const heights = ['h-20', 'h-28', 'h-16'];
  const ranks = [2, 1, 3] as const;

  return (
    <div className="flex items-end justify-center gap-3 py-4 px-2">
      {podiumOrder.map((entry, idx) => {
        const rank = ranks[idx];
        const colors = PODIUM_COLORS[rank];
        const isCurrentUser =
          currentUserName &&
          entry.repName.toLowerCase().includes(currentUserName.split(' ')[0].toLowerCase());

        return (
          <div
            key={entry.repName}
            className={cn(
              'flex flex-col items-center transition-all duration-500',
              idx === 0 && 'animate-slide-up-delay-1',
              idx === 1 && 'animate-slide-up',
              idx === 2 && 'animate-slide-up-delay-2'
            )}
            style={{
              animationDelay: idx === 0 ? '100ms' : idx === 2 ? '200ms' : '0ms',
            }}
          >
            {/* Crown / Medal icon */}
            <div className="mb-1">
              {rank === 1 && <Crown className="h-6 w-6 text-yellow-400 drop-shadow-lg" />}
              {rank === 2 && <Medal className="h-5 w-5 text-gray-300" />}
              {rank === 3 && <Award className="h-5 w-5 text-orange-400" />}
            </div>

            {/* Avatar circle */}
            <div
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-black mb-2',
                colors.circle,
                isCurrentUser && 'ring-2 ring-[#39FF14] ring-offset-2 ring-offset-neutral-950'
              )}
            >
              {getInitials(entry.repName)}
            </div>

            {/* Name and value */}
            <p className={cn('text-xs font-semibold truncate max-w-[80px] text-center', colors.text)}>
              {entry.repName.split(' ')[0]}
            </p>
            <p className={cn('text-xs font-bold', colors.text)}>
              {metricConfig.format(entry.metricValue)}
            </p>

            {/* Podium bar */}
            <div
              className={cn(
                'w-20 sm:w-24 rounded-t-lg border-t border-l border-r mt-2',
                heights[idx],
                colors.bg,
                colors.border
              )}
            />
          </div>
        );
      })}
    </div>
  );
}

/** Staggered row animation wrapper */
function AnimatedRow({
  children,
  index,
}: {
  children: React.ReactNode;
  index: number;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 50 + index * 60);
    return () => clearTimeout(timer);
  }, [index]);

  return (
    <tr
      className={cn(
        'transition-all duration-300',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      )}
      style={{ transitionDelay: `${index * 60}ms` }}
    >
      {children}
    </tr>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export default function SalesDashboardLeaderboard({
  currentUserEmail,
  currentUserName,
}: SalesDashboardLeaderboardProps) {
  const { user } = useAuth();

  // Resolve current user info from props or auth context
  const resolvedName = currentUserName || user?.name || '';
  const resolvedEmail = currentUserEmail || user?.email || '';

  // State
  const [metric, setMetric] = useState<MetricKey>('revenue');
  const [period, setPeriod] = useState<PeriodKey>('thisWeek');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [now, setNow] = useState<number>(Date.now());
  const [visibilityNote, setVisibilityNote] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get the active metric config
  const activeMetric = METRICS.find((m) => m.key === metric) || METRICS[0];

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const fetchLeaderboard = useCallback(
    async (showRefreshSpinner = false) => {
      if (showRefreshSpinner) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        const effectivePeriod = getEffectivePeriod(period);
        const res = await fetch(
          `/api/command-center/weekly-leaderboard?metric=${metric}&period=${effectivePeriod}`,
          { credentials: 'include' }
        );

        if (!res.ok) {
          throw new Error(`Failed to fetch leaderboard (${res.status})`);
        }

        const data: LeaderboardResponse = await res.json();

        if (!data.success) {
          throw new Error(data.error || 'Unknown error');
        }

        setLeaderboard(data.leaderboard);
        setVisibilityNote(data.visibilityNote || null);
        setError(null);
        setLastUpdated(Date.now());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [metric, period]
  );

  // Initial fetch + refetch on metric/period change
  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetchLeaderboard(true);
    }, 30_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchLeaderboard]);

  // Tick "Updated X seconds ago" every 10 seconds
  useEffect(() => {
    tickRef.current = setInterval(() => {
      setNow(Date.now());
    }, 10_000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  // -------------------------------------------------------------------------
  // Check if current user matches a leaderboard entry
  // -------------------------------------------------------------------------

  function isCurrentUser(repName: string): boolean {
    if (!resolvedName) return false;
    const firstName = resolvedName.split(' ')[0].toLowerCase();
    return repName.toLowerCase().includes(firstName);
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="bg-neutral-950 rounded-xl border border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className="p-4 pb-3 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Trophy className="h-5 w-5 text-[#39FF14]" />
            <h2 className="text-lg font-bold text-white">Sales Leaderboard</h2>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
              Estimated Sales (Accrual from Monday Meetings)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-neutral-500 hidden sm:inline">
              Updated {timeAgo(now - lastUpdated)}
            </span>
            <button
              onClick={() => fetchLeaderboard(true)}
              disabled={isRefreshing}
              className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-50"
              title="Refresh leaderboard"
            >
              <RefreshCw
                className={cn('h-4 w-4', isRefreshing && 'animate-spin')}
              />
            </button>
          </div>
        </div>

        {/* Metric pills */}
        <MetricSelector selected={metric} onChange={setMetric} />

        {/* Period pills */}
        <div className="mt-2">
          <PeriodSelector selected={period} onChange={setPeriod} />
        </div>
      </div>

      {/* Visibility note (for sales reps seeing restricted data) */}
      {visibilityNote && (
        <div className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20">
          <p className="text-xs text-yellow-400">{visibilityNote}</p>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="h-8 w-8 text-[#39FF14] animate-spin" />
            <p className="text-sm text-neutral-500">Loading rankings...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {!isLoading && error && (
        <div className="flex items-center justify-center py-16 px-4">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-red-400" />
            </div>
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={() => fetchLeaderboard()}
              className="text-xs text-neutral-400 hover:text-white underline"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && leaderboard.length === 0 && (
        <div className="flex items-center justify-center py-16 px-4">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center">
              <Users className="h-6 w-6 text-neutral-500" />
            </div>
            <p className="text-sm text-neutral-400 font-medium">No data yet</p>
            <p className="text-xs text-neutral-600">
              Numbers will appear once reps submit their weekly reports.
            </p>
          </div>
        </div>
      )}

      {/* Leaderboard content */}
      {!isLoading && !error && leaderboard.length > 0 && (
        <>
          {/* Mini Podium - only when 3+ reps */}
          {leaderboard.length >= 3 && (
            <div className="border-b border-zinc-800">
              <MiniPodium
                entries={leaderboard}
                metricConfig={activeMetric}
                currentUserName={resolvedName}
              />
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800 text-[10px] uppercase tracking-wider text-neutral-500">
                  <th className="px-3 py-2.5 text-center w-12">Rank</th>
                  <th className="px-3 py-2.5 text-left">Rep</th>
                  <th className="px-3 py-2.5 text-right">{activeMetric.label}</th>
                  {metric !== 'revenue' && (
                    <th className="px-3 py-2.5 text-right hidden sm:table-cell">Est. Revenue</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, idx) => {
                  const isCurrent = isCurrentUser(entry.repName);
                  const revenueValue = entry.allMetrics?.revenue ?? 0;

                  return (
                    <AnimatedRow key={entry.repName} index={idx}>
                      {/* Rank */}
                      <td className="px-3 py-3 text-center">
                        {entry.rank === 1 && (
                          <Crown className="h-5 w-5 text-yellow-400 mx-auto" />
                        )}
                        {entry.rank === 2 && (
                          <Medal className="h-5 w-5 text-gray-300 mx-auto" />
                        )}
                        {entry.rank === 3 && (
                          <Award className="h-5 w-5 text-orange-400 mx-auto" />
                        )}
                        {entry.rank > 3 && (
                          <span className="text-sm font-bold text-neutral-500">
                            {entry.rank}
                          </span>
                        )}
                      </td>

                      {/* Rep name */}
                      <td
                        className={cn(
                          'px-3 py-3',
                          isCurrent && 'border-l-2 border-l-[#39FF14]'
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={cn(
                              'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                              entry.rank === 1 && 'bg-gradient-to-br from-yellow-400 to-amber-600 text-black',
                              entry.rank === 2 && 'bg-gradient-to-br from-gray-300 to-gray-500 text-black',
                              entry.rank === 3 && 'bg-gradient-to-br from-orange-400 to-amber-700 text-black',
                              entry.rank > 3 && 'bg-zinc-700 text-neutral-300',
                              isCurrent && entry.rank > 3 && 'ring-1 ring-[#39FF14]/50'
                            )}
                          >
                            {getInitials(entry.repName)}
                          </div>
                          <div className="min-w-0">
                            <p
                              className={cn(
                                'text-sm font-semibold truncate',
                                entry.rank === 1 && 'text-yellow-400',
                                entry.rank === 2 && 'text-gray-300',
                                entry.rank === 3 && 'text-orange-400',
                                entry.rank > 3 && 'text-white',
                                isCurrent && 'text-[#39FF14]'
                              )}
                            >
                              {entry.repName}
                              {isCurrent && (
                                <span className="ml-1.5 text-[10px] text-[#39FF14]/70 font-normal">
                                  (You)
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Primary metric value */}
                      <td className="px-3 py-3 text-right">
                        <span
                          className={cn(
                            'text-sm font-bold tabular-nums',
                            entry.rank === 1 && 'text-yellow-400',
                            entry.rank === 2 && 'text-gray-300',
                            entry.rank === 3 && 'text-orange-400',
                            entry.rank > 3 && 'text-white'
                          )}
                        >
                          {activeMetric.format(entry.metricValue)}
                        </span>
                      </td>

                      {/* Secondary revenue column (hidden when revenue is primary metric) */}
                      {metric !== 'revenue' && (
                        <td className="px-3 py-3 text-right hidden sm:table-cell">
                          <span className="text-xs text-neutral-500 tabular-nums">
                            {formatRevenue(revenueValue)}
                          </span>
                        </td>
                      )}
                    </AnimatedRow>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer with total reps info */}
          <div className="px-4 py-2.5 border-t border-zinc-800 flex items-center justify-between">
            <span className="text-[10px] text-neutral-600">
              {leaderboard.length} rep{leaderboard.length !== 1 ? 's' : ''} ranked
            </span>
            <span className="text-[10px] text-neutral-600 sm:hidden">
              Updated {timeAgo(now - lastUpdated)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
