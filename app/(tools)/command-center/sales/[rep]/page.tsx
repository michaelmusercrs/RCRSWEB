'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Trophy,
  TrendingUp,
  DollarSign,
  Target,
  Calendar,
  Award,
  Zap,
  BarChart3,
  Lightbulb,
  ChevronUp,
  ChevronDown,
  Minus,
} from 'lucide-react';
import { StatCard, LoadingSpinner } from '@/components/command-center';
import { cn } from '@/lib/utils';

const DNAChart = dynamic(() => import('./RepCharts').then(mod => ({ default: mod.DNAChart })), { ssr: false });
const PerformanceChart = dynamic(() => import('./RepCharts').then(mod => ({ default: mod.PerformanceChart })), { ssr: false });

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
  recentTransactions?: Array<{ date: string; amount: number }>;
}

interface SalesSummary {
  totalCommissions: number;
  transactionCount: number;
  avgTransactionValue: number;
  uniqueReps: number;
}

interface SalesApiResponse {
  success: boolean;
  data: {
    summary: SalesSummary;
    leaderboard: LeaderboardEntry[];
    repDetail?: {
      name: string;
      totalCommissions: number;
      transactionCount: number;
      avgTransaction: number;
      recentTransactions: Array<{
        date: string;
        amount: number;
        balance: number;
      }>;
    };
  };
}

type AchievementTier = 'legendary' | 'epic' | 'rare' | 'common';

interface Achievement {
  id: string;
  name: string;
  icon: string;
  tier: AchievementTier;
  description: string;
}

interface DNAProfile {
  closingPower: number;
  volume: number;
  revenue: number;
  dealSize: number;
  consistency: number;
}

interface CoachingTip {
  type: 'strength' | 'opportunity' | 'insight';
  title: string;
  message: string;
  metric?: string;
  comparison?: 'above' | 'below' | 'at';
}

// =============================================================================
// Achievement Calculations
// =============================================================================

function calculateAchievements(rep: LeaderboardEntry): Achievement[] {
  const achievements: Achievement[] = [];

  // Legendary
  if (rep.totalCommissions >= 1000000) {
    achievements.push({
      id: 'millionaire',
      name: 'Millionaire',
      icon: '💰',
      tier: 'legendary',
      description: '$1M+ in career commissions',
    });
  }
  if (rep.percentOfTotal >= 30) {
    achievements.push({
      id: 'legend',
      name: 'Sales Legend',
      icon: '👑',
      tier: 'legendary',
      description: '30%+ of team total',
    });
  }

  // Epic
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
      description: '100+ transactions',
    });
  }
  if (rep.avgTransaction >= 800) {
    achievements.push({
      id: 'elite-closer',
      name: 'Elite Closer',
      icon: '🎯',
      tier: 'epic',
      description: '$800+ avg transaction',
    });
  }

  // Rare
  if (rep.avgTransaction >= 1000) {
    achievements.push({
      id: 'big-ticket',
      name: 'Big Ticket Closer',
      icon: '🎫',
      tier: 'rare',
      description: '$1K+ avg transaction',
    });
  }
  if (rep.percentOfTotal >= 20 && rep.percentOfTotal < 30) {
    achievements.push({
      id: 'team-mvp',
      name: 'Team MVP',
      icon: '🌟',
      tier: 'rare',
      description: '20%+ of team total',
    });
  }
  if (rep.transactionCount >= 500) {
    achievements.push({
      id: 'volume-king',
      name: 'Volume King',
      icon: '📈',
      tier: 'rare',
      description: '500+ transactions',
    });
  }
  if (rep.totalCommissions >= 250000 && rep.totalCommissions < 500000) {
    achievements.push({
      id: 'quarter-million',
      name: 'Quarter Million',
      icon: '💎',
      tier: 'rare',
      description: '$250K+ commissions',
    });
  }

  // Common
  if (rep.transactionCount >= 50 && rep.transactionCount < 100) {
    achievements.push({
      id: 'half-century',
      name: 'Half Century',
      icon: '5️⃣0️⃣',
      tier: 'common',
      description: '50+ transactions',
    });
  }
  if (rep.percentOfTotal >= 10 && rep.percentOfTotal < 20) {
    achievements.push({
      id: 'rising-star',
      name: 'Rising Star',
      icon: '⭐',
      tier: 'common',
      description: '10%+ of team total',
    });
  }
  if (rep.totalCommissions >= 100000 && rep.totalCommissions < 250000) {
    achievements.push({
      id: 'first-hundred-k',
      name: 'First $100K',
      icon: '🏆',
      tier: 'common',
      description: '$100K+ commissions',
    });
  }

  // Sort by tier
  const tierOrder: AchievementTier[] = ['legendary', 'epic', 'rare', 'common'];
  return achievements.sort(
    (a, b) => tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier)
  );
}

