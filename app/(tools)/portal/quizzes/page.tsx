'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Target, BarChart3, Building2, Trophy, Clock, HelpCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import QuizEngine from '@/components/portal/QuizEngine';
import type { QuizData } from '@/components/portal/QuizEngine';
import Link from 'next/link';

import salesRepQuiz from '@/data/training/quizzes/sales-rep-quiz.json';
import operationsQuiz from '@/data/training/quizzes/operations-quiz.json';
import companyQuiz from '@/data/training/quizzes/company-quiz.json';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

const iconMap: Record<string, React.ElementType> = {
  Target,
  BarChart3,
  Building2,
};

const quizzes: QuizData[] = [
  salesRepQuiz as QuizData,
  operationsQuiz as QuizData,
  companyQuiz as QuizData,
];

const quizColors: Record<string, { gradient: string; border: string; badge: string }> = {
  'sales-rep': {
    gradient: 'from-orange-500/10 to-red-500/10',
    border: 'border-orange-500/20 hover:border-orange-500/40',
    badge: 'bg-orange-500/10 text-orange-400',
  },
  'operations': {
    gradient: 'from-blue-500/10 to-cyan-500/10',
    border: 'border-blue-500/20 hover:border-blue-500/40',
    badge: 'bg-blue-500/10 text-blue-400',
  },
  'company': {
    gradient: 'from-emerald-500/10 to-green-500/10',
    border: 'border-emerald-500/20 hover:border-emerald-500/40',
    badge: 'bg-emerald-500/10 text-emerald-400',
  },
};

// localStorage key for persisting quiz results
const QUIZ_STORAGE_KEY = 'rcrs-quiz-results';

