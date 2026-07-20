import { NextResponse } from 'next/server';
import { getArchivedDashboardHtml, getArchivedMeta } from '@/lib/trip/store';
import { getActivePeriod, parsePeriodId } from '@/lib/trip/period';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Read-only view of a locked period, e.g. /trip/H1-2026.
 *
 * Serves the dashboard.html frozen at rollover verbatim rather than
 * re-rendering the archived tracker — historical presentation should not
 * drift as render.ts evolves.
 */
export async function GET(
  _req: Request,
  // Next 14 passes a plain object; awaiting is harmless and keeps this working
  // if the app is upgraded to Next 15, where params became a Promise.
  { params }: { params: { period: string } | Promise<{ period: string }> },
) {
  const { period: rawId } = await params;
  const period = parsePeriodId(rawId);

  if (!period) {
    return html(
      `<h1>Unknown period "${escapeHtml(rawId)}"</h1><p>Expected something like <code>H1-2026</code>. <a href="/trip">Back to the current dashboard</a>.</p>`,
      404,
    );
  }

  // The active period is live, not archived — send it to the real dashboard.
  if (period.id === getActivePeriod().id) {
    return NextResponse.redirect(new URL('/trip', _req.url), 307);
  }

  const [archivedHtml, meta] = await Promise.all([
    getArchivedDashboardHtml(period.id),
    getArchivedMeta(period.id),
  ]);

  if (!archivedHtml || !meta) {
    return html(
      `<h1>${period.name} is not archived</h1><p>No locked archive exists for this period yet. <a href="/trip">Back to the current dashboard</a>.</p>`,
      404,
    );
  }

  const lockedOn = new Date(meta.lockedAt).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Chicago',
  });

  const banner = `
<div style="background:#3d2b0f;border-bottom:2px solid #b78b2a;color:#f5d78a;padding:12px 20px;font:600 14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:center;text-align:center">
  <span>🔒 <strong>${period.name} — FINAL.</strong> Locked ${lockedOn}. These numbers are frozen and cannot change.</span>
  <a href="/trip" style="color:#ffd97a;text-decoration:underline">Go to the current period →</a>
</div>
<style>
  /* An archived board must not offer any write affordance. */
  a[href="/trip/update"], a[href^="/trip/update"] { display: none !important; }
</style>`;

  const withBanner = archivedHtml.replace(/<body([^>]*)>/i, `<body$1>${banner}`);

  return new NextResponse(withBanner, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Archived content is immutable.
      'cache-control': 'public, max-age=3600',
    },
  });
}

function html(body: string, status: number) {
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Trip archive</title></head><body style="font:16px/1.6 system-ui,sans-serif;background:#0d1117;color:#e6edf3;padding:40px;max-width:640px;margin:0 auto">${body}</body></html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}
