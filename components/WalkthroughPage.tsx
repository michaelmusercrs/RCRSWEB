'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  Lightbulb,
  ExternalLink,
  Award,
  RotateCcw,
} from 'lucide-react';
import type { WalkthroughData } from '@/lib/walkthrough-data/types';

interface WalkthroughPageProps {
  data: WalkthroughData;
}

export default function WalkthroughPage({ data }: WalkthroughPageProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [completedSections, setCompletedSections] = useState<Set<string>>(new Set());

  const storageKey = `rcrs-walkthrough-${data.slug}-progress`;

  // Load progress from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setCompletedSections(new Set(JSON.parse(saved)));
      }
    } catch {
      // ignore parse errors
    }
  }, [storageKey]);

  // Save progress to localStorage and sync to server
  const saveProgress = (newCompleted: Set<string>) => {
    const arr = Array.from(newCompleted);
    localStorage.setItem(storageKey, JSON.stringify(arr));

    // Sync each completed section to server
    arr.forEach((sectionId) => {
      fetch('/api/portal/training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleId: `wt_${data.slug}_${sectionId}`,
          completed: true,
        }),
      }).catch(() => {});
    });
  };

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleComplete = (id: string) => {
    setCompletedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      saveProgress(next);
      return next;
    });
  };

  const resetProgress = () => {
    setCompletedSections(new Set());
    localStorage.removeItem(storageKey);
  };

  const totalSections = data.sections.length;
  const completedCount = completedSections.size;
  const progressPercent = totalSections > 0 ? Math.round((completedCount / totalSections) * 100) : 0;
  const allComplete = completedCount === totalSections;

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      {/* Background pattern */}
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)',
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-white/5 backdrop-blur-xl bg-black/20 sticky top-0 z-20">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link
                  href="/portal/training/walkthrough"
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <ArrowLeft size={18} className="text-neutral-400" />
                </Link>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">
                    {data.name}&apos;s Walkthrough
                  </h1>
                  <p className="text-sm text-neutral-400">{data.role}</p>
                </div>
              </div>
              <button
                onClick={resetProgress}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 text-xs transition-colors"
                title="Reset progress"
              >
                <RotateCcw size={14} />
                Reset
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-8">
          {/* Greeting */}
          <div className="mb-6">
            <p className="text-lg text-neutral-300">{data.greeting}</p>
            <p className="text-sm text-neutral-500 mt-1">{data.description}</p>
          </div>

          {/* Progress bar */}
          <div className="mb-8 rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-white">
                {completedCount} of {totalSections} sections ({progressPercent}%)
              </span>
              {allComplete && (
                <span className="text-xs font-semibold text-[#39FF14]">Complete!</span>
              )}
            </div>
            <div className="w-full h-2 rounded-full bg-white/10">
              <div
                className="h-2 rounded-full bg-[#39FF14] transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Certificate banner */}
          {allComplete && (
            <div className="mb-8 rounded-xl border border-[#39FF14]/30 bg-gradient-to-r from-[#39FF14]/10 to-emerald-500/10 p-6 text-center">
              <Award size={40} className="mx-auto mb-3 text-[#39FF14]" />
              <h3 className="text-lg font-bold text-white mb-1">
                Walkthrough Complete!
              </h3>
              <p className="text-sm text-neutral-300">
                Great job, {data.name}! You&apos;ve completed all {totalSections} sections of your personalized walkthrough.
              </p>
            </div>
          )}

          {/* Sections */}
          <div className="space-y-3">
            {data.sections.map((section) => {
              const isExpanded = expandedSections.has(section.id);
              const isComplete = completedSections.has(section.id);
              const SectionIcon = section.icon;

              return (
                <div
                  key={section.id}
                  className={`rounded-xl border transition-colors ${
                    isComplete
                      ? 'border-[#39FF14]/30 bg-[#39FF14]/[0.02]'
                      : 'border-zinc-800 bg-zinc-900/50'
                  }`}
                >
                  {/* Section header */}
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center gap-4 p-4 text-left"
                  >
                    {/* Number badge */}
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                        isComplete
                          ? 'bg-[#39FF14] text-black'
                          : 'bg-zinc-800 text-neutral-400'
                      }`}
                    >
                      {section.number}
                    </div>

                    {/* Icon */}
                    <div className="w-8 h-8 rounded-lg bg-black/30 flex items-center justify-center flex-shrink-0">
                      <SectionIcon size={16} className={section.iconColor} />
                    </div>

                    {/* Title & description */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-white">
                        {section.title}
                      </h3>
                      <p className="text-xs text-neutral-500 truncate">
                        {section.description}
                      </p>
                    </div>

                    {/* Completion check */}
                    {isComplete && (
                      <span className="text-[#39FF14] text-xs font-medium flex-shrink-0">Done</span>
                    )}

                    {/* Chevron */}
                    {isExpanded ? (
                      <ChevronUp size={18} className="text-neutral-500 flex-shrink-0" />
                    ) : (
                      <ChevronDown size={18} className="text-neutral-500 flex-shrink-0" />
                    )}
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-zinc-800/50">
                      <div className="space-y-5 mt-4">
                        {section.steps.map((step, stepIdx) => (
                          <div key={stepIdx}>
                            <h4 className="text-sm font-semibold text-white mb-2">
                              {step.title}
                            </h4>
                            <ul className="space-y-1.5 ml-1">
                              {step.bullets.map((bullet, bulletIdx) => (
                                <li
                                  key={bulletIdx}
                                  className="text-sm text-neutral-400 flex gap-2"
                                >
                                  <span className="text-neutral-600 mt-1 flex-shrink-0">
                                    &bull;
                                  </span>
                                  <span>{bullet}</span>
                                </li>
                              ))}
                            </ul>

                            {/* Tip box */}
                            {step.tip && (
                              <div className="mt-3 flex gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                <Lightbulb
                                  size={16}
                                  className="text-amber-400 flex-shrink-0 mt-0.5"
                                />
                                <p className="text-xs text-amber-200/80">
                                  {step.tip}
                                </p>
                              </div>
                            )}

                            {/* Try It link */}
                            {step.tryItLink && (
                              <Link
                                href={step.tryItLink.href}
                                className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors"
                              >
                                <ExternalLink size={12} />
                                {step.tryItLink.label}
                              </Link>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Mark complete button */}
                      <button
                        onClick={() => toggleComplete(section.id)}
                        className={`mt-5 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isComplete
                            ? 'bg-[#39FF14]/10 border border-[#39FF14]/30 text-[#39FF14]'
                            : 'bg-white/5 border border-white/10 text-neutral-300 hover:bg-white/10'
                        }`}
                      >
                        {isComplete ? (
                          <CheckSquare size={16} />
                        ) : (
                          <Square size={16} />
                        )}
                        {isComplete ? 'Completed' : 'Mark as Complete'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer navigation */}
          <div className="mt-8 flex items-center justify-between">
            <Link
              href="/portal/training/walkthrough"
              className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Walkthroughs
            </Link>
            <Link
              href="/portal/training"
              className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
            >
              Training Hub
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
