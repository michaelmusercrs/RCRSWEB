'use client';

import { useMemo } from 'react';
import {
  Lightbulb, TrendingUp, Clock, MapPin, Target,
  Phone, DollarSign, Zap, ArrowUpRight, Shield,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface RepPerformanceData {
  avgResponseMinutes: number;
  closeRate: number;
  inPersonCloseRate: number;
  emailedCloseRate: number;
  doorsKnocked: number;
  contractsSigned: number;
  estimatesGiven: number;
  leadsGenerated: number;
  followUpsMade: number;
  weeklyRevenue: number;
  monthlyRevenue: number;
  totalRevenue: number;
  winCount: number;
  lossCount: number;
}

interface SmartTip {
  id: string;
  icon: React.ElementType;
  color: string;
  title: string;
  message: string;
  type: 'insight' | 'goal' | 'projection' | 'area';
}

interface SmartTipsWidgetProps {
  repData: RepPerformanceData;
  repName: string;
  /** Suggested canvassing areas from HailRecon data */
  canvassingAreas?: Array<{ area: string; reason: string; hailDate?: string }>;
}

// =============================================================================
// Tip Generation Logic
// =============================================================================

function generateTips(data: RepPerformanceData, repName: string, areas?: SmartTipsWidgetProps['canvassingAreas']): SmartTip[] {
  const tips: SmartTip[] = [];
  const firstName = repName.split(' ')[0];

  // Response time insights
  if (data.avgResponseMinutes > 0) {
    if (data.avgResponseMinutes <= 5) {
      tips.push({
        id: 'response-fast',
        icon: Zap,
        color: 'text-green-400',
        title: 'Lightning Fast Responses! ⚡',
        message: `You're averaging ${data.avgResponseMinutes.toFixed(0)} min response time. Leads contacted within 5 minutes close at 8x the rate of those contacted after 30 min. Keep it up!`,
        type: 'insight',
      });
    } else if (data.avgResponseMinutes <= 15) {
      tips.push({
        id: 'response-good',
        icon: Clock,
        color: 'text-amber-400',
        title: 'Response Time Opportunity',
        message: `Your ${data.avgResponseMinutes.toFixed(0)} min avg is solid. Shaving it to under 5 min could boost your close rate significantly — leads called within 5 min close at 8x the rate of 30+ min.`,
        type: 'goal',
      });
    } else {
      tips.push({
        id: 'response-improve',
        icon: Phone,
        color: 'text-orange-400',
        title: 'Speed to Lead Goal',
        message: `Goal: Get response time from ${data.avgResponseMinutes.toFixed(0)} min to under 10 min this week. Industry data shows every minute counts — 5 min = 8x better close rate than 30 min.`,
        type: 'goal',
      });
    }
  }

  // In-person vs emailed close rate
  if (data.inPersonCloseRate > 0 && data.emailedCloseRate > 0) {
    const diff = data.inPersonCloseRate - data.emailedCloseRate;
    if (diff > 15) {
      tips.push({
        id: 'in-person-strong',
        icon: Target,
        color: 'text-green-400',
        title: 'In-Person Advantage',
        message: `Your in-person close rate (${data.inPersonCloseRate}%) is ${diff.toFixed(0)}% higher than emailed (${data.emailedCloseRate}%). Focus on scheduling face-to-face presentations when possible!`,
        type: 'insight',
      });
    }
  }

  // Estimate-to-close conversion
  if (data.estimatesGiven > 0 && data.contractsSigned > 0) {
    const conversionRate = (data.contractsSigned / data.estimatesGiven * 100);
    if (conversionRate >= 40) {
      tips.push({
        id: 'conversion-strong',
        icon: TrendingUp,
        color: 'text-green-400',
        title: 'Strong Closer!',
        message: `Converting ${conversionRate.toFixed(0)}% of estimates to contracts — that's excellent, ${firstName}! Keep your presentation game strong.`,
        type: 'insight',
      });
    } else if (conversionRate >= 20) {
      tips.push({
        id: 'conversion-mid',
        icon: Target,
        color: 'text-amber-400',
        title: 'Conversion Opportunity',
        message: `You're closing ${conversionRate.toFixed(0)}% of estimates. Industry top performers hit 40%+. Try following up within 24hrs of every estimate.`,
        type: 'goal',
      });
    } else {
      tips.push({
        id: 'conversion-low',
        icon: Target,
        color: 'text-orange-400',
        title: 'Closing Rate Goal',
        message: `Goal: Improve estimate-to-contract rate from ${conversionRate.toFixed(0)}% toward 30%. Tip: Present in person, follow up same day, and address objections head-on.`,
        type: 'goal',
      });
    }
  }

  // Revenue projections
  if (data.weeklyRevenue > 0) {
    const monthlyProjection = data.weeklyRevenue * 4.33;
    const annualProjection = data.weeklyRevenue * 52;
    tips.push({
      id: 'projection',
      icon: DollarSign,
      color: 'text-emerald-400',
      title: 'Revenue Projection',
      message: `At your current pace ($${data.weeklyRevenue.toLocaleString()}/week), you're projected for $${monthlyProjection.toLocaleString(undefined, { maximumFractionDigits: 0 })}/month and $${annualProjection.toLocaleString(undefined, { maximumFractionDigits: 0 })}/year. ${annualProjection > 1000000 ? '🎯 Million-dollar pace!' : ''}`,
      type: 'projection',
    });
  }

  // Follow-up reminder
  if (data.lossCount > 0 && data.followUpsMade < data.lossCount) {
    tips.push({
      id: 'followup',
      icon: Phone,
      color: 'text-blue-400',
      title: 'Follow-Up Opportunity',
      message: `You have ${data.lossCount} lost deals — some may be winnable with a follow-up. Even a 10% recovery rate on these could mean significant revenue.`,
      type: 'goal',
    });
  }

  // Canvassing areas
  if (areas && areas.length > 0) {
    tips.push({
      id: 'canvassing',
      icon: MapPin,
      color: 'text-cyan-400',
      title: 'Hot Areas to Canvas',
      message: areas.slice(0, 3).map(a => `${a.area}: ${a.reason}`).join(' • '),
      type: 'area',
    });
  }

  // Win streak / morale boost
  if (data.winCount > 0 && data.lossCount === 0) {
    tips.push({
      id: 'streak',
      icon: Shield,
      color: 'text-purple-400',
      title: 'Perfect Record! 🔥',
      message: `${data.winCount} wins, 0 losses — you're on fire, ${firstName}! Keep the momentum going.`,
      type: 'insight',
    });
  }

  return tips.slice(0, 4); // Max 4 tips at a time
}

// =============================================================================
// Component
// =============================================================================

export default function SmartTipsWidget({ repData, repName, canvassingAreas }: SmartTipsWidgetProps) {
  const tips = useMemo(
    () => generateTips(repData, repName, canvassingAreas),
    [repData, repName, canvassingAreas]
  );

  if (tips.length === 0) {
    return null;
  }

  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
          <Lightbulb size={20} className="text-amber-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Smart Tips & Projections</h3>
          <p className="text-xs text-neutral-500">Personalized insights based on your data</p>
        </div>
      </div>
      <div className="space-y-3">
        {tips.map(tip => (
          <div
            key={tip.id}
            className={`flex gap-3 p-3 rounded-xl border ${
              tip.type === 'goal'
                ? 'bg-amber-500/5 border-amber-500/10'
                : tip.type === 'projection'
                ? 'bg-emerald-500/5 border-emerald-500/10'
                : tip.type === 'area'
                ? 'bg-cyan-500/5 border-cyan-500/10'
                : 'bg-white/[0.02] border-white/5'
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              <tip.icon size={16} className={tip.color} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-semibold text-white">{tip.title}</span>
                {tip.type === 'goal' && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-medium">GOAL</span>
                )}
                {tip.type === 'projection' && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium flex items-center gap-0.5">
                    <ArrowUpRight size={8} /> PROJECTION
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">{tip.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
