import { NextRequest, NextResponse } from 'next/server';
import { buildTrackerJSON, dataMapHash, trackerToDataMap } from '@/lib/trip/tracker';
import { computeDiff } from '@/lib/trip/diff';
import { renderTripDashboard } from '@/lib/trip/render';
import {
  getChangeLog,
  getSnapshots,
  getTracker,
  putBackupHtml,
  putChangeLog,
  putSnapshots,
  putTracker,
  putXlsx,
} from '@/lib/trip/store';
import competitionConfig from '@/data/competition-config.json';
import { ChangeLogEntry, DataMap, Snapshot } from '@/lib/trip/types';
import { getActivePeriod } from '@/lib/trip/period';
import { checkWritablePeriod, scopeDataMapToPeriod } from '@/lib/trip/guards';

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

  const activePeriod = getActivePeriod();

  // Refuse the write if the live tracker still belongs to a closed half —
  // otherwise a new half's numbers would be appended to locked totals.
  const currentTracker = await getTracker();
  const guard = checkWritablePeriod(currentTracker);
  if (guard) {
    return NextResponse.json(
      { error: guard.error, livePeriod: guard.livePeriod, activePeriod: guard.activePeriod },
      { status: guard.status },
    );
  }

  // Scope the incoming data to the active period. This is the real guard:
  // the dataMap arrives as JSON and never passes through parseXlsxBuffer.
  const scoped = scopeDataMapToPeriod(body.dataMap, activePeriod);
  if (scoped.empty) {
    return NextResponse.json(
      {
        error: `Upload contained no months in ${activePeriod.name} (${activePeriod.months[0]}–${activePeriod.months[5]}).`,
        ignoredMonths: scoped.ignoredMonths,
      },
      { status: 400 },
    );
  }
  const dataMap = scoped.dataMap;

  // Determine months from the data
  const monthSet = new Set<string>();
  for (const rep of Object.keys(dataMap)) {
    for (const m of Object.keys(dataMap[rep])) monthSet.add(m);
  }
  const months = activePeriod.months.filter((m) => monthSet.has(m));

  // Build new tracker
  const newTracker = buildTrackerJSON({
    dataMap,
    months,
    tiers: competitionConfig.monthlyBonusTiers,
    tripThreshold: competitionConfig.awardsTrip.threshold,
    period: activePeriod,
    source: body.fileName || 'uploaded',
  });

  // Diff for change log
  const currentMap = currentTracker ? trackerToDataMap(currentTracker) : {};
  const diff = computeDiff(currentMap, dataMap);
  const allChanges = [
    ...diff.retroactive,
    ...diff.removed,
    ...diff.newCellAdditions,
    ...diff.newMonthAdditions,
  ];

  // BACKUP: render the *current* /trip dashboard to HTML and persist it
  // before any writes, so we always keep a frozen view of what the page
  // looked like before this upload. Skips if there's no current tracker.
  let backupUrl: string | null = null;
  let backupKey: string | null = null;
  if (currentTracker) {
    try {
      const prevHash = await dataMapHash(currentMap);
      const html = renderTripDashboard({
        tracker: currentTracker,
        snapshots: await getSnapshots(),
        changeLog: await getChangeLog(),
      });
      const backup = await putBackupHtml(html, prevHash);
      backupUrl = backup.url;
      backupKey = backup.key;
    } catch (e) {
      console.error('[trip/commit] HTML backup failed', e);
    }
  }

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
  const hash = await dataMapHash(dataMap);
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

  // Fire a Vercel deploy hook so the static /trip is rebuilt with new data.
  // Skipped silently when VERCEL_DEPLOY_HOOK_URL is not configured.
  let deploy: { triggered: boolean; status?: number; jobId?: string; error?: string } = {
    triggered: false,
  };
  const deployHook = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (deployHook && allChanges.length > 0) {
    try {
      const r = await fetch(deployHook, { method: 'POST' });
      const text = await r.text();
      let jobId: string | undefined;
      try {
        jobId = (JSON.parse(text) as { job?: { id?: string } })?.job?.id;
      } catch {
        /* not JSON, ignore */
      }
      deploy = { triggered: r.ok, status: r.status, jobId };
      if (!r.ok) deploy.error = text.slice(0, 200);
    } catch (e) {
      deploy = { triggered: false, error: e instanceof Error ? e.message : String(e) };
    }
  } else if (!deployHook) {
    deploy = { triggered: false, error: 'VERCEL_DEPLOY_HOOK_URL not configured' };
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
      ignoredMonths: scoped.ignoredMonths,
      period: activePeriod.id,
    },
    blobUrls: {
      tracker: trackerUrl,
      snapshots: snapshotsUrl,
      changeLog: changeLogUrl,
      xlsx: xlsxUrl,
      backupHtml: backupUrl,
      backupKey,
    },
    deploy,
  });
}
