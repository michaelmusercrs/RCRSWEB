/**
 * RCRS Notification Service - Complete 3-Tier Preference System
 *
 * Provides a unified notification system with:
 * - 4 channels: email, sms, groupme, in-app
 * - 8 trigger types covering the full lead-to-completion lifecycle
 * - 3-tier preference cascade: admin defaults > rep overrides > customer-specific overrides
 * - Google Sheets persistence for all preferences
 * - Integration with existing email, SMS, and GroupMe services
 *
 * Preference Resolution Order:
 *   1. Customer-specific overrides (set by rep for individual homeowner)
 *   2. Rep-level overrides (rep customizes their own defaults)
 *   3. Admin defaults (company-wide baseline)
 */

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { emailService } from './email-service';
import { groupMeService, getGroupMeConfigFromEnv } from './groupme-service';
import { smsService } from './sms-service';
import { googleSheetsService } from './google-sheets-service';
import { teamMembers } from './teamData';

/** Accessor for the private doc on googleSheetsService (non-null after init() returns true) */
type SheetsServiceWithDoc = { doc: GoogleSpreadsheet };

/** Google Sheets row accessor with .get() method */
interface SheetRow {
  get(key: string): string;
  set(key: string, value: string): void;
  save(): Promise<void>;
}

// =============================================================================
// TYPES
// =============================================================================

/** All supported notification channels */
export type NotificationChannel = 'email' | 'sms' | 'groupme' | 'in_app';

/** All supported notification triggers */
export type NotificationTrigger =
  | 'lead_assigned'
  | 'appointment_reminder'
  | 'customer_viewed_portal'
  | 'customer_sent_message'
  | 'delivery_status_change'
  | 'payment_received'
  | 'inspection_scheduled'
  | 'rep_arrived_at_job';

/** Channel enablement per trigger */
export interface ChannelPreferences {
  email: boolean;
  sms: boolean;
  groupme: boolean;
  in_app: boolean;
}

/** Full preference map: each trigger has channel toggles */
export type NotificationPreferences = Record<NotificationTrigger, ChannelPreferences>;

/** Nullable channel preferences for overrides (null = inherit from parent level) */
export interface NullableChannelPreferences {
  email: boolean | null;
  sms: boolean | null;
  groupme: boolean | null;
  in_app: boolean | null;
}

/** Override preference map */
export type NotificationOverrides = Record<NotificationTrigger, NullableChannelPreferences>;

/** Appointment reminder timing config */
export interface ReminderTiming {
  /** Minutes before appointment to send reminder */
  minutesBefore: number;
  /** Additional reminder intervals (e.g. [1440, 60] = 24hr and 1hr before) */
  additionalReminders: number[];
}

/** Admin-level preferences stored in Google Sheets */
export interface AdminNotificationConfig {
  defaults: NotificationPreferences;
  reminderTiming: ReminderTiming;
  updatedAt: string;
  updatedBy: string;
}

/** Rep-level preference overrides */
export interface RepNotificationOverride {
  repSlug: string;
  repName: string;
  overrides: NotificationOverrides;
  reminderTiming?: Partial<ReminderTiming>;
  updatedAt: string;
}

/** Customer-specific preference overrides (set by rep) */
export interface CustomerNotificationOverride {
  customerId: string;
  customerName: string;
  repSlug: string;
  overrides: NotificationOverrides;
  reminderTiming?: Partial<ReminderTiming>;
  updatedAt: string;
}

/** In-app notification record */
export interface InAppNotification {
  id: string;
  recipientId: string;      // repSlug or customerId
  recipientType: 'rep' | 'customer';
  trigger: NotificationTrigger;
  title: string;
  message: string;
  data?: Record<string, string>;
  read: boolean;
  createdAt: string;
}

/** Payload for sending a notification */
export interface SendNotificationPayload {
  trigger: NotificationTrigger;
  recipientRepSlug?: string;
  recipientCustomerId?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  recipientName?: string;
  title: string;
  message: string;
  emailSubject?: string;
  emailHtml?: string;
  data?: Record<string, string>;
}

/** Result from sending a notification */
export interface NotificationResult {
  trigger: NotificationTrigger;
  channelResults: {
    email: { sent: boolean; skipped: boolean; error?: string };
    sms: { sent: boolean; skipped: boolean; error?: string };
    groupme: { sent: boolean; skipped: boolean; error?: string };
    in_app: { sent: boolean; skipped: boolean; error?: string };
  };
}

