'use client';

/**
 * RCRS Command Center - Owner/Admin Dashboard
 *
 * Executive-level dashboard with:
 * - KPI cards (Revenue MTD/YTD, Gross Margin, Pipeline, Cash)
 * - Team performance overview per rep
 * - Revenue trend (12-month bar chart)
 * - Auto-generated insights
 * - Top/underperforming rep alerts
 * - Lead comparison (this week vs last week)
 * - Quick links to all reports
 */

import * as React from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  Package,
  Phone,
  Calendar,
  Users,
  DollarSign,
  ArrowRight,
  BarChart3,
  Clock,
  AlertCircle,
  CreditCard,
  PieChart,
  Loader2,
  Wallet,
  Truck,
  RefreshCw,
  Trophy,
  Target,
  Lightbulb,
  Flame,
  AlertTriangle,
  UserCheck,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  FileText,
  Megaphone,
  Settings,
  Eye,
  PenTool,
  CheckCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { StatCard } from '@/components/command-center/StatCard';
import { RoleBadge } from '@/components/command-center/RoleBadge';
import { ResponseTimeDashboard } from '@/components/command-center/ResponseTimeDashboard';
import { SalesCompetitionCard } from '@/components/command-center/SalesCompetition';
import { SheetsHealthWidget } from '@/components/command-center/SheetsHealthWidget';
import UnifiedLeaderboards, {
  type UnifiedLeaderboardsProps,
} from '@/components/UnifiedLeaderboards';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface DashboardStats {
  sales: {
    todayTotal: number;
    weekTotal: number;
    monthTotal: number;
    topPerformers: Array<{
      name: string;
      avatar: string;
      sales: number;
      rank: number;
    }>;
  };
  activeJobs: number;
  inventoryAlerts: number;
  scheduledToday: number;
  teamActive: number;
  recentActivity: Array<{
    type: string;
    icon: string;
    color: string;
    text: string;
    detail: string;
    time: string;
  }>;
  todaySchedule: Array<{
    time: string;
    title: string;
    type: string;
  }>;
  lastUpdated: string;
}

interface FinancialKPIs {
  revenueThisMonth: number;
  monthOverMonthGrowth: number;
  grossMargin: number;
  accountsReceivable: number;
  overdueInvoices: number;
  overdueAmount: number;
  netCashFlow: number;
  pipelineValue: number;
  revenueYTD?: number;
  grossProfit?: number;
  netProfit?: number;
}

interface SalesLeaderEntry {
  rank: number;
  name: string;
  totalCommissions: number;
  transactionCount: number;
  avgTransaction: number;
  percentOfTotal: number;
}

interface BillingAlertItem {
  severity: 'info' | 'warning' | 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  amount?: number;
}

