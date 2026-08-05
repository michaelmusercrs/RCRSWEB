'use client';

/**
 * ScriptBuilder — Drill sales_d1 — "Door-Knock Script Builder"
 *
 * Three rounds of tap-to-order chip assembly. All script content is VERBATIM
 * from CANONICAL-sales-training.md §A.1–A.4 (Boston Muse's recorded door script).
 * Distractors are the forbidden openers Boston explicitly warns against.
 *
 *   Round 1 (40 pts): assemble the verbatim intro from correct fragments mixed
 *                     with FORBIDDEN opener distractors.
 *   Round 2 (30 pts): order the 3 qualifying questions; optional Q4 accepted
 *                     only in position 4.
 *   Round 3 (30 pts): for 3 homeowner answers, pick the correct adjective-bridge
 *                     response (bare adjective + move on).
 *
 * Pass: R1 exact order AND zero forbidden chips EVER placed; R2 exact; R3 >=2/3.
 * Client-graded — records via recordDrillResult (see DrillShell cheat note).
 */

import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  Trophy,
  Quote,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { DrillShell, recordDrillResult } from './DrillShell';

const DRILL_ID = 'sales_d1';
const DRILL_NAME = 'Door-Knock Script Builder';
const PASS_SCORE = 80;

// ── Content (VERBATIM from canonical §A.1–A.4) ─────────────────────────────

interface Chip {
  id: string;
  text: string;
  forbidden?: boolean;
}

// Round 1 — the intro. Correct order is c1..c5.
const R1_CORRECT: Chip[] = [
  { id: 'c1', text: 'Hey there,' },
  { id: 'c2', text: 'I am [your name]' },
  { id: 'c3', text: 'with River City Roofing Solutions,' },
  { id: 'c4', text: 'and I am in your area inspecting wind and hail damage' },
  { id: 'c5', text: 'due to the storms that came through on [date].' },
];
const R1_FORBIDDEN: Chip[] = [
  { id: 'f1', text: 'How are you doing today?', forbidden: true },
  { id: 'f2', text: 'Hope I’m not bothering you...', forbidden: true },
  { id: 'f3', text: 'Umm, so...', forbidden: true },
  { id: 'f4', text: 'Hope you’re having a good day!', forbidden: true },
];
const R1_POOL: Chip[] = [...R1_CORRECT, ...R1_FORBIDDEN];
const R1_ORDER = R1_CORRECT.map((c) => c.id);

// Round 2 — the three qualifying questions (+ optional Q4 in position 4).
const R2_POOL: Chip[] = [
  { id: 'q1', text: 'How long have you owned the home?' },
  { id: 'q2', text: 'When was the last time your roof was inspected?' },
  { id: 'q3', text: 'Was it a roofer or an insurance company? And what did they say?' },
  { id: 'q4', text: 'Do you know how old the roof is?' },
];
const R2_CORE = ['q1', 'q2', 'q3'];

// Round 3 — adjective-bridge multiple choice. Correct = bare adjective + move on.
interface BridgeQ {
  answer: string;
  options: string[];
  correctIndex: number;
}
const R3_QUESTIONS: BridgeQ[] = [
  {
    answer: 'Seven years.',
    options: [
      'Seven years, huh? Oh wow, that’s great.', // repeats their answer
      'Great — when was the last time your roof was inspected?', // correct
      'Umm, okay... so, uh...', // filler
    ],
    correctIndex: 1,
  },
  {
    answer: 'Not since we bought it.',
    options: [
      'Awesome. Was it a roofer or an insurance company, and what did they say?', // correct
      'Not since you bought it? Okay, gotcha.', // repeats their answer
      'Hope I’m not bothering you here.', // filler / can-of-worms opener
    ],
    correctIndex: 0,
  },
  {
    answer: 'A roofer, last spring.',
    options: [
      'A roofer last spring, okay, that’s great.', // repeats their answer
      'Umm, alright then, let me see here...', // filler
      'Awesome — here’s my information.', // correct (final affirmation)
    ],
    correctIndex: 2,
  },
];