function loadSavedQuizResults(): Record<string, { score: number; total: number; date: string }> {
  try {
    const raw = localStorage.getItem(QUIZ_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveQuizResults(results: Record<string, { score: number; total: number; date: string }>) {
  try {
    localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(results));
  } catch { /* ignore */ }
}

async function persistQuizToServer(
  user: { userId: string; name: string },
  quizId: string,
  quizTitle: string,
  score: number,
  total: number,
  passingScore: number,
) {
  try {
    const pct = Math.round((score / total) * 100);
    await fetch('/api/portal/training', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.userId,
        userName: user.name,
        moduleId: `quiz_${quizId}`,
        moduleName: quizTitle,
        score: String(pct),
        passed: pct >= passingScore,
        completedAt: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.warn('Failed to persist quiz result to server:', err);
  }
}

export default function QuizzesPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [activeQuiz, setActiveQuiz] = useState<QuizData | null>(null);
  const [completedQuizzes, setCompletedQuizzes] = useState<Record<string, { score: number; total: number }>>({});
  const [serverProgress, setServerProgress] = useState<Record<string, { score: number; passed: boolean; date: string }>>({});

  useEffect(() => {
    if (!isLoading && !user) router.push('/portal');
  }, [user, isLoading, router]);

  // Load saved quiz results from localStorage + server on mount
  useEffect(() => {
    if (!user) return;

    // Load from localStorage
    const saved = loadSavedQuizResults();
    const mapped: Record<string, { score: number; total: number }> = {};
    for (const [quizId, data] of Object.entries(saved)) {
      mapped[quizId] = { score: data.score, total: data.total };
    }
    setCompletedQuizzes(mapped);

    // Load from server (Google Sheets) for cross-session persistence
    fetch(`/api/portal/training?userId=${encodeURIComponent(user.userId)}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.success && Array.isArray(data.records)) {
          const serverResults: Record<string, { score: number; passed: boolean; date: string }> = {};
          for (const record of data.records) {
            // Match quiz records (moduleId starts with quiz_)
            if (record.moduleId?.startsWith('quiz_')) {
              const quizId = record.moduleId.replace('quiz_', '');
              const score = parseInt(record.score || '0', 10);
              const existing = serverResults[quizId];
              // Keep best score
              if (!existing || score > existing.score) {
                serverResults[quizId] = {
                  score,
                  passed: record.passed?.toLowerCase() === 'true',
                  date: record.completedAt || '',
                };
              }
            }
          }
          setServerProgress(serverResults);
        }
      })
      .catch(() => { /* ignore network errors */ });
  }, [user]);

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-brand-green" size={32} />
      </div>
    );
  }

  const handleComplete = (score: number, total: number) => {
    if (activeQuiz) {
      // Update React state
      setCompletedQuizzes(prev => ({
        ...prev,
        [activeQuiz.quizId]: { score, total }
      }));

      // Persist to localStorage
      const saved = loadSavedQuizResults();
      saved[activeQuiz.quizId] = { score, total, date: new Date().toISOString() };
      saveQuizResults(saved);

      // Persist to server (Google Sheets) -- fire and forget
      persistQuizToServer(user, activeQuiz.quizId, activeQuiz.title, score, total, activeQuiz.passingScore);
    }
  };

  if (activeQuiz) {
    return (
      <div className="min-h-screen bg-zinc-950 p-4 sm:p-8">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => setActiveQuiz(null)}
            className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6 text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Quizzes
          </button>
          
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">{activeQuiz.title}</h1>
            <p className="text-zinc-400 mt-1">{activeQuiz.description}</p>
          </div>

          <QuizEngine
            quiz={activeQuiz}
            onComplete={handleComplete}
            onBack={() => setActiveQuiz(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link
            href="/portal"
            className="flex items-center gap-2 text-zinc-400 hover:text-white mb-4 text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Portal
          </Link>
          <h1 className="text-3xl font-bold text-white">Onboarding Quizzes</h1>
          <p className="text-zinc-400 mt-2">
            Not your average corporate training. Test what you actually need to know to succeed at RCRS.
          </p>
        </div>

        {/* Stats bar */}
        {(() => {
          // Merge local + server results for unique quiz count
          const allQuizIds = new Set([
            ...Object.keys(completedQuizzes),
            ...Object.keys(serverProgress),
          ]);
          const passedCount = Array.from(allQuizIds).filter(qid => {
            const local = completedQuizzes[qid];
            const server = serverProgress[qid];
            if (local) {
              const quiz = quizzes.find(q => q.quizId === qid);
              return quiz && Math.round((local.score / local.total) * 100) >= quiz.passingScore;
            }
            return server?.passed;
          }).length;

          if (allQuizIds.size === 0) return null;

          // Calculate average from local results (more accurate) + server-only results
          const scores: number[] = [];
          for (const qid of allQuizIds) {
            const local = completedQuizzes[qid];
            if (local) {
              scores.push(Math.round((local.score / local.total) * 100));
            } else if (serverProgress[qid]) {
              scores.push(serverProgress[qid].score);
            }
          }
          const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

          return (
            <div className="mb-8 p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center gap-6">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <div className="text-sm text-zinc-400">
                <span className="text-white font-medium">{allQuizIds.size}</span> of {quizzes.length} attempted
              </div>
              <div className="text-sm text-zinc-400">
                Passed: <span className={`font-medium ${passedCount > 0 ? 'text-emerald-400' : 'text-white'}`}>
                  {passedCount}/{quizzes.length}
                </span>
              </div>
              <div className="text-sm text-zinc-400">
                Average: <span className="text-white font-medium">{avg}%</span>
              </div>
            </div>
          );
        })()}

        {/* Quiz cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((quiz) => {
            const colors = quizColors[quiz.quizId] || quizColors['company'];
            const Icon = iconMap[quiz.icon] || HelpCircle;
            const completed = completedQuizzes[quiz.quizId];
            // Fall back to server progress if no local result
            const serverResult = serverProgress[quiz.quizId];
            const hasResult = completed || serverResult;
            const displayScore = completed
              ? Math.round((completed.score / completed.total) * 100)
              : serverResult?.score || 0;
            const displayPassed = completed
              ? displayScore >= quiz.passingScore
              : serverResult?.passed || false;

            return (
              <button
                key={quiz.quizId}
                onClick={() => setActiveQuiz(quiz)}
                className={`text-left p-6 rounded-2xl border bg-gradient-to-br ${colors.gradient} ${colors.border} transition-all duration-200 hover:scale-[1.02] group relative`}
              >
                {/* Pass badge */}
                {hasResult && displayPassed && (
                  <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                    <Trophy className="w-4 h-4 text-white" />
                  </div>
                )}

                <div className={`inline-flex p-2.5 rounded-xl ${colors.badge} mb-4`}>
                  <Icon className="w-5 h-5" />
                </div>

                <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-white/90">
                  {quiz.title}
                </h3>
                <p className="text-sm text-zinc-400 mb-4 leading-relaxed line-clamp-2">
                  {quiz.description}
                </p>

                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  <span className="flex items-center gap-1">
                    <HelpCircle className="w-3.5 h-3.5" />
                    {quiz.questions.length} questions
                  </span>
                  <span className="flex items-center gap-1">
                    <Target className="w-3.5 h-3.5" />
                    {quiz.passingScore}% to pass
                  </span>
                </div>

                {hasResult && (
                  <div className={`mt-4 pt-3 border-t ${
                    displayPassed
                      ? 'border-emerald-500/20'
                      : 'border-amber-500/20'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${
                        displayPassed
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }`}>
                        {displayScore}%{completed ? ` — ${completed.score}/${completed.total}` : ''}
                      </span>
                      <span className="text-xs text-zinc-500">Retake →</span>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Tips section */}
        <div className="mt-12 p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800">
          <h3 className="text-lg font-semibold text-white mb-3">💡 Pro Tips</h3>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li>• <strong className="text-zinc-300">Read the explanations</strong> — even on questions you get right. There&apos;s gold in there.</li>
            <li>• <strong className="text-zinc-300">Wrong answers teach more than right ones.</strong> Don&apos;t rush past the explanation.</li>
            <li>• <strong className="text-zinc-300">Take quizzes more than once.</strong> Spaced repetition is how knowledge sticks.</li>
            <li>• <strong className="text-zinc-300">Score below 80%?</strong> Hit the training modules, then come back and crush it.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
