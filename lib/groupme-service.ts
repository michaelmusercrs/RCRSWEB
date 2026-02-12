// GroupMe Integration Service
// Sends team notifications via GroupMe Bot API for important business events
// Also provides chat, DM, and group management capabilities

export type NotificationType =
  | 'new_lead'
  | 'profile_edit_pending'
  | 'low_inventory'
  | 'job_status_change'
  | 'customer_portal_activity'
  | 'delivery_update'
  | 'sla_alert'
  | 'custom';

export interface GroupMeNotification {
  type: NotificationType;
  title: string;
  message: string;
  details?: Record<string, string | number | boolean>;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  mentionAll?: boolean;
}

export interface GroupMeConfig {
  botId: string;
  accessToken?: string;
  enabled: boolean;
  notifyOn: {
    newLead: boolean;
    profileEditPending: boolean;
    lowInventory: boolean;
    jobStatusChange: boolean;
    customerPortalActivity: boolean;
    deliveryUpdates: boolean;
    slaAlerts: boolean;
  };
}

// Default configuration
export const DEFAULT_GROUPME_CONFIG: GroupMeConfig = {
  botId: '',
  accessToken: '',
  enabled: false,
  notifyOn: {
    newLead: true,
    profileEditPending: true,
    lowInventory: true,
    jobStatusChange: true,
    customerPortalActivity: true,
    deliveryUpdates: true,
    slaAlerts: true,
  },
};

// GroupMe API Types
export interface GroupMeGroup {
  id: string;
  group_id: string;
  name: string;
  phone_number: string;
  type: string;
  description: string;
  image_url: string | null;
  creator_user_id: string;
  created_at: number;
  updated_at: number;
  office_mode: boolean;
  share_url: string | null;
  share_qr_code_url: string | null;
  members: GroupMeMember[];
  messages: {
    count: number;
    last_message_id: string;
    last_message_created_at: number;
    preview: {
      nickname: string;
      text: string;
      image_url: string | null;
      attachments: GroupMeAttachment[];
    };
  };
  max_members: number;
}

export interface GroupMeMember {
  user_id: string;
  nickname: string;
  image_url: string | null;
  id: string;
  muted: boolean;
  autokicked: boolean;
  roles: string[];
  name: string;
}

export interface GroupMeMessage {
  id: string;
  source_guid: string;
  created_at: number;
  user_id: string;
  group_id?: string;
  name: string;
  avatar_url: string | null;
  text: string | null;
  system: boolean;
  favorited_by: string[];
  attachments: GroupMeAttachment[];
  sender_type: string;
  sender_id: string;
  recipient_id?: string;
  conversation_id?: string;
}

export interface GroupMeAttachment {
  type: 'image' | 'location' | 'split' | 'emoji' | 'mentions' | 'file' | 'reply' | 'video';
  url?: string;
  lat?: string;
  lng?: string;
  name?: string;
  loci?: [number, number][];
  user_ids?: string[];
  placeholder?: string;
  charmap?: [number, number][];
  file_id?: string;
  reply_id?: string;
  base_reply_id?: string;
  preview_url?: string;
}

export interface GroupMeUser {
  id: string;
  phone_number: string;
  image_url: string | null;
  name: string;
  created_at: number;
  updated_at: number;
  email: string;
  sms: boolean;
  user_id: string;
}

export interface GroupMeBot {
  bot_id: string;
  group_id: string;
  name: string;
  avatar_url: string | null;
  callback_url: string | null;
  dm_notification: boolean;
}

export interface GroupMeDirectMessage {
  id: string;
  source_guid: string;
  recipient_id: string;
  user_id: string;
  created_at: number;
  name: string;
  avatar_url: string | null;
  text: string | null;
  favorited_by: string[];
  attachments: GroupMeAttachment[];
  sender_id: string;
  sender_type: string;
  conversation_id: string;
}

export interface GroupMeMentionAttachment {
  type: 'mentions';
  user_ids: string[];
  loci: [number, number][];
}

// Maps team member names to GroupMe user IDs (populated dynamically)
const teamGroupMeMap = new Map<string, string>();

// Priority emoji mapping
const PRIORITY_EMOJI: Record<string, string> = {
  low: '',
  normal: '',
  high: '!',
  urgent: '!!!',
};

// Type emoji mapping
const TYPE_EMOJI: Record<NotificationType, string> = {
  new_lead: '[NEW LEAD]',
  profile_edit_pending: '[APPROVAL]',
  low_inventory: '[INVENTORY]',
  job_status_change: '[JOB UPDATE]',
  customer_portal_activity: '[PORTAL]',
  delivery_update: '[DELIVERY]',
  sla_alert: '[SLA ALERT]',
  custom: '[NOTICE]',
};