// Verbatim coaching shown on feedback (canonical §A.1, §A.2, §C, §A.4).
const R1_COACH =
  'The scripted intro, verbatim: “Hey there, I am [name] with River City Roofing Solutions, and I am in your area inspecting wind and hail damage due to the storms that came through on [date].” That’s the big three things everybody wants to know as soon as they open the door. The openers you left out — “how are you doing,” “hope I’m not bothering you,” “hope you’re having a good day,” “umm” — all of that’s opening up a can of worms.';
const R1_COACH_FORBIDDEN =
  'You placed a forbidden opener. Boston: “Not how are you doing... Not hey, hope you’re having a good day. Hope I’m not bothering you. Nope. All of that’s opening up a can of worms.” Start clean with “Hey there.”';
const R2_COACH =
  'Order: “How long have you owned the home?” first — “we need the owner there to give us permission to get on the roof.” Then “When was the last time your roof was inspected?” Then “Was it a roofer or an insurance company? And what did they say?” “Do you know how old the roof is?” is a great optional add — but only after the first three.';
const R3_COACH =
  'You use some sort of adjective and go immediately to the next question. Great, awesome, wonderful, glad to hear it. What you don’t want to do is ums, standing, looking around — or repeating what the person said, cuz that’s a way people know you’re stalling. You only got so much time at the door to make a connection with this homeowner.';

// ── Helpers ────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Component ───────────────────────────────────────────────────────────────

type Phase = 1 | 2 | 3 | 'done';