interface TrendDataPoint {
  period: string;
  label: string;
  revenue: number;
  dealCount: number;
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

interface MeetingTeamTotals {
  inspected: number;
  damage: number;
  signed: number;
  repair: number;
  gutter: number;
  revenue: number;
  approved: number;
  referrals: number;
  agents: number;
  homeShow: number;
}

interface MeetingRepStat {
  name: string;
  revenue: number;
  signed: number;
  inspected: number;
  approved: number;
  damage: number;
  rank: number;
}

interface MeetingStatsData {
  periodLabel: string;
  teamTotals: MeetingTeamTotals;
  repStats: MeetingRepStat[];
  change: {
    commissionsPercent: number;
  };
  goals: {
    monthlyTarget: number;
    monthlyProgress: number;
  };
  topPerformer: {
    name: string;
    amount: number;
  };
}

// ============================================================================
// Utility Components
// ============================================================================

function QuickActionCard({
  title,
  description,
  href,
  icon,
  color,
}: {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  color: 'lime' | 'blue' | 'purple' | 'orange' | 'red' | 'cyan';
}) {
  const colorClasses = {
    lime: 'bg-lime-500/10 text-lime-400 group-hover:bg-lime-500/20',
    blue: 'bg-brand-green/10 text-blue-400 group-hover:bg-brand-green/20',
    purple: 'bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20',
    orange: 'bg-orange-500/10 text-orange-400 group-hover:bg-orange-500/20',
    red: 'bg-red-500/10 text-red-400 group-hover:bg-red-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-400 group-hover:bg-cyan-500/20',
  };

  return (
    <Link
      href={href}
      className="group flex items-start gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-800/50"
    >
      <div
        className={cn(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition-colors',
          colorClasses[color]
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-white">{title}</h3>
        <p className="mt-0.5 text-sm text-zinc-400">{description}</p>
      </div>
      <ArrowRight
        size={20}
        className="shrink-0 text-zinc-600 transition-transform group-hover:translate-x-1 group-hover:text-zinc-400"
      />
    </Link>
  );
}

function FinancialKPIWidget({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendValue,
  color = 'lime',
  href,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'lime' | 'blue' | 'orange' | 'red' | 'purple';
  href?: string;
}) {
  const colorClasses = {
    lime: 'bg-lime-500/10 text-lime-400',
    blue: 'bg-brand-green/10 text-blue-400',
    orange: 'bg-orange-500/10 text-orange-400',
    red: 'bg-red-500/10 text-red-400',
    purple: 'bg-purple-500/10 text-purple-400',
  };

  const content = (
    <div className={cn(
      'rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-all',
      href && 'hover:border-zinc-700 hover:bg-zinc-800/50 cursor-pointer'
    )}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{title}</p>
          <p className="mt-1 text-xl font-bold text-white">{value}</p>
          {(subtitle || trendValue) && (
            <div className="mt-1 flex items-center gap-2">
              {trend && trendValue && (
                <span className={cn(
                  'flex items-center text-xs font-medium',
                  trend === 'up' ? 'text-lime-400' : trend === 'down' ? 'text-red-400' : 'text-zinc-400'
                )}>
                  {trend === 'up' ? <TrendingUp size={12} className="mr-0.5" /> :
                   trend === 'down' ? <TrendingDown size={12} className="mr-0.5" /> : null}
                  {trendValue}
                </span>
              )}
              {subtitle && <span className="text-xs text-zinc-500">{subtitle}</span>}
            </div>
          )}
        </div>
        <div className={cn('rounded-lg p-2', colorClasses[color])}>
          {icon}
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

function MiniBarChart({ data, maxVal }: { data: TrendDataPoint[]; maxVal: number }) {
  return (
    <div className="flex items-end gap-1 h-32">
      {data.map((d, i) => {
        const height = maxVal > 0 ? (d.revenue / maxVal) * 100 : 0;
        return (
          <div key={d.period} className="flex-1 flex flex-col items-center group relative">
            <div
              className="w-full bg-lime-500/80 rounded-t transition-all group-hover:bg-lime-400 min-w-[4px]"
              style={{ height: `${Math.max(height, 2)}%` }}
            />
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-700 px-2 py-1 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
              {d.label}: ${d.revenue >= 1000 ? `${(d.revenue / 1000).toFixed(1)}K` : d.revenue.toFixed(0)}
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
  );
}

function InsightCard({ insight }: { insight: InsightItem }) {
  const typeStyles = {
    positive: { border: 'border-lime-500/30', bg: 'bg-lime-500/5', icon: <ArrowUpRight size={16} className="text-lime-400" /> },
    warning: { border: 'border-orange-500/30', bg: 'bg-orange-500/5', icon: <AlertTriangle size={16} className="text-orange-400" /> },
    info: { border: 'border-blue-500/30', bg: 'bg-brand-green/5', icon: <Lightbulb size={16} className="text-blue-400" /> },
    tip: { border: 'border-purple-500/30', bg: 'bg-purple-500/5', icon: <Target size={16} className="text-purple-400" /> },
  };

  const style = typeStyles[insight.type] || typeStyles.info;

  return (
    <div className={cn('rounded-lg border p-3', style.border, style.bg)}>
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0">{style.icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-white truncate">{insight.title}</h4>
            {insight.value && (
              <span className={cn(
                'shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded',
                insight.type === 'positive' ? 'bg-lime-500/20 text-lime-400' :
                insight.type === 'warning' ? 'bg-orange-500/20 text-orange-400' :
                'bg-zinc-700 text-zinc-300'
              )}>
                {insight.value}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{insight.message}</p>
        </div>
      </div>
    </div>
  );
}

// Map activity type to icon
function getActivityIcon(type: string) {
  switch (type) {
    case 'sale': return <DollarSign size={16} />;
    case 'delivery': return <Truck size={16} />;
    case 'inventory': return <Package size={16} />;
    case 'call': return <Phone size={16} />;
    case 'job': return <Calendar size={16} />;
    default: return <Package size={16} />;
  }
}

function getScheduleTypeColor(type: string) {
  switch (type) {
    case 'meeting': return 'bg-brand-green/20 text-blue-400';
    case 'job': return 'bg-lime-500/20 text-lime-400';
    case 'call': return 'bg-purple-500/20 text-purple-400';
    case 'delivery': return 'bg-orange-500/20 text-orange-400';
    default: return 'bg-zinc-500/20 text-zinc-400';
  }
}

// ============================================================================
// Helpers
// ============================================================================

function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount.toLocaleString()}`;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// ============================================================================
// Main Component
// ============================================================================

export default function CommandCenterDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = React.useState(true);
  const [financialKPIs, setFinancialKPIs] = React.useState<FinancialKPIs | null>(null);
  const [financialLoading, setFinancialLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [salesLeaderboard, setSalesLeaderboard] = React.useState<SalesLeaderEntry[]>([]);
  const [billingAlerts, setBillingAlerts] = React.useState<BillingAlertItem[]>([]);
  const [trendData, setTrendData] = React.useState<TrendDataPoint[]>([]);
  const [insights, setInsights] = React.useState<InsightItem[]>([]);
  const [insightsLoading, setInsightsLoading] = React.useState(true);
  const [meetingStats, setMeetingStats] = React.useState<MeetingStatsData | null>(null);
  const [meetingLoading, setMeetingLoading] = React.useState(true);
  // Three-boards widget — pre-fetched server data, passed in as props.
  const [unifiedBoards, setUnifiedBoards] = React.useState<
    Pick<UnifiedLeaderboardsProps, 'commission' | 'sales' | 'weekly'> | null
  >(null);

  const isAdmin = user?.role === 'owner' || user?.role === 'admin' || user?.role === 'office';
  const isOwner = user?.role === 'owner' || user?.role === 'admin';

  // Fetch dashboard stats
  React.useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/command-center/stats');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) setStats(data.data);
        }
      } catch (err) {
        console.error('Failed to fetch dashboard stats:', err);
      } finally {
        setStatsLoading(false);
      }
    }
    fetchStats();
  }, []);

  // Fetch unified leaderboards (Commission / Sales / Weekly — never combined)
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/command-center/unified-leaderboards', {
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (cancelled || !json.success || !json.data) return;
        setUnifiedBoards({
          commission: {
            ...json.data.commission,
            viewAllHref: '/command-center/meetings/present',
          },
          sales: {
            ...json.data.sales,
            viewAllHref: '/command-center/meetings/present',
          },
          weekly: {
            ...json.data.weekly,
            viewAllHref: '/portal/sales/weekly-numbers',
          },
        });
      } catch (err) {
        console.error('Failed to fetch unified leaderboards:', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Fetch sales leaderboard and billing alerts
  React.useEffect(() => {
    async function fetchSalesData() {
      try {
        const [salesRes, alertsRes] = await Promise.all([
          fetch('/api/command-center/sales?period=month'),
          fetch('/api/command-center/financial?action=alerts').catch(() => null),
        ]);

        if (salesRes.ok) {
          const data = await salesRes.json();
          if (data.success && data.data?.leaderboard) {
            setSalesLeaderboard(data.data.leaderboard);
          }
        }

        if (alertsRes?.ok) {
          const data = await alertsRes.json();
          if (data.success && Array.isArray(data.data)) {
            setBillingAlerts(data.data.slice(0, 3));
          }
        }
      } catch (err) {
        console.error('Failed to fetch sales data:', err);
      }
    }
    fetchSalesData();
  }, []);

  // Fetch financial KPIs
  React.useEffect(() => {
    async function fetchFinancialKPIs() {
      if (!isAdmin) {
        setFinancialLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/command-center/financial?action=summary');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) {
            setFinancialKPIs({
              revenueThisMonth: data.data.revenueThisMonth || 0,
              monthOverMonthGrowth: data.data.monthOverMonthGrowth || 0,
              grossMargin: data.data.grossMargin || 0,
              accountsReceivable: data.data.accountsReceivable || 0,
              overdueInvoices: data.data.overdueInvoices || 0,
              overdueAmount: data.data.overdueAmount || 0,
              netCashFlow: data.data.netCashFlow || 0,
              pipelineValue: data.data.pipelineValue || 0,
              revenueYTD: data.data.revenueYTD || 0,
              grossProfit: data.data.grossProfit || 0,
              netProfit: data.data.netProfit || 0,
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch financial KPIs:', err);
      } finally {
        setFinancialLoading(false);
      }
    }
    fetchFinancialKPIs();
  }, [isAdmin]);

  // Fetch trend data
  React.useEffect(() => {
    async function fetchTrends() {
      try {
        const res = await fetch('/api/command-center/trends?type=revenue&months=12');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data?.revenueTrend) {
            setTrendData(data.data.revenueTrend);
          }
        }
      } catch (err) {
        console.error('Failed to fetch trends:', err);
      }
    }
    fetchTrends();
  }, []);

  // Fetch insights
  React.useEffect(() => {
    async function fetchInsights() {
      try {
        const res = await fetch('/api/command-center/insights');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data?.insights) {
            setInsights(data.data.insights);
          }
        }
      } catch (err) {
        console.error('Failed to fetch insights:', err);
      } finally {
        setInsightsLoading(false);
      }
    }
    fetchInsights();
  }, []);

  // Fetch meeting numbers (sales leaderboard from Monday meetings)
  React.useEffect(() => {
    async function fetchMeetingStats() {
      try {
        const res = await fetch('/api/command-center/meetings/stats?period=month');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) {
            setMeetingStats(data.data);
          }
        }
      } catch (err) {
        console.error('Failed to fetch meeting stats:', err);
      } finally {
        setMeetingLoading(false);
      }
    }
    fetchMeetingStats();
  }, []);

  // Refresh data
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/command-center/stats', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) setStats(data.data);
      }
    } catch (err) {
      console.error('Failed to refresh stats:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const maxTrendRevenue = Math.max(...trendData.map(d => d.revenue), 1);

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-900/50 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {getGreeting()}, {user?.name.split(' ')[0]}!
            </h1>
            <p className="mt-1 text-zinc-400">
              {isOwner
                ? 'Executive overview of River City Roofing operations.'
                : 'Welcome to RoofStack HQ. Here\'s what\'s happening today.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white disabled:opacity-50"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <RoleBadge role={user?.role || 'viewer'} size="lg" showDot />
          </div>
        </div>
      </div>

      {/* Three-boards widget — Commission / Sales / Weekly (never combined) */}
      {isAdmin && (
        <UnifiedLeaderboards
          commission={unifiedBoards?.commission}
          sales={unifiedBoards?.sales}
          weekly={unifiedBoards?.weekly}
        />
      )}

      {/* Executive KPI Cards (Owner/Admin) */}
      {isAdmin && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <FinancialKPIWidget
            title="Est. Revenue MTD"
            value={financialLoading ? '--' : formatCurrency(financialKPIs?.revenueThisMonth || 0)}
            trend={financialKPIs && financialKPIs.monthOverMonthGrowth >= 0 ? 'up' : 'down'}
            trendValue={financialKPIs ? `${financialKPIs.monthOverMonthGrowth >= 0 ? '+' : ''}${financialKPIs.monthOverMonthGrowth.toFixed(1)}%` : undefined}
            subtitle="from commissions x10"
            icon={<DollarSign size={20} />}
            color="lime"
            href="/command-center/reports/financial"
          />
          <FinancialKPIWidget
            title="Est. Revenue YTD"
            value={financialLoading ? '--' : formatCurrency(financialKPIs?.revenueYTD || 0)}
            subtitle="from commissions x10"
            icon={<BarChart3 size={20} />}
            color="blue"
            href="/command-center/reports/financial"
          />
          <FinancialKPIWidget
            title="Est. Gross Margin"
            value={financialLoading ? '--' : `${(financialKPIs?.grossMargin || 0).toFixed(1)}%`}
            subtitle={financialKPIs && financialKPIs.grossMargin >= 25 ? 'Healthy' : 'Below target'}
            icon={<PieChart size={20} />}
            color={financialKPIs && financialKPIs.grossMargin >= 25 ? 'blue' : 'orange'}
            href="/command-center/reports/financial"
          />
          <FinancialKPIWidget
            title="Pipeline Value"
            value={financialLoading ? '--' : formatCurrency(financialKPIs?.pipelineValue || 0)}
            icon={<Target size={20} />}
            color="purple"
            href="/command-center/reports/financial"
          />
          <FinancialKPIWidget
            title="Cash Flow"
            value={financialLoading ? '--' : formatCurrency(financialKPIs?.netCashFlow || 0)}
            trend={financialKPIs && financialKPIs.netCashFlow >= 0 ? 'up' : 'down'}
            trendValue="This month"
            icon={<Wallet size={20} />}
            color={financialKPIs && financialKPIs.netCashFlow >= 0 ? 'lime' : 'red'}
            href="/command-center/reports/financial"
          />
        </div>
      )}

      {/* Operational Stats (visible to all) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Month-to-Date Sales"
          value={stats ? formatCurrency(stats.sales.monthTotal) : '--'}
          icon={DollarSign}
          description="estimated from commissions"
          loading={statsLoading}
        />
        <StatCard
          title="Active Jobs"
          value={stats ? stats.activeJobs.toString() : '--'}
          icon={Calendar}
          description="from JobNimbus"
          loading={statsLoading}
        />
        <StatCard
          title="Low Stock Alerts"
          value={stats ? stats.inventoryAlerts.toString() : '--'}
          icon={Package}
          description="items need attention"
          variant={stats && stats.inventoryAlerts > 0 ? 'warning' : 'default'}
          loading={statsLoading}
        />
        <StatCard
          title="Team Active"
          value={stats ? stats.teamActive.toString() : '--'}
          icon={Users}
          description="members today"
          loading={statsLoading}
        />
      </div>

      {/* Main Content: Revenue Trend + Team Performance */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue Trend (12 months) */}
        <div className="lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Commission Trend</h2>
              <p className="text-sm text-zinc-500">1099 payouts per month - last 12 months</p>
            </div>
            <Link
              href="/command-center/reports/financial"
              className="flex items-center gap-1 text-sm font-medium text-lime-400 hover:text-lime-300"
            >
              Full Report <ArrowRight size={14} />
            </Link>
          </div>
          {trendData.length > 0 ? (
            <MiniBarChart data={trendData} maxVal={maxTrendRevenue} />
          ) : (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
            </div>
          )}
          {/* Summary under chart */}
          {trendData.length >= 2 && (
            <div className="mt-4 grid grid-cols-3 gap-4 border-t border-zinc-800 pt-4">
              <div>
                <p className="text-xs text-zinc-500">This Month</p>
                <p className="text-sm font-semibold text-white">
                  {formatCurrency(trendData[trendData.length - 1]?.revenue || 0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Last Month</p>
                <p className="text-sm font-semibold text-zinc-400">
                  {formatCurrency(trendData[trendData.length - 2]?.revenue || 0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">12-Month Total</p>
                <p className="text-sm font-semibold text-lime-400">
                  {formatCurrency(trendData.reduce((s, d) => s + d.revenue, 0))}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Insights Panel */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Insights</h2>
            <Lightbulb size={18} className="text-amber-400" />
          </div>
          <div className="space-y-2 max-h-[320px] overflow-y-auto">
            {insightsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
              </div>
            ) : insights.length > 0 ? (
              insights.slice(0, 6).map(insight => (
                <InsightCard key={insight.id} insight={insight} />
              ))
            ) : (
              <p className="text-center text-sm text-zinc-500 py-4">No insights available</p>
            )}
          </div>
        </div>
      </div>

      {/* Team Performance Overview */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Commission Leaderboard - This Month</h2>
            <p className="text-sm text-zinc-500">1099 payouts from QuickBooks per rep</p>
          </div>
          <Link
            href="/command-center/sales"
            className="flex items-center gap-1 text-sm font-medium text-lime-400 hover:text-lime-300"
          >
            Full Leaderboard <ArrowRight size={14} />
          </Link>
        </div>

        {salesLeaderboard.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Rep</th>
                  <th className="px-3 py-2 text-right">Commissions</th>
                  <th className="px-3 py-2 text-right">Txns</th>
                  <th className="px-3 py-2 text-right">Avg Txn</th>
                  <th className="px-3 py-2 text-right">% of Total</th>
                  <th className="px-3 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {salesLeaderboard.slice(0, 8).map((rep) => {
                  const isTopPerformer = rep.rank <= 3;
                  const isUnderperforming = rep.percentOfTotal < 5 && salesLeaderboard.length > 3;

                  return (
                    <tr
                      key={rep.name}
                      className="border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/30"
                    >
                      <td className="px-3 py-3">
                        <span className={cn(
                          'font-bold text-sm',
                          rep.rank === 1 && 'text-amber-400',
                          rep.rank === 2 && 'text-zinc-400',
                          rep.rank === 3 && 'text-orange-400',
                          rep.rank > 3 && 'text-zinc-600'
                        )}>
                          {rep.rank}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/command-center/sales/${encodeURIComponent(rep.name.toLowerCase().replace(/\s+/g, '-'))}`}
                          className="flex items-center gap-2 hover:text-lime-400 transition-colors"
                        >
                          <div className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold',
                            rep.rank === 1 ? 'bg-amber-500/20 text-amber-400' :
                            rep.rank === 2 ? 'bg-zinc-500/20 text-zinc-300' :
                            rep.rank === 3 ? 'bg-orange-500/20 text-orange-400' :
                            'bg-zinc-700 text-zinc-400'
                          )}>
                            {rep.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <span className="font-medium text-white text-sm">{rep.name}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="font-semibold text-lime-400 text-sm">
                          {formatCurrency(rep.totalCommissions)}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right text-sm text-zinc-300">
                        {rep.transactionCount}
                      </td>
                      <td className="px-3 py-3 text-right text-sm text-zinc-300">
                        {formatCurrency(rep.avgTransaction)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-12 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-lime-500 rounded-full"
                              style={{ width: `${Math.min(rep.percentOfTotal, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-zinc-400">{rep.percentOfTotal.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        {isTopPerformer && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400">
                            <Flame size={12} /> Top
                          </span>
                        )}
                        {isUnderperforming && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-400">
                            <AlertTriangle size={12} /> Low
                          </span>
                        )}
                        {!isTopPerformer && !isUnderperforming && (
                          <span className="text-xs text-zinc-600">--</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-zinc-500">
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-zinc-500 mb-2" />
            Loading team data...
          </div>
        )}
      </div>

      {/* Sales Activity - Monday Meeting Numbers */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Sales Activity - This Month</h2>
            <p className="text-sm text-zinc-500">Monday meeting numbers (accrual-based, not commissions)</p>
          </div>
          <Link
            href="/command-center/meetings"
            className="flex items-center gap-1 text-sm font-medium text-lime-400 hover:text-lime-300"
          >
            Meeting Details <ArrowRight size={14} />
          </Link>
        </div>

        {meetingLoading ? (
          <div className="py-8 text-center text-sm text-zinc-500">
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-zinc-500 mb-2" />
            Loading meeting data...
          </div>
        ) : meetingStats ? (
          <>
            {/* Team KPI tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
              <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <DollarSign size={14} className="text-lime-400" />
                  <span className="text-xs font-medium text-zinc-500 uppercase">Revenue</span>
                </div>
                <p className="text-lg font-bold text-lime-400">
                  {formatCurrency(meetingStats.teamTotals.revenue)}
                </p>
                {meetingStats.change.commissionsPercent !== 0 && (
                  <span className={cn(
                    'text-xs font-medium',
                    meetingStats.change.commissionsPercent > 0 ? 'text-lime-400' : 'text-red-400'
                  )}>
                    {meetingStats.change.commissionsPercent > 0 ? '+' : ''}
                    {meetingStats.change.commissionsPercent.toFixed(0)}% vs last
                  </span>
                )}
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Eye size={14} className="text-blue-400" />
                  <span className="text-xs font-medium text-zinc-500 uppercase">Inspected</span>
                </div>
                <p className="text-lg font-bold text-white">{meetingStats.teamTotals.inspected}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <PenTool size={14} className="text-purple-400" />
                  <span className="text-xs font-medium text-zinc-500 uppercase">Signed</span>
                </div>
                <p className="text-lg font-bold text-white">{meetingStats.teamTotals.signed}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <CheckCircle size={14} className="text-cyan-400" />
                  <span className="text-xs font-medium text-zinc-500 uppercase">Approved</span>
                </div>
                <p className="text-lg font-bold text-white">{meetingStats.teamTotals.approved}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <AlertTriangle size={14} className="text-orange-400" />
                  <span className="text-xs font-medium text-zinc-500 uppercase">Damage</span>
                </div>
                <p className="text-lg font-bold text-white">{meetingStats.teamTotals.damage}</p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <Target size={14} className="text-amber-400" />
                  <span className="text-xs font-medium text-zinc-500 uppercase">Goal %</span>
                </div>
                <p className={cn(
                  'text-lg font-bold',
                  meetingStats.goals.monthlyProgress >= 100 ? 'text-lime-400' :
                  meetingStats.goals.monthlyProgress >= 75 ? 'text-yellow-400' :
                  'text-orange-400'
                )}>
                  {meetingStats.goals.monthlyProgress.toFixed(0)}%
                </p>
              </div>
            </div>

            {/* Rep breakdown - compact table */}
            {meetingStats.repStats.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-800 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Rep</th>
                      <th className="px-3 py-2 text-right">$$$$$ (Sales)</th>
                      <th className="px-3 py-2 text-right">Inspected</th>
                      <th className="px-3 py-2 text-right">Signed</th>
                      <th className="px-3 py-2 text-right">Approved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meetingStats.repStats.slice(0, 8).map((rep) => (
                      <tr
                        key={rep.name}
                        className="border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/30"
                      >
                        <td className="px-3 py-2">
                          <span className={cn(
                            'font-bold text-sm',
                            rep.rank === 1 && 'text-amber-400',
                            rep.rank === 2 && 'text-zinc-400',
                            rep.rank === 3 && 'text-orange-400',
                            rep.rank > 3 && 'text-zinc-600'
                          )}>
                            {rep.rank}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="font-medium text-white text-sm">{rep.name}</span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className="font-semibold text-lime-400 text-sm">
                            {formatCurrency(rep.revenue)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right text-sm text-zinc-300">
                          {rep.inspected}
                        </td>
                        <td className="px-3 py-2 text-right text-sm text-zinc-300">
                          {rep.signed}
                        </td>
                        <td className="px-3 py-2 text-right text-sm text-zinc-300">
                          {rep.approved}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <p className="py-4 text-center text-sm text-zinc-500">Meeting numbers not available</p>
        )}
      </div>

      {/* Sales Competition */}
      {salesLeaderboard.length > 0 && (
        <SalesCompetitionCard
          reps={salesLeaderboard.map(rep => ({
            name: rep.name,
            periodTotal: rep.totalCommissions,
            monthlyTotal: rep.totalCommissions,
          }))}
        />
      )}

      {/* Lead Response Time Card */}
      {isAdmin && <ResponseTimeDashboard variant="compact" />}

      {/* Quick Actions + Activity */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Actions */}
        <div className="lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Quick Actions</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <QuickActionCard
              title="Sales Leaderboard"
              description="View team rankings and performance"
              href="/command-center/sales"
              icon={<TrendingUp size={24} />}
              color="lime"
            />
            <QuickActionCard
              title="Financial Reports"
              description="Revenue, margins, and cash flow"
              href="/command-center/reports/financial"
              icon={<BarChart3 size={24} />}
              color="blue"
            />
            <QuickActionCard
              title="Check Materials"
              description={stats && stats.inventoryAlerts > 0 ? `${stats.inventoryAlerts} alerts` : 'View stock levels'}
              href="/command-center/inventory"
              icon={<Package size={24} />}
              color="purple"
            />
            <QuickActionCard
              title="View Schedule"
              description={stats ? `${stats.scheduledToday} events today` : "Today's jobs"}
              href="/command-center/schedule"
              icon={<Calendar size={24} />}
              color="orange"
            />
            {isOwner && (
              <>
                <QuickActionCard
                  title="Finance"
                  description="Invoices and billing management"
                  href="/command-center/billing"
                  icon={<CreditCard size={24} />}
                  color="cyan"
                />
                <QuickActionCard
                  title="Phone System"
                  description="Call logs and voicemails"
                  href="/command-center/phone"
                  icon={<Phone size={24} />}
                  color="red"
                />
              </>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Recent Activity</h2>
          <div className="space-y-4">
            {statsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
              </div>
            ) : stats && stats.recentActivity.length > 0 ? (
              stats.recentActivity.map((activity, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    activity.type === 'inventory' ? 'bg-orange-500/10' :
                    activity.type === 'delivery' ? 'bg-brand-green/10' :
                    activity.type === 'sale' ? 'bg-lime-500/10' : 'bg-zinc-500/10'
                  )}>
                    <span className={activity.color || 'text-zinc-400'}>
                      {getActivityIcon(activity.type)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">{activity.text}</p>
                    <p className="text-xs text-zinc-500">{activity.detail}</p>
                  </div>
                  <span className="shrink-0 text-xs text-zinc-600">{activity.time}</span>
                </div>
              ))
            ) : (
              <p className="py-4 text-center text-sm text-zinc-500">No recent activity</p>
            )}
          </div>
          <Link
            href="/command-center/reports"
            className="mt-4 flex items-center gap-1 text-sm font-medium text-lime-400 hover:text-lime-300"
          >
            View all activity <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {/* Alerts Section */}
      {stats && stats.inventoryAlerts > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 shrink-0 text-amber-400" size={20} />
            <div>
              <h3 className="font-medium text-amber-400">Attention Required</h3>
              <p className="mt-1 text-sm text-zinc-400">
                You have <span className="font-semibold text-white">{stats.inventoryAlerts} low stock items</span> that need attention.
                {stats.scheduledToday > 0 && (
                  <> Also, <span className="font-semibold text-white">{stats.scheduledToday} events</span> are scheduled for today.</>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Financial Alerts (Admin/Owner) */}
      {isAdmin && billingAlerts.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Financial Alerts</h2>
            <Link href="/command-center/reports/financial" className="flex items-center gap-1 text-sm font-medium text-lime-400 hover:text-lime-300">
              View all <ArrowRight size={16} />
            </Link>
          </div>
          <div className="space-y-3">
            {billingAlerts.map((alert, idx) => (
              <div
                key={idx}
                className={cn(
                  'rounded-lg border p-4',
                  alert.severity === 'critical' ? 'border-red-500/30 bg-red-500/5' :
                  alert.severity === 'warning' ? 'border-orange-500/30 bg-orange-500/5' :
                  'border-blue-500/30 bg-brand-green/5'
                )}
              >
                <div className="flex items-start gap-3">
                  <AlertCircle
                    size={18}
                    className={
                      alert.severity === 'critical' ? 'text-red-400' :
                      alert.severity === 'warning' ? 'text-orange-400' :
                      'text-blue-400'
                    }
                  />
                  <div className="flex-1">
                    <p className="font-medium text-white text-sm">{alert.title}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{alert.description}</p>
                    {alert.amount && (
                      <p className="text-xs font-medium text-zinc-300 mt-1">
                        Amount: {formatCurrency(alert.amount)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's Schedule */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Today&apos;s Schedule</h2>
          <Link
            href="/command-center/schedule"
            className="flex items-center gap-1 text-sm font-medium text-lime-400 hover:text-lime-300"
          >
            View full schedule <ArrowRight size={16} />
          </Link>
        </div>
        <div className="space-y-3">
          {statsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
            </div>
          ) : stats && stats.todaySchedule.length > 0 ? (
            stats.todaySchedule.map((event, idx) => (
              <div
                key={idx}
                className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-800/30 p-3"
              >
                <div className="flex items-center gap-2 text-zinc-500">
                  <Clock size={14} />
                  <span className="text-sm font-medium">{event.time}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{event.title}</p>
                </div>
                <span className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                  getScheduleTypeColor(event.type)
                )}>
                  {event.type}
                </span>
              </div>
            ))
          ) : (
            <p className="py-4 text-center text-sm text-zinc-500">No events scheduled for today</p>
          )}
        </div>
      </div>

      {/* Sheets Health Monitor (Owner) */}
      {isOwner && <SheetsHealthWidget />}

      {/* Quick Links Footer (Owner) */}
      {isOwner && (
        <div className="grid gap-3 sm:grid-cols-4">
          <Link
            href="/portal/billing"
            className="group flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-800/50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-lime-500/10 text-lime-400">
              <DollarSign size={20} />
            </div>
            <div>
              <p className="font-medium text-white text-sm">Billing</p>
              <p className="text-xs text-zinc-500">Invoices</p>
            </div>
          </Link>
          <Link
            href="/command-center/billing/breakdowns"
            className="group flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-800/50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-green/10 text-blue-400">
              <FileText size={20} />
            </div>
            <div>
              <p className="font-medium text-white text-sm">Breakdowns</p>
              <p className="text-xs text-zinc-500">Job invoices</p>
            </div>
          </Link>
          <Link
            href="/command-center/reports/financial"
            className="group flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-800/50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
              <PieChart size={20} />
            </div>
            <div>
              <p className="font-medium text-white text-sm">Financials</p>
              <p className="text-xs text-zinc-500">Revenue & margins</p>
            </div>
          </Link>
          <Link
            href="/command-center/team"
            className="group flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-800/50"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
              <Users size={20} />
            </div>
            <div>
              <p className="font-medium text-white text-sm">Team</p>
              <p className="text-xs text-zinc-500">Manage team</p>
            </div>
          </Link>
        </div>
      )}

      {/* Last Updated Footer */}
      {stats && stats.lastUpdated && (
        <p className="text-center text-xs text-zinc-600">
          Last updated: {new Date(stats.lastUpdated).toLocaleString()}
        </p>
      )}
    </div>
  );
}
