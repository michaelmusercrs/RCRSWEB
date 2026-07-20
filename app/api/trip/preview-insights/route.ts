import { NextRequest, NextResponse } from 'next/server';
import { buildTrackerJSON } from '@/lib/trip/tracker';
import { enrichTracker, RichRep } from '@/lib/trip/insights';
import { getSnapshots, getTracker } from '@/lib/trip/store';
import competitionConfig from '@/data/competition-config.json';
import { getActivePeriod } from '@/lib/trip/period';
import { DataMap } from '@/lib/trip/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  /** Proposed dataMap (rep -> month -> revenue). Must be filtered already. */
  dataMap: DataMap;
}

interface RepDiffView {
  rep: string;
  isNew: boolean;
  before: Pick<RichRep, 'rep' | 'ytd' | 'accruedTripBudget' | 'qualifiedForTrip' | 'insights' | 'pctToTrip' | 'gapToTrip'> | null;
  after: Pick<RichRep, 'rep' | 'ytd' | 'accruedTripBudget' | 'qualifiedForTrip' | 'insights' | 'pctToTrip' | 'gapToTrip'>;
  changed: {
    wins: { added: string[]; removed: string[] };
    gaps: { added: string[]; removed: string[] };
    suggestions: { added: string[]; removed: string[] };
    motivation: boolean;
    ytdDelta: number;
    accruedDelta: number;
  };
}

const setDiff = (a: string[], b: string[]) => a.filter((x) => !b.includes(x));

export async function POST(req: NextRequest) {
  const activePeriod = getActivePeriod();
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body?.dataMap || typeof body.dataMap !== 'object') {
    return NextResponse.json({ error: 'dataMap required' }, { status: 400 });
  }

  // Build proposed tracker
  const monthSet = new Set<string>();
  for (const rep of Object.keys(body.dataMap)) {
    for (const m of Object.keys(body.dataMap[rep])) monthSet.add(m);
  }
  const monthOrder = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const months = monthOrder.filter((m) => monthSet.has(m));

  const proposed = buildTrackerJSON({
    dataMap: body.dataMap,
    months,
    tiers: competitionConfig.monthlyBonusTiers,
    tripThreshold: competitionConfig.awardsTrip.threshold,
    period: activePeriod,
    source: '__preview__',
  });

  const [current, snapshots] = await Promise.all([getTracker(), getSnapshots()]);
  const currentEnriched = current
    ? enrichTracker({
        tracker: current,
        snapshots,
        periodEnd: new Date(`${current.period.end}T23:59:59Z`),
      })
    : null;
  const proposedEnriched = enrichTracker({
    tracker: proposed,
    snapshots,
    periodEnd: new Date(`${activePeriod.end}T23:59:59Z`),
  });

  const beforeByRep = new Map<string, RichRep>();
  if (currentEnriched) {
    for (const r of currentEnriched.reps) beforeByRep.set(r.rep, r);
  }

  const repViews: RepDiffView[] = proposedEnriched.reps.map((after) => {
    const before = beforeByRep.get(after.rep) ?? null;
    return {
      rep: after.rep,
      isNew: !before,
      before: before
        ? {
            rep: before.rep,
            ytd: before.ytd,
            accruedTripBudget: before.accruedTripBudget,
            qualifiedForTrip: before.qualifiedForTrip,
            insights: before.insights,
            pctToTrip: before.pctToTrip,
            gapToTrip: before.gapToTrip,
          }
        : null,
      after: {
        rep: after.rep,
        ytd: after.ytd,
        accruedTripBudget: after.accruedTripBudget,
        qualifiedForTrip: after.qualifiedForTrip,
        insights: after.insights,
        pctToTrip: after.pctToTrip,
        gapToTrip: after.gapToTrip,
      },
      changed: {
        wins: {
          added: setDiff(after.insights.wins, before?.insights.wins ?? []),
          removed: setDiff(before?.insights.wins ?? [], after.insights.wins),
        },
        gaps: {
          added: setDiff(after.insights.gaps, before?.insights.gaps ?? []),
          removed: setDiff(before?.insights.gaps ?? [], after.insights.gaps),
        },
        suggestions: {
          added: setDiff(after.insights.suggestions, before?.insights.suggestions ?? []),
          removed: setDiff(before?.insights.suggestions ?? [], after.insights.suggestions),
        },
        motivation: after.insights.motivation !== (before?.insights.motivation ?? ''),
        ytdDelta: after.ytd - (before?.ytd ?? 0),
        accruedDelta: after.accruedTripBudget - (before?.accruedTripBudget ?? 0),
      },
    };
  });

  // Reps that are in current but missing from upload (excluded mid-period, etc.)
  const droppedReps: string[] = currentEnriched
    ? currentEnriched.reps.filter((r) => !body.dataMap[r.rep]).map((r) => r.rep)
    : [];

  return NextResponse.json({
    repViews,
    droppedReps,
    proposedMonths: months,
    threshold: proposed.tripThreshold,
  });
}
