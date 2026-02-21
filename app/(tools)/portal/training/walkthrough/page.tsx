'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  UserCircle,
  Home,
  Command,
} from 'lucide-react';
import { walkthroughs } from '@/lib/walkthrough-data';
import type { WalkthroughData } from '@/lib/walkthrough-data/types';
import SettingsMenu from '@/components/SettingsMenu';

export default function WalkthroughHubPage() {
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});

  // Load progress for all walkthroughs
  useEffect(() => {
    const map: Record<string, number> = {};
    walkthroughs.forEach((w) => {
      try {
        const saved = localStorage.getItem(`rcrs-walkthrough-${w.slug}-progress`);
        if (saved) {
          const arr = JSON.parse(saved);
          map[w.slug] = Array.isArray(arr) ? arr.length : 0;
        } else {
          map[w.slug] = 0;
        }
      } catch {
        map[w.slug] = 0;
      }
    });
    setProgressMap(map);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      {/* Background Pattern */}
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
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link
                  href="/portal/training"
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <ArrowLeft size={18} className="text-neutral-400" />
                </Link>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">
                    Personal Walkthroughs
                  </h1>
                  <p className="text-sm text-neutral-400">
                    Find your name and start your personalized guide
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/command-center"
                  className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-green/20 to-emerald-500/20 hover:from-brand-green/30 hover:to-emerald-500/30 border border-brand-green/30 text-brand-green text-sm font-medium transition-all"
                >
                  <Command size={16} />
                  RoofStack HQ
                </Link>
                <Link
                  href="/"
                  target="_blank"
                  className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 text-sm transition-colors"
                >
                  <Home size={16} />
                  View Site
                </Link>
                <SettingsMenu />
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-8">
          {/* Hero */}
          <div className="text-center mb-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-brand-green/20 to-emerald-500/20 border border-brand-green/20 flex items-center justify-center">
              <UserCircle size={32} className="text-brand-green" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">
              Your Personal Walkthrough
            </h2>
            <p className="text-neutral-400 max-w-2xl mx-auto">
              Each walkthrough is tailored to your role. You&apos;ll see only the features
              you use daily, with &ldquo;Try It&rdquo; links to jump straight into each tool.
              Track your progress and earn a completion certificate.
            </p>
          </div>

          {/* Walkthrough cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {walkthroughs.map((w: WalkthroughData) => {
              const Icon = w.icon;
              const completed = progressMap[w.slug] || 0;
              const total = w.sections.length;
              const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

              return (
                <Link
                  key={w.slug}
                  href={`/portal/training/walkthrough/${w.slug}`}
                  className={`group block rounded-2xl border ${w.borderColor} bg-gradient-to-br ${w.accentGradient} p-6 hover:scale-[1.02] transition-all duration-200`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-black/30 flex items-center justify-center">
                      <Icon size={24} className={w.accentColor} />
                    </div>
                    <ArrowRight
                      size={20}
                      className="text-neutral-500 group-hover:text-white group-hover:translate-x-1 transition-all"
                    />
                  </div>

                  <h3 className="text-lg font-bold text-white mb-0.5">
                    {w.name}
                  </h3>
                  <p className="text-sm text-neutral-300 mb-3">{w.role}</p>
                  <p className="text-sm text-neutral-400 mb-4 line-clamp-2">
                    {w.description}
                  </p>

                  {/* Mini progress bar */}
                  <div className="mt-auto">
                    <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
                      <span>{total} sections</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-black/30">
                      <div
                        className="h-1.5 rounded-full bg-[#39FF14] transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Info section */}
          <div className="mt-12 rounded-2xl border border-white/5 bg-white/[0.02] p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              How Walkthroughs Work
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-green/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-brand-green font-bold text-sm">1</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Find Your Name</p>
                  <p className="text-xs text-neutral-400 mt-1">
                    Select the walkthrough created specifically for your role.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-green/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-brand-green font-bold text-sm">2</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Walk Through Each Section</p>
                  <p className="text-xs text-neutral-400 mt-1">
                    Read tips, follow steps, and use &ldquo;Try It&rdquo; links to explore each feature.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand-green/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-brand-green font-bold text-sm">3</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Mark Complete</p>
                  <p className="text-xs text-neutral-400 mt-1">
                    Check off sections as you go. Complete all sections for your certificate.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
