import { CellChange, DataMap } from './types';

export interface DiffResult {
  /** Cells changed in months that already had data — REQUIRES VERIFICATION. */
  retroactive: CellChange[];
  /** Cells removed (had data, now zero/missing). */
  removed: CellChange[];
  /** Brand-new cells in months that previously had no data for ANY rep. Informational. */
  newMonthAdditions: CellChange[];
  /** New cells in months that already had data (existing month, new rep entry). Informational. */
  newCellAdditions: CellChange[];
  /** Months that exist in new file but not in current data. */
  newMonths: string[];
  /** Months in current data not present in new file. */
  removedMonths: string[];
  /** Reps in new file not in current data. */
  newReps: string[];
  /** Reps in current data not in new file. */
  removedReps: string[];
  totalCurrent: number;
  totalNew: number;
}

/**
 * Compute the diff between current and new data maps.
 *
 * Categories:
 *  - **retroactive**: cell that had revenue and now has different revenue. NEEDS VERIFICATION.
 *  - **removed**: cell that had revenue and now has zero. NEEDS VERIFICATION.
 *  - **newCellAdditions**: cell in an existing month, new value (was zero). Informational.
 *  - **newMonthAdditions**: cells in a brand-new month not present in current data. Informational.
 */
export function computeDiff(current: DataMap, incoming: DataMap): DiffResult {
  const result: DiffResult = {
    retroactive: [],
    removed: [],
    newMonthAdditions: [],
    newCellAdditions: [],
    newMonths: [],
    removedMonths: [],
    newReps: [],
    removedReps: [],
    totalCurrent: 0,
    totalNew: 0,
  };

  const currentMonths = new Set<string>();
  const incomingMonths = new Set<string>();
  for (const rep of Object.keys(current)) for (const m of Object.keys(current[rep])) currentMonths.add(m);
  for (const rep of Object.keys(incoming)) for (const m of Object.keys(incoming[rep])) incomingMonths.add(m);

  result.newMonths = [...incomingMonths].filter((m) => !currentMonths.has(m));
  result.removedMonths = [...currentMonths].filter((m) => !incomingMonths.has(m));

  const currentReps = new Set(Object.keys(current));
  const incomingReps = new Set(Object.keys(incoming));
  result.newReps = [...incomingReps].filter((r) => !currentReps.has(r));
  result.removedReps = [...currentReps].filter((r) => !incomingReps.has(r));

  const allReps = new Set([...currentReps, ...incomingReps]);
  const allMonths = new Set([...currentMonths, ...incomingMonths]);
  const newMonthSet = new Set(result.newMonths);

  for (const rep of allReps) {
    const cur = current[rep] || {};
    const inc = incoming[rep] || {};
    for (const m of allMonths) {
      const oldV = cur[m] || 0;
      const newV = inc[m] || 0;
      if (Math.abs(oldV - newV) < 0.01) continue;
      const delta = newV - oldV;
      if (oldV === 0 && newV > 0) {
        // addition
        const change: CellChange = { rep, month: m, oldValue: oldV, newValue: newV, delta, type: 'added' };
        if (newMonthSet.has(m)) result.newMonthAdditions.push(change);
        else result.newCellAdditions.push(change);
      } else if (oldV > 0 && newV === 0) {
        result.removed.push({ rep, month: m, oldValue: oldV, newValue: newV, delta, type: 'removed' });
      } else {
        result.retroactive.push({ rep, month: m, oldValue: oldV, newValue: newV, delta, type: 'modified' });
      }
    }
  }

  // Totals
  for (const rep of Object.keys(current)) for (const m of Object.keys(current[rep])) result.totalCurrent += current[rep][m];
  for (const rep of Object.keys(incoming)) for (const m of Object.keys(incoming[rep])) result.totalNew += incoming[rep][m];

  return result;
}

/** Boolean shortcut: does this diff have anything that needs human verification? */
export function needsVerification(d: DiffResult): boolean {
  return d.retroactive.length > 0 || d.removed.length > 0 || d.removedMonths.length > 0 || d.removedReps.length > 0;
}
