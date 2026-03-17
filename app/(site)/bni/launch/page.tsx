'use client';

import { useState, useCallback } from 'react';
import { ChevronRight, ExternalLink, CheckCircle, Play, X, RotateCcw } from 'lucide-react';

interface PresentationItem {
  id: string;
  label: string;
  description: string;
  url: string;
  icon: string;
  duration?: string;
}

const PRESENTATION_ORDER: PresentationItem[] = [
  {
    id: 'present-1',
    label: 'BNI Presentation (Main)',
    description: '6-slide company overview — who we are, what we do, ideal referral',
    url: '/bni/present',
    icon: '🎤',
    duration: '~60 sec',
  },
  {
    id: 'present-2',
    label: 'BNI Presentation (v2)',
    description: 'Alternate styling — services focus, before/after, trust signals',
    url: '/bni/present-2',
    icon: '📊',
    duration: '~60 sec',
  },
  {
    id: 'present-3',
    label: 'BNI Presentation (v3)',
    description: 'Live clock, clean layout — great for formal meetings',
    url: '/bni/present-3',
    icon: '🕐',
    duration: '~60 sec',
  },
  {
    id: 'report',
    label: 'Hail Damage Report Demo',
    description: 'Show a real storm report — 100 N Beaty St, Athens — HIGH risk, 8 hail events',
    url: '/bni/report',
    icon: '🧊',
    duration: '~2 min',
  },
  {
    id: 'portal',
    label: 'Customer Portal Demo',
    description: 'Walk through David Richardson\'s full journey — inspection to install, messages, documents, payments',
    url: '/bni/portal',
    icon: '🏠',
    duration: '~3 min',
  },
  {
    id: 'infographic1',
    label: 'Infographic 1',
    description: 'Visual marketing material',
    url: '/bni/infographic1',
    icon: '📈',
    duration: '~30 sec',
  },
  {
    id: 'infographic2',
    label: 'Infographic 2',
    description: 'Visual marketing material',
    url: '/bni/infographic2',
    icon: '📉',
    duration: '~30 sec',
  },
  {
    id: 'directory',
    label: 'BNI Partner Directory',
    description: 'Full partner listing — Limestone Leaders & TRC Huntsville chapters',
    url: '/bni',
    icon: '🤝',
    duration: 'Reference',
  },
];

