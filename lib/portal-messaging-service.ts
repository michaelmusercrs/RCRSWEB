/**
 * Portal Messaging Service
 *
 * Owner-directed messaging layer (2026-05-20) that wraps the existing
 * GroupMe transport for portal group + peer-to-peer IM and rep-targeted
 * notifications.
 *
 * Guards:
 *   - The underlying groupMeService.sendNotification() carries the master
 *     kill-switch and the 8pm-7am Central quiet-hours block (see
 *     lib/groupme-service.ts, sendNotification at ~line 605).
 *   - The lower-level groupMeService.sendMessage / sendDirectMessage are
 *     NOT guarded, so this service re-applies BOTH guards before calling
 *     into them. Until owner sets GROUPME_FORCE_SEND=true OR explicit
 *     force, every send returns { ok: false, skipped: true }.
 *
 * No automatic sends. Every entry point on this service is invoked from
 * an explicit user click via an API route — no cron, no webhook, no
 * event-handler wiring lives here.
 *
 * Audit:
 *   Every send (whether actually delivered or blocked by the guard)
 *   writes a row to the "Portal_Messages" tab in the master sheet. We log
 *   body LENGTH, not body — never store PII in the audit tab.
 */

import { groupMeService, type GroupMeAttachment, type GroupMeNotification } from './groupme-service';
import { isQuietHours } from './chat-quiet-hours';
import { getMasterSheetId } from './sheets-id';

// =============================================================================
// TYPES
// =============================================================================

export interface PortalSendResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
  data?: unknown;
}

export interface SendGroupMessageInput {
  groupId: string;
  fromUserId: string;       // portal user id (for audit)
  fromUserName?: string;
  body: string;
  attachments?: GroupMeAttachment[];
}

export interface SendDirectMessageInput {
  toUserId: string;         // recipient groupme user_id
  fromUserId: string;       // portal user id (for audit)
  fromUserName?: string;
  body: string;
  attachments?: GroupMeAttachment[];
}

export interface NotifyIndividualRepInput {
  repSlug: string;          // team-roles slug; resolved to a groupme user_id by the API route
  repGroupMeUserId: string; // resolved groupme user_id (pass-through; caller resolves)
  fromUserId: string;
  fromUserName?: string;
  title: string;
  message: string;
  details?: Record<string, string | number | boolean>;
}

export interface ConversationSummary {
  id: string;
  kind: 'group' | 'dm';
  name: string;
  imageUrl: string | null;
  memberCount?: number;
  lastMessage: {
    text: string | null;
    sender: string;
    timestamp: number;
  } | null;
}

export interface ListMessagesInput {
  conversationId: string;
  kind: 'group' | 'dm';
  limit?: number;
  before?: string;
  since?: string;
}

export interface NormalizedMessage {
  id: string;
  text: string | null;
  senderId: string;
  senderName: string;
  avatarUrl: string | null;
  createdAt: number;         // unix seconds (GroupMe native)
  attachments: GroupMeAttachment[];
  system: boolean;
}

// =============================================================================
// GUARDS
// =============================================================================

/**
 * Master guard: respects the kill-switch and quiet-hours rules. Used at
 * the portal-messaging-service level because the underlying
 * sendMessage/sendDirectMessage do not self-guard (only sendNotification
 * does). Returns null when sending is allowed.
 */
function checkSendGuards(opTag: string): PortalSendResult | null {
  // Master kill switch — owner gate per directive 2026-05-20.
  if (process.env.GROUPME_FORCE_SEND !== 'true') {
    console.warn('[PORTAL MESSAGING BLOCKED]', { op: opTag, reason: 'master kill switch active' });
    return {
      ok: false,
      skipped: true,
      reason: 'master_kill_switch',
      error: 'GroupMe sends are blocked until the owner enables GROUPME_FORCE_SEND.',
    };
  }
  // 8pm-7am Central quiet hours.
  if (isQuietHours()) {
    console.warn('[PORTAL MESSAGING QUIET HOURS]', { op: opTag });
    return {
      ok: false,
      skipped: true,
      reason: 'quiet_hours',
      error: 'Messages are blocked between 8 PM and 7 AM Central.',
    };
  }
  return null;
}

// =============================================================================
// AUDIT LOG (lazy-create Portal_Messages tab)
// =============================================================================

interface AuditRow {
  Timestamp: string;
  From: string;
  To: string;
  Kind: 'group' | 'dm' | 'rep_notify';
  GroupId: string;
  BodyLength: number;        // never the body itself — PII guard
  Status: 'sent' | 'blocked' | 'error';
  Reason: string;
}

async function appendAuditRow(row: AuditRow): Promise<void> {
  try {
    const sheetId = getMasterSheetId();
    if (!sheetId) {
      console.warn('[Portal Messaging Audit] No master sheet ID; skipping audit row.');
      return;
    }
    const { GoogleSpreadsheet } = await import('google-spreadsheet');
    const { JWT } = await import('google-auth-library');
    const auth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const doc = new GoogleSpreadsheet(sheetId, auth);
    await doc.loadInfo();
    let sheet = doc.sheetsByTitle['Portal_Messages'];
    if (!sheet) {
      sheet = await doc.addSheet({
        title: 'Portal_Messages',
        headerValues: [
          'Timestamp', 'From', 'To', 'Kind', 'GroupId',
          'BodyLength', 'Status', 'Reason',
        ],
      });
    }
    await sheet.addRow(row as unknown as Record<string, string | number | boolean>);
  } catch (error) {
    // Audit failure must never break the send path.
    console.error('[Portal Messaging Audit] Failed to write audit row:', error);
  }
}

