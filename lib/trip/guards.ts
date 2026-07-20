/**
 * Write-path guards for the bi-annual trip program.
 *
 * Two things must never happen:
 *  1. Data from a closed half leaking into the active half's totals.
 *  2. A write landing while the live tracker still belongs to the previous
 *     half (i.e. someone uploads after Jan 1 / Jul 1 but before rollover ran).
 */

import { DataMap, TrackerJSON } from './types';
import { getActivePeriod, inferPeriodId, Period } from './period';

export interface ScopedDataMap {
  dataMap: DataMap;
  /** Months dropped because they fall outside the active period. */
  ignoredMonths: { month: string; total: number }[];
  /** True when nothing at all survived the filter. */
  empty: boolean;
}

/**
 * Strip every month outside `period` from a dataMap. This is the real guard —
 * commit routes accept a raw JSON dataMap and so bypass the xlsx parser's
 * own month filtering entirely.
 */
export function scopeDataMapToPeriod(dataMap: DataMap, period: Period): ScopedDataMap {
  const allowed = new Set<string>(period.months);
  const out: DataMap = {};
  const ignoredTotals: Record<string, number> = {};

  for (const [rep, byMonth] of Object.entries(dataMap)) {
    for (const [month, revenue] of Object.entries(byMonth)) {
      const value = Number(revenue) || 0;
      if (allowed.has(month.trim())) {
        out[rep] = out[rep] || {};
        out[rep][month.trim()] = value;
      } else if (value > 0) {
        ignoredTotals[month] = (ignoredTotals[month] || 0) + value;
      }
    }
  }

  const ignoredMonths = Object.entries(ignoredTotals).map(([month, total]) => ({ month, total }));
  return { dataMap: out, ignoredMonths, empty: Object.keys(out).length === 0 };
}

export interface PeriodGuardFailure {
  status: number;
  error: string;
  livePeriod: string | null;
  activePeriod: string;
}

/**
 * Verify the live tracker still belongs to the active period and is not
 * locked. Returns null when writes are allowed.
 */
export function checkWritablePeriod(
  liveTracker: TrackerJSON | null,
  now: Date = new Date(),
): PeriodGuardFailure | null {
  const active = getActivePeriod(now);
  if (!liveTracker) return null; // nothing live yet — first upload is fine

  if (liveTracker.locked) {
    return {
      status: 409,
      error: `The live tracker is locked (${liveTracker.period.name}). Locked periods are read-only.`,
      livePeriod: inferPeriodId(liveTracker.period),
      activePeriod: active.id,
    };
  }

  const liveId = inferPeriodId(liveTracker.period);
  if (liveId && liveId !== active.id) {
    return {
      status: 409,
      error:
        `Live data is ${liveId} but the active period is ${active.id}. ` +
        `Run POST /api/trip/rollover to archive ${liveId} before uploading.`,
      livePeriod: liveId,
      activePeriod: active.id,
    };
  }
  return null;
}

/** Human-readable note for the review/success screens. */
export function describeIgnoredMonths(
  ignored: { month: string; total: number }[],
  period: Period,
): string | null {
  if (ignored.length === 0) return null;
  const names = ignored.map((i) => i.month).join(', ');
  return `${ignored.length} sheet${ignored.length === 1 ? '' : 's'} ignored — ${names} ${
    ignored.length === 1 ? 'is' : 'are'
  } outside ${period.name}. Those totals are locked in their own period archive.`;
}
