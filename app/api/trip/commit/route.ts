import { NextRequest, NextResponse } from 'next/server';
import { buildTrackerJSON, dataMapHash, trackerToDataMap } from '@/lib/trip/tracker';
import { computeDiff } from '@/lib/trip/diff';
import {
  getChangeLog,
  getSnapshots,
  getTracker,
  putChangeLog,
  putSnapshots,
  putTracker,
  putXlsx,
} from '@/lib/trip/store';
import competitionConfig from '@/data/competition-config.json';
import { ChangeLogEntry, DataMap, Snapshot } from '@/lib/trip/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CommitBody {
  /** Optional rep -> month -> revenue map. If provided, used as the new dataset. */
  dataMap?: DataMap;
  /** Optional base64-encoded xlsx (so we can persist the raw upload too). */
  xlsxBase64?: string;
  /** Original file name. */
  fileName?: string;
  /** User notes about why retroactive changes were accepted. */
  notes?: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as CommitBody;
  if (!body.dataMap || typeof body.dataMap !== 'object') {
    return NextResponse.json({ error: 'dataMap required' }, { status: 400 });
  }

  // Determine months from the data
  const monthSet = new Set<string>();
  for (const rep of Object.keys(body.dataMap)) {
    for (const m of Object.keys(body.dataMap[rep])) monthSet.add(m);
  }
  const monthOrder = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const months = monthOrder.filter((m) => monthSet.has(m));

  // Build new tracker
  const newTracker = buildTrackerJSON({
    dataMap: body.dataMap,
    months,
    tiers: competitionConfig.monthlyBonusTiers,
    tripThreshold: competitionConfig.awardsTrip.threshold,
    period: competitionConfig.currentPeriod,
    source: body.fileName || 'uploaded',
  });

  // Diff for change log
  const currentTracker = await getTracker();
  const currentMap = currentTracker ? trackerToDataMap(currentTracker) : {};
  const diff = computeDiff(currentMap, body.dataMap);
  const allChanges = [
    ...diff.retroactive,
    ...diff.removed,
    ...diff.newCellAdditions,
    ...diff.newMonthAdditions,
  ];

  // Persist xlsx if provided
  let xlsxUrl: string | null = null;
  if (body.xlsxBase64) {
    try {
      const buf = Buffer.from(body.xlsxBase64, 'base64');
      xlsxUrl = await putXlsx(buf);
    } catch (e) {
      console.error('[trip/commit] xlsx persist failed', e);
    }
  }

  // Persist tracker
  const trackerUrl = await putTracker(newTracker);

  // Build snapshot
  const hash = await dataMapHash(body.dataMap);
  const snapshots = await getSnapshots();
  const last = snapshots[snapshots.length - 1] ?? null;
  const retroCount = diff.retroactive.length + diff.removed.length;
  const addCount = diff.newCellAdditions.length + diff.newMonthAdditions.length;

  const newSnapshot: Snapshot = {
    capturedAt: new Date().toISOString(),
    capturedDate: new Date().toISOString().slice(0, 10),
    source: body.fileName || 'uploaded',
    hash,
    teamTotal: newTracker.reps.reduce((s, r) => s + r.ytd, 0),
    qualifiedCount: newTracker.reps.filter((r) => r.qualifiedForTrip).length,
    totalAccrued: newTracker.totalAccrued,
    reps: newTracker.reps.map((r) => ({
      rep: r.rep,
      ytd: r.ytd,
      monthly: r.breakdown.map((b) => ({ month: b.month, revenue: b.revenue, bonus: b.bonus })),
      accrued: r.accruedTripBudget,
      qualified: r.qualifiedForTrip,
      pct: r.pctToTrip,
    })),
    isFirst: !last,
    previousHash: last?.hash ?? null,
    previousCapturedAt: last?.capturedAt ?? null,
    changes: allChanges,
    retroactiveCount: retroCount,
    additionCount: addCount,
  };

  let snapshotsUrl: string | null = null;
  if (!last || last.hash !== hash) {
    const updated = [...snapshots, newSnapshot];
    snapshotsUrl = await putSnapshots(updated);
  }

  // Append to change log if there are changes
  let changeLogUrl: string | null = null;
  if (allChanges.length > 0) {
    const log = await getChangeLog();
    const entry: ChangeLogEntry = {
      timestamp: new Date().toISOString(),
      snapshotHash: hash,
      previousHash: last?.hash ?? null,
      additions: addCount,
      modifications: retroCount,
      changes: allChanges,
    };
    changeLogUrl = await putChangeLog([...log, entry]);
  }

  return NextResponse.json({
    ok: true,
    summary: {
      teamTotal: newSnapshot.teamTotal,
      qualifiedCount: newSnapshot.qualifiedCount,
      totalAccrued: newTracker.totalAccrued,
      changes: allChanges.length,
      retroactive: retroCount,
      additions: addCount,
      months,
    },
    blobUrls: {
      tracker: trackerUrl,
      snapshots: snapshotsUrl,
      changeLog: changeLogUrl,
      xlsx: xlsxUrl,
    },
  });
}
