'use client';

/**
 * ContingencySequencer — Drill sales_d4 — "Contingency Sequencer"
 *
 * Tap the 8 correct steps into a numbered list, in order. Two distractor steps
 * must be left OUT — tapping either one is an INSTANT FAIL of the attempt.
 * Steps are grounded in CANONICAL-sales-training.md §Stage 9 (the contingency:
 * top line, the two authorizations, $0-vs-$500, sign-yourself-first, slide it,
 * dead silent, dial before they sign, they sign with the call ringing).
 *
 * Pass: exact order of all 8, no distractor ever placed. Unlimited retries.
 * Client-graded — records via recordDrillResult (see DrillShell cheat note).
 */

import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Trophy,
  RotateCcw,
  Quote,
  Ban,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { DrillShell, recordDrillResult } from './DrillShell';

const DRILL_ID = 'sales_d4';
const DRILL_NAME = 'Contingency Sequencer';
const PASS_SCORE = 80;

interface Step {
  id: string;
  order: number; // 1..8 for correct steps; 0 for distractors
  text: string;
  distractor?: boolean;
  /** Why this distractor is a fail (verbatim-grounded, canonical §Stage 9). */
  failReason?: string;
}

const STEPS: Step[] = [
  {
    id: 's1',
    order: 1,
    text: 'Explain the top line: “No claim approval, no obligation.”',
  },
  {
    id: 's2',
    order: 2,
    text: 'Read the two things it authorizes: speak to insurance as a technical advisor, and do the work if they approve everything.',
  },
  {
    id: 's3',
    order: 3,
    text: 'Frame the price: “This contingency we’re agreeing to $0” — while other companies make this agreement for a minimum of $500.',
  },
  {
    id: 's4',
    order: 4,
    text: '“All right, I’m going to sign right here.” — and sign it yourself first.',
  },
  { id: 's5', order: 5, text: 'Slide it across the table to them.' },
  { id: 's6', order: 6, text: 'Go dead silent.' },
  {
    id: 's7',
    order: 7,
    text: 'Pull out your phone and dial the insurance company — let it start ringing before they even sign.',
  },
  {
    id: 's8',
    order: 8,
    text: 'They sign — the call is already ringing.',
  },
  // ── Distractors: must be left out ──
  {
    id: 'x1',
    order: 0,
    text: 'Ask if they’d like a few days to think it over.',
    distractor: true,
    failReason:
      'You don’t want to give a homeowner the chance to say no. You do all the thinking for them — you never offer them time to “think it over.”',
  },
  {
    id: 'x2',
    order: 0,
    text: 'Tell them Best Choice charges $500 for this.',
    distractor: true,
    failReason:
      'Never bash other companies by name. You contrast your $0 against “some other companies” charging a minimum of $500 — you never name-drop a competitor.',
  },
];

const CORRECT_ORDER = STEPS.filter((s) => !s.distractor)
  .sort((a, b) => a.order - b.order)
  .map((s) => s.id);

const PASS_COACH =
  'The dead-silent technique: “All right, I’m going to sign right here.” You sign, you get dead silent, you slide it across — and you pull out your phone and start dialing the insurance company, letting it ring before they even sign. Your signature is already on it and the call is already happening. You do all the thinking for them.';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Status = 'building' | 'passed' | 'failed';

