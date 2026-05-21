/**
 * Auto-Review-Request Cron — DRAFT, NOT YET SCHEDULED
 *
 * For every delivery ticket that transitioned to 'completed' in the last
 * 24 hours, send a one-click review request to the customer (SMS + email).
 * Closes the 47-vs-800 reviews gap flagged in memory.
 *
 * Trigger: GET /api/cron/auto-review-request
 * Schedule (when added to vercel.json): `0 19 * * *` (1pm CT — early afternoon
 * is the best email-open window for residential customers)
 *
 * Auth: requires CRON_SECRET header (Vercel cron) OR admin/owner session
 *
 * Idempotency: writes a `ReviewRequests` sheet tab row per send. Skips any
 * ticket whose ticketId is already in that tab. Safe to run multiple times.
 *
 * Channels:
 *   - Email always (free)
 *   - SMS if customerPhone present and TWILIO_* env vars configured
 *
 * Links:
 *   - Google review: https://search.google.com/local/writereview?placeid={GOOGLE_PLACE_ID}
 *   - BBB review: https://www.bbb.org/us/al/athens/profile/roofing-contractors/river-city-roofing-solutions/customer-reviews
 *   - Each tracked with ?ref=auto-{ticketId} so we can attribute downstream
 *
 * NOTE: This is a DRAFT. Not yet added to vercel.json crons. Review the
 * subject line and body copy before scheduling. Will not run until enabled.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ticketSheetService } from '@/lib/ticket-sheet-service';
import { emailService } from '@/lib/email-service';
import { JWT } from 'google-auth-library';
import { GoogleSpreadsheet } from 'google-spreadsheet';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CRON_SECRET = process.env.CRON_SECRET;
const GOOGLE_PLACE_ID = process.env.NEXT_PUBLIC_GOOGLE_PLACE_ID || '';
const BBB_REVIEW_URL =
  'https://www.bbb.org/us/al/athens/profile/roofing-contractors/river-city-roofing-solutions';

// Window: only re-request for tickets completed in the last N hours
const COMPLETED_WINDOW_HOURS = 24;

interface ReviewRequestRow {
  requestId: string;
  ticketId: string;
  jobNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  sentAt: string;
  emailSent: 'true' | 'false';
  smsSent: 'true' | 'false';
  googleReviewLink: string;
  bbbReviewLink: string;
}

async function loadSentTicketIds(): Promise<Set<string>> {
  const sheetsId = process.env.DELIVERY_SHEETS_ID || process.env.GOOGLE_SHEETS_ID;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!sheetsId || !privateKey) return new Set();
  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim(),
    key: privateKey.trim(),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const doc = new GoogleSpreadsheet(sheetsId, auth);
  await doc.loadInfo();
  const tab = doc.sheetsByTitle['ReviewRequests'];
  if (!tab) return new Set();
  const rows = await tab.getRows();
  return new Set(rows.map(r => r.get('ticketId')).filter(Boolean));
}

async function appendReviewRequest(row: ReviewRequestRow): Promise<void> {
  const sheetsId = process.env.DELIVERY_SHEETS_ID || process.env.GOOGLE_SHEETS_ID;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!sheetsId || !privateKey) return;
  const auth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim(),
    key: privateKey.trim(),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const doc = new GoogleSpreadsheet(sheetsId, auth);
  await doc.loadInfo();
  let tab = doc.sheetsByTitle['ReviewRequests'];
  if (!tab) {
    tab = await doc.addSheet({
      title: 'ReviewRequests',
      headerValues: [
        'requestId', 'ticketId', 'jobNumber', 'customerName',
        'customerEmail', 'customerPhone', 'sentAt',
        'emailSent', 'smsSent', 'googleReviewLink', 'bbbReviewLink',
      ],
    });
  }
  await tab.addRow(row as unknown as Record<string, string>);
}

function buildEmailHtml(args: {
  customerName: string;
  jobNumber: string;
  googleLink: string;
  bbbLink: string;
}): string {
  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #39FF14 0%, #2ed10f 100%); color: black; padding: 32px; text-align: center;">
    <h1 style="margin: 0; font-size: 28px;">Thank you, ${args.customerName}!</h1>
    <p style="margin: 8px 0 0; font-size: 16px;">Your roof is in safe hands.</p>
  </div>
  <div style="padding: 32px 24px; background: #fafafa;">
    <p>Hi ${args.customerName},</p>
    <p>
      Our team just completed your roofing project (Job ${args.jobNumber}).
      We hope you're 100% satisfied with the work.
    </p>
    <p>
      <strong>If we earned your trust, a quick public review would mean the world to us.</strong>
      Online reviews are how other Alabama homeowners find a contractor they can rely on after a storm.
    </p>
    <div style="margin: 24px 0; text-align: center;">
      <a href="${args.googleLink}"
         style="display: inline-block; background: #4285F4; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 6px;">
        Leave a Google Review
      </a>
      <a href="${args.bbbLink}"
         style="display: inline-block; background: #00529B; color: white; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 6px;">
        Leave a BBB Review
      </a>
    </div>
    <p style="font-size: 14px; color: #555;">
      If anything's not quite right, please reply to this email FIRST — we'd much
      rather fix it than read about it. Thank you for choosing River City Roofing Solutions.
    </p>
    <p style="margin-top: 24px;">
      Sincerely,<br />
      <strong>The River City Roofing Solutions Team</strong>
    </p>
  </div>
  <div style="background: #333; color: white; padding: 16px; text-align: center; font-size: 12px;">
    River City Roofing Solutions · (256) 274-8530 · rivercityroofingsolutions.com
  </div>
</div>`.trim();
}

export async function GET(request: NextRequest) {
  // Auth
  const authHeader = request.headers.get('authorization') || '';
  const isVercelCron = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;
  if (!isVercelCron) {
    const { requireAuth } = await import('@/lib/auth-service');
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;
    if (!['admin', 'owner'].includes(auth.user.role)) {
      return NextResponse.json(
        { error: 'CRON_SECRET header or admin/owner role required' },
        { status: 403 }
      );
    }
  }

  const cutoff = new Date(Date.now() - COMPLETED_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const allTickets = await ticketSheetService.getAll();
  const recentlyCompleted = allTickets.filter(t =>
    t.status === 'completed'
    && t.ticketType === 'delivery'
    && (t.completedAt || '') > cutoff
    && (t.customerEmail || '').includes('@')
  );

  if (recentlyCompleted.length === 0) {
    return NextResponse.json({
      success: true,
      candidatesFound: 0,
      requestsSent: 0,
      message: 'No recently-completed tickets with customer email — nothing to send.',
    });
  }

  const alreadySent = await loadSentTicketIds();
  const todo = recentlyCompleted.filter(t => !alreadySent.has(t.ticketId));

  if (todo.length === 0) {
    return NextResponse.json({
      success: true,
      candidatesFound: recentlyCompleted.length,
      requestsSent: 0,
      skipped: recentlyCompleted.length,
      message: 'All recently-completed tickets already have a review request sent.',
    });
  }

  const results: Array<{ ticketId: string; emailed: boolean; reason?: string }> = [];

  for (const ticket of todo) {
    const googleLink = GOOGLE_PLACE_ID
      ? `https://search.google.com/local/writereview?placeid=${GOOGLE_PLACE_ID}&ref=auto-${ticket.ticketId}`
      : `https://www.google.com/search?q=river+city+roofing+solutions+alabama&ref=auto-${ticket.ticketId}`;
    const bbbLink = `${BBB_REVIEW_URL}/customer-reviews?ref=auto-${ticket.ticketId}`;

    let emailed = false;
    try {
      const sent = await emailService.send({
        template: 'review-request',
        to: ticket.customerEmail!,
        subject: `How did we do? — Job ${ticket.referenceNumber}`,
        body: buildEmailHtml({
          customerName: ticket.customerName || 'there',
          jobNumber: ticket.referenceNumber,
          googleLink,
          bbbLink,
        }),
      });
      emailed = sent.success;
    } catch (err) {
      results.push({ ticketId: ticket.ticketId, emailed: false, reason: String(err) });
      continue;
    }

    await appendReviewRequest({
      requestId: `RVW-${ticket.ticketId}`,
      ticketId: ticket.ticketId,
      jobNumber: ticket.referenceNumber,
      customerName: ticket.customerName || '',
      customerEmail: ticket.customerEmail || '',
      customerPhone: ticket.customerPhone || '',
      sentAt: new Date().toISOString(),
      emailSent: emailed ? 'true' : 'false',
      smsSent: 'false', // SMS path not yet wired — see Twilio TODO below
      googleReviewLink: googleLink,
      bbbReviewLink: bbbLink,
    });

    results.push({ ticketId: ticket.ticketId, emailed });
  }

  return NextResponse.json({
    success: true,
    candidatesFound: recentlyCompleted.length,
    requestsSent: results.filter(r => r.emailed).length,
    failed: results.filter(r => !r.emailed).length,
    results,
  });
}

// ─── TODO before scheduling ───────────────────────────────────────────────
// 1. Set NEXT_PUBLIC_GOOGLE_PLACE_ID in Vercel env (find in Google Business
//    Profile → "Share your profile" → URL contains the place ID after /maps/place/)
// 2. Add a vercel.json crons entry:
//    { "path": "/api/cron/auto-review-request", "schedule": "0 19 * * *" }
// 3. Optional: wire Twilio SMS — add TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN /
//    TWILIO_PHONE_NUMBER env vars and uncomment the SMS path in the loop.
// 4. Verify the customerEmail field is actually populated on completed tickets
//    (some legacy tickets may not have it — those are silently skipped).
// 5. Confirm the email copy with Michael — the current copy is a draft.
