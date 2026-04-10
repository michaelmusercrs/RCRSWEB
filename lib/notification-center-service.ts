/**
 * RCRS Notification Center Service
 *
 * Centralized notification management for all portal users.
 * Handles creation, retrieval, read/unread tracking, archival,
 * and per-user notification preferences (channels, quiet hours, muted types).
 *
 * Persistence (2026-04-09): Migrated off local JSON files onto the master
 * Google Sheet via the generic CRUD helpers on google-sheets-service. Tabs:
 *   - SHEET_NAMES.NOTIFICATIONS (`Notifications`)
 *   - SHEET_NAMES.NOTIFICATION_PREFERENCES (`Notification_Preferences`)
 *
 * Local data/notifications.json and data/notification-preferences.json remain
 * in place as deprecated dev seeds.
 */

import crypto from 'crypto';
import { googleSheetsService, SHEET_NAMES } from './google-sheets-service';

// =============================================================================
// TYPES
// =============================================================================

export type NotificationType =
  | 'lead_assigned'
  | 'lead_warning'
  | 'lead_reassigned'
  | 'voicemail'
  | 'missed_call'
  | 'appointment_reminder'
  | 'delivery_update'
  | 'inventory_alert'
  | 'customer_message'
  | 'system_alert'
  | 'team_announcement'
  | 'document_shared'
  | 'approval_needed'
  | 'payment_received'
  | 'job_status_change'
  | 'weather_alert'
  | 'training_due';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  recipient: string; // rep slug or 'all'
  sender?: string;
  isRead: boolean;
  isArchived: boolean;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, string>;
  createdAt: string;
  readAt?: string;
  expiresAt?: string;
  groupId?: string;
}

export interface NotificationPreferences {
  repSlug: string;
  channels: {
    inPortal: boolean;
    groupme: boolean;
    sms: boolean;
    email: boolean;
  };
  quietHours: {
    start: string; // e.g. "22:00"
    end: string;   // e.g. "07:00"
    enabled: boolean;
  };
  mutedTypes: string[];
  urgentOnly: boolean;
}

export interface GetNotificationsOptions {
  unreadOnly?: boolean;
  type?: NotificationType;
  limit?: number;
  offset?: number;
  includeArchived?: boolean;
}

// =============================================================================
// SHEET SCHEMA
// =============================================================================

const NOTIFICATION_HEADERS: string[] = [
  'id',
  'type',
  'title',
  'message',
  'priority',
  'recipient',
  'sender',
  'isRead',
  'isArchived',
  'actionUrl',
  'actionLabel',
  'metadata',
  'createdAt',
  'readAt',
  'expiresAt',
  'groupId',
];

const PREFERENCES_HEADERS: string[] = [
  'repSlug',
  'channels',
  'quietHours',
  'mutedTypes',
  'urgentOnly',
];

// =============================================================================
// PARSING HELPERS
// =============================================================================

function parseBool(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === 'TRUE' || value === '1';
}

function parseJson<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function rowToNotification(row: Record<string, string>): Notification {
  return {
    id: row.id,
    type: (row.type || 'system_alert') as NotificationType,
    title: row.title || '',
    message: row.message || '',
    priority: (row.priority || 'medium') as NotificationPriority,
    recipient: row.recipient || 'all',
    sender: row.sender || undefined,
    isRead: parseBool(row.isRead, false),
    isArchived: parseBool(row.isArchived, false),
    actionUrl: row.actionUrl || undefined,
    actionLabel: row.actionLabel || undefined,
    metadata: row.metadata ? parseJson<Record<string, string>>(row.metadata, {}) : undefined,
    createdAt: row.createdAt || '',
    readAt: row.readAt || undefined,
    expiresAt: row.expiresAt || undefined,
    groupId: row.groupId || undefined,
  };
}

function notificationToRow(n: Notification): Record<string, unknown> {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    priority: n.priority,
    recipient: n.recipient,
    sender: n.sender ?? '',
    isRead: n.isRead,
    isArchived: n.isArchived,
    actionUrl: n.actionUrl ?? '',
    actionLabel: n.actionLabel ?? '',
    metadata: n.metadata ? JSON.stringify(n.metadata) : '',
    createdAt: n.createdAt,
    readAt: n.readAt ?? '',
    expiresAt: n.expiresAt ?? '',
    groupId: n.groupId ?? '',
  };
}

function rowToPreferences(row: Record<string, string>): NotificationPreferences {
  return {
    repSlug: row.repSlug,
    channels: parseJson(row.channels, {
      inPortal: true,
      groupme: true,
      sms: false,
      email: true,
    }),
    quietHours: parseJson(row.quietHours, {
      start: '22:00',
      end: '07:00',
      enabled: false,
    }),
    mutedTypes: parseJson<string[]>(row.mutedTypes, []),
    urgentOnly: parseBool(row.urgentOnly, false),
  };
}

function preferencesToRow(p: NotificationPreferences): Record<string, unknown> {
  return {
    repSlug: p.repSlug,
    channels: JSON.stringify(p.channels),
    quietHours: JSON.stringify(p.quietHours),
    mutedTypes: JSON.stringify(p.mutedTypes),
    urgentOnly: p.urgentOnly,
  };
}

