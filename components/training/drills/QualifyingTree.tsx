'use client';

/**
 * QualifyingTree — Drill sales_d2 — "Qualifying Decision Tree"
 *
 * Six sequential scenario cards. Each shows the homeowner's answer(s); the rep
 * picks one of four actions. Immediate feedback quotes the canonical qualifying
 * rule. Scenarios and rules are grounded in CANONICAL-sales-training.md §C
 * (qualifying logic) — the auto-qualify rule, renter/POA, roofer-vs-insurance,
 * and the denied → retail/reinspection path.
 *
 * Pass: 5 of 6. Client-graded — records via recordDrillResult (see DrillShell).
 */

import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  Trophy,
  RotateCcw,
  Quote,
  Home,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { DrillShell, recordDrillResult } from './DrillShell';

const DRILL_ID = 'sales_d2';
const DRILL_NAME = 'Qualifying Decision Tree';
const PASS_COUNT = 5;
const PASS_SCORE = 80;

// The four possible actions (stable indices used as answer keys).
const ACTIONS = [
  'Qualified — proceed',
  'Disqualified — leave card for owner',
  'Ask Q3',
  'Retail-prep / reinspection path',
] as const;

interface Scenario {
  /** Homeowner's answer(s) at the door. */
  quote: string;
  correct: number; // index into ACTIONS
  /** Verbatim (or verbatim-grounded) rule from canonical §C. */
  rule: string;
}

const SCENARIOS: Scenario[] = [
  {
    quote: 'Oh, I just rent here — the owner lives out of state.',
    correct: 1, // Disqualified
    rule:
      'We’re qualifying the home and we want to make sure they own the home cuz we need the owner there to give us permission to get on the roof. A renter with no authority disqualifies — “Great, could you pass my card to the owner?”',
  },
  {
    quote: 'It’s my mom’s house — I’m her caretaker and I have power of attorney.',
    correct: 0, // Qualified
    rule:
      'The son/daughter/niece caretaker screen: if he’s the power of attorney, that still qualifies and we can go to the second question.',
  },
  {
    quote:
      'We’ve owned it 12 years. Honestly it hasn’t been looked at since we bought the house.',
    correct: 0, // Qualified (auto-qualify; can skip Q3)
    rule:
      'If they haven’t had their roof inspected since the storm date, they automatically qualify. “Oh, I haven’t had it looked at since I bought the house.” — Okay, you’re qualified. You don’t even have to ask the third question.',
  },
  {
    quote: 'Somebody came out and looked at it a couple weeks ago.',
    correct: 2, // Ask Q3
    rule:
      'If it’s been somewhat recently, you probably still want to ask, because maybe they were denied. So hit them with Q3: “Was it a roofer or an insurance company? And what did they say?”',
  },
  {
    quote:
      'Our insurance sent an adjuster after the storm and they denied the claim.',
    correct: 3, // Retail-prep / reinspection
    rule:
      'Insurance inspected AND denied since the storm → this is the retail-prep path. You can file for a reinspection — the homeowner’s right to a second opinion — and/or set them up for a retail/cash job.',
  },
  {
    quote: 'A roofer looked last spring and said the roof was fine.',
    correct: 0, // Qualified
    rule:
      'A roofer’s look does not use up the insurance claim, and they haven’t been inspected by insurance since the storm — so they qualify. Handle the “it’s fine” with a fresh look: “things change with each storm, and a second opinion never hurts.”',
  },
];

