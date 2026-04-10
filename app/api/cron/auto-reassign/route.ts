// Cron Job: Auto-Reassign Leads
// Enhanced version of check-lead-timers that uses the reassignment config
// for notification channels, message templates, and reassignment strategies.
//
// Runs on Vercel Cron schedule or can be triggered manually.
// GET handler (Vercel cron format)

import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import path from 'path';
import { apiError } from '@/lib/api-response';
import { leadResponseTimerService } from '@/lib/lead-response-timer';
import { leadPortalService } from '@/lib/lead-portal-service';
import { leadDistributionService } from '@/lib/lead-distribution-service';
import { riverBot } from '@/lib/river-bot-service';
import { groupMeService, getGroupMeConfigFromEnv } from '@/lib/groupme-service';
import { TEAM_MEMBERS, getSalesReps } from '@/lib/team-roles';

// ── Config paths ─────────────────────────────────────────────────────────────

const DISTRO_CONFIG_PATH = path.join(process.cwd(), 'data', 'lead-distro-config.json');
const REASSIGN_CONFIG_PATH = path.join(process.cwd(), 'data', 'lead-distro-reassignment-config.json');

// ── Types ────────────────────────────────────────────────────────────────────

interface ReassignConfig {
  enabled: boolean;
  strategy: string;
  maxReassignments: number;
  cooldownMinutes: number;
  excludeRepSlugs: string[];
  notifyOriginalRep: boolean;
  notifyNewRep: boolean;
  notifyManager: boolean;
  afterMaxReassignments: string;
  warningChannels: {
    groupme: boolean;
    sms: boolean;
    email: boolean;
    inPortal: boolean;
  };
  warningRecipients: string;
  warningMessages: {
    reminder: string;
    warning: string;
    urgentWarning: string;
    reassigned: string;
  };
  timerStepsEnabled: {
    reminder: boolean;
    warning: boolean;
    urgentWarning: boolean;
    reassign: boolean;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function verifyCronAuth(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // Dev mode - no secret required
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${cronSecret}`;
}

function getRepEmail(slug: string): string {
  const member = TEAM_MEMBERS.find(m => m.slug === slug);
  return member?.email || `${slug}@rcrsal.com`;
}

function getRepName(slug: string): string {
  const member = TEAM_MEMBERS.find(m => m.slug === slug);
  return member?.name || slug;
}

function readReassignConfig(): ReassignConfig {
  try {
    const raw = readFileSync(REASSIGN_CONFIG_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {
      enabled: true,
      strategy: 'next_best_score',
      maxReassignments: 3,
      cooldownMinutes: 15,
      excludeRepSlugs: [],
      notifyOriginalRep: true,
      notifyNewRep: true,
      notifyManager: true,
      afterMaxReassignments: 'escalate_manager',
      warningChannels: { groupme: true, sms: false, email: true, inPortal: true },
      warningRecipients: 'rep_and_manager',
      warningMessages: {
        reminder: 'Hey {repName}, you have a new lead from {customerName} at {address}. Please reach out ASAP!',
        warning: 'Reminder: Lead from {customerName} has been waiting {minutes} minutes for contact. Please respond soon.',
        urgentWarning: 'URGENT: Lead from {customerName} has been waiting {minutes} minutes. This lead will be reassigned in {remainingMinutes} minutes if not contacted.',
        reassigned: 'Lead from {customerName} has been reassigned from {originalRep} to {newRep} due to no response after {minutes} minutes.',
      },
      timerStepsEnabled: { reminder: true, warning: true, urgentWarning: true, reassign: true },
    };
  }
}

function readDistroConfig() {
  try {
    const raw = readFileSync(DISTRO_CONFIG_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {
      responseTimers: {
        reminderMinutes: 5,
        warningMinutes: 20,
        urgentWarningMinutes: 45,
        reassignMinutes: 60,
      },
    };
  }
}

/**
 * Fill message template placeholders with actual values.
 */
function fillTemplate(
  template: string,
  vars: Record<string, string | number>
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}

/**
 * Send notification through configured channels.
 */
async function sendNotification(
  message: string,
  recipientSlug: string,
  reassignConfig: ReassignConfig,
  isGroupPost: boolean = false
): Promise<void> {
  const channels = reassignConfig.warningChannels;

  // GroupMe group post
  if (channels.groupme && isGroupPost) {
    const gmConfig = getGroupMeConfigFromEnv();
    if (gmConfig.enabled && gmConfig.botId) {
      const notification = groupMeService.createNewLeadNotification({
        name: 'Lead Timer',
        source: 'Auto-Reassign System',
        message,
      });
      await groupMeService.sendNotification(gmConfig, notification).catch(err => {
        console.warn('[AutoReassign] GroupMe notification failed:', err);
      });
    }
  }

  // Direct message to rep via River Bot
  if (channels.groupme || channels.email) {
    const repEmail = getRepEmail(recipientSlug);
    await riverBot.sendPrivateDM(repEmail, message).catch(err => {
      console.warn(`[AutoReassign] DM to ${recipientSlug} failed:`, err);
    });
  }

  // Manager notifications
  if (reassignConfig.warningRecipients === 'rep_and_manager' || reassignConfig.warningRecipients === 'rep_manager_owner') {
    if (reassignConfig.notifyManager) {
      await riverBot.notifyMissedLeadResponse({
        repName: recipientSlug,
        repEmail: getRepEmail(recipientSlug),
        leadName: '',
        leadId: '',
        minutesElapsed: 0,
        action: 'warning',
      }).catch(() => {});
    }
  }
}

/**
 * Select next rep based on reassignment strategy.
 */
async function selectNextRep(
  currentRepSlug: string,
  leadAddress: string,
  reassignConfig: ReassignConfig
): Promise<{ slug: string; name: string } | null> {
  const strategy = reassignConfig.strategy;
  const excludeSlugs = new Set([
    currentRepSlug,
    ...reassignConfig.excludeRepSlugs,
  ]);

  if (strategy === 'next_best_score') {
    // Use the distribution algorithm to find next best rep
    try {
      const scores = await leadDistributionService.getDistributionPreview(leadAddress);
      const nextBest = scores.find(s => s.isEligible && !excludeSlugs.has(s.repSlug));
      if (nextBest) {
        return { slug: nextBest.repSlug, name: nextBest.repName };
      }
    } catch (err) {
      console.warn('[AutoReassign] Score-based selection failed:', err);
    }
  } else if (strategy === 'round_robin') {
    // Simple round-robin among eligible reps
    const eligibleReps = getSalesReps().filter(r => !excludeSlugs.has(r.slug));
    if (eligibleReps.length > 0) {
      const randomIndex = Math.floor(Math.random() * eligibleReps.length);
      const selected = eligibleReps[randomIndex];
      return { slug: selected.slug, name: selected.name };
    }
  } else if (strategy === 'specific_rep') {
    // Would need a specificRepSlug field - fall back to next_best_score
    try {
      const scores = await leadDistributionService.getDistributionPreview(leadAddress);
      const nextBest = scores.find(s => s.isEligible && !excludeSlugs.has(s.repSlug));
      if (nextBest) {
        return { slug: nextBest.repSlug, name: nextBest.repName };
      }
    } catch {
      // fall through
    }
  }

  return null;
}

// ── Main Handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return apiError('Unauthorized', 401);
  }

  const _hbStart = Date.now();
  try {
    const reassignConfig = readReassignConfig();
    const distroConfig = readDistroConfig();

    // Sync timer config from lead distribution config
    leadResponseTimerService.setConfig({
      reminderMinutes: distroConfig.responseTimers.reminderMinutes,
      warningMinutes: distroConfig.responseTimers.warningMinutes,
      urgentWarningMinutes: distroConfig.responseTimers.urgentWarningMinutes || 45,
      reassignMinutes: distroConfig.responseTimers.reassignMinutes,
    });

    const { reminders, warnings, urgentWarnings, reassignments } = leadResponseTimerService.checkTimers();
    const actions: string[] = [];
    const errors: string[] = [];

    // ── Step 1: Reminders (e.g. 5 min) ────────────────────────────────────
    if (reassignConfig.timerStepsEnabled.reminder) {
      for (const timer of reminders) {
        try {
          const elapsed = Math.round((Date.now() - timer.assignedAt.getTime()) / (1000 * 60));
          const message = fillTemplate(reassignConfig.warningMessages.reminder, {
            repName: getRepName(timer.repSlug),
            customerName: timer.customerName,
            address: '',
            minutes: elapsed,
          });

          await sendNotification(message, timer.repSlug, reassignConfig, false);
          await leadResponseTimerService.markReminderSent(timer.leadId);
          actions.push(`reminder:${timer.leadId}:${timer.repSlug}`);
        } catch (err) {
          errors.push(`reminder:${timer.leadId}:${err instanceof Error ? err.message : 'unknown'}`);
        }
      }
    }

    // ── Step 2: Warnings (e.g. 20 min) ────────────────────────────────────
    if (reassignConfig.timerStepsEnabled.warning) {
      for (const timer of warnings) {
        try {
          const elapsed = Math.round((Date.now() - timer.assignedAt.getTime()) / (1000 * 60));
          const message = fillTemplate(reassignConfig.warningMessages.warning, {
            repName: getRepName(timer.repSlug),
            customerName: timer.customerName,
            minutes: elapsed,
          });

          await sendNotification(message, timer.repSlug, reassignConfig, false);
          await leadResponseTimerService.markWarningSent(timer.leadId);
          actions.push(`warning:${timer.leadId}:${timer.repSlug}`);
        } catch (err) {
          errors.push(`warning:${timer.leadId}:${err instanceof Error ? err.message : 'unknown'}`);
        }
      }
    }

    // ── Step 3: Urgent Warnings (e.g. 45 min) ────────────────────────────
    if (reassignConfig.timerStepsEnabled.urgentWarning) {
      for (const timer of urgentWarnings) {
        try {
          const elapsed = Math.round((Date.now() - timer.assignedAt.getTime()) / (1000 * 60));
          const remainingMinutes = distroConfig.responseTimers.reassignMinutes - elapsed;
          const message = fillTemplate(reassignConfig.warningMessages.urgentWarning, {
            repName: getRepName(timer.repSlug),
            customerName: timer.customerName,
            minutes: elapsed,
            remainingMinutes: Math.max(0, remainingMinutes),
          });

          await sendNotification(message, timer.repSlug, reassignConfig, true);
          await leadResponseTimerService.markUrgentWarningSent(timer.leadId);
          actions.push(`urgent_warning:${timer.leadId}:${timer.repSlug}`);
        } catch (err) {
          errors.push(`urgent_warning:${timer.leadId}:${err instanceof Error ? err.message : 'unknown'}`);
        }
      }
    }

    // ── Step 4: Auto-Reassignment (e.g. 60 min) ──────────────────────────
    if (reassignConfig.timerStepsEnabled.reassign && reassignConfig.enabled) {
      for (const timer of reassignments) {
        try {
          const elapsed = Math.round((Date.now() - timer.assignedAt.getTime()) / (1000 * 60));

          // Fetch the lead record to get address
          const leads = await leadPortalService.getLeads({ limit: 500 });
          const leadRecord = leads.find(l => l.leadId === timer.leadId);
          const leadAddress = leadRecord?.customerAddress || '';

          // Find next rep
          const nextRep = await selectNextRep(timer.repSlug, leadAddress, reassignConfig);

          if (nextRep) {
            // Record the reassignment
            await leadResponseTimerService.recordReassignment(
              timer.leadId,
              nextRep.slug,
              `Auto-reassigned after ${elapsed}min without response from ${getRepName(timer.repSlug)}`
            );

            // Notify original rep
            if (reassignConfig.notifyOriginalRep) {
              const origMessage = fillTemplate(reassignConfig.warningMessages.reassigned, {
                customerName: timer.customerName,
                originalRep: getRepName(timer.repSlug),
                newRep: nextRep.name,
                minutes: elapsed,
              });
              await sendNotification(origMessage, timer.repSlug, reassignConfig, false);
            }

            // Notify new rep
            if (reassignConfig.notifyNewRep) {
              await riverBot.sendPrivateDM(
                getRepEmail(nextRep.slug),
                `Lead reassigned to you!\nCustomer: ${timer.customerName}\nAddress: ${leadAddress}\nReason: ${getRepName(timer.repSlug)} did not respond within ${elapsed} minutes.\n\nPlease respond immediately.`
              ).catch(() => {});
            }

            // Group announcement
            const groupMsg = fillTemplate(reassignConfig.warningMessages.reassigned, {
              customerName: timer.customerName,
              originalRep: getRepName(timer.repSlug),
              newRep: nextRep.name,
              minutes: elapsed,
            });
            await riverBot.announceToGroup(`[LEAD REASSIGNED] ${groupMsg}`).catch(() => {});

            actions.push(`reassign:${timer.leadId}:${timer.repSlug}->${nextRep.slug}`);
          } else {
            // No eligible rep found - handle based on afterMaxReassignments config
            const afterMax = reassignConfig.afterMaxReassignments;

            if (afterMax === 'escalate_manager' || afterMax === 'both') {
              await riverBot.announceToGroup(
                `[LEAD ESCALATED] ${timer.customerName} - No eligible rep for auto-reassign after ${elapsed}min. Escalated to management.`
              ).catch(() => {});
            }

            if (afterMax === 'create_urgent_ticket' || afterMax === 'both') {
              await riverBot.announceToGroup(
                `[URGENT TICKET] ${timer.customerName} - Lead needs immediate manual assignment. ${elapsed}min without contact.`
              ).catch(() => {});
            }

            actions.push(`escalate:${timer.leadId}:no_eligible_rep`);
          }
        } catch (err) {
          errors.push(`reassign:${timer.leadId}:${err instanceof Error ? err.message : 'unknown'}`);
        }
      }
    }

    const { recordCronHeartbeat } = await import('@/lib/cron-heartbeat');
    await recordCronHeartbeat('auto-reassign', 'success', Date.now() - _hbStart, `${actions.length} actions, ${errors.length} errors`);

    return NextResponse.json({
      success: true,
      summary: {
        reminders: reminders.length,
        warnings: warnings.length,
        urgentWarnings: urgentWarnings.length,
        reassignments: reassignments.length,
        totalActions: actions.length,
        totalErrors: errors.length,
      },
      actions,
      errors: errors.length > 0 ? errors : undefined,
      activeTimers: leadResponseTimerService.getActiveTimers().length,
      config: {
        enabled: reassignConfig.enabled,
        strategy: reassignConfig.strategy,
        stepsEnabled: reassignConfig.timerStepsEnabled,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[AutoReassign] Cron error:', error);
    try {
      const { recordCronHeartbeat } = await import('@/lib/cron-heartbeat');
      await recordCronHeartbeat('auto-reassign', 'error', Date.now() - _hbStart, error instanceof Error ? error.message : String(error));
    } catch { /* heartbeat must not mask real error */ }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Cron failed' },
      { status: 500 }
    );
  }
}