export default function ContingencySequencer() {
  const { user } = useAuth();
  const [order, setOrder] = useState<string[]>(STEPS.map((s) => s.id));
  const [placed, setPlaced] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>('building');
  const [failReason, setFailReason] = useState<string | null>(null);

  // Shuffle tray on mount only (avoids hydration mismatch).
  useEffect(() => {
    setOrder(shuffle(STEPS.map((s) => s.id)));
  }, []);

  const stepById = (id: string) => STEPS.find((s) => s.id === id)!;
  const trayIds = order.filter((id) => !placed.includes(id));

  function tapTray(id: string) {
    if (status !== 'building') return;
    const step = stepById(id);
    if (step.distractor) {
      // Instant fail — the distractor was placed.
      setPlaced((p) => [...p, id]);
      setFailReason(step.failReason || null);
      setStatus('failed');
      return;
    }
    setPlaced((p) => [...p, id]);
  }

  function tapPlaced(id: string) {
    if (status !== 'building') return;
    setPlaced((p) => p.filter((x) => x !== id));
  }

  function check() {
    const exact =
      placed.length === CORRECT_ORDER.length &&
      placed.every((id, i) => id === CORRECT_ORDER[i]);
    setStatus(exact ? 'passed' : 'failed');
    if (!exact) setFailReason(null); // wrong order, not a distractor
  }

  function reset() {
    setOrder(shuffle(STEPS.map((s) => s.id)));
    setPlaced([]);
    setStatus('building');
    setFailReason(null);
    setRecorded(false);
  }

  const score = status === 'passed' ? 100 : 0;
  const [recorded, setRecorded] = useState(false);
  useEffect(() => {
    if ((status === 'passed' || status === 'failed') && !recorded) {
      setRecorded(true);
      void recordDrillResult(
        DRILL_ID,
        DRILL_NAME,
        status === 'passed' ? 100 : 0,
        status === 'passed',
        user,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const allPlaced = placed.length === CORRECT_ORDER.length;

  return (
    <DrillShell
      drillId={DRILL_ID}
      drillName={DRILL_NAME}
      instructions="Tap the steps into the right order. Two of them are traps — leave them out. Tapping a trap ends the attempt."
      onRetry={status === 'building' ? reset : undefined}
    >
      {status === 'building' && (
        <div className="space-y-4">
          {/* Numbered list */}
          <div className="min-h-[4rem] space-y-2 rounded-lg border border-dashed border-white/15 bg-white/[0.02] p-3">
            {placed.length === 0 ? (
              <p className="py-2 text-sm text-white/35">
                Tap steps below to build the sequence, top to bottom...
              </p>
            ) : (
              placed.map((id, i) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => tapPlaced(id)}
                  className="flex w-full items-start gap-3 rounded-md border border-brand-green/40 bg-brand-green/5 px-3 py-2 text-left text-sm text-white transition-opacity hover:opacity-80"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-green text-xs font-bold text-brand-black">
                    {i + 1}
                  </span>
                  <span>{stepById(id).text}</span>
                </button>
              ))
            )}
          </div>

          {/* Tray */}
          <div className="space-y-2">
            {trayIds.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => tapTray(id)}
                className="flex w-full items-start gap-2 rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-left text-sm text-white/80 transition-colors hover:border-brand-green/50 hover:text-white"
              >
                {stepById(id).text}
              </button>
            ))}
            {trayIds.length === 0 && (
              <p className="text-sm text-white/35">
                All steps placed. Tap a step in the list to send it back.
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={check}
              disabled={!allPlaced}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-green px-4 py-2 text-sm font-semibold text-brand-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Check sequence
            </button>
          </div>
        </div>
      )}

      {/* ── Result ── */}
      {status !== 'building' && (
        <div className="text-center">
          <div
            className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
              status === 'passed' ? 'bg-brand-green/15' : 'bg-red-500/15'
            }`}
          >
            {status === 'passed' ? (
              <Trophy className="h-8 w-8 text-brand-green" />
            ) : failReason ? (
              <Ban className="h-8 w-8 text-red-400" />
            ) : (
              <XCircle className="h-8 w-8 text-red-400" />
            )}
          </div>
          <h3 className="text-xl font-bold text-white">
            {status === 'passed' ? 'Drill passed' : 'Attempt failed'}
          </h3>
          <p className="mt-1 text-4xl font-black tabular-nums text-white">
            {score}
            <span className="text-lg font-semibold text-white/40">/100</span>
          </p>
          <p className="mt-1 text-sm text-white/50">
            {status === 'passed'
              ? `Exact order, no traps. Pass mark is ${PASS_SCORE}.`
              : failReason
                ? 'You placed a trap step.'
                : 'The order wasn’t exact.'}
          </p>

          <div
            className={`mx-auto mt-5 max-w-md rounded-lg border p-4 text-left ${
              status === 'passed'
                ? 'border-brand-green/40 bg-brand-green/[0.06]'
                : 'border-amber-500/40 bg-amber-500/[0.06]'
            }`}
          >
            <div className="flex gap-2 text-sm text-white/75">
              <Quote className="mt-0.5 h-4 w-4 shrink-0 text-brand-green/70" />
              <p className="italic">
                {status === 'passed' ? PASS_COACH : failReason || PASS_COACH}
              </p>
            </div>
          </div>

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

      {/* Reference: what "passed" checks against, for maintainers. */}
      {status === 'passed' && (
        <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-white/30">
          <CheckCircle2 className="h-3.5 w-3.5" />
          8 steps, exact order, both traps avoided.
        </div>
      )}
    </DrillShell>
  );
}
