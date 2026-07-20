import { NextResponse } from 'next/server';
import { getTracker, getSnapshots, getChangeLog, listArchivedPeriods } from '@/lib/trip/store';
import { renderTripDashboard } from '@/lib/trip/render';
import { getActivePeriod, inferPeriodId } from '@/lib/trip/period';

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
  const [snapshots, changeLog, archives] = await Promise.all([
    getSnapshots(),
    getChangeLog(),
    listArchivedPeriods(),
  ]);
  let html = renderTripDashboard({ tracker, snapshots, changeLog });

  const banners: string[] = [];

  // Warn loudly if the calendar rolled into a new half but rollover hasn't run
  // — the numbers on screen belong to a period that has already closed.
  const active = getActivePeriod();
  const liveId = inferPeriodId(tracker.period);
  if (liveId && liveId !== active.id) {
    banners.push(
      `<div style="background:#3d1f1f;border-bottom:2px solid #ff453a;color:#ffb3ae;padding:12px 20px;font:600 14px/1.5 system-ui,sans-serif;text-align:center">
        ⚠️ Showing <strong>${liveId}</strong>, but the active period is <strong>${active.id}</strong>.
        Uploads are blocked until this half is archived — run <code>POST /api/trip/rollover</code>.
      </div>`,
    );
  }

  if (archives.length > 0) {
    const links = archives
      .map(
        (a) =>
          `<a href="/trip/${a.id}" style="color:#8be9a0;text-decoration:underline">🔒 ${a.name}</a>`,
      )
      .join(' &nbsp;·&nbsp; ');
    banners.push(
      `<div style="background:#101a14;border-bottom:1px solid #2a3342;color:#8b95a5;padding:8px 20px;font:500 12px/1.5 system-ui,sans-serif;text-align:center">
        Locked archives: ${links}
      </div>`,
    );
  }

  if (banners.length > 0) {
    html = html.replace(/<body([^>]*)>/i, `<body$1>${banners.join('')}`);
  }

  return new NextResponse(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store, must-revalidate',
    },
  });
}
