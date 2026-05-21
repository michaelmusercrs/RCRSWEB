// River Bot Service - Unified notification routing
// "River" is the bot/helper across all systems
// Routes notifications to: GroupMe group posts, private DMs, or small groups
//
// GROUP posts: Events, reminders, updates, general announcements
// PRIVATE DMs: Personal reminders, tips, suggestions, missed deadlines
// ESCALATION DMs: Missed lead timeline → person who missed + Chris + Michael

import { groupMeService } from './groupme-service';

// Owner user IDs - populated on first use from GroupMe API
let ownerUserIds: { michael?: string; chris?: string } = {};
let teamUserMap: Map<string, string> | null = null; // name -> GroupMe userId

// Team email to name mapping for lookups
const EMAIL_TO_NAME: Record<string, string> = {
  'michaelmuse@rivercityroofingsolutions.com': 'Michael Muse',
  'chrismuse@rivercityroofingsolutions.com': 'Chris Muse',
  'sara@rivercityroofingsolutions.com': 'Sara Hill',
  'destin@rivercityroofingsolutions.com': 'Destin McCury',
  'tia@rivercityroofingsolutions.com': 'Tia Morris',
  'hunter@rivercityroofingsolutions.com': 'Hunter Rivers',
  'aaron@rivercityroofingsolutions.com': 'Aaron Lussi',
  'greg@rivercityroofingsolutions.com': 'Greg Muse',
  'brendon@rivercityroofingsolutions.com': 'Brendon Muse',
  'adam@rivercityroofingsolutions.com': 'Adam Rudell',
  'bart@rivercityroofingsolutions.com': 'Bart Roberts',
  'john@rivercityroofingsolutions.com': 'John Cordonis',
  'richard@rivercityroofingsolutions.com': 'Richard Geahr',
  'boston@rivercityroofingsolutions.com': 'Boston Muse',
  'joseph@rivercityroofingsolutions.com': 'Joseph Dowd',
  'travis@rivercityroofingsolutions.com': 'Travis Wages',
};

