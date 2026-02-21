'use client';

/**
 * RCRS Command Center - Team Performance Reports
 *
 * Comprehensive team reports with:
 * - Printable team performance report
 * - Individual rep scorecards
 * - Revenue by source/type analysis
 * - Lead funnel visualization
 * - Period comparison
 *
 * Role-based: Requires reports.view permission
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Download,
  Printer,
  Users,
  Trophy,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Calendar,
  Target,
  Award,
  ChevronDown,
  ChevronUp,
  Filter,
  Star,
  Clock,
  Activity,
  Lightbulb,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { hasPermission } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { teamMembers } from '@/lib/teamData';

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
  avgTransactionValue: number;
  uniqueReps: number;
}

interface SalesData {
  summary: SalesSummary;
  leaderboard: LeaderboardEntry[];
}

interface TrendEntry {
  period: string;
  label: string;
  revenue: number;
  dealCount: number;
}

interface SeasonalData {
  byDayOfWeek: Array<{ day: string; totalRevenue: number; dealCount: number; avgDeal: number }>;
  byMonthOfYear: Array<{ month: string; totalRevenue: number; dealCount: number; avgDeal: number }>;
}

interface InsightEntry {
  id: string;
  type: 'positive' | 'warning' | 'info' | 'tip';
  category: string;
  title: string;
  message: string;
  metric?: string;
  value?: string;
  icon: string;
}

// =============================================================================
// Utility Functions
// =============================================================================

function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

function getTeamMemberPosition(repName: string): string {
  const lower = repName.toLowerCase().trim();
  const member = teamMembers.find(m =>
    m.name.toLowerCase() === lower ||
    m.name.toLowerCase().split(' ')[0] === lower.split(' ')[0]
  );
  return member?.position || 'Sales Rep';
}

// =============================================================================
// Components
// =============================================================================

// Mini bar chart for scorecards
function MiniBar({ value, max, color = 'bg-lime-500' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

// Individual Rep Scorecard
function RepScorecard({ rep, teamAvg, maxRevenue, period }: {
  rep: LeaderboardEntry;
  teamAvg: { revenue: number; deals: number; avgDeal: number };
  maxRevenue: number;
  period: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const position = getTeamMemberPosition(rep.name);

  const revVsAvg = teamAvg.revenue > 0
    ? ((rep.totalCommissions - teamAvg.revenue) / teamAvg.revenue * 100)
    : 0;
  const dealsVsAvg = teamAvg.deals > 0
    ? ((rep.transactionCount - teamAvg.deals) / teamAvg.deals * 100)
    : 0;
  const avgDealVsAvg = teamAvg.avgDeal > 0
    ? ((rep.avgTransaction - teamAvg.avgDeal) / teamAvg.avgDeal * 100)
    : 0;

  const rankColors: Record<number, string> = {
    1: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/50',
    2: 'text-neutral-400 bg-gray-400/20 border-gray-500/50',
    3: 'text-orange-400 bg-orange-500/20 border-orange-500/50',
  };

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden print:break-inside-avoid">
      <div
        className="p-4 cursor-pointer hover:bg-zinc-800/50 transition"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          {/* Rank */}
          <div className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border',
            rankColors[rep.rank] || 'text-neutral-500 bg-zinc-800 border-zinc-700'
          )}>
            #{rep.rank}
          </div>

          {/* Name & Position */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white truncate">{rep.name}</h3>
              <span className="text-xs text-zinc-500">{position}</span>
            </div>
            <div className="flex items-center gap-4 mt-1">
              <span className="text-sm text-lime-400 font-semibold">{formatCurrency(rep.totalCommissions)}</span>
              <span className="text-xs text-neutral-500">{formatNumber(rep.transactionCount)} deals</span>
              <span className="text-xs text-neutral-500">Avg: {formatCurrency(rep.avgTransaction)}</span>
            </div>
          </div>

          {/* Revenue bar */}
          <div className="hidden md:block w-32">
            <MiniBar value={rep.totalCommissions} max={maxRevenue} />
          </div>

          {/* vs Team Avg indicator */}
          <div className={cn(
            'text-sm font-semibold flex items-center gap-1',
            revVsAvg >= 0 ? 'text-lime-400' : 'text-red-400'
          )}>
            {revVsAvg >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {revVsAvg >= 0 ? '+' : ''}{revVsAvg.toFixed(0)}%
          </div>

          {/* Expand arrow */}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-neutral-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-neutral-500" />
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-zinc-800">
          <div className="grid grid-cols-3 gap-4 mt-3">
            <div className="text-center p-3 rounded-lg bg-zinc-800/50">
              <p className="text-xs text-neutral-500 uppercase">Revenue vs Avg</p>
              <p className={cn(
                'text-lg font-bold mt-1',
                revVsAvg >= 0 ? 'text-lime-400' : 'text-red-400'
              )}>
                {revVsAvg >= 0 ? '+' : ''}{revVsAvg.toFixed(1)}%
              </p>
              <p className="text-xs text-neutral-500">Team avg: {formatCurrency(teamAvg.revenue)}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-zinc-800/50">
              <p className="text-xs text-neutral-500 uppercase">Deals vs Avg</p>
              <p className={cn(
                'text-lg font-bold mt-1',
                dealsVsAvg >= 0 ? 'text-lime-400' : 'text-red-400'
              )}>
                {dealsVsAvg >= 0 ? '+' : ''}{dealsVsAvg.toFixed(1)}%
              </p>
              <p className="text-xs text-neutral-500">Team avg: {formatNumber(Math.round(teamAvg.deals))}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-zinc-800/50">
              <p className="text-xs text-neutral-500 uppercase">Avg Deal vs Avg</p>
              <p className={cn(
                'text-lg font-bold mt-1',
                avgDealVsAvg >= 0 ? 'text-lime-400' : 'text-red-400'
              )}>
                {avgDealVsAvg >= 0 ? '+' : ''}{avgDealVsAvg.toFixed(1)}%
              </p>
              <p className="text-xs text-neutral-500">Team avg: {formatCurrency(teamAvg.avgDeal)}</p>
            </div>
          </div>

          {/* Share of total */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-neutral-500">Share of Team Revenue</span>
              <span className="text-white font-medium">{rep.percentOfTotal.toFixed(1)}%</span>
            </div>
            <MiniBar value={rep.percentOfTotal} max={100} color={rep.rank <= 3 ? 'bg-yellow-500' : 'bg-lime-500'} />
          </div>

          <div className="mt-3 flex justify-end">
            <Link
              href={`/command-center/sales/${encodeURIComponent(rep.name.toLowerCase().replace(/\s+/g, '-'))}`}
              className="text-sm text-lime-400 hover:text-lime-300 transition"
            >
              View Full Profile &rarr;
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// Revenue by Month chart (text-based for printability)
function RevenueByMonthChart({ data }: { data: TrendEntry[] }) {
  if (data.length === 0) return null;
  const maxRevenue = Math.max(...data.map(d => d.revenue));

  return (
    <div className="space-y-2">
      {data.map(entry => (
        <div key={entry.period} className="flex items-center gap-3">
          <span className="text-xs text-neutral-500 w-16 shrink-0">{entry.label}</span>
          <div className="flex-1 h-6 bg-zinc-800 rounded overflow-hidden relative">
            <div
              className="h-full bg-lime-500/30 border-r-2 border-lime-500 rounded transition-all"
              style={{ width: `${maxRevenue > 0 ? (entry.revenue / maxRevenue) * 100 : 0}%` }}
            />
            <span className="absolute inset-0 flex items-center px-2 text-xs text-white font-medium">
              {formatCurrency(entry.revenue)} ({entry.dealCount} deals)
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// Seasonal patterns display
function SeasonalPatterns({ data }: { data: SeasonalData }) {
  const maxDayRevenue = Math.max(...data.byDayOfWeek.map(d => d.totalRevenue));
  const maxMonthRevenue = Math.max(...data.byMonthOfYear.map(d => d.totalRevenue));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* By Day of Week */}
      <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-lime-400" />
          Revenue by Day of Week
        </h3>
        <div className="space-y-2">
          {data.byDayOfWeek.map(d => (
            <div key={d.day} className="flex items-center gap-2">
              <span className="text-xs text-neutral-500 w-12 shrink-0">{d.day.substring(0, 3)}</span>
              <div className="flex-1 h-5 bg-zinc-800 rounded overflow-hidden relative">
                <div
                  className="h-full bg-brand-green/30 border-r border-blue-400 rounded"
                  style={{ width: `${maxDayRevenue > 0 ? (d.totalRevenue / maxDayRevenue) * 100 : 0}%` }}
                />
                <span className="absolute inset-0 flex items-center px-2 text-xs text-neutral-400">
                  {formatCurrency(d.totalRevenue)} ({d.dealCount})
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* By Month of Year */}
      <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-lime-400" />
          Revenue by Month of Year
        </h3>
        <div className="space-y-2">
          {data.byMonthOfYear.map(d => (
            <div key={d.month} className="flex items-center gap-2">
              <span className="text-xs text-neutral-500 w-8 shrink-0">{d.month}</span>
              <div className="flex-1 h-5 bg-zinc-800 rounded overflow-hidden relative">
                <div
                  className="h-full bg-purple-500/30 border-r border-purple-400 rounded"
                  style={{ width: `${maxMonthRevenue > 0 ? (d.totalRevenue / maxMonthRevenue) * 100 : 0}%` }}
                />
                <span className="absolute inset-0 flex items-center px-2 text-xs text-neutral-400">
                  {formatCurrency(d.totalRevenue)} ({d.dealCount})
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Lead Funnel visualization
function LeadFunnel({ salesData }: { salesData: SalesData }) {
  // Build funnel from sales data - estimate pipeline stages
  const totalDeals = salesData.summary.transactionCount;
  const uniqueReps = salesData.summary.uniqueReps;
  const totalRevenue = salesData.summary.totalCommissions;

  // Estimate funnel stages (typical roofing ratios)
  const estimatedLeads = Math.round(totalDeals * 4.5); // ~22% close rate
  const estimatedInspections = Math.round(totalDeals * 2.5);
  const estimatedProposals = Math.round(totalDeals * 1.8);
  const closedDeals = totalDeals;

  const stages = [
    { name: 'Leads Generated', count: estimatedLeads, color: 'bg-brand-green', width: '100%' },
    { name: 'Inspections Completed', count: estimatedInspections, color: 'bg-cyan-500', width: '75%' },
    { name: 'Proposals Sent', count: estimatedProposals, color: 'bg-amber-500', width: '55%' },
    { name: 'Deals Closed', count: closedDeals, color: 'bg-lime-500', width: '40%' },
  ];

  return (
    <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
      <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <Target className="h-4 w-4 text-lime-400" />
        Estimated Sales Funnel
      </h3>
      <div className="space-y-3">
        {stages.map((stage, i) => (
          <div key={stage.name} className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-neutral-500">{stage.name}</span>
                <span className="text-xs text-white font-medium">{formatNumber(stage.count)}</span>
              </div>
              <div className="flex justify-center">
                <div className="h-6 bg-zinc-800 rounded overflow-hidden" style={{ width: stage.width }}>
                  <div className={cn('h-full rounded', stage.color, 'opacity-40')} style={{ width: '100%' }} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-zinc-800 grid grid-cols-2 gap-3 text-center">
        <div>
          <p className="text-xs text-neutral-500">Est. Close Rate</p>
          <p className="text-lg font-bold text-lime-400">
            {estimatedLeads > 0 ? (closedDeals / estimatedLeads * 100).toFixed(1) : 0}%
          </p>
        </div>
        <div>
          <p className="text-xs text-neutral-500">Avg Deal Value</p>
          <p className="text-lg font-bold text-white">
            {formatCurrency(salesData.summary.avgTransactionValue)}
          </p>
        </div>
      </div>
      <p className="text-xs text-neutral-400 mt-3 italic">
        * Lead and inspection counts are estimated from industry ratios. Connect JobNimbus for actual pipeline data.
      </p>
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function TeamReportsPage() {
  const { user } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);

  // State
  const [period, setPeriod] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [salesData, setSalesData] = useState<SalesData | null>(null);
  const [trendData, setTrendData] = useState<TrendEntry[]>([]);
  const [seasonalData, setSeasonalData] = useState<SeasonalData | null>(null);
  const [insights, setInsights] = useState<InsightEntry[]>([]);
  const [sortBy, setSortBy] = useState<'rank' | 'revenue' | 'deals' | 'avgDeal'>('rank');

  // Permission check
  const userRole = (user?.role === 'owner' || user?.role === 'admin') ? 'Owner' :
                   user?.role === 'office' ? 'Office' :
                   user?.role === 'project_manager' ? 'Manager' :
                   user?.role === 'driver' ? 'Driver' : 'Sales';
  const canView = hasPermission(userRole as 'Owner' | 'Admin' | 'Manager' | 'Sales' | 'Driver' | 'Office', 'reports.view');

  // Fetch data
  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      try {
        const [salesRes, trendsRes, insightsRes] = await Promise.all([
          fetch(`/api/command-center/sales?period=${period}`),
          fetch('/api/command-center/trends?type=all&months=12'),
          fetch('/api/command-center/insights'),
        ]);

        const salesJson = await salesRes.json();
        const trendsJson = await trendsRes.json();
        const insightsJson = await insightsRes.json();

        if (salesJson.success) {
          setSalesData(salesJson.data);
        }
        if (trendsJson.success) {
          setTrendData(trendsJson.data.revenueTrend || []);
          setSeasonalData(trendsJson.data.seasonal || null);
        }
        if (insightsJson.success) {
          setInsights(insightsJson.data.insights || []);
        }
      } catch (err) {
        console.error('Failed to load report data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, [period]);

  // Computed values
  const teamAvg = useMemo(() => {
    if (!salesData) return { revenue: 0, deals: 0, avgDeal: 0 };
    const count = salesData.leaderboard.length || 1;
    return {
      revenue: salesData.summary.totalCommissions / count,
      deals: salesData.summary.transactionCount / count,
      avgDeal: salesData.summary.avgTransactionValue,
    };
  }, [salesData]);

  const maxRevenue = useMemo(() => {
    if (!salesData) return 0;
    return Math.max(...salesData.leaderboard.map(r => r.totalCommissions), 1);
  }, [salesData]);

  const sortedLeaderboard = useMemo(() => {
    if (!salesData) return [];
    const list = [...salesData.leaderboard];
    switch (sortBy) {
      case 'revenue': return list.sort((a, b) => b.totalCommissions - a.totalCommissions);
      case 'deals': return list.sort((a, b) => b.transactionCount - a.transactionCount);
      case 'avgDeal': return list.sort((a, b) => b.avgTransaction - a.avgTransaction);
      default: return list.sort((a, b) => a.rank - b.rank);
    }
  }, [salesData, sortBy]);

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  if (!canView) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <Users className="mx-auto h-12 w-12 text-zinc-600" />
          <h2 className="mt-4 text-xl font-semibold text-white">Access Restricted</h2>
          <p className="mt-2 text-zinc-400">You do not have permission to view Team Reports.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-lime-500 border-t-transparent rounded-full mx-auto" />
          <p className="mt-3 text-neutral-500">Loading team report data...</p>
        </div>
      </div>
    );
  }

  if (!salesData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <BarChart3 className="mx-auto h-12 w-12 text-zinc-600" />
          <h2 className="mt-4 text-xl font-semibold text-white">No Data Available</h2>
          <p className="mt-2 text-zinc-400">Unable to load sales data for the report.</p>
        </div>
      </div>
    );
  }

  const periodLabel = period === 'all' ? 'All Time' : period === 'year' ? 'YTD' : period === 'month' ? 'This Month' : 'This Week';
  const topPerformer = salesData.leaderboard[0];
  const aboveAvgCount = salesData.leaderboard.filter(r => r.totalCommissions > teamAvg.revenue).length;

  return (
    <div className="space-y-6 print:space-y-4" ref={printRef}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:flex-row">
        <div>
          <Link
            href="/command-center/reports"
            className="inline-flex items-center gap-1 text-neutral-500 hover:text-white mb-2 transition print:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Reports
          </Link>
          <h1 className="text-2xl font-bold text-white">Team Performance Report</h1>
          <p className="mt-1 text-zinc-400">
            {periodLabel} | Generated {new Date().toLocaleDateString('en-US', {
              month: 'long', day: 'numeric', year: 'numeric'
            })}
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
          >
            <option value="all">All Time</option>
            <option value="year">This Year</option>
            <option value="month">This Month</option>
            <option value="week">This Week</option>
          </select>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 border border-zinc-700 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
      </div>

      {/* Executive Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 print:grid-cols-5">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500 uppercase">Total Revenue</p>
          <p className="text-2xl font-bold text-lime-400 mt-1">{formatCurrency(salesData.summary.totalCommissions)}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500 uppercase">Total Deals</p>
          <p className="text-2xl font-bold text-white mt-1">{formatNumber(salesData.summary.transactionCount)}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500 uppercase">Avg Deal Size</p>
          <p className="text-2xl font-bold text-white mt-1">{formatCurrency(salesData.summary.avgTransactionValue)}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500 uppercase">Active Reps</p>
          <p className="text-2xl font-bold text-white mt-1">{salesData.summary.uniqueReps}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500 uppercase">Above Average</p>
          <p className="text-2xl font-bold text-lime-400 mt-1">{aboveAvgCount} / {salesData.leaderboard.length}</p>
        </div>
      </div>

      {/* Top Performer Highlight */}
      {topPerformer && (
        <div className="bg-gradient-to-r from-yellow-500/10 via-amber-500/5 to-transparent rounded-xl p-5 border border-yellow-500/20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <Trophy className="h-6 w-6 text-yellow-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white">
                Top Performer: {topPerformer.name}
              </h3>
              <p className="text-sm text-neutral-500">
                {formatCurrency(topPerformer.totalCommissions)} revenue |{' '}
                {formatNumber(topPerformer.transactionCount)} deals |{' '}
                {topPerformer.percentOfTotal.toFixed(1)}% of team total |{' '}
                Avg deal: {formatCurrency(topPerformer.avgTransaction)}
              </p>
            </div>
            <Link
              href={`/command-center/sales/${encodeURIComponent(topPerformer.name.toLowerCase().replace(/\s+/g, '-'))}`}
              className="text-sm text-lime-400 hover:text-lime-300 transition print:hidden"
            >
              View Profile &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* Individual Rep Scorecards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-lime-400" />
            Individual Scorecards ({sortedLeaderboard.length})
          </h2>
          <div className="flex items-center gap-2 print:hidden">
            <Filter className="h-4 w-4 text-neutral-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-white"
            >
              <option value="rank">Sort by Rank</option>
              <option value="revenue">Sort by Revenue</option>
              <option value="deals">Sort by Deal Count</option>
              <option value="avgDeal">Sort by Avg Deal</option>
            </select>
          </div>
        </div>
        <div className="space-y-2">
          {sortedLeaderboard.map(rep => (
            <RepScorecard
              key={rep.name}
              rep={rep}
              teamAvg={teamAvg}
              maxRevenue={maxRevenue}
              period={periodLabel}
            />
          ))}
        </div>
      </div>

      {/* Revenue Trend */}
      {trendData.length > 0 && (
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-lime-400" />
            Monthly Revenue Trend (12 Months)
          </h2>
          <RevenueByMonthChart data={trendData} />
        </div>
      )}

      {/* Two-column layout: Funnel + Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead Funnel */}
        <LeadFunnel salesData={salesData} />

        {/* Key Insights */}
        <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-400" />
            Key Insights & Recommendations
          </h3>
          <div className="space-y-2 max-h-[400px] overflow-y-auto print:max-h-none">
            {insights.slice(0, 10).map(insight => {
              const typeColors: Record<string, string> = {
                positive: 'border-l-lime-500 bg-lime-500/5',
                warning: 'border-l-amber-500 bg-amber-500/5',
                info: 'border-l-blue-500 bg-brand-green/5',
                tip: 'border-l-purple-500 bg-purple-500/5',
              };
              const typeIcons: Record<string, React.ReactNode> = {
                positive: <TrendingUp className="h-4 w-4 text-lime-400" />,
                warning: <TrendingDown className="h-4 w-4 text-amber-400" />,
                info: <Star className="h-4 w-4 text-blue-400" />,
                tip: <Lightbulb className="h-4 w-4 text-purple-400" />,
              };

              return (
                <div
                  key={insight.id}
                  className={cn(
                    'p-3 rounded-lg border-l-4',
                    typeColors[insight.type] || 'border-l-gray-500 bg-zinc-800/50'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5">{typeIcons[insight.type]}</div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">{insight.title}</h4>
                      <p className="text-xs text-neutral-500 mt-0.5">{insight.message}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {insights.length === 0 && (
              <p className="text-sm text-neutral-500 text-center py-4">No insights available yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Seasonal Patterns */}
      {seasonalData && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-lime-400" />
            Seasonal Patterns
          </h2>
          <SeasonalPatterns data={seasonalData} />
        </div>
      )}

      {/* Full Ranking Table (printable) */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Award className="h-5 w-5 text-lime-400" />
            Complete Rankings - {periodLabel}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-800/50">
                <th className="text-left py-3 px-4 text-neutral-500 font-medium">Rank</th>
                <th className="text-left py-3 px-4 text-neutral-500 font-medium">Name</th>
                <th className="text-left py-3 px-4 text-neutral-500 font-medium">Position</th>
                <th className="text-right py-3 px-4 text-neutral-500 font-medium">Revenue</th>
                <th className="text-right py-3 px-4 text-neutral-500 font-medium">Deals</th>
                <th className="text-right py-3 px-4 text-neutral-500 font-medium">Avg Deal</th>
                <th className="text-right py-3 px-4 text-neutral-500 font-medium">% of Total</th>
                <th className="text-right py-3 px-4 text-neutral-500 font-medium">vs Avg</th>
              </tr>
            </thead>
            <tbody>
              {salesData.leaderboard.map(rep => {
                const vsAvg = teamAvg.revenue > 0
                  ? ((rep.totalCommissions - teamAvg.revenue) / teamAvg.revenue * 100)
                  : 0;
                return (
                  <tr key={rep.name} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="py-2.5 px-4">
                      <span className={cn(
                        'font-semibold',
                        rep.rank === 1 ? 'text-yellow-400' :
                        rep.rank === 2 ? 'text-neutral-400' :
                        rep.rank === 3 ? 'text-orange-400' : 'text-neutral-500'
                      )}>
                        #{rep.rank}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-white font-medium">{rep.name}</td>
                    <td className="py-2.5 px-4 text-neutral-500">{getTeamMemberPosition(rep.name)}</td>
                    <td className="py-2.5 px-4 text-right text-lime-400 font-semibold">
                      {formatCurrency(rep.totalCommissions)}
                    </td>
                    <td className="py-2.5 px-4 text-right text-neutral-400">{formatNumber(rep.transactionCount)}</td>
                    <td className="py-2.5 px-4 text-right text-neutral-400">{formatCurrency(rep.avgTransaction)}</td>
                    <td className="py-2.5 px-4 text-right text-neutral-400">{rep.percentOfTotal.toFixed(1)}%</td>
                    <td className="py-2.5 px-4 text-right">
                      <span className={cn(
                        'font-semibold',
                        vsAvg >= 0 ? 'text-lime-400' : 'text-red-400'
                      )}>
                        {vsAvg >= 0 ? '+' : ''}{vsAvg.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
              {/* Team totals row */}
              <tr className="bg-zinc-800/50 border-t-2 border-lime-500/30">
                <td className="py-3 px-4" />
                <td className="py-3 px-4 text-white font-bold">TEAM TOTAL</td>
                <td className="py-3 px-4" />
                <td className="py-3 px-4 text-right text-lime-400 font-bold">
                  {formatCurrency(salesData.summary.totalCommissions)}
                </td>
                <td className="py-3 px-4 text-right text-white font-bold">
                  {formatNumber(salesData.summary.transactionCount)}
                </td>
                <td className="py-3 px-4 text-right text-white font-bold">
                  {formatCurrency(salesData.summary.avgTransactionValue)}
                </td>
                <td className="py-3 px-4 text-right text-white font-bold">100%</td>
                <td className="py-3 px-4" />
              </tr>
              {/* Team average row */}
              <tr className="bg-zinc-800/30">
                <td className="py-2.5 px-4" />
                <td className="py-2.5 px-4 text-neutral-500 font-medium italic">Team Average</td>
                <td className="py-2.5 px-4" />
                <td className="py-2.5 px-4 text-right text-neutral-500 font-medium">
                  {formatCurrency(teamAvg.revenue)}
                </td>
                <td className="py-2.5 px-4 text-right text-neutral-500">
                  {formatNumber(Math.round(teamAvg.deals))}
                </td>
                <td className="py-2.5 px-4 text-right text-neutral-500">
                  {formatCurrency(teamAvg.avgDeal)}
                </td>
                <td className="py-2.5 px-4 text-right text-neutral-500">
                  {(100 / (salesData.leaderboard.length || 1)).toFixed(1)}%
                </td>
                <td className="py-2.5 px-4" />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Print Footer */}
      <div className="hidden print:block text-center text-xs text-neutral-500 mt-8 border-t border-zinc-800 pt-4">
        <p>River City Roofing Solutions - Team Performance Report</p>
        <p>Generated on {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} | {periodLabel}</p>
        <p>Confidential - For Internal Use Only</p>
      </div>
    </div>
  );
}
