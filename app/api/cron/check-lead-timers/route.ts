// Cron Job: Check Lead Response Timers
// Runs every 2 minutes to check for leads that need reminders, warnings, or reassignment.
// Can be triggered by Vercel Cron or an external scheduler.
//
// This endpoint performs the same logic as POST /api/leads/response-timer
// but without requiring auth (uses CRON_SECRET for security).

import { NextRequest, NextResponse } from 'next/server';
import { leadResponseTimerService } from '@/lib/lead-response-timer';
import { leadPortalService } from '@/lib/lead-portal-service';
import { leadDistributionService } from '@/lib/lead-distribution-service';
import { riverBot } from '@/lib/river-bot-service';
import { TEAM_MEMBERS } from '@/lib/team-roles';

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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Sync timer config from lead distribution config on each check
    const config = leadDistributionService.getConfig();
    leadResponseTimerService.setConfig({
      reminderMinutes: config.responseTimers.reminderMinutes,
      warningMinutes: config.responseTimers.warningMinutes,
      reassignMinutes: config.responseTimers.reassignMinutes,
    });

    const { reminders, warnings, reassignments } = leadResponseTimerService.checkTimers();
    const actions: string[] = [];

    // Process reminders
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

    // Process warnings
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

    // Process reassignments
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

      // Try to auto-reassign
      try {
        const leads = await leadPortalService.getLeads({ limit: 500 });
        const leadRecord = leads.find(l => l.leadId === timer.leadId);

        if (leadRecord?.customerAddress) {
          const scores = await leadDistributionService.getDistributionPreview(leadRecord.customerAddress);
          const nextBest = scores.find(s => s.isEligible && s.repSlug !== timer.repSlug);

          if (nextBest) {
            await leadResponseTimerService.recordReassignment(
              timer.leadId,
              nextBest.repSlug,
              `Auto-reassigned after ${elapsed}min without response from ${timer.repSlug}`
            );

            await riverBot.announceToGroup(
              `[LEAD REASSIGNED] ${timer.customerName} auto-reassigned from ${timer.repSlug} to ${nextBest.repName} after ${elapsed} min.`
            );

            await riverBot.sendPrivateDM(
              getRepEmail(nextBest.repSlug),
              `Lead reassigned to you!\nCustomer: ${timer.customerName}\nAddress: ${leadRecord.customerAddress}\nReason: ${timer.repSlug} did not respond within ${elapsed} minutes.\n\nPlease respond immediately.`
            );
          } else {
            await riverBot.announceToGroup(
              `[LEAD REASSIGNED] ${timer.customerName} - ${timer.repSlug} missed after ${elapsed} min. No eligible rep for auto-reassign - needs manual assignment.`
            );
          }
        }
      } catch (err) {
        console.error(`[CronTimer] Auto-reassign failed for ${timer.leadId}:`, err);
        await riverBot.announceToGroup(
          `[LEAD REASSIGNED] ${timer.customerName} - ${timer.repSlug} missed after ${elapsed} min. Needs manual reassignment.`
        );
      }

      actions.push(`reassign:${timer.leadId}`);
    }

    return NextResponse.json({
      success: true,
      activeTimers: leadResponseTimerService.getActiveTimers().length,
      actions,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CronTimer] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Cron failed' },
      { status: 500 }
    );
  }
}
