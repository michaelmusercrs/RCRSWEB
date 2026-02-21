'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Home,
  Command,
  CheckCircle2,
  Circle,
  ExternalLink,
  Lightbulb,
  PartyPopper,
} from 'lucide-react';
import SettingsMenu from '@/components/SettingsMenu';
import { getChecklistBySlug, type OnboardingChecklist } from '@/lib/onboarding-checklists';

const STORAGE_PREFIX = 'rcrs-onboarding-checklist-';

function loadProgress(slug: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const saved = localStorage.getItem(STORAGE_PREFIX + slug);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  } catch {
    return new Set();
  }
}

function saveProgress(slug: string, completed: Set<string>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_PREFIX + slug, JSON.stringify(Array.from(completed)));
}

export default function OnboardingChecklistPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [checklist, setChecklist] = useState<OnboardingChecklist | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [justCompleted, setJustCompleted] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      const found = getChecklistBySlug(slug);
      setChecklist(found || null);
      if (found) setCompleted(loadProgress(slug));
    }
  }, [slug]);

  const toggleStep = (stepId: string) => {
    const next = new Set(completed);
    if (next.has(stepId)) {
      next.delete(stepId);
      setJustCompleted(null);
    } else {
      next.add(stepId);
      setJustCompleted(stepId);
      setTimeout(() => setJustCompleted(null), 1500);
    }
    setCompleted(next);
    saveProgress(slug, next);
  };

  if (!checklist) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-400 text-lg mb-4">Checklist not found</p>
          <Link href="/portal/training/onboarding" className="text-blue-400 hover:text-blue-300 underline">
            ← Back to onboarding
          </Link>
        </div>
      </div>
    );
  }

  const totalSteps = checklist.steps.length;
  const completedCount = checklist.steps.filter(s => completed.has(s.id)).length;
  const progressPct = Math.round((completedCount / totalSteps) * 100);
  const allDone = completedCount === totalSteps;

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)', backgroundSize: '50px 50px' }} />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-white/5 backdrop-blur-xl bg-black/20 sticky top-0 z-20">
          <div className="max-w-3xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link
                  href="/portal/training/onboarding"
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <ArrowLeft size={18} className="text-neutral-400" />
                </Link>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{checklist.emoji}</span>
                    <h1 className="text-lg font-bold text-white">{checklist.name}</h1>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-neutral-400">{checklist.roleTag}</span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5">{checklist.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link href="/command-center" className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-green/20 to-emerald-500/20 hover:from-brand-green/30 hover:to-emerald-500/30 border border-brand-green/30 text-brand-green text-sm font-medium transition-all">
                  <Command size={16} />
                  HQ
                </Link>
                <SettingsMenu />
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-6 py-8">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-neutral-300">
                {completedCount} of {totalSteps} steps complete
              </span>
              <span className="text-sm font-bold text-brand-green">{progressPct}%</span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-green to-emerald-400 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* All Done Banner */}
          {allDone && (
            <div className="mb-8 rounded-2xl border border-green-500/30 bg-green-500/10 p-6 text-center">
              <PartyPopper size={32} className="text-green-400 mx-auto mb-2" />
              <h2 className="text-xl font-bold text-green-400 mb-1">All Done! 🎉</h2>
              <p className="text-sm text-neutral-300">You&apos;ve completed all onboarding steps. You&apos;re ready to go.</p>
            </div>
          )}

          {/* Description */}
          <p className="text-sm text-neutral-400 mb-6">{checklist.description}</p>

          {/* Steps */}
          <div className="space-y-3">
            {checklist.steps.map((step, idx) => {
              const isDone = completed.has(step.id);
              const isJust = justCompleted === step.id;

              return (
                <div
                  key={step.id}
                  className={`rounded-xl border transition-all duration-300 ${
                    isDone
                      ? 'border-green-500/20 bg-green-500/5'
                      : 'border-white/5 bg-white/[0.02] hover:border-white/10'
                  } ${isJust ? 'ring-2 ring-green-500/40' : ''}`}
                >
                  <div className="px-5 py-4">
                    <div className="flex items-start gap-4">
                      {/* Step number + checkbox */}
                      <button
                        onClick={() => toggleStep(step.id)}
                        className="flex-shrink-0 mt-0.5 group"
                        aria-label={isDone ? `Unmark step ${idx + 1}` : `Mark step ${idx + 1} complete`}
                      >
                        {isDone ? (
                          <CheckCircle2 size={24} className="text-green-400 transition-transform group-hover:scale-110" />
                        ) : (
                          <Circle size={24} className="text-neutral-600 group-hover:text-neutral-400 transition-colors" />
                        )}
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-medium text-sm mb-1 ${isDone ? 'text-green-400 line-through decoration-green-500/30' : 'text-white'}`}>
                          <span className="text-neutral-500 mr-2">{idx + 1}.</span>
                          {step.title}
                        </h3>
                        <p className="text-sm text-neutral-400 leading-relaxed">{step.description}</p>

                        {/* Tip */}
                        {step.tip && (
                          <div className="mt-3 flex items-start gap-2 rounded-lg bg-blue-500/5 border border-blue-500/15 px-3 py-2">
                            <Lightbulb size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-blue-300">{step.tip}</p>
                          </div>
                        )}

                        {/* Action row */}
                        <div className="mt-3 flex items-center gap-3">
                          {step.link && (
                            <Link
                              href={step.link.href}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-green/10 border border-brand-green/20 text-brand-green text-xs font-medium hover:bg-brand-green/20 transition-colors"
                            >
                              <ExternalLink size={12} />
                              {step.link.label}
                            </Link>
                          )}
                          <button
                            onClick={() => toggleStep(step.id)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              isDone
                                ? 'bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20'
                                : 'bg-white/5 border border-white/10 text-neutral-300 hover:bg-white/10'
                            }`}
                          >
                            <CheckCircle2 size={12} />
                            {isDone ? 'Completed' : 'Mark Complete'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
