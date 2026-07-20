import { NextRequest, NextResponse } from 'next/server';
import { buildTrackerJSON, dataMapHash, trackerToDataMap } from '@/lib/trip/tracker';
import { renderTripDashboard } from '@/lib/trip/render';
import {
  PeriodMeta,
  getArchivedMeta,
  getChangeLog,
  getSnapshots,
  getTracker,
  getXlsxUrl,
  putArchiveFile,
  putChangeLog,
  putSnapshots,
  putTracker,
} from '@/lib/trip/store';
import competitionConfig from '@/data/competition-config.json';
import { getActivePeriod, inferPeriodId, parsePeriodId, previousPeriod } from '@/lib/trip/period';
import { DataMap, Snapshot } from '@/lib/trip/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Close out the half that just ended and start the next one from zero.
 *
 * Steps:
 *  1. Split the live dataMap at the period boundary. Months belonging to the
 *     closing half are archived; months belonging to the new half seed the
 *     fresh live tracker. (The live tracker currently holds July mixed into
 *     H1 — this split is what un-mixes it.)
 *  2. Freeze the closing half under trip/periods/{id}/ with locked:true and a
 *     rendered dashboard.html, then verify the archive reads back.
 *  3. Only then overwrite the live keys with the new period.
 *
 * Idempotent: refuses with 409 if the target period is already archived.
 */

interface RolloverBody {
  /** Must equal the period id being archived, e.g. "H1-2026". */
  confirm?: string;
  /** Preview the split without writing anything. */
  dryRun?: boolean;
}

