/**
 * RCRS Communication Hub Service
 *
 * Aggregates all customer communication channels into a unified timeline:
 * - Calls (from calls-service / data/calls.json)
 * - SMS messages
 * - Email
 * - Internal notes
 * - Voicemails
 * - Status changes
 * - Appointments
 * - Documents
 *
 * Stores supplemental data in:
 * - data/communications.json (communication events not covered by other services)
 * - data/customer-notes.json (internal team notes per customer)
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { callsService, CallRecord } from './calls-service';
import { smsService } from './sms-service';

// =============================================================================
// TYPES
// =============================================================================

export type CommunicationEventType =
  | 'call'
  | 'sms'
  | 'email'
  | 'note'
  | 'voicemail'
  | 'document'
  | 'status_change'
  | 'appointment';

export interface CommunicationEvent {
  /** Unique event identifier */
  id: string;
  /** Event type */
  type: CommunicationEventType;
  /** ISO timestamp of the event */
  timestamp: string;
  /** Direction for calls/messages */
  direction?: 'inbound' | 'outbound';
  /** Who originated the event */
  from: string;
  /** Who received the event */
  to: string;
  /** Subject line (for emails) */
  subject?: string;
  /** Event body/content */
  body: string;
  /** Duration in seconds (for calls) */
  duration?: number;
  /** URL to call recording */
  recordingUrl?: string;
  /** File attachments */
  attachments?: { name: string; url: string; type: string }[];
  /** Arbitrary metadata */
  metadata?: Record<string, string>;
  /** Sales rep ID who handled the event */
  repId?: string;
  /** Sales rep name */
  repName?: string;
  /** Whether the event has been read/acknowledged */
  isRead: boolean;
  /** Associated job ID */
  jobId?: string;
  /** Associated lead ID */
  leadId?: string;
}

export interface CustomerProfile {
  /** Customer ID */
  id: string;
  /** Full name */
  name: string;
  /** Phone number */
  phone: string;
  /** Email address */
  email: string;
  /** Street address */
  address: string;
  /** JobNimbus contact ID */
  jobNimbusId?: string;
  /** Lead ID */
  leadId?: string;
  /** Associated job IDs */
  jobIds: string[];
  /** Total call count */
  totalCalls: number;
  /** Total message count */
  totalMessages: number;
  /** ISO timestamp of last contact */
  lastContact: string;
  /** Assigned sales rep name */
  assignedRep: string;
  /** Customer status */
  status: string;
}

export interface CommunicationThread {
  /** Customer profile */
  customer: CustomerProfile;
  /** All communication events sorted by time */
  events: CommunicationEvent[];
  /** Thread summary stats */
  summary: {
    totalInteractions: number;
    lastInbound: string;
    lastOutbound: string;
    avgResponseTime: number;
    openItems: number;
  };
}

interface CommunicationsData {
  events: CommunicationEvent[];
  customers: CustomerProfile[];
  lastUpdated: string;
}

interface CustomerNotesData {
  notes: {
    id: string;
    customerId: string;
    note: string;
    author: string;
    createdAt: string;
    updatedAt: string;
  }[];
  lastUpdated: string;
}

// =============================================================================
// DATA PATHS
// =============================================================================

const COMMS_FILE_PATH = path.join(process.cwd(), 'data', 'communications.json');
const NOTES_FILE_PATH = path.join(process.cwd(), 'data', 'customer-notes.json');

// =============================================================================
// SERVICE CLASS
// =============================================================================

class CommunicationHubService {
  // ---------------------------------------------------------------------------
  // Data I/O
  // ---------------------------------------------------------------------------