// =============================================================================
// SERVICE
// =============================================================================

const CACHE_TTL_MS = 60_000;

class NotificationCenterService {
  // In-memory 60s cache for read-heavy paths.
  private notificationsCache: Notification[] | null = null;
  private notificationsCacheExpiresAt = 0;

  private preferencesCache: NotificationPreferences[] | null = null;
  private preferencesCacheExpiresAt = 0;

  // ---------------------------------------------------------------------------
  // Sheet I/O
  // ---------------------------------------------------------------------------

  private async loadNotificationsFromSheet(): Promise<Notification[]> {
    const rows = await googleSheetsService.getGenericRows(
      SHEET_NAMES.NOTIFICATIONS,
      NOTIFICATION_HEADERS,
    );
    return rows.filter((r) => r.id).map(rowToNotification);
  }

  private async loadNotifications(): Promise<Notification[]> {
    if (this.notificationsCache && Date.now() < this.notificationsCacheExpiresAt) {
      return this.notificationsCache;
    }
    this.notificationsCache = await this.loadNotificationsFromSheet();
    this.notificationsCacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return this.notificationsCache;
  }

  private invalidateNotificationsCache(): void {
    this.notificationsCache = null;
    this.notificationsCacheExpiresAt = 0;
  }

  private async saveNotification(n: Notification): Promise<void> {
    await googleSheetsService.upsertGenericRow(
      SHEET_NAMES.NOTIFICATIONS,
      NOTIFICATION_HEADERS,
      'id',
      notificationToRow(n),
    );
    this.invalidateNotificationsCache();
  }

  private async deleteNotificationRow(id: string): Promise<void> {
    await googleSheetsService.deleteGenericRow(SHEET_NAMES.NOTIFICATIONS, 'id', id);
    this.invalidateNotificationsCache();
  }

  private async loadPreferencesFromSheet(): Promise<NotificationPreferences[]> {
    const rows = await googleSheetsService.getGenericRows(
      SHEET_NAMES.NOTIFICATION_PREFERENCES,
      PREFERENCES_HEADERS,
    );
    return rows.filter((r) => r.repSlug).map(rowToPreferences);
  }

  private async loadPreferences(): Promise<NotificationPreferences[]> {
    if (this.preferencesCache && Date.now() < this.preferencesCacheExpiresAt) {
      return this.preferencesCache;
    }
    this.preferencesCache = await this.loadPreferencesFromSheet();
    this.preferencesCacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return this.preferencesCache;
  }

  private invalidatePreferencesCache(): void {
    this.preferencesCache = null;
    this.preferencesCacheExpiresAt = 0;
  }

  private async savePreferences(p: NotificationPreferences): Promise<void> {
    await googleSheetsService.upsertGenericRow(
      SHEET_NAMES.NOTIFICATION_PREFERENCES,
      PREFERENCES_HEADERS,
      'repSlug',
      preferencesToRow(p),
    );
    this.invalidatePreferencesCache();
  }

  // ---------------------------------------------------------------------------
  // Notification CRUD
  // ---------------------------------------------------------------------------

  /**
   * Create a new notification and persist it.
   * Auto-generates id, createdAt, and defaults for isRead/isArchived.
   */
  async create(partial: Partial<Notification>): Promise<Notification> {
    const notification: Notification = {
      id: crypto.randomBytes(6).toString('hex'),
      type: partial.type || 'system_alert',
      title: partial.title || 'Notification',
      message: partial.message || '',
      priority: partial.priority || 'medium',
      recipient: partial.recipient || 'all',
      sender: partial.sender,
      isRead: false,
      isArchived: false,
      actionUrl: partial.actionUrl,
      actionLabel: partial.actionLabel,
      metadata: partial.metadata,
      createdAt: new Date().toISOString(),
      expiresAt: partial.expiresAt,
      groupId: partial.groupId,
    };

    await this.saveNotification(notification);
    return notification;
  }

