'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScoreFactor {
  score: number;
  weight: number;
  raw: number;
  explanation: string;
}

interface DistributionScoreCardProps {
  score: {
    repSlug: string;
    repName: string;
    totalScore: number;
    factors: Record<string, ScoreFactor>;
    isAvailable: boolean;
    isEligible: boolean;
    disqualifyReason?: string;
  };
  rank: number;
  isAssigned?: boolean;
  className?: string;
}

// Factor display configuration with colors and labels
const FACTOR_CONFIG: Record<string, { label: string; color: string; bgClass: string }> = {
  installProximity: { label: 'Install Proximity', color: '#3B82F6', bgClass: 'bg-blue-500' },
  referralBonus: { label: 'Referral Bonus', color: '#22C55E', bgClass: 'bg-green-500' },
  contactProximity: { label: 'Contact Proximity', color: '#06B6D4', bgClass: 'bg-cyan-500' },
  doorKnockRecency: { label: 'Door Knock Recency', color: '#A855F7', bgClass: 'bg-purple-500' },
  meetingAttendance: { label: 'Meeting Attendance', color: '#F59E0B', bgClass: 'bg-amber-500' },
  closeRate: { label: 'Close Rate', color: '#10B981', bgClass: 'bg-emerald-500' },
  responseTime: { label: 'Response Time', color: '#F43F5E', bgClass: 'bg-rose-500' },
};

export default function DistributionScoreCard({
  score,
  rank,
  isAssigned = false,
  className,
}: DistributionScoreCardProps) {
  const [expanded, setExpanded] = useState(false);

  const factorEntries = Object.entries(score.factors).filter(
    ([key]) => key !== 'manual'
  );

  // Calculate total weight for proportional bar widths
  const totalFactorScore = factorEntries.reduce((sum, [, f]) => sum + Math.max(0, f.score), 0);

  return (
    <div
      className={cn(
        'bg-white rounded-lg border p-4 shadow-sm transition-all',
        isAssigned ? 'border-yellow-400 ring-2 ring-yellow-200' : 'border-gray-200',
        !score.isEligible && 'opacity-60',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        {/* Rank badge */}
        <div
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0',
            rank === 1
              ? 'bg-yellow-100 text-yellow-700'
              : rank === 2
              ? 'bg-gray-100 text-gray-600'
              : rank === 3
              ? 'bg-orange-100 text-orange-600'
              : 'bg-gray-50 text-gray-400'
          )}
        >
          #{rank}
        </div>

        {/* Rep name and availability */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 truncate">{score.repName}</span>
            <span
              className={cn(
                'w-2 h-2 rounded-full flex-shrink-0',
                score.isAvailable ? 'bg-green-500' : 'bg-red-500'
              )}
              title={score.isAvailable ? 'Available' : 'Unavailable'}
            />
          </div>
          <span className="text-xs text-gray-400">{score.repSlug}</span>
        </div>

        {/* Total score */}
        <div className="text-right flex-shrink-0">
          <div className="text-xl font-bold text-gray-900">
            {score.totalScore.toFixed(1)}
          </div>
          <div className="text-xs text-gray-400">pts</div>
        </div>
      </div>

      {/* Disqualified message */}
      {!score.isEligible && score.disqualifyReason && (
        <div className="flex items-center gap-2 mt-3 p-2 bg-red-50 rounded-md">
          <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
          <span className="text-xs text-red-600">{score.disqualifyReason}</span>
        </div>
      )}

      {/* Stacked bar chart */}
      {score.isEligible && totalFactorScore > 0 && (
        <div className="mt-3">
          <div className="h-4 flex rounded-full overflow-hidden bg-gray-100">
            {factorEntries.map(([key, factor]) => {
              if (factor.score <= 0) return null;
              const widthPercent = (factor.score / totalFactorScore) * 100;
              const config = FACTOR_CONFIG[key];
              return (
                <div
                  key={key}
                  className="h-full transition-all"
                  style={{
                    width: `${widthPercent}%`,
                    backgroundColor: config?.color || '#94A3B8',
                    minWidth: widthPercent > 0 ? '2px' : '0',
                  }}
                  title={`${config?.label || key}: ${factor.score.toFixed(2)}`}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Factor details toggle */}
      {score.isEligible && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? 'Hide details' : 'Show factor details'}
        </button>
      )}

      {/* Expanded factor details */}
      {expanded && score.isEligible && (
        <div className="mt-2 space-y-1.5 border-t border-gray-100 pt-2">
          {factorEntries.map(([key, factor]) => {
            const config = FACTOR_CONFIG[key];
            return (
              <div key={key} className="flex items-center gap-2 text-xs">
                <div
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: config?.color || '#94A3B8' }}
                />
                <span className="text-gray-600 w-32 flex-shrink-0">{config?.label || key}</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, factor.raw * 100)}%`,
                      backgroundColor: config?.color || '#94A3B8',
                    }}
                  />
                </div>
                <span className="text-gray-500 w-12 text-right font-mono">
                  {factor.score.toFixed(2)}
                </span>
                <span className="text-gray-400 w-8 text-right">(w{factor.weight})</span>
              </div>
            );
          })}
          {/* Explanations */}
          <div className="mt-2 space-y-1 pt-2 border-t border-gray-50">
            {factorEntries
              .filter(([, f]) => f.explanation && f.score > 0)
              .map(([key, factor]) => (
                <p key={key} className="text-xs text-gray-400 italic">
                  {FACTOR_CONFIG[key]?.label || key}: {factor.explanation}
                </p>
              ))}
          </div>
        </div>
      )}

      {/* Assigned badge */}
      {isAssigned && (
        <div className="mt-2 pt-2 border-t border-yellow-100">
          <span className="text-xs font-semibold text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full">
            Assigned
          </span>
        </div>
      )}
    </div>
  );
}