async function ensureTeamMap(): Promise<Map<string, string>> {
  if (teamUserMap) return teamUserMap;

  teamUserMap = new Map();
  try {
    const groups = await groupMeService.listGroups();
    if (groups.success && groups.data) {
      for (const group of groups.data) {
        const fullGroup = await groupMeService.getGroup(group.group_id);
        if (fullGroup.success && fullGroup.data?.members) {
          for (const member of fullGroup.data.members) {
            const name = member.nickname || member.name;
            teamUserMap.set(name.toLowerCase(), member.user_id);

            // Identify owners
            if (name.toLowerCase().includes('michael') && name.toLowerCase().includes('muse')) {
              ownerUserIds.michael = member.user_id;
            }
            if (name.toLowerCase().includes('chris') && name.toLowerCase().includes('muse')) {
              ownerUserIds.chris = member.user_id;
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('River: Failed to build team map:', error);
  }

  return teamUserMap;
}

function findUserIdByName(name: string): string | undefined {
  if (!teamUserMap) return undefined;
  const lower = name.toLowerCase();
  // Exact match
  if (teamUserMap.has(lower)) return teamUserMap.get(lower);
  // Partial match (first name)
  for (const [key, id] of teamUserMap.entries()) {
    if (key.includes(lower) || lower.includes(key.split(' ')[0])) return id;
  }
  return undefined;
}

function findUserIdByEmail(email: string): string | undefined {
  const name = EMAIL_TO_NAME[email.toLowerCase()];
  if (!name) return undefined;
  return findUserIdByName(name);
}

// ========================================
// PUBLIC API - River Bot Actions
// ========================================

export const riverBot = {
  // Post announcement to group (events, reminders, updates)
  async announceToGroup(message: string, options?: { force?: boolean }): Promise<boolean> {
    // OWNER GUARD 2026-05-20 — honor the same kill-switch + quiet-hours
    // rule as lib/groupme-service.ts. Lazy-import to avoid a circular dep.
    const { checkOwnerGroupMeGuard } = await import('./groupme-service');
    const guard = checkOwnerGroupMeGuard({ force: options?.force, label: 'riverBot.announceToGroup' });
    if (guard.blocked) {
      console.warn('River: announceToGroup blocked by owner guard');
      return false;
    }

    const botId = process.env.GROUPME_BOT_ID;
    if (!botId) {
      console.warn('River: GROUPME_BOT_ID not configured, skipping group announcement');
      return false;
    }

    try {
      await fetch('https://api.groupme.com/v3/bots/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_id: botId, text: `🏠 ${message}` }),
      });
      return true;
    } catch (error) {
      console.error('River: Group announcement failed:', error);
      return false;
    }
  },

  // Send private DM to a specific person
  async sendPrivateDM(recipientNameOrEmail: string, message: string): Promise<boolean> {
    await ensureTeamMap();

    let userId = recipientNameOrEmail.includes('@')
      ? findUserIdByEmail(recipientNameOrEmail)
      : findUserIdByName(recipientNameOrEmail);

    if (!userId) {
      console.warn(`River: Could not find GroupMe user for "${recipientNameOrEmail}"`);
      return false;
    }

    const result = await groupMeService.sendDirectMessage(userId, `🏠 River: ${message}`);
    return result.success;
  },

  // Send escalation DM to person + Chris + Michael (e.g., missed lead)
  async sendEscalation(
    personNameOrEmail: string,
    message: string,
    context: { leadId?: string; leadName?: string; minutesElapsed?: number } = {}
  ): Promise<{ sentTo: string[]; failed: string[] }> {
    await ensureTeamMap();
    const sentTo: string[] = [];
    const failed: string[] = [];

    const contextStr = context.leadName
      ? `\nLead: ${context.leadName}${context.leadId ? ` (${context.leadId})` : ''}${context.minutesElapsed ? `\nTime elapsed: ${context.minutesElapsed} min` : ''}`
      : '';

    const fullMessage = `⚠️ ESCALATION: ${message}${contextStr}`;

    // Send to the person who missed it
    const personResult = await riverBot.sendPrivateDM(personNameOrEmail, fullMessage);
    if (personResult) sentTo.push(personNameOrEmail);
    else failed.push(personNameOrEmail);

    // Send to Chris
    if (ownerUserIds.chris) {
      const chrisResult = await groupMeService.sendDirectMessage(ownerUserIds.chris, `🏠 River: ${fullMessage}`);
      if (chrisResult.success) sentTo.push('Chris Muse');
      else failed.push('Chris Muse');
    }

    // Send to Michael
    if (ownerUserIds.michael) {
      const michaelResult = await groupMeService.sendDirectMessage(ownerUserIds.michael, `🏠 River: ${fullMessage}`);
      if (michaelResult.success) sentTo.push('Michael Muse');
      else failed.push('Michael Muse');
    }

    return { sentTo, failed };
  },

  // ========================================
  // BUSINESS EVENT NOTIFICATIONS
  // ========================================

  // New lead notification (group post + DM to assigned rep)
  async notifyNewLead(data: {
    leadName: string;
    leadId: string;
    address: string;
    source: string;
    assignedRep: string;
    assignedRepEmail: string;
    riskScore?: number;
    portalUrl?: string;
  }): Promise<void> {
    const groupMsg = [
      `[NEW LEAD] ${data.leadName}`,
      `📍 ${data.address}`,
      `📋 Source: ${data.source}`,
      `👤 Assigned: ${data.assignedRep}`,
      data.riskScore ? `⚡ Risk Score: ${data.riskScore}/100` : '',
    ].filter(Boolean).join('\n');

    // Post to group
    await riverBot.announceToGroup(groupMsg);

    // DM the assigned rep
    const repMsg = [
      `You have a new lead!`,
      `👤 ${data.leadName}`,
      `📍 ${data.address}`,
      `📋 Source: ${data.source}`,
      data.riskScore ? `⚡ Risk Score: ${data.riskScore}/100` : '',
      data.portalUrl ? `🔗 Portal: ${data.portalUrl}` : '',
      `\nPlease respond within 5 minutes.`,
    ].filter(Boolean).join('\n');

    await riverBot.sendPrivateDM(data.assignedRepEmail, repMsg);
  },

  // Lead response escalation — friendly, encouraging tone with increasing urgency
  async notifyMissedLeadResponse(data: {
    repName: string;
    repEmail: string;
    leadName: string;
    leadId: string;
    minutesElapsed: number;
    action: 'reminder' | 'warning' | 'urgent_warning' | 'reassign';
  }): Promise<void> {
    const actionMap = {
      // 5 min — friendly nudge
      reminder: `Hey! 👋 You've got a new lead waiting — ${data.leadName}. Give them a quick call or text when you get a sec! (${data.minutesElapsed} min)`,
      // 20 min — still friendly, slight urgency
      warning: `Just checking in — ${data.leadName} is still waiting to hear from you (${data.minutesElapsed} min). A quick response goes a long way! 💪`,
      // 45 min — clear urgency, about to reassign
      urgent_warning: `⏰ Heads up — ${data.leadName} has been waiting ${data.minutesElapsed} minutes. This lead will be reassigned in about 15 minutes if there's no response. If you're tied up, let us know!`,
      // 60 min — reassigned
      reassign: `Lead ${data.leadName} has been reassigned after ${data.minutesElapsed} minutes. No worries — next one's yours! 🤝`,
    };

    if (data.action === 'reminder') {
      // Step 1: Just DM the rep — friendly nudge
      await riverBot.sendPrivateDM(data.repEmail, actionMap[data.action]);
    } else if (data.action === 'warning') {
      // Step 2: DM the rep only — still just between us
      await riverBot.sendPrivateDM(data.repEmail, actionMap[data.action]);
    } else {
      // Steps 3 & 4: Escalate to rep + Chris + Michael
      await riverBot.sendEscalation(data.repEmail, actionMap[data.action], {
        leadId: data.leadId,
        leadName: data.leadName,
        minutesElapsed: data.minutesElapsed,
      });
    }
  },

  // Delivery update (group post)
  async notifyDeliveryUpdate(data: {
    ticketId: string;
    status: string;
    driverName: string;
    address: string;
    customerName?: string;
  }): Promise<void> {
    const statusEmoji: Record<string, string> = {
      en_route: '🚛',
      arrived: '📍',
      delivered: '✅',
      loading: '📦',
      scheduled: '📅',
    };

    const msg = [
      `[DELIVERY] ${statusEmoji[data.status] || '📋'} ${data.status.toUpperCase()}`,
      `🎫 Ticket: ${data.ticketId}`,
      `🚛 Driver: ${data.driverName}`,
      `📍 ${data.address}`,
      data.customerName ? `👤 Customer: ${data.customerName}` : '',
    ].filter(Boolean).join('\n');

    await riverBot.announceToGroup(msg);
  },

  // Job status change (group post)
  async notifyJobStatusChange(data: {
    jobName: string;
    customerName: string;
    oldStatus: string;
    newStatus: string;
    repName: string;
  }): Promise<void> {
    const msg = [
      `[JOB UPDATE] ${data.jobName}`,
      `👤 ${data.customerName}`,
      `📋 ${data.oldStatus} → ${data.newStatus}`,
      `👷 Rep: ${data.repName}`,
    ].join('\n');

    await riverBot.announceToGroup(msg);
  },

  // Low inventory alert (group post + DM to manager)
  async notifyLowInventory(data: {
    itemName: string;
    currentQty: number;
    minQty: number;
  }): Promise<void> {
    const msg = `[INVENTORY] ⚠️ Low stock: ${data.itemName}\nCurrent: ${data.currentQty} | Minimum: ${data.minQty}\nPlease reorder.`;
    await riverBot.announceToGroup(msg);
    // Also DM Destin (manager) and Tia (office)
    await riverBot.sendPrivateDM('destin@rivercityroofingsolutions.com', msg);
    await riverBot.sendPrivateDM('tia@rivercityroofingsolutions.com', msg);
  },

  // Schedule reminder (group post)
  async notifyScheduleReminder(data: {
    eventTitle: string;
    time: string;
    attendees?: string[];
  }): Promise<void> {
    const msg = [
      `[REMINDER] ${data.eventTitle}`,
      `⏰ ${data.time}`,
      data.attendees?.length ? `👥 ${data.attendees.join(', ')}` : '',
    ].filter(Boolean).join('\n');

    await riverBot.announceToGroup(msg);
  },
};

export default riverBot;
