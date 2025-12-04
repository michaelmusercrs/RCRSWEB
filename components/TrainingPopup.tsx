'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  X, GraduationCap, BookOpen, Clock, Award, ChevronRight,
  CheckCircle2, Play, Sparkles, Trophy
} from 'lucide-react';
import { useTraining, ROLE_TRAINING_MODULES, USER_ROLES } from '@/lib/training-context';

const MODULE_INFO: Record<string, { title: string; icon: string; duration: string }> = {
  'portal-overview': { title: 'Portal Overview', icon: 'book', duration: '24 min' },
  'admin-blog': { title: 'Blog Management', icon: 'file', duration: '29 min' },
  'admin-team': { title: 'Team Management', icon: 'users', duration: '24 min' },
  'admin-images': { title: 'Image Gallery', icon: 'image', duration: '20 min' },
  'inventory': { title: 'Inventory Management', icon: 'package', duration: '30 min' },
  'manager': { title: 'Manager Dashboard', icon: 'chart', duration: '39 min' },
  'driver': { title: 'Driver Portal', icon: 'truck', duration: '38 min' },
};

export default function TrainingPopup() {
  const {
    showTrainingPopup,
    dismissPopup,
    progress,
    settings,
    leaderboard,
    userRank
  } = useTraining();

  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!showTrainingPopup) return null;

  const requiredModules = ROLE_TRAINING_MODULES[settings.role] || [];
  const completedCount = requiredModules.filter(m => progress.completedModules.includes(m)).length;
  const progressPercent = Math.round((completedCount / requiredModules.length) * 100);

  const topThree = leaderboard.slice(0, 3);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-950 border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
        {/* Decorative gradient */}
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-brand-green rounded-full blur-[100px] opacity-20" />
        <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-blue-500 rounded-full blur-[100px] opacity-10" />

        {/* Close button */}
        <button
          onClick={() => dismissPopup(dontShowAgain)}
          className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors z-10"
        >
          <X className="text-neutral-400" size={20} />
        </button>

        {/* Content */}
        <div className="relative p-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-brand-green to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-green/25">
              <GraduationCap className="text-black" size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Welcome to Training!</h2>
              <p className="text-neutral-400">
                Complete your {USER_ROLES[settings.role]} training modules
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-400">Your Progress</span>
              <span className="text-sm font-bold text-brand-green">{progressPercent}%</span>
            </div>
            <div className="h-3 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-3 bg-gradient-to-r from-brand-green to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-neutral-500">{completedCount}/{requiredModules.length} modules complete</span>
              <span className="text-xs text-neutral-500 flex items-center gap-1">
                <Award size={12} className="text-yellow-400" />
                {progress.points} points earned
              </span>
            </div>
          </div>

          {/* Required modules */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-neutral-300 mb-3 flex items-center gap-2">
              <BookOpen size={14} />
              Required Training for {USER_ROLES[settings.role]}
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-thin">
              {requiredModules.map(moduleId => {
                const info = MODULE_INFO[moduleId];
                const isComplete = progress.completedModules.includes(moduleId);

                return (
                  <div
                    key={moduleId}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                      isComplete
                        ? 'bg-brand-green/10 border-brand-green/30'
                        : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isComplete ? 'bg-brand-green' : 'bg-white/5'
                      }`}>
                        {isComplete ? (
                          <CheckCircle2 className="text-black" size={16} />
                        ) : (
                          <Play className="text-neutral-400" size={12} />
                        )}
                      </div>
                      <div>
                        <span className={`text-sm font-medium ${isComplete ? 'text-brand-green' : 'text-white'}`}>
                          {info?.title || moduleId}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-neutral-500">
                          <Clock size={10} />
                          {info?.duration || '20 min'}
                        </div>
                      </div>
                    </div>
                    {isComplete && (
                      <span className="text-xs text-brand-green px-2 py-1 bg-brand-green/10 rounded-lg">
                        Complete
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mini Leaderboard */}
          <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
                <Trophy size={14} className="text-yellow-400" />
                Top Performers
              </h3>
              <span className="text-xs text-neutral-500">Your rank: #{userRank}</span>
            </div>
            <div className="flex items-center gap-4">
              {topThree.map((entry, idx) => (
                <div key={entry.name} className="flex-1 text-center">
                  <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center mb-1 ${
                    idx === 0 ? 'bg-yellow-500/20 ring-2 ring-yellow-500' :
                    idx === 1 ? 'bg-gray-400/20 ring-2 ring-gray-400' :
                    'bg-orange-600/20 ring-2 ring-orange-600'
                  }`}>
                    <span className="text-sm font-bold text-white">#{idx + 1}</span>
                  </div>
                  <div className="text-xs font-medium text-white truncate">{entry.name.split(' ')[0]}</div>
                  <div className="text-xs text-neutral-500">{entry.points} pts</div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-brand-green focus:ring-brand-green focus:ring-offset-0"
              />
              <span className="text-sm text-neutral-400 group-hover:text-neutral-300 transition-colors">
                Don't show again
              </span>
            </label>

            <div className="flex items-center gap-3">
              <button
                onClick={() => dismissPopup(dontShowAgain)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                Close
              </button>
              <Link
                href="/portal/admin/training"
                onClick={() => dismissPopup(false)}
                className="px-6 py-2.5 bg-gradient-to-r from-brand-green to-emerald-500 hover:from-lime-400 hover:to-emerald-400 text-black font-semibold rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-brand-green/25 transition-all"
              >
                <Sparkles size={16} />
                Go to Training
                <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