  private readCommsData(): CommunicationsData {
    try {
      if (fs.existsSync(COMMS_FILE_PATH)) {
        const content = fs.readFileSync(COMMS_FILE_PATH, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('Error reading communications data:', error);
    }
    return { events: [], customers: [], lastUpdated: new Date().toISOString() };
  }

  private writeCommsData(data: CommunicationsData): void {
    try {
      const dir = path.dirname(COMMS_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      data.lastUpdated = new Date().toISOString();
      fs.writeFileSync(COMMS_FILE_PATH, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error writing communications data:', error);
      throw error;
    }
  }

  private readNotesData(): CustomerNotesData {
    try {
      if (fs.existsSync(NOTES_FILE_PATH)) {
        const content = fs.readFileSync(NOTES_FILE_PATH, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('Error reading customer notes data:', error);
    }
    return { notes: [], lastUpdated: new Date().toISOString() };
  }

  private writeNotesData(data: CustomerNotesData): void {
    try {
      const dir = path.dirname(NOTES_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      data.lastUpdated = new Date().toISOString();
      fs.writeFileSync(NOTES_FILE_PATH, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error writing customer notes data:', error);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // ID generation
  // ---------------------------------------------------------------------------

  private generateId(prefix: string = 'EVT'): string {
    return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
  }

  // ---------------------------------------------------------------------------
  // Phone normalization
  // ---------------------------------------------------------------------------

  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '').replace(/^1/, '');
  }

  private formatPhoneDisplay(phone: string): string {
    const digits = this.normalizePhone(phone);
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  }

  // ---------------------------------------------------------------------------
  // Call record -> CommunicationEvent conversion
  // ---------------------------------------------------------------------------

  private callToEvent(call: CallRecord): CommunicationEvent {
    const eventType: CommunicationEventType =
      call.status === 'voicemail' ? 'voicemail' : 'call';

    return {
      id: call.callId,
      type: eventType,
      timestamp: call.startTime,
      direction: call.direction,
      from: call.direction === 'inbound' ? call.customerName || call.customerPhone : (call.repName || 'RCRS'),
      to: call.direction === 'inbound' ? (call.repName || 'RCRS') : (call.customerName || call.customerPhone),
      body: call.notes || `${call.direction === 'inbound' ? 'Incoming' : 'Outgoing'} call - ${call.status} (${this.formatDuration(call.duration)})`,
      duration: call.duration,
      recordingUrl: call.recordingUrl || undefined,
      repId: call.repId || undefined,
      repName: call.repName || undefined,
      isRead: true,
      metadata: {
        status: call.status,
        extension: call.repExtension || '',
        phone: call.customerPhone,
      },
    };
  }

  private formatDuration(seconds: number): string {
    if (!seconds || seconds === 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ---------------------------------------------------------------------------
  // Customer profile management
  // ---------------------------------------------------------------------------

  /**
   * Get or create a customer profile by ID
   */
  getCustomerProfile(customerId: string): CustomerProfile | null {
    const data = this.readCommsData();
    return data.customers.find(c => c.id === customerId) || null;
  }

  /**
   * Upsert a customer profile
   */
  upsertCustomer(profile: Partial<CustomerProfile> & { id: string }): CustomerProfile {
    const data = this.readCommsData();
    const index = data.customers.findIndex(c => c.id === profile.id);

    if (index >= 0) {
      data.customers[index] = { ...data.customers[index], ...profile };
      this.writeCommsData(data);
      return data.customers[index];
    }

    const newCustomer: CustomerProfile = {
      id: profile.id,
      name: profile.name || 'Unknown',
      phone: profile.phone || '',
      email: profile.email || '',
      address: profile.address || '',
      jobNimbusId: profile.jobNimbusId,
      leadId: profile.leadId,
      jobIds: profile.jobIds || [],
      totalCalls: profile.totalCalls || 0,
      totalMessages: profile.totalMessages || 0,
      lastContact: profile.lastContact || new Date().toISOString(),
      assignedRep: profile.assignedRep || '',
      status: profile.status || 'active',
    };

    data.customers.push(newCustomer);
    this.writeCommsData(data);
    return newCustomer;
  }

  // ---------------------------------------------------------------------------
  // PUBLIC METHODS
  // ---------------------------------------------------------------------------

  /**
   * Get the full communication thread for a customer.
   * Aggregates data from calls, stored events, and notes.
   */
  async getCustomerThread(customerId: string): Promise<CommunicationThread> {
    const commsData = this.readCommsData();
    const notesData = this.readNotesData();

    // Get or build customer profile
    let customer = commsData.customers.find(c => c.id === customerId);
    if (!customer) {
      // Try to build a profile from call records
      const allCalls = callsService.getCalls({ customerId });
      const firstCall = allCalls[0];
      customer = {
        id: customerId,
        name: firstCall?.customerName || 'Unknown Customer',
        phone: firstCall?.customerPhone || '',
        email: firstCall?.customerEmail || '',
        address: '',
        jobIds: [],
        totalCalls: allCalls.length,
        totalMessages: 0,
        lastContact: firstCall?.startTime || new Date().toISOString(),
        assignedRep: firstCall?.repName || '',
        status: 'active',
      };
    }

    // Gather events from all sources
    const events: CommunicationEvent[] = [];

    // 1. Call records -> events
    const customerCalls = callsService.getCalls({ customerId });
    for (const call of customerCalls) {
      events.push(this.callToEvent(call));
    }

    // 2. Stored communication events (SMS, email, status changes, etc.)
    const storedEvents = commsData.events.filter(
      e => e.metadata?.customerId === customerId
    );
    events.push(...storedEvents);

    // 3. Internal notes -> note events
    const customerNotes = notesData.notes.filter(n => n.customerId === customerId);
    for (const note of customerNotes) {
      events.push({
        id: note.id,
        type: 'note',
        timestamp: note.createdAt,
        from: note.author,
        to: customer.name,
        body: note.note,
        repName: note.author,
        isRead: true,
        metadata: { customerId },
      });
    }

    // Sort all events chronologically (newest first)
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Build summary
    const inboundEvents = events.filter(e => e.direction === 'inbound');
    const outboundEvents = events.filter(e => e.direction === 'outbound');
    const unreadCount = events.filter(e => !e.isRead).length;

    // Calculate average response time (time between inbound and next outbound)
    let totalResponseTime = 0;
    let responseCount = 0;
    const sortedAsc = [...events].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    for (let i = 0; i < sortedAsc.length; i++) {
      if (sortedAsc[i].direction === 'inbound') {
        // Find the next outbound event
        for (let j = i + 1; j < sortedAsc.length; j++) {
          if (sortedAsc[j].direction === 'outbound') {
            const diff = new Date(sortedAsc[j].timestamp).getTime() - new Date(sortedAsc[i].timestamp).getTime();
            totalResponseTime += diff;
            responseCount++;
            break;
          }
        }
      }
    }

    const avgResponseMs = responseCount > 0 ? totalResponseTime / responseCount : 0;
    // Convert to minutes
    const avgResponseMinutes = Math.round(avgResponseMs / 60000);

    // Update customer stats
    customer.totalCalls = customerCalls.length;
    customer.totalMessages = events.filter(e => e.type === 'sms' || e.type === 'email').length;
    if (events.length > 0) {
      customer.lastContact = events[0].timestamp;
    }

    return {
      customer,
      events,
      summary: {
        totalInteractions: events.length,
        lastInbound: inboundEvents[0]?.timestamp || '',
        lastOutbound: outboundEvents[0]?.timestamp || '',
        avgResponseTime: avgResponseMinutes,
        openItems: unreadCount,
      },
    };
  }

  /**
   * Add an internal note to a customer's timeline.
   */
  async addNote(customerId: string, note: string, author: string): Promise<CommunicationEvent> {
    const notesData = this.readNotesData();
    const now = new Date().toISOString();

    const newNote = {
      id: this.generateId('NOTE'),
      customerId,
      note,
      author,
      createdAt: now,
      updatedAt: now,
    };

    notesData.notes.unshift(newNote);
    this.writeNotesData(notesData);

    // Also store as a communication event for the timeline
    const event: CommunicationEvent = {
      id: newNote.id,
      type: 'note',
      timestamp: now,
      from: author,
      to: customerId,
      body: note,
      repName: author,
      isRead: true,
      metadata: { customerId },
    };

    return event;
  }

  /**
   * Send a message to a customer via SMS or email.
   */
  async sendMessage(
    customerId: string,
    message: string,
    channel: 'sms' | 'email',
    from: string
  ): Promise<CommunicationEvent> {
    const commsData = this.readCommsData();
    const now = new Date().toISOString();
    const customer = commsData.customers.find(c => c.id === customerId);

    const event: CommunicationEvent = {
      id: this.generateId('MSG'),
      type: channel,
      timestamp: now,
      direction: 'outbound',
      from,
      to: customer?.name || customerId,
      body: message,
      repName: from,
      isRead: true,
      metadata: {
        customerId,
        channel,
        status: 'pending',
      },
    };

    // Attempt to send via the appropriate channel
    if (channel === 'sms' && customer?.phone) {
      try {
        const result = await smsService.send(customer.phone, message);
        event.metadata!.status = result.success ? 'sent' : 'failed';
        if (!result.success) {
          event.metadata!.error = result.error || 'Unknown SMS error';
        }
      } catch (error) {
        event.metadata!.status = 'failed';
        event.metadata!.error = error instanceof Error ? error.message : 'SMS send failed';
      }
    } else if (channel === 'email') {
      // Email sending would integrate with email-service
      // For now, mark as queued
      event.metadata!.status = 'queued';
    }

    // Store the event
    commsData.events.unshift(event);
    this.writeCommsData(commsData);

    return event;
  }

  /**
   * Add a communication event directly (for webhooks, integrations, etc.)
   */
  addEvent(event: Omit<CommunicationEvent, 'id'>): CommunicationEvent {
    const commsData = this.readCommsData();

    const newEvent: CommunicationEvent = {
      ...event,
      id: this.generateId('EVT'),
    };

    commsData.events.unshift(newEvent);
    this.writeCommsData(commsData);

    return newEvent;
  }

  /**
   * Search customers by name, phone, email, or address.
   */
  async searchCustomers(query: string): Promise<CustomerProfile[]> {
    const commsData = this.readCommsData();
    const q = query.toLowerCase().trim();

    if (!q) {
      return commsData.customers.slice(0, 50);
    }

    // Search stored customer profiles
    const matchedCustomers = commsData.customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      this.normalizePhone(c.phone).includes(this.normalizePhone(q)) ||
      c.phone.includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.address.toLowerCase().includes(q)
    );

    // Also search call records for customers not in the profile store
    const allCalls = callsService.getCalls({ searchQuery: query });
    const callCustomerIds = new Set(matchedCustomers.map(c => c.id));

    // Build profiles from call data for unmatched customers
    const callCustomerMap = new Map<string, CallRecord[]>();
    for (const call of allCalls) {
      if (call.customerId && !callCustomerIds.has(call.customerId)) {
        const existing = callCustomerMap.get(call.customerId) || [];
        existing.push(call);
        callCustomerMap.set(call.customerId, existing);
      }
    }

    for (const [custId, calls] of callCustomerMap.entries()) {
      const latest = calls[0];
      matchedCustomers.push({
        id: custId,
        name: latest.customerName || 'Unknown',
        phone: latest.customerPhone,
        email: latest.customerEmail || '',
        address: '',
        jobIds: [],
        totalCalls: calls.length,
        totalMessages: 0,
        lastContact: latest.startTime,
        assignedRep: latest.repName || '',
        status: 'active',
      });
    }

    return matchedCustomers;
  }

  /**
   * Get recent activity across all customers.
   */
  async getRecentActivity(limit: number = 50): Promise<CommunicationEvent[]> {
    const commsData = this.readCommsData();
    const notesData = this.readNotesData();

    const events: CommunicationEvent[] = [];

    // 1. Stored communication events
    events.push(...commsData.events);

    // 2. Recent calls
    const recentCalls = callsService.getRecentCalls(limit);
    for (const call of recentCalls) {
      events.push(this.callToEvent(call));
    }

    // 3. Recent notes
    const recentNotes = notesData.notes.slice(0, limit);
    for (const note of recentNotes) {
      events.push({
        id: note.id,
        type: 'note',
        timestamp: note.createdAt,
        from: note.author,
        to: note.customerId,
        body: note.note,
        repName: note.author,
        isRead: true,
        metadata: { customerId: note.customerId },
      });
    }

    // Deduplicate by ID
    const seen = new Set<string>();
    const unique = events.filter(e => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });

    // Sort newest first and limit
    unique.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return unique.slice(0, limit);
  }

  /**
   * Mark a communication event as read.
   */
  markAsRead(eventId: string): boolean {
    const commsData = this.readCommsData();
    const index = commsData.events.findIndex(e => e.id === eventId);
    if (index >= 0) {
      commsData.events[index].isRead = true;
      this.writeCommsData(commsData);
      return true;
    }
    return false;
  }

  /**
   * Get all stored customer profiles, sorted by last contact.
   */
  getAllCustomers(): CustomerProfile[] {
    const commsData = this.readCommsData();
    return [...commsData.customers].sort(
      (a, b) => new Date(b.lastContact).getTime() - new Date(a.lastContact).getTime()
    );
  }

  /**
   * Get unread event count for a customer.
   */
  getUnreadCount(customerId: string): number {
    const commsData = this.readCommsData();
    return commsData.events.filter(
      e => e.metadata?.customerId === customerId && !e.isRead
    ).length;
  }
}

// Export singleton instance
export const communicationHubService = new CommunicationHubService();