// =============================================================================
// SEND HELPERS
// =============================================================================

/**
 * Send a message into a GroupMe group conversation.
 * Wraps groupMeService.sendMessage (lib/groupme-service.ts:353).
 */
export async function sendGroupMessage(
  input: SendGroupMessageInput,
): Promise<PortalSendResult> {
  const guard = checkSendGuards('sendGroupMessage');
  if (guard) {
    await appendAuditRow({
      Timestamp: new Date().toISOString(),
      From: input.fromUserId,
      To: '',
      Kind: 'group',
      GroupId: input.groupId,
      BodyLength: input.body.length,
      Status: 'blocked',
      Reason: guard.reason || 'guard',
    });
    return guard;
  }

  if (!input.body || input.body.length === 0) {
    return { ok: false, error: 'Empty message body' };
  }
  if (input.body.length > 1000) {
    return { ok: false, error: 'Message body exceeds 1000 character limit' };
  }

  const result = await groupMeService.sendMessage(
    input.groupId,
    input.body,
    input.attachments,
  );

  await appendAuditRow({
    Timestamp: new Date().toISOString(),
    From: input.fromUserId,
    To: '',
    Kind: 'group',
    GroupId: input.groupId,
    BodyLength: input.body.length,
    Status: result.success ? 'sent' : 'error',
    Reason: result.success ? '' : (result.error || 'unknown'),
  });

  return result.success
    ? { ok: true, data: result.data }
    : { ok: false, error: result.error };
}

/**
 * Send a direct message to a single GroupMe user (peer-to-peer IM).
 * Wraps groupMeService.sendDirectMessage (lib/groupme-service.ts:386).
 */
export async function sendDirectMessage(
  input: SendDirectMessageInput,
): Promise<PortalSendResult> {
  const guard = checkSendGuards('sendDirectMessage');
  if (guard) {
    await appendAuditRow({
      Timestamp: new Date().toISOString(),
      From: input.fromUserId,
      To: input.toUserId,
      Kind: 'dm',
      GroupId: '',
      BodyLength: input.body.length,
      Status: 'blocked',
      Reason: guard.reason || 'guard',
    });
    return guard;
  }

  if (!input.body || input.body.length === 0) {
    return { ok: false, error: 'Empty message body' };
  }
  if (input.body.length > 1000) {
    return { ok: false, error: 'Message body exceeds 1000 character limit' };
  }

  const result = await groupMeService.sendDirectMessage(
    input.toUserId,
    input.body,
    input.attachments,
  );

  await appendAuditRow({
    Timestamp: new Date().toISOString(),
    From: input.fromUserId,
    To: input.toUserId,
    Kind: 'dm',
    GroupId: '',
    BodyLength: input.body.length,
    Status: result.success ? 'sent' : 'error',
    Reason: result.success ? '' : (result.error || 'unknown'),
  });

  return result.success
    ? { ok: true, data: result.data }
    : { ok: false, error: result.error };
}

/**
 * Send a high-priority notification to a single rep via DM (NOT to a
 * group). Caller must have already resolved the rep's groupme user_id —
 * see resolveRepGroupMeUserId() below or the route handler.
 */
export async function notifyIndividualRep(
  input: NotifyIndividualRepInput,
): Promise<PortalSendResult> {
  const guard = checkSendGuards('notifyIndividualRep');
  if (guard) {
    await appendAuditRow({
      Timestamp: new Date().toISOString(),
      From: input.fromUserId,
      To: `${input.repSlug}|${input.repGroupMeUserId}`,
      Kind: 'rep_notify',
      GroupId: '',
      BodyLength: input.message.length,
      Status: 'blocked',
      Reason: guard.reason || 'guard',
    });
    return guard;
  }

  // Compose a high-priority formatted notification using the existing
  // formatter on the groupMeService — keeps the layout consistent with
  // the bot-channel notifications.
  const notification: GroupMeNotification = {
    type: 'custom',
    title: input.title,
    message: input.message,
    details: input.details,
    priority: 'high',
  };
  const formatted = groupMeService.formatNotification(notification);

  const result = await groupMeService.sendDirectMessage(
    input.repGroupMeUserId,
    formatted,
  );

  await appendAuditRow({
    Timestamp: new Date().toISOString(),
    From: input.fromUserId,
    To: `${input.repSlug}|${input.repGroupMeUserId}`,
    Kind: 'rep_notify',
    GroupId: '',
    BodyLength: formatted.length,
    Status: result.success ? 'sent' : 'error',
    Reason: result.success ? '' : (result.error || 'unknown'),
  });

  return result.success
    ? { ok: true, data: result.data }
    : { ok: false, error: result.error };
}

