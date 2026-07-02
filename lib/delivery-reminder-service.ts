// Delivery Reminder & ETA Service
// Generates reminders for upcoming deliveries, tracks sent status, and calculates ETAs.

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { DeliveryTicket, TicketStatus, deliveryWorkflowService } from './delivery-workflow-service';
import { groupMeService, getGroupMeConfigFromEnv } from './groupme-service';
import { smsService } from './sms-service';
import { emailService } from './email-service';

const SHEETS_ID = process.env.DELIVERY_SHEETS_ID || process.env.GOOGLE_SHEETS_ID;

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// ============================================
// TYPES
// ============================================

export type ReminderType = 'customer' | 'driver' | 'office';
export type ReminderTrigger = 'next_day' | 'same_day_morning' | 'status_change' | 'manual';

export interface DeliveryReminder {
  reminderId: string;
  ticketId: string;
  reminderType: ReminderType;
  trigger: ReminderTrigger;
  recipientName: string;
  recipientContact: string; // phone, email, or driver ID
  message: string;
  scheduledFor: string; // ISO date for when reminder should be sent
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  sentAt?: string;
  createdAt: string;
  error?: string;
}

export interface DeliveryETA {
  ticketId: string;
  stopNumber: number;
  totalStops: number;
  estimatedArrival: string; // ISO datetime
  estimatedMinutesAway: number;
  driverName: string;
  status: TicketStatus;
  lastUpdated: string;
}

export interface DailySummary {
  date: string;
  totalDeliveries: number;
  byDriver: Array<{
    driverId: string;
    driverName: string;
    stopCount: number;
    firstStop: string;
    firstStopTime: string;
  }>;
  urgentCount: number;
  rushCount: number;
}

// Average minutes per stop (including travel + unload time)
const MINUTES_PER_STOP = 30;

// ============================================
// DELIVERY REMINDER SERVICE
// ============================================

class DeliveryReminderService {
  private doc: GoogleSpreadsheet | null = null;
  private initialized = false;

  private async getDoc(): Promise<GoogleSpreadsheet> {
    if (!this.doc) {
      this.doc = new GoogleSpreadsheet(SHEETS_ID!, serviceAccountAuth);
    }
    if (!this.initialized) {
      await this.doc.loadInfo();
      this.initialized = true;
    }
    return this.doc;
  }

  private async getOrCreateSheet(name: string, headers: string[]) {
    const doc = await this.getDoc();
    let sheet = doc.sheetsByTitle[name];
    if (!sheet) {
      sheet = await doc.addSheet({ title: name, headerValues: headers, gridProperties: { columnCount: Math.max(headers.length + 5, 26) } });
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

  private generateId(prefix: string): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${dateStr}-${random}`;
  }

  private getReminderHeaders() {
    return [
      'reminderId', 'ticketId', 'reminderType', 'trigger',
      'recipientName', 'recipientContact', 'message',
      'scheduledFor', 'status', 'sentAt', 'createdAt', 'error',
    ];
  }

  // ============================================
  // REMINDER TEMPLATES
  // ============================================

  generateCustomerReminder(ticket: DeliveryTicket, trigger: ReminderTrigger): string {
    const dateStr = ticket.scheduledDate
      ? new Date(ticket.scheduledDate + 'T12:00:00').toLocaleDateString('en-US', {
          weekday: 'long', month: 'long', day: 'numeric',
        })
      : 'your scheduled date';

    const timeWindow = ticket.scheduledTime || 'during business hours';
    const driverName = ticket.assignedDriverName || 'your assigned driver';

    if (trigger === 'next_day') {
      return `Hi ${ticket.customerName}! This is River City Roofing. Your delivery is scheduled for tomorrow, ${dateStr}. Expected arrival: ${timeWindow}. Your driver is ${driverName}. Questions? Call us at (256) 274-8530.`;
    }

    return `Good morning ${ticket.customerName}! Your RCRS delivery is scheduled for today. Expected arrival: ${timeWindow}. Your driver ${driverName} will contact you when en route. Call (256) 274-8530 with any questions.`;
  }

  generateDriverReminder(
    driverName: string,
    tickets: DeliveryTicket[],
    trigger: ReminderTrigger,
  ): string {
    const count = tickets.length;
    const firstStop = tickets[0];

    if (!firstStop) {
      return `${driverName}: No deliveries assigned for tomorrow.`;
    }

    const firstAddress = `${firstStop.jobAddress}, ${firstStop.city}`;
    const firstTime = firstStop.scheduledTime || 'TBD';

    if (trigger === 'next_day') {
      const urgentCount = tickets.filter(t => t.priority === 'urgent').length;
      const rushCount = tickets.filter(t => t.priority === 'rush').length;
      let priorityNote = '';
      if (urgentCount > 0) priorityNote += ` ${urgentCount} URGENT.`;
      if (rushCount > 0) priorityNote += ` ${rushCount} RUSH.`;

      return `${driverName} - Tomorrow's deliveries: ${count} stop${count !== 1 ? 's' : ''}.${priorityNote} First stop: ${firstAddress} at ${firstTime}. Check your driver portal for full route details.`;
    }

    return `${driverName} - Today's route: ${count} stop${count !== 1 ? 's' : ''}. First stop: ${firstAddress} at ${firstTime}. Open your driver portal to start.`;
  }

