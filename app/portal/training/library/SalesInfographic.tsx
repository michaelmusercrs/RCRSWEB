'use client';

import { TrendingUp, Trophy, Target, BarChart3, Users, Zap } from 'lucide-react';

// ---------------------------------------------------------------------------
// Sample RCRS sales performance data for the infographic
// ---------------------------------------------------------------------------

const repData = [
  { name: 'James W.', totalRevenue: 287500, inspections: 48, closed: 22, convRate: 45.8 },
  { name: 'Marcus T.', totalRevenue: 245000, inspections: 52, closed: 20, convRate: 38.5 },
  { name: 'David R.', totalRevenue: 198000, inspections: 38, closed: 16, convRate: 42.1 },
  { name: 'Sarah K.', totalRevenue: 176500, inspections: 42, closed: 15, convRate: 35.7 },
  { name: 'Chris M.', totalRevenue: 152000, inspections: 35, closed: 12, convRate: 34.3 },
  { name: 'Tyler B.', totalRevenue: 134500, inspections: 30, closed: 11, convRate: 36.7 },
];

const teamGoals = {
  monthlyRevenueTarget: 250000,
  monthlyRevenueCurrent: 198500,
  weeklyInspectionTarget: 10,
  conversionTarget: 40,
  speedToLeadTarget: 30,
};

const monthlyTrend = [
  { month: 'Sep', revenue: 165000, inspections: 180 },
  { month: 'Oct', revenue: 210000, inspections: 220 },
  { month: 'Nov', revenue: 185000, inspections: 195 },
  { month: 'Dec', revenue: 142000, inspections: 155 },
  { month: 'Jan', revenue: 198500, inspections: 245 },
  { month: 'Feb', revenue: 215000, inspections: 260 },
];

const maxRevenue = Math.max(...repData.map(r => r.totalRevenue));
const maxMonthlyRev = Math.max(...monthlyTrend.map(m => m.revenue));
const maxMonthlyInsp = Math.max(...monthlyTrend.map(m => m.inspections));