export default function QualifyingTree() {
  const { user } = useAuth();
  const [step, setStep] = useState(0); // 0..5, then 6 = done
  const [picks, setPicks] = useState<(number | null)[]>(
    Array(SCENARIOS.length).fill(null),
  );

  const done = step >= SCENARIOS.length;
  const current = SCENARIOS[step];
  const picked = done ? null : picks[step];
  const answered = picked !== null;

  const correctCount = picks.reduce<number>(
    (n, p, i) => (p === SCENARIOS[i].correct ? n + 1 : n),
    0,
  );
  const score = Math.round((correctCount / SCENARIOS.length) * 100);
  const passed = correctCount >= PASS_COUNT;

  function pick(actionIndex: number) {
    if (answered) return;
    setPicks((prev) => {
      const next = [...prev];
      next[step] = actionIndex;
      return next;
    });
  }

  function reset() {
    setStep(0);
    setPicks(Array(SCENARIOS.length).fill(null));
    setRecorded(false);
  }

  const [recorded, setRecorded] = useState(false);
  useEffect(() => {
    if (done && !recorded) {
      setRecorded(true);
      void recordDrillResult(DRILL_ID, DRILL_NAME, score, passed, user);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  return (
    <DrillShell
      drillId={DRILL_ID}
      drillName={DRILL_NAME}
      instructions={
        done
          ? 'Results'
          : `Scenario ${step + 1} of ${SCENARIOS.length} — Read the homeowner’s answer and choose the right next move.`
      }
      onRetry={done ? undefined : reset}
    >
      {/* Progress dots */}
      {!done && (
        <div className="mb-4 flex items-center gap-1.5">
          {SCENARIOS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                picks[i] === null
                  ? i === step
                    ? 'bg-brand-green/50'
                    : 'bg-white/10'
                  : picks[i] === SCENARIOS[i].correct
                    ? 'bg-brand-green'
                    : 'bg-red-500/70'
              }`}
            />
          ))}
        </div>
      )}

      {!done && (
        <>
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <Home className="mt-0.5 h-5 w-5 shrink-0 text-white/40" />
            <p className="text-base font-medium text-white">
              {'“'}
              {current.quote}
              {'”'}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {ACTIONS.map((action, ai) => {
              const isCorrect = ai === current.correct;
              const isPicked = picked === ai;
              let cls =
                'border-white/15 bg-white/[0.03] text-white/80 hover:border-brand-green/40 hover:text-white';
              if (answered) {
                if (isCorrect)
                  cls = 'border-brand-green bg-brand-green/10 text-brand-green';
                else if (isPicked)
                  cls = 'border-red-500/60 bg-red-500/10 text-red-300';
                else cls = 'border-white/10 bg-white/[0.02] text-white/40';
              }
              return (
                <button
                  key={ai}
                  type="button"
                  disabled={answered}
                  onClick={() => pick(ai)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-3 text-left text-sm font-medium transition-colors ${cls}`}
                >
                  {answered && isCorrect && (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  )}
                  {answered && isPicked && !isCorrect && (
                    <XCircle className="h-4 w-4 shrink-0" />
                  )}
                  <span>{action}</span>
                </button>
              );
            })}
          </div>

          {answered && (
            <div
              className={`mt-4 rounded-lg border p-4 ${
                picked === current.correct
                  ? 'border-brand-green/40 bg-brand-green/[0.06]'
                  : 'border-amber-500/40 bg-amber-500/[0.06]'
              }`}
            >
              <p
                className={`mb-2 text-sm font-semibold ${
                  picked === current.correct
                    ? 'text-brand-green'
                    : 'text-amber-300'
                }`}
              >
                {picked === current.correct
                  ? 'Correct.'
                  : `Not quite — the move is “${ACTIONS[current.correct]}.”`}
              </p>
              <div className="flex gap-2 text-sm text-white/70">
                <Quote className="mt-0.5 h-4 w-4 shrink-0 text-brand-green/70" />
                <p className="italic">{current.rule}</p>
              </div>
            </div>
          )}

          <div className="mt-5 flex justify-end">
            {answered && (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-green px-4 py-2 text-sm font-semibold text-brand-black transition-opacity hover:opacity-90"
              >
                {step === SCENARIOS.length - 1 ? 'See results' : 'Next scenario'}
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </>
      )}

      {/* ── Final screen ── */}
      {done && (
        <div className="text-center">
          <div
            className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
              passed ? 'bg-brand-green/15' : 'bg-amber-500/15'
            }`}
          >
            {passed ? (
              <Trophy className="h-8 w-8 text-brand-green" />
            ) : (
              <RotateCcw className="h-8 w-8 text-amber-400" />
            )}
          </div>
          <h3 className="text-xl font-bold text-white">
            {passed ? 'Drill passed' : 'Keep practicing'}
          </h3>
          <p className="mt-1 text-4xl font-black tabular-nums text-white">
            {correctCount}
            <span className="text-lg font-semibold text-white/40">
              /{SCENARIOS.length}
            </span>
          </p>
          <p className="mt-1 text-sm text-white/50">
            Score {score}. {passed
              ? `You need ${PASS_COUNT} of ${SCENARIOS.length} — nice work.`
              : `You need ${PASS_COUNT} of ${SCENARIOS.length} (${PASS_SCORE}) to pass.`}
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-brand-green px-5 py-2.5 text-sm font-semibold text-brand-black transition-opacity hover:opacity-90"
          >
            <RotateCcw className="h-4 w-4" />
            Try again
          </button>
        </div>
      )}
    </DrillShell>
  );
}