  /**
   * Get notifications for a specific user.
   * Includes notifications targeted at the user OR to 'all'.
   */
  async getForUser(repSlug: string, options: GetNotificationsOptions = {}): Promise<Notification[]> {
    const all = await this.loadNotifications();
    const now = new Date().toISOString();

    let results = all.filter((n) => {
      if (n.recipient !== repSlug && n.recipient !== 'all') return false;
      if (!options.includeArchived && n.isArchived) return false;
      if (n.expiresAt && n.expiresAt < now) return false;
      if (options.unreadOnly && n.isRead) return false;
      if (options.type && n.type !== options.type) return false;
      return true;
    });

    // Sort newest first (createdAt desc)
    results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    if (options.offset && options.offset > 0) {
      results = results.slice(options.offset);
    }
    if (options.limit && options.limit > 0) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Mark a single notification as read.
   */
  async markAsRead(id: string): Promise<void> {
    const all = await this.loadNotifications();
    const notification = all.find((n) => n.id === id);
    if (notification && !notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date().toISOString();
      await this.saveNotification(notification);
    }
  }

  /**
   * Mark multiple notifications as read by ID.
   */
  async markMultipleAsRead(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const all = await this.loadNotifications();
    const now = new Date().toISOString();
    const idSet = new Set(ids);

    const changed: Notification[] = [];
    for (const n of all) {
      if (idSet.has(n.id) && !n.isRead) {
        n.isRead = true;
        n.readAt = now;
        changed.push(n);
      }
    }

    for (const n of changed) {
      await this.saveNotification(n);
    }
  }

  /**
   * Mark all notifications as read for a specific user.
   */
  async markAllRead(repSlug: string): Promise<void> {
    const all = await this.loadNotifications();
    const now = new Date().toISOString();
    const changed: Notification[] = [];

    for (const n of all) {
      if ((n.recipient === repSlug || n.recipient === 'all') && !n.isRead) {
        n.isRead = true;
        n.readAt = now;
        changed.push(n);
      }
    }

    for (const n of changed) {
      await this.saveNotification(n);
    }
  }

  /**
   * Archive a notification (soft delete).
   */
  async archive(id: string): Promise<void> {
    const all = await this.loadNotifications();
    const notification = all.find((n) => n.id === id);
    if (notification && !notification.isArchived) {
      notification.isArchived = true;
      await this.saveNotification(notification);
    }
  }

  /**
   * Archive multiple notifications by ID.
   */
  async archiveMultiple(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const all = await this.loadNotifications();
    const idSet = new Set(ids);
    const changed: Notification[] = [];

    for (const n of all) {
      if (idSet.has(n.id) && !n.isArchived) {
        n.isArchived = true;
        changed.push(n);
      }
    }

    for (const n of changed) {
      await this.saveNotification(n);
    }
  }

  /**
   * Permanently delete a notification.
   */
  async deleteNotification(id: string): Promise<void> {
    await this.deleteNotificationRow(id);
  }

  /**
   * Delete multiple notifications by ID.
   */
  async deleteMultiple(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.deleteNotificationRow(id);
    }
  }

  /**
   * Get count of unread notifications for a user.
   */
  async getUnreadCount(repSlug: string): Promise<number> {
    const all = await this.loadNotifications();
    const now = new Date().toISOString();

    return all.filter((n) => {
      if (n.recipient !== repSlug && n.recipient !== 'all') return false;
      if (n.isRead) return false;
      if (n.isArchived) return false;
      if (n.expiresAt && n.expiresAt < now) return false;
      return true;
    }).length;
  }

  /**
   * Get unread counts broken down by notification type.
   */
  async getUnreadCountsByType(repSlug: string): Promise<Record<string, number>> {
    const all = await this.loadNotifications();
    const now = new Date().toISOString();
    const counts: Record<string, number> = {};

    for (const n of all) {
      if (n.recipient !== repSlug && n.recipient !== 'all') continue;
      if (n.isRead || n.isArchived) continue;
      if (n.expiresAt && n.expiresAt < now) continue;
      counts[n.type] = (counts[n.type] || 0) + 1;
    }

    return counts;
  }

  /**
   * Broadcast a notification to all users.
   */
  async broadcast(partial: Partial<Notification>): Promise<Notification> {
    return this.create({
      ...partial,
      recipient: 'all',
    });
  }

  // ---------------------------------------------------------------------------
  // Preferences
  // ---------------------------------------------------------------------------

  private getDefaultPreferences(repSlug: string): NotificationPreferences {
    return {
      repSlug,
      channels: {
        inPortal: true,
        groupme: true,
        sms: false,
        email: true,
      },
      quietHours: {
        start: '22:00',
        end: '07:00',
        enabled: false,
      },
      mutedTypes: [],
      urgentOnly: false,
    };
  }

  /**
   * Get notification preferences for a user.
   * Returns default preferences if none have been saved.
   */
  async getPreferences(repSlug: string): Promise<NotificationPreferences> {
    const all = await this.loadPreferences();
    const existing = all.find((p) => p.repSlug === repSlug);
    return existing || this.getDefaultPreferences(repSlug);
  }

  /**
   * Update notification preferences for a user.
   * Merges with existing preferences.
   */
  async updatePreferences(
    repSlug: string,
    prefs: Partial<NotificationPreferences>,
  ): Promise<NotificationPreferences> {
    const all = await this.loadPreferences();
    const current = all.find((p) => p.repSlug === repSlug) || this.getDefaultPreferences(repSlug);

    const updated: NotificationPreferences = {
      repSlug,
      channels: {
        ...current.channels,
        ...(prefs.channels || {}),
      },
      quietHours: {
        ...current.quietHours,
        ...(prefs.quietHours || {}),
      },
      mutedTypes: prefs.mutedTypes !== undefined ? prefs.mutedTypes : current.mutedTypes,
      urgentOnly: prefs.urgentOnly !== undefined ? prefs.urgentOnly : current.urgentOnly,
    };

    await this.savePreferences(updated);
    return updated;
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const notificationCenterService = new NotificationCenterService();
export default notificationCenterService;