class GroupMeService {
  private baseUrl = 'https://api.groupme.com/v3';

  // ========================================
  // CORE API HELPERS
  // ========================================

  private getToken(): string {
    return process.env.GROUPME_ACCESS_TOKEN || '';
  }

  private async apiGet<T>(path: string, params?: Record<string, string>): Promise<{ success: boolean; data?: T; error?: string }> {
    const token = this.getToken();
    if (!token) {
      return { success: false, error: 'GroupMe access token not configured' };
    }

    try {
      const url = new URL(`${this.baseUrl}${path}`);
      url.searchParams.set('token', token);
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value) url.searchParams.set(key, value);
        });
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`GroupMe GET ${path} error:`, response.status, errText);
        return { success: false, error: `GroupMe API error: ${response.status}` };
      }

      const json = await response.json();
      return { success: true, data: json.response as T };
    } catch (error) {
      console.error(`GroupMe GET ${path} failed:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async apiPost<T>(path: string, body: Record<string, unknown>): Promise<{ success: boolean; data?: T; error?: string }> {
    const token = this.getToken();
    if (!token) {
      return { success: false, error: 'GroupMe access token not configured' };
    }

    try {
      const url = new URL(`${this.baseUrl}${path}`);
      url.searchParams.set('token', token);

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      // GroupMe returns 201/202 for some POST actions
      if (response.status === 202 || response.status === 201 || response.ok) {
        try {
          const json = await response.json();
          return { success: true, data: json.response as T };
        } catch {
          // Some endpoints return no body (e.g., bot post)
          return { success: true };
        }
      }

      const errText = await response.text();
      console.error(`GroupMe POST ${path} error:`, response.status, errText);
      return { success: false, error: `GroupMe API error: ${response.status}` };
    } catch (error) {
      console.error(`GroupMe POST ${path} failed:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // ========================================
  // USER INFO
  // ========================================

  async getUserInfo(): Promise<{ success: boolean; data?: GroupMeUser; error?: string }> {
    return this.apiGet<GroupMeUser>('/users/me');
  }

  // ========================================
  // GROUP OPERATIONS
  // ========================================

  async listGroups(page: number = 1, perPage: number = 20): Promise<{ success: boolean; data?: GroupMeGroup[]; error?: string }> {
    return this.apiGet<GroupMeGroup[]>('/groups', {
      page: String(page),
      per_page: String(perPage),
      omit: 'memberships',
    });
  }

  async getGroup(groupId: string): Promise<{ success: boolean; data?: GroupMeGroup; error?: string }> {
    return this.apiGet<GroupMeGroup>(`/groups/${groupId}`);
  }

  async getGroupMessages(
    groupId: string,
    options?: { before_id?: string; after_id?: string; since_id?: string; limit?: number }
  ): Promise<{ success: boolean; data?: { count: number; messages: GroupMeMessage[] }; error?: string }> {
    const params: Record<string, string> = {};
    if (options?.before_id) params.before_id = options.before_id;
    if (options?.after_id) params.after_id = options.after_id;
    if (options?.since_id) params.since_id = options.since_id;
    if (options?.limit) params.limit = String(options.limit);

    return this.apiGet<{ count: number; messages: GroupMeMessage[] }>(`/groups/${groupId}/messages`, params);
  }

  async sendMessage(
    groupId: string,
    text: string,
    attachments?: GroupMeAttachment[]
  ): Promise<{ success: boolean; data?: { message: GroupMeMessage }; error?: string }> {
    const sourceGuid = `rcrs-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    return this.apiPost<{ message: GroupMeMessage }>(`/groups/${groupId}/messages`, {
      message: {
        source_guid: sourceGuid,
        text,
        attachments: attachments || [],
      },
    });
  }

  // ========================================
  // DIRECT MESSAGES
  // ========================================

  async getDirectMessages(
    otherUserId: string,
    options?: { before_id?: string; since_id?: string }
  ): Promise<{ success: boolean; data?: { count: number; direct_messages: GroupMeDirectMessage[] }; error?: string }> {
    const params: Record<string, string> = {
      other_user_id: otherUserId,
    };
    if (options?.before_id) params.before_id = options.before_id;
    if (options?.since_id) params.since_id = options.since_id;

    return this.apiGet<{ count: number; direct_messages: GroupMeDirectMessage[] }>('/direct_messages', params);
  }

  async sendDirectMessage(
    recipientId: string,
    text: string,
    attachments?: GroupMeAttachment[]
  ): Promise<{ success: boolean; data?: { direct_message: GroupMeDirectMessage }; error?: string }> {
    const sourceGuid = `rcrs-dm-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    return this.apiPost<{ direct_message: GroupMeDirectMessage }>('/direct_messages', {
      direct_message: {
        source_guid: sourceGuid,
        recipient_id: recipientId,
        text,
        attachments: attachments || [],
      },
    });
  }

  // ========================================
  // BOT OPERATIONS
  // ========================================

  async listBots(): Promise<{ success: boolean; data?: GroupMeBot[]; error?: string }> {
    return this.apiGet<GroupMeBot[]>('/bots');
  }

  async createBot(
    groupId: string,
    name: string,
    callbackUrl?: string,
    avatarUrl?: string
  ): Promise<{ success: boolean; data?: { bot: GroupMeBot }; error?: string }> {
    const bot: Record<string, string> = {
      name,
      group_id: groupId,
    };
    if (callbackUrl) bot.callback_url = callbackUrl;
    if (avatarUrl) bot.avatar_url = avatarUrl;

    return this.apiPost<{ bot: GroupMeBot }>('/bots', { bot });
  }

  async destroyBot(botId: string): Promise<{ success: boolean; error?: string }> {
    return this.apiPost('/bots/destroy', { bot_id: botId });
  }

  // ========================================
  // MENTION/TAG SUPPORT
  // ========================================

  buildMentionAttachment(
    text: string,
    mentions: { userId: string; startIndex: number; length: number }[]
  ): GroupMeMentionAttachment {
    return {
      type: 'mentions',
      user_ids: mentions.map(m => m.userId),
      loci: mentions.map(m => [m.startIndex, m.length] as [number, number]),
    };
  }

  // Build message text and mention attachment from a text with @name patterns
  // Input: "Hey @John, can you check on this?"
  // memberMap: Map of display name -> GroupMe user_id
  formatMentionMessage(
    text: string,
    memberMap: Map<string, string>
  ): { text: string; attachments: GroupMeAttachment[] } {
    const mentions: { userId: string; startIndex: number; length: number }[] = [];
    let processedText = text;

    // Find all @mentions in the text
    const mentionRegex = /@(\w[\w\s]*?)(?=[\s,!?.]|$)/g;
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      const mentionName = match[1].trim();
      // Find matching member (case-insensitive, partial match)
      for (const [name, userId] of memberMap.entries()) {
        if (name.toLowerCase().startsWith(mentionName.toLowerCase()) ||
            mentionName.toLowerCase().startsWith(name.toLowerCase().split(' ')[0])) {
          const mentionText = `@${name}`;
          const startIndex = processedText.indexOf(match[0]);
          if (startIndex >= 0) {
            processedText = processedText.substring(0, startIndex) + mentionText + processedText.substring(startIndex + match[0].length);
            mentions.push({
              userId,
              startIndex,
              length: mentionText.length,
            });
          }
          break;
        }
      }
    }

    const attachments: GroupMeAttachment[] = [];
    if (mentions.length > 0) {
      attachments.push(this.buildMentionAttachment(processedText, mentions));
    }

    return { text: processedText, attachments };
  }

  // ========================================
  // TEAM MEMBER MAPPING
  // ========================================

  // Map team members to GroupMe users by name matching
  async mapTeamToGroupMeUsers(groupId: string): Promise<Map<string, { userId: string; nickname: string; imageUrl: string | null }>> {
    const result = await this.getGroup(groupId);
    const mapping = new Map<string, { userId: string; nickname: string; imageUrl: string | null }>();

    if (!result.success || !result.data) return mapping;

    for (const member of result.data.members) {
      mapping.set(member.user_id, {
        userId: member.user_id,
        nickname: member.nickname,
        imageUrl: member.image_url,
      });

      // Also store by name for lookup
      teamGroupMeMap.set(member.nickname.toLowerCase(), member.user_id);
    }

    return mapping;
  }

  getTeamGroupMeUserId(name: string): string | undefined {
    return teamGroupMeMap.get(name.toLowerCase());
  }

  setTeamGroupMeMapping(name: string, userId: string): void {
    teamGroupMeMap.set(name.toLowerCase(), userId);
  }

  // ========================================
  // BOT MESSAGE (original)
  // ========================================

  async sendBotMessage(
    botId: string,
    text: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!botId) {
      return { success: false, error: 'Bot ID not configured' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/bots/post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bot_id: botId,
          text: text,
        }),
      });

      // GroupMe returns 202 Accepted for successful bot posts
      if (response.status === 202 || response.ok) {
        return { success: true };
      }

      const errorText = await response.text();
      console.error('GroupMe API error:', response.status, errorText);
      return {
        success: false,
        error: `GroupMe API error: ${response.status}`
      };
    } catch (error) {
      console.error('Failed to send GroupMe message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Format notification into GroupMe message
  formatNotification(notification: GroupMeNotification): string {
    const parts: string[] = [];

    // Add type prefix
    const typePrefix = TYPE_EMOJI[notification.type] || TYPE_EMOJI.custom;
    parts.push(typePrefix);

    // Add priority indicator for high/urgent
    if (notification.priority === 'high' || notification.priority === 'urgent') {
      parts.push(PRIORITY_EMOJI[notification.priority]);
    }

    // Add title
    parts.push(notification.title);

    // Build the message
    let message = parts.join(' ');
    message += '\n' + notification.message;

    // Add details if present
    if (notification.details && Object.keys(notification.details).length > 0) {
      message += '\n---';
      for (const [key, value] of Object.entries(notification.details)) {
        // Convert camelCase to Title Case for display
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        message += `\n${label}: ${value}`;
      }
    }

    // Add mention @all for urgent messages
    if (notification.mentionAll) {
      message += '\n\n@all';
    }

    return message;
  }

  // Send a notification
  async sendNotification(
    config: GroupMeConfig,
    notification: GroupMeNotification
  ): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
    // Check if notifications are enabled
    if (!config.enabled) {
      return { success: false, skipped: true, error: 'GroupMe notifications disabled' };
    }

    // Check if this notification type is enabled
    const typeEnabled = this.isNotificationTypeEnabled(config, notification.type);
    if (!typeEnabled) {
      return { success: false, skipped: true, error: `Notification type '${notification.type}' is disabled` };
    }

    // Format and send the message
    const message = this.formatNotification(notification);
    return await this.sendBotMessage(config.botId, message);
  }

  // Check if a notification type is enabled in config
  private isNotificationTypeEnabled(config: GroupMeConfig, type: NotificationType): boolean {
    switch (type) {
      case 'new_lead':
        return config.notifyOn.newLead;
      case 'profile_edit_pending':
        return config.notifyOn.profileEditPending;
      case 'low_inventory':
        return config.notifyOn.lowInventory;
      case 'job_status_change':
        return config.notifyOn.jobStatusChange;
      case 'customer_portal_activity':
        return config.notifyOn.customerPortalActivity;
      case 'delivery_update':
        return config.notifyOn.deliveryUpdates;
      case 'sla_alert':
        return config.notifyOn.slaAlerts;
      case 'custom':
        return true;
      default:
        return true;
    }
  }

  // Helper methods for creating specific notification types
  createNewLeadNotification(data: {
    name: string;
    email?: string;
    phone?: string;
    source: string;
    subject?: string;
    message?: string;
  }): GroupMeNotification {
    const details: Record<string, string> = {
      source: data.source,
    };
    if (data.email) details.email = data.email;
    if (data.phone) details.phone = data.phone;
    if (data.subject) details.subject = data.subject;

    return {
      type: 'new_lead',
      title: `New Lead: ${data.name}`,
      message: data.message
        ? `"${data.message.substring(0, 100)}${data.message.length > 100 ? '...' : ''}"`
        : 'New contact form submission received.',
      details,
      priority: 'high',
    };
  }

  createProfileEditNotification(data: {
    teamMemberName: string;
    editType: string;
    editedBy?: string;
  }): GroupMeNotification {
    return {
      type: 'profile_edit_pending',
      title: `Profile Edit Pending Approval`,
      message: `${data.teamMemberName}'s profile has a pending ${data.editType} change.`,
      details: {
        teamMember: data.teamMemberName,
        editType: data.editType,
        editedBy: data.editedBy || 'Self',
      },
      priority: 'normal',
    };
  }

  createLowInventoryNotification(data: {
    productName: string;
    currentQty: number;
    minQty: number;
    location?: string;
  }): GroupMeNotification {
    const percentOfMin = Math.round((data.currentQty / data.minQty) * 100);
    const isUrgent = data.currentQty === 0;
    const isCritical = percentOfMin <= 25;

    return {
      type: 'low_inventory',
      title: isUrgent ? 'OUT OF STOCK' : (isCritical ? 'Critical Low Stock' : 'Low Stock Alert'),
      message: isUrgent
        ? `${data.productName} is OUT OF STOCK! Reorder immediately.`
        : `${data.productName} is running low (${data.currentQty} remaining, min: ${data.minQty}).`,
      details: {
        product: data.productName,
        currentQty: data.currentQty,
        minimumQty: data.minQty,
        ...(data.location && { location: data.location }),
      },
      priority: isUrgent ? 'urgent' : (isCritical ? 'high' : 'normal'),
      mentionAll: isUrgent,
    };
  }

  createJobStatusNotification(data: {
    jobId: string;
    jobName: string;
    customerName: string;
    oldStatus: string;
    newStatus: string;
    updatedBy?: string;
  }): GroupMeNotification {
    const isComplete = data.newStatus.toLowerCase().includes('complete');

    return {
      type: 'job_status_change',
      title: isComplete ? 'Job Completed!' : 'Job Status Updated',
      message: `${data.jobName} (${data.customerName}) status changed: ${data.oldStatus} -> ${data.newStatus}`,
      details: {
        jobId: data.jobId,
        customer: data.customerName,
        status: data.newStatus,
        ...(data.updatedBy && { updatedBy: data.updatedBy }),
      },
      priority: isComplete ? 'high' : 'normal',
    };
  }

  createPortalActivityNotification(data: {
    customerName: string;
    activityType: 'view' | 'upload' | 'message' | 'document_download';
    details?: string;
  }): GroupMeNotification {
    const activityDescriptions: Record<string, string> = {
      view: 'accessed their portal',
      upload: 'uploaded a document',
      message: 'sent a message',
      document_download: 'downloaded a document',
    };

    return {
      type: 'customer_portal_activity',
      title: `Customer Portal Activity`,
      message: `${data.customerName} ${activityDescriptions[data.activityType]}.`,
      details: {
        customer: data.customerName,
        activity: data.activityType,
        ...(data.details && { details: data.details }),
      },
      priority: data.activityType === 'message' ? 'high' : 'low',
    };
  }

  createDeliveryUpdateNotification(data: {
    ticketId: string;
    jobName: string;
    jobAddress: string;
    status: string;
    driverName?: string;
  }): GroupMeNotification {
    return {
      type: 'delivery_update',
      title: `Delivery ${data.status}`,
      message: `Ticket ${data.ticketId} for ${data.jobName} is now ${data.status}.`,
      details: {
        ticket: data.ticketId,
        job: data.jobName,
        address: data.jobAddress,
        status: data.status,
        ...(data.driverName && { driver: data.driverName }),
      },
      priority: 'normal',
    };
  }

  createSLAAlertNotification(data: {
    alertType: 'warning' | 'violation' | 'bottleneck';
    ticketId?: string;
    stage?: string;
    message: string;
    details: string;
  }): GroupMeNotification {
    const isViolation = data.alertType === 'violation';

    return {
      type: 'sla_alert',
      title: isViolation ? 'SLA VIOLATION' : (data.alertType === 'bottleneck' ? 'Workflow Bottleneck' : 'SLA Warning'),
      message: data.message,
      details: {
        ...(data.ticketId && { ticket: data.ticketId }),
        ...(data.stage && { stage: data.stage }),
        info: data.details,
      },
      priority: isViolation ? 'urgent' : 'high',
      mentionAll: isViolation,
    };
  }

  // Test the bot connection
  async testConnection(botId: string): Promise<{ success: boolean; error?: string }> {
    const testMessage = '[TEST] GroupMe integration test from River City Roofing admin panel. If you see this message, the integration is working correctly!';
    return await this.sendBotMessage(botId, testMessage);
  }
}

// Export singleton instance
export const groupMeService = new GroupMeService();

// Helper function to get config from environment
export function getGroupMeConfigFromEnv(): GroupMeConfig {
  return {
    botId: process.env.GROUPME_BOT_ID || '',
    accessToken: process.env.GROUPME_ACCESS_TOKEN || '',
    enabled: process.env.GROUPME_ENABLED === 'true',
    notifyOn: {
      newLead: process.env.GROUPME_NOTIFY_NEW_LEAD !== 'false',
      profileEditPending: process.env.GROUPME_NOTIFY_PROFILE_EDIT !== 'false',
      lowInventory: process.env.GROUPME_NOTIFY_LOW_INVENTORY !== 'false',
      jobStatusChange: process.env.GROUPME_NOTIFY_JOB_STATUS !== 'false',
      customerPortalActivity: process.env.GROUPME_NOTIFY_PORTAL_ACTIVITY !== 'false',
      deliveryUpdates: process.env.GROUPME_NOTIFY_DELIVERY !== 'false',
      slaAlerts: process.env.GROUPME_NOTIFY_SLA !== 'false',
    },
  };
}
