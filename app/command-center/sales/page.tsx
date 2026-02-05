'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  Users,
  DollarSign,
  Trophy,
  Flame,
  Snowflake,
  Crown,
  Medal,
  Award,
  ChevronRight,
} from 'lucide-react';
import { StatCard, DataTable, LoadingSpinner, Column } from '@/components/command-center';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

// =============================================================================
// Types
// =============================================================================

interface LeaderboardEntry {
  rank: number;
  name: string;
  totalCommissions: number;
  transactionCount: number;
  avgTransaction: number;
  percentOfTotal: number;
}

interface SalesSummary {
  totalCommissions: number;
  transactionCount: number;
  dateRange: {
    start: string | null;
    end: string | null;
  };
  avgTransactionValue: number;
  uniqueReps: number;
}

interface SalesApiResponse {
  success: boolean;
  data: {
    summary: SalesSummary;
    leaderboard: LeaderboardEntry[];
  };
  cached: boolean;
  timestamp: string;
}

type PeriodType = 'week' | 'month' | 'year' | 'all';

// =============================================================================
// Achievement Calculations (Client-Side)
// =============================================================================

interface Achievement {
  id: string;
  name: string;
  icon: string;
  tier: 'legendary' | 'epic' | 'rare' | 'common';
  description: string;
}

function calculateAchievements(rep: LeaderboardEntry): Achievement[] {
  const achievements: Achievement[] = [];

  // Legendary tier
  if (rep.totalCommissions >= 1000000) {
    achievements.push({
      id: 'millionaire',
      name: 'Millionaire',
      icon: '💰',
      tier: 'legendary',
      description: '$1M+ in career commissions',
    });
  }

  // Epic tier
  if (rep.totalCommissions >= 500000 && rep.totalCommissions < 1000000) {
    achievements.push({
      id: 'half-millionaire',
      name: 'Half-Millionaire',
      icon: '💵',
      tier: 'epic',
      description: '$500K+ in career commissions',
    });
  }

  if (rep.transactionCount >= 100) {
    achievements.push({
      id: 'century-club',
      name: 'Century Club',
      icon: '💯',
      tier: 'epic',
      description: '100+ transactions closed',
    });
  }

  // Rare tier
  if (rep.avgTransaction >= 1000) {
    achievements.push({
      id: 'big-ticket',
      name: 'Big Ticket Closer',
      icon: '🎫',
      tier: 'rare',
      description: '$1K+ average transaction',
    });
  }

  if (rep.percentOfTotal >= 20) {
    achievements.push({
      id: 'team-mvp',
      name: 'Team MVP',
      icon: '🌟',
      tier: 'rare',
      description: '20%+ of team total',
    });
  }

  // Common tier
  if (rep.transactionCount >= 50) {
    achievements.push({
      id: 'half-century',
      name: 'Half Century',
      icon: '5️⃣0️⃣',
      tier: 'common',
      description: '50+ transactions',
    });
  }

  return achievements;
}

// =============================================================================
// Streak Detection (Simulated)
// =============================================================================

type StreakType = 'hot' | 'cold' | 'neutral';

function getStreakStatus(rep: LeaderboardEntry, rank: number): StreakType {
  // Simple heuristic: top performers with high avg transaction are "hot"
  if (rank <= 3 && rep.avgTransaction > 600) return 'hot';
  if (rank > 7 && rep.avgTransaction < 400) return 'cold';
  return 'neutral';
}

