/**
 * Review-Request Queue Drain — DRAFT, NOT YET SCHEDULED
 *
 * Daily cron that reads pending entries from the sheet-backed queue
 * (`Review Request Queue` tab) and fires a customer review-request email
 * for each row whose `sendAfter` timestamp has passed.
 *
 * Trigger: GET /api/cron/review-request-queue
 * Schedule (when enabled in vercel.json): `0 19 * * *` (1pm CT — early
 *   afternoon is the best email-open window for residential customers)
 * Auth: CRON_SECRET header (Vercel) or admin/owner session (manual run)
 *
 * Two-env gate (intentional — sweep/review-automation does not autostart):
 *   1. ENABLE_REVIEW_REQUESTS=true    — opens the 'review-request' template
 *      in lib/email-service.ts isTemplateAllowed(). Without this, every
 *      send drops with `dropped_template_not_allowed`. Default OFF.
 *   2. NEXT_PUBLIC_GOOGLE_REVIEW_URL  — the Google review URL passed into
 *      the template. Without this, sendReviewRequest() refuses to fire
 *      (we won't ship a [needs-owner] placeholder to a real customer).
 *
 * Idempotency: queue rows transition pending -> sent / failed. Each run
 * drains only `pending` rows whose `sendAfter` <= now. Failures leave
 * the row as `failed` with a `lastError` set — operator can flip it
 * back to `pending` to retry.
 *
 * NOTE: NOT YET ADDED TO vercel.json crons. See the entry stub at the
 * bottom of vercel.json (commented out) — flip it on once the owner
 * provisions the env vars.
 */

import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/email-service';
import {
  getEligibleQueueEntries,
  updateQueueEntry,
} from '@/lib/review-request-queue';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  // Auth: Vercel cron header OR admin/owner session.
  const authHeader = request.headers.get('authorization') || '';
  const isVercelCron = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;
  if (!isVercelCron) {
    const { requireAuth } = await import('@/lib/auth-service');
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;
    if (!['admin', 'owner'].includes(auth.user.role)) {
      return NextResponse.json(
        { error: 'CRON_SECRET header or admin/owner role required' },
        { status: 403 },
      );
    }
  }

  // Pre-flight: if the master gate is off, do nothing. Return 200 with a
  // diagnostic body so the cron health check stays green.
  if (process.env.ENABLE_REVIEW_REQUESTS !== 'true') {
    return NextResponse.json({
      success: true,
      drained: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      message:
        'ENABLE_REVIEW_REQUESTS is not "true" — queue drain skipped. ' +
        'Owner: set ENABLE_REVIEW_REQUESTS=true and NEXT_PUBLIC_GOOGLE_REVIEW_URL to enable.',
    });
  }

  if (!process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL) {
    return NextResponse.json({
      success: false,
      drained: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      error:
        'NEXT_PUBLIC_GOOGLE_REVIEW_URL not set — refusing to drain queue ' +
        'with placeholder URL. Provision the env first.',
    }, { status: 503 });
  }

  let eligible: Awaited<ReturnType<typeof getEligibleQueueEntries>>;
  try {
    eligible = await getEligibleQueueEntries();
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'queue read failed',
    }, { status: 500 });
  }

  if (eligible.length === 0) {
    return NextResponse.json({
      success: true,
      drained: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      message: 'No eligible queue entries.',
    });
  }

  let sent = 0;
  let failed = 0;
  const results: Array<{ ticketId: string; status: 'sent' | 'failed'; error?: string }> = [];

  for (const entry of eligible) {
    const nowIso = new Date().toISOString();
    try {
      const result = await emailService.sendReviewRequest({
        customerEmail: entry.customerEmail,
        customerName: entry.customerName,
        projectAddress: entry.projectAddress,
        projectType: entry.projectType,
        googleReviewUrl: process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL,
      });
      if (result.success) {
        sent++;
        await updateQueueEntry(entry.ticketId, {
          status: 'sent',
          lastAttemptAt: nowIso,
          sentAt: nowIso,
          lastError: '',
        });
        results.push({ ticketId: entry.ticketId, status: 'sent' });
      } else {
        failed++;
        await updateQueueEntry(entry.ticketId, {
          status: 'failed',
          lastAttemptAt: nowIso,
          lastError: result.error || 'send failed',
        });
        results.push({
          ticketId: entry.ticketId,
          status: 'failed',
          error: result.error,
        });
      }
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : 'unknown error';
      await updateQueueEntry(entry.ticketId, {
        status: 'failed',
        lastAttemptAt: nowIso,
        lastError: msg,
      });
      results.push({ ticketId: entry.ticketId, status: 'failed', error: msg });
    }
  }

  return NextResponse.json({
    success: true,
    drained: eligible.length,
    sent,
    failed,
    skipped: 0,
    results,
  });
}

// ─── TODO before scheduling ───────────────────────────────────────────────
// 1. Provision env vars in Vercel:
//    - ENABLE_REVIEW_REQUESTS=true
//    - NEXT_PUBLIC_GOOGLE_REVIEW_URL=https://search.google.com/local/writereview?placeid=...
// 2. Uncomment / add the vercel.json crons entry (currently disabled):
//    { "path": "/api/cron/review-request-queue", "schedule": "0 19 * * *" }
// 3. Decide timing model in lib/load-verified-aftermath.ts (Option A/B/C in
//    the TODO comment) — default is 3 days post load-verified.
// 4. Confirm REVIEW_REQUEST_DELAY_DAYS (default 3) matches the desired ask
//    cadence. Tune via env without touching code.
