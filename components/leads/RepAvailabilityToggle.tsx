'use client';

import { useState, useEffect } from 'react';
import { Lock, Clock, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RepAvailabilityToggleProps {
  repSlug: string;
  repName: string;
  isReceivingLeads: boolean;
  adminPaused: boolean;
  autoResumeAt: string | null;
  onToggle: (repSlug: string, newState: boolean, reason?: string, autoResumeHours?: number) => void;
  canManage: boolean;
  className?: string;
}

function formatCountdown(targetDate: string): string | null {
  const target = new Date(targetDate).getTime();
  const now = Date.now();
  const diff = target - now;

  if (diff <= 0) return null;

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export default function RepAvailabilityToggle({
  repSlug,
  repName,
  isReceivingLeads,
  adminPaused,
  autoResumeAt,
  onToggle,
  canManage,
  className,
}: RepAvailabilityToggleProps) {
  const [showPauseForm, setShowPauseForm] = useState(false);
  const [reason, setReason] = useState('');
  const [autoResumeHours, setAutoResumeHours] = useState<number | null>(null);
  const [customHours, setCustomHours] = useState('');
  const [countdown, setCountdown] = useState<string | null>(null);

  // Countdown timer for auto-resume
  useEffect(() => {
    if (!autoResumeAt) {
      setCountdown(null);
      return;
    }

    const update = () => {
      const remaining = formatCountdown(autoResumeAt);
      setCountdown(remaining);
    };

    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [autoResumeAt]);

  const handleToggleClick = () => {
    if (!canManage) return;

    if (isReceivingLeads) {
      // Turning OFF - show form
      setShowPauseForm(true);
    } else {
      // Turning ON - immediate
      onToggle(repSlug, true);
      setShowPauseForm(false);
    }
  };

  const handleConfirmPause = () => {
    const resumeHours =
      autoResumeHours === -1
        ? parseFloat(customHours) || undefined
        : autoResumeHours || undefined;

    onToggle(repSlug, false, reason || undefined, resumeHours);
    setShowPauseForm(false);
    setReason('');
    setAutoResumeHours(null);
    setCustomHours('');
  };

  const handleCancelPause = () => {
    setShowPauseForm(false);
    setReason('');
    setAutoResumeHours(null);
    setCustomHours('');
  };

  return (
    <div className={cn('bg-white rounded-lg border border-gray-200 p-4 shadow-sm', className)}>
      <div className="flex items-center justify-between">
        {/* Rep name and status */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-medium text-gray-900 truncate">{repName}</span>
          {adminPaused && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex-shrink-0">
              <Lock size={10} />
              Paused by admin
            </span>
          )}
          {countdown && (
            <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex-shrink-0">
              <Clock size={10} />
              Auto-resumes in {countdown}
            </span>
          )}
        </div>

        {/* Toggle switch */}
        <div className="relative flex-shrink-0 ml-4">
          {!canManage && (
            <div className="absolute inset-0 z-10 cursor-not-allowed" title="Contact manager to change" />
          )}
          <button
            onClick={handleToggleClick}
            disabled={!canManage}
            className={cn(
              'relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
              isReceivingLeads ? 'bg-green-500' : 'bg-red-400',
              !canManage && 'opacity-50 cursor-not-allowed'
            )}
            title={!canManage ? 'Contact manager to change' : isReceivingLeads ? 'Turn off' : 'Turn on'}
          >
            <span
              className={cn(
                'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200',
                isReceivingLeads ? 'translate-x-6' : 'translate-x-0'
              )}
            />
          </button>
        </div>
      </div>

      {/* Disabled tooltip */}
      {!canManage && (
        <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
          <Info size={12} />
          Contact a manager to change this setting
        </div>
      )}

      {/* Pause form (inline) */}
      {showPauseForm && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
          {/* Reason input */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Reason (optional)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., On vacation, At training..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Auto-resume dropdown */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Auto-resume</label>
            <select
              value={autoResumeHours ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                setAutoResumeHours(val === '' ? null : Number(val));
              }}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">No auto-resume</option>
              <option value="1">1 hour</option>
              <option value="2">2 hours</option>
              <option value="4">4 hours</option>
              <option value="8">8 hours</option>
              <option value="24">24 hours</option>
              <option value="-1">Custom...</option>
            </select>
          </div>

          {/* Custom hours input */}
          {autoResumeHours === -1 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Custom hours</label>
              <input
                type="number"
                value={customHours}
                onChange={(e) => setCustomHours(e.target.value)}
                placeholder="Enter hours"
                min="0.5"
                step="0.5"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleConfirmPause}
              className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-md hover:bg-red-600 transition-colors"
            >
              Confirm Pause
            </button>
            <button
              onClick={handleCancelPause}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