// =============================================================================
// Utility Functions
// =============================================================================

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(2)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`;
  }
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

// =============================================================================
// Components
// =============================================================================

interface PodiumProps {
  leaderboard: LeaderboardEntry[];
  onRepClick: (rep: LeaderboardEntry) => void;
}

function Podium({ leaderboard, onRepClick }: PodiumProps) {
  const top3 = leaderboard.slice(0, 3);
  if (top3.length < 3) return null;

  const podiumOrder = [top3[1], top3[0], top3[2]]; // 2nd, 1st, 3rd for visual display
  const heights = ['h-24', 'h-32', 'h-20'];
  const colors = [
    'from-gray-400 to-gray-500', // Silver (2nd)
    'from-yellow-400 to-amber-500', // Gold (1st)
    'from-orange-600 to-amber-700', // Bronze (3rd)
  ];
  const icons = [
    <Medal key="silver" className="h-8 w-8 text-gray-300" />,
    <Crown key="gold" className="h-10 w-10 text-yellow-300" />,
    <Award key="bronze" className="h-7 w-7 text-orange-400" />,
  ];
  const positions = ['2nd', '1st', '3rd'];

  return (
    <div className="mb-8">
      <div className="flex items-end justify-center gap-4">
        {podiumOrder.map((rep, index) => {
          if (!rep) return null;
          const actualRank = index === 1 ? 1 : index === 0 ? 2 : 3;
          const streak = getStreakStatus(rep, actualRank);

          return (
            <div
              key={rep.name}
              className="flex flex-col items-center cursor-pointer group"
              onClick={() => onRepClick(rep)}
            >
              {/* Rep Info Above Podium */}
              <div className="mb-2 text-center">
                {icons[index]}
                <div className="relative">
                  <div
                    className={cn(
                      'w-16 h-16 rounded-full bg-gradient-to-br flex items-center justify-center text-2xl font-bold text-white mb-2 transition-transform group-hover:scale-110',
                      colors[index]
                    )}
                  >
                    {rep.name.charAt(0)}
                  </div>
                  {streak === 'hot' && (
                    <Flame className="absolute -top-1 -right-1 h-5 w-5 text-orange-500 animate-pulse" />
                  )}
                  {streak === 'cold' && (
                    <Snowflake className="absolute -top-1 -right-1 h-5 w-5 text-blue-400" />
                  )}
                </div>
                <p className="text-sm font-semibold text-white truncate max-w-[100px]">
                  {rep.name}
                </p>
                <p className="text-lg font-bold text-brand-green">
                  {formatCurrency(rep.totalCommissions)}
                </p>
                <p className="text-xs text-gray-400">
                  {rep.transactionCount} deals
                </p>
              </div>

              {/* Podium Base */}
              <div
                className={cn(
                  'w-24 rounded-t-lg bg-gradient-to-b flex items-center justify-center text-white font-bold transition-all group-hover:brightness-110',
                  heights[index],
                  colors[index]
                )}
              >
                {positions[index]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface PeriodToggleProps {
  selected: PeriodType;
  onChange: (period: PeriodType) => void;
}

function PeriodToggle({ selected, onChange }: PeriodToggleProps) {
  const periods: { value: PeriodType; label: string }[] = [
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'year', label: 'YTD' },
    { value: 'all', label: 'All Time' },
  ];

  return (
    <div className="flex gap-2 bg-zinc-900 p-1 rounded-lg">
      {periods.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-md transition-all',
            selected === value
              ? 'bg-brand-green text-black'
              : 'text-gray-400 hover:text-white hover:bg-zinc-800'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function SalesLeaderboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [period, setPeriod] = useState<PeriodType>('all');
  const [data, setData] = useState<SalesApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [highlightRep, setHighlightRep] = useState<string | null>(null);

  // Set highlight based on logged in user (for Sales role)
  useEffect(() => {
    if (user?.role === 'owner' || user?.role === 'admin') {
      // Admin/Owner see all, no highlight needed
      setHighlightRep(null);
    } else if (user?.name) {
      // Other roles see their own highlighted
      setHighlightRep(user.name);
    }
  }, [user]);

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/command-center/sales?period=${period}`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error || 'Unknown API error');
        }
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [period]);

  // Calculate derived stats
  const stats = useMemo(() => {
    if (!data?.data) return null;

    const { summary, leaderboard } = data.data;
    const topPerformer = leaderboard[0];

    return {
      totalTeamSales: summary.totalCommissions,
      avgTransaction: summary.avgTransactionValue,
      topPerformer: topPerformer?.name || 'N/A',
      topPerformerAmount: topPerformer?.totalCommissions || 0,
      activeReps: summary.uniqueReps,
      totalTransactions: summary.transactionCount,
    };
  }, [data]);

  // Handle rep click
  const handleRepClick = (rep: LeaderboardEntry) => {
    const slug = rep.name.toLowerCase().replace(/\s+/g, '-');
    router.push(`/command-center/sales/${encodeURIComponent(slug)}`);
  };

  // Table columns
  const columns: Column<LeaderboardEntry>[] = [
    {
      accessor: 'rank',
      header: '#',
      width: 'w-12',
      align: 'center',
      render: (value, row) => {
        const rank = value as number;
        const streak = getStreakStatus(row, rank);

        return (
          <div className="flex items-center justify-center gap-1">
            <span
              className={cn(
                'font-bold',
                rank === 1 && 'text-yellow-400',
                rank === 2 && 'text-gray-400',
                rank === 3 && 'text-orange-500'
              )}
            >
              {rank}
            </span>
            {streak === 'hot' && <Flame className="h-4 w-4 text-orange-500" />}
            {streak === 'cold' && <Snowflake className="h-4 w-4 text-blue-400" />}
          </div>
        );
      },
    },
    {
      accessor: 'name',
      header: 'Rep',
      sortable: true,
      render: (value, row) => {
        const name = value as string;
        const achievements = calculateAchievements(row);
        const isHighlighted = highlightRep && name.toLowerCase().includes(highlightRep.toLowerCase());

        return (
          <div className={cn('flex items-center gap-2', isHighlighted && 'bg-brand-green/10 -mx-2 px-2 py-1 rounded')}>
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                row.rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                row.rank === 2 ? 'bg-gray-500/20 text-gray-400' :
                row.rank === 3 ? 'bg-orange-500/20 text-orange-400' :
                'bg-zinc-700 text-gray-300'
              )}
            >
              {name.charAt(0)}
            </div>
            <div>
              <span className="font-medium text-white">{name}</span>
              {achievements.length > 0 && (
                <div className="flex gap-1 mt-0.5">
                  {achievements.slice(0, 3).map((a) => (
                    <span key={a.id} title={`${a.name}: ${a.description}`} className="text-sm">
                      {a.icon}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessor: 'totalCommissions',
      header: 'Total Commissions',
      sortable: true,
      align: 'right',
      render: (value) => (
        <span className="font-semibold text-brand-green">
          {formatCurrency(value as number)}
        </span>
      ),
    },
    {
      accessor: 'transactionCount',
      header: 'Transactions',
      sortable: true,
      align: 'right',
      render: (value) => formatNumber(value as number),
    },
    {
      accessor: 'avgTransaction',
      header: 'Avg Deal',
      sortable: true,
      align: 'right',
      render: (value) => formatCurrency(value as number),
    },
    {
      accessor: 'percentOfTotal',
      header: '% of Total',
      sortable: true,
      align: 'right',
      render: (value) => {
        const pct = value as number;
        return (
          <div className="flex items-center justify-end gap-2">
            <div className="w-16 h-2 bg-zinc-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-green rounded-full transition-all"
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <span className="text-sm">{pct.toFixed(1)}%</span>
          </div>
        );
      },
    },
    {
      accessor: 'name',
      header: '',
      width: 'w-10',
      render: () => (
        <ChevronRight className="h-4 w-4 text-gray-500" />
      ),
    },
  ];

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-400 mb-2">Error Loading Data</h2>
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => setPeriod(period)}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Trophy className="h-8 w-8 text-brand-green" />
            Sales Leaderboard
          </h1>
          <p className="text-gray-400 mt-1">
            Track team performance and commissions
          </p>
        </div>

        <div className="flex items-center gap-4">
          <PeriodToggle selected={period} onChange={setPeriod} />
          <Link
            href="/command-center/sales/achievements"
            className="px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition flex items-center gap-2"
          >
            <Award className="h-4 w-4" />
            Achievements
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Team Sales"
            value={formatCurrency(stats.totalTeamSales)}
            icon={DollarSign}
            variant="success"
          />
          <StatCard
            title="Average Transaction"
            value={formatCurrency(stats.avgTransaction)}
            icon={TrendingUp}
          />
          <StatCard
            title="Top Performer"
            value={stats.topPerformer}
            description={formatCurrency(stats.topPerformerAmount)}
            icon={Trophy}
            variant="warning"
          />
          <StatCard
            title="Active Reps"
            value={stats.activeReps}
            description={`${formatNumber(stats.totalTransactions)} total deals`}
            icon={Users}
          />
        </div>
      )}

      {/* Podium for Top 3 */}
      {data?.data.leaderboard && data.data.leaderboard.length >= 3 && (
        <div className="bg-[#1a1a1a] rounded-xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4 text-center">
            Top Performers
          </h2>
          <Podium
            leaderboard={data.data.leaderboard}
            onRepClick={handleRepClick}
          />
        </div>
      )}

      {/* Full Leaderboard Table */}
      {data?.data.leaderboard && (
        <div className="bg-[#1a1a1a] rounded-xl border border-gray-800 overflow-hidden">
          <div className="p-4 border-b border-gray-800">
            <h2 className="text-lg font-semibold text-white">
              Full Rankings
            </h2>
            <p className="text-sm text-gray-400">
              Click on a rep to view detailed stats and DNA profile
            </p>
          </div>
          <DataTable
            columns={columns}
            data={data.data.leaderboard}
            rowKey="name"
            onRowClick={handleRepClick}
            hoverable
            striped
          />
        </div>
      )}

      {/* Period Info */}
      {data?.data.summary.dateRange && (
        <p className="text-center text-sm text-gray-500">
          Data from {data.data.summary.dateRange.start || 'beginning'} to{' '}
          {data.data.summary.dateRange.end || 'present'}
          {data.cached && ' (cached)'}
        </p>
      )}
    </div>
  );
}
