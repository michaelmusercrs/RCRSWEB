'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  ArrowRight,
  Home,
  Command,
  BookOpen,
  CheckCircle2,
  XCircle,
  Lock,
  ChevronDown,
  ChevronRight,
  Award,
  RotateCcw,
  Monitor,
  Lightbulb,
  AlertTriangle,
  Trophy,
  GraduationCap,
  Printer,
  Quote,
  Info,
  // Module icons (names used by salesModules[].icon)
  DoorOpen,
  Users,
  FolderOpen,
  Wrench,
  Search,
  CloudHail,
  Camera,
  Table,
  FileSignature,
  Phone,
  ClipboardCheck,
  Flag,
  Package,
  MessageSquareWarning,
  Building2,
  GitBranch,
  type LucideIcon,
} from 'lucide-react';
import SettingsMenu from '@/components/SettingsMenu';
import { useAuth } from '@/lib/auth-context';
import {
  salesModules,
  salesParts,
  type SalesModule,
  type ContentSection,
} from '@/lib/sales-training-content';

// ============================================================================
// TYPES
// ============================================================================

interface ModuleProgress {
  score: number;
  passed: boolean;
  completedAt: string;
}

// ============================================================================
// ICON MAP — resolves the lucide-react name string on each module to a component
// ============================================================================

const ICON_MAP: Record<string, LucideIcon> = {
  DoorOpen,
  Users,
  FolderOpen,
  Wrench,
  Search,
  CloudHail,
  Camera,
  Table,
  FileSignature,
  Phone,
  ClipboardCheck,
  Flag,
  Package,
  MessageSquareWarning,
  Building2,
  GitBranch,
};

// ============================================================================
// DRILLS — only the drills that actually exist. d3/d5 render a placeholder.
// dynamic + ssr:false keeps drill components out of the server bundle.
// ============================================================================

const DRILLS: Record<string, any> = {
  sales_d1: dynamic(() => import('@/components/training/drills/ScriptBuilder'), { ssr: false }),
  sales_d2: dynamic(() => import('@/components/training/drills/QualifyingTree'), { ssr: false }),
  sales_d4: dynamic(() => import('@/components/training/drills/ContingencySequencer'), { ssr: false }),
};

// ============================================================================
// DERIVED STRUCTURES (from the static content — safe at module scope)
// ============================================================================

const TOTAL_MODULES = salesModules.length;

// Modules in Part order, with their part title + global 1..N number.
const orderedEntries = salesParts.flatMap((part) =>
  part.moduleIds
    .map((id) => salesModules.find((m) => m.id === id))
    .filter((m): m is SalesModule => !!m)
    .map((mod) => ({ mod, partTitle: part.title }))
);

const moduleNumberById: Record<string, number> = {};
orderedEntries.forEach((e, i) => {
  moduleNumberById[e.mod.id] = i + 1;
});

// Flattened (module, section) pairs — the projector slide deck for Present mode.
const flatPairs = orderedEntries.flatMap((entry, gIdx) =>
  entry.mod.sections.map((section, sIdx) => ({
    module: entry.mod,
    section,
    sectionIndex: sIdx,
    partTitle: entry.partTitle,
    moduleNumber: gIdx + 1,
  }))
);

const flatStartIndex: Record<string, number> = {};
flatPairs.forEach((p, i) => {
  if (flatStartIndex[p.module.id] === undefined) flatStartIndex[p.module.id] = i;
});

// Unlock rule: first module of each Part is always unlocked; every other module
// unlocks only when the PREVIOUS module IN THE SAME PART is passed.
const unlockInfo: Record<string, { firstInPart: boolean; prevId: string | null }> = {};
for (const part of salesParts) {
  part.moduleIds.forEach((id, i) => {
    unlockInfo[id] = { firstInPart: i === 0, prevId: i === 0 ? null : part.moduleIds[i - 1] };
  });
}

// ============================================================================
// SECTION RENDERER — shared by the accordion (normal) and the projector slides
// ============================================================================

