// Cron Job: Weekly Numbers Email Reminders
// Sends reminder emails to sales reps who haven't submitted their weekly numbers.
//
// Query params:
//   ?type=midweek  - Wednesday nudge: "Don't forget to log your inspections!"
//   ?type=final    - Sunday evening urgency: "Monday meeting is tomorrow!"
//
// Vercel Cron schedule:
//   midweek: Wednesday 3 PM UTC (10 AM CT)
//   final:   Monday 12 AM UTC (Sunday 6 PM CT)

import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/api-response';
import { TEAM_MEMBERS } from '@/lib/team-roles';
import { meetingNumbersService } from '@/lib/meeting-numbers-service';
import { emailService } from '@/lib/email-service';

// ---------------------------------------------------------------------------
// AUTH
// ---------------------------------------------------------------------------

function verifyCronAuth(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // If no secret configured, allow (dev mode)

  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${cronSecret}`;
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/**
 * Get the upcoming Monday's date in YYYY-MM-DD format.
 * Monday meeting numbers are reported for the NEXT Monday. So during the week
 * we look for the coming Monday date as the target meeting date.
 */
function getNextMondayDate(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysUntilMonday = day === 0 ? 1 : (8 - day) % 7 || 7;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + daysUntilMonday);
  const year = monday.getUTCFullYear();
  const month = String(monday.getUTCMonth() + 1).padStart(2, '0');
  const date = String(monday.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}

/**
 * Get all active sales reps. Includes dual-role users who have 'sales' in
 * their roles array.
 */
function getActiveSalesReps() {
  return TEAM_MEMBERS.filter(m =>
    m.isActive && (m.role === 'sales' || (m.roles && m.roles.includes('sales')))
  );
}

/**
 * Check which reps have NOT submitted numbers for the upcoming Monday.
 * A rep has "submitted" if they have a record for that date with at least
 * one non-zero metric (inspected, damage, signed, revenue, etc.).
 */
function getRepsWithoutNumbers(mondayDate: string) {
  const reps = getActiveSalesReps();
  const records = meetingNumbersService.getByDate(mondayDate);

  const submittedNames = new Set(
    records
      .filter(r =>
        r.inspected > 0 || r.damage > 0 || r.signed > 0 ||
        r.revenue > 0 || r.approved > 0 || r.referrals > 0 ||
        r.repair > 0 || r.gutter > 0
      )
      .map(r => r.repName.toLowerCase())
  );

  return reps.filter(rep => {
    const firstName = rep.name.split(' ')[0].toLowerCase();
    const fullName = rep.name.toLowerCase();
    // Match by first name (sheet uses first names) or full name
    return !submittedNames.has(firstName) && !submittedNames.has(fullName);
  });
}

// ---------------------------------------------------------------------------
// EMAIL TEMPLATES
// ---------------------------------------------------------------------------

function buildReminderEmail(repName: string, type: 'midweek' | 'final'): { subject: string; body: string } {
  const firstName = repName.split(' ')[0];
  const portalUrl = 'https://rcrsal.com/portal/dashboard';

  if (type === 'midweek') {
    return {
      subject: `Hey ${firstName} - Log Your Numbers This Week`,
      body: emailWrapper(
        firstName,
        "Don't forget to log your inspections this week! The leaderboard is live — make sure your numbers count.",
        portalUrl,
        'Log My Numbers',
      ),
    };
  }

  // final
  return {
    subject: `${firstName} - Monday Meeting Tomorrow! Submit Your Numbers`,
    body: emailWrapper(
      firstName,
      'Monday meeting is tomorrow! Submit your numbers before 10 AM so the board is up to date. No excuses.',
      portalUrl,
      'Submit Numbers Now',
    ),
  };
}

/**
 * Branded email HTML using the emailWrapper pattern: dark background,
 * brand-green (#39FF14) accents, short and punchy content with CTA button.
 */
function emailWrapper(
  firstName: string,
  message: string,
  ctaUrl: string,
  ctaText: string,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>River City Roofing Solutions</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; }
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; }
      .padding-mobile { padding-left: 20px !important; padding-right: 20px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0f; font-family: Arial, Helvetica, sans-serif;">
  <center style="width: 100%; background-color: #0a0a0f;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="600" style="margin: auto; max-width: 600px;" class="email-container">

      <!-- HEADER -->
      <tr>
        <td style="background-color: #0a0a0f; padding: 30px 40px 20px 40px; text-align: center; border-bottom: 3px solid #39FF14;" class="padding-mobile">
          <h1 style="margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 1px;">
            <span style="color: #39FF14;">RIVER CITY</span>
            <span style="color: #ffffff;"> ROOFING</span>
          </h1>
          <p style="margin: 4px 0 0 0; font-size: 11px; color: #888888; letter-spacing: 3px; text-transform: uppercase;">Solutions</p>
        </td>
      </tr>

      <!-- BODY -->
      <tr>
        <td style="background-color: #1a1a2e; padding: 40px 40px 30px 40px;" class="padding-mobile">
          <p style="margin: 0 0 20px 0; font-size: 20px; font-weight: bold; color: #ffffff;">
            Hey ${firstName},
          </p>
          <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #cccccc;">
            ${message}
          </p>

          <!-- CTA BUTTON -->
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 0 auto;">
            <tr>
              <td style="border-radius: 8px; background-color: #39FF14;">
                <a href="${ctaUrl}" style="display: inline-block; background-color: #39FF14; color: #0a0a0f; font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: bold; text-decoration: none; padding: 14px 32px; border-radius: 8px; text-align: center;">
                  ${ctaText}
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td style="background-color: #0a0a0f; padding: 30px 40px; border-top: 1px solid #222222;" class="padding-mobile">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
            <tr>
              <td style="text-align: center; padding-bottom: 15px;">
                <p style="margin: 0; font-size: 14px; color: #39FF14; font-weight: bold;">River City Roofing Solutions</p>
                <p style="margin: 5px 0 0 0; font-size: 13px; color: #aaaaaa;">Family-Owned &amp; Operated in North Alabama</p>
              </td>
            </tr>
            <tr>
              <td style="text-align: center;">
                <p style="margin: 0; font-size: 13px; color: #888888;">
                  <a href="tel:+12562748530" style="color: #39FF14; text-decoration: none;">(256) 274-8530</a>
                  &nbsp;&nbsp;|&nbsp;&nbsp;
                  <a href="mailto:rcrs@rivercityroofingsolutions.com" style="color: #39FF14; text-decoration: none;">rcrs@rivercityroofingsolutions.com</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

    </table>
  </center>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// ROUTE HANDLER
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return apiError('Unauthorized', 401);
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') as 'midweek' | 'final' | null;

  if (!type || !['midweek', 'final'].includes(type)) {
    return apiError('Missing or invalid ?type= parameter. Use "midweek" or "final".', 400);
  }

  const _hbStart = Date.now();
  try {
    const mondayDate = getNextMondayDate();
    const missingReps = getRepsWithoutNumbers(mondayDate);

    const results: { name: string; email: string; sent: boolean; error?: string }[] = [];

    for (const rep of missingReps) {
      const { subject, body } = buildReminderEmail(rep.name, type);

      const result = await emailService.send({
        template: 'weekly-numbers-reminder',
        to: rep.email,
        subject,
        body,
        fromName: 'RCRS Team',
      });

      results.push({
        name: rep.name,
        email: rep.email,
        sent: result.success,
        ...(result.error && { error: result.error }),
      });
    }

    const sentCount = results.filter(r => r.sent).length;
    const skippedCount = getActiveSalesReps().length - missingReps.length;

    const { recordCronHeartbeat } = await import('@/lib/cron-heartbeat');
    await recordCronHeartbeat('weekly-numbers-reminder', 'success', Date.now() - _hbStart, `${type}: ${sentCount} sent, ${skippedCount} already submitted`);

    return NextResponse.json({
      success: true,
      type,
      mondayDate,
      totalSalesReps: getActiveSalesReps().length,
      alreadySubmitted: skippedCount,
      reminded: sentCount,
      failed: results.filter(r => !r.sent).length,
      details: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[WeeklyNumbersReminder] Error:', error);
    try {
      const { recordCronHeartbeat } = await import('@/lib/cron-heartbeat');
      await recordCronHeartbeat('weekly-numbers-reminder', 'error', Date.now() - _hbStart, error instanceof Error ? error.message : String(error));
    } catch { /* heartbeat must not mask real error */ }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Cron failed' },
      { status: 500 }
    );
  }
}