  generateOfficeReminder(summary: DailySummary, trigger: ReminderTrigger): string {
    const dateLabel = trigger === 'next_day' ? 'Tomorrow' : 'Today';
    const dateStr = new Date(summary.date + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'short', day: 'numeric',
    });

    let msg = `[DELIVERY] ${dateLabel}'s Summary (${dateStr}): ${summary.totalDeliveries} deliveries scheduled.`;

    if (summary.urgentCount > 0) {
      msg += ` ${summary.urgentCount} URGENT.`;
    }
    if (summary.rushCount > 0) {
      msg += ` ${summary.rushCount} RUSH.`;
    }

    msg += '\n---';
    for (const d of summary.byDriver) {
      msg += `\n${d.driverName}: ${d.stopCount} stop${d.stopCount !== 1 ? 's' : ''}, first at ${d.firstStopTime || 'TBD'}`;
    }

    return msg;
  }

  // ============================================
  // GENERATE REMINDERS
  // ============================================

  async generateRemindersForDate(
    targetDate: string,
    trigger: ReminderTrigger,
  ): Promise<DeliveryReminder[]> {
    // Get all tickets scheduled for the target date
    const tickets = await deliveryWorkflowService.getTickets({ date: targetDate });

    // Filter to only active delivery tickets (not cancelled or completed)
    const activeTickets = tickets.filter(t =>
      t.ticketType === 'delivery' &&
      !['completed', 'cancelled'].includes(t.status)
    );

    if (activeTickets.length === 0) return [];

    const reminders: DeliveryReminder[] = [];
    const now = new Date().toISOString();

    // Check which reminders have already been sent
    const existingReminders = await this.getReminders({ date: targetDate });
    const sentKeys = new Set(
      existingReminders
        .filter(r => r.status === 'sent')
        .map(r => `${r.ticketId}-${r.reminderType}-${r.trigger}`)
    );

    // 1. Customer reminders (one per ticket)
    for (const ticket of activeTickets) {
      const key = `${ticket.ticketId}-customer-${trigger}`;
      if (sentKeys.has(key)) continue;

      if (ticket.customerPhone) {
        reminders.push({
          reminderId: this.generateId('RMD'),
          ticketId: ticket.ticketId,
          reminderType: 'customer',
          trigger,
          recipientName: ticket.customerName,
          recipientContact: ticket.customerPhone,
          message: this.generateCustomerReminder(ticket, trigger),
          scheduledFor: targetDate,
          status: 'pending',
          createdAt: now,
        });
      }
    }

    // 2. Driver reminders (grouped by driver)
    const driverGroups = new Map<string, DeliveryTicket[]>();
    for (const ticket of activeTickets) {
      if (ticket.assignedDriver) {
        const existing = driverGroups.get(ticket.assignedDriver) || [];
        existing.push(ticket);
        driverGroups.set(ticket.assignedDriver, existing);
      }
    }

    for (const [driverId, driverTickets] of driverGroups) {
      const key = `${driverId}-driver-${trigger}`;
      if (sentKeys.has(key)) continue;

      const driverName = driverTickets[0]?.assignedDriverName || 'Driver';
      // Sort by scheduled time
      driverTickets.sort((a, b) => (a.scheduledTime || '').localeCompare(b.scheduledTime || ''));

      reminders.push({
        reminderId: this.generateId('RMD'),
        ticketId: driverId, // use driverId as reference for driver reminders
        reminderType: 'driver',
        trigger,
        recipientName: driverName,
        recipientContact: driverId,
        message: this.generateDriverReminder(driverName, driverTickets, trigger),
        scheduledFor: targetDate,
        status: 'pending',
        createdAt: now,
      });
    }

    // 3. Office summary reminder (one per date)
    const officeKey = `office-office-${trigger}`;
    if (!sentKeys.has(officeKey)) {
      const summary = this.buildDailySummary(targetDate, activeTickets);
      reminders.push({
        reminderId: this.generateId('RMD'),
        ticketId: 'office',
        reminderType: 'office',
        trigger,
        recipientName: 'Office',
        recipientContact: 'groupme',
        message: this.generateOfficeReminder(summary, trigger),
        scheduledFor: targetDate,
        status: 'pending',
        createdAt: now,
      });
    }

    return reminders;
  }

  private buildDailySummary(date: string, tickets: DeliveryTicket[]): DailySummary {
    const driverGroups = new Map<string, DeliveryTicket[]>();
    for (const t of tickets) {
      const dId = t.assignedDriver || 'unassigned';
      const existing = driverGroups.get(dId) || [];
      existing.push(t);
      driverGroups.set(dId, existing);
    }

    return {
      date,
      totalDeliveries: tickets.length,
      byDriver: Array.from(driverGroups.entries()).map(([dId, dTickets]) => {
        dTickets.sort((a, b) => (a.scheduledTime || '').localeCompare(b.scheduledTime || ''));
        return {
          driverId: dId,
          driverName: dTickets[0]?.assignedDriverName || 'Unassigned',
          stopCount: dTickets.length,
          firstStop: dTickets[0]?.jobAddress || '',
          firstStopTime: dTickets[0]?.scheduledTime || 'TBD',
        };
      }),
      urgentCount: tickets.filter(t => t.priority === 'urgent').length,
      rushCount: tickets.filter(t => t.priority === 'rush').length,
    };
  }

  // ============================================
  // SEND REMINDERS
  // ============================================

  async sendReminder(reminder: DeliveryReminder): Promise<DeliveryReminder> {
    try {
      if (reminder.reminderType === 'office' || reminder.recipientContact === 'groupme') {
        // Send via GroupMe
        const config = getGroupMeConfigFromEnv();
        if (config.enabled && config.botId) {
          const result = await groupMeService.sendBotMessage(config.botId, reminder.message);
          if (result.success) {
            reminder.status = 'sent';
            reminder.sentAt = new Date().toISOString();
          } else {
            reminder.status = 'failed';
            reminder.error = result.error || 'GroupMe send failed';
          }
        } else {
          reminder.status = 'skipped';
          reminder.error = 'GroupMe not configured';
        }
      } else if (reminder.reminderType === 'driver') {
        // Send driver notification via GroupMe (team channel) and driver notification system
        const config = getGroupMeConfigFromEnv();
        if (config.enabled && config.botId) {
          await groupMeService.sendBotMessage(config.botId, reminder.message);
        }

        // Also create in-app driver notification
        if (reminder.recipientContact && reminder.ticketId) {
          await deliveryWorkflowService.createDriverNotification({
            driverId: reminder.recipientContact,
            driverName: reminder.recipientName,
            ticketId: reminder.ticketId,
            ticketType: 'delivery',
            message: reminder.message,
            priority: 'normal',
          });
        }

        reminder.status = 'sent';
        reminder.sentAt = new Date().toISOString();
      } else if (reminder.reminderType === 'customer') {
        // Send customer notification via SMS + email
        const contact = reminder.recipientContact || '';
        const isEmail = contact.includes('@');
        const isPhone = /^\+?\d[\d\s()-]{7,}/.test(contact);

        let smsSent = false;
        let emailSent = false;

        // Send SMS if contact is a phone number
        if (isPhone) {
          const smsResult = await smsService.sendDeliveryReminder(
            contact,
            reminder.recipientName,
            reminder.scheduledFor,
            undefined, // timeWindow
          );
          smsSent = smsResult.success || false;
        }

        // Send email if contact is an email, or if we have ticket data with customer email
        if (isEmail) {
          const emailResult = await emailService.sendDeliveryReminderEmail({
            customerEmail: contact,
            customerName: reminder.recipientName,
            deliveryDate: reminder.scheduledFor,
            address: '', // Will be populated from ticket if available
          });
          emailSent = emailResult.success;
        }

        // Log to GroupMe for office visibility
        const config = getGroupMeConfigFromEnv();
        if (config.enabled && config.botId) {
          const customerMsg = `[CUSTOMER REMINDER SENT] To: ${reminder.recipientName} (${reminder.recipientContact}) - SMS: ${smsSent ? 'Yes' : 'No'}, Email: ${emailSent ? 'Yes' : 'No'}`;
          await groupMeService.sendBotMessage(config.botId, customerMsg);
        }

        reminder.status = (smsSent || emailSent) ? 'sent' : 'failed';
        reminder.sentAt = new Date().toISOString();
        if (!smsSent && !emailSent) {
          reminder.error = 'Neither SMS nor email could be sent';
        }
      }
    } catch (error) {
      reminder.status = 'failed';
      reminder.error = error instanceof Error ? error.message : 'Unknown error';
    }

    // Persist the reminder
    await this.saveReminder(reminder);
    return reminder;
  }

  async sendBatchReminders(
    targetDate: string,
    trigger: ReminderTrigger,
  ): Promise<{ sent: number; failed: number; skipped: number; reminders: DeliveryReminder[] }> {
    const reminders = await this.generateRemindersForDate(targetDate, trigger);

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const results: DeliveryReminder[] = [];

    for (const reminder of reminders) {
      const result = await this.sendReminder(reminder);
      results.push(result);
      if (result.status === 'sent') sent++;
      else if (result.status === 'failed') failed++;
      else skipped++;
    }

    return { sent, failed, skipped, reminders: results };
  }

  // ============================================
  // PERSISTENCE
  // ============================================

  private async saveReminder(reminder: DeliveryReminder): Promise<void> {
    const sheet = await this.getOrCreateSheet('Delivery Reminders', this.getReminderHeaders());
    await sheet.addRow(reminder as unknown as Record<string, string | number | boolean>);
  }

  async getReminders(filters?: {
    date?: string;
    ticketId?: string;
    type?: ReminderType;
    status?: DeliveryReminder['status'];
  }): Promise<DeliveryReminder[]> {
    const sheet = await this.getOrCreateSheet('Delivery Reminders', this.getReminderHeaders());
    const rows = await sheet.getRows({ limit: 100000 });

    let reminders: DeliveryReminder[] = rows.map(row => ({
      reminderId: row.get('reminderId'),
      ticketId: row.get('ticketId'),
      reminderType: row.get('reminderType') as ReminderType,
      trigger: row.get('trigger') as ReminderTrigger,
      recipientName: row.get('recipientName'),
      recipientContact: row.get('recipientContact'),
      message: row.get('message'),
      scheduledFor: row.get('scheduledFor'),
      status: row.get('status') as DeliveryReminder['status'],
      sentAt: row.get('sentAt'),
      createdAt: row.get('createdAt'),
      error: row.get('error'),
    }));

    if (filters?.date) {
      reminders = reminders.filter(r => r.scheduledFor === filters.date);
    }
    if (filters?.ticketId) {
      reminders = reminders.filter(r => r.ticketId === filters.ticketId);
    }
    if (filters?.type) {
      reminders = reminders.filter(r => r.reminderType === filters.type);
    }
    if (filters?.status) {
      reminders = reminders.filter(r => r.status === filters.status);
    }

    return reminders.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  // ============================================
  // ETA CALCULATION
  // ============================================

  async calculateETAs(driverId: string, date: string): Promise<DeliveryETA[]> {
    const tickets = await deliveryWorkflowService.getTickets({
      driverId,
      date,
    });

    // Only active delivery tickets
    const activeTickets = tickets.filter(t =>
      t.ticketType === 'delivery' &&
      !['completed', 'cancelled'].includes(t.status)
    );

    if (activeTickets.length === 0) return [];

    // Sort by scheduled time
    activeTickets.sort((a, b) =>
      (a.scheduledTime || '').localeCompare(b.scheduledTime || '')
    );

    const now = new Date();
    const etas: DeliveryETA[] = [];

    // Find the first incomplete stop
    let completedCount = 0;
    let baseTime: Date | null = null;

    for (const ticket of activeTickets) {
      if (['delivered', 'proof_captured', 'qc_photos', 'completed'].includes(ticket.status)) {
        completedCount++;
        continue;
      }

      // If driver is en_route to this stop, use departed time as base
      if (ticket.status === 'en_route' && ticket.departedAt) {
        baseTime = new Date(ticket.departedAt);
      }
      break;
    }

    // Calculate ETAs for remaining stops
    let minutesFromBase = 0;
    if (!baseTime) {
      // If no base time, use first scheduled time or now
      const firstScheduledTime = activeTickets.find(t =>
        !['delivered', 'proof_captured', 'qc_photos', 'completed'].includes(t.status)
      )?.scheduledTime;

      if (firstScheduledTime) {
        const [hours, minutes] = firstScheduledTime.split(':').map(Number);
        baseTime = new Date(date + 'T00:00:00');
        baseTime.setHours(hours || 8, minutes || 0, 0, 0);
        // If the scheduled time is in the past, use now
        if (baseTime < now) {
          baseTime = now;
        }
      } else {
        baseTime = now;
      }
    }

    let stopNumber = 0;
    for (const ticket of activeTickets) {
      stopNumber++;

      if (['delivered', 'proof_captured', 'qc_photos', 'completed'].includes(ticket.status)) {
        // Already completed, no ETA needed but include for context
        etas.push({
          ticketId: ticket.ticketId,
          stopNumber,
          totalStops: activeTickets.length,
          estimatedArrival: ticket.deliveredAt || ticket.arrivedAt || '',
          estimatedMinutesAway: 0,
          driverName: ticket.assignedDriverName || '',
          status: ticket.status,
          lastUpdated: new Date().toISOString(),
        });
        continue;
      }

      // For en_route or arrived, ETA is near-real-time
      if (ticket.status === 'arrived') {
        etas.push({
          ticketId: ticket.ticketId,
          stopNumber,
          totalStops: activeTickets.length,
          estimatedArrival: ticket.arrivedAt || new Date().toISOString(),
          estimatedMinutesAway: 0,
          driverName: ticket.assignedDriverName || '',
          status: ticket.status,
          lastUpdated: new Date().toISOString(),
        });
        continue;
      }

      if (ticket.status === 'en_route') {
        // Driver is heading to this stop, estimate 15 min remaining
        const etaMinutes = 15;
        const etaTime = new Date(now.getTime() + etaMinutes * 60 * 1000);
        etas.push({
          ticketId: ticket.ticketId,
          stopNumber,
          totalStops: activeTickets.length,
          estimatedArrival: etaTime.toISOString(),
          estimatedMinutesAway: etaMinutes,
          driverName: ticket.assignedDriverName || '',
          status: ticket.status,
          lastUpdated: new Date().toISOString(),
        });
        minutesFromBase = MINUTES_PER_STOP; // next stop starts after this one
        continue;
      }

      // For pending/assigned/materials_pulled/load_verified stops
      const etaMinutes = Math.max(0, minutesFromBase);
      const etaTime = new Date(baseTime.getTime() + minutesFromBase * 60 * 1000);

      etas.push({
        ticketId: ticket.ticketId,
        stopNumber,
        totalStops: activeTickets.length,
        estimatedArrival: etaTime.toISOString(),
        estimatedMinutesAway: Math.round((etaTime.getTime() - now.getTime()) / 60000),
        driverName: ticket.assignedDriverName || '',
        status: ticket.status,
        lastUpdated: new Date().toISOString(),
      });

      minutesFromBase += MINUTES_PER_STOP;
    }

    return etas;
  }

  // ============================================
  // AUTO-NOTIFICATION ON STATUS CHANGE
  // ============================================

  async sendStatusNotification(
    ticket: DeliveryTicket,
    newStatus: TicketStatus,
  ): Promise<{ sent: boolean; message: string }> {
    let customerMessage = '';
    let groupMeMessage = '';

    switch (newStatus) {
      case 'en_route':
        customerMessage = `Your River City Roofing delivery is on the way! Driver ${ticket.assignedDriverName || ''} is heading to ${ticket.jobAddress}. We'll notify you when they arrive.`;
        groupMeMessage = `[DELIVERY] ${ticket.assignedDriverName || 'Driver'} is en route to ${ticket.jobName} (${ticket.customerName}) at ${ticket.jobAddress}.`;
        break;

      case 'arrived':
        customerMessage = `Your River City Roofing driver has arrived at ${ticket.jobAddress}. Delivery in progress!`;
        groupMeMessage = `[DELIVERY] ${ticket.assignedDriverName || 'Driver'} has arrived at ${ticket.jobName} (${ticket.customerName}).`;
        break;

      case 'delivered':
        customerMessage = `Your RCRS delivery to ${ticket.jobAddress} is complete! Thank you for choosing River City Roofing. Call (256) 274-8530 with any questions.`;
        groupMeMessage = `[DELIVERY] Delivery complete at ${ticket.jobName} (${ticket.customerName}). ${ticket.assignedDriverName || 'Driver'} confirmed.`;
        break;

      case 'proof_captured':
        groupMeMessage = `[DELIVERY] Proof photos captured for ${ticket.jobName} (${ticket.customerName}). ${ticket.assignedDriverName || 'Driver'} verified.`;
        break;

      default:
        return { sent: false, message: 'No notification configured for this status' };
    }

    // Send GroupMe notification (always for office visibility)
    const config = getGroupMeConfigFromEnv();
    if (config.enabled && config.botId && groupMeMessage) {
      try {
        await groupMeService.sendBotMessage(config.botId, groupMeMessage);
      } catch (error) {
        console.error('Failed to send GroupMe status notification:', error);
      }
    }

    // Log customer notification (in production, this would send SMS/email)
    if (customerMessage && ticket.customerPhone) {
      // Log to GroupMe that a customer was notified
      if (config.enabled && config.botId) {
        try {
          const logMsg = `[AUTO-NOTIFY] Customer ${ticket.customerName} (${ticket.customerPhone}) notified: "${customerMessage.substring(0, 100)}..."`;
          await groupMeService.sendBotMessage(config.botId, logMsg);
        } catch (error) {
          console.error('Failed to log customer notification:', error);
        }
      }
    }

    // Save as a reminder record
    const reminder: DeliveryReminder = {
      reminderId: this.generateId('RMD'),
      ticketId: ticket.ticketId,
      reminderType: customerMessage ? 'customer' : 'office',
      trigger: 'status_change',
      recipientName: ticket.customerName,
      recipientContact: ticket.customerPhone || 'office',
      message: customerMessage || groupMeMessage,
      scheduledFor: new Date().toISOString().slice(0, 10),
      status: 'sent',
      sentAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    try {
      await this.saveReminder(reminder);
    } catch (error) {
      console.error('Failed to save status reminder:', error);
    }

    return { sent: true, message: customerMessage || groupMeMessage };
  }

  // ============================================
  // CUSTOMER DELIVERY STATUS
  // ============================================

  getCustomerStatusStage(status: TicketStatus): {
    stage: string;
    label: string;
    progress: number;
    description: string;
  } {
    const stages: Record<string, { stage: string; label: string; progress: number; description: string }> = {
      created: { stage: 'scheduled', label: 'Scheduled', progress: 10, description: 'Your delivery has been scheduled.' },
      assigned: { stage: 'scheduled', label: 'Scheduled', progress: 20, description: 'A driver has been assigned to your delivery.' },
      materials_pulled: { stage: 'materials_pulled', label: 'Materials Pulled', progress: 35, description: 'Materials are being prepared at the warehouse.' },
      load_verified: { stage: 'loading', label: 'Loading', progress: 50, description: 'Materials are being loaded and verified.' },
      en_route: { stage: 'in_transit', label: 'In Transit', progress: 65, description: 'Your delivery is on the way!' },
      arrived: { stage: 'arriving_soon', label: 'Arriving Soon', progress: 85, description: 'Your driver has arrived at your location.' },
      delivered: { stage: 'delivered', label: 'Delivered', progress: 100, description: 'Your delivery is complete!' },
      picked_up: { stage: 'delivered', label: 'Picked Up', progress: 100, description: 'Materials have been picked up.' },
      proof_captured: { stage: 'delivered', label: 'Delivered', progress: 100, description: 'Delivery confirmed with proof.' },
      qc_photos: { stage: 'delivered', label: 'Delivered', progress: 100, description: 'Delivery complete. Quality photos taken.' },
      completed: { stage: 'delivered', label: 'Delivered', progress: 100, description: 'Delivery fully completed.' },
      cancelled: { stage: 'cancelled', label: 'Cancelled', progress: 0, description: 'This delivery has been cancelled.' },
    };

    return stages[status] || stages.created;
  }

  async getCustomerDeliveryStatus(ticketId: string): Promise<{
    ticket: DeliveryTicket;
    statusStage: { stage: string; label: string; progress: number; description: string };
    eta: DeliveryETA | null;
    photos: Array<{ photoUrl: string; description: string; uploadedAt: string }>;
  } | null> {
    const ticket = await deliveryWorkflowService.getTicketById(ticketId);
    if (!ticket) return null;

    const statusStage: { stage: string; label: string; progress: number; description: string } = this.getCustomerStatusStage(ticket.status);

    // Get ETA if driver is assigned and delivery is active
    let eta: DeliveryETA | null = null;
    if (ticket.assignedDriver && !['completed', 'cancelled'].includes(ticket.status)) {
      const etas = await this.calculateETAs(
        ticket.assignedDriver,
        ticket.scheduledDate || new Date().toISOString().slice(0, 10),
      );
      eta = etas.find(e => e.ticketId === ticketId) || null;
    }

    // Get proof-of-delivery photos
    let photos: Array<{ photoUrl: string; description: string; uploadedAt: string }> = [];
    if (['delivered', 'proof_captured', 'qc_photos', 'completed'].includes(ticket.status)) {
      const ticketPhotos = await deliveryWorkflowService.getTicketPhotos(ticketId);
      photos = ticketPhotos
        .filter(p => ['delivery_proof', 'job_site_after'].includes(p.photoType))
        .map(p => ({
          photoUrl: p.photoUrl,
          description: p.description || '',
          uploadedAt: p.uploadedAt,
        }));
    }

    return { ticket, statusStage, eta, photos };
  }
}

export const deliveryReminderService = new DeliveryReminderService();