function formatCurrency(val: number): string {
  if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
  return `$${val}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SalesInfographic() {
  const totalTeamRevenue = repData.reduce((sum, r) => sum + r.totalRevenue, 0);
  const totalInspections = repData.reduce((sum, r) => sum + r.inspections, 0);
  const totalClosed = repData.reduce((sum, r) => sum + r.closed, 0);
  const avgConvRate = totalInspections > 0 ? ((totalClosed / totalInspections) * 100).toFixed(1) : '0';
  const avgDealSize = totalClosed > 0 ? Math.round(totalTeamRevenue / totalClosed) : 0;
  const goalProgress = Math.min(100, Math.round((teamGoals.monthlyRevenueCurrent / teamGoals.monthlyRevenueTarget) * 100));

  return (
    <div className="p-6 sm:p-8 space-y-8">
      {/* Title */}
      <div className="text-center">
        <h3 className="text-2xl font-bold text-white mb-1">RCRS Sales Performance Dashboard</h3>
        <p className="text-sm text-neutral-400">Team metrics, leaderboard, and trend analysis</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Revenue', value: formatCurrency(totalTeamRevenue), icon: TrendingUp, color: 'text-brand-green', bg: 'bg-brand-green/10 border-brand-green/20' },
          { label: 'Inspections', value: totalInspections.toString(), icon: Target, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
          { label: 'Avg Conv Rate', value: `${avgConvRate}%`, icon: BarChart3, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
          { label: 'Avg Deal Size', value: formatCurrency(avgDealSize), icon: Zap, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className={`rounded-xl border p-4 ${kpi.bg}`}>
              <Icon size={18} className={`${kpi.color} mb-2`} />
              <p className="text-xl font-bold text-white">{kpi.value}</p>
              <p className="text-xs text-neutral-400 mt-0.5">{kpi.label}</p>
            </div>
          );
        })}
      </div>

      {/* Monthly Revenue Goal Progress */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Trophy size={18} className="text-brand-green" />
            <span className="text-sm font-semibold text-white">Monthly Revenue Goal</span>
          </div>
          <span className="text-sm text-neutral-400">
            {formatCurrency(teamGoals.monthlyRevenueCurrent)} / {formatCurrency(teamGoals.monthlyRevenueTarget)}
          </span>
        </div>
        <div className="h-4 rounded-full bg-neutral-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              goalProgress >= 100
                ? 'bg-gradient-to-r from-brand-green to-emerald-400'
                : goalProgress >= 75
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-400'
                  : goalProgress >= 50
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                    : 'bg-gradient-to-r from-red-500 to-orange-400'
            }`}
            style={{ width: `${goalProgress}%` }}
          />
        </div>
        <p className="text-right text-xs text-neutral-500 mt-1">{goalProgress}% of target</p>
      </div>

      {/* Team Leaderboard */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users size={18} className="text-brand-green" />
          <span className="text-sm font-semibold text-white">Team Leaderboard — Total Revenue</span>
        </div>
        <div className="space-y-3">
          {repData.map((rep, idx) => {
            const barWidth = maxRevenue > 0 ? (rep.totalRevenue / maxRevenue) * 100 : 0;
            const medal = idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-neutral-300' : idx === 2 ? 'text-amber-600' : 'text-neutral-600';
            return (
              <div key={rep.name}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold w-5 text-right ${medal}`}>{idx + 1}</span>
                    <span className="text-sm text-white font-medium">{rep.name}</span>
                  </div>
                  <span className="text-sm text-neutral-300 font-mono">{formatCurrency(rep.totalRevenue)}</span>
                </div>
                <div className="h-3 rounded-full bg-neutral-800 overflow-hidden ml-7">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-green/80 to-emerald-500/80 transition-all duration-700"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Conversion Rate Comparison */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={18} className="text-amber-400" />
          <span className="text-sm font-semibold text-white">Conversion Rate by Rep</span>
        </div>
        <div className="space-y-3">
          {[...repData]
            .sort((a, b) => b.convRate - a.convRate)
            .map((rep) => {
              const isAboveTarget = rep.convRate >= teamGoals.conversionTarget;
              return (
                <div key={rep.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-white font-medium">{rep.name}</span>
                    <span className={`text-sm font-mono font-semibold ${isAboveTarget ? 'text-brand-green' : 'text-amber-400'}`}>
                      {rep.convRate}%
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-neutral-800 overflow-hidden relative">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        isAboveTarget
                          ? 'bg-gradient-to-r from-brand-green/80 to-emerald-500/80'
                          : 'bg-gradient-to-r from-amber-500/80 to-yellow-500/80'
                      }`}
                      style={{ width: `${rep.convRate}%` }}
                    />
                    {/* Target line */}
                    <div
                      className="absolute top-0 h-full w-0.5 bg-white/30"
                      style={{ left: `${teamGoals.conversionTarget}%` }}
                      title={`Target: ${teamGoals.conversionTarget}%`}
                    />
                  </div>
                </div>
              );
            })}
          <div className="flex items-center gap-2 mt-2 text-xs text-neutral-500">
            <div className="w-3 h-0.5 bg-white/30" />
            <span>Target: {teamGoals.conversionTarget}%</span>
          </div>
        </div>
      </div>

      {/* Monthly Inspections */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Target size={18} className="text-blue-400" />
          <span className="text-sm font-semibold text-white">Monthly Inspections & Revenue Trend</span>
        </div>
        <div className="space-y-3">
          {monthlyTrend.map((m) => {
            const revWidth = maxMonthlyRev > 0 ? (m.revenue / maxMonthlyRev) * 100 : 0;
            const inspWidth = maxMonthlyInsp > 0 ? (m.inspections / maxMonthlyInsp) * 100 : 0;
            return (
              <div key={m.month}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-white font-medium w-8">{m.month}</span>
                  <div className="flex items-center gap-4 text-xs text-neutral-400">
                    <span>{m.inspections} inspections</span>
                    <span className="font-mono">{formatCurrency(m.revenue)}</span>
                  </div>
                </div>
                <div className="space-y-1 ml-8">
                  <div className="h-2.5 rounded-full bg-neutral-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500/80 to-cyan-400/80 transition-all duration-700"
                      style={{ width: `${inspWidth}%` }}
                    />
                  </div>
                  <div className="h-2.5 rounded-full bg-neutral-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-green/80 to-emerald-400/80 transition-all duration-700"
                      style={{ width: `${revWidth}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
          <div className="flex items-center gap-4 mt-2 text-xs text-neutral-500 ml-8">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-blue-500/80" />
              <span>Inspections</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-brand-green/80" />
              <span>Revenue</span>
            </div>
          </div>
        </div>
      </div>

      {/* Key Insights */}
      <div className="rounded-xl border border-brand-green/20 bg-brand-green/5 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={18} className="text-brand-green" />
          <span className="text-sm font-semibold text-brand-green">Key Insights</span>
        </div>
        <ul className="space-y-2">
          {[
            `Top performer (${repData[0].name}) leads with ${formatCurrency(repData[0].totalRevenue)} in revenue and a ${repData[0].convRate}% conversion rate.`,
            `Team average conversion rate is ${avgConvRate}% — ${Number(avgConvRate) >= teamGoals.conversionTarget ? 'above' : 'below'} the ${teamGoals.conversionTarget}% target.`,
            `${repData.filter(r => r.convRate >= teamGoals.conversionTarget).length} of ${repData.length} reps are meeting the conversion rate target.`,
            `Average deal size of ${formatCurrency(avgDealSize)} across ${totalClosed} closed jobs.`,
            `Monthly inspection trend is ${monthlyTrend[monthlyTrend.length - 1].inspections > monthlyTrend[monthlyTrend.length - 2].inspections ? 'increasing' : 'decreasing'} — ${monthlyTrend[monthlyTrend.length - 1].inspections} inspections in ${monthlyTrend[monthlyTrend.length - 1].month}.`,
          ].map((insight, i) => (
            <li key={i} className="text-sm text-neutral-300 flex gap-2">
              <span className="text-brand-green flex-shrink-0">&#8226;</span>
              {insight}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