// =============================================================================
// DNA Profile Calculation
// =============================================================================

function calculateDNAProfile(
  rep: LeaderboardEntry,
  teamAvg: {
    avgCommissions: number;
    avgTransactions: number;
    avgDealSize: number;
    avgPercentOfTotal: number;
  }
): DNAProfile {
  // Normalize metrics to 0-100 scale based on team performance

  // Closing Power: Based on avg transaction vs team avg
  const closingPower = Math.min(100, Math.max(0,
    (rep.avgTransaction / (teamAvg.avgDealSize || 500)) * 50
  ));

  // Volume: Based on transaction count vs team avg
  const volume = Math.min(100, Math.max(0,
    (rep.transactionCount / (teamAvg.avgTransactions || 100)) * 50
  ));

  // Revenue: Based on total commissions vs team avg
  const revenue = Math.min(100, Math.max(0,
    (rep.totalCommissions / (teamAvg.avgCommissions || 200000)) * 50
  ));

  // Deal Size: Based on avg transaction (absolute scale)
  const dealSize = Math.min(100, Math.max(0,
    (rep.avgTransaction / 1000) * 100
  ));

  // Consistency: Based on how close to team average they are
  // Higher percent of total = more consistent contributor
  const consistency = Math.min(100, Math.max(0,
    rep.percentOfTotal * 5
  ));

  return {
    closingPower: Math.round(closingPower),
    volume: Math.round(volume),
    revenue: Math.round(revenue),
    dealSize: Math.round(dealSize),
    consistency: Math.round(consistency),
  };
}

// =============================================================================
// AI Coaching Tips
// =============================================================================

