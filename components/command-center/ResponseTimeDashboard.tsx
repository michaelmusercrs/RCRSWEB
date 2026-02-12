'use client';

/**
 * Response Time Dashboard Component
 *
 * Displays lead response time analytics with:
 * - Big number average response time
 * - Response time by rep (CSS bar chart)
 * - 12-week trend line (CSS visualization)
 * - Best/worst performers
 * - Goal indicators (green < 5min, yellow 5-15, red > 15)
 * - Pipeline stage timing
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Clock,
  TrendingUp,
  TrendingDown,
  Users,
  Zap,
  AlertTriangle,
  Trophy,
  ArrowRight,
  Loader2,
  Timer,
  Target,
  Activity,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types (matching API response)
// ---------------------------------------------------------------------------

interface RepResponseSummary {
  repSlug: string;
  repName: string;
  avgMinutes: number;
  medianMinutes: number;
  fastestMinutes: number;
  slowestMinutes: number;
  totalLeads: number;
  respondedLeads: number;
  missedLeads: number;
  under5Min: number;
  under15Min: number;
  over60Min: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

interface WeeklyTrendPoint {
  weekLabel: string;
  weekStart: string;
  avgMinutes: number;
  totalLeads: number;
  respondedLeads: number;
}

interface PipelineStageTime {
  stage: string;
  label: string;
  avgDays: number;
  medianDays: number;
  sampleSize: number;
}

interface ResponseTimeAnalytics {
  overallAvgMinutes: number;
  overallMedianMinutes: number;
  overallFastestMinutes: number;
  overallSlowestMinutes: number;
  totalLeadsAnalyzed: number;
  totalResponded: number;
  totalMissed: number;
  responseRate: number;
  byRep: RepResponseSummary[];
  weeklyTrend: WeeklyTrendPoint[];
  monthlyBreakdown: Array<{
    month: string;
    monthLabel: string;
    avgMinutes: number;
    medianMinutes: number;
    totalLeads: number;
    respondedLeads: number;
  }>;
  pipelineStages: PipelineStageTime[];
  dataSource: string;
  lastUpdated: string;
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '--';
  if (minutes < 1) return `${Math.round(minutes * 60)}s`;
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function getResponseColor(minutes: number): string {
  if (minutes <= 0) return 'text-zinc-500';
  if (minutes <= 5) return 'text-lime-400';
  if (minutes <= 15) return 'text-yellow-400';
  if (minutes <= 30) return 'text-orange-400';
  return 'text-red-400';
}

function getResponseBg(minutes: number): string {
  if (minutes <= 0) return 'bg-zinc-700';
  if (minutes <= 5) return 'bg-lime-500';
  if (minutes <= 15) return 'bg-yellow-500';
  if (minutes <= 30) return 'bg-orange-500';
  return 'bg-red-500';
}

function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A': return 'text-lime-400 bg-lime-500/15';
    case 'B': return 'text-yellow-400 bg-yellow-500/15';
    case 'C': return 'text-orange-400 bg-orange-500/15';
    case 'D': return 'text-red-400 bg-red-500/15';
    case 'F': return 'text-red-500 bg-red-500/15';
    default: return 'text-zinc-500 bg-zinc-700';
  }
}

function getGoalIndicator(minutes: number): { label: string; color: string; bg: string } {
  if (minutes <= 0) return { label: 'No Data', color: 'text-zinc-500', bg: 'bg-zinc-700/50' };
  if (minutes <= 5) return { label: 'Excellent', color: 'text-lime-400', bg: 'bg-lime-500/10' };
  if (minutes <= 15) return { label: 'Good', color: 'text-yellow-400', bg: 'bg-yellow-500/10' };
  if (minutes <= 30) return { label: 'Needs Improvement', color: 'text-orange-400', bg: 'bg-orange-500/10' };
  return { label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/10' };
}

// ---------------------------------------------------------------------------
// Sub-Components
// ---------------------------------------------------------------------------

function BigNumberCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">{title}</p>
          <p className={cn('mt-1 text-2xl font-bold', color)}>{value}</p>
          {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
        </div>
        <div className={cn('rounded-lg p-2', color.replace('text-', 'bg-').replace('400', '500/15').replace('500', '500/15'))}>
          <Icon size={20} className={color} />
        </div>
      </div>
    </div>
  );
}

function RepBarChart({ reps }: { reps: RepResponseSummary[] }) {
  const maxMinutes = Math.max(...reps.map(r => r.avgMinutes).filter(m => m > 0), 60);

  return (
    <div className="space-y-2">
      {reps.slice(0, 10).map((rep) => {
        const width = rep.avgMinutes > 0
          ? Math.min((rep.avgMinutes / maxMinutes) * 100, 100)
          : 0;

        return (
          <div key={rep.repSlug} className="group">
            <div className="flex items-center justify-between mb-0.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn(
                  'inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold',
                  getGradeColor(rep.grade)
                )}>
                  {rep.grade}
                </span>
                <span className="text-sm font-medium text-white truncate">
                  {rep.repName}
                </span>
              </div>
              <span className={cn('text-sm font-semibold tabular-nums', getResponseColor(rep.avgMinutes))}>
                {formatMinutes(rep.avgMinutes)}
              </span>
            </div>
            <div className="relative h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className={cn(
                  'absolute left-0 top-0 h-full rounded-full transition-all duration-500',
                  getResponseBg(rep.avgMinutes)
                )}
                style={{ width: `${Math.max(width, 2)}%` }}
              />
              {/* Goal line at 5 minutes */}
              <div
                className="absolute top-0 h-full w-px bg-lime-400/40"
                style={{ left: `${Math.min((5 / maxMinutes) * 100, 100)}%` }}
              />
              {/* Warning line at 15 minutes */}
              <div
                className="absolute top-0 h-full w-px bg-yellow-400/40"
                style={{ left: `${Math.min((15 / maxMinutes) * 100, 100)}%` }}
              />
            </div>
            {/* Tooltip on hover */}
            <div className="hidden group-hover:flex items-center gap-3 mt-1 text-[10px] text-zinc-500">
              <span>{rep.respondedLeads}/{rep.totalLeads} responded</span>
              <span>Fastest: {formatMinutes(rep.fastestMinutes)}</span>
              <span>Slowest: {formatMinutes(rep.slowestMinutes)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TrendLine({ data }: { data: WeeklyTrendPoint[] }) {
  if (data.length === 0) return null;

  const maxVal = Math.max(...data.map(d => d.avgMinutes).filter(v => v > 0), 30);
  const height = 120;

  // Build SVG polyline points
  const points = data.map((d, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * 100 : 50;
    const y = d.avgMinutes > 0
      ? 100 - ((d.avgMinutes / maxVal) * 90) // Leave 10% padding at top
      : 100;
    return `${x},${y}`;
  }).join(' ');

  // Check if trend is improving (last 4 weeks declining)
  const recentData = data.slice(-4).filter(d => d.avgMinutes > 0);
  const isImproving = recentData.length >= 2 &&
    recentData[recentData.length - 1].avgMinutes < recentData[0].avgMinutes;

  return (
    <div className="relative">
      {/* Trend indicator */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-zinc-500">Last {data.length} weeks</p>
        {recentData.length >= 2 && (
          <span className={cn(
            'flex items-center gap-1 text-xs font-medium',
            isImproving ? 'text-lime-400' : 'text-red-400'
          )}>
            {isImproving ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
            {isImproving ? 'Improving' : 'Getting slower'}
          </span>
        )}
      </div>

      {/* SVG Chart */}
      <div className="relative" style={{ height: `${height}px` }}>
        {/* Goal zone background */}
        <div
          className="absolute left-0 right-0 bg-lime-500/5 border-b border-lime-500/20"
          style={{
            bottom: `${100 - ((5 / maxVal) * 90)}%`,
            height: `${(5 / maxVal) * 90}%`,
          }}
        />

        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full"
        >
          {/* 5-min goal line */}
          <line
            x1="0"
            y1={String(100 - (5 / maxVal) * 90)}
            x2="100"
            y2={String(100 - (5 / maxVal) * 90)}
            stroke="rgb(132, 204, 22)"
            strokeWidth="0.3"
            strokeDasharray="2,2"
            opacity="0.4"
          />
          {/* 15-min warning line */}
          <line
            x1="0"
            y1={String(100 - (15 / maxVal) * 90)}
            x2="100"
            y2={String(100 - (15 / maxVal) * 90)}
            stroke="rgb(234, 179, 8)"
            strokeWidth="0.3"
            strokeDasharray="2,2"
            opacity="0.3"
          />
          {/* Trend line */}
          <polyline
            points={points}
            fill="none"
            stroke="rgb(57, 255, 20)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Data points */}
          {data.map((d, i) => {
            const x = data.length > 1 ? (i / (data.length - 1)) * 100 : 50;
            const y = d.avgMinutes > 0
              ? 100 - ((d.avgMinutes / maxVal) * 90)
              : 100;
            return (
              <circle
                key={d.weekStart}
                cx={String(x)}
                cy={String(y)}
                r="1.5"
                fill={d.avgMinutes > 0 ? 'rgb(57, 255, 20)' : 'rgb(113, 113, 122)'}
                className="hover:r-3 transition-all"
              />
            );
          })}
        </svg>

        {/* X-axis labels */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between">
          {data.length > 0 && (
            <>
              <span className="text-[9px] text-zinc-600">{data[0].weekLabel}</span>
              {data.length > 4 && (
                <span className="text-[9px] text-zinc-600">
                  {data[Math.floor(data.length / 2)].weekLabel}
                </span>
              )}
              <span className="text-[9px] text-zinc-600">{data[data.length - 1].weekLabel}</span>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 text-[10px] text-zinc-600">
        <span className="flex items-center gap-1">
          <div className="w-3 h-px bg-lime-500/40" /> 5 min goal
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-px bg-yellow-500/30" /> 15 min warning
        </span>
      </div>
    </div>
  );
}

function PipelineTimeline({ stages }: { stages: PipelineStageTime[] }) {
  if (stages.length === 0) return null;

  return (
    <div className="space-y-3">
      {stages.filter(s => s.stage !== 'full_pipeline').map((stage, i) => (
        <div key={stage.stage} className="flex items-center gap-3">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-zinc-400">
            {i + 1}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-zinc-300 truncate">{stage.label}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-white">{stage.avgDays.toFixed(1)}d</p>
            <p className="text-[10px] text-zinc-500">avg</p>
          </div>
          {i < stages.filter(s => s.stage !== 'full_pipeline').length - 1 && (
            <ArrowRight size={12} className="text-zinc-700 shrink-0" />
          )}
        </div>
      ))}
      {/* Full pipeline summary */}
      {stages.find(s => s.stage === 'full_pipeline') && (
        <div className="mt-2 pt-2 border-t border-zinc-800 flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-400">Total Pipeline</span>
          <span className="text-sm font-bold text-lime-400">
            {stages.find(s => s.stage === 'full_pipeline')!.avgDays.toFixed(1)} days avg
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface ResponseTimeDashboardProps {
  variant?: 'full' | 'card' | 'compact';
}

export function ResponseTimeDashboard({ variant = 'full' }: ResponseTimeDashboardProps) {
  const [analytics, setAnalytics] = React.useState<ResponseTimeAnalytics | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/analytics/response-times');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.success && json.data) {
          setAnalytics(json.data);
        } else {
          setError(json.error || 'Failed to load data');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className={cn(
        'rounded-xl border border-zinc-800 bg-zinc-900 p-6',
        variant === 'compact' && 'p-4'
      )}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
          <span className="ml-2 text-sm text-zinc-500">Loading response times...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-400" />
          <p className="text-sm text-red-400">Response time data unavailable: {error}</p>
        </div>
      </div>
    );
  }

  // No data state
  if (!analytics || analytics.totalLeadsAnalyzed === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800">
            <Clock size={20} className="text-zinc-500" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Lead Response Times</h3>
            <p className="text-sm text-zinc-500">
              No data yet - response times will appear as leads are processed
            </p>
          </div>
        </div>
      </div>
    );
  }

  const goal = getGoalIndicator(analytics.overallAvgMinutes);

  // ---------- COMPACT variant (for embedding in other pages) ----------
  if (variant === 'compact') {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Timer size={16} className="text-lime-400" />
            <h3 className="text-sm font-semibold text-white">Response Time</h3>
          </div>
          <span className={cn('text-xs font-medium px-2 py-0.5 rounded', goal.bg, goal.color)}>
            {goal.label}
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className={cn('text-3xl font-bold tabular-nums', getResponseColor(analytics.overallAvgMinutes))}>
            {formatMinutes(analytics.overallAvgMinutes)}
          </span>
          <span className="text-xs text-zinc-500">avg response</span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-zinc-500">Median</p>
            <p className="text-sm font-semibold text-white">{formatMinutes(analytics.overallMedianMinutes)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Rate</p>
            <p className="text-sm font-semibold text-white">{analytics.responseRate}%</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Leads</p>
            <p className="text-sm font-semibold text-white">{analytics.totalLeadsAnalyzed}</p>
          </div>
        </div>

        {/* Mini bar for top 3 reps */}
        {analytics.byRep.length > 0 && (
          <div className="mt-3 pt-3 border-t border-zinc-800 space-y-1.5">
            {analytics.byRep.slice(0, 3).map((rep) => (
              <div key={rep.repSlug} className="flex items-center justify-between">
                <span className="text-xs text-zinc-400 truncate max-w-[60%]">{rep.repName}</span>
                <span className={cn('text-xs font-semibold tabular-nums', getResponseColor(rep.avgMinutes))}>
                  {formatMinutes(rep.avgMinutes)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---------- CARD variant (medium, for command center grid) ----------
  if (variant === 'card') {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-lime-500/10">
              <Timer size={20} className="text-lime-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Lead Response Times</h3>
              <p className="text-xs text-zinc-500">{analytics.totalLeadsAnalyzed} leads analyzed</p>
            </div>
          </div>
          <span className={cn('text-xs font-medium px-2 py-1 rounded-lg', goal.bg, goal.color)}>
            {goal.label}
          </span>
        </div>

        {/* Big number */}
        <div className="mb-4 flex items-baseline gap-3">
          <span className={cn('text-4xl font-bold tabular-nums', getResponseColor(analytics.overallAvgMinutes))}>
            {formatMinutes(analytics.overallAvgMinutes)}
          </span>
          <span className="text-sm text-zinc-500">avg response time</span>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="text-center">
            <p className="text-xs text-zinc-500">Median</p>
            <p className="text-sm font-semibold text-white">{formatMinutes(analytics.overallMedianMinutes)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-zinc-500">Fastest</p>
            <p className="text-sm font-semibold text-lime-400">{formatMinutes(analytics.overallFastestMinutes)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-zinc-500">Response Rate</p>
            <p className="text-sm font-semibold text-white">{analytics.responseRate}%</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-zinc-500">Missed</p>
            <p className={cn('text-sm font-semibold', analytics.totalMissed > 0 ? 'text-red-400' : 'text-zinc-400')}>
              {analytics.totalMissed}
            </p>
          </div>
        </div>

        {/* Rep rankings */}
        {analytics.byRep.length > 0 && (
          <div className="border-t border-zinc-800 pt-4">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">By Rep</p>
            <RepBarChart reps={analytics.byRep} />
          </div>
        )}

        {/* Weekly trend */}
        {analytics.weeklyTrend.length > 0 && (
          <div className="border-t border-zinc-800 pt-4 mt-4">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">12-Week Trend</p>
            <TrendLine data={analytics.weeklyTrend} />
          </div>
        )}
      </div>
    );
  }

  // ---------- FULL variant (standalone dashboard section) ----------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-lime-500/10">
            <Timer size={20} className="text-lime-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Lead Response Time Analytics</h2>
            <p className="text-sm text-zinc-500">
              {analytics.totalLeadsAnalyzed} leads analyzed from {analytics.dataSource}
            </p>
          </div>
        </div>
        <span className={cn(
          'flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg',
          goal.bg, goal.color
        )}>
          <Target size={14} />
          {goal.label}
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <BigNumberCard
          title="Avg Response Time"
          value={formatMinutes(analytics.overallAvgMinutes)}
          subtitle="across all reps"
          icon={Clock}
          color={getResponseColor(analytics.overallAvgMinutes)}
        />
        <BigNumberCard
          title="Median Response"
          value={formatMinutes(analytics.overallMedianMinutes)}
          subtitle="50th percentile"
          icon={Activity}
          color={getResponseColor(analytics.overallMedianMinutes)}
        />
        <BigNumberCard
          title="Response Rate"
          value={`${analytics.responseRate}%`}
          subtitle={`${analytics.totalResponded} of ${analytics.totalLeadsAnalyzed} leads`}
          icon={Zap}
          color={analytics.responseRate >= 90 ? 'text-lime-400' : analytics.responseRate >= 70 ? 'text-yellow-400' : 'text-red-400'}
        />
        <BigNumberCard
          title="Fastest Response"
          value={formatMinutes(analytics.overallFastestMinutes)}
          subtitle="best single response"
          icon={Trophy}
          color="text-lime-400"
        />
      </div>

      {/* Goal indicator bar */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">Response Time Goal</p>
        <div className="relative h-3 rounded-full bg-zinc-800 overflow-hidden">
          {/* Goal zones */}
          <div className="absolute left-0 top-0 h-full bg-lime-500/30" style={{ width: '16.7%' }} />
          <div className="absolute left-[16.7%] top-0 h-full bg-yellow-500/20" style={{ width: '33.3%' }} />
          <div className="absolute left-[50%] top-0 h-full bg-orange-500/15" style={{ width: '25%' }} />
          <div className="absolute left-[75%] top-0 h-full bg-red-500/10" style={{ width: '25%' }} />

          {/* Current position marker */}
          {analytics.overallAvgMinutes > 0 && (
            <div
              className="absolute top-[-4px] h-[calc(100%+8px)] w-1 bg-white rounded-full shadow-lg shadow-white/20"
              style={{
                left: `${Math.min((analytics.overallAvgMinutes / 60) * 100, 98)}%`,
              }}
            />
          )}
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-zinc-600">
          <span>0m</span>
          <span className="text-lime-500/60">5m</span>
          <span className="text-yellow-500/60">15m</span>
          <span className="text-orange-500/60">30m</span>
          <span className="text-red-500/60">60m+</span>
        </div>
      </div>

      {/* Main content: Rep breakdown + Trend */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Rep Breakdown */}
        <div className="lg:col-span-2 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-white">Response Time by Rep</h3>
              <p className="text-xs text-zinc-500">Sorted by fastest average response</p>
            </div>
            <Users size={18} className="text-zinc-600" />
          </div>
          {analytics.byRep.length > 0 ? (
            <RepBarChart reps={analytics.byRep} />
          ) : (
            <p className="text-sm text-zinc-500 text-center py-4">No per-rep data available</p>
          )}

          {/* Best/Worst performers */}
          {analytics.byRep.length >= 2 && (
            <div className="mt-4 pt-4 border-t border-zinc-800 grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-lime-500/20 bg-lime-500/5 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Trophy size={14} className="text-lime-400" />
                  <span className="text-xs font-medium text-lime-400">Best Performer</span>
                </div>
                <p className="text-sm font-semibold text-white">
                  {analytics.byRep[0].repName}
                </p>
                <p className="text-xs text-zinc-400">
                  {formatMinutes(analytics.byRep[0].avgMinutes)} avg ({analytics.byRep[0].respondedLeads} leads)
                </p>
              </div>
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={14} className="text-red-400" />
                  <span className="text-xs font-medium text-red-400">Needs Improvement</span>
                </div>
                <p className="text-sm font-semibold text-white">
                  {analytics.byRep[analytics.byRep.length - 1].repName}
                </p>
                <p className="text-xs text-zinc-400">
                  {formatMinutes(analytics.byRep[analytics.byRep.length - 1].avgMinutes)} avg (
                  {analytics.byRep[analytics.byRep.length - 1].respondedLeads} leads)
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Trend + Pipeline */}
        <div className="space-y-6">
          {/* Weekly Trend */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">Response Trend</h3>
              <TrendingUp size={18} className="text-zinc-600" />
            </div>
            {analytics.weeklyTrend.length > 0 ? (
              <TrendLine data={analytics.weeklyTrend} />
            ) : (
              <p className="text-sm text-zinc-500 text-center py-4">
                Trend data will appear after 2+ weeks of tracking
              </p>
            )}
          </div>

          {/* Pipeline Stages */}
          {analytics.pipelineStages.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">Pipeline Stages</h3>
                <Activity size={18} className="text-zinc-600" />
              </div>
              <PipelineTimeline stages={analytics.pipelineStages} />
              <p className="mt-3 text-[10px] text-zinc-600">
                Based on {analytics.pipelineStages[0]?.sampleSize || 0} commission transactions
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Data source footer */}
      <p className="text-center text-xs text-zinc-600">
        Data sources: {analytics.dataSource} | Updated: {new Date(analytics.lastUpdated).toLocaleString()}
      </p>
    </div>
  );
}

export default ResponseTimeDashboard;
