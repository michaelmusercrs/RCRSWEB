/**
 * Monday Prep Pre-Generation Cron — DRAFT, NOT YET SCHEDULED
 *
 * Pre-generates the Monday meeting prep auto-fill so the proposed deck is
 * ready when Michael wakes up Monday morning. Without this, the owner pays
 * the ~3-5 second sheet+weather fetch tax the first time the page loads.
 *
 * Trigger: GET /api/cron/monday-prep-pregen
 * Schedule (when added to vercel.json crons):
 *   `0 0 * * 1`  — midnight UTC every Monday
 *                  = 6:00 PM Sunday CDT (US/Central in DST)
 *                  = 7:00 PM Sunday CST (US/Central in standard time)
 *   The task spec said 6pm Sunday Central / midnight-UTC-Monday, which is
 *   accurate during DST. During CST the cron fires at 7pm Sunday, still
 *   well before the 10am Monday meeting — fine in practice.
 *
 * Auth: requires `Bearer ${CRON_SECRET}` header (same pattern as
 *       /api/cron/meeting-reset and /api/cron/auto-review-request).
 *
 * Idempotency: writes to `Monday Prep` tab keyed by weekStart. Re-runs
 *       overwrite the same row. Safe to invoke multiple times — never
 *       creates duplicates.
 *
 * Side effects: this cron only PRE-GENERATES the draft. It does NOT mark
 *       the row approved=true. The owner must still review + approve via
 *       the UI before the meeting. Nothing auto-sends.
 *
 * Parking: while DRAFT, this entry lives under vercel.json `_disabledCrons`
 *       and Vercel ignores it. Move it into the active `crons` array when
 *       the owner is ready to flip it live.
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildPrepData } from '@/lib/monday-prep-autofill';
import { googleSheetsService } from '@/lib/google-sheets-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function verifyCronAuth(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // Match the pattern used by /api/cron/meeting-reset: when no secret is
    // configured (dev), allow. Production should always have CRON_SECRET.
    return true;
  }
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${cronSecret}`;
}

/**
 * Calculate the upcoming Monday in Central Time. Cron fires Sunday evening
 * UTC, so we want the very next Monday (≤ 7 hours away).
 */
function getUpcomingMondayISO(): string {
  const now = new Date();
  const ct = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const dow = ct.getDay(); // 0=Sun..6=Sat
  // Days until upcoming Monday. Sun(0)->1, Mon(1)->0, Tue(2)->6, ...
  const daysUntilMon = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
  ct.setDate(ct.getDate() + daysUntilMon);
  const y = ct.getFullYear();
  const m = String(ct.getMonth() + 1).padStart(2, '0');
  const d = String(ct.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const weekStart = getUpcomingMondayISO();

  try {
    const prepData = await buildPrepData({ weekStart });

    const ok = await googleSheetsService.saveMondayPrep({
      weekStart,
      generatedAt: prepData.generatedAt,
      sections: JSON.stringify(prepData),
      reviewed: 'false',
      approved: 'false',
      approvedBy: '',
      approvedAt: '',
    });

    const duration = Date.now() - startedAt;
    const detail = `weekStart=${weekStart} warnings=${prepData.warnings.length} sources=${prepData.dataSources.length}`;

    // Best-effort heartbeat — never let it mask a real failure
    try {
      const { recordCronHeartbeat } = await import('@/lib/cron-heartbeat');
      await recordCronHeartbeat(
        'monday-prep-pregen',
        ok ? 'success' : 'error',
        duration,
        detail
      );
    } catch { /* heartbeat is non-critical */ }

    if (!ok) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to save Monday prep draft',
          weekStart,
          warnings: prepData.warnings,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Pre-generated Monday prep for ${weekStart}.`,
      weekStart,
      durationMs: duration,
      warnings: prepData.warnings,
      dataSources: prepData.dataSources,
      announcementsProposed: prepData.proposedAnnouncements.length,
      needsReview: prepData.proposedAnnouncements.filter(a => a.needsOwnerReview).length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[monday-prep-pregen] Failed:', message);

    try {
      const { recordCronHeartbeat } = await import('@/lib/cron-heartbeat');
      await recordCronHeartbeat(
        'monday-prep-pregen',
        'error',
        Date.now() - startedAt,
        message
      );
    } catch { /* heartbeat non-critical */ }

    return NextResponse.json(
      { success: false, error: message, weekStart },
      { status: 500 }
    );
  }
}