/** Resolved preferences showing which level each setting comes from */
export interface ResolvedPreferences {
  trigger: NotificationTrigger;
  channels: ChannelPreferences;
  sources: {
    email: 'admin' | 'rep' | 'customer';
    sms: 'admin' | 'rep' | 'customer';
    groupme: 'admin' | 'rep' | 'customer';
    in_app: 'admin' | 'rep' | 'customer';
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const ALL_TRIGGERS: NotificationTrigger[] = [
  'lead_assigned',
  'appointment_reminder',
  'customer_viewed_portal',
  'customer_sent_message',
  'delivery_status_change',
  'payment_received',
  'inspection_scheduled',
  'rep_arrived_at_job',
];

export const ALL_CHANNELS: NotificationChannel[] = ['email', 'sms', 'groupme', 'in_app'];

export const TRIGGER_LABELS: Record<NotificationTrigger, string> = {
  lead_assigned: 'New Lead Assigned',
  appointment_reminder: 'Appointment Reminder',
  customer_viewed_portal: 'Customer Viewed Portal',
  customer_sent_message: 'Customer Sent Message',
  delivery_status_change: 'Delivery Status Change',
  payment_received: 'Payment Received',
  inspection_scheduled: 'Inspection Scheduled',
  rep_arrived_at_job: 'Rep Arrived at Job',
};

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  email: 'Email',
  sms: 'Text/SMS',
  groupme: 'GroupMe',
  in_app: 'In-App',
};

export const TRIGGER_DESCRIPTIONS: Record<NotificationTrigger, string> = {
  lead_assigned: 'When a new lead is assigned to a rep',
  appointment_reminder: 'Before a scheduled appointment',
  customer_viewed_portal: 'When a customer accesses their portal',
  customer_sent_message: 'When a customer sends a message through the portal',
  delivery_status_change: 'When a delivery status changes (dispatched, en route, delivered)',
  payment_received: 'When a payment is received from a customer',
  inspection_scheduled: 'When a roof inspection is scheduled',
  rep_arrived_at_job: 'When a rep arrives at a job site (future: location-based)',
};

/** Sensible company-wide defaults */
export const DEFAULT_ADMIN_PREFERENCES: NotificationPreferences = {
  lead_assigned: { email: true, sms: true, groupme: true, in_app: true },
  appointment_reminder: { email: true, sms: true, groupme: false, in_app: true },
  customer_viewed_portal: { email: false, sms: false, groupme: true, in_app: true },
  customer_sent_message: { email: true, sms: true, groupme: true, in_app: true },
  delivery_status_change: { email: true, sms: true, groupme: true, in_app: true },
  payment_received: { email: true, sms: false, groupme: true, in_app: true },
  inspection_scheduled: { email: true, sms: true, groupme: false, in_app: true },
  rep_arrived_at_job: { email: false, sms: false, groupme: true, in_app: true },
};

export const DEFAULT_REMINDER_TIMING: ReminderTiming = {
  minutesBefore: 60,
  additionalReminders: [1440], // 24 hours before
};

/** Empty overrides (all null = inherit everything) */
export function createEmptyOverrides(): NotificationOverrides {
  const overrides: Partial<NotificationOverrides> = {};
  for (const trigger of ALL_TRIGGERS) {
    overrides[trigger] = { email: null, sms: null, groupme: null, in_app: null };
  }
  return overrides as NotificationOverrides;
}

// =============================================================================
// GOOGLE SHEETS COLUMN NAMES
// =============================================================================

const NOTIF_ADMIN_SHEET = 'Notification_Admin_Defaults';
const NOTIF_REP_SHEET = 'Notification_Rep_Overrides';
const NOTIF_CUSTOMER_SHEET = 'Notification_Customer_Overrides';
const NOTIF_INBOX_SHEET = 'Notification_Inbox';

const ADMIN_HEADERS = ['configKey', 'configValue', 'updatedAt', 'updatedBy'];
const REP_HEADERS = ['repSlug', 'repName', 'overridesJson', 'reminderTimingJson', 'updatedAt'];
const CUSTOMER_HEADERS = ['customerId', 'customerName', 'repSlug', 'overridesJson', 'reminderTimingJson', 'updatedAt'];
const INBOX_HEADERS = [
  'notificationId', 'recipientId', 'recipientType', 'trigger',
  'title', 'message', 'dataJson', 'read', 'createdAt',
];

// =============================================================================
// IN-MEMORY CACHE (for high-frequency reads)
// =============================================================================

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL = 60 * 1000; // 1 minute

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL });
}