export default function ScriptBuilder() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>(1);

  // Round 1 state
  const [order1, setOrder1] = useState<string[]>(R1_POOL.map((c) => c.id));
  const [placed1, setPlaced1] = useState<string[]>([]);
  const [forbiddenTouched, setForbiddenTouched] = useState(false);
  const [checked1, setChecked1] = useState(false);

  // Round 2 state
  const [order2, setOrder2] = useState<string[]>(R2_POOL.map((c) => c.id));
  const [placed2, setPlaced2] = useState<string[]>([]);
  const [checked2, setChecked2] = useState(false);

  // Round 3 state
  const [answers3, setAnswers3] = useState<(number | null)[]>([null, null, null]);
  const [checked3, setChecked3] = useState(false);

  // Shuffle chip pools on mount only (avoids SSR/CSR hydration mismatch).
  useEffect(() => {
    setOrder1(shuffle(R1_POOL.map((c) => c.id)));
    setOrder2(shuffle(R2_POOL.map((c) => c.id)));
  }, []);

  const chipById = (id: string): Chip =>
    [...R1_POOL, ...R2_POOL].find((c) => c.id === id)!;

  // ── Round results ──
  const pass1 =
    !forbiddenTouched &&
    placed1.length === R1_ORDER.length &&
    placed1.every((id, i) => id === R1_ORDER[i]);

  const pass2 =
    placed2.length >= 3 &&
    placed2[0] === R2_CORE[0] &&
    placed2[1] === R2_CORE[1] &&
    placed2[2] === R2_CORE[2] &&
    (placed2.length === 3 || (placed2.length === 4 && placed2[3] === 'q4'));

  const correct3 = answers3.reduce<number>(
    (n, sel, i) => (sel === R3_QUESTIONS[i].correctIndex ? n + 1 : n),
    0,
  );
  const pass3 = correct3 >= 2;

  const totalScore =
    (pass1 ? 40 : 0) + (pass2 ? 30 : 0) + Math.round((correct3 / 3) * 30);
  const passedAll = pass1 && pass2 && pass3;

  // ── Round 1/2 chip handlers ──
  function tapTray(round: 1 | 2, id: string) {
    if (round === 1) {
      if (checked1) return;
      const chip = chipById(id);
      if (chip.forbidden) setForbiddenTouched(true);
      setPlaced1((p) => [...p, id]);
    } else {
      if (checked2) return;
      setPlaced2((p) => [...p, id]);
    }
  }
  function tapPlaced(round: 1 | 2, id: string) {
    if (round === 1) {
      if (checked1) return;
      setPlaced1((p) => p.filter((x) => x !== id));
    } else {
      if (checked2) return;
      setPlaced2((p) => p.filter((x) => x !== id));
    }
  }

  // ── Reset ──
  function resetAll() {
    setPhase(1);
    setOrder1(shuffle(R1_POOL.map((c) => c.id)));
    setPlaced1([]);
    setForbiddenTouched(false);
    setChecked1(false);
    setOrder2(shuffle(R2_POOL.map((c) => c.id)));
    setPlaced2([]);
    setChecked2(false);
    setAnswers3([null, null, null]);
    setChecked3(false);
  }

  // Record the result once, when we reach the done screen.
  const [recorded, setRecorded] = useState(false);
  useEffect(() => {
    if (phase === 'done' && !recorded) {
      setRecorded(true);
      void recordDrillResult(DRILL_ID, DRILL_NAME, totalScore, passedAll, user);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Reset the "recorded" latch whenever we leave the done screen.
  useEffect(() => {
    if (phase !== 'done') setRecorded(false);
  }, [phase]);

  const instructions =
    phase === 1
      ? 'Round 1 of 3 — Tap the fragments in order to build Boston’s intro. Skip the forbidden openers.'
      : phase === 2
        ? 'Round 2 of 3 — Tap the qualifying questions into the right order.'
        : phase === 3
          ? 'Round 3 of 3 — Pick the right adjective-bridge response to each answer.'
          : 'Results';

  return (
    <DrillShell
      drillId={DRILL_ID}
      drillName={DRILL_NAME}
      instructions={instructions}
      onRetry={phase === 'done' ? undefined : resetAll}
    >
      {/* Progress dots */}
      {phase !== 'done' && (
        <div className="mb-4 flex items-center gap-2">
          {[1, 2, 3].map((r) => (
            <div
              key={r}
              className={`h-1.5 flex-1 rounded-full ${
                r < (phase as number)
                  ? 'bg-brand-green'
                  : r === phase
                    ? 'bg-brand-green/50'
                    : 'bg-white/10'
              }`}
            />
          ))}
        </div>
      )}

      {/* ── ROUND 1 ── */}
      {phase === 1 && (
        <RoundChips
          placed={placed1}
          trayIds={order1.filter((id) => !placed1.includes(id))}
          chipById={chipById}
          onTapTray={(id) => tapTray(1, id)}
          onTapPlaced={(id) => tapPlaced(1, id)}
          checked={checked1}
          locked={checked1}
          emptyHint="Tap fragments below to build the line..."
        />
      )}

      {/* ── ROUND 2 ── */}
      {phase === 2 && (
        <RoundChips
          placed={placed2}
          trayIds={order2.filter((id) => !placed2.includes(id))}
          chipById={chipById}
          onTapTray={(id) => tapTray(2, id)}
          onTapPlaced={(id) => tapPlaced(2, id)}
          checked={checked2}
          locked={checked2}
          emptyHint="Tap questions below to set their order..."
        />
      )}

      {/* ── ROUND 3 ── */}
      {phase === 3 && (
        <div className="space-y-5">
          {R3_QUESTIONS.map((q, qi) => (
            <div
              key={qi}
              className="rounded-lg border border-white/10 bg-white/[0.02] p-4"
            >
              <p className="mb-3 text-sm text-white/60">
                Homeowner says:{' '}
                <span className="font-semibold text-white">
                  {'“'}
                  {q.answer}
                  {'”'}
                </span>
              </p>
              <div className="space-y-2">
                {q.options.map((opt, oi) => {
                  const selected = answers3[qi] === oi;
                  const isCorrect = oi === q.correctIndex;
                  let cls =
                    'border-white/15 bg-white/[0.03] text-white/80 hover:border-brand-green/40';
                  if (checked3) {
                    if (isCorrect)
                      cls = 'border-brand-green bg-brand-green/10 text-brand-green';
                    else if (selected)
                      cls = 'border-red-500/60 bg-red-500/10 text-red-300';
                    else cls = 'border-white/10 bg-white/[0.02] text-white/40';
                  } else if (selected) {
                    cls = 'border-brand-green bg-brand-green/10 text-white';
                  }
                  return (
                    <button
                      key={oi}
                      type="button"
                      disabled={checked3}
                      onClick={() =>
                        setAnswers3((a) => {
                          const next = [...a];
                          next[qi] = oi;
                          return next;
                        })
                      }
                      className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors ${cls}`}
                    >
                      {checked3 && isCorrect && (
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                      )}
                      {checked3 && selected && !isCorrect && (
                        <XCircle className="h-4 w-4 shrink-0" />
                      )}
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Feedback (after a round is checked) ── */}
      {((phase === 1 && checked1) ||
        (phase === 2 && checked2) ||
        (phase === 3 && checked3)) && (
        <Feedback
          passed={phase === 1 ? pass1 : phase === 2 ? pass2 : pass3}
          coach={
            phase === 1
              ? forbiddenTouched
                ? R1_COACH_FORBIDDEN
                : R1_COACH
              : phase === 2
                ? R2_COACH
                : R3_COACH
          }
          detail={
            phase === 3
              ? `You got ${correct3} of 3 correct.`
              : undefined
          }
        />
      )}

      {/* ── Controls ── */}
      {phase !== 'done' && (
        <div className="mt-5 flex items-center justify-end gap-3">
          {phase === 1 && !checked1 && (
            <ActionButton
              disabled={placed1.length === 0}
              onClick={() => setChecked1(true)}
            >
              Check the intro
            </ActionButton>
          )}
          {phase === 1 && checked1 && (
            <ActionButton onClick={() => setPhase(2)}>
              Next round <ArrowRight className="h-4 w-4" />
            </ActionButton>
          )}
          {phase === 2 && !checked2 && (
            <ActionButton
              disabled={placed2.length === 0}
              onClick={() => setChecked2(true)}
            >
              Check the order
            </ActionButton>
          )}
          {phase === 2 && checked2 && (
            <ActionButton onClick={() => setPhase(3)}>
              Next round <ArrowRight className="h-4 w-4" />
            </ActionButton>
          )}
          {phase === 3 && !checked3 && (
            <ActionButton
              disabled={answers3.some((a) => a === null)}
              onClick={() => setChecked3(true)}
            >
              Check answers
            </ActionButton>
          )}
          {phase === 3 && checked3 && (
            <ActionButton onClick={() => setPhase('done')}>
              See results <ArrowRight className="h-4 w-4" />
            </ActionButton>
          )}
        </div>
      )}

      {/* ── Final pass/fail screen ── */}
      {phase === 'done' && (
        <ResultScreen
          score={totalScore}
          passed={passedAll}
          rows={[
            { label: 'Round 1 — Intro', pass: pass1, pts: pass1 ? 40 : 0, max: 40 },
            { label: 'Round 2 — Qualifying order', pass: pass2, pts: pass2 ? 30 : 0, max: 30 },
            {
              label: `Round 3 — Adjective bridge (${correct3}/3)`,
              pass: pass3,
              pts: Math.round((correct3 / 3) * 30),
              max: 30,
            },
          ]}
          onRetry={resetAll}
        />
      )}
    </DrillShell>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function RoundChips({
  placed,
  trayIds,
  chipById,
  onTapTray,
  onTapPlaced,
  checked,
  locked,
  emptyHint,
}: {
  placed: string[];
  trayIds: string[];
  chipById: (id: string) => Chip;
  onTapTray: (id: string) => void;
  onTapPlaced: (id: string) => void;
  checked: boolean;
  locked: boolean;
  emptyHint: string;
}) {
  return (
    <div className="space-y-4">
      {/* Assembled line */}
      <div className="min-h-[3.5rem] rounded-lg border border-dashed border-white/15 bg-white/[0.02] p-3">
        {placed.length === 0 ? (
          <p className="py-1 text-sm text-white/35">{emptyHint}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {placed.map((id, i) => {
              const chip = chipById(id);
              const border = checked
                ? chip.forbidden
                  ? 'border-red-500 bg-red-500/15 text-red-300'
                  : 'border-brand-green bg-brand-green/10 text-brand-green'
                : 'border-brand-green/50 bg-brand-green/5 text-white';
              return (
                <button
                  key={id}
                  type="button"
                  disabled={locked}
                  onClick={() => onTapPlaced(id)}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition-colors ${border} ${
                    locked ? 'cursor-default' : 'hover:opacity-80'
                  }`}
                >
                  <span className="text-xs font-bold opacity-60">{i + 1}</span>
                  {chip.text}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Tray */}
      {!locked && (
        <div className="flex flex-wrap gap-2">
          {trayIds.map((id) => {
            const chip = chipById(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => onTapTray(id)}
                className="rounded-md border border-white/15 bg-white/[0.04] px-2.5 py-1.5 text-sm text-white/80 transition-colors hover:border-brand-green/50 hover:text-white"
              >
                {chip.text}
              </button>
            );
          })}
          {trayIds.length === 0 && (
            <p className="text-sm text-white/35">
              All chips placed. Tap a placed chip to send it back.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Feedback({
  passed,
  coach,
  detail,
}: {
  passed: boolean;
  coach: string;
  detail?: string;
}) {
  return (
    <div
      className={`mt-5 rounded-lg border p-4 ${
        passed
          ? 'border-brand-green/40 bg-brand-green/[0.06]'
          : 'border-amber-500/40 bg-amber-500/[0.06]'
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        {passed ? (
          <CheckCircle2 className="h-5 w-5 text-brand-green" />
        ) : (
          <XCircle className="h-5 w-5 text-amber-400" />
        )}
        <span
          className={`text-sm font-semibold ${
            passed ? 'text-brand-green' : 'text-amber-300'
          }`}
        >
          {passed ? 'Nailed it.' : 'Not quite.'}
          {detail ? ` ${detail}` : ''}
        </span>
      </div>
      <div className="flex gap-2 text-sm text-white/70">
        <Quote className="mt-0.5 h-4 w-4 shrink-0 text-brand-green/70" />
        <p className="italic">{coach}</p>
      </div>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-md bg-brand-green px-4 py-2 text-sm font-semibold text-brand-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function ResultScreen({
  score,
  passed,
  rows,
  onRetry,
}: {
  score: number;
  passed: boolean;
  rows: { label: string; pass: boolean; pts: number; max: number }[];
  onRetry: () => void;
}) {
  return (
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
        {score}
        <span className="text-lg font-semibold text-white/40">/100</span>
      </p>
      <p className="mt-1 text-sm text-white/50">
        {passed
          ? `Pass mark is ${PASS_SCORE}. Well done.`
          : `You need ${PASS_SCORE} to pass. Run it again.`}
      </p>

      <div className="mx-auto mt-5 max-w-sm space-y-2 text-left">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-sm"
          >
            <span className="flex items-center gap-2 text-white/70">
              {r.pass ? (
                <CheckCircle2 className="h-4 w-4 text-brand-green" />
              ) : (
                <XCircle className="h-4 w-4 text-red-400" />
              )}
              {r.label}
            </span>
            <span className="tabular-nums text-white/50">
              {r.pts}/{r.max}
            </span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onRetry}
        className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-brand-green px-5 py-2.5 text-sm font-semibold text-brand-black transition-opacity hover:opacity-90"
      >
        <RotateCcw className="h-4 w-4" />
        Try again
      </button>
    </div>
  );
}
