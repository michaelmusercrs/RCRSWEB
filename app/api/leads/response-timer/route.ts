// Lead Response Timer API
// GET: Check timer status for all active leads or a specific lead
// POST: Check all timers, send River bot notifications, handle reassignments
//
// This endpoint should be called periodically (e.g., every 1-2 minutes via cron
// or Vercel cron) to process timer events and send notifications.

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { leadResponseTimerService } from '@/lib/lead-response-timer';
import { leadPortalService } from '@/lib/lead-portal-service';
import { riverBot } from '@/lib/river-bot-service';
import { TEAM_MEMBERS } from '@/lib/team-roles';
import { leadDistributionService } from '@/lib/lead-distribution-service';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('leadId');

    if (leadId) {
      const timer = leadResponseTimerService.getTimer(leadId);
      return NextResponse.json({
        success: true,
        timer: timer ? {
          ...timer,
          assignedAt: timer.assignedAt.toISOString(),
          firstContactAt: timer.firstContactAt?.toISOString(),
          elapsedMinutes: Math.round((Date.now() - timer.assignedAt.getTime()) / (1000 * 60)),
        } : null,
      });
    }

    const activeTimers = leadResponseTimerService.getActiveTimers();
    return NextResponse.json({
      success: true,
      count: activeTimers.length,
      timers: activeTimers.map(t => ({
        ...t,
        assignedAt: t.assignedAt.toISOString(),
        elapsedMinutes: Math.round((Date.now() - t.assignedAt.getTime()) / (1000 * 60)),
      })),
      config: leadResponseTimerService.getConfig(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { reminders, warnings, reassignments } = leadResponseTimerService.checkTimers();

    // Helper: find rep email by slug
    const getRepEmail = (slug: string): string => {
      const member = TEAM_MEMBERS.find(m => m.slug === slug);
      return member?.email || `${slug}@rivercityroofingsolutions.com`;
    };

    // Send River bot notifications for each action
    const notificationResults: { type: string; leadId: string; sent: boolean }[] = [];

    // REMINDERS: DM only to the assigned rep (10 min)
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
      notificationResults.push({ type: 'reminder', leadId: timer.leadId, sent: true });
    }

    // WARNINGS: Escalation DM to rep + Chris + Michael (30 min)
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
      notificationResults.push({ type: 'warning', leadId: timer.leadId, sent: true });
    }

    // REASSIGNMENTS: Escalation DM + group post + auto-reassign to next best rep (60 min)
    for (const timer of reassignments) {
      const elapsed = Math.round((Date.now() - timer.assignedAt.getTime()) / (1000 * 60));

      // Notify about the missed response
      await riverBot.notifyMissedLeadResponse({
        repName: timer.repSlug,
        repEmail: getRepEmail(timer.repSlug),
        leadName: timer.customerName,
        leadId: timer.leadId,
        minutesElapsed: elapsed,
        action: 'reassign',
      });

      // Try to auto-reassign to the next available rep
      let newRepSlug = '';
      let newRepName = '';
      try {
        // Get the lead address from the portal service
        const leads = await leadPortalService.getLeads({ limit: 500 });
        const leadRecord = leads.find(l => l.leadId === timer.leadId);

        if (leadRecord?.customerAddress) {
          // Get eligible reps excluding the one who missed
          const scores = await leadDistributionService.getDistributionPreview(leadRecord.customerAddress);
          const nextBest = scores.find(s => s.isEligible && s.repSlug !== timer.repSlug);

          if (nextBest) {
            newRepSlug = nextBest.repSlug;
            newRepName = nextBest.repName;

            // Record reassignment in timer service (stops old timer, starts new one)
            await leadResponseTimerService.recordReassignment(
              timer.leadId,
              newRepSlug,
              `Auto-reassigned after ${elapsed}min without response from ${timer.repSlug}`
            );

            // Post to group
            await riverBot.announceToGroup(
              `[LEAD REASSIGNED] ${timer.customerName} - no response from ${timer.repSlug} after ${elapsed} min. Auto-reassigned to ${newRepName}.`
            );

            // DM the new rep
            const newRepEmail = getRepEmail(newRepSlug);
            await riverBot.sendPrivateDM(
              newRepEmail,
              `Lead reassigned to you!\nCustomer: ${timer.customerName}\nAddress: ${leadRecord.customerAddress}\nReason: Previous rep (${timer.repSlug}) did not respond within ${elapsed} minutes.\n\nPlease respond immediately.`
            );
          } else {
            // No other eligible rep found - just post to group
            await riverBot.announceToGroup(
              `[LEAD REASSIGNED] ${timer.customerName} - no response from ${timer.repSlug} after ${elapsed} min. No eligible rep for auto-reassign - needs manual assignment.`
            );
            await leadResponseTimerService.recordReassignment(
              timer.leadId,
              'unassigned',
              `Auto-reassign failed: no eligible reps. ${timer.repSlug} missed after ${elapsed}min.`
            );
          }
        } else {
          // No lead record found - just post to group
          await riverBot.announceToGroup(
            `[LEAD REASSIGNED] ${timer.customerName} - no response from ${timer.repSlug} after ${elapsed} min. Lead needs new assignment.`
          );
        }
      } catch (err) {
        console.error(`[ResponseTimer] Auto-reassign failed for ${timer.leadId}:`, err);
        // Fallback: just announce
        await riverBot.announceToGroup(
          `[LEAD REASSIGNED] ${timer.customerName} - no response from ${timer.repSlug} after ${elapsed} min. Lead needs new assignment.`
        );
      }

      notificationResults.push({
        type: 'reassign',
        leadId: timer.leadId,
        sent: true,
      });
    }

    return NextResponse.json({
      success: true,
      actions: {
        reminders: reminders.map(t => ({
          leadId: t.leadId,
          repSlug: t.repSlug,
          customerName: t.customerName,
          elapsedMinutes: Math.round((Date.now() - t.assignedAt.getTime()) / (1000 * 60)),
        })),
        warnings: warnings.map(t => ({
          leadId: t.leadId,
          repSlug: t.repSlug,
          customerName: t.customerName,
          elapsedMinutes: Math.round((Date.now() - t.assignedAt.getTime()) / (1000 * 60)),
        })),
        reassignments: reassignments.map(t => ({
          leadId: t.leadId,
          repSlug: t.repSlug,
          customerName: t.customerName,
          elapsedMinutes: Math.round((Date.now() - t.assignedAt.getTime()) / (1000 * 60)),
        })),
      },
      notificationsSent: notificationResults,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
