'use client';

import { useState, useEffect } from 'react';
import { Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeadTimerBadgeProps {
  assignedAt: Date | string;
  reminderSent: boolean;
  warningSent: boolean;
  contacted?: boolean;
  responseMinutes?: number;
  className?: string;
}

function formatElapsed(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

export default function LeadTimerBadge({
  assignedAt,
  reminderSent,
  warningSent,
  contacted = false,
  responseMinutes,
  className,
}: LeadTimerBadgeProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const date = assignedAt instanceof Date ? assignedAt : new Date(assignedAt);

    const calculate = () => {
      return Math.floor((Date.now() - date.getTime()) / 60000);
    };

    setElapsed(calculate());

    // Don't keep ticking if already contacted
    if (contacted) return;

    const interval = setInterval(() => {
      setElapsed(calculate());
    }, 30000);

    return () => clearInterval(interval);
  }, [assignedAt, contacted]);

  // Contacted state - show response time in green
  if (contacted) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
          'bg-green-100 text-green-800',
          className
        )}
      >
        <CheckCircle2 size={12} />
        {responseMinutes != null ? formatElapsed(responseMinutes) : 'Contacted'}
      </span>
    );
  }

  // Color coding based on elapsed time
  let colorClasses: string;
  if (elapsed >= 60) {
    colorClasses = 'bg-red-100 text-red-800 animate-pulse';
  } else if (elapsed >= 30) {
    colorClasses = 'bg-orange-100 text-orange-800';
  } else if (elapsed >= 10) {
    colorClasses = 'bg-amber-100 text-amber-800';
  } else {
    colorClasses = 'bg-green-50 text-green-700';
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium',
        colorClasses,
        className
      )}
    >
      <Clock size={12} />
      {formatElapsed(elapsed)}
    </span>
  );
}