function generateCoachingTips(
  rep: LeaderboardEntry,
  dna: DNAProfile,
  teamAvg: {
    avgCommissions: number;
    avgTransactions: number;
    avgDealSize: number;
  }
): CoachingTip[] {
  const tips: CoachingTip[] = [];

  // Strengths
  if (dna.closingPower >= 70) {
    tips.push({
      type: 'strength',
      title: 'Strong Closer',
      message: `Your average deal size of $${rep.avgTransaction.toFixed(0)} is well above team average. Keep leveraging your negotiation skills.`,
      metric: 'Avg Deal',
      comparison: 'above',
    });
  }

  if (dna.volume >= 70) {
    tips.push({
      type: 'strength',
      title: 'High Volume Producer',
      message: `${rep.transactionCount} transactions shows excellent activity level. Your consistency is a key strength.`,
      metric: 'Volume',
      comparison: 'above',
    });
  }

  if (dna.revenue >= 70) {
    tips.push({
      type: 'strength',
      title: 'Revenue Leader',
      message: `Contributing ${rep.percentOfTotal.toFixed(1)}% of team revenue. You're a critical part of the team's success.`,
      metric: 'Revenue',
      comparison: 'above',
    });
  }

  // Opportunities
  if (dna.closingPower < 50 && rep.transactionCount > 50) {
    tips.push({
      type: 'opportunity',
      title: 'Focus on Deal Value',
      message: `Your volume is good but avg deal is $${rep.avgTransaction.toFixed(0)} (team avg: $${teamAvg.avgDealSize.toFixed(0)}). Consider upselling or targeting larger accounts.`,
      metric: 'Deal Size',
      comparison: 'below',
    });
  }

  if (dna.volume < 50 && rep.avgTransaction > teamAvg.avgDealSize) {
    tips.push({
      type: 'opportunity',
      title: 'Increase Activity',
      message: `Your deal quality is excellent! Focus on increasing volume to maximize your potential. Even 10% more deals could significantly boost revenue.`,
      metric: 'Activity',
      comparison: 'below',
    });
  }

  if (dna.consistency < 40) {
    tips.push({
      type: 'opportunity',
      title: 'Build Consistency',
      message: `Your contribution varies. Establishing regular prospecting habits can help smooth out peaks and valleys.`,
      metric: 'Consistency',
      comparison: 'below',
    });
  }

  // Insights
  if (rep.rank <= 3) {
    tips.push({
      type: 'insight',
      title: 'Top Performer Status',
      message: `You're ranked #${rep.rank} on the team. Share your techniques with others to help elevate the entire team.`,
    });
  }

  if (dna.dealSize > 80 && dna.volume < 50) {
    tips.push({
      type: 'insight',
      title: 'Quality Over Quantity',
      message: `Your profile shows a "whale hunter" style - fewer deals but larger values. This is a valid strategy that matches your strengths.`,
    });
  }

  if (dna.volume > 80 && dna.dealSize < 50) {
    tips.push({
      type: 'insight',
      title: 'Volume Player',
      message: `You excel at high-activity sales. Consider whether any subset of your deals could be expanded for higher value.`,
    });
  }

  // Always ensure at least one tip
  if (tips.length === 0) {
    tips.push({
      type: 'insight',
      title: 'Solid Performer',
      message: `Your metrics are balanced across all dimensions. Focus on incremental improvements in your weakest area for maximum impact.`,
    });
  }

  return tips.slice(0, 5); // Max 5 tips
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
// Tier Styling
// =============================================================================

const TIER_STYLES: Record<AchievementTier, { bg: string; border: string; text: string }> = {
  legendary: {
    bg: 'bg-gradient-to-br from-yellow-500/20 to-amber-600/20',
    border: 'border-yellow-500/50',
    text: 'text-yellow-400',
  },
  epic: {
    bg: 'bg-gradient-to-br from-purple-500/20 to-violet-600/20',
    border: 'border-purple-500/50',
    text: 'text-purple-400',
  },
  rare: {
    bg: 'bg-gradient-to-br from-blue-500/20 to-cyan-600/20',
    border: 'border-blue-500/50',
    text: 'text-blue-400',
  },
  common: {
    bg: 'bg-zinc-800/50',
    border: 'border-zinc-700',
    text: 'text-neutral-500',
  },
};

// =============================================================================
// Components
// =============================================================================

interface CoachingCardProps {
  tip: CoachingTip;
}

function CoachingCard({ tip }: CoachingCardProps) {
  const icons = {
    strength: <ChevronUp className="h-5 w-5 text-green-400" />,
    opportunity: <ChevronDown className="h-5 w-5 text-amber-400" />,
    insight: <Minus className="h-5 w-5 text-blue-400" />,
  };

  const colors = {
    strength: 'border-green-500/30 bg-green-500/10',
    opportunity: 'border-amber-500/30 bg-amber-500/10',
    insight: 'border-blue-500/30 bg-brand-green/10',
  };

  return (
    <div className={cn('rounded-lg p-4 border', colors[tip.type])}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icons[tip.type]}</div>
        <div>
          <h4 className="font-semibold text-white">{tip.title}</h4>
          <p className="text-sm text-neutral-500 mt-1">{tip.message}</p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function RepDetailPage() {
  const params = useParams();
  const repSlug = params.rep as string;

  const [allTimeData, setAllTimeData] = useState<SalesApiResponse | null>(null);
  const [ytdData, setYtdData] = useState<SalesApiResponse | null>(null);
  const [monthData, setMonthData] = useState<SalesApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        // Fetch all time, YTD, and month data in parallel
        const [allRes, ytdRes, monthRes] = await Promise.all([
          fetch('/api/command-center/sales?period=all'),
          fetch('/api/command-center/sales?period=year'),
          fetch('/api/command-center/sales?period=month'),
        ]);

        const allJson = await allRes.json();
        const ytdJson = await ytdRes.json();
        const monthJson = await monthRes.json();

        if (!allJson.success) throw new Error(allJson.error || 'Failed to load data');

        setAllTimeData(allJson);
        setYtdData(ytdJson.success ? ytdJson : null);
        setMonthData(monthJson.success ? monthJson : null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Find the rep from all-time data
  const rep = useMemo(() => {
    if (!allTimeData?.data.leaderboard) return null;

    // Convert slug back to name for matching
    const searchName = decodeURIComponent(repSlug).replace(/-/g, ' ').toLowerCase();

    return allTimeData.data.leaderboard.find(
      r => r.name.toLowerCase() === searchName ||
           r.name.toLowerCase().includes(searchName)
    );
  }, [allTimeData, repSlug]);

  // Find rep in other periods
  const ytdRep = useMemo(() => {
    if (!ytdData?.data.leaderboard || !rep) return null;
    return ytdData.data.leaderboard.find(r => r.name === rep.name);
  }, [ytdData, rep]);

  const monthRep = useMemo(() => {
    if (!monthData?.data.leaderboard || !rep) return null;
    return monthData.data.leaderboard.find(r => r.name === rep.name);
  }, [monthData, rep]);

  // Calculate team averages
  const teamAvg = useMemo(() => {
    if (!allTimeData?.data) return null;

    const { summary, leaderboard } = allTimeData.data;
    const repCount = leaderboard.length;

    return {
      avgCommissions: summary.totalCommissions / repCount,
      avgTransactions: summary.transactionCount / repCount,
      avgDealSize: summary.avgTransactionValue,
      avgPercentOfTotal: 100 / repCount,
    };
  }, [allTimeData]);

  // Calculate DNA and achievements
  const dna = useMemo(() => {
    if (!rep || !teamAvg) return null;
    return calculateDNAProfile(rep, teamAvg);
  }, [rep, teamAvg]);

  const achievements = useMemo(() => {
    if (!rep) return [];
    return calculateAchievements(rep);
  }, [rep]);

  const coachingTips = useMemo(() => {
    if (!rep || !dna || !teamAvg) return [];
    return generateCoachingTips(rep, dna, teamAvg);
  }, [rep, dna, teamAvg]);

  // Mock transaction data for chart (since API doesn't return individual transactions in leaderboard)
  const mockTransactions = useMemo(() => {
    if (!rep) return [];

    // Use real transaction data grouped by week
    const recentTx = rep.recentTransactions || [];
    const weeklyMap = new Map<string, number>();

    // Group real transactions by week
    for (const tx of recentTx) {
      const d = new Date(tx.date);
      if (isNaN(d.getTime())) continue;
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().split('T')[0];
      weeklyMap.set(key, (weeklyMap.get(key) || 0) + tx.amount);
    }

    // Fill in last 12 weeks (real data where available, 0 where not)
    const transactions: Array<{ date: string; amount: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i * 7 - date.getDay());
      const key = date.toISOString().split('T')[0];
      transactions.push({
        date: key,
        amount: weeklyMap.get(key) || 0,
      });
    }

    return transactions;
  }, [rep]);

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
          <p className="text-neutral-500 mb-4">{error}</p>
          <Link
            href="/command-center/sales"
            className="px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition"
          >
            Back to Leaderboard
          </Link>
        </div>
      </div>
    );
  }

  // Rep not found
  if (!rep) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-white mb-2">Rep Not Found</h2>
          <p className="text-neutral-500 mb-4">
            Could not find a rep matching "{decodeURIComponent(repSlug).replace(/-/g, ' ')}"
          </p>
          <Link
            href="/command-center/sales"
            className="px-4 py-2 bg-brand-green text-black rounded-lg hover:bg-green-400 transition"
          >
            Back to Leaderboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <Link
          href="/command-center/sales"
          className="inline-flex items-center gap-1 text-neutral-500 hover:text-white mb-4 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Leaderboard
        </Link>

        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold',
                rep.rank === 1 ? 'bg-yellow-500/20 text-yellow-400 ring-2 ring-yellow-500' :
                rep.rank === 2 ? 'bg-gray-400/20 text-neutral-400 ring-2 ring-gray-500' :
                rep.rank === 3 ? 'bg-orange-500/20 text-orange-400 ring-2 ring-orange-500' :
                'bg-zinc-700 text-neutral-400'
              )}
            >
              {rep.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">{rep.name}</h1>
              <p className="text-neutral-500 flex items-center gap-2">
                <span className={cn(
                  'font-semibold',
                  rep.rank === 1 ? 'text-yellow-400' :
                  rep.rank === 2 ? 'text-neutral-500' :
                  rep.rank === 3 ? 'text-orange-400' : 'text-neutral-500'
                )}>
                  Rank #{rep.rank}
                </span>
                <span>|</span>
                <span>{rep.percentOfTotal.toFixed(1)}% of team revenue</span>
              </p>
            </div>
          </div>

          {/* Achievement badges */}
          {achievements.length > 0 && (
            <div className="flex flex-wrap gap-2 md:ml-auto">
              {achievements.slice(0, 5).map(a => {
                const style = TIER_STYLES[a.tier];
                return (
                  <div
                    key={a.id}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full border',
                      style.bg,
                      style.border
                    )}
                    title={a.description}
                  >
                    <span className="text-lg">{a.icon}</span>
                    <span className={cn('text-sm font-medium', style.text)}>
                      {a.name}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Career Total"
          value={formatCurrency(rep.totalCommissions)}
          icon={DollarSign}
          variant="success"
        />
        <StatCard
          title="YTD"
          value={ytdRep ? formatCurrency(ytdRep.totalCommissions) : 'N/A'}
          description={ytdRep ? `Rank #${ytdRep.rank}` : undefined}
          icon={TrendingUp}
        />
        <StatCard
          title="This Month"
          value={monthRep ? formatCurrency(monthRep.totalCommissions) : 'N/A'}
          description={monthRep ? `${monthRep.transactionCount} deals` : undefined}
          icon={Calendar}
        />
        <StatCard
          title="Avg Transaction"
          value={formatCurrency(rep.avgTransaction)}
          description={`${formatNumber(rep.transactionCount)} total deals`}
          icon={Target}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - DNA Profile */}
        <div className="lg:col-span-1">
          <div className="bg-[#1a1a1a] rounded-xl p-6 border border-gray-800">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5 text-brand-green" />
              Sales DNA Profile
            </h2>

            {dna && <DNAChart dna={dna} />}

            {/* DNA Breakdown */}
            {dna && (
              <div className="mt-4 space-y-3">
                {[
                  { label: 'Closing Power', value: dna.closingPower, color: 'bg-brand-green' },
                  { label: 'Volume', value: dna.volume, color: 'bg-brand-green' },
                  { label: 'Revenue', value: dna.revenue, color: 'bg-amber-500' },
                  { label: 'Deal Size', value: dna.dealSize, color: 'bg-purple-500' },
                  { label: 'Consistency', value: dna.consistency, color: 'bg-cyan-500' },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-neutral-500">{label}</span>
                      <span className="text-white font-medium">{value}</span>
                    </div>
                    <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', color)}
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Middle Column - Performance Chart & Coaching */}
        <div className="lg:col-span-2 space-y-6">
          {/* Performance Chart */}
          <div className="bg-[#1a1a1a] rounded-xl p-6 border border-gray-800">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-brand-green" />
              Weekly Performance
            </h2>
            <PerformanceChart transactions={mockTransactions} />
          </div>

          {/* AI Coaching Tips */}
          <div className="bg-[#1a1a1a] rounded-xl p-6 border border-gray-800">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-400" />
              AI Coaching Insights
            </h2>

            <div className="space-y-3">
              {coachingTips.map((tip, i) => (
                <CoachingCard key={i} tip={tip} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* All Achievements */}
      {achievements.length > 0 && (
        <div className="bg-[#1a1a1a] rounded-xl p-6 border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-400" />
            All Achievements ({achievements.length})
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {achievements.map(a => {
              const style = TIER_STYLES[a.tier];
              return (
                <div
                  key={a.id}
                  className={cn(
                    'rounded-lg p-4 border',
                    style.bg,
                    style.border
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{a.icon}</span>
                    <div>
                      <h3 className={cn('font-bold', style.text)}>{a.name}</h3>
                      <p className="text-xs text-neutral-500 uppercase">{a.tier}</p>
                    </div>
                  </div>
                  <p className="text-sm text-neutral-500 mt-2">{a.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly Breakdown */}
      <div className="bg-[#1a1a1a] rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-brand-green" />
          Period Comparison
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 text-neutral-500 font-medium">Period</th>
                <th className="text-right py-3 px-4 text-neutral-500 font-medium">Commissions</th>
                <th className="text-right py-3 px-4 text-neutral-500 font-medium">Transactions</th>
                <th className="text-right py-3 px-4 text-neutral-500 font-medium">Avg Deal</th>
                <th className="text-right py-3 px-4 text-neutral-500 font-medium">Rank</th>
                <th className="text-right py-3 px-4 text-neutral-500 font-medium">% of Team</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-800 hover:bg-zinc-800/50">
                <td className="py-3 px-4 text-white font-medium">All Time</td>
                <td className="py-3 px-4 text-right text-brand-green font-semibold">
                  {formatCurrency(rep.totalCommissions)}
                </td>
                <td className="py-3 px-4 text-right text-neutral-400">
                  {formatNumber(rep.transactionCount)}
                </td>
                <td className="py-3 px-4 text-right text-neutral-400">
                  {formatCurrency(rep.avgTransaction)}
                </td>
                <td className="py-3 px-4 text-right">
                  <span className={cn(
                    'font-semibold',
                    rep.rank <= 3 ? 'text-yellow-400' : 'text-neutral-500'
                  )}>
                    #{rep.rank}
                  </span>
                </td>
                <td className="py-3 px-4 text-right text-neutral-400">
                  {rep.percentOfTotal.toFixed(1)}%
                </td>
              </tr>
              {ytdRep && (
                <tr className="border-b border-gray-800 hover:bg-zinc-800/50">
                  <td className="py-3 px-4 text-white font-medium">YTD</td>
                  <td className="py-3 px-4 text-right text-brand-green font-semibold">
                    {formatCurrency(ytdRep.totalCommissions)}
                  </td>
                  <td className="py-3 px-4 text-right text-neutral-400">
                    {formatNumber(ytdRep.transactionCount)}
                  </td>
                  <td className="py-3 px-4 text-right text-neutral-400">
                    {formatCurrency(ytdRep.avgTransaction)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={cn(
                      'font-semibold',
                      ytdRep.rank <= 3 ? 'text-yellow-400' : 'text-neutral-500'
                    )}>
                      #{ytdRep.rank}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-neutral-400">
                    {ytdRep.percentOfTotal.toFixed(1)}%
                  </td>
                </tr>
              )}
              {monthRep && (
                <tr className="hover:bg-zinc-800/50">
                  <td className="py-3 px-4 text-white font-medium">This Month</td>
                  <td className="py-3 px-4 text-right text-brand-green font-semibold">
                    {formatCurrency(monthRep.totalCommissions)}
                  </td>
                  <td className="py-3 px-4 text-right text-neutral-400">
                    {formatNumber(monthRep.transactionCount)}
                  </td>
                  <td className="py-3 px-4 text-right text-neutral-400">
                    {formatCurrency(monthRep.avgTransaction)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={cn(
                      'font-semibold',
                      monthRep.rank <= 3 ? 'text-yellow-400' : 'text-neutral-500'
                    )}>
                      #{monthRep.rank}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-neutral-400">
                    {monthRep.percentOfTotal.toFixed(1)}%
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