export async function POST(req: NextRequest) {
  let body: RolloverBody = {};
  try {
    body = (await req.json()) as RolloverBody;
  } catch {
    /* empty body is fine for dry runs */
  }

  const liveTracker = await getTracker();
  if (!liveTracker) {
    return NextResponse.json({ error: 'No live tracker to roll over.' }, { status: 404 });
  }

  const closingId = inferPeriodId(liveTracker.period);
  const closing = closingId ? parsePeriodId(closingId) : null;
  if (!closing) {
    return NextResponse.json(
      { error: `Could not determine the period of the live tracker.`, period: liveTracker.period },
      { status: 422 },
    );
  }

  const active = getActivePeriod();
  if (closing.id === active.id) {
    return NextResponse.json(
      {
        error: `${closing.id} is still the active period — nothing to roll over yet.`,
        activePeriod: active.id,
      },
      { status: 409 },
    );
  }

  // The new live period. Normally the current one; if a full half was skipped
  // we still only advance one step so no half is silently swallowed.
  const incoming = previousPeriod(active).id === closing.id ? active : parsePeriodId(closing.half === 1 ? `H2-${closing.year}` : `H1-${closing.year + 1}`)!;

  // --- Idempotency guard: never clobber an existing archive -----------------
  const existing = await getArchivedMeta(closing.id);
  if (existing) {
    return NextResponse.json(
      { error: `${closing.id} is already archived.`, lockedAt: existing.lockedAt, meta: existing },
      { status: 409 },
    );
  }

  if (body.confirm !== closing.id && !body.dryRun) {
    return NextResponse.json(
      {
        error: `Confirmation required. POST {"confirm":"${closing.id}"} to archive ${closing.name}, or {"dryRun":true} to preview.`,
      },
      { status: 400 },
    );
  }

  // --- 1. Split the live data at the period boundary ------------------------
  const liveMap = trackerToDataMap(liveTracker);
  const closingMonths = new Set<string>(closing.months);
  const incomingMonths = new Set<string>(incoming.months);

  const closingMap: DataMap = {};
  const incomingMap: DataMap = {};
  for (const [rep, byMonth] of Object.entries(liveMap)) {
    for (const [month, revenue] of Object.entries(byMonth)) {
      if (closingMonths.has(month)) {
        closingMap[rep] = closingMap[rep] || {};
        closingMap[rep][month] = revenue;
      } else if (incomingMonths.has(month)) {
        incomingMap[rep] = incomingMap[rep] || {};
        incomingMap[rep][month] = revenue;
      }
    }
  }

  const monthsPresent = (map: DataMap, order: string[]) => {
    const seen = new Set<string>();
    for (const byMonth of Object.values(map)) for (const m of Object.keys(byMonth)) seen.add(m);
    return order.filter((m) => seen.has(m));
  };

  const tiers = competitionConfig.monthlyBonusTiers;
  const tripThreshold = competitionConfig.awardsTrip.threshold;

  // Rebuild both trackers from the split maps so YTD, qualification and
  // accrued totals are recomputed against only their own period's months.
  const archivedTracker = buildTrackerJSON({
    dataMap: closingMap,
    months: monthsPresent(closingMap, closing.months),
    tiers,
    tripThreshold,
    period: { id: closing.id, name: closing.name, start: closing.start, end: closing.end },
    source: liveTracker.source,
  });
  archivedTracker.locked = true;
  archivedTracker.lockedAt = new Date().toISOString();

  const incomingTracker = buildTrackerJSON({
    dataMap: incomingMap,
    months: monthsPresent(incomingMap, incoming.months),
    tiers,
    tripThreshold,
    period: { id: incoming.id, name: incoming.name, start: incoming.start, end: incoming.end },
    source: `rollover from ${closing.id}`,
  });

  const splitPreview = {
    closing: {
      period: closing.id,
      months: monthsPresent(closingMap, closing.months),
      teamTotal: archivedTracker.reps.reduce((s, r) => s + r.ytd, 0),
      totalAccrued: archivedTracker.totalAccrued,
      totalToBePaid: archivedTracker.totalToBePaid,
      qualified: archivedTracker.reps.filter((r) => r.qualifiedForTrip).map((r) => r.rep),
      reps: archivedTracker.reps.map((r) => ({ rep: r.rep, ytd: r.ytd, accrued: r.accruedTripBudget, qualified: r.qualifiedForTrip })),
    },
    incoming: {
      period: incoming.id,
      months: monthsPresent(incomingMap, incoming.months),
      teamTotal: incomingTracker.reps.reduce((s, r) => s + r.ytd, 0),
      totalAccrued: incomingTracker.totalAccrued,
      reps: incomingTracker.reps.map((r) => ({ rep: r.rep, ytd: r.ytd, accrued: r.accruedTripBudget })),
    },
  };

  if (body.dryRun) {
    return NextResponse.json({ ok: true, dryRun: true, split: splitPreview });
  }

  // --- 2. Freeze the closing period ----------------------------------------
  const snapshots = await getSnapshots();
  const changeLog = await getChangeLog();
  const dataHash = await dataMapHash(closingMap);

  // Render the frozen dashboard as of the period's last day, so the archived
  // page reads "closed" rather than counting down from today.
  const dashboardHtml = renderTripDashboard({
    tracker: archivedTracker,
    snapshots,
    changeLog,
    today: new Date(`${closing.end}T12:00:00Z`),
  });

  const meta: PeriodMeta = {
    id: closing.id,
    name: closing.name,
    start: closing.start,
    end: closing.end,
    locked: true,
    lockedAt: archivedTracker.lockedAt!,
    dataHash,
    teamTotal: splitPreview.closing.teamTotal,
    qualifiedCount: archivedTracker.reps.filter((r) => r.qualifiedForTrip).length,
    totalAccrued: archivedTracker.totalAccrued,
    totalToBePaid: archivedTracker.totalToBePaid,
    repCount: archivedTracker.reps.length,
    source: liveTracker.source,
  };

  const archived: Record<string, string> = {};
  try {
    // meta.json is written LAST — its presence is what marks the archive
    // complete, and what the idempotency guard above keys off.
    archived.tracker = await putArchiveFile(
      closing.id,
      'tracker.json',
      JSON.stringify(archivedTracker, null, 2),
      'application/json',
    );
    archived.snapshots = await putArchiveFile(
      closing.id,
      'snapshots.json',
      JSON.stringify(snapshots, null, 2),
      'application/json',
    );
    archived.changeLog = await putArchiveFile(
      closing.id,
      'change-log.json',
      JSON.stringify(changeLog, null, 2),
      'application/json',
    );
    archived.dashboard = await putArchiveFile(
      closing.id,
      'dashboard.html',
      dashboardHtml,
      'text/html; charset=utf-8',
    );
    const xlsxUrl = await getXlsxUrl();
    if (xlsxUrl) {
      const res = await fetch(xlsxUrl, { cache: 'no-store' });
      if (res.ok) {
        archived.xlsx = await putArchiveFile(
          closing.id,
          'final.xlsx',
          Buffer.from(await res.arrayBuffer()),
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
      }
    }
    archived.meta = await putArchiveFile(
      closing.id,
      'meta.json',
      JSON.stringify(meta, null, 2),
      'application/json',
    );
  } catch (e) {
    return NextResponse.json(
      {
        error: `Archive write failed — live data untouched. ${e instanceof Error ? e.message : String(e)}`,
        archivedSoFar: archived,
      },
      { status: 500 },
    );
  }

  // --- 3. Verify the archive reads back before touching live ----------------
  const verifyMeta = await getArchivedMeta(closing.id);
  if (!verifyMeta || verifyMeta.dataHash !== dataHash) {
    return NextResponse.json(
      {
        error: 'Archive verification failed — live data left untouched. Inspect the archive manually.',
        expectedHash: dataHash,
        gotHash: verifyMeta?.dataHash ?? null,
      },
      { status: 500 },
    );
  }

  // --- 4. Swap the live keys to the new period ------------------------------
  // writeBlobJSON swallows errors and returns null, so every write is checked.
  const trackerUrl = await putTracker(incomingTracker);
  if (!trackerUrl) {
    return NextResponse.json(
      {
        error: `Archive for ${closing.id} is complete and locked, but writing the new ${incoming.id} tracker FAILED. Live data still shows ${closing.id}. Retry the rollover — the archive guard will skip re-archiving.`,
        archived,
      },
      { status: 500 },
    );
  }

  // Seed the new period with one snapshot so the first real upload diffs
  // against the carried-over months instead of reporting every rep as new.
  const seedSnapshot: Snapshot = {
    capturedAt: new Date().toISOString(),
    capturedDate: new Date().toISOString().slice(0, 10),
    source: `rollover from ${closing.id}`,
    hash: await dataMapHash(incomingMap),
    teamTotal: splitPreview.incoming.teamTotal,
    qualifiedCount: incomingTracker.reps.filter((r) => r.qualifiedForTrip).length,
    totalAccrued: incomingTracker.totalAccrued,
    reps: incomingTracker.reps.map((r) => ({
      rep: r.rep,
      ytd: r.ytd,
      monthly: r.breakdown.map((b) => ({ month: b.month, revenue: b.revenue, bonus: b.bonus })),
      accrued: r.accruedTripBudget,
      qualified: r.qualifiedForTrip,
      pct: r.pctToTrip,
    })),
    isFirst: true,
    previousHash: null,
    previousCapturedAt: null,
    changes: [],
    retroactiveCount: 0,
    additionCount: 0,
  };

  const snapshotsUrl = await putSnapshots([seedSnapshot]);
  const changeLogUrl = await putChangeLog([]);

  return NextResponse.json({
    ok: true,
    archivedPeriod: { ...meta, viewAt: `/trip/${closing.id}` },
    newPeriod: {
      id: incoming.id,
      name: incoming.name,
      start: incoming.start,
      end: incoming.end,
      carriedOverMonths: splitPreview.incoming.months,
      teamTotal: splitPreview.incoming.teamTotal,
      totalAccrued: incomingTracker.totalAccrued,
    },
    split: splitPreview,
    blobUrls: { archive: archived, tracker: trackerUrl, snapshots: snapshotsUrl, changeLog: changeLogUrl },
    warnings: [
      snapshotsUrl ? null : 'snapshots write returned null',
      changeLogUrl ? null : 'change-log write returned null',
    ].filter(Boolean),
  });
}
