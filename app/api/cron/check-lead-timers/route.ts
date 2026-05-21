// Cron Job: Check Lead Response Timers
// Runs every 2 minutes to check for leads that need reminders, warnings, or reassignment.
// Can be triggered by Vercel Cron or an external scheduler.
//
// This endpoint performs the same logic as POST /api/leads/response-timer
// but without requiring auth (uses CRON_SECRET for security).

import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/api-response';
import { leadResponseTimerService } from '@/lib/lead-response-timer';
import { leadPortalService } from '@/lib/lead-portal-service';
import { leadDistributionService } from '@/lib/lead-distribution-service';
import { riverBot } from '@/lib/river-bot-service';
import { TEAM_MEMBERS } from '@/lib/team-roles';
import { withCronLock } from '@/lib/cron-lock';
import { googleSheetsService } from '@/lib/google-sheets-service';

// Reads request-time auth header; must not be prerendered.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Fans out to GroupMe + email per timer hit; 60s default was clipping runs.
export const maxDuration = 300;

// Verify the request is from Vercel Cron or has the correct secret
function verifyCronAuth(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // If no secret configured, allow (dev mode)

  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${cronSecret}`;
}

function getRepEmail(slug: string): string {
  const member = TEAM_MEMBERS.find(m => m.slug === slug);
  return member?.email || `${slug}@rivercityroofingsolutions.com`;
}

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return apiError('Unauthorized', 401);
  }

  return withCronLock('check-lead-timers', { staleMinutes: 5 }, async () => {
  const _hbStart = Date.now();
  try {
    // Sync timer config from lead distribution config on each check
    const config = leadDistributionService.getConfig();
    leadResponseTimerService.setConfig({
      reminderMinutes: config.responseTimers.reminderMinutes,
      warningMinutes: config.responseTimers.warningMinutes,
      urgentWarningMinutes: config.responseTimers.urgentWarningMinutes || 45,
      reassignMinutes: config.responseTimers.reassignMinutes,
    });

    const { reminders, warnings, urgentWarnings, reassignments } = leadResponseTimerService.checkTimers();
    const actions: string[] = [];

    // Step 1: Friendly reminder (5 min)
    for (const timer of reminders) {
      const elapsed = Math.round((Date.now() - timer.assignedAt.getTime()) / (1000 * 60));
      await riverBot.notifyMissedLeadResponse({
        repName: timer.repSlug,
        repEmail: getRepEmail(timer.repSlug),
        leadName: timer.customerName,
        leadId: timer.leadId,
        minutesElapsed: elapsed,
        action: 'reminder',
      });
      await leadResponseTimerService.markReminderSent(timer.leadId);
      actions.push(`reminder:${timer.leadId}`);
    }

    // Step 2: Follow-up reminder (20 min)
    for (const timer of warnings) {
      const elapsed = Math.round((Date.now() - timer.assignedAt.getTime()) / (1000 * 60));
      await riverBot.notifyMissedLeadResponse({
        repName: timer.repSlug,
        repEmail: getRepEmail(timer.repSlug),
        leadName: timer.customerName,
        leadId: timer.leadId,
        minutesElapsed: elapsed,
        action: 'warning',
      });
      await leadResponseTimerService.markWarningSent(timer.leadId);
      actions.push(`warning:${timer.leadId}`);
    }

    // Step 3: Urgent warning — about to be reassigned (45 min)
    for (const timer of urgentWarnings) {
      const elapsed = Math.round((Date.now() - timer.assignedAt.getTime()) / (1000 * 60));
      await riverBot.notifyMissedLeadResponse({
        repName: timer.repSlug,
        repEmail: getRepEmail(timer.repSlug),
        leadName: timer.customerName,
        leadId: timer.leadId,
        minutesElapsed: elapsed,
        action: 'urgent_warning',
      });
      await leadResponseTimerService.markUrgentWarningSent(timer.leadId);
      actions.push(`urgent_warning:${timer.leadId}`);
    }

    // Process SLA breaches — SUGGEST ONLY, never auto-execute. Per stated
    // policy (Michael 2026-05-21): "if it's not reached out to, then it
    // needs reassigning, manually for now, the system can suggest a new
    // rep but it needs to be manually executed."
    //
    // For each SLA-breached timer we:
    //   1. Notify the original rep + the group (so everyone sees it)
    //   2. Compute a suggested next-best rep
    //   3. Write a row to Lead_Reassignment_Queue for a dispatcher to confirm
    //   4. DO NOT call recordReassignment — the lead stays with the original
    //      rep until a human clicks Confirm in the admin UI
    for (const timer of reassignments) {
      const elapsed = Math.round((Date.now() - timer.assignedAt.getTime()) / (1000 * 60));

      await riverBot.notifyMissedLeadResponse({
        repName: timer.repSlug,
        repEmail: getRepEmail(timer.repSlug),
        leadName: timer.customerName,
        leadId: timer.leadId,
        minutesElapsed: elapsed,
        action: 'reassign',
      });

      let suggestedRepSlug = '';
      let suggestedRepName = '';
      let suggestedReason = '';
      let customerAddress = '';
      try {
        const leads = await leadPortalService.getLeads({ limit: 500 });
        const leadRecord = leads.find(l => l.leadId === timer.leadId);
        if (leadRecord?.customerAddress) {
          customerAddress = leadRecord.customerAddress;
          const scores = await leadDistributionService.getDistributionPreview(leadRecord.customerAddress);
          const nextBest = scores.find(s => s.isEligible && s.repSlug !== timer.repSlug);
          if (nextBest) {
            suggestedRepSlug = nextBest.repSlug;
            suggestedRepName = nextBest.repName;
            // Pick the best contributing factor to explain WHY this rep
            const topFactor = Object.entries(nextBest.factors)
              .filter(([, f]) => f.score > 0)
              .sort((a, b) => b[1].score - a[1].score)[0];
            suggestedReason = topFactor
              ? `score ${nextBest.totalScore.toFixed(1)} · ${topFactor[0]} ${topFactor[1].score.toFixed(1)} (${topFactor[1].explanation})`
              : `score ${nextBest.totalScore.toFixed(1)}`;
          }
        }
      } catch (err) {
        console.warn(`[CronTimer] Suggestion compute failed for ${timer.leadId}:`, err);
      }

      // Write to the manual-resolve queue. Idempotent — re-firing for the
      // same lead just updates the elapsed time + latest suggestion.
      const queueId = `RQ-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${timer.leadId.slice(0, 8)}`;
      await googleSheetsService.addReassignmentQueueEntry({
        queueId,
        leadId: timer.leadId,
        customerName: timer.customerName,
        customerAddress,
        originalRep: timer.repSlug,
        minutesElapsed: String(elapsed),
        suggestedRep: suggestedRepSlug,
        suggestedRepName,
        suggestedRepReason: suggestedReason,
        status: 'pending',
        createdAt: new Date().toISOString(),
        resolvedAt: '',
        resolvedBy: '',
        resolutionNotes: '',
      }).catch(err => {
        console.error(`[CronTimer] Failed to write reassignment queue entry for ${timer.leadId}:`, err);
      });

      await riverBot.announceToGroup(
        suggestedRepSlug
          ? `[NEEDS REASSIGNMENT] ${timer.customerName} - ${timer.repSlug} missed after ${elapsed} min. Suggested: ${suggestedRepName}. Manager confirmation required in admin panel.`
          : `[NEEDS REASSIGNMENT] ${timer.customerName} - ${timer.repSlug} missed after ${elapsed} min. No suggestion available — manager pick required.`
      );

      actions.push(`needs_reassign:${timer.leadId}`);
    }

    const { recordCronHeartbeat } = await import('@/lib/cron-heartbeat');
    await recordCronHeartbeat('check-lead-timers', 'success', Date.now() - _hbStart, `${actions.length} actions`);

    return NextResponse.json({
      success: true,
      activeTimers: leadResponseTimerService.getActiveTimers().length,
      actions,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CronTimer] Error:', error);
    try {
      const { recordCronHeartbeat } = await import('@/lib/cron-heartbeat');
      await recordCronHeartbeat('check-lead-timers', 'error', Date.now() - _hbStart, error instanceof Error ? error.message : String(error));
    } catch { /* heartbeat must not mask real error */ }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Cron failed' },
      { status: 500 }
    );
  }
  });
}
