/**
 * GAF QuickMeasure → JobNimbus ingest cron.
 *
 * Every ~15 min (vercel.json): reads new QuickMeasure reports from the rcrs@
 * mailbox, matches each to a JN job by address, attaches the Full Report PDF +
 * a material cheat-sheet note, emails the rep the summary, and runs the
 * no-match retry/escalation + follow-up verification ladder.
 *
 * Trigger: GET /api/cron/gaf-report-sync
 * Auth: CRON_SECRET bearer header (Vercel) or admin/owner/office/manager session.
 *
 * All heavy lifting + error handling lives in lib/gaf/gaf-ingest-service.ts,
 * which never throws.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCronLock } from '@/lib/cron-lock';
import { processGafReports } from '@/lib/gaf/gaf-ingest-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Reads mailbox + a window of JN jobs + per-report attachments; grows with volume.
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || '';
  const isVercelCron = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;
  if (!isVercelCron) {
    const { requireAuth } = await import('@/lib/auth-service');
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;
    if (!['admin', 'owner', 'manager', 'office'].includes(auth.user.role)) {
      return NextResponse.json(
        { error: 'CRON_SECRET header or admin/owner/manager/office role required' },
        { status: 403 },
      );
    }
  }

  // Manual runs (admin session) may pass ?lookbackDays=N&quiet=1 for a one-time
  // backlog sweep. The scheduled Vercel call passes neither → normal behavior.
  const lookbackParam = request.nextUrl.searchParams.get('lookbackDays');
  const quiet = request.nextUrl.searchParams.get('quiet') === '1';
  const lookbackDays = lookbackParam ? Math.min(60, Math.max(1, parseInt(lookbackParam, 10) || 0)) : undefined;

  return withCronLock('gaf-report-sync', { staleMinutes: 20 }, async () => {
    const result = await processGafReports({ lookbackDays, quiet });
    return NextResponse.json({ success: true, ...result });
  });
}
