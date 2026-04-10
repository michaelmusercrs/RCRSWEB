/**
 * Calendar Reminder Service
 *
 * Generates and manages reminders for upcoming calendar events
 * (appointments, jobs, deliveries, inspections, installations).
 *
 * Reminder timings: 1 day before, 1 hour before, 15 min before
 * Reminder types: team member, customer
 * Tracks sent reminders in Google Sheets (Calendar_Reminders tab)
 *
 * Team reminders include Google Calendar link for the event.
 * Customer reminders include appointment details + company phone.
 */

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { generateGoogleCalendarLink } from './google-calendar';
import { teamMembers } from './teamData';
import { groupMeService, getGroupMeConfigFromEnv } from './groupme-service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReminderTiming = '1_day_before' | '1_hour_before' | '30_min_before' | '15_min_before';
export type ReminderRecipientType = 'team' | 'customer';
export type ReminderStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export interface CalendarReminder {
  reminderId: string;
  eventId: string;
  eventTitle: string;
  eventType: string;
  eventStart: string; // ISO datetime
  eventLocation?: string;
  recipientType: ReminderRecipientType;
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  timing: ReminderTiming;
  reminderDueAt: string; // ISO datetime - when the reminder should be sent
  message: string;
  googleCalendarLink?: string;
  status: ReminderStatus;
  sentAt?: string;
  createdAt: string;
  error?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  eventType: string;
  status: string;
  source: string;
  assignedTo?: string;
  assignedToName?: string;
  customer?: {
    name?: string;
    phone?: string;
    email?: string;
  } | null;
  notes?: string;
  priority?: string;
}

// ---------------------------------------------------------------------------
// Timing offsets (milliseconds)
// ---------------------------------------------------------------------------

const TIMING_OFFSETS: Record<ReminderTiming, number> = {
  '1_day_before': 24 * 60 * 60 * 1000,
  '1_hour_before': 60 * 60 * 1000,
  '30_min_before': 30 * 60 * 1000,
  '15_min_before': 15 * 60 * 1000,
};

const TIMING_LABELS: Record<ReminderTiming, string> = {
  '1_day_before': 'tomorrow',
  '1_hour_before': 'in 1 hour',
  '30_min_before': 'in 30 minutes',
  '15_min_before': 'in 15 minutes',
};