export default function BNILaunchPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
  const [openWindow, setOpenWindow] = useState<Window | null>(null);

  const currentItem = PRESENTATION_ORDER[currentIndex];
  const allDone = completedItems.size >= PRESENTATION_ORDER.length;

  const openItem = useCallback(() => {
    const w = window.open(currentItem.url, 'bni_presentation', 'width=1200,height=800,scrollbars=yes');
    setOpenWindow(w);
  }, [currentItem]);

  const markDoneAndAdvance = useCallback(() => {
    // Close the window if it's still open
    if (openWindow && !openWindow.closed) {
      openWindow.close();
    }
    setOpenWindow(null);

    // Mark current as done
    setCompletedItems(prev => new Set([...prev, currentItem.id]));

    // Advance to next uncompleted item
    if (currentIndex < PRESENTATION_ORDER.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, currentItem, openWindow]);

  const jumpTo = (index: number) => {
    if (openWindow && !openWindow.closed) {
      openWindow.close();
    }
    setOpenWindow(null);
    setCurrentIndex(index);
  };

  const reset = () => {
    if (openWindow && !openWindow.closed) {
      openWindow.close();
    }
    setOpenWindow(null);
    setCompletedItems(new Set());
    setCurrentIndex(0);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <span className="text-2xl">🎯</span>
              BNI Presentation Launcher
            </h1>
            <p className="text-sm text-neutral-500">
              {completedItems.size}/{PRESENTATION_ORDER.length} complete
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Progress bar */}
            <div className="w-32 h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-green rounded-full transition-all duration-500"
                style={{ width: `${(completedItems.size / PRESENTATION_ORDER.length) * 100}%` }}
              />
            </div>
            <button
              onClick={reset}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              title="Reset"
            >
              <RotateCcw size={16} className="text-neutral-400" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Current Item - Big Card */}
        {!allDone && (
          <div className="mb-8 p-8 bg-gradient-to-br from-brand-green/10 via-emerald-500/5 to-transparent border-2 border-brand-green/30 rounded-3xl">
            <div className="flex items-center gap-2 text-brand-green text-sm font-medium mb-3">
              <Play size={14} />
              UP NEXT — Item {currentIndex + 1} of {PRESENTATION_ORDER.length}
            </div>

            <div className="flex items-start gap-4 mb-6">
              <span className="text-5xl">{currentItem.icon}</span>
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-1">{currentItem.label}</h2>
                <p className="text-neutral-400">{currentItem.description}</p>
                {currentItem.duration && (
                  <span className="inline-block mt-2 text-xs bg-white/10 px-2 py-1 rounded-full text-neutral-300">
                    {currentItem.duration}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={openItem}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-8 py-4 bg-brand-green hover:bg-lime-400 text-black font-bold rounded-xl text-lg transition-all active:scale-95"
              >
                <ExternalLink size={20} />
                Open
              </button>
              <button
                onClick={markDoneAndAdvance}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl text-lg transition-all active:scale-95"
              >
                <CheckCircle size={20} />
                Done — Next
                <ChevronRight size={18} />
              </button>
            </div>

            <p className="mt-4 text-xs text-neutral-600">
              Tip: Arrow keys / spacebar navigate slides. Press N for speaker notes.
            </p>
          </div>
        )}

        {/* All Done */}
        {allDone && (
          <div className="mb-8 p-8 bg-gradient-to-br from-yellow-500/10 via-amber-500/5 to-transparent border-2 border-yellow-500/30 rounded-3xl text-center">
            <span className="text-6xl block mb-4">🎉</span>
            <h2 className="text-3xl font-bold mb-2">All Done!</h2>
            <p className="text-neutral-400 mb-6">You've gone through all {PRESENTATION_ORDER.length} items.</p>
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 px-6 py-3 bg-brand-green hover:bg-lime-400 text-black font-bold rounded-xl transition-all"
            >
              <RotateCcw size={18} />
              Start Over
            </button>
          </div>
        )}

        {/* Item List */}
        <div className="space-y-2">
          {PRESENTATION_ORDER.map((item, idx) => {
            const isDone = completedItems.has(item.id);
            const isCurrent = idx === currentIndex && !allDone;

            return (
              <button
                key={item.id}
                onClick={() => jumpTo(idx)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                  isCurrent
                    ? 'bg-brand-green/10 border-brand-green/40 ring-1 ring-brand-green/20'
                    : isDone
                    ? 'bg-white/[0.02] border-white/5 opacity-60'
                    : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-white/10'
                }`}
              >
                {/* Number / Check */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                  isDone
                    ? 'bg-green-500/20 text-green-400'
                    : isCurrent
                    ? 'bg-brand-green/20 text-brand-green'
                    : 'bg-white/10 text-neutral-500'
                }`}>
                  {isDone ? <CheckCircle size={20} /> : idx + 1}
                </div>

                {/* Icon */}
                <span className="text-2xl flex-shrink-0">{item.icon}</span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold truncate ${isDone ? 'line-through text-neutral-500' : 'text-white'}`}>
                      {item.label}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] font-bold bg-brand-green text-black px-1.5 py-0.5 rounded-full animate-pulse">
                        NEXT
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 truncate">{item.description}</p>
                </div>

                {/* Duration */}
                {item.duration && (
                  <span className="text-xs text-neutral-600 flex-shrink-0 hidden sm:block">
                    {item.duration}
                  </span>
                )}

                {/* Arrow */}
                <ChevronRight size={16} className="text-neutral-600 flex-shrink-0" />
              </button>
            );
          })}
        </div>

        {/* Footer hint */}
        <p className="text-center text-neutral-600 text-xs mt-8">
          Click any item to jump to it. &quot;Done — Next&quot; closes the window and advances.
        </p>
      </div>
    </div>
  );
}
