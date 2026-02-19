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

export default function QuizzesPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) router.push('/portal');
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-brand-green" size={32} />
      </div>
    );
  }

  const [activeQuiz, setActiveQuiz] = useState<QuizData | null>(null);
  const [completedQuizzes, setCompletedQuizzes] = useState<Record<string, { score: number; total: number }>>({});

  const handleComplete = (score: number, total: number) => {
    if (activeQuiz) {
      setCompletedQuizzes(prev => ({
        ...prev,
        [activeQuiz.quizId]: { score, total }
      }));
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
        {Object.keys(completedQuizzes).length > 0 && (
          <div className="mb-8 p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center gap-6">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <div className="text-sm text-zinc-400">
              <span className="text-white font-medium">{Object.keys(completedQuizzes).length}</span> of {quizzes.length} completed
            </div>
            <div className="text-sm text-zinc-400">
              Average: <span className="text-white font-medium">
                {Math.round(
                  Object.values(completedQuizzes).reduce((acc, { score, total }) => acc + (score / total) * 100, 0) / 
                  Object.keys(completedQuizzes).length
                )}%
              </span>
            </div>
          </div>
        )}

        {/* Quiz cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((quiz) => {
            const colors = quizColors[quiz.quizId] || quizColors['company'];
            const Icon = iconMap[quiz.icon] || HelpCircle;
            const completed = completedQuizzes[quiz.quizId];

            return (
              <button
                key={quiz.quizId}
                onClick={() => setActiveQuiz(quiz)}
                className={`text-left p-6 rounded-2xl border bg-gradient-to-br ${colors.gradient} ${colors.border} transition-all duration-200 hover:scale-[1.02] group`}
              >
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

                {completed && (
                  <div className={`mt-4 pt-3 border-t ${
                    Math.round((completed.score / completed.total) * 100) >= quiz.passingScore
                      ? 'border-emerald-500/20'
                      : 'border-amber-500/20'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${
                        Math.round((completed.score / completed.total) * 100) >= quiz.passingScore
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }`}>
                        {Math.round((completed.score / completed.total) * 100)}% — {completed.score}/{completed.total}
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
