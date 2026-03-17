/**
 * RCRS Notification Center Service
 *
 * Centralized notification management for all portal users.
 * Handles creation, retrieval, read/unread tracking, archival,
 * and per-user notification preferences (channels, quiet hours, muted types).
 *
 * Data persisted to:
 *   data/notifications.json
 *   data/notification-preferences.json
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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

interface NotificationsData {
  notifications: Notification[];
  lastCleanup: string;
}

interface PreferencesData {
  preferences: NotificationPreferences[];
}

// =============================================================================
// FILE PATHS
// =============================================================================

const DATA_DIR = path.join(process.cwd(), 'data');
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json');
const PREFERENCES_FILE = path.join(DATA_DIR, 'notification-preferences.json');

// =============================================================================
// SERVICE
// =============================================================================

class NotificationCenterService {
  // ---------------------------------------------------------------------------
  // Data I/O
  // ---------------------------------------------------------------------------

  private readNotifications(): NotificationsData {
    try {
      if (!fs.existsSync(NOTIFICATIONS_FILE)) {
        const initial: NotificationsData = { notifications: [], lastCleanup: '' };
        this.writeNotifications(initial);
        return initial;
      }
      const raw = fs.readFileSync(NOTIFICATIONS_FILE, 'utf-8');
      return JSON.parse(raw) as NotificationsData;
    } catch (error) {
      console.error('Failed to read notifications file:', error);
      return { notifications: [], lastCleanup: '' };
    }
  }

  private writeNotifications(data: NotificationsData): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to write notifications file:', error);
    }
  }

  private readPreferences(): PreferencesData {
    try {
      if (!fs.existsSync(PREFERENCES_FILE)) {
        const initial: PreferencesData = { preferences: [] };
        this.writePreferences(initial);
        return initial;
      }
      const raw = fs.readFileSync(PREFERENCES_FILE, 'utf-8');
      return JSON.parse(raw) as PreferencesData;
    } catch (error) {
      console.error('Failed to read notification preferences file:', error);
      return { preferences: [] };
    }
  }

  private writePreferences(data: PreferencesData): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(PREFERENCES_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to write notification preferences file:', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Notification CRUD
  // ---------------------------------------------------------------------------

  /**
   * Create a new notification and persist it.
   * Auto-generates id, createdAt, and defaults for isRead/isArchived.
   */
  create(partial: Partial<Notification>): Notification {
    const data = this.readNotifications();

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

    data.notifications.unshift(notification);

    // Periodic cleanup: remove expired notifications and cap total at 2000
    this.cleanupIfNeeded(data);

    this.writeNotifications(data);
    return notification;
  }

  /**
   * Get notifications for a specific user.
   * Includes notifications targeted at the user OR to 'all'.
   */
  getForUser(repSlug: string, options: GetNotificationsOptions = {}): Notification[] {
    const data = this.readNotifications();
    const now = new Date().toISOString();

    let results = data.notifications.filter(n => {
      // Must be for this user or broadcast
      if (n.recipient !== repSlug && n.recipient !== 'all') return false;

      // Filter out archived unless explicitly requested
      if (!options.includeArchived && n.isArchived) return false;

      // Filter out expired
      if (n.expiresAt && n.expiresAt < now) return false;

      // Unread only filter
      if (options.unreadOnly && n.isRead) return false;

      // Type filter
      if (options.type && n.type !== options.type) return false;

      return true;
    });

    // Apply offset
    if (options.offset && options.offset > 0) {
      results = results.slice(options.offset);
    }

    // Apply limit
    if (options.limit && options.limit > 0) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Mark a single notification as read.
   */
  markAsRead(id: string): void {
    const data = this.readNotifications();
    const notification = data.notifications.find(n => n.id === id);
    if (notification && !notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date().toISOString();
      this.writeNotifications(data);
    }
  }

  /**
   * Mark multiple notifications as read by ID.
   */
  markMultipleAsRead(ids: string[]): void {
    const data = this.readNotifications();
    const now = new Date().toISOString();
    let changed = false;

    for (const id of ids) {
      const notification = data.notifications.find(n => n.id === id);
      if (notification && !notification.isRead) {
        notification.isRead = true;
        notification.readAt = now;
        changed = true;
      }
    }

    if (changed) {
      this.writeNotifications(data);
    }
  }

  /**
   * Mark all notifications as read for a specific user.
   */
  markAllRead(repSlug: string): void {
    const data = this.readNotifications();
    const now = new Date().toISOString();
    let changed = false;

    for (const n of data.notifications) {
      if ((n.recipient === repSlug || n.recipient === 'all') && !n.isRead) {
        n.isRead = true;
        n.readAt = now;
        changed = true;
      }
    }

    if (changed) {
      this.writeNotifications(data);
    }
  }

  /**
   * Archive a notification (soft delete).
   */
  archive(id: string): void {
    const data = this.readNotifications();
    const notification = data.notifications.find(n => n.id === id);
    if (notification) {
      notification.isArchived = true;
      this.writeNotifications(data);
    }
  }

  /**
   * Archive multiple notifications by ID.
   */
  archiveMultiple(ids: string[]): void {
    const data = this.readNotifications();
    let changed = false;

    for (const id of ids) {
      const notification = data.notifications.find(n => n.id === id);
      if (notification && !notification.isArchived) {
        notification.isArchived = true;
        changed = true;
      }
    }

    if (changed) {
      this.writeNotifications(data);
    }
  }

  /**
   * Permanently delete a notification.
   */
  deleteNotification(id: string): void {
    const data = this.readNotifications();
    const idx = data.notifications.findIndex(n => n.id === id);
    if (idx !== -1) {
      data.notifications.splice(idx, 1);
      this.writeNotifications(data);
    }
  }

  /**
   * Delete multiple notifications by ID.
   */
  deleteMultiple(ids: string[]): void {
    const data = this.readNotifications();
    const idSet = new Set(ids);
    const before = data.notifications.length;
    data.notifications = data.notifications.filter(n => !idSet.has(n.id));
    if (data.notifications.length !== before) {
      this.writeNotifications(data);
    }
  }

  /**
   * Get count of unread notifications for a user.
   */
  getUnreadCount(repSlug: string): number {
    const data = this.readNotifications();
    const now = new Date().toISOString();

    return data.notifications.filter(n => {
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
  getUnreadCountsByType(repSlug: string): Record<string, number> {
    const data = this.readNotifications();
    const now = new Date().toISOString();
    const counts: Record<string, number> = {};

    for (const n of data.notifications) {
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
  broadcast(partial: Partial<Notification>): Notification {
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
  getPreferences(repSlug: string): NotificationPreferences {
    const data = this.readPreferences();
    const existing = data.preferences.find(p => p.repSlug === repSlug);
    return existing || this.getDefaultPreferences(repSlug);
  }

  /**
   * Update notification preferences for a user.
   * Merges with existing preferences.
   */
  updatePreferences(repSlug: string, prefs: Partial<NotificationPreferences>): NotificationPreferences {
    const data = this.readPreferences();
    const idx = data.preferences.findIndex(p => p.repSlug === repSlug);
    const current = idx >= 0 ? data.preferences[idx] : this.getDefaultPreferences(repSlug);

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

    if (idx >= 0) {
      data.preferences[idx] = updated;
    } else {
      data.preferences.push(updated);
    }

    this.writePreferences(data);
    return updated;
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Remove expired notifications and cap total storage.
   * Runs automatically when total exceeds threshold.
   */
  private cleanupIfNeeded(data: NotificationsData): void {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

    // Only run cleanup at most once per hour
    if (data.lastCleanup && data.lastCleanup > oneHourAgo) return;

    const nowStr = now.toISOString();

    // Remove expired notifications
    data.notifications = data.notifications.filter(n => {
      if (n.expiresAt && n.expiresAt < nowStr) return false;
      return true;
    });

    // Remove archived notifications older than 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    data.notifications = data.notifications.filter(n => {
      if (n.isArchived && n.createdAt < thirtyDaysAgo) return false;
      return true;
    });

    // Cap at 2000 notifications total (keep newest)
    if (data.notifications.length > 2000) {
      data.notifications = data.notifications.slice(0, 2000);
    }

    data.lastCleanup = nowStr;
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const notificationCenterService = new NotificationCenterService();
export default notificationCenterService;