// =============================================================================
// LIST / FETCH
// =============================================================================

/**
 * Returns the logged-in (workspace) user's recent conversations — groups
 * the bot/account is in, surfaced as ConversationSummary rows. DMs are
 * surfaced only when allowed at the API layer (owner/admin/manager).
 *
 * NOTE: GroupMe's REST API does not expose a "recent DM threads" endpoint
 * for arbitrary users — the API only returns DM history when you ask for
 * a specific other_user_id. So this function returns groups for now;
 * the UI builds DM conversation entries from the team roster.
 */
export async function listConversations(
  _userId: string,
): Promise<{ ok: boolean; conversations: ConversationSummary[]; error?: string }> {
  const groupsRes = await groupMeService.listGroups(1, 50);
  if (!groupsRes.success || !groupsRes.data) {
    return { ok: false, conversations: [], error: groupsRes.error || 'Failed to list groups' };
  }
  const conversations: ConversationSummary[] = groupsRes.data.map((g) => ({
    id: g.group_id || g.id,
    kind: 'group',
    name: g.name,
    imageUrl: g.image_url,
    memberCount: g.members?.length || 0,
    lastMessage: g.messages?.preview
      ? {
          text: g.messages.preview.text,
          sender: g.messages.preview.nickname,
          timestamp: g.messages.last_message_created_at,
        }
      : null,
  }));
  return { ok: true, conversations };
}

/**
 * Fetch messages from either a group or a DM thread. Normalizes both
 * shapes into NormalizedMessage rows.
 */
export async function listMessages(
  input: ListMessagesInput,
): Promise<{ ok: boolean; messages: NormalizedMessage[]; error?: string }> {
  if (input.kind === 'group') {
    const result = await groupMeService.getGroupMessages(input.conversationId, {
      before_id: input.before,
      since_id: input.since,
      limit: input.limit,
    });
    if (!result.success || !result.data) {
      return { ok: false, messages: [], error: result.error };
    }
    const messages: NormalizedMessage[] = result.data.messages.map((m) => ({
      id: m.id,
      text: m.text,
      senderId: m.sender_id || m.user_id,
      senderName: m.name,
      avatarUrl: m.avatar_url,
      createdAt: m.created_at,
      attachments: m.attachments || [],
      system: m.system,
    }));
    return { ok: true, messages };
  }

  // DM
  const result = await groupMeService.getDirectMessages(input.conversationId, {
    before_id: input.before,
    since_id: input.since,
  });
  if (!result.success || !result.data) {
    return { ok: false, messages: [], error: result.error };
  }
  const messages: NormalizedMessage[] = result.data.direct_messages.map((m) => ({
    id: m.id,
    text: m.text,
    senderId: m.sender_id || m.user_id,
    senderName: m.name,
    avatarUrl: m.avatar_url,
    createdAt: m.created_at,
    attachments: m.attachments || [],
    system: false,
  }));
  return { ok: true, messages };
}

// =============================================================================
// USER -> GROUPME USER_ID RESOLUTION
// =============================================================================

/**
 * Resolve a team-roles slug to a GroupMe user_id.
 *
 * Strategy: there is no persisted groupme_user_id field on TEAM_MEMBERS
 * yet ([needs-owner] — wire one in if reps shift around groups). For now
 * we walk all groups the company account is a member of and match by
 * nickname against the team member's display name / first name / alias.
 *
 * Returns undefined if no match is found; the caller should surface a
 * clear error so the operator knows to backfill the mapping.
 */
export async function resolveRepGroupMeUserId(
  repSlug: string,
): Promise<{ userId?: string; nickname?: string; error?: string }> {
  // Lazy import to avoid a circular type dependency on team-roles in the
  // service layer.
  const { TEAM_MEMBERS } = await import('./team-roles');
  const member = TEAM_MEMBERS.find((m) => m.slug === repSlug);
  if (!member) return { error: `No team member with slug "${repSlug}"` };

  const candidates: string[] = [member.name];
  if (member.aliases) candidates.push(...member.aliases);
  const firstName = member.name.split(/\s+/)[0];
  if (firstName) candidates.push(firstName);

  const groupsRes = await groupMeService.listGroups(1, 50);
  if (!groupsRes.success || !groupsRes.data) {
    return { error: groupsRes.error || 'Failed to fetch GroupMe groups for resolution' };
  }

  for (const group of groupsRes.data) {
    // listGroups omits memberships by default. Re-fetch the group to get
    // members.
    const detail = await groupMeService.getGroup(group.group_id || group.id);
    if (!detail.success || !detail.data) continue;
    for (const gm of detail.data.members) {
      const nick = (gm.nickname || gm.name || '').toLowerCase();
      for (const c of candidates) {
        const cLower = c.toLowerCase();
        if (nick === cLower || nick.startsWith(cLower) || cLower.startsWith(nick.split(' ')[0])) {
          return { userId: gm.user_id, nickname: gm.nickname };
        }
      }
    }
  }
  return { error: `Could not locate "${member.name}" in any GroupMe group [needs-owner: backfill groupme_user_id on TEAM_MEMBERS]` };
}
