import { NextRequest, NextResponse } from 'next/server';
import { parseXlsxBuffer, buildTrackerJSON, trackerToDataMap } from '@/lib/trip/tracker';
import { computeDiff } from '@/lib/trip/diff';
import { getExcludedReps, getTracker } from '@/lib/trip/store';
import competitionConfig from '@/data/competition-config.json';
import { getActivePeriod } from '@/lib/trip/period';
import { checkWritablePeriod } from '@/lib/trip/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided (field name "file").' }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 10MB).' }, { status: 413 });
  }

  const activePeriod = getActivePeriod();
  const excludedReps = await getExcludedReps();
  let parsed: Awaited<ReturnType<typeof parseXlsxBuffer>>;
  try {
    const buf = await file.arrayBuffer();
    parsed = await parseXlsxBuffer(buf, excludedReps, new Set(activePeriod.months));
  } catch (e) {
    return NextResponse.json(
      { error: 'Failed to parse xlsx: ' + (e instanceof Error ? e.message : String(e)) },
      { status: 400 },
    );
  }

  if (parsed.months.length === 0) {
    return NextResponse.json(
      {
        error: `No month tabs for ${activePeriod.name} found. Expected one or more of: ${activePeriod.months.join(', ')}.`,
        ignoredMonths: parsed.ignoredMonths,
      },
      { status: 400 },
    );
  }

  // Build tracker JSON for the incoming data so the client can preview it
  const incomingTracker = buildTrackerJSON({
    dataMap: parsed.dataMap,
    months: parsed.months,
    tiers: competitionConfig.monthlyBonusTiers,
    tripThreshold: competitionConfig.awardsTrip.threshold,
    period: activePeriod,
    source: file.name,
  });

  // Diff against current
  const currentTracker = await getTracker();
  const guard = checkWritablePeriod(currentTracker);
  const currentMap = currentTracker ? trackerToDataMap(currentTracker) : {};
  const diff = computeDiff(currentMap, parsed.dataMap);

  return NextResponse.json({
    fileName: file.name,
    activePeriod: activePeriod.id,
    periodGuard: guard,
    ignoredMonths: parsed.ignoredMonths,
    incomingTracker,
    incomingDataMap: parsed.dataMap,
    incomingMonths: parsed.months,
    excludedSummary: parsed.excludedSummary,
    excludedReps: parsed.excludedReps,
    diff,
  });
}