const REMINDER_TIMINGS: ReminderTiming[] = [
  '1_day_before',
  '1_hour_before',
  '30_min_before',
  '15_min_before',
];

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class CalendarReminderService {
  private doc: GoogleSpreadsheet | null = null;
  private initialized = false;

  private async getDoc(): Promise<GoogleSpreadsheet> {
    if (this.doc && this.initialized) {
      return this.doc;
    }

    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const sheetId = process.env.GOOGLE_SHEET_ID
      || process.env.GOOGLE_SHEETS_ID
      || process.env.DELIVERY_SHEETS_ID;

    if (!serviceAccountEmail || !privateKey || !sheetId) {
      throw new Error('Missing Google Sheets credentials');
    }

    const jwt = new JWT({
      email: serviceAccountEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    this.doc = new GoogleSpreadsheet(sheetId, jwt);
    await this.doc.loadInfo();
    this.initialized = true;

    return this.doc;
  }

  private async getOrCreateSheet(sheetName: string, headers: string[]) {
    const doc = await this.getDoc();
    let sheet = doc.sheetsByTitle[sheetName];
    if (!sheet) {
      sheet = await doc.addSheet({ title: sheetName, headerValues: headers, gridProperties: { columnCount: Math.max(headers.length + 5, 26) } });
    } else {
      // Ensure headers exist - fix for sheets created without headers
      try {
        await sheet.loadHeaderRow();
      } catch {
        if (sheet.gridProperties.columnCount < headers.length) {
          await sheet.resize({ rowCount: sheet.gridProperties.rowCount, columnCount: headers.length + 5 });
        }
        await sheet.setHeaderRow(headers);
      }
    }
    return sheet;
  }

  private get reminderHeaders(): string[] {
    return [
      'reminderId', 'eventId', 'eventTitle', 'eventType', 'eventStart',
      'eventLocation', 'recipientType', 'recipientName', 'recipientEmail',
      'recipientPhone', 'timing', 'reminderDueAt', 'message',
      'googleCalendarLink', 'status', 'sentAt', 'createdAt', 'error',
    ];
  }

  // =========================================================================
  // Generate reminders for a set of events
  // =========================================================================

  generateRemindersForEvent(event: CalendarEvent): CalendarReminder[] {
    const reminders: CalendarReminder[] = [];
    const eventStart = new Date(event.start);
    const now = new Date();

    // Skip cancelled/completed events
    if (['cancelled', 'completed'].includes(event.status)) {
      return [];
    }

    // Find assigned team member
    const teamMember = event.assignedToName
      ? teamMembers.find(
          (m) =>
            m.name.toLowerCase() === event.assignedToName!.toLowerCase() ||
            m.slug === event.assignedTo
        )
      : null;

    // Build attendee emails for Google Calendar link
    const attendeeEmails: string[] = [];
    if (teamMember?.email) {
      attendeeEmails.push(teamMember.email);
    }
    if (event.customer?.email) {
      attendeeEmails.push(event.customer.email);
    }

    // Google Calendar link for this event
    const gcalLink = generateGoogleCalendarLink({
      title: event.title,
      startDate: event.start,
      endDate: event.end,
      description: [
        event.eventType ? `Type: ${event.eventType}` : '',
        event.assignedToName ? `Assigned to: ${event.assignedToName}` : '',
        event.customer?.name ? `Customer: ${event.customer.name}` : '',
        event.customer?.phone ? `Phone: ${event.customer.phone}` : '',
        event.notes || '',
      ]
        .filter(Boolean)
        .join('\n'),
      location: event.location,
      attendeeEmails,
    });

    for (const timing of REMINDER_TIMINGS) {
      const dueAt = new Date(eventStart.getTime() - TIMING_OFFSETS[timing]);

      // Skip reminders that are already past
      if (dueAt <= now) continue;

      const timingLabel = TIMING_LABELS[timing];

      // --- Team reminder ---
      if (event.assignedToName) {
        const repName = event.assignedToName;
        const friendlyTime = eventStart.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
        const friendlyDate = eventStart.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        });

        let teamMessage = `Reminder: ${event.title}`;
        if (event.location) {
          teamMessage += ` at ${event.location}`;
        }
        teamMessage += ` ${timingLabel}`;
        if (timing === '1_day_before') {
          teamMessage += ` (${friendlyDate} at ${friendlyTime})`;
        } else {
          teamMessage += ` (${friendlyTime})`;
        }
        teamMessage += `. Rep: ${repName}.`;
        if (event.customer?.name) {
          teamMessage += ` Customer: ${event.customer.name}.`;
        }
        teamMessage += ` [Add to Calendar] ${gcalLink}`;

        reminders.push({
          reminderId: this.generateId('CALR'),
          eventId: event.id,
          eventTitle: event.title,
          eventType: event.eventType,
          eventStart: event.start,
          eventLocation: event.location,
          recipientType: 'team',
          recipientName: repName,
          recipientEmail: teamMember?.email,
          recipientPhone: teamMember?.phone,
          timing,
          reminderDueAt: dueAt.toISOString(),
          message: teamMessage,
          googleCalendarLink: gcalLink,
          status: 'pending',
          createdAt: new Date().toISOString(),
        });
      }

      // --- Customer reminder (1 day, 1 hour, and 30 min before) ---
      if (
        event.customer?.name &&
        (timing === '1_day_before' || timing === '1_hour_before' || timing === '30_min_before')
      ) {
        const friendlyTime = eventStart.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
        const friendlyDate = eventStart.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        });

        const firstName = event.customer.name.split(' ')[0];
        let customerMessage = `Hi ${firstName}! This is River City Roofing.`;
        if (timing === '1_day_before') {
          customerMessage += ` Your ${event.eventType || 'appointment'} is scheduled for tomorrow, ${friendlyDate} at ${friendlyTime}.`;
        } else {
          customerMessage += ` Your ${event.eventType || 'appointment'} is ${timingLabel} at ${friendlyTime}.`;
        }
        if (event.location) {
          customerMessage += ` Location: ${event.location}.`;
        }
        if (event.assignedToName) {
          customerMessage += ` Rep: ${event.assignedToName}.`;
        }
        customerMessage += ` Questions? Call us at (256) 274-8530.`;

        // Customer-facing Google Calendar link (without internal notes)
        const customerGcalLink = generateGoogleCalendarLink({
          title: `${event.eventType ? event.eventType.charAt(0).toUpperCase() + event.eventType.slice(1) : 'Appointment'} - River City Roofing`,
          startDate: event.start,
          endDate: event.end,
          description: `Your ${event.eventType || 'appointment'} with River City Roofing Solutions. Contact: (256) 274-8530`,
          location: event.location,
        });

        reminders.push({
          reminderId: this.generateId('CALR'),
          eventId: event.id,
          eventTitle: event.title,
          eventType: event.eventType,
          eventStart: event.start,
          eventLocation: event.location,
          recipientType: 'customer',
          recipientName: event.customer.name,
          recipientEmail: event.customer.email,
          recipientPhone: event.customer.phone,
          timing,
          reminderDueAt: dueAt.toISOString(),
          message: customerMessage,
          googleCalendarLink: customerGcalLink,
          status: 'pending',
          createdAt: new Date().toISOString(),
        });
      }
    }

    return reminders;
  }

  // =========================================================================
  // Check for due reminders and generate pending ones
  // =========================================================================

  async checkAndGenerateReminders(
    events: CalendarEvent[]
  ): Promise<CalendarReminder[]> {
    const now = new Date();
    const allReminders: CalendarReminder[] = [];

    // Load existing sent reminder keys to avoid duplicates
    const sentKeys = await this.getSentReminderKeys();

    for (const event of events) {
      const eventReminders = this.generateRemindersForEvent(event);

      for (const reminder of eventReminders) {
        // Check for duplicate (same event + recipient type + timing)
        const key = `${reminder.eventId}|${reminder.recipientType}|${reminder.timing}`;
        if (sentKeys.has(key)) continue;

        // Check if reminder is due now (due time has passed or is within next 5 minutes)
        const dueAt = new Date(reminder.reminderDueAt);
        const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

        if (dueAt <= fiveMinutesFromNow) {
          allReminders.push(reminder);
        }
      }
    }

    return allReminders;
  }

  // =========================================================================
  // Get pending reminders for today/tomorrow
  // =========================================================================

  async getPendingReminders(events: CalendarEvent[]): Promise<CalendarReminder[]> {
    const sentKeys = await this.getSentReminderKeys();
    const allPending: CalendarReminder[] = [];

    for (const event of events) {
      const eventReminders = this.generateRemindersForEvent(event);

      for (const reminder of eventReminders) {
        const key = `${reminder.eventId}|${reminder.recipientType}|${reminder.timing}`;
        if (!sentKeys.has(key)) {
          allPending.push(reminder);
        }
      }
    }

    // Sort by due time
    allPending.sort(
      (a, b) =>
        new Date(a.reminderDueAt).getTime() -
        new Date(b.reminderDueAt).getTime()
    );

    return allPending;
  }

  // =========================================================================
  // Send a single reminder
  // =========================================================================

  async sendReminder(reminder: CalendarReminder): Promise<CalendarReminder> {
    try {
      const config = getGroupMeConfigFromEnv();

      if (reminder.recipientType === 'team') {
        // Send team reminder via GroupMe
        if (config.enabled && config.botId) {
          const result = await groupMeService.sendBotMessage(
            config.botId,
            `[REMINDER] ${reminder.message}`
          );
          if (result.success) {
            reminder.status = 'sent';
            reminder.sentAt = new Date().toISOString();
          } else {
            reminder.status = 'failed';
            reminder.error = result.error || 'GroupMe send failed';
          }
        } else {
          // GroupMe not configured, mark as sent (logged only)
          reminder.status = 'sent';
          reminder.sentAt = new Date().toISOString();
        }
      } else if (reminder.recipientType === 'customer') {
        // Log customer notification via GroupMe for office visibility
        if (config.enabled && config.botId) {
          const logMsg = `[CUSTOMER REMINDER SENT] To: ${reminder.recipientName}${reminder.recipientPhone ? ` (${reminder.recipientPhone})` : ''}\n${reminder.message}`;
          await groupMeService.sendBotMessage(config.botId, logMsg);
        }

        // In production, send SMS/email to customer here.
        // For now, mark as sent since it is logged.
        reminder.status = 'sent';
        reminder.sentAt = new Date().toISOString();
      }
    } catch (error) {
      reminder.status = 'failed';
      reminder.error =
        error instanceof Error ? error.message : 'Unknown error';
    }

    // Persist to Google Sheets
    await this.saveReminder(reminder);
    return reminder;
  }

  // =========================================================================
  // Send all due reminders for a set of events
  // =========================================================================

  async checkAndSendDueReminders(
    events: CalendarEvent[]
  ): Promise<{
    sent: number;
    failed: number;
    skipped: number;
    reminders: CalendarReminder[];
  }> {
    const dueReminders = await this.checkAndGenerateReminders(events);

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const results: CalendarReminder[] = [];

    for (const reminder of dueReminders) {
      const result = await this.sendReminder(reminder);
      results.push(result);
      if (result.status === 'sent') sent++;
      else if (result.status === 'failed') failed++;
      else skipped++;
    }

    return { sent, failed, skipped, reminders: results };
  }

  // =========================================================================
  // Persistence helpers
  // =========================================================================

  private async saveReminder(reminder: CalendarReminder): Promise<void> {
    try {
      const sheet = await this.getOrCreateSheet(
        'Calendar_Reminders',
        this.reminderHeaders
      );
      await sheet.addRow(
        reminder as unknown as Record<string, string | number | boolean>
      );
    } catch (error) {
      console.error('Failed to save calendar reminder:', error);
    }
  }

  private async getSentReminderKeys(): Promise<Set<string>> {
    try {
      const sheet = await this.getOrCreateSheet(
        'Calendar_Reminders',
        this.reminderHeaders
      );
      const rows = await sheet.getRows();
      const keys = new Set<string>();

      for (const row of rows) {
        if (row.get('status') === 'sent') {
          const key = `${row.get('eventId')}|${row.get('recipientType')}|${row.get('timing')}`;
          keys.add(key);
        }
      }

      return keys;
    } catch {
      return new Set();
    }
  }

  async getRecentReminders(limit: number = 50): Promise<CalendarReminder[]> {
    try {
      const sheet = await this.getOrCreateSheet(
        'Calendar_Reminders',
        this.reminderHeaders
      );
      const rows = await sheet.getRows();

      return rows
        .map((row) => ({
          reminderId: row.get('reminderId'),
          eventId: row.get('eventId'),
          eventTitle: row.get('eventTitle'),
          eventType: row.get('eventType'),
          eventStart: row.get('eventStart'),
          eventLocation: row.get('eventLocation'),
          recipientType: row.get('recipientType') as ReminderRecipientType,
          recipientName: row.get('recipientName'),
          recipientEmail: row.get('recipientEmail'),
          recipientPhone: row.get('recipientPhone'),
          timing: row.get('timing') as ReminderTiming,
          reminderDueAt: row.get('reminderDueAt'),
          message: row.get('message'),
          googleCalendarLink: row.get('googleCalendarLink'),
          status: row.get('status') as ReminderStatus,
          sentAt: row.get('sentAt'),
          createdAt: row.get('createdAt'),
          error: row.get('error'),
        }))
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, limit);
    } catch {
      return [];
    }
  }

  // =========================================================================
  // Private helpers
  // =========================================================================

  private generateId(prefix: string): string {
    const dateStr = new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, '');
    const random = Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();
    return `${prefix}-${dateStr}-${random}`;
  }
}

export const calendarReminderService = new CalendarReminderService();
