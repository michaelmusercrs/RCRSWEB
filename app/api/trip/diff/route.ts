import { NextRequest, NextResponse } from 'next/server';
import { parseXlsxBuffer, buildTrackerJSON, trackerToDataMap } from '@/lib/trip/tracker';
import { computeDiff } from '@/lib/trip/diff';
import { getTracker } from '@/lib/trip/store';
import competitionConfig from '@/data/competition-config.json';

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

  let parsed: { dataMap: ReturnType<typeof trackerToDataMap>; months: string[] };
  try {
    const buf = await file.arrayBuffer();
    parsed = await parseXlsxBuffer(buf);
  } catch (e) {
    return NextResponse.json(
      { error: 'Failed to parse xlsx: ' + (e instanceof Error ? e.message : String(e)) },
      { status: 400 },
    );
  }

  if (parsed.months.length === 0) {
    return NextResponse.json(
      { error: 'No month tabs found. Tab names must match: January, February, March, ...' },
      { status: 400 },
    );
  }

  // Build tracker JSON for the incoming data so the client can preview it
  const incomingTracker = buildTrackerJSON({
    dataMap: parsed.dataMap,
    months: parsed.months,
    tiers: competitionConfig.monthlyBonusTiers,
    tripThreshold: competitionConfig.awardsTrip.threshold,
    period: competitionConfig.currentPeriod,
    source: file.name,
  });

  // Diff against current
  const currentTracker = await getTracker();
  const currentMap = currentTracker ? trackerToDataMap(currentTracker) : {};
  const diff = computeDiff(currentMap, parsed.dataMap);

  return NextResponse.json({
    fileName: file.name,
    incomingTracker,
    incomingDataMap: parsed.dataMap,
    incomingMonths: parsed.months,
    diff,
  });
}
