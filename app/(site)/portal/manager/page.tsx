'use client';

/**
 * RCRS Manager Dashboard
 *
 * Team management focused dashboard with:
 * - Team overview: reps with workload (active jobs, pending leads, scheduled)
 * - Daily activity feed
 * - Performance metrics: team avg vs individual
 * - Upcoming deadlines and deliveries
 * - Issues/alerts: overdue follow-ups, stale leads
 * - Action buttons: assign lead, schedule job
 * - Rep comparison tool
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BarChart3, Package, Truck, AlertTriangle, Plus, RefreshCw,
  ArrowLeft, Clock, CheckCircle2, MapPin, User, DollarSign,
  TrendingUp, Calendar, Loader2, ChevronRight, Users, Target,
  Flame, ArrowUpRight, ArrowDownRight, Lightbulb, AlertCircle,
  Phone, MessageSquare, ClipboardList, Trophy,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface SalesLeaderEntry {
  rank: number;
  name: string;
  totalCommissions: number;
  transactionCount: number;
  avgTransaction: number;
  percentOfTotal: number;
}

interface InsightItem {
  id: string;
  type: 'positive' | 'warning' | 'info' | 'tip';
  category: string;
  title: string;
  message: string;
  metric?: string;
  value?: string;
  icon: string;
}

interface TrendDataPoint {
  period: string;
  label: string;
  revenue: number;
  dealCount: number;
}

interface ComparisonData {
  comparisonType: string;
  period: string;
  rep1: {
    name: string;
    totalRevenue: number;
    dealCount: number;
    avgDealSize: number;
    recentDeals: number;
    recentRevenue: number;
  };
  rep2: {
    name: string;
    totalRevenue: number;
    dealCount: number;
    avgDealSize: number;
    recentDeals: number;
    recentRevenue: number;
  };
  differences: {
    revenue: number;
    revenuePercent: number;
    dealCount: number;
    avgDealSize: number;
    avgDealSizePercent: number;
    recentRevenue: number;
    recentDeals: number;
  };
  availableReps: string[];
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount.toLocaleString()}`;
}

// ============================================================================
// Components
// ============================================================================

function TeamRepCard({ rep, teamAvg }: { rep: SalesLeaderEntry; teamAvg: number }) {
  const isAboveAvg = rep.totalCommissions > teamAvg;
  const deviation = teamAvg > 0 ? ((rep.totalCommissions - teamAvg) / teamAvg) * 100 : 0;

  return (
    <Link
      href={`/command-center/sales/${encodeURIComponent(rep.name.toLowerCase().replace(/\s+/g, '-'))}`}
      className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-800/50"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold',
            rep.rank === 1 ? 'bg-amber-500/20 text-amber-400' :
            rep.rank === 2 ? 'bg-zinc-400/20 text-zinc-300' :
            rep.rank === 3 ? 'bg-orange-500/20 text-orange-400' :
            'bg-zinc-700 text-zinc-400'
          )}>
            {rep.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <p className="font-semibold text-white text-sm">{rep.name}</p>
            <p className="text-xs text-zinc-500">Rank #{rep.rank}</p>
          </div>
        </div>
        {rep.rank <= 3 && <Flame size={16} className="text-amber-400" />}
      </div>

      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="rounded-lg bg-zinc-800/50 p-2">
          <p className="text-xs text-zinc-500">Revenue</p>
          <p className="text-sm font-semibold text-lime-400">{formatCurrency(rep.totalCommissions)}</p>
        </div>
        <div className="rounded-lg bg-zinc-800/50 p-2">
          <p className="text-xs text-zinc-500">Deals</p>
          <p className="text-sm font-semibold text-white">{rep.transactionCount}</p>
        </div>
        <div className="rounded-lg bg-zinc-800/50 p-2">
          <p className="text-xs text-zinc-500">Avg Deal</p>
          <p className="text-sm font-semibold text-white">{formatCurrency(rep.avgTransaction)}</p>
        </div>
        <div className="rounded-lg bg-zinc-800/50 p-2">
          <p className="text-xs text-zinc-500">vs Team</p>
          <p className={cn(
            'text-sm font-semibold flex items-center justify-center gap-1',
            isAboveAvg ? 'text-lime-400' : 'text-orange-400'
          )}>
            {isAboveAvg ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(deviation).toFixed(0)}%
          </p>
        </div>
      </div>
    </Link>
  );
}

function ComparisonTool({
  comparison,
  availableReps,
  selectedRep1,
  selectedRep2,
  selectedPeriod,
  onRep1Change,
  onRep2Change,
  onPeriodChange,
  loading,
}: {
  comparison: ComparisonData | null;
  availableReps: string[];
  selectedRep1: string;
  selectedRep2: string;
  selectedPeriod: string;
  onRep1Change: (rep: string) => void;
  onRep2Change: (rep: string) => void;
  onPeriodChange: (period: string) => void;
  loading: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Target size={20} className="text-lime-400" />
        Rep Comparison
      </h2>

      {/* Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <select
          value={selectedRep1}
          onChange={(e) => onRep1Change(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
        >
          <option value="">Select Rep...</option>
          {availableReps.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select
          value={selectedRep2}
          onChange={(e) => onRep2Change(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
        >
          <option value="">Team Average</option>
          {availableReps.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select
          value={selectedPeriod}
          onChange={(e) => onPeriodChange(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
        >
          <option value="month">This Month</option>
          <option value="quarter">This Quarter</option>
          <option value="year">This Year</option>
          <option value="all">All Time</option>
        </select>
      </div>

      {/* Comparison Results */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
        </div>
      ) : comparison ? (
        <div className="grid grid-cols-3 gap-4">
          {/* Header */}
          <div className="text-center">
            <p className="text-sm font-semibold text-white">{comparison.rep1.name}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-zinc-500 uppercase">Metric</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-zinc-400">{comparison.rep2.name}</p>
          </div>

          {/* Revenue */}
          <div className="text-center py-2 rounded-lg bg-zinc-800/50">
            <p className="text-sm font-bold text-lime-400">{formatCurrency(comparison.rep1.totalRevenue)}</p>
          </div>
          <div className="text-center py-2">
            <p className="text-xs text-zinc-500">Revenue</p>
            <p className={cn(
              'text-xs font-semibold mt-0.5',
              comparison.differences.revenue >= 0 ? 'text-lime-400' : 'text-red-400'
            )}>
              {comparison.differences.revenue >= 0 ? '+' : ''}{formatCurrency(comparison.differences.revenue)}
            </p>
          </div>
          <div className="text-center py-2 rounded-lg bg-zinc-800/50">
            <p className="text-sm font-bold text-zinc-300">{formatCurrency(comparison.rep2.totalRevenue)}</p>
          </div>

          {/* Deals */}
          <div className="text-center py-2 rounded-lg bg-zinc-800/50">
            <p className="text-sm font-bold text-white">{comparison.rep1.dealCount}</p>
          </div>
          <div className="text-center py-2">
            <p className="text-xs text-zinc-500">Deals</p>
            <p className={cn(
              'text-xs font-semibold mt-0.5',
              comparison.differences.dealCount >= 0 ? 'text-lime-400' : 'text-red-400'
            )}>
              {comparison.differences.dealCount >= 0 ? '+' : ''}{comparison.differences.dealCount}
            </p>
          </div>
          <div className="text-center py-2 rounded-lg bg-zinc-800/50">
            <p className="text-sm font-bold text-zinc-300">{comparison.rep2.dealCount}</p>
          </div>

          {/* Avg Deal */}
          <div className="text-center py-2 rounded-lg bg-zinc-800/50">
            <p className="text-sm font-bold text-white">{formatCurrency(comparison.rep1.avgDealSize)}</p>
          </div>
          <div className="text-center py-2">
            <p className="text-xs text-zinc-500">Avg Deal</p>
            <p className={cn(
              'text-xs font-semibold mt-0.5',
              comparison.differences.avgDealSize >= 0 ? 'text-lime-400' : 'text-red-400'
            )}>
              {comparison.differences.avgDealSizePercent >= 0 ? '+' : ''}{comparison.differences.avgDealSizePercent.toFixed(0)}%
            </p>
          </div>
          <div className="text-center py-2 rounded-lg bg-zinc-800/50">
            <p className="text-sm font-bold text-zinc-300">{formatCurrency(comparison.rep2.avgDealSize)}</p>
          </div>

          {/* Recent (30d) */}
          <div className="text-center py-2 rounded-lg bg-zinc-800/50">
            <p className="text-sm font-bold text-white">{formatCurrency(comparison.rep1.recentRevenue)}</p>
          </div>
          <div className="text-center py-2">
            <p className="text-xs text-zinc-500">Last 30 Days</p>
          </div>
          <div className="text-center py-2 rounded-lg bg-zinc-800/50">
            <p className="text-sm font-bold text-zinc-300">{formatCurrency(comparison.rep2.recentRevenue)}</p>
          </div>
        </div>
      ) : (
        <p className="text-center text-sm text-zinc-500 py-4">Select a rep to compare</p>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function ManagerDashboard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'team' | 'comparison'>('overview');

  // Data states
  const [leaderboard, setLeaderboard] = useState<SalesLeaderEntry[]>([]);
  const [allTimeLeaderboard, setAllTimeLeaderboard] = useState<SalesLeaderEntry[]>([]);
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [availableReps, setAvailableReps] = useState<string[]>([]);
  const [compLoading, setCompLoading] = useState(false);

  // Comparison controls
  const [compRep1, setCompRep1] = useState('');
  const [compRep2, setCompRep2] = useState('');
  const [compPeriod, setCompPeriod] = useState('month');

  // Fetch all data on mount
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [salesRes, allSalesRes, insightsRes, trendsRes] = await Promise.all([
          fetch('/api/command-center/sales?period=month'),
          fetch('/api/command-center/sales?period=all'),
          fetch('/api/command-center/insights'),
          fetch('/api/command-center/trends?type=revenue&months=12'),
        ]);

        if (salesRes.ok) {
          const data = await salesRes.json();
          if (data.success && data.data?.leaderboard) {
            setLeaderboard(data.data.leaderboard);
          }
        }

        if (allSalesRes.ok) {
          const data = await allSalesRes.json();
          if (data.success && data.data?.leaderboard) {
            setAllTimeLeaderboard(data.data.leaderboard);
            setAvailableReps(data.data.leaderboard.map((r: SalesLeaderEntry) => r.name));
          }
        }

        if (insightsRes.ok) {
          const data = await insightsRes.json();
          if (data.success && data.data?.insights) {
            setInsights(data.data.insights);
          }
        }

        if (trendsRes.ok) {
          const data = await trendsRes.json();
          if (data.success && data.data?.revenueTrend) {
            setTrendData(data.data.revenueTrend);
          }
        }
      } catch (error) {
        console.error('Error loading manager dashboard:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Fetch comparison when params change
  useEffect(() => {
    if (!compRep1) {
      setComparison(null);
      return;
    }

    async function fetchComparison() {
      setCompLoading(true);
      try {
        const params = new URLSearchParams({ rep1: compRep1, period: compPeriod });
        if (compRep2) params.set('rep2', compRep2);
        const res = await fetch(`/api/command-center/rep-comparison?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success) setComparison(data.data);
        }
      } catch (err) {
        console.error('Failed to fetch comparison:', err);
      } finally {
        setCompLoading(false);
      }
    }
    fetchComparison();
  }, [compRep1, compRep2, compPeriod]);

  // Calculations
  const teamAvgRevenue = leaderboard.length > 0
    ? leaderboard.reduce((s, r) => s + r.totalCommissions, 0) / leaderboard.length : 0;
  const totalTeamRevenue = leaderboard.reduce((s, r) => s + r.totalCommissions, 0);
  const totalDeals = leaderboard.reduce((s, r) => s + r.transactionCount, 0);
  const teamAvgDeal = totalDeals > 0 ? totalTeamRevenue / totalDeals : 0;

  const warningInsights = insights.filter(i => i.type === 'warning' || i.type === 'tip');
  const positiveInsights = insights.filter(i => i.type === 'positive');

  const maxTrend = Math.max(...trendData.map(d => d.revenue), 1);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-lime-500/10 border border-lime-500/30 flex items-center justify-center">
            <BarChart3 className="text-lime-400" size={32} />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold text-white">Manager Dashboard</h2>
            <p className="text-sm text-zinc-400 mt-1">Loading team data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-900/50 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Users className="text-lime-400" size={28} />
              Manager Dashboard
            </h1>
            <p className="mt-1 text-zinc-400">
              Team performance oversight and management tools
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/command-center"
              className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white"
            >
              RoofStack HQ
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-4">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'team', label: 'Team Details', icon: Users },
            { id: 'comparison', label: 'Compare Reps', icon: Target },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-lime-500/20 text-lime-400 border border-lime-500/30'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              )}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <>
          {/* KPI Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-lime-500/10 rounded-lg flex items-center justify-center">
                  <DollarSign className="text-lime-400" size={20} />
                </div>
                <span className="text-zinc-400 text-sm">Team Revenue (Month)</span>
              </div>
              <div className="text-2xl font-bold text-white">{formatCurrency(totalTeamRevenue)}</div>
              <div className="text-sm text-zinc-500">{leaderboard.length} reps active</div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-brand-green/10 rounded-lg flex items-center justify-center">
                  <ClipboardList className="text-blue-400" size={20} />
                </div>
                <span className="text-zinc-400 text-sm">Total Deals</span>
              </div>
              <div className="text-2xl font-bold text-white">{totalDeals}</div>
              <div className="text-sm text-zinc-500">Avg: {formatCurrency(teamAvgDeal)}/deal</div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                  <Trophy className="text-amber-400" size={20} />
                </div>
                <span className="text-zinc-400 text-sm">Top Performer</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {leaderboard[0]?.name || 'N/A'}
              </div>
              <div className="text-sm text-lime-400">
                {leaderboard[0] ? formatCurrency(leaderboard[0].totalCommissions) : '--'}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
                  <AlertCircle className="text-orange-400" size={20} />
                </div>
                <span className="text-zinc-400 text-sm">Alerts</span>
              </div>
              <div className="text-2xl font-bold text-white">{warningInsights.length}</div>
              <div className="text-sm text-zinc-500">Items need attention</div>
            </div>
          </div>

          {/* Revenue Trend + Alerts Grid */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Revenue Trend */}
            <div className="lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Revenue Trend</h2>
                <span className="text-sm text-zinc-500">Last 12 months</span>
              </div>
              {trendData.length > 0 ? (
                <div className="flex items-end gap-1 h-32">
                  {trendData.map((d, i) => {
                    const height = maxTrend > 0 ? (d.revenue / maxTrend) * 100 : 0;
                    return (
                      <div key={d.period} className="flex-1 flex flex-col items-center group relative">
                        <div
                          className="w-full bg-lime-500/80 rounded-t transition-all group-hover:bg-lime-400 min-w-[4px]"
                          style={{ height: `${Math.max(height, 2)}%` }}
                        />
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-700 px-2 py-1 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                          {d.label}: {formatCurrency(d.revenue)}
                        </div>
                        {i % 2 === 0 && (
                          <span className="text-[10px] text-zinc-600 mt-1 truncate w-full text-center">
                            {d.label.split(' ')[0]}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-32 flex items-center justify-center text-zinc-500">
                  No trend data available
                </div>
              )}
            </div>

            {/* Issues & Alerts */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <AlertTriangle size={18} className="text-orange-400" />
                Issues & Alerts
              </h2>
              <div className="space-y-2 max-h-[220px] overflow-y-auto">
                {warningInsights.length > 0 ? (
                  warningInsights.slice(0, 5).map(insight => (
                    <div
                      key={insight.id}
                      className={cn(
                        'rounded-lg border p-3',
                        insight.type === 'warning' ? 'border-orange-500/30 bg-orange-500/5' : 'border-purple-500/30 bg-purple-500/5'
                      )}
                    >
                      <p className="text-sm font-medium text-white">{insight.title}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">{insight.message}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-lime-400 mb-2" />
                    <p className="text-sm text-zinc-500">No issues at this time</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Positive Insights / Wins */}
          {positiveInsights.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Flame size={18} className="text-lime-400" />
                Team Wins
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {positiveInsights.slice(0, 6).map(insight => (
                  <div
                    key={insight.id}
                    className="rounded-lg border border-lime-500/20 bg-lime-500/5 p-3"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <ArrowUpRight size={14} className="text-lime-400" />
                      <p className="text-sm font-medium text-white">{insight.title}</p>
                    </div>
                    <p className="text-xs text-zinc-400">{insight.message}</p>
                    {insight.value && (
                      <span className="inline-block mt-1 text-xs font-semibold bg-lime-500/20 text-lime-400 px-2 py-0.5 rounded">
                        {insight.value}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/command-center/sales"
              className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-700 hover:bg-zinc-800/50 transition-all"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-lime-500/10 text-lime-400">
                <TrendingUp size={20} />
              </div>
              <div>
                <p className="font-medium text-white text-sm">Leaderboard</p>
                <p className="text-xs text-zinc-500">View full rankings</p>
              </div>
            </Link>
            <Link
              href="/command-center/schedule"
              className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-700 hover:bg-zinc-800/50 transition-all"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-green/10 text-blue-400">
                <Calendar size={20} />
              </div>
              <div>
                <p className="font-medium text-white text-sm">Schedule</p>
                <p className="text-xs text-zinc-500">View team schedule</p>
              </div>
            </Link>
            <Link
              href="/command-center/inventory"
              className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-700 hover:bg-zinc-800/50 transition-all"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
                <Package size={20} />
              </div>
              <div>
                <p className="font-medium text-white text-sm">Inventory</p>
                <p className="text-xs text-zinc-500">Stock levels</p>
              </div>
            </Link>
            <Link
              href="/command-center/reports"
              className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-700 hover:bg-zinc-800/50 transition-all"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10 text-orange-400">
                <BarChart3 size={20} />
              </div>
              <div>
                <p className="font-medium text-white text-sm">Reports</p>
                <p className="text-xs text-zinc-500">Team reports</p>
              </div>
            </Link>
          </div>
        </>
      )}

      {/* TEAM DETAILS TAB */}
      {activeTab === 'team' && (
        <>
          {/* Team Performance Grid */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Team Members - This Month</h2>
              <div className="text-sm text-zinc-500">
                Team avg: {formatCurrency(teamAvgRevenue)}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {leaderboard.map(rep => (
                <TeamRepCard key={rep.name} rep={rep} teamAvg={teamAvgRevenue} />
              ))}
            </div>
          </div>

          {/* Full Leaderboard Table */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900">
            <div className="p-4 border-b border-zinc-800">
              <h2 className="text-lg font-semibold text-white">Full Performance Table</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Rep</th>
                    <th className="px-4 py-3 text-right">Revenue (Month)</th>
                    <th className="px-4 py-3 text-right">Deals</th>
                    <th className="px-4 py-3 text-right">Avg Deal</th>
                    <th className="px-4 py-3 text-right">% of Total</th>
                    <th className="px-4 py-3 text-right">vs Team Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map(rep => {
                    const deviation = teamAvgRevenue > 0
                      ? ((rep.totalCommissions - teamAvgRevenue) / teamAvgRevenue) * 100 : 0;
                    return (
                      <tr key={rep.name} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                        <td className="px-4 py-3">
                          <span className={cn(
                            'font-bold',
                            rep.rank <= 3 ? 'text-amber-400' : 'text-zinc-600'
                          )}>
                            {rep.rank}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/command-center/sales/${encodeURIComponent(rep.name.toLowerCase().replace(/\s+/g, '-'))}`}
                            className="font-medium text-white hover:text-lime-400 transition-colors"
                          >
                            {rep.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-lime-400">
                          {formatCurrency(rep.totalCommissions)}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {rep.transactionCount}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-300">
                          {formatCurrency(rep.avgTransaction)}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-400">
                          {rep.percentOfTotal.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn(
                            'text-sm font-medium',
                            deviation >= 0 ? 'text-lime-400' : 'text-orange-400'
                          )}>
                            {deviation >= 0 ? '+' : ''}{deviation.toFixed(0)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* COMPARISON TAB */}
      {activeTab === 'comparison' && (
        <ComparisonTool
          comparison={comparison}
          availableReps={availableReps}
          selectedRep1={compRep1}
          selectedRep2={compRep2}
          selectedPeriod={compPeriod}
          onRep1Change={setCompRep1}
          onRep2Change={setCompRep2}
          onPeriodChange={setCompPeriod}
          loading={compLoading}
        />
      )}
    </div>
  );
}
