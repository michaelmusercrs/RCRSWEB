'use client';

import { MapPin, User, Zap, RotateCw, Hand } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeadCardProps {
  logId: string;
  customerName: string;
  address: string;
  assignedRep: string;
  assignedRepName: string;
  method: string;
  timestamp: string;
  scores?: Record<string, number>;
  className?: string;
}

function getRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''} ago`;

  return new Date(timestamp).toLocaleDateString();
}

function getMethodBadge(method: string) {
  switch (method) {
    case 'algorithm':
      return {
        label: 'Algorithm',
        classes: 'bg-blue-100 text-blue-700',
        icon: Zap,
      };
    case 'round_robin':
      return {
        label: 'Round Robin',
        classes: 'bg-amber-100 text-amber-700',
        icon: RotateCw,
      };
    case 'manual':
      return {
        label: 'Manual',
        classes: 'bg-gray-100 text-gray-700',
        icon: Hand,
      };
    default:
      return {
        label: method,
        classes: 'bg-gray-100 text-gray-600',
        icon: Zap,
      };
  }
}

export default function LeadCard({
  logId,
  customerName,
  address,
  assignedRep,
  assignedRepName,
  method,
  timestamp,
  scores,
  className,
}: LeadCardProps) {
  const methodBadge = getMethodBadge(method);
  const MethodIcon = methodBadge.icon;

  // Get top 3 scores if scores are provided
  const topScores = scores
    ? Object.entries(scores)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
    : [];

  const maxScore = topScores.length > 0 ? topScores[0][1] : 0;

  return (
    <div
      className={cn(
        'bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow',
        className
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-gray-900 truncate">{customerName}</h4>
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin size={12} className="text-gray-400 flex-shrink-0" />
            <p className="text-xs text-gray-500 truncate">{address}</p>
          </div>
        </div>
        <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{getRelativeTime(timestamp)}</span>
      </div>

      {/* Rep and method row */}
      <div className="flex items-center gap-2 mt-3">
        <div className="flex items-center gap-1.5">
          <User size={14} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700">{assignedRepName}</span>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
            methodBadge.classes
          )}
        >
          <MethodIcon size={10} />
          {methodBadge.label}
        </span>
      </div>

      {/* Score bars (if scores provided) */}
      {topScores.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
          <p className="text-xs text-gray-400 mb-1">Top Scores</p>
          {topScores.map(([repSlug, score]) => (
            <div key={repSlug} className="flex items-center gap-2">
              <span
                className={cn(
                  'text-xs w-20 truncate',
                  repSlug === assignedRep ? 'font-semibold text-blue-700' : 'text-gray-500'
                )}
              >
                {repSlug}
              </span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    repSlug === assignedRep ? 'bg-blue-500' : 'bg-gray-300'
                  )}
                  style={{ width: maxScore > 0 ? `${(score / maxScore) * 100}%` : '0%' }}
                />
              </div>
              <span className="text-xs text-gray-500 w-10 text-right">{score.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Log ID */}
      <div className="mt-2 pt-2 border-t border-gray-50">
        <span className="text-xs text-gray-300 font-mono">{logId}</span>
      </div>
    </div>
  );
}
