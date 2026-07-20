import { BreakdownEntry, RepSummary, TrackerJSON, Snapshot } from './types';

export interface RepStatsComputed {
  activeMonths: number;
  tieredMonths: number;
  bestMonth: BreakdownEntry;
  monthlyAvg: number;
  monthlyAvgIncluding0: number;
  projectedPeriodEnd: number;
  neededPerMonth: number;
  neededPerWeek: number;
  consistency: number;
  bestMonthBeatGap: boolean;
  wouldQualifyIfBestRepeats: boolean;
}

export interface RepDelta {
  ytdDelta: number;
  accruedDelta: number;
  isNew: boolean;
  previousAccrued: number;
  previousYtd: number;
}

export interface RepInsights {
  wins: string[];
  gaps: string[];
  suggestions: string[];
  motivation: string;
  deltaMessage: string | null;
}

export interface RichRep extends RepSummary {
  stats: RepStatsComputed;
  delta: RepDelta | null;
  insights: RepInsights;
  llc: string | null;
}

const LLC: Record<string, string> = {
  Aaron: 'Roof Angel, LLC',
  Adam: 'Rudys Roofing Insights LLC',
  Greg: 'Gregory Ray Muse',
  Travis: 'Jeremy T. Wages',
};

export function computeRepStats(
  r: RepSummary,
  monthsCompleted: number,
  monthsLeft: number,
  weeksLeft: number,
  tripThreshold: number,
): RepStatsComputed {
  const revs = r.breakdown.map((b) => b.revenue);
  const activeMonths = revs.filter((v) => v > 0).length;
  const tieredMonths = r.breakdown.filter((b) => b.bonus > 0).length;
  const bestMonth = [...r.breakdown].sort((a, b) => b.revenue - a.revenue)[0] ?? {
    month: '—',
    revenue: 0,
    tier: null,
    bonus: 0,
  };
  const monthlyAvg = activeMonths ? r.ytd / activeMonths : 0;
  const monthlyAvgIncluding0 = monthsCompleted ? r.ytd / monthsCompleted : 0;
  const projectedPeriodEnd = r.ytd + monthlyAvgIncluding0 * monthsLeft;
  const neededPerMonth = r.qualifiedForTrip ? 0 : (tripThreshold - r.ytd) / monthsLeft;
  const neededPerWeek = r.qualifiedForTrip ? 0 : (tripThreshold - r.ytd) / weeksLeft;
  const consistency = monthsCompleted ? (tieredMonths / monthsCompleted) * 100 : 0;
  const bestMonthBeatGap = bestMonth.revenue >= tripThreshold - r.ytd;
  const wouldQualifyIfBestRepeats = r.ytd + bestMonth.revenue * monthsLeft >= tripThreshold;
  return {
    activeMonths,
    tieredMonths,
    bestMonth,
    monthlyAvg,
    monthlyAvgIncluding0,
    projectedPeriodEnd,
    neededPerMonth,
    neededPerWeek,
    consistency,
    bestMonthBeatGap,
    wouldQualifyIfBestRepeats,
  };
}

