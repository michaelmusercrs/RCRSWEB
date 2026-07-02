'use client';

/**
 * Lesson Player — renders structured lessons from lib/lessons/.
 *
 * Mobile-first (Rick does this on his phone): one section at a time,
 * big touch targets, inline quiz with instant feedback. Completion posts
 * to /api/portal/training so it lands in the Training_Progress sheet tab
 * the office can audit.
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  AlertTriangle,
  Info,
  GraduationCap,
  PartyPopper,
} from 'lucide-react';
import { getLessonBySlug, type Lesson, type LessonBlock, type LessonQuizQuestion } from '@/lib/lessons';
import { useAuth } from '@/lib/auth-context';

const STORAGE_PREFIX = 'rcrs-lesson-progress-';

// Render **bold** spans inside plain text without a markdown dependency.
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function BlockView({ block }: { block: LessonBlock }) {
  switch (block.type) {
    case 'h':
      return <h3 className="text-lg font-bold text-white mt-5 mb-2"><RichText text={block.text} /></h3>;
    case 'p':
      return <p className="text-zinc-300 leading-relaxed mb-3"><RichText text={block.text} /></p>;
    case 'steps':
      return (
        <ol className="space-y-2 mb-4">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-zinc-300">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#0066CC] text-white text-sm font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
              <span className="leading-relaxed"><RichText text={item} /></span>
            </li>
          ))}
        </ol>
      );
    case 'bullets':
      return (
        <ul className="space-y-2 mb-4">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-zinc-300">
              <span className="text-[#0066CC] font-bold mt-0.5">•</span>
              <span className="leading-relaxed"><RichText text={item} /></span>
            </li>
          ))}
        </ul>
      );
    case 'callout': {
      const styles = {
        tip: { border: 'border-emerald-500/40', bg: 'bg-emerald-500/10', Icon: Lightbulb, iconColor: 'text-emerald-400' },
        warn: { border: 'border-amber-500/40', bg: 'bg-amber-500/10', Icon: AlertTriangle, iconColor: 'text-amber-400' },
        info: { border: 'border-blue-500/40', bg: 'bg-blue-500/10', Icon: Info, iconColor: 'text-blue-400' },
      }[block.tone];
      const { Icon } = styles;
      return (
        <div className={`flex gap-3 rounded-lg border ${styles.border} ${styles.bg} p-3.5 mb-4`}>
          <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${styles.iconColor}`} />
          <p className="text-sm text-zinc-200 leading-relaxed"><RichText text={block.text} /></p>
        </div>
      );
    }
    case 'table':
      return (
        <div className="overflow-x-auto mb-4 rounded-lg border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-900">
                {block.headers.map((h, i) => (
                  <th key={i} className="text-left px-3 py-2.5 text-zinc-400 font-semibold whitespace-nowrap"><RichText text={h} /></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className="border-t border-zinc-800">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2.5 text-zinc-300 align-top leading-relaxed"><RichText text={cell} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return null;
  }
}

function QuizQuestion({
  q,
  qKey,
  answer,
  onAnswer,
}: {
  q: LessonQuizQuestion;
  qKey: string;
  answer: number | undefined;
  onAnswer: (choice: number) => void;
}) {
  const answered = answer !== undefined;
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 mb-3">
      <p className="font-semibold text-white mb-3"><RichText text={q.question} /></p>
      <div className="space-y-2">
        {q.options.map((opt, i) => {
          let cls = 'border-zinc-700 bg-zinc-900 text-zinc-300 active:bg-zinc-800';
          if (answered) {
            if (i === q.correct) cls = 'border-emerald-500 bg-emerald-500/15 text-emerald-300';
            else if (i === answer) cls = 'border-red-500 bg-red-500/15 text-red-300';
            else cls = 'border-zinc-800 bg-zinc-900 text-zinc-500';
          }
          return (
            <button
              key={i}
              disabled={answered}
              onClick={() => onAnswer(i)}
              className={`w-full text-left rounded-lg border px-3.5 py-3 text-sm transition-colors ${cls}`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className={`mt-3 text-sm rounded-lg p-3 ${answer === q.correct ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-200'}`}>
          {answer === q.correct ? 'Correct. ' : 'Not quite. '}
          {q.explanation}
        </div>
      )}
    </div>
  );
}

export default function LessonPlayerPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const { user } = useAuth();

  const lesson: Lesson | undefined = useMemo(() => (slug ? getLessonBySlug(slug) : undefined), [slug]);

  const [sectionIdx, setSectionIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [completed, setCompleted] = useState(false);
  const [recorded, setRecorded] = useState(false);

  // Restore progress
  useEffect(() => {
    if (!slug) return;
    try {
      const saved = localStorage.getItem(STORAGE_PREFIX + slug);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.sectionIdx === 'number') setSectionIdx(parsed.sectionIdx);
        if (parsed.answers) setAnswers(parsed.answers);
        if (parsed.completed) setCompleted(true);
      }
    } catch { /* fresh start */ }
  }, [slug]);

  // Persist progress
  useEffect(() => {
    if (!slug) return;
    try {
      localStorage.setItem(STORAGE_PREFIX + slug, JSON.stringify({ sectionIdx, answers, completed }));
    } catch { /* storage full/blocked — non-fatal */ }
  }, [slug, sectionIdx, answers, completed]);

  if (!lesson) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-zinc-400 mb-4">Lesson not found.</p>
          <Link href="/portal/training/modules" className="text-[#0066CC] underline">Back to training modules</Link>
        </div>
      </div>
    );
  }

  const allQuestions = lesson.sections.flatMap((s, si) => (s.quiz || []).map((q, qi) => ({ key: `${si}-${qi}`, q })));
  const answeredCount = allQuestions.filter(({ key }) => answers[key] !== undefined).length;
  const correctCount = allQuestions.filter(({ key, q }) => answers[key] === q.correct).length;
  const score = allQuestions.length > 0 ? Math.round((correctCount / allQuestions.length) * 100) : 100;

  const section = lesson.sections[sectionIdx];
  const isLast = sectionIdx === lesson.sections.length - 1;
  const sectionQuiz = (section.quiz || []).map((q, qi) => ({ key: `${sectionIdx}-${qi}`, q }));
  const sectionAnswered = sectionQuiz.every(({ key }) => answers[key] !== undefined);

  const finishLesson = async () => {
    setCompleted(true);
    if (recorded) return;
    setRecorded(true);
    try {
      await fetch('/api/portal/training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.userId || 'unknown',
          userName: user?.name || 'Unknown',
          moduleId: lesson.moduleId,
          moduleName: lesson.title,
          score: String(score),
          passed: score >= 70,
          completedAt: new Date().toISOString(),
        }),
      });
    } catch { /* fire-and-forget; localStorage still has it */ }
  };

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/95 backdrop-blur border-b border-zinc-800 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/portal/training/modules" className="p-2 -ml-2 text-zinc-400 active:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <p className="text-sm font-bold truncate">{lesson.title}</p>
            <p className="text-xs text-zinc-500">{lesson.audience} · ~{lesson.estimatedMinutes} min</p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="max-w-2xl mx-auto mt-2 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full bg-[#0066CC] transition-all"
            style={{ width: `${((sectionIdx + (completed ? 1 : 0)) / lesson.sections.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-5">
        {completed ? (
          <div className="text-center py-12">
            <PartyPopper className="w-12 h-12 text-[#39FF14] mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Lesson complete!</h2>
            {allQuestions.length > 0 && (
              <p className="text-zinc-400 mb-1">
                Quiz score: <span className={score >= 70 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>{score}%</span>
                {' '}({correctCount}/{allQuestions.length})
              </p>
            )}
            <p className="text-sm text-zinc-500 mb-8">Your completion has been recorded.</p>
            <div className="flex flex-col gap-3 max-w-xs mx-auto">
              <button
                onClick={() => { setSectionIdx(0); setAnswers({}); setCompleted(false); setRecorded(false); }}
                className="rounded-lg border border-zinc-700 py-3 text-sm font-semibold text-zinc-300 active:bg-zinc-900"
              >
                Review again
              </button>
              <Link
                href="/portal/training/modules"
                className="rounded-lg bg-[#0066CC] py-3 text-sm font-bold text-white text-center active:bg-[#0066CC]/80"
              >
                Back to training
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap className="w-5 h-5 text-[#0066CC]" />
              <p className="text-xs uppercase tracking-wider text-zinc-500">
                Section {sectionIdx + 1} of {lesson.sections.length}
              </p>
            </div>
            <h2 className="text-xl font-bold mb-4">{section.title}</h2>

            {section.blocks.map((block, i) => (
              <BlockView key={i} block={block} />
            ))}

            {section.keyPoints && section.keyPoints.length > 0 && (
              <div className="rounded-lg border border-[#0066CC]/40 bg-[#0066CC]/10 p-4 my-5">
                <p className="text-xs uppercase tracking-wider text-[#4d9fff] font-bold mb-2">Remember</p>
                <ul className="space-y-1.5">
                  {section.keyPoints.map((kp, i) => (
                    <li key={i} className="flex gap-2 text-sm text-zinc-200">
                      <CheckCircle2 className="w-4 h-4 text-[#4d9fff] flex-shrink-0 mt-0.5" />
                      <span><RichText text={kp} /></span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {sectionQuiz.length > 0 && (
              <div className="my-5">
                <p className="text-xs uppercase tracking-wider text-zinc-500 font-bold mb-3">Quick check</p>
                {sectionQuiz.map(({ key, q }) => (
                  <QuizQuestion
                    key={key}
                    q={q}
                    qKey={key}
                    answer={answers[key]}
                    onAnswer={(choice) => setAnswers(prev => ({ ...prev, [key]: choice }))}
                  />
                ))}
              </div>
            )}

            {/* Nav */}
            <div className="flex gap-3 mt-8">
              {sectionIdx > 0 && (
                <button
                  onClick={() => { setSectionIdx(sectionIdx - 1); window.scrollTo(0, 0); }}
                  className="flex-1 rounded-lg border border-zinc-700 py-3.5 text-sm font-semibold text-zinc-300 active:bg-zinc-900 flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
              )}
              <button
                onClick={() => {
                  if (isLast) { finishLesson(); } else { setSectionIdx(sectionIdx + 1); }
                  window.scrollTo(0, 0);
                }}
                disabled={sectionQuiz.length > 0 && !sectionAnswered}
                className="flex-1 rounded-lg bg-[#0066CC] py-3.5 text-sm font-bold text-white disabled:opacity-40 active:bg-[#0066CC]/80 flex items-center justify-center gap-2"
              >
                {isLast ? 'Finish lesson' : 'Next'} {!isLast && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
            {sectionQuiz.length > 0 && !sectionAnswered && (
              <p className="text-center text-xs text-zinc-500 mt-2">Answer the quick check to continue</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
