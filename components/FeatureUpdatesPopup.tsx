'use client';

import { useState, useEffect } from 'react';
import {
  X, ChevronRight, ChevronLeft, Sparkles, Bell, CheckCircle2,
  Zap, Wrench, GraduationCap, AlertTriangle, ArrowRight
} from 'lucide-react';
import { FeatureUpdate, getUpdatesForRole, getLatestVersion } from '@/lib/featureUpdates';
import { TeamRole } from '@/lib/team-roles';

interface FeatureUpdatesPopupProps {
  role: TeamRole;
  userName: string;
  onClose: () => void;
  onViewTraining?: () => void;
}

const categoryIcons = {
  new: Sparkles,
  improvement: Zap,
  fix: Wrench,
  training: GraduationCap
};

const categoryColors = {
  new: 'text-green-400 bg-green-400/20',
  improvement: 'text-blue-400 bg-blue-400/20',
  fix: 'text-orange-400 bg-orange-400/20',
  training: 'text-purple-400 bg-purple-400/20'
};

const categoryLabels = {
  new: 'New Feature',
  improvement: 'Improvement',
  fix: 'Bug Fix',
  training: 'Training'
};

export default function FeatureUpdatesPopup({
  role,
  userName,
  onClose,
  onViewTraining
}: FeatureUpdatesPopupProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const updates = getUpdatesForRole(role);
  const highPriorityUpdates = updates.filter(u => u.isHighPriority);
  const displayUpdates = highPriorityUpdates.length > 0 ? highPriorityUpdates : updates.slice(0, 3);

  const currentUpdate = displayUpdates[currentIndex];
  const isLastUpdate = currentIndex === displayUpdates.length - 1;

  const handleNext = () => {
    if (isLastUpdate) {
      // Save that user has seen updates
      try {
        localStorage.setItem(`rcrs-last-seen-version-${role}`, getLatestVersion());
        localStorage.setItem(`rcrs-updates-seen-date-${role}`, new Date().toISOString());
      } catch (e) {
        // Ignore storage errors
      }
      onClose();
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    try {
      localStorage.setItem(`rcrs-last-seen-version-${role}`, getLatestVersion());
      localStorage.setItem(`rcrs-updates-seen-date-${role}`, new Date().toISOString());
    } catch (e) {
      // Ignore storage errors
    }
    onClose();
  };

  if (!currentUpdate || displayUpdates.length === 0) {
    onClose();
    return null;
  }

  const CategoryIcon = categoryIcons[currentUpdate.category];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-950 rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="relative px-6 py-5 border-b border-white/10 bg-gradient-to-r from-blue-500/10 to-purple-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl flex items-center justify-center">
                <Bell className="text-blue-400" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">What's New</h2>
                <p className="text-sm text-neutral-400">
                  {displayUpdates.length} update{displayUpdates.length > 1 ? 's' : ''} for you
                </p>
              </div>
            </div>
            <button
              onClick={handleSkip}
              className="text-neutral-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"
            >
              <X size={20} />
            </button>
          </div>

          {/* Progress dots */}
          <div className="flex gap-2 mt-4">
            {displayUpdates.map((_, idx) => (
              <div
                key={idx}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                  idx <= currentIndex ? 'bg-blue-400' : 'bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 min-h-[350px] max-h-[55vh] overflow-y-auto">
          {/* Category Badge */}
          <div className="flex items-center gap-3 mb-4">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${categoryColors[currentUpdate.category]}`}>
              <CategoryIcon size={14} />
              {categoryLabels[currentUpdate.category]}
            </span>
            {currentUpdate.isHighPriority && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-red-400/20 text-red-400">
                <AlertTriangle size={14} />
                Important
              </span>
            )}
            <span className="text-xs text-neutral-500 ml-auto">
              v{currentUpdate.version} • {new Date(currentUpdate.releaseDate).toLocaleDateString()}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-2xl font-bold text-white mb-3">{currentUpdate.title}</h3>

          {/* Description */}
          <p className="text-neutral-300 text-base mb-6">{currentUpdate.description}</p>

          {/* Instructions */}
          {currentUpdate.instructions && currentUpdate.instructions.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-blue-400 font-semibold mb-3 flex items-center gap-2">
                <CheckCircle2 size={18} />
                How to use this feature:
              </p>
              <ul className="space-y-2">
                {currentUpdate.instructions.map((instruction, idx) => (
                  <li
                    key={idx}
                    className={`text-sm ${
                      instruction.startsWith('  ')
                        ? 'text-neutral-400 pl-4'
                        : 'text-neutral-300'
                    }`}
                  >
                    {!instruction.startsWith('  ') && (
                      <span className="inline-block w-5 text-blue-400">{idx + 1}.</span>
                    )}
                    {instruction}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-black/20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm text-neutral-500">
              {currentIndex + 1} of {displayUpdates.length}
            </span>
            <button
              onClick={handleSkip}
              className="text-sm text-neutral-400 hover:text-white transition-colors"
            >
              Skip all
            </button>
            {onViewTraining && (
              <button
                onClick={onViewTraining}
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
              >
                <GraduationCap size={14} />
                View training
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {currentIndex > 0 && (
              <button
                onClick={handlePrev}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors"
              >
                <ChevronLeft size={18} />
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold transition-all shadow-lg shadow-blue-500/25"
            >
              {isLastUpdate ? (
                <>
                  Got it!
                  <CheckCircle2 size={18} />
                </>
              ) : (
                <>
                  Next
                  <ChevronRight size={18} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook to check if user should see updates
export function useFeatureUpdates(role: TeamRole) {
  const [shouldShowUpdates, setShouldShowUpdates] = useState(false);
  const [lastSeenVersion, setLastSeenVersion] = useState<string>('0.0.0');

  useEffect(() => {
    try {
      const savedVersion = localStorage.getItem(`rcrs-last-seen-version-${role}`);
      const currentVersion = getLatestVersion();

      if (!savedVersion || savedVersion < currentVersion) {
        setShouldShowUpdates(true);
      }

      setLastSeenVersion(savedVersion || '0.0.0');
    } catch (e) {
      // Default to showing updates if storage fails
      setShouldShowUpdates(true);
    }
  }, [role]);

  const markAsSeen = () => {
    try {
      localStorage.setItem(`rcrs-last-seen-version-${role}`, getLatestVersion());
      setShouldShowUpdates(false);
    } catch (e) {
      // Ignore
    }
  };

  return { shouldShowUpdates, lastSeenVersion, markAsSeen };
}
