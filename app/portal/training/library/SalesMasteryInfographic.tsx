'use client';

import { MapPin, TrendingUp, Target, DollarSign, CloudRain, Zap } from 'lucide-react';

const regionData = [
  { name: 'Huntsville Metro', homes: 45000, saturation: 18, avgDealSize: 12800 },
  { name: 'Madison County', homes: 32000, saturation: 24, avgDealSize: 11500 },
  { name: 'Limestone County', homes: 18000, saturation: 12, avgDealSize: 13200 },
  { name: 'Morgan County', homes: 22000, saturation: 9, avgDealSize: 10800 },
  { name: 'Marshall County', homes: 15000, saturation: 6, avgDealSize: 11200 },
];

const commissionTiers = [
  { tier: 'Standard', range: '$0 - $50K/mo', rate: '8%', color: 'from-blue-500/80 to-cyan-400/80' },
  { tier: 'Silver', range: '$50K - $100K/mo', rate: '10%', color: 'from-amber-500/80 to-yellow-400/80' },
  { tier: 'Gold', range: '$100K - $200K/mo', rate: '11%', color: 'from-brand-green/80 to-emerald-400/80' },
  { tier: 'Platinum', range: '$200K+/mo', rate: '12%', color: 'from-purple-500/80 to-pink-400/80' },
];

const stormTimeline = [
  { month: 'Mar', events: 3, hailReports: 8, severity: 'Moderate' },
  { month: 'Apr', events: 7, hailReports: 22, severity: 'High' },
  { month: 'May', events: 5, hailReports: 15, severity: 'High' },
  { month: 'Jun', events: 4, hailReports: 11, severity: 'Moderate' },
  { month: 'Jul', events: 2, hailReports: 5, severity: 'Low' },
  { month: 'Aug', events: 3, hailReports: 9, severity: 'Moderate' },
];

const pipelineFunnel = [
  { stage: 'New Leads', count: 120, width: 100 },
  { stage: 'Contacted', count: 95, width: 85 },
  { stage: 'Inspected', count: 68, width: 65 },
  { stage: 'Claim Filed', count: 52, width: 50 },
  { stage: 'Approved', count: 41, width: 40 },
  { stage: 'Closed', count: 38, width: 35 },
];

const maxHailReports = Math.max(...stormTimeline.map(s => s.hailReports));

export default function SalesMasteryInfographic() {
  return (
    <div className="p-6 sm:p-8 space-y-8">
      {/* Title */}
      <div className="text-center">
        <h3 className="text-2xl font-bold text-white mb-1">Sales Territory & CRM Mastery</h3>
        <p className="text-sm text-neutral-400">Territory analysis, commission tiers, storm tracking & pipeline management</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active Territories', value: '5', icon: MapPin, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
          { label: 'Avg Deal Size', value: '$11.9K', icon: DollarSign, color: 'text-brand-green', bg: 'bg-brand-green/10 border-brand-green/20' },
          { label: 'Storm Events YTD', value: '24', icon: CloudRain, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
          { label: 'Pipeline Conv.', value: '31.7%', icon: Target, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
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

      {/* Region Cards */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 mb-4">
          <MapPin size={18} className="text-blue-400" />
          <span className="text-sm font-semibold text-white">Territory Coverage by Region</span>
        </div>
        <div className="space-y-3">
          {regionData.map((region) => (
            <div key={region.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-white font-medium">{region.name}</span>
                <div className="flex items-center gap-4 text-xs text-neutral-400">
                  <span>{region.homes.toLocaleString()} homes</span>
                  <span className="font-mono">{region.saturation}% canvassed</span>
                </div>
              </div>
              <div className="h-3 rounded-full bg-neutral-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500/80 to-cyan-400/80 transition-all duration-700"
                  style={{ width: `${Math.min(100, region.saturation * 3)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Commission Tiers */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign size={18} className="text-brand-green" />
          <span className="text-sm font-semibold text-white">Commission Tier Structure</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {commissionTiers.map((tier) => (
            <div key={tier.tier} className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-white">{tier.tier}</span>
                <span className="text-lg font-bold text-brand-green">{tier.rate}</span>
              </div>
              <p className="text-xs text-neutral-400">{tier.range}</p>
              <div className="mt-2 h-2 rounded-full bg-neutral-800 overflow-hidden">
                <div className={`h-full rounded-full bg-gradient-to-r ${tier.color}`} style={{ width: '100%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Storm Timeline */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 mb-4">
          <CloudRain size={18} className="text-amber-400" />
          <span className="text-sm font-semibold text-white">Storm Season Hail Report Timeline</span>
        </div>
        <div className="space-y-3">
          {stormTimeline.map((month) => {
            const barWidth = maxHailReports > 0 ? (month.hailReports / maxHailReports) * 100 : 0;
            const severityColor = month.severity === 'High' ? 'text-red-400' : month.severity === 'Moderate' ? 'text-amber-400' : 'text-green-400';
            return (
              <div key={month.month}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-white font-medium w-8">{month.month}</span>
                  <div className="flex items-center gap-4 text-xs text-neutral-400">
                    <span>{month.events} events</span>
                    <span>{month.hailReports} hail reports</span>
                    <span className={`font-semibold ${severityColor}`}>{month.severity}</span>
                  </div>
                </div>
                <div className="h-3 rounded-full bg-neutral-800 overflow-hidden ml-8">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500/80 to-red-400/80 transition-all duration-700"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pipeline Funnel */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-brand-green" />
          <span className="text-sm font-semibold text-white">Sales Pipeline Funnel (Monthly Avg)</span>
        </div>
        <div className="space-y-2">
          {pipelineFunnel.map((stage, idx) => (
            <div key={stage.stage} className="flex items-center gap-3">
              <span className="text-xs text-neutral-400 w-24 text-right flex-shrink-0">{stage.stage}</span>
              <div className="flex-1">
                <div
                  className="h-8 rounded-lg bg-gradient-to-r from-brand-green/60 to-emerald-500/40 flex items-center px-3 transition-all duration-700"
                  style={{ width: `${stage.width}%` }}
                >
                  <span className="text-xs font-semibold text-white">{stage.count}</span>
                </div>
              </div>
              {idx > 0 && (
                <span className="text-[10px] text-neutral-500 w-12 flex-shrink-0">
                  {Math.round((stage.count / pipelineFunnel[idx - 1].count) * 100)}% kept
                </span>
              )}
            </div>
          ))}
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
            'Madison County has the highest saturation (24%) -- consider expanding to neighboring areas.',
            'April is peak storm season with 22 hail reports -- pre-position canvassing teams.',
            'Pipeline converts 31.7% of new leads to closed jobs -- above the 30% industry benchmark.',
            'Platinum tier reps earn 50% more per job than Standard tier -- volume drives income.',
            'Average deal size of $11.9K with 5 active territories covering 132,000+ homes.',
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
