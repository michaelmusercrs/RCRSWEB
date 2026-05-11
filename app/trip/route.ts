import { NextResponse } from 'next/server';
import { getTracker, getSnapshots, getChangeLog } from '@/lib/trip/store';
import { renderTripDashboard } from '@/lib/trip/render';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const tracker = await getTracker();
  if (!tracker) {
    return new NextResponse(
      '<h1>Trip dashboard data not available.</h1><p>No data found in Blob or bundled file. Upload at <a href="/trip/update">/trip/update</a>.</p>',
      { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } },
    );
  }
  const [snapshots, changeLog] = await Promise.all([getSnapshots(), getChangeLog()]);
  const html = renderTripDashboard({ tracker, snapshots, changeLog });
  return new NextResponse(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store, must-revalidate',
    },
  });
}