function invalidateCache(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

// =============================================================================
// IN-MEMORY NOTIFICATION STORE (fallback when Sheets unavailable)
// =============================================================================

const inMemoryNotifications: InAppNotification[] = [];

// =============================================================================
// NOTIFICATION SERVICE
// =============================================================================

class NotificationService {
  // ─── ADMIN DEFAULTS ───────────────────────────────────────────────────

  /**
   * Get admin-level default notification preferences.
   * Falls back to hardcoded defaults if Sheets not available.
   */
  async getAdminDefaults(): Promise<AdminNotificationConfig> {
    const cacheKey = 'admin_defaults';
    const cached = getCached<AdminNotificationConfig>(cacheKey);
    if (cached) return cached;

    try {
      const initialized = await googleSheetsService.init();
      if (!initialized) throw new Error('Sheets not available');

      const doc = (googleSheetsService as unknown as SheetsServiceWithDoc).doc;
      if (!doc) throw new Error('Sheets doc not available');

      let sheet = doc.sheetsByTitle[NOTIF_ADMIN_SHEET];
      if (!sheet) {
        // Sheet does not exist yet, create with defaults
        sheet = await doc.addSheet({ title: NOTIF_ADMIN_SHEET, headerValues: ADMIN_HEADERS });
        const defaultConfig: AdminNotificationConfig = {
          defaults: { ...DEFAULT_ADMIN_PREFERENCES },
          reminderTiming: { ...DEFAULT_REMINDER_TIMING },
          updatedAt: new Date().toISOString(),
          updatedBy: 'system',
        };
        await sheet.addRow({
          configKey: 'preferences',
          configValue: JSON.stringify(defaultConfig.defaults),
          updatedAt: defaultConfig.updatedAt,
          updatedBy: defaultConfig.updatedBy,
        });
        await sheet.addRow({
          configKey: 'reminderTiming',
          configValue: JSON.stringify(defaultConfig.reminderTiming),
          updatedAt: defaultConfig.updatedAt,
          updatedBy: defaultConfig.updatedBy,
        });
        setCache(cacheKey, defaultConfig);
        return defaultConfig;
      }

      await sheet.loadHeaderRow();
      const rows = await sheet.getRows({ limit: 100000 });
      let preferences = { ...DEFAULT_ADMIN_PREFERENCES };
      let reminderTiming = { ...DEFAULT_REMINDER_TIMING };
      let updatedAt = new Date().toISOString();
      let updatedBy = 'system';

      for (const row of rows) {
        const key = row.get('configKey');
        const value = row.get('configValue');
        if (key === 'preferences' && value) {
          try { preferences = JSON.parse(value); } catch { /* use defaults */ }
          updatedAt = row.get('updatedAt') || updatedAt;
          updatedBy = row.get('updatedBy') || updatedBy;
        }
        if (key === 'reminderTiming' && value) {
          try { reminderTiming = JSON.parse(value); } catch { /* use defaults */ }
        }
      }

      const config: AdminNotificationConfig = { defaults: preferences, reminderTiming, updatedAt, updatedBy };
      setCache(cacheKey, config);
      return config;
    } catch (error) {
      console.warn('[NotificationService] Failed to load admin defaults from Sheets, using hardcoded defaults:', error);
      return {
        defaults: { ...DEFAULT_ADMIN_PREFERENCES },
        reminderTiming: { ...DEFAULT_REMINDER_TIMING },
        updatedAt: new Date().toISOString(),
        updatedBy: 'system',
      };
    }
  }

  /**
   * Save admin-level default preferences to Google Sheets.
   */
  async saveAdminDefaults(
    preferences: NotificationPreferences,
    reminderTiming: ReminderTiming,
    updatedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const initialized = await googleSheetsService.init();
      if (!initialized) return { success: false, error: 'Google Sheets not available' };

      const doc = (googleSheetsService as unknown as SheetsServiceWithDoc).doc;
      let sheet = doc.sheetsByTitle[NOTIF_ADMIN_SHEET];
      if (!sheet) {
        sheet = await doc.addSheet({ title: NOTIF_ADMIN_SHEET, headerValues: ADMIN_HEADERS });
      }

      await sheet.loadHeaderRow();
      const rows = await sheet.getRows({ limit: 100000 });
      const now = new Date().toISOString();

      // Update or create preferences row
      let prefRow = rows.find((r: SheetRow) => r.get('configKey') === 'preferences');
      if (prefRow) {
        prefRow.set('configValue', JSON.stringify(preferences));
        prefRow.set('updatedAt', now);
        prefRow.set('updatedBy', updatedBy);
        await prefRow.save();
      } else {
        await sheet.addRow({
          configKey: 'preferences',
          configValue: JSON.stringify(preferences),
          updatedAt: now,
          updatedBy,
        });
      }

      // Update or create timing row
      let timingRow = rows.find((r: SheetRow) => r.get('configKey') === 'reminderTiming');
      if (timingRow) {
        timingRow.set('configValue', JSON.stringify(reminderTiming));
        timingRow.set('updatedAt', now);
        timingRow.set('updatedBy', updatedBy);
        await timingRow.save();
      } else {
        await sheet.addRow({
          configKey: 'reminderTiming',
          configValue: JSON.stringify(reminderTiming),
          updatedAt: now,
          updatedBy,
        });
      }

      invalidateCache('admin_');
      return { success: true };
    } catch (error) {
      console.error('[NotificationService] Failed to save admin defaults:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // ─── REP OVERRIDES ────────────────────────────────────────────────────

  /**
   * Get a rep's notification preference overrides.
   * Returns null (inherit all) if no overrides are set.
   */
  async getRepOverrides(repSlug: string): Promise<RepNotificationOverride | null> {
    const cacheKey = `rep_override_${repSlug}`;
    const cached = getCached<RepNotificationOverride | null>(cacheKey);
    if (cached !== null) return cached;

    try {
      const initialized = await googleSheetsService.init();
      if (!initialized) return null;

      const doc = (googleSheetsService as unknown as SheetsServiceWithDoc).doc;
      const sheet = doc.sheetsByTitle[NOTIF_REP_SHEET];
      if (!sheet) return null;

      await sheet.loadHeaderRow();
      const rows = await sheet.getRows({ limit: 100000 });
      const row = rows.find((r: SheetRow) => r.get('repSlug') === repSlug);

      if (!row) {
        setCache(cacheKey, null);
        return null;
      }

      const override: RepNotificationOverride = {
        repSlug: row.get('repSlug'),
        repName: row.get('repName') || '',
        overrides: JSON.parse(row.get('overridesJson') || '{}'),
        updatedAt: row.get('updatedAt') || '',
      };

      const timingJson = row.get('reminderTimingJson');
      if (timingJson) {
        try { override.reminderTiming = JSON.parse(timingJson); } catch { /* skip */ }
      }

      setCache(cacheKey, override);
      return override;
    } catch (error) {
      console.warn(`[NotificationService] Failed to load rep overrides for ${repSlug}:`, error);
      return null;
    }
  }

  /**
   * Get all rep overrides (for admin view).
   */
  async getAllRepOverrides(): Promise<RepNotificationOverride[]> {
    try {
      const initialized = await googleSheetsService.init();
      if (!initialized) return [];

      const doc = (googleSheetsService as unknown as SheetsServiceWithDoc).doc;
      const sheet = doc.sheetsByTitle[NOTIF_REP_SHEET];
      if (!sheet) return [];

      await sheet.loadHeaderRow();
      const rows = await sheet.getRows({ limit: 100000 });
      return rows.map((row: SheetRow) => {
        const override: RepNotificationOverride = {
          repSlug: row.get('repSlug') || '',
          repName: row.get('repName') || '',
          overrides: JSON.parse(row.get('overridesJson') || '{}'),
          updatedAt: row.get('updatedAt') || '',
        };
        const timingJson = row.get('reminderTimingJson');
        if (timingJson) {
          try { override.reminderTiming = JSON.parse(timingJson); } catch { /* skip */ }
        }
        return override;
      });
    } catch (error) {
      console.warn('[NotificationService] Failed to load all rep overrides:', error);
      return [];
    }
  }

  /**
   * Save a rep's notification preference overrides.
   */
  async saveRepOverrides(
    repSlug: string,
    repName: string,
    overrides: NotificationOverrides,
    reminderTiming?: Partial<ReminderTiming>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const initialized = await googleSheetsService.init();
      if (!initialized) return { success: false, error: 'Google Sheets not available' };

      const doc = (googleSheetsService as unknown as SheetsServiceWithDoc).doc;
      let sheet = doc.sheetsByTitle[NOTIF_REP_SHEET];
      if (!sheet) {
        sheet = await doc.addSheet({ title: NOTIF_REP_SHEET, headerValues: REP_HEADERS });
      }

      await sheet.loadHeaderRow();
      const rows = await sheet.getRows({ limit: 100000 });
      const existingRow = rows.find((r: SheetRow) => r.get('repSlug') === repSlug);
      const now = new Date().toISOString();

      if (existingRow) {
        existingRow.set('repName', repName);
        existingRow.set('overridesJson', JSON.stringify(overrides));
        existingRow.set('reminderTimingJson', reminderTiming ? JSON.stringify(reminderTiming) : '');
        existingRow.set('updatedAt', now);
        await existingRow.save();
      } else {
        await sheet.addRow({
          repSlug,
          repName,
          overridesJson: JSON.stringify(overrides),
          reminderTimingJson: reminderTiming ? JSON.stringify(reminderTiming) : '',
          updatedAt: now,
        });
      }

      invalidateCache(`rep_override_${repSlug}`);
      return { success: true };
    } catch (error) {
      console.error(`[NotificationService] Failed to save rep overrides for ${repSlug}:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // ─── CUSTOMER OVERRIDES ───────────────────────────────────────────────

  /**
   * Get customer-specific notification overrides.
   */
  async getCustomerOverrides(customerId: string): Promise<CustomerNotificationOverride | null> {
    const cacheKey = `customer_override_${customerId}`;
    const cached = getCached<CustomerNotificationOverride | null>(cacheKey);
    if (cached !== null) return cached;

    try {
      const initialized = await googleSheetsService.init();
      if (!initialized) return null;

      const doc = (googleSheetsService as unknown as SheetsServiceWithDoc).doc;
      const sheet = doc.sheetsByTitle[NOTIF_CUSTOMER_SHEET];
      if (!sheet) return null;

      await sheet.loadHeaderRow();
      const rows = await sheet.getRows({ limit: 100000 });
      const row = rows.find((r: SheetRow) => r.get('customerId') === customerId);

      if (!row) {
        setCache(cacheKey, null);
        return null;
      }

      const override: CustomerNotificationOverride = {
        customerId: row.get('customerId'),
        customerName: row.get('customerName') || '',
        repSlug: row.get('repSlug') || '',
        overrides: JSON.parse(row.get('overridesJson') || '{}'),
        updatedAt: row.get('updatedAt') || '',
      };

      const timingJson = row.get('reminderTimingJson');
      if (timingJson) {
        try { override.reminderTiming = JSON.parse(timingJson); } catch { /* skip */ }
      }

      setCache(cacheKey, override);
      return override;
    } catch (error) {
      console.warn(`[NotificationService] Failed to load customer overrides for ${customerId}:`, error);
      return null;
    }
  }

  /**
   * Get all customer overrides for a specific rep.
   */
  async getCustomerOverridesForRep(repSlug: string): Promise<CustomerNotificationOverride[]> {
    try {
      const initialized = await googleSheetsService.init();
      if (!initialized) return [];

      const doc = (googleSheetsService as unknown as SheetsServiceWithDoc).doc;
      const sheet = doc.sheetsByTitle[NOTIF_CUSTOMER_SHEET];
      if (!sheet) return [];

      await sheet.loadHeaderRow();
      const rows = await sheet.getRows({ limit: 100000 });
      return rows
        .filter((r: SheetRow) => r.get('repSlug') === repSlug)
        .map((row: SheetRow) => {
          const override: CustomerNotificationOverride = {
            customerId: row.get('customerId') || '',
            customerName: row.get('customerName') || '',
            repSlug: row.get('repSlug') || '',
            overrides: JSON.parse(row.get('overridesJson') || '{}'),
            updatedAt: row.get('updatedAt') || '',
          };
          const timingJson = row.get('reminderTimingJson');
          if (timingJson) {
            try { override.reminderTiming = JSON.parse(timingJson); } catch { /* skip */ }
          }
          return override;
        });
    } catch (error) {
      console.warn(`[NotificationService] Failed to load customer overrides for rep ${repSlug}:`, error);
      return [];
    }
  }

  /**
   * Save customer-specific notification overrides (set by rep).
   */
  async saveCustomerOverrides(
    customerId: string,
    customerName: string,
    repSlug: string,
    overrides: NotificationOverrides,
    reminderTiming?: Partial<ReminderTiming>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const initialized = await googleSheetsService.init();
      if (!initialized) return { success: false, error: 'Google Sheets not available' };

      const doc = (googleSheetsService as unknown as SheetsServiceWithDoc).doc;
      let sheet = doc.sheetsByTitle[NOTIF_CUSTOMER_SHEET];
      if (!sheet) {
        sheet = await doc.addSheet({ title: NOTIF_CUSTOMER_SHEET, headerValues: CUSTOMER_HEADERS });
      }

      await sheet.loadHeaderRow();
      const rows = await sheet.getRows({ limit: 100000 });
      const existingRow = rows.find((r: SheetRow) => r.get('customerId') === customerId);
      const now = new Date().toISOString();

      if (existingRow) {
        existingRow.set('customerName', customerName);
        existingRow.set('repSlug', repSlug);
        existingRow.set('overridesJson', JSON.stringify(overrides));
        existingRow.set('reminderTimingJson', reminderTiming ? JSON.stringify(reminderTiming) : '');
        existingRow.set('updatedAt', now);
        await existingRow.save();
      } else {
        await sheet.addRow({
          customerId,
          customerName,
          repSlug,
          overridesJson: JSON.stringify(overrides),
          reminderTimingJson: reminderTiming ? JSON.stringify(reminderTiming) : '',
          updatedAt: now,
        });
      }

      invalidateCache(`customer_override_${customerId}`);
      return { success: true };
    } catch (error) {
      console.error(`[NotificationService] Failed to save customer overrides for ${customerId}:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // ─── PREFERENCE RESOLUTION (CASCADE) ──────────────────────────────────

  /**
   * Resolve the effective notification preferences for a given rep + optional customer.
   * Cascade: customer-specific > rep overrides > admin defaults
   */
  async resolvePreferences(
    repSlug: string,
    customerId?: string
  ): Promise<ResolvedPreferences[]> {
    const adminConfig = await this.getAdminDefaults();
    const repOverride = await this.getRepOverrides(repSlug);
    const customerOverride = customerId ? await this.getCustomerOverrides(customerId) : null;

    const results: ResolvedPreferences[] = [];

    for (const trigger of ALL_TRIGGERS) {
      const adminChannels = adminConfig.defaults[trigger] || DEFAULT_ADMIN_PREFERENCES[trigger];
      const repChannels = repOverride?.overrides?.[trigger];
      const customerChannels = customerOverride?.overrides?.[trigger];

      const channels: ChannelPreferences = { email: false, sms: false, groupme: false, in_app: false };
      const sources: ResolvedPreferences['sources'] = { email: 'admin', sms: 'admin', groupme: 'admin', in_app: 'admin' };

      for (const channel of ALL_CHANNELS) {
        // Start with admin default
        let value = adminChannels[channel];
        let source: 'admin' | 'rep' | 'customer' = 'admin';

        // Rep override (if not null)
        if (repChannels && repChannels[channel] !== null && repChannels[channel] !== undefined) {
          value = repChannels[channel] as boolean;
          source = 'rep';
        }

        // Customer override (if not null)
        if (customerChannels && customerChannels[channel] !== null && customerChannels[channel] !== undefined) {
          value = customerChannels[channel] as boolean;
          source = 'customer';
        }

        channels[channel] = value;
        sources[channel] = source;
      }

      results.push({ trigger, channels, sources });
    }

    return results;
  }

  /**
   * Resolve the effective reminder timing for a given rep + optional customer.
   */
  async resolveReminderTiming(repSlug: string, customerId?: string): Promise<ReminderTiming> {
    const adminConfig = await this.getAdminDefaults();
    const repOverride = await this.getRepOverrides(repSlug);
    const customerOverride = customerId ? await this.getCustomerOverrides(customerId) : null;

    let timing = { ...adminConfig.reminderTiming };

    if (repOverride?.reminderTiming) {
      timing = { ...timing, ...repOverride.reminderTiming };
    }

    if (customerOverride?.reminderTiming) {
      timing = { ...timing, ...customerOverride.reminderTiming };
    }

    return timing;
  }

  // ─── SEND NOTIFICATIONS ───────────────────────────────────────────────

  /**
   * Send a notification through all enabled channels based on the resolved preference cascade.
   * This is the primary method for sending notifications.
   */
  async sendNotification(payload: SendNotificationPayload): Promise<NotificationResult> {
    const { trigger, recipientRepSlug, recipientCustomerId, recipientEmail, recipientPhone, recipientName, title, message } = payload;

    // Resolve preferences
    const repSlug = recipientRepSlug || '';
    const resolved = await this.resolvePreferences(repSlug, recipientCustomerId || undefined);
    const triggerPrefs = resolved.find(r => r.trigger === trigger);

    if (!triggerPrefs) {
      return {
        trigger,
        channelResults: {
          email: { sent: false, skipped: true, error: 'Unknown trigger' },
          sms: { sent: false, skipped: true, error: 'Unknown trigger' },
          groupme: { sent: false, skipped: true, error: 'Unknown trigger' },
          in_app: { sent: false, skipped: true, error: 'Unknown trigger' },
        },
      };
    }

    const result: NotificationResult = {
      trigger,
      channelResults: {
        email: { sent: false, skipped: false },
        sms: { sent: false, skipped: false },
        groupme: { sent: false, skipped: false },
        in_app: { sent: false, skipped: false },
      },
    };

    // Determine recipient info
    const email = recipientEmail || this.getRepEmail(repSlug);
    const phone = recipientPhone || this.getRepPhone(repSlug);
    const name = recipientName || this.getRepName(repSlug);

    // Email channel
    if (triggerPrefs.channels.email && email) {
      try {
        const emailResult = await emailService.send({
          template: 'notification-dispatch',
          to: email,
          subject: payload.emailSubject || `[RCRS] ${title}`,
          body: payload.emailHtml || this.buildEmailHtml(title, message, payload.data),
          fromName: 'River City Roofing Solutions',
        });
        result.channelResults.email = {
          sent: emailResult.success,
          skipped: false,
          error: emailResult.error,
        };
      } catch (err) {
        result.channelResults.email = {
          sent: false,
          skipped: false,
          error: err instanceof Error ? err.message : 'Email send failed',
        };
      }
    } else {
      result.channelResults.email.skipped = true;
    }

    // SMS channel
    if (triggerPrefs.channels.sms && phone) {
      try {
        const smsText = `[RCRS] ${title}: ${message}`;
        const smsResult = await smsService.send(phone, smsText);
        result.channelResults.sms = {
          sent: smsResult.success,
          skipped: false,
          error: smsResult.error,
        };
      } catch (err) {
        result.channelResults.sms = {
          sent: false,
          skipped: false,
          error: err instanceof Error ? err.message : 'SMS send failed',
        };
      }
    } else {
      result.channelResults.sms.skipped = true;
    }

    // GroupMe channel
    if (triggerPrefs.channels.groupme) {
      try {
        const gmConfig = getGroupMeConfigFromEnv();
        if (gmConfig.enabled && gmConfig.botId) {
          const gmResult = await groupMeService.sendBotMessage(
            gmConfig.botId,
            `[${TRIGGER_LABELS[trigger]}] ${title}\n${message}`
          );
          result.channelResults.groupme = {
            sent: gmResult.success,
            skipped: false,
            error: gmResult.error,
          };
        } else {
          result.channelResults.groupme = {
            sent: false,
            skipped: true,
            error: 'GroupMe not configured',
          };
        }
      } catch (err) {
        result.channelResults.groupme = {
          sent: false,
          skipped: false,
          error: err instanceof Error ? err.message : 'GroupMe send failed',
        };
      }
    } else {
      result.channelResults.groupme.skipped = true;
    }

    // In-app channel
    if (triggerPrefs.channels.in_app) {
      try {
        const recipientId = recipientCustomerId || repSlug;
        const recipientType = recipientCustomerId ? 'customer' : 'rep';
        await this.createInAppNotification(recipientId, recipientType, trigger, title, message, payload.data);
        result.channelResults.in_app = { sent: true, skipped: false };
      } catch (err) {
        result.channelResults.in_app = {
          sent: false,
          skipped: false,
          error: err instanceof Error ? err.message : 'In-app notification failed',
        };
      }
    } else {
      result.channelResults.in_app.skipped = true;
    }

    // logging removed

    return result;
  }

  // ─── IN-APP NOTIFICATIONS ─────────────────────────────────────────────

  /**
   * Create an in-app notification (persisted to Google Sheets or in-memory).
   */
  async createInAppNotification(
    recipientId: string,
    recipientType: 'rep' | 'customer',
    trigger: NotificationTrigger,
    title: string,
    message: string,
    data?: Record<string, string>
  ): Promise<InAppNotification> {
    const notification: InAppNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      recipientId,
      recipientType,
      trigger,
      title,
      message,
      data,
      read: false,
      createdAt: new Date().toISOString(),
    };

    // Try to persist to Google Sheets
    try {
      const initialized = await googleSheetsService.init();
      if (initialized) {
        const doc = (googleSheetsService as unknown as SheetsServiceWithDoc).doc;
        let sheet = doc.sheetsByTitle[NOTIF_INBOX_SHEET];
        if (!sheet) {
          sheet = await doc.addSheet({ title: NOTIF_INBOX_SHEET, headerValues: INBOX_HEADERS });
        }
        await sheet.loadHeaderRow();
        await sheet.addRow({
          notificationId: notification.id,
          recipientId: notification.recipientId,
          recipientType: notification.recipientType,
          trigger: notification.trigger,
          title: notification.title,
          message: notification.message,
          dataJson: notification.data ? JSON.stringify(notification.data) : '',
          read: 'false',
          createdAt: notification.createdAt,
        });
      } else {
        inMemoryNotifications.push(notification);
      }
    } catch (error) {
      console.warn('[NotificationService] Failed to persist in-app notification to Sheets, using in-memory:', error);
      inMemoryNotifications.push(notification);
    }

    return notification;
  }

  /**
   * Get in-app notifications for a recipient.
   */
  async getInAppNotifications(
    recipientId: string,
    options?: { unreadOnly?: boolean; limit?: number }
  ): Promise<InAppNotification[]> {
    try {
      const initialized = await googleSheetsService.init();
      if (initialized) {
        const doc = (googleSheetsService as unknown as SheetsServiceWithDoc).doc;
        const sheet = doc.sheetsByTitle[NOTIF_INBOX_SHEET];
        if (!sheet) return [];

        await sheet.loadHeaderRow();
        const rows = await sheet.getRows({ limit: 100000 });
        let notifications: InAppNotification[] = rows
          .filter((r: SheetRow) => r.get('recipientId') === recipientId)
          .map((r: SheetRow) => ({
            id: r.get('notificationId'),
            recipientId: r.get('recipientId'),
            recipientType: r.get('recipientType') as 'rep' | 'customer',
            trigger: r.get('trigger') as NotificationTrigger,
            title: r.get('title'),
            message: r.get('message'),
            data: r.get('dataJson') ? JSON.parse(r.get('dataJson')) : undefined,
            read: r.get('read') === 'true',
            createdAt: r.get('createdAt'),
          }));

        if (options?.unreadOnly) {
          notifications = notifications.filter(n => !n.read);
        }

        // Sort newest first
        notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        if (options?.limit) {
          notifications = notifications.slice(0, options.limit);
        }

        return notifications;
      }
    } catch (error) {
      console.warn('[NotificationService] Failed to load in-app notifications from Sheets:', error);
    }

    // Fallback to in-memory
    let results = inMemoryNotifications.filter(n => n.recipientId === recipientId);
    if (options?.unreadOnly) {
      results = results.filter(n => !n.read);
    }
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (options?.limit) {
      results = results.slice(0, options.limit);
    }
    return results;
  }

  /**
   * Mark an in-app notification as read.
   */
  async markNotificationRead(notificationId: string): Promise<{ success: boolean }> {
    try {
      const initialized = await googleSheetsService.init();
      if (initialized) {
        const doc = (googleSheetsService as unknown as SheetsServiceWithDoc).doc;
        const sheet = doc.sheetsByTitle[NOTIF_INBOX_SHEET];
        if (sheet) {
          await sheet.loadHeaderRow();
          const rows = await sheet.getRows({ limit: 100000 });
          const row = rows.find((r: SheetRow) => r.get('notificationId') === notificationId);
          if (row) {
            row.set('read', 'true');
            await row.save();
            return { success: true };
          }
        }
      }
    } catch (error) {
      console.warn('[NotificationService] Failed to mark notification read in Sheets:', error);
    }

    // Fallback to in-memory
    const memNotif = inMemoryNotifications.find(n => n.id === notificationId);
    if (memNotif) {
      memNotif.read = true;
      return { success: true };
    }

    return { success: false };
  }

  /**
   * Mark all in-app notifications as read for a recipient.
   */
  async markAllRead(recipientId: string): Promise<{ success: boolean; count: number }> {
    let count = 0;
    try {
      const initialized = await googleSheetsService.init();
      if (initialized) {
        const doc = (googleSheetsService as unknown as SheetsServiceWithDoc).doc;
        const sheet = doc.sheetsByTitle[NOTIF_INBOX_SHEET];
        if (sheet) {
          await sheet.loadHeaderRow();
          const rows = await sheet.getRows({ limit: 100000 });
          for (const row of rows) {
            if (row.get('recipientId') === recipientId && row.get('read') !== 'true') {
              row.set('read', 'true');
              await row.save();
              count++;
            }
          }
          return { success: true, count };
        }
      }
    } catch (error) {
      console.warn('[NotificationService] Failed to mark all read in Sheets:', error);
    }

    // Fallback
    for (const n of inMemoryNotifications) {
      if (n.recipientId === recipientId && !n.read) {
        n.read = true;
        count++;
      }
    }
    return { success: true, count };
  }

  // ─── CONVENIENCE METHODS (trigger-specific senders) ────────────────────

  /**
   * Notify rep of new lead assignment.
   */
  async notifyLeadAssigned(data: {
    repSlug: string;
    leadName: string;
    leadPhone: string;
    leadEmail: string;
    leadAddress: string;
    source: string;
    leadId: string;
    portalUrl?: string;
  }): Promise<NotificationResult> {
    const repName = this.getRepName(data.repSlug);
    return this.sendNotification({
      trigger: 'lead_assigned',
      recipientRepSlug: data.repSlug,
      title: `New Lead: ${data.leadName}`,
      message: `${data.leadName} from ${data.source}. Address: ${data.leadAddress}. Phone: ${data.leadPhone}. Respond within 5 minutes!`,
      emailSubject: `New Lead Assigned: ${data.leadName}`,
      emailHtml: this.buildLeadAssignmentEmail(data, repName),
      data: {
        leadId: data.leadId,
        leadName: data.leadName,
        leadPhone: data.leadPhone,
        leadEmail: data.leadEmail,
        leadAddress: data.leadAddress,
        source: data.source,
        ...(data.portalUrl && { portalUrl: data.portalUrl }),
      },
    });
  }

  /**
   * Notify rep when customer views their portal.
   */
  async notifyCustomerViewedPortal(data: {
    repSlug: string;
    customerId: string;
    customerName: string;
  }): Promise<NotificationResult> {
    return this.sendNotification({
      trigger: 'customer_viewed_portal',
      recipientRepSlug: data.repSlug,
      recipientCustomerId: data.customerId,
      title: `Portal Viewed: ${data.customerName}`,
      message: `${data.customerName} just accessed their customer portal. Good time to follow up!`,
      data: {
        customerId: data.customerId,
        customerName: data.customerName,
      },
    });
  }

  /**
   * Notify rep when customer sends a message.
   */
  async notifyCustomerSentMessage(data: {
    repSlug: string;
    customerId: string;
    customerName: string;
    messagePreview: string;
  }): Promise<NotificationResult> {
    return this.sendNotification({
      trigger: 'customer_sent_message',
      recipientRepSlug: data.repSlug,
      recipientCustomerId: data.customerId,
      title: `Message from ${data.customerName}`,
      message: `"${data.messagePreview.substring(0, 150)}${data.messagePreview.length > 150 ? '...' : ''}"`,
      data: {
        customerId: data.customerId,
        customerName: data.customerName,
      },
    });
  }

  /**
   * Notify about delivery status change.
   */
  async notifyDeliveryStatusChange(data: {
    repSlug: string;
    customerId?: string;
    customerName: string;
    ticketId: string;
    oldStatus: string;
    newStatus: string;
    address: string;
  }): Promise<NotificationResult> {
    return this.sendNotification({
      trigger: 'delivery_status_change',
      recipientRepSlug: data.repSlug,
      recipientCustomerId: data.customerId,
      title: `Delivery ${data.newStatus}: ${data.customerName}`,
      message: `Ticket ${data.ticketId} status changed from "${data.oldStatus}" to "${data.newStatus}". Address: ${data.address}`,
      data: {
        ticketId: data.ticketId,
        oldStatus: data.oldStatus,
        newStatus: data.newStatus,
        address: data.address,
      },
    });
  }

  /**
   * Notify about payment received.
   */
  async notifyPaymentReceived(data: {
    repSlug: string;
    customerId?: string;
    customerName: string;
    amount: string;
    paymentMethod?: string;
  }): Promise<NotificationResult> {
    return this.sendNotification({
      trigger: 'payment_received',
      recipientRepSlug: data.repSlug,
      recipientCustomerId: data.customerId,
      title: `Payment Received: ${data.customerName}`,
      message: `${data.customerName} paid $${data.amount}${data.paymentMethod ? ` via ${data.paymentMethod}` : ''}.`,
      data: {
        customerName: data.customerName,
        amount: data.amount,
        ...(data.paymentMethod && { paymentMethod: data.paymentMethod }),
      },
    });
  }

  /**
   * Notify about appointment reminder.
   */
  async notifyAppointmentReminder(data: {
    repSlug: string;
    customerId?: string;
    customerName: string;
    appointmentType: string;
    scheduledDate: string;
    scheduledTime: string;
    address: string;
  }): Promise<NotificationResult> {
    return this.sendNotification({
      trigger: 'appointment_reminder',
      recipientRepSlug: data.repSlug,
      recipientCustomerId: data.customerId,
      recipientName: this.getRepName(data.repSlug),
      title: `Reminder: ${data.appointmentType} with ${data.customerName}`,
      message: `Scheduled for ${data.scheduledDate} at ${data.scheduledTime}. Address: ${data.address}`,
      data: {
        customerName: data.customerName,
        appointmentType: data.appointmentType,
        scheduledDate: data.scheduledDate,
        scheduledTime: data.scheduledTime,
        address: data.address,
      },
    });
  }

  /**
   * Notify about inspection scheduled.
   */
  async notifyInspectionScheduled(data: {
    repSlug: string;
    customerId?: string;
    customerName: string;
    inspectionDate: string;
    inspectionTime: string;
    address: string;
    inspector?: string;
  }): Promise<NotificationResult> {
    return this.sendNotification({
      trigger: 'inspection_scheduled',
      recipientRepSlug: data.repSlug,
      recipientCustomerId: data.customerId,
      title: `Inspection Scheduled: ${data.customerName}`,
      message: `Roof inspection on ${data.inspectionDate} at ${data.inspectionTime}. Address: ${data.address}${data.inspector ? `. Inspector: ${data.inspector}` : ''}`,
      data: {
        customerName: data.customerName,
        inspectionDate: data.inspectionDate,
        inspectionTime: data.inspectionTime,
        address: data.address,
        ...(data.inspector && { inspector: data.inspector }),
      },
    });
  }

  /**
   * Notify when rep arrives at job site (future: location-based).
   */
  async notifyRepArrivedAtJob(data: {
    repSlug: string;
    customerId?: string;
    customerName: string;
    address: string;
    jobId?: string;
  }): Promise<NotificationResult> {
    return this.sendNotification({
      trigger: 'rep_arrived_at_job',
      recipientRepSlug: data.repSlug,
      recipientCustomerId: data.customerId,
      title: `Rep Arrived: ${data.address}`,
      message: `${this.getRepName(data.repSlug)} has arrived at ${data.address} for ${data.customerName}'s job.`,
      data: {
        customerName: data.customerName,
        address: data.address,
        ...(data.jobId && { jobId: data.jobId }),
      },
    });
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────

  private getRepEmail(repSlug: string): string {
    const member = teamMembers.find(m => m.slug === repSlug);
    return member?.email || '';
  }

  private getRepPhone(repSlug: string): string {
    const member = teamMembers.find(m => m.slug === repSlug);
    return member?.phone || '';
  }

  private getRepName(repSlug: string): string {
    const member = teamMembers.find(m => m.slug === repSlug);
    return member?.name || repSlug;
  }

  private buildEmailHtml(title: string, message: string, data?: Record<string, string>): string {
    let detailsHtml = '';
    if (data && Object.keys(data).length > 0) {
      const rows = Object.entries(data)
        .map(([key, value]) => {
          const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
          return `<tr><td style="padding: 6px 12px; border-bottom: 1px solid #333; color: #999; font-weight: 600;">${label}</td><td style="padding: 6px 12px; border-bottom: 1px solid #333; color: #ccc;">${value}</td></tr>`;
        })
        .join('');
      detailsHtml = `<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">${rows}</table>`;
    }

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #111; color: #eee;">
        <div style="background: #000; padding: 20px; text-align: center;">
          <h1 style="color: #39FF14; margin: 0; font-size: 20px;">River City Roofing Solutions</h1>
        </div>
        <div style="padding: 24px;">
          <h2 style="color: #39FF14; margin: 0 0 12px 0; font-size: 18px;">${title}</h2>
          <p style="color: #ccc; line-height: 1.6; margin: 0 0 16px 0;">${message}</p>
          ${detailsHtml}
        </div>
        <div style="background: #0a0a0a; padding: 12px; text-align: center; font-size: 11px; color: #666;">
          River City Roofing Solutions | (256) 274-8530 | rivercityroofingsolutions.com
        </div>
      </div>
    `;
  }

  private buildLeadAssignmentEmail(data: {
    repSlug: string;
    leadName: string;
    leadPhone: string;
    leadEmail: string;
    leadAddress: string;
    source: string;
    leadId: string;
    portalUrl?: string;
  }, repName: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #000; padding: 20px; text-align: center;">
          <h1 style="color: #39FF14; margin: 0;">New Lead Assignment</h1>
        </div>
        <div style="padding: 30px; background: #fff;">
          <p>Hi ${repName},</p>
          <p>A new lead has been assigned to you. <strong>Please respond within 5 minutes.</strong></p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Name</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${data.leadName}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Phone</td><td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="tel:${data.leadPhone}">${data.leadPhone}</a></td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Email</td><td style="padding: 8px; border-bottom: 1px solid #eee;"><a href="mailto:${data.leadEmail}">${data.leadEmail}</a></td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Address</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${data.leadAddress}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">Source</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${data.source}</td></tr>
          </table>
          ${data.portalUrl ? `<p><a href="${data.portalUrl}" style="background: #39FF14; color: #000; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Customer Portal</a></p>` : ''}
        </div>
        <div style="background: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          River City Roofing Solutions | (256) 274-8530 | rivercityroofingsolutions.com
        </div>
      </div>
    `;
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const notificationService = new NotificationService();
export default notificationService;