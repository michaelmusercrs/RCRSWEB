/**
 * Material-Order Forwarder Heartbeat / Stall Detector
 *
 * Material orders arrive by email to stock@rcrsal.com. A Google Apps Script
 * trigger (runs every minute) forwards each one to our webhook, which creates
 * a ticket in the master-sheet 'Tickets' tab with ticketId prefix `TKT-R-`
 * and createdBy `email-webhook`.
 *
 * Failure mode this guards against: that Apps Script trigger silently stops
 * firing (Google disables it, quota, auth lapse) — orders quietly stop
 * flowing in and NOBODY is alerted. This cron watches the freshest
 * email-created ticket and screams if it goes stale.
 *
 * Why BUSINESS hours, not wall-clock: orders only arrive Mon–Sat, ~7am–6pm
 * Central. A raw wall-clock age would false-alarm every Monday morning (no
 * Sunday orders) and every night. We count only Mon–Sat 7am–6pm CT hours.
 *
 * Trigger: GET /api/cron/forwarder-heartbeat
 * Schedule (vercel.json): `0 17,22 * * 1-6` (11am + 4pm CT, Mon–Sat)
 * Auth: CRON_SECRET bearer header (Vercel) or admin/owner/manager session.
 * Query: ?dryRun=1 → compute + report, but send NO email.
 *
 * Healthy (age within threshold): sends nothing, returns JSON summary.
 * Stalled (age > threshold): failure-only email to the owner gmail.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ticketSheetService } from '@/lib/ticket-sheet-service';
import { emailService } from '@/lib/email-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Scans every ticket to find the newest email-created one; grows with ticket
// volume, so the 60s default is unsafe.
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;

// Email-created orders are uniquely prefixed by the webhook.
const EMAIL_TICKET_PREFIX = 'TKT-R-';

// Stall threshold, counted in BUSINESS hours (see helper below). 16 biz hours
// ≈ 1.5 working days of silence — long enough to avoid a slow-morning false
// alarm, short enough to catch a dead trigger same/next day.
const STALL_THRESHOLD_BUSINESS_HOURS = 16;

// Where the alert goes. Owner gmail only — this is an ops failure alert.
const ALERT_TO = 'rivercityroofingsolutions@gmail.com';

// ── Business-hours model (America/Chicago, Mon–Sat 7am–6pm) ─────────────────
const CHICAGO_TZ = 'America/Chicago';
const BIZ_START_HOUR = 7;   // inclusive
const BIZ_END_HOUR = 18;    // exclusive (6pm)
const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/** Chicago-local weekday (0=Sun) + hour for an instant. */
function chicagoWeekdayHour(d: Date): { weekday: number; hour: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CHICAGO_TZ,
    weekday: 'short',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(d);
  let weekday = 1;
  let hour = 0;
  for (const p of parts) {
    if (p.type === 'weekday') weekday = WEEKDAY_INDEX[p.value] ?? 1;
    else if (p.type === 'hour') hour = parseInt(p.value, 10) % 24; // '24' → 0
  }
  return { weekday, hour };
}

/** True when the instant falls inside a Mon–Sat 7am–6pm Chicago window. */
function isBusinessTime(d: Date): boolean {
  const { weekday, hour } = chicagoWeekdayHour(d);
  if (weekday === 0) return false; // Sunday
  return hour >= BIZ_START_HOUR && hour < BIZ_END_HOUR;
}

/**
 * Count business hours between two instants (start < end). Steps in 10-minute
 * samples and sums the fraction that land in a business window — accurate to a
 * few minutes, which is plenty against a 16-hour threshold. Capped at 60 days
 * of wall time so a very stale ticket can't spin the loop.
 */
function businessHoursBetween(start: Date, end: Date): number {
  const startMs = start.getTime();
  const endMs = end.getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) {
    return 0;
  }
  const stepMs = 10 * 60 * 1000;
  const stepHours = stepMs / (1000 * 60 * 60);
  const maxSpanMs = 60 * 24 * 60 * 60 * 1000;
  const hardEnd = Math.min(endMs, startMs + maxSpanMs);
  let biz = 0;
  for (let t = startMs; t < hardEnd; t += stepMs) {
    const mid = new Date(t + stepMs / 2);
    if (isBusinessTime(mid)) biz += stepHours;
  }
  return biz;
}

function fmtChicago(d: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: CHICAGO_TZ,
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).format(d);
}

function buildAlertHtml(lastCreatedAt: string, lastTicketId: string, bizHours: number): string {
  const when = lastCreatedAt ? fmtChicago(new Date(lastCreatedAt)) : '(none found)';
  return `
<div style="font-family: -apple-system, sans-serif; max-width: 640px; margin: 0 auto;">
  <div style="background: #c0392b; color: white; padding: 20px;">
    <h1 style="margin: 0; font-size: 20px;">Material-order forwarder may be stalled</h1>
    <p style="margin: 6px 0 0; font-size: 14px;">No new email-created order in ${Math.round(bizHours)} business hours (threshold: ${STALL_THRESHOLD_BUSINESS_HOURS}h).</p>
  </div>
  <div style="padding: 20px; color: #222;">
    <p>The stock@rcrsal.com → webhook forwarder creates a ticket for every material
       order email. The most recent one is now stale, which usually means the
       Google Apps Script trigger has stopped firing.</p>
    <table style="border-collapse: collapse; margin: 16px 0;">
      <tr>
        <td style="padding: 6px 12px; color: #666;">Last email-created ticket</td>
        <td style="padding: 6px 12px; font-family: monospace;">${lastTicketId || '(none)'}</td>
      </tr>
      <tr>
        <td style="padding: 6px 12px; color: #666;">Created at</td>
        <td style="padding: 6px 12px;"><strong>${when}</strong></td>
      </tr>
      <tr>
        <td style="padding: 6px 12px; color: #666;">Business-hours since</td>
        <td style="padding: 6px 12px;"><strong>${Math.round(bizHours)}h</strong> (Mon–Sat 7am–6pm CT)</td>
      </tr>
    </table>
    <h3 style="margin: 20px 0 8px;">What to check</h3>
    <ol style="padding-left: 20px; line-height: 1.6;">
      <li>Apps Script trigger at <a href="https://script.google.com">script.google.com</a> —
          confirm the stock@ forwarder trigger still exists and is enabled (Google
          silently disables triggers after auth lapses / repeated errors).</li>
      <li>The <strong>RCRS-Error</strong> Gmail label for bounced/failed forward runs.</li>
      <li>That order emails are in fact still arriving at stock@rcrsal.com (a real
          lull in orders will also trip this — verify before assuming a fault).</li>
    </ol>
    <p style="margin-top: 24px; font-size: 12px; color: #888;">
      This alert fires only on failure. If the forwarder is healthy you hear nothing.
    </p>
  </div>
</div>`;
}

export async function GET(request: NextRequest) {
  // ── Auth: Vercel cron bearer, or admin/owner/manager session for manual run.
  const authHeader = request.headers.get('authorization') || '';
  const isVercelCron = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;
  if (!isVercelCron) {
    const { requireAuth } = await import('@/lib/auth-service');
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;
    if (!['admin', 'owner', 'manager'].includes(auth.user.role)) {
      return NextResponse.json(
        { error: 'CRON_SECRET header or admin/owner/manager role required' },
        { status: 403 }
      );
    }
  }

  const dryRun = request.nextUrl.searchParams.get('dryRun') === '1';

  const all = await ticketSheetService.getAll();
  const emailTickets = all.filter(t => (t.ticketId || '').startsWith(EMAIL_TICKET_PREFIX));

  // Newest email-created ticket by createdAt.
  let newest: { ticketId: string; createdAt: string; ms: number } | null = null;
  for (const t of emailTickets) {
    const createdAt = t.createdAt || '';
    const ms = new Date(createdAt).getTime();
    if (!Number.isFinite(ms)) continue;
    if (!newest || ms > newest.ms) {
      newest = { ticketId: t.ticketId, createdAt, ms };
    }
  }

  // No email-created tickets at all with a valid date → can't measure a gap.
  // Report it (something is off) but do not alert-spam.
  if (!newest) {
    return NextResponse.json({
      success: true,
      dryRun,
      emailTicketCount: emailTickets.length,
      stalled: false,
      emailSent: false,
      message: emailTickets.length === 0
        ? `No tickets with prefix ${EMAIL_TICKET_PREFIX} found; nothing to measure.`
        : `Tickets found but none had a parseable createdAt; nothing to measure.`,
    });
  }

  const now = new Date();
  const bizHours = businessHoursBetween(new Date(newest.ms), now);
  const stalled = bizHours > STALL_THRESHOLD_BUSINESS_HOURS;

  const summary = {
    success: true,
    dryRun,
    emailTicketCount: emailTickets.length,
    lastTicketId: newest.ticketId,
    lastCreatedAt: newest.createdAt,
    businessHoursSinceLast: Math.round(bizHours * 10) / 10,
    thresholdBusinessHours: STALL_THRESHOLD_BUSINESS_HOURS,
    stalled,
  };

  if (!stalled) {
    return NextResponse.json({
      ...summary,
      emailSent: false,
      message: 'Forwarder healthy — within threshold. Nothing emailed.',
    });
  }

  if (dryRun) {
    return NextResponse.json({
      ...summary,
      emailSent: false,
      wouldEmail: {
        to: ALERT_TO,
        subject: '[RCRS] Material-order forwarder may be stalled',
      },
      message: 'DRY RUN — would have emailed the stall alert.',
    });
  }

  const subject = '[RCRS] Material-order forwarder may be stalled';
  const body = buildAlertHtml(newest.createdAt, newest.ticketId, bizHours);
  // Reuse the internal 'stalled-tickets-digest' template tag — same ops/alert
  // class, already in the allowlist union; avoids editing lib/email-service.ts.
  const res = await emailService.send({
    template: 'stalled-tickets-digest',
    to: ALERT_TO,
    subject,
    body,
  });

  return NextResponse.json({
    ...summary,
    emailSent: res.success,
    emailError: res.success ? undefined : res.error,
  });
}