export function buildInsights(
  r: RepSummary & { stats: RepStatsComputed; delta: RepDelta | null; accruedTripBudget: number },
  tripThreshold: number,
  monthsCompleted: number,
  periodName: string,
): RepInsights {
  const out: RepInsights = {
    wins: [],
    gaps: [],
    suggestions: [],
    motivation: '',
    deltaMessage: null,
  };
  const s = r.stats;
  const d = r.delta;

  if (d && d.accruedDelta > 0) {
    out.deltaMessage = `Since the last update, you added <strong>+$${d.accruedDelta.toLocaleString()}</strong> to your trip fund — bringing your pot to <strong>$${r.accruedTripBudget.toLocaleString()}</strong> toward a peaceful vacation.`;
  } else if (d && d.ytdDelta > 0 && d.accruedDelta === 0) {
    out.deltaMessage = `Since the last update, you closed <strong>+$${Math.round(d.ytdDelta).toLocaleString()}</strong> in sales. One more push to clear $50K and the pot starts growing.`;
  } else if (d && d.isNew) {
    out.deltaMessage = `Welcome to the board. Every $50K month adds to your trip fund.`;
  }

  if (r.qualifiedForTrip) out.wins.push(`Already QUALIFIED with $${Math.round(r.ytd).toLocaleString()} sold.`);
  if (s.bestMonth.revenue >= 200000)
    out.wins.push(`Posted ${s.bestMonth.month} at $${Math.round(s.bestMonth.revenue).toLocaleString()} — proves $200K+ months are in your wheelhouse.`);
  else if (s.bestMonth.revenue >= 100000)
    out.wins.push(`Best month: ${s.bestMonth.month} = $${Math.round(s.bestMonth.revenue).toLocaleString()}, six-figure performance.`);
  else if (s.bestMonth.revenue >= 50000)
    out.wins.push(`Best month: ${s.bestMonth.month} = $${Math.round(s.bestMonth.revenue).toLocaleString()}, tier money earned.`);
  if (r.accruedTripBudget >= 1000) out.wins.push(`Trip fund pot: $${r.accruedTripBudget.toLocaleString()}.`);
  if (s.consistency >= 75) out.wins.push(`${s.tieredMonths} of ${monthsCompleted} months hit tier — elite consistency.`);

  if (s.activeMonths < monthsCompleted) {
    const dark = monthsCompleted - s.activeMonths;
    out.gaps.push(`${dark} of ${monthsCompleted} months had zero sales. Every dark month is tier money missed.`);
  }
  if (s.activeMonths > 0 && s.tieredMonths < s.activeMonths) {
    out.gaps.push(`${s.activeMonths - s.tieredMonths} active month(s) stayed under $50K — close-but-no-tier.`);
  }
  if (!r.qualifiedForTrip && s.projectedPeriodEnd < tripThreshold) {
    const shortBy = Math.round(tripThreshold - s.projectedPeriodEnd);
    out.gaps.push(`At current pace you finish ${periodName} at ~$${Math.round(s.projectedPeriodEnd).toLocaleString()} — $${shortBy.toLocaleString()} short of the trip.`);
  }

  if (!r.qualifiedForTrip) {
    out.suggestions.push(`Average $${Math.round(s.neededPerMonth).toLocaleString()}/month for remaining months (~$${Math.round(s.neededPerWeek).toLocaleString()}/week) to qualify.`);
    if (s.bestMonthBeatGap) out.suggestions.push(`ONE more month like ${s.bestMonth.month} closes the gap entirely.`);
    else if (s.wouldQualifyIfBestRepeats) out.suggestions.push(`Repeat your ${s.bestMonth.month} performance through end of ${periodName} and you're qualified.`);
    if (s.bestMonth.revenue < 50000) out.suggestions.push(`No month has cleared $50K yet — first $50K month puts $100 in your pot.`);
  } else {
    out.suggestions.push(`Trip locked. Now climb tiers — bigger months = bigger pot.`);
    if (s.bestMonth.revenue < 300000) out.suggestions.push(`Push for $300K month (+$2,000) — you've shown $200K is in range.`);
    if (r.ytd >= 500000) out.suggestions.push(`$500K → $1M month: linear +$1,000 per additional $100K, capped at +$9,000.`);
  }

  if (r.qualifiedForTrip) out.motivation = "You're in. Now make the trip bigger.";
  else if (s.wouldQualifyIfBestRepeats) out.motivation = `You've PROVEN you can do this. Repeat ${s.bestMonth.month}.`;
  else if (s.activeMonths >= 1) out.motivation = `On the board. Scale it up.`;
  else out.motivation = `The bar is $${Math.round(tripThreshold / 1000)}K cumulative in ${periodName} — get on the board.`;

  return out;
}

export function monthsRemaining(from: Date, to: Date): number {
  if (from >= to) return 0;
  let count = 0;
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  while (cursor <= to) {
    count += 1;
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return count;
}

export interface EnrichInput {
  tracker: TrackerJSON;
  snapshots?: Snapshot[];
  today?: Date;
  /**
   * Last day of the tracker's period. REQUIRED — this used to default to a
   * hardcoded 2026-06-30, which silently produced projections against an
   * already-expired period on every call site that forgot to pass it.
   */
  periodEnd: Date;
}

/**
 * Compute per-rep stats, delta-against-previous-snapshot, and insights.
 * Returned reps are sorted by YTD desc.
 */
export function enrichTracker(input: EnrichInput): {
  reps: RichRep[];
  monthsCompleted: number;
  monthsLeft: number;
  weeksLeft: number;
  daysLeft: number;
} {
  const today = input.today ?? new Date();
  const periodEnd = input.periodEnd;
  const months = input.tracker.reps.length > 0 ? input.tracker.reps[0].breakdown.map((b) => b.month) : [];
  const monthsCompleted = months.length;
  const daysLeft = Math.max(
    0,
    Math.ceil((periodEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
  );
  // Clamped to >=1 to avoid divide-by-zero in the pace math once a period ends.
  const weeksLeft = Math.max(1, Math.round(daysLeft / 7));
  const monthsLeft = Math.max(1, monthsRemaining(today, periodEnd));

  const reps: RichRep[] = input.tracker.reps.map((r) => {
    const stats = computeRepStats(r, monthsCompleted, monthsLeft, weeksLeft, input.tracker.tripThreshold);
    return {
      ...r,
      stats,
      delta: null,
      insights: { wins: [], gaps: [], suggestions: [], motivation: '', deltaMessage: null },
      llc: LLC[r.rep] ?? null,
    };
  });
  reps.sort((a, b) => b.ytd - a.ytd);

  const lastSnapshot =
    input.snapshots && input.snapshots.length >= 2
      ? input.snapshots[input.snapshots.length - 2]
      : null;
  for (const r of reps) {
    if (lastSnapshot) {
      const prev = lastSnapshot.reps.find((p) => p.rep === r.rep);
      r.delta = prev
        ? {
            ytdDelta: r.ytd - prev.ytd,
            accruedDelta: r.accruedTripBudget - (prev.accrued ?? 0),
            isNew: false,
            previousAccrued: prev.accrued ?? 0,
            previousYtd: prev.ytd,
          }
        : {
            ytdDelta: r.ytd,
            accruedDelta: r.accruedTripBudget,
            isNew: true,
            previousAccrued: 0,
            previousYtd: 0,
          };
    }
    r.insights = buildInsights(r, input.tracker.tripThreshold, monthsCompleted, input.tracker.period.name);
  }

  return { reps, monthsCompleted, monthsLeft, weeksLeft, daysLeft };
}