function SectionBody({ section, present }: { section: ContentSection; present: boolean }) {
  const bodyText = present ? 'text-xl leading-relaxed text-neutral-300' : 'text-sm text-neutral-300';

  return (
    <>
      <div className={present ? 'space-y-3' : 'space-y-2'}>
        {section.content.map((line, i) => {
          if (line === '') return <div key={i} className="h-3" />;
          if (line.startsWith('- '))
            return (
              <p key={i} className={`${bodyText} pl-4 before:content-['\\2022'] before:mr-2 before:text-brand-green`}>
                {line.slice(2)}
              </p>
            );
          if (line.match(/^\d+\./)) return <p key={i} className={`${bodyText} pl-4`}>{line}</p>;
          if (line === line.toUpperCase() && line.length > 3 && !line.startsWith('"'))
            return <p key={i} className={present ? 'text-2xl font-semibold text-white mt-3' : 'text-sm font-semibold text-white mt-3'}>{line}</p>;
          return <p key={i} className={bodyText}>{line}</p>;
        })}
      </div>

      {/* Boston Says talk tracks */}
      {section.talkTracks?.map((tt, i) => (
        <div key={i} className="mt-4 rounded-lg border-l-4 border-brand-green bg-brand-green/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Quote size={present ? 18 : 14} className="text-brand-green" />
            <span className={`font-semibold text-brand-green ${present ? 'text-base' : 'text-xs'}`}>Boston Says</span>
          </div>
          <p className={`italic text-white/90 ${present ? 'text-2xl leading-relaxed' : 'text-sm'}`}>{tt.text}</p>
          {tt.context && (
            <p className={`mt-2 text-neutral-500 ${present ? 'text-sm' : 'text-xs'}`}>{tt.context}</p>
          )}
        </div>
      ))}

      {/* Callout */}
      {section.callout && (
        <div
          className={`mt-4 rounded-lg border p-4 ${
            section.callout.tone === 'warning'
              ? 'border-amber-500/40 bg-amber-500/10'
              : 'border-blue-500/40 bg-blue-500/10'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            {section.callout.tone === 'warning' ? (
              <AlertTriangle size={present ? 18 : 15} className="text-amber-400 flex-shrink-0" />
            ) : (
              <Info size={present ? 18 : 15} className="text-blue-400 flex-shrink-0" />
            )}
            <span
              className={`font-bold ${section.callout.tone === 'warning' ? 'text-amber-300' : 'text-blue-300'} ${
                present ? 'text-lg' : 'text-sm'
              }`}
            >
              {section.callout.title}
            </span>
          </div>
          <p
            className={`${section.callout.tone === 'warning' ? 'text-amber-100/80' : 'text-blue-100/80'} ${
              present ? 'text-lg' : 'text-sm'
            }`}
          >
            {section.callout.text}
          </p>
        </div>
      )}

      {/* Image — real handbook diagrams, natural aspect ratio (varying page sizes) */}
      {section.image && (
        <figure className="mt-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={section.image.src}
            alt={section.image.alt}
            loading="lazy"
            className={`h-auto rounded border border-neutral-800 ${present ? 'max-h-[70vh] w-auto mx-auto' : 'max-w-full'}`}
          />
          <figcaption className={`mt-2 text-neutral-500 ${present ? 'text-base' : 'text-xs'}`}>
            {section.image.caption}
          </figcaption>
        </figure>
      )}

      {/* Media — NotebookLM audio/video overviews */}
      {section.media && (
        <div className="mt-4 rounded-lg border border-brand-green/20 bg-brand-green/5 p-4">
          <div className={`mb-2 font-semibold text-brand-green ${present ? 'text-base' : 'text-sm'}`}>
            {section.media.kind === 'audio' ? '🎧 Audio Overview' : '▶ Video Overview'} — {section.media.title}
          </div>
          {section.media.kind === 'audio' ? (
            <audio controls preload="none" className="w-full">
              <source src={section.media.src} />
            </audio>
          ) : (
            <video controls preload="none" className={`w-full rounded ${present ? 'max-h-[60vh]' : ''}`}>
              <source src={section.media.src} />
            </video>
          )}
        </div>
      )}

      {/* Pro tips */}
      {section.proTips && section.proTips.length > 0 && (
        <div className="mt-4 rounded-lg bg-brand-green/5 border border-brand-green/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb size={present ? 18 : 16} className="text-brand-green" />
            <span className={`font-semibold text-brand-green ${present ? 'text-base' : 'text-sm'}`}>Pro Tips</span>
          </div>
          {section.proTips.map((tip, i) => (
            <p key={i} className={`text-neutral-300 mt-1 ${present ? 'text-lg' : 'text-sm'}`}>{tip}</p>
          ))}
        </div>
      )}

      {/* Drill */}
      {section.drillId &&
        (() => {
          if (present) {
            return (
              <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.02] p-6 text-center text-neutral-400 text-lg">
                Reps complete this exercise on their own.
              </div>
            );
          }
          const Drill = DRILLS[section.drillId];
          if (Drill) {
            return (
              <div className="mt-4">
                <Drill />
              </div>
            );
          }
          return (
            <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.02] p-4 text-center text-neutral-400 text-sm">
              Interactive drill coming soon — your trainer will walk you through this one.
            </div>
          );
        })()}

      {/* Source note */}
      {section.sourceNote && (
        <p className={`mt-4 italic text-neutral-500 ${present ? 'text-sm' : 'text-xs'}`}>{section.sourceNote}</p>
      )}
    </>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const STORAGE_KEY = 'rcrs-sales-training-progress';
const USER_SETTINGS_KEY = 'rcrs-user-settings';

function getUserIdentity(): { userId: string; userName: string } {
  if (typeof window === 'undefined') return { userId: 'anonymous', userName: 'Sales Trainee' };
  try {
    const raw = localStorage.getItem(USER_SETTINGS_KEY);
    if (raw) {
      const settings = JSON.parse(raw);
      return {
        userId: settings.email || settings.userId || 'anonymous',
        userName: settings.displayName || settings.name || 'Sales Trainee',
      };
    }
  } catch { /* ignore */ }
  return { userId: 'anonymous', userName: 'Sales Trainee' };
}

function loadProgress(): Record<string, ModuleProgress> {
  if (typeof window === 'undefined') return {};
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function saveProgress(progress: Record<string, ModuleProgress>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function SalesTrainingPage() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<Record<string, ModuleProgress>>({});
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'content' | 'quiz'>('content');
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [correctAnswers, setCorrectAnswers] = useState<Record<string, number> | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const [syncError, setSyncError] = useState(false);

  // Present (projector) mode
  const [present, setPresent] = useState(false);
  const [presentIndex, setPresentIndex] = useState<number | null>(null);

  const canPresent =
    user?.role === 'owner' || user?.role === 'admin' || user?.role === 'manager';

  // Load progress on mount
  useEffect(() => {
    const loaded = loadProgress();
    setProgress(loaded);
    fetchServerProgress(loaded);
  }, []);

  // Read ?present=1 on mount WITHOUT useSearchParams (avoids Suspense/prerender break)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('present=1')) {
      setPresent(true);
    }
  }, []);

  // Keyboard navigation for the projector slide deck
  useEffect(() => {
    if (!(present && presentIndex !== null)) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        setPresentIndex((i) => (i === null ? 0 : Math.min(flatPairs.length - 1, i + 1)));
      } else if (e.key === 'ArrowLeft') {
        setPresentIndex((i) => (i === null ? 0 : Math.max(0, i - 1)));
      } else if (e.key === 'Escape') {
        setPresentIndex(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [present, presentIndex]);

  const fetchServerProgress = useCallback(async (localProgress: Record<string, ModuleProgress>) => {
    try {
      const res = await fetch('/api/portal/training/sales');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.moduleScores) {
        const merged = { ...localProgress };
        for (const [moduleId, info] of Object.entries(data.moduleScores)) {
          const serverInfo = info as { score: number; passed: boolean; completedAt: string };
          const existing = merged[moduleId];
          if (!existing || serverInfo.score > existing.score) {
            merged[moduleId] = {
              score: serverInfo.score,
              passed: serverInfo.passed,
              completedAt: serverInfo.completedAt,
            };
          }
        }
        setProgress(merged);
        saveProgress(merged);
      }
    } catch {
      // Server not available, use local only
    }
  }, []);

  const activeModule = salesModules.find(m => m.id === activeModuleId) || null;

  const completedCount = salesModules.filter(m => progress[m.id]?.passed).length;
  const overallProgress = Math.round((completedCount / TOTAL_MODULES) * 100);
  const allComplete = completedCount === TOTAL_MODULES;

  // Unlock logic (per-Part)
  const isModuleUnlocked = (moduleId: string): boolean => {
    if (present) return true;
    const info = unlockInfo[moduleId];
    if (!info || info.firstInPart || !info.prevId) return true;
    return !!progress[info.prevId]?.passed;
  };

  const getModuleStatus = (moduleId: string): 'locked' | 'available' | 'in-progress' | 'completed' => {
    if (progress[moduleId]?.passed) return 'completed';
    if (!isModuleUnlocked(moduleId)) return 'locked';
    if (progress[moduleId]) return 'in-progress';
    return 'available';
  };

  const toggleSection = (idx: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // Open a module (Present mode jumps into the slide deck instead)
  const openModule = (moduleId: string) => {
    if (present) {
      const idx = flatStartIndex[moduleId];
      if (idx !== undefined) setPresentIndex(idx);
      return;
    }
    if (!isModuleUnlocked(moduleId)) return;
    setActiveModuleId(moduleId);
    setActiveView('content');
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizScore(null);
    setCorrectAnswers(null);
    setExpandedSections(new Set([0]));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Toggle Present mode from the header
  const togglePresent = () => {
    setPresent(p => !p);
    setPresentIndex(null);
    setActiveModuleId(null);
  };

  // Submit quiz — server grades (client no longer holds correctIndex)
  const submitQuiz = async () => {
    if (!activeModule || present) return;

    const answersMap: Record<string, number> = {};
    for (const q of activeModule.quiz) {
      if (quizAnswers[q.id] !== undefined) {
        answersMap[q.id] = quizAnswers[q.id];
      }
    }

    try {
      const res = await fetch('/api/portal/training/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.userId || 'unknown',
          userName: user?.name || 'Unknown',
          moduleId: activeModule.id,
          moduleName: activeModule.title,
          answers: answersMap,
          completedAt: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        setSyncError(true);
        setTimeout(() => setSyncError(false), 5000);
        return;
      }

      const data = await res.json();
      const serverScore = typeof data.score === 'number' ? data.score : 0;
      const serverPassed =
        typeof data.passed === 'boolean' ? data.passed : serverScore >= activeModule.passingScore;

      setQuizScore(serverScore);
      setCorrectAnswers(
        data.correctAnswers && typeof data.correctAnswers === 'object' ? data.correctAnswers : null
      );
      setQuizSubmitted(true);
      setSyncError(false);

      const existingBest = progress[activeModule.id];
      if (!existingBest || serverScore > existingBest.score) {
        const newProgress = {
          ...progress,
          [activeModule.id]: {
            score: serverScore,
            passed: serverPassed,
            completedAt: new Date().toISOString(),
          },
        };
        setProgress(newProgress);
        saveProgress(newProgress);
      }
    } catch {
      setSyncError(true);
      setTimeout(() => setSyncError(false), 5000);
    }
  };

  const retakeQuiz = () => {
    setQuizAnswers({});
    setQuizSubmitted(false);
    setQuizScore(null);
    setCorrectAnswers(null);
  };

  const backToList = () => {
    setActiveModuleId(null);
    setActiveView('content');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // =========================================================================
  // RENDER: Present mode — projector slide deck (one section at a time)
  // =========================================================================
  if (present && presentIndex !== null && flatPairs[presentIndex]) {
    const pair = flatPairs[presentIndex];
    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
        <div className="relative z-10 min-h-screen flex flex-col">
          <header className="border-b border-white/5 backdrop-blur-xl bg-black/20">
            <div className="max-w-5xl mx-auto px-8 py-5 flex items-start justify-between gap-6">
              <div className="min-w-0">
                <p className="text-base text-brand-green font-semibold">{pair.module.title}</p>
                <h1 className="text-3xl md:text-4xl font-bold text-white mt-1">{pair.section.heading}</h1>
              </div>
              <button
                onClick={() => setPresentIndex(null)}
                className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-sm transition-colors"
              >
                <XCircle size={16} />
                Exit slide
              </button>
            </div>
          </header>

          <main className="flex-1 w-full max-w-5xl mx-auto px-8 py-8 overflow-y-auto">
            <SectionBody section={pair.section} present />
          </main>

          <footer className="border-t border-white/10 bg-black/30 px-8 py-4">
            <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
              <button
                onClick={() => setPresentIndex((i) => (i === null ? 0 : Math.max(0, i - 1)))}
                disabled={presentIndex === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ArrowLeft size={16} />
                Prev
              </button>
              <p className="text-sm text-neutral-400 text-center flex-1">
                {pair.partTitle} · Module {pair.moduleNumber} of {TOTAL_MODULES} · {pair.module.title}
              </p>
              <button
                onClick={() =>
                  setPresentIndex((i) => (i === null ? 0 : Math.min(flatPairs.length - 1, i + 1)))
                }
                disabled={presentIndex === flatPairs.length - 1}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next
                <ArrowRight size={16} />
              </button>
            </div>
            <p className="text-center text-xs text-neutral-600 mt-2">
              Press Esc to exit · Arrow keys to navigate
            </p>
          </footer>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: Module Detail View
  // =========================================================================
  if (activeModule) {
    const allQuestionsAnswered = activeModule.quiz.every(q => quizAnswers[q.id] !== undefined);

    return (
      <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
        <div className="fixed inset-0 opacity-30 pointer-events-none">
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)', backgroundSize: '50px 50px' }} />
        </div>
        <div className="relative z-10">
          {/* Sync error banner */}
          {syncError && (
            <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-medium shadow-lg backdrop-blur-xl">
                <AlertTriangle size={14} />
                Progress could not be saved. Please try submitting again.
              </div>
            </div>
          )}
          <header className="border-b border-white/5 backdrop-blur-xl bg-black/20 sticky top-0 z-20">
            <div className="max-w-4xl mx-auto px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button onClick={backToList} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                    <ArrowLeft size={18} className="text-neutral-400" />
                  </button>
                  <div>
                    <h1 className="text-lg font-bold text-white">{activeModule.title}</h1>
                    <p className="text-xs text-neutral-400">{activeModule.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveView('content')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeView === 'content' ? 'bg-brand-green/20 text-brand-green border border-brand-green/30' : 'text-neutral-400 hover:text-white'}`}
                  >
                    Content
                  </button>
                  <button
                    onClick={() => setActiveView('quiz')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeView === 'quiz' ? 'bg-brand-green/20 text-brand-green border border-brand-green/30' : 'text-neutral-400 hover:text-white'}`}
                  >
                    Quiz ({activeModule.quiz.length} questions)
                  </button>
                </div>
              </div>
            </div>
          </header>

          <main className="max-w-4xl mx-auto px-6 py-8">
            {/* CONTENT VIEW */}
            {activeView === 'content' && (
              <div className="space-y-4">
                {activeModule.sections.map((section, idx) => {
                  const isExpanded = expandedSections.has(idx);
                  const panelId = `section-panel-${activeModule.id}-${idx}`;
                  const buttonId = `section-btn-${activeModule.id}-${idx}`;
                  return (
                    <div key={idx} className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
                      <button
                        id={buttonId}
                        onClick={() => toggleSection(idx)}
                        aria-expanded={isExpanded}
                        aria-controls={panelId}
                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-brand-green/10 flex items-center justify-center text-brand-green text-sm font-bold">
                            {idx + 1}
                          </div>
                          <span className="text-white font-medium text-left">{section.heading}</span>
                        </div>
                        {isExpanded ? <ChevronDown size={18} className="text-neutral-400" /> : <ChevronRight size={18} className="text-neutral-400" />}
                      </button>
                      {isExpanded && (
                        <div id={panelId} role="region" aria-labelledby={buttonId} className="px-6 pb-5 border-t border-white/5">
                          <div className="mt-4">
                            <SectionBody section={section} present={false} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Continue to Quiz button */}
                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => { setActiveView('quiz'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-green text-black font-semibold hover:bg-brand-green/90 transition-colors"
                  >
                    Take the Quiz
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            )}

            {/* QUIZ VIEW */}
            {activeView === 'quiz' && (
              <div className="space-y-6">
                {/* Quiz Header */}
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
                  <h2 className="text-xl font-bold text-white mb-1">{activeModule.title} Quiz</h2>
                  <p className="text-sm text-neutral-400">
                    Answer all {activeModule.quiz.length} questions. You need {activeModule.passingScore}% to pass.
                    {progress[activeModule.id] && ` Best score: ${progress[activeModule.id].score}%`}
                  </p>
                </div>

                {/* Questions */}
                {activeModule.quiz.map((q, qIdx) => {
                  const selected = quizAnswers[q.id];
                  const correct = correctAnswers ? correctAnswers[q.id] : undefined;
                  const graded = quizSubmitted && correct !== undefined;
                  const isCorrect = graded && selected === correct;
                  return (
                    <div
                      key={q.id}
                      className={`rounded-xl border p-6 ${
                        graded
                          ? isCorrect
                            ? 'border-green-500/30 bg-green-500/5'
                            : 'border-red-500/30 bg-red-500/5'
                          : 'border-white/5 bg-white/[0.02]'
                      }`}
                    >
                      <p className="text-white font-medium mb-4">
                        <span className="text-brand-green mr-2">{qIdx + 1}.</span>
                        {q.question}
                      </p>
                      <div className="space-y-2">
                        {q.options.map((opt, oIdx) => {
                          const isSelected = selected === oIdx;
                          const showCorrect = graded && oIdx === correct;
                          const showWrong = graded && isSelected && oIdx !== correct;

                          return (
                            <button
                              key={oIdx}
                              onClick={() => {
                                if (quizSubmitted) return;
                                setQuizAnswers(prev => ({ ...prev, [q.id]: oIdx }));
                              }}
                              disabled={quizSubmitted}
                              className={`w-full text-left px-4 py-3 rounded-lg text-sm transition-colors border ${
                                showCorrect
                                  ? 'border-green-500/50 bg-green-500/10 text-green-300'
                                  : showWrong
                                    ? 'border-red-500/50 bg-red-500/10 text-red-300'
                                    : isSelected
                                      ? 'border-brand-green/50 bg-brand-green/10 text-white'
                                      : 'border-white/5 bg-white/[0.02] text-neutral-300 hover:bg-white/[0.05]'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0 ${
                                  showCorrect ? 'border-green-500 bg-green-500' :
                                  showWrong ? 'border-red-500 bg-red-500' :
                                  isSelected ? 'border-brand-green bg-brand-green' :
                                  'border-neutral-600'
                                }`}>
                                  {showCorrect && <CheckCircle2 size={14} className="text-white" />}
                                  {showWrong && <XCircle size={14} className="text-white" />}
                                  {isSelected && !quizSubmitted && <div className="w-2 h-2 rounded-full bg-black" />}
                                </div>
                                <span>{opt}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      {quizSubmitted && (
                        <p className="mt-3 text-sm text-neutral-400 pl-9">{q.explanation}</p>
                      )}
                    </div>
                  );
                })}

                {/* Quiz Actions */}
                <div className="flex items-center justify-between pt-4">
                  {!quizSubmitted ? (
                    <>
                      <button
                        onClick={() => { setActiveView('content'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        className="text-neutral-400 hover:text-white text-sm transition-colors"
                      >
                        Back to Content
                      </button>
                      <button
                        onClick={submitQuiz}
                        disabled={!allQuestionsAnswered}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-colors ${allQuestionsAnswered ? 'bg-brand-green text-black hover:bg-brand-green/90' : 'bg-neutral-700 text-neutral-400 cursor-not-allowed'}`}
                      >
                        Submit Quiz
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Score Display */}
                      <div className="flex items-center gap-4">
                        {quizScore !== null && quizScore >= activeModule.passingScore ? (
                          <div className="flex items-center gap-2 text-green-400">
                            <CheckCircle2 size={20} />
                            <span className="font-semibold">Passed! {quizScore}%</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-red-400">
                            <XCircle size={20} />
                            <span className="font-semibold">Score: {quizScore}% (Need {activeModule.passingScore}%)</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {quizScore !== null && quizScore < activeModule.passingScore && (
                          <button
                            onClick={retakeQuiz}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-neutral-300 hover:bg-white/5 transition-colors"
                          >
                            <RotateCcw size={16} />
                            Retake Quiz
                          </button>
                        )}
                        {quizScore !== null && quizScore >= activeModule.passingScore && (
                          <button
                            onClick={backToList}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-green text-black font-semibold hover:bg-brand-green/90 transition-colors"
                          >
                            Continue
                            <ArrowRight size={18} />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: Module List View (grouped by Part)
  // =========================================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 25px 25px, rgba(255,255,255,0.03) 2px, transparent 0)', backgroundSize: '50px 50px' }} />
      </div>
      <div className="relative z-10">
        {/* Sync error banner */}
        {syncError && (
          <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-medium shadow-lg backdrop-blur-xl">
              <AlertTriangle size={14} />
              Progress could not be saved. Please try submitting again.
            </div>
          </div>
        )}

        {/* Header */}
        <header className="border-b border-white/5 backdrop-blur-xl bg-black/20 sticky top-0 z-20">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/portal/training" className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
                  <ArrowLeft size={18} className="text-neutral-400" />
                </Link>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-tight">Sales Training</h1>
                  <p className="text-sm text-neutral-400">Door-to-Claim Sales Program · /portal/salesTraining</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {canPresent && (
                  <button
                    onClick={togglePresent}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                      present
                        ? 'bg-brand-green/20 border-brand-green/40 text-brand-green'
                        : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Monitor size={16} />
                    Present
                  </button>
                )}
                <Link href="/command-center" className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-green/20 to-emerald-500/20 hover:from-brand-green/30 hover:to-emerald-500/30 border border-brand-green/30 text-brand-green text-sm font-medium transition-all">
                  <Command size={16} />
                  RoofStack HQ
                </Link>
                <Link href="/" target="_blank" className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 text-sm transition-colors">
                  <Home size={16} />
                  View Site
                </Link>
                <SettingsMenu />
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-8">
          {present && (
            <div className="rounded-xl border border-brand-green/30 bg-brand-green/10 p-4 mb-6 flex items-center gap-3">
              <Monitor size={18} className="text-brand-green flex-shrink-0" />
              <p className="text-sm text-brand-green">
                Present mode is on. All modules are unlocked; pick one to start the projector slides. Quizzes and drills are hidden.
              </p>
            </div>
          )}

          {/* Overall Progress */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-white">Your Progress</h2>
                <p className="text-sm text-neutral-400">{completedCount} of {TOTAL_MODULES} modules completed</p>
              </div>
              {allComplete && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30">
                  <Trophy size={18} className="text-amber-400" />
                  <span className="text-sm font-semibold text-amber-400">Training Complete!</span>
                </div>
              )}
            </div>
            <div
              className="w-full h-3 rounded-full bg-neutral-800 overflow-hidden"
              role="progressbar"
              aria-valuenow={overallProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Sales training progress: ${overallProgress}%`}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-green to-emerald-500 transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <p className="text-right text-xs text-neutral-500 mt-1">{overallProgress}%</p>
          </div>

          {/* Certificate Banner */}
          {allComplete && (
            <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-6 mb-8 text-center print:border-amber-600 print:bg-white print:text-black">
              <Award size={48} className="mx-auto text-amber-400 mb-3 print:text-amber-600" />
              <h3 className="text-xl font-bold text-white mb-2 print:text-black">RCRS Sales Training Certificate</h3>
              <p className="text-neutral-300 mb-1 print:text-neutral-300">
                This certifies that <strong className="text-white print:text-black">{getUserIdentity().userName}</strong> has completed the RCRS Sales Training Program.
              </p>
              <p className="text-sm text-neutral-400 print:text-neutral-500 mb-1">All {TOTAL_MODULES} modules passed.</p>
              <div className="text-xs text-neutral-500 print:text-neutral-500 mb-4 space-y-0.5">
                {salesModules.map(mod => {
                  const mp = progress[mod.id];
                  return mp ? (
                    <span key={mod.id} className="inline-block mx-2">{mod.title}: {mp.score}%</span>
                  ) : null;
                })}
              </div>
              <p className="text-xs text-neutral-500 print:text-neutral-500 mb-4">
                Certificate ID: RCRS-SALES-{getUserIdentity().userId.slice(0, 8).toUpperCase()}-{new Date().getFullYear()}
              </p>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 text-sm font-medium hover:bg-amber-500/30 transition-colors print:hidden"
              >
                <Printer size={16} />
                Print Certificate
              </button>
            </div>
          )}

          {/* Module List — grouped by Part */}
          <div className="space-y-8">
            {salesParts.map((part) => (
              <div key={part.title}>
                <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-3">{part.title}</h3>
                <div className="space-y-3">
                  {part.moduleIds.map((id) => {
                    const mod = salesModules.find(m => m.id === id);
                    if (!mod) return null;
                    const status = getModuleStatus(id);
                    const Icon = ICON_MAP[mod.icon] ?? BookOpen;
                    const modProgress = progress[id];
                    const num = moduleNumberById[id];

                    return (
                      <button
                        key={id}
                        onClick={() => openModule(id)}
                        disabled={status === 'locked'}
                        className={`w-full text-left rounded-xl border p-5 transition-all ${
                          status === 'completed'
                            ? 'border-green-500/30 bg-green-500/5 hover:bg-green-500/10'
                            : status === 'locked'
                              ? 'border-white/5 bg-white/[0.01] opacity-50 cursor-not-allowed'
                              : status === 'in-progress'
                                ? 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10'
                                : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            status === 'completed' ? 'bg-green-500/20' :
                            status === 'locked' ? 'bg-neutral-800' :
                            status === 'in-progress' ? 'bg-amber-500/20' :
                            'bg-brand-green/10'
                          }`}>
                            {status === 'completed' ? (
                              <CheckCircle2 size={24} className="text-green-400" />
                            ) : status === 'locked' ? (
                              <Lock size={24} className="text-neutral-600" />
                            ) : (
                              <Icon size={24} className={status === 'in-progress' ? 'text-amber-400' : 'text-brand-green'} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-neutral-500 font-medium">MODULE {num}</span>
                              {status === 'completed' && modProgress && (
                                <span className="text-xs text-green-400 font-medium">Score: {modProgress.score}%</span>
                              )}
                              {status === 'in-progress' && modProgress && (
                                <span className="text-xs text-amber-400 font-medium">Score: {modProgress.score}% (retake needed)</span>
                              )}
                            </div>
                            <h3 className="text-white font-semibold">{mod.title}</h3>
                            <p className="text-sm text-neutral-400 truncate">{mod.description}</p>
                          </div>
                          <div className="flex-shrink-0 flex items-center gap-2 text-neutral-500">
                            <BookOpen size={14} />
                            <span className="text-xs">{mod.estimatedMinutes} min</span>
                            {status !== 'locked' && (
                              <ArrowRight size={16} className="ml-2" />
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Continue Learning - Cross Navigation */}
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-3">Continue Learning</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link href="/portal/training/onboarding" className="rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:bg-white/[0.05] transition-colors group">
                <Monitor size={20} className="text-blue-400 mb-2" />
                <h4 className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors">Platform Onboarding</h4>
                <p className="text-xs text-neutral-500 mt-1">Learn the RCRS interface and tools</p>
              </Link>
              <Link href="/portal/training/library" className="rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:bg-white/[0.05] transition-colors group">
                <GraduationCap size={20} className="text-purple-400 mb-2" />
                <h4 className="text-sm font-semibold text-white group-hover:text-purple-400 transition-colors">Training Library</h4>
                <p className="text-xs text-neutral-500 mt-1">Audio, video, quizzes, and flashcards</p>
              </Link>
              <Link href="/portal/training" className="rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:bg-white/[0.05] transition-colors group">
                <BookOpen size={20} className="text-brand-green mb-2" />
                <h4 className="text-sm font-semibold text-white group-hover:text-brand-green transition-colors">Training Hub</h4>
                <p className="text-xs text-neutral-500 mt-1">All training paths in one place</p>
              </Link>
            </div>
          </div>

          {/* Info Footer */}
          <div className="mt-8 rounded-xl border border-white/5 bg-white/[0.02] p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-white">Important Notes</p>
                <ul className="text-xs text-neutral-400 mt-1 space-y-1">
                  <li>- The first module of each Part is unlocked. Pass a module to unlock the next one in that Part.</li>
                  <li>- You need 80% or higher to pass each quiz.</li>
                  <li>- You can retake quizzes as many times as needed.</li>
                  <li>- Your progress is saved automatically.</li>
                  <li>- Complete all {TOTAL_MODULES} modules to earn your Sales Training Certificate.</li>
                </ul>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
