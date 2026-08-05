'use client';

/**
 * DrillShell — shared scaffolding for the hands-on sales-training drills.
 *
 * Exports:
 *   1. recordDrillResult(...) — async POST that records a drill completion.
 *   2. <DrillShell> — presentational frame (title bar + retry affordance area).
 *
 * ── CHEAT TRADEOFF (by design) ────────────────────────────────────────────
 * Drills are CLIENT-GRADED. recordDrillResult posts to the LEGACY score path
 * of /api/portal/training/sales — it sends { score, passed } and intentionally
 * OMITS the `answers` key, so the server trusts the score we send rather than
 * re-grading it. A determined user could POST a fake pass from devtools.
 * That is an accepted tradeoff: these are solo practice reps, not gated
 * knowledge checks, and drill results do NOT unlock later modules. Do not move
 * real gating onto drill results without also moving grading server-side.
 */

import React from 'react';
import { RotateCcw } from 'lucide-react';

/** Minimal shape we need off the auth user; kept loose so callers can pass
 *  `user` straight from useAuth() (which may be null). */
type DrillUser = { userId?: string; name?: string } | null | undefined;

/**
 * Record a completed drill attempt.
 *
 * @param drillId    e.g. 'sales_d1' (already prefixed; server adds sales_ if missing)
 * @param drillName  human-readable name, stored as moduleName
 * @param score      0-100 (client-graded)
 * @param passed     pass/fail (client-graded)
 * @param user       identity from useAuth(); when absent the POST is skipped
 * @returns true if the result was recorded, false if skipped or the POST failed
 */
export async function recordDrillResult(
  drillId: string,
  drillName: string,
  score: number,
  passed: boolean,
  user: DrillUser,
): Promise<boolean> {
  // No signed-in user (present mode / preview / logged-out) — skip gracefully.
  if (!user?.userId || !user?.name) return false;

  try {
    const res = await fetch('/api/portal/training/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.userId,
        userName: user.name,
        moduleId: drillId,
        moduleName: drillName,
        score: Math.max(0, Math.min(100, Math.round(score))),
        passed,
        // NO `answers` key on purpose → server trusts our client-graded score.
      }),
    });
    return res.ok;
  } catch {
    // Network failure should never break the drill UX — result screen still shows.
    return false;
  }
}

export interface DrillShellProps {
  /** e.g. 'sales_d1' — kept for callers even though the frame does not POST. */
  drillId?: string;
  /** Title shown in the drill header. */
  drillName: string;
  /** Optional one-line instruction under the title. */
  instructions?: string;
  /** When provided, renders a RotateCcw reset control in the title bar. */
  onRetry?: () => void;
  children: React.ReactNode;
}

/**
 * Presentational frame every drill renders inside. Dark-theme card with a
 * title bar (drill name + optional instructions + optional reset affordance).
 */
export function DrillShell({
  drillName,
  instructions,
  onRetry,
  children,
}: DrillShellProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-brand-black/70 shadow-lg overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-white/[0.03] px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-white">{drillName}</h3>
          {instructions && (
            <p className="mt-1 text-sm text-white/60">{instructions}</p>
          )}
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-white/15 px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:border-brand-green/50 hover:text-brand-green"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default DrillShell;
