'use client';

import { Phone, Users, MessageSquare, Clock, TrendingUp, Zap } from 'lucide-react';

const responseTargets = [
  { channel: 'Phone', target: '30 min', current: '22 min', pct: 73, onTarget: true },
  { channel: 'Text/SMS', target: '2 hours', current: '1.5 hours', pct: 75, onTarget: true },
  { channel: 'Email', target: '4 hours', current: '3.2 hours', pct: 80, onTarget: true },
  { channel: 'Portal', target: '4 hours', current: '5.1 hours', pct: 127, onTarget: false },
];

const customerJourney = [
  { stage: 'First Contact', description: 'Lead responds, intro call made', satisfaction: 92 },
  { stage: 'Inspection', description: 'Free roof inspection completed', satisfaction: 95 },
  { stage: 'Claim Filed', description: 'Insurance claim submitted', satisfaction: 88 },
  { stage: 'Approval', description: 'Insurance approves the work', satisfaction: 90 },
  { stage: 'Installation', description: 'Roof replacement completed', satisfaction: 94 },
  { stage: 'Follow-Up', description: 'Post-job satisfaction check', satisfaction: 97 },
];

const objectionData = [
  { objection: 'Price too high', frequency: 35, winRate: 62 },
  { objection: 'Need to think about it', frequency: 28, winRate: 55 },
  { objection: 'Already have a roofer', frequency: 18, winRate: 30 },
  { objection: 'Don\'t think I have damage', frequency: 12, winRate: 78 },
  { objection: 'Insurance denied claim', frequency: 7, winRate: 45 },
];

const followUpTimeline = [
  { time: '24-48 hrs', action: 'Satisfaction check call', priority: 'High' },
  { time: '1 week', action: 'Issue follow-up', priority: 'Medium' },
  { time: '30 days', action: 'Referral ask + Google review', priority: 'High' },
  { time: '6 months', action: 'Seasonal check-in', priority: 'Low' },
  { time: '1 year', action: 'Anniversary maintenance offer', priority: 'Medium' },
];

const maxFrequency = Math.max(...objectionData.map(o => o.frequency));

export default function CustomerServiceInfographic() {
  return (
    <div className="p-6 sm:p-8 space-y-8">
      {/* Title */}
      <div className="text-center">
        <h3 className="text-2xl font-bold text-white mb-1">Customer Service & Communication</h3>
        <p className="text-sm text-neutral-400">Response times, customer journey, objections & follow-up cadence</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Avg Satisfaction', value: '93%', icon: Users, color: 'text-brand-green', bg: 'bg-brand-green/10 border-brand-green/20' },
          { label: 'Referral Rate', value: '21%', icon: MessageSquare, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
          { label: 'Response Time', value: '22 min', icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
          { label: 'Objection Win', value: '58%', icon: TrendingUp, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
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

      {/* Response Time Gauges */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Phone size={18} className="text-blue-400" />
          <span className="text-sm font-semibold text-white">Response Time Performance</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {responseTargets.map((rt) => (
            <div key={rt.channel} className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">{rt.channel}</span>
                <span className={`text-xs font-semibold ${rt.onTarget ? 'text-brand-green' : 'text-red-400'}`}>
                  {rt.onTarget ? 'On Target' : 'Needs Improvement'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
                <span>Current: {rt.current}</span>
                <span>Target: {rt.target}</span>
              </div>
              <div className="h-3 rounded-full bg-neutral-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    rt.onTarget
                      ? 'bg-gradient-to-r from-brand-green/80 to-emerald-400/80'
                      : 'bg-gradient-to-r from-red-500/80 to-orange-400/80'
                  }`}
                  style={{ width: `${Math.min(100, rt.pct)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Customer Journey */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users size={18} className="text-brand-green" />
          <span className="text-sm font-semibold text-white">Customer Journey Satisfaction</span>
        </div>
        <div className="space-y-3">
          {customerJourney.map((stage) => (
            <div key={stage.stage}>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <span className="text-sm text-white font-medium">{stage.stage}</span>
                  <span className="text-xs text-neutral-500 ml-2">{stage.description}</span>
                </div>
                <span className={`text-sm font-mono font-semibold ${
                  stage.satisfaction >= 95 ? 'text-brand-green' :
                  stage.satisfaction >= 90 ? 'text-blue-400' : 'text-amber-400'
                }`}>
                  {stage.satisfaction}%
                </span>
              </div>
              <div className="h-3 rounded-full bg-neutral-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    stage.satisfaction >= 95
                      ? 'bg-gradient-to-r from-brand-green/80 to-emerald-400/80'
                      : stage.satisfaction >= 90
                        ? 'bg-gradient-to-r from-blue-500/80 to-cyan-400/80'
                        : 'bg-gradient-to-r from-amber-500/80 to-yellow-400/80'
                  }`}
                  style={{ width: `${stage.satisfaction}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Objection Frequency & Win Rate */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare size={18} className="text-amber-400" />
          <span className="text-sm font-semibold text-white">Common Objections & Win Rates</span>
        </div>
        <div className="space-y-3">
          {objectionData.map((obj) => {
            const freqWidth = maxFrequency > 0 ? (obj.frequency / maxFrequency) * 100 : 0;
            return (
              <div key={obj.objection}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-white font-medium">{obj.objection}</span>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-neutral-400">{obj.frequency}% of objections</span>
                    <span className={`font-semibold ${obj.winRate >= 60 ? 'text-brand-green' : obj.winRate >= 45 ? 'text-amber-400' : 'text-red-400'}`}>
                      {obj.winRate}% win
                    </span>
                  </div>
                </div>
                <div className="h-3 rounded-full bg-neutral-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      obj.winRate >= 60
                        ? 'bg-gradient-to-r from-brand-green/80 to-emerald-400/80'
                        : obj.winRate >= 45
                          ? 'bg-gradient-to-r from-amber-500/80 to-yellow-400/80'
                          : 'bg-gradient-to-r from-red-500/80 to-orange-400/80'
                    }`}
                    style={{ width: `${freqWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Follow-Up Timeline */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={18} className="text-purple-400" />
          <span className="text-sm font-semibold text-white">Post-Job Follow-Up Timeline</span>
        </div>
        <div className="space-y-2">
          {followUpTimeline.map((item, idx) => {
            const priorityColor = item.priority === 'High' ? 'bg-red-500/20 text-red-400 border-red-500/30'
              : item.priority === 'Medium' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
              : 'bg-green-500/20 text-green-400 border-green-500/30';
            return (
              <div key={idx} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3">
                <div className="w-20 flex-shrink-0">
                  <span className="text-sm font-mono text-brand-green">{item.time}</span>
                </div>
                <span className="text-sm text-neutral-300 flex-1">{item.action}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${priorityColor} flex-shrink-0`}>
                  {item.priority}
                </span>
              </div>
            );
          })}
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
            'Portal response time (5.1 hrs) exceeds the 4-hour target -- prioritize portal message monitoring.',
            'Follow-up stage has highest satisfaction (97%) -- consistent follow-up builds trust.',
            '"Don\'t think I have damage" has the highest win rate (78%) -- free inspections convert well.',
            '"Already have a roofer" has the lowest win rate (30%) -- focus on differentiation training.',
            '21% referral rate is strong -- maintain by consistently asking at the 30-day follow-up.',
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
