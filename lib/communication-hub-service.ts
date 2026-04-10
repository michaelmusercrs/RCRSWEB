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
 * Persistence (2026-04-09): Migrated off local JSON files
 *   - data/communications.json  (events + customer profile cache)
 *   - data/customer-notes.json  (internal team notes per customer)
 * onto the master Google Sheet. To avoid stomping on notification-center, the
 * hub uses SHEET_NAMES.DOCUMENTS for both events and customer profiles,
 * discriminating with a `recordType` column (`event` | `customer`). The tab
 * was previously declared but unused, and `DOCUMENTS` is the nearest
 * semantic fit for a shared communication-events store. Internal notes are
 * written as `type='note'` events in the same tab — the legacy notes JSON is
 * collapsed into the unified event list.
 *
 * Local data/communications.json and data/customer-notes.json remain in place
 * as deprecated dev seeds.
 *
 * @author RCRS Development Team
 * @version 2.0.0
 */

import crypto from 'crypto';
import { callsService, CallRecord } from './calls-service';
import { smsService } from './sms-service';
import { googleSheetsService, SHEET_NAMES } from './google-sheets-service';

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

// =============================================================================
// SHEET SCHEMA
// =============================================================================

/**
 * Unified tab schema. Both events and customer profiles live here, keyed by
 * `id`, with `recordType` discriminating the two shapes.
 */
const COMM_HUB_HEADERS: string[] = [
  'id',
  'recordType',
  // event columns
  'type',
  'timestamp',
  'direction',
  'fromField',
  'toField',
  'subject',
  'body',
  'duration',
  'recordingUrl',
  'attachments',
  'metadata',
  'repId',
  'repName',
  'isRead',
  'jobId',
  'leadId',
  // customer columns
  'customer_name',
  'customer_phone',
  'customer_email',
  'customer_address',
  'customer_jobNimbusId',
  'customer_leadId',
  'customer_jobIds',
  'customer_totalCalls',
  'customer_totalMessages',
  'customer_lastContact',
  'customer_assignedRep',
  'customer_status',
];

const COMM_HUB_TAB = SHEET_NAMES.DOCUMENTS;

// =============================================================================
// PARSING HELPERS
// =============================================================================

function parseBool(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === 'TRUE' || value === '1';
}

function parseNumber(value: string | undefined, fallback = 0): number {
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseJson<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function rowToEvent(row: Record<string, string>): CommunicationEvent {
  return {
    id: row.id,
    type: (row.type || 'note') as CommunicationEventType,
    timestamp: row.timestamp || '',
    direction: row.direction ? (row.direction as 'inbound' | 'outbound') : undefined,
    from: row.fromField || '',
    to: row.toField || '',
    subject: row.subject || undefined,
    body: row.body || '',
    duration: row.duration ? parseNumber(row.duration, 0) : undefined,
    recordingUrl: row.recordingUrl || undefined,
    attachments: row.attachments
      ? parseJson<{ name: string; url: string; type: string }[]>(row.attachments, [])
      : undefined,
    metadata: row.metadata
      ? parseJson<Record<string, string>>(row.metadata, {})
      : undefined,
    repId: row.repId || undefined,
    repName: row.repName || undefined,
    isRead: parseBool(row.isRead, true),
    jobId: row.jobId || undefined,
    leadId: row.leadId || undefined,
  };
}

function eventToRow(e: CommunicationEvent): Record<string, unknown> {
  return {
    id: e.id,
    recordType: 'event',
    type: e.type,
    timestamp: e.timestamp,
    direction: e.direction ?? '',
    fromField: e.from,
    toField: e.to,
    subject: e.subject ?? '',
    body: e.body,
    duration: e.duration ?? '',
    recordingUrl: e.recordingUrl ?? '',
    attachments: e.attachments ? JSON.stringify(e.attachments) : '',
    metadata: e.metadata ? JSON.stringify(e.metadata) : '',
    repId: e.repId ?? '',
    repName: e.repName ?? '',
    isRead: e.isRead,
    jobId: e.jobId ?? '',
    leadId: e.leadId ?? '',
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    customer_address: '',
    customer_jobNimbusId: '',
    customer_leadId: '',
    customer_jobIds: '',
    customer_totalCalls: '',
    customer_totalMessages: '',
    customer_lastContact: '',
    customer_assignedRep: '',
    customer_status: '',
  };
}

function rowToCustomer(row: Record<string, string>): CustomerProfile {
  return {
    id: row.id,
    name: row.customer_name || 'Unknown',
    phone: row.customer_phone || '',
    email: row.customer_email || '',
    address: row.customer_address || '',
    jobNimbusId: row.customer_jobNimbusId || undefined,
    leadId: row.customer_leadId || undefined,
    jobIds: parseJson<string[]>(row.customer_jobIds, []),
    totalCalls: parseNumber(row.customer_totalCalls, 0),
    totalMessages: parseNumber(row.customer_totalMessages, 0),
    lastContact: row.customer_lastContact || '',
    assignedRep: row.customer_assignedRep || '',
    status: row.customer_status || 'active',
  };
}

function customerToRow(c: CustomerProfile): Record<string, unknown> {
  return {
    id: c.id,
    recordType: 'customer',
    type: '',
    timestamp: '',
    direction: '',
    fromField: '',
    toField: '',
    subject: '',
    body: '',
    duration: '',
    recordingUrl: '',
    attachments: '',
    metadata: '',
    repId: '',
    repName: '',
    isRead: '',
    jobId: '',
    leadId: '',
    customer_name: c.name,
    customer_phone: c.phone,
    customer_email: c.email,
    customer_address: c.address,
    customer_jobNimbusId: c.jobNimbusId ?? '',
    customer_leadId: c.leadId ?? '',
    customer_jobIds: JSON.stringify(c.jobIds ?? []),
    customer_totalCalls: c.totalCalls,
    customer_totalMessages: c.totalMessages,
    customer_lastContact: c.lastContact,
    customer_assignedRep: c.assignedRep,
    customer_status: c.status,
  };
}

interface CommHubData {
  events: CommunicationEvent[];
  customers: CustomerProfile[];
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

const CACHE_TTL_MS = 60_000;

class CommunicationHubService {
  // Single unified cache — one sheet read populates both events and customers.
  private cache: CommHubData | null = null;
  private cacheExpiresAt = 0;

  // ---------------------------------------------------------------------------
  // Sheet I/O
  // ---------------------------------------------------------------------------

  private async loadFromSheet(): Promise<CommHubData> {
    const rows = await googleSheetsService.getGenericRows(
      COMM_HUB_TAB,
      COMM_HUB_HEADERS,
    );

    const events: CommunicationEvent[] = [];
    const customers: CustomerProfile[] = [];

    for (const row of rows) {
      if (!row.id) continue;
      if (row.recordType === 'customer') {
        customers.push(rowToCustomer(row));
      } else {
        events.push(rowToEvent(row));
      }
    }

    return { events, customers };
  }

  private async loadCached(): Promise<CommHubData> {
    if (this.cache && Date.now() < this.cacheExpiresAt) return this.cache;
    this.cache = await this.loadFromSheet();
    this.cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return this.cache;
  }

  private invalidateCache(): void {
    this.cache = null;
    this.cacheExpiresAt = 0;
  }

  private async saveEvent(event: CommunicationEvent): Promise<void> {
    await googleSheetsService.upsertGenericRow(
      COMM_HUB_TAB,
      COMM_HUB_HEADERS,
      'id',
      eventToRow(event),
    );
    this.invalidateCache();
  }

  private async saveCustomer(customer: CustomerProfile): Promise<void> {
    await googleSheetsService.upsertGenericRow(
      COMM_HUB_TAB,
      COMM_HUB_HEADERS,
      'id',
      customerToRow(customer),
    );
    this.invalidateCache();
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
  async getCustomerProfile(customerId: string): Promise<CustomerProfile | null> {
    const data = await this.loadCached();
    return data.customers.find((c) => c.id === customerId) || null;
  }

  /**
   * Upsert a customer profile
   */
  async upsertCustomer(profile: Partial<CustomerProfile> & { id: string }): Promise<CustomerProfile> {
    const data = await this.loadCached();
    const existing = data.customers.find((c) => c.id === profile.id);

    const merged: CustomerProfile = existing
      ? { ...existing, ...profile }
      : {
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

    await this.saveCustomer(merged);
    return merged;
  }

  // ---------------------------------------------------------------------------
  // PUBLIC METHODS
  // ---------------------------------------------------------------------------

  /**
   * Get the full communication thread for a customer.
   * Aggregates data from calls, stored events, and notes.
   */
  async getCustomerThread(customerId: string): Promise<CommunicationThread> {
    const data = await this.loadCached();

    // Get or build customer profile
    let customer = data.customers.find((c) => c.id === customerId);
    if (!customer) {
      const allCalls = await callsService.getCalls({ customerId });
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
    const customerCalls = await callsService.getCalls({ customerId });
    for (const call of customerCalls) {
      events.push(this.callToEvent(call));
    }

    // 2. Stored communication events (SMS, email, notes, status changes, etc.)
    //    Notes live here too now (type='note') — data/customer-notes.json is deprecated.
    const storedEvents = data.events.filter(
      (e) => e.metadata?.customerId === customerId,
    );
    events.push(...storedEvents);

    // Sort all events chronologically (newest first)
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Build summary
    const inboundEvents = events.filter((e) => e.direction === 'inbound');
    const outboundEvents = events.filter((e) => e.direction === 'outbound');
    const unreadCount = events.filter((e) => !e.isRead).length;

    // Calculate average response time (time between inbound and next outbound)
    let totalResponseTime = 0;
    let responseCount = 0;
    const sortedAsc = [...events].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
    for (let i = 0; i < sortedAsc.length; i++) {
      if (sortedAsc[i].direction === 'inbound') {
        for (let j = i + 1; j < sortedAsc.length; j++) {
          if (sortedAsc[j].direction === 'outbound') {
            const diff =
              new Date(sortedAsc[j].timestamp).getTime() - new Date(sortedAsc[i].timestamp).getTime();
            totalResponseTime += diff;
            responseCount++;
            break;
          }
        }
      }
    }

    const avgResponseMs = responseCount > 0 ? totalResponseTime / responseCount : 0;
    const avgResponseMinutes = Math.round(avgResponseMs / 60000);

    // Update customer stats
    customer.totalCalls = customerCalls.length;
    customer.totalMessages = events.filter((e) => e.type === 'sms' || e.type === 'email').length;
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
    const now = new Date().toISOString();

    const event: CommunicationEvent = {
      id: this.generateId('NOTE'),
      type: 'note',
      timestamp: now,
      from: author,
      to: customerId,
      body: note,
      repName: author,
      isRead: true,
      metadata: { customerId },
    };

    await this.saveEvent(event);
    return event;
  }

  /**
   * Send a message to a customer via SMS or email.
   */
  async sendMessage(
    customerId: string,
    message: string,
    channel: 'sms' | 'email',
    from: string,
  ): Promise<CommunicationEvent> {
    const data = await this.loadCached();
    const now = new Date().toISOString();
    const customer = data.customers.find((c) => c.id === customerId);

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

    await this.saveEvent(event);
    return event;
  }

  /**
   * Add a communication event directly (for webhooks, integrations, etc.)
   */
  async addEvent(event: Omit<CommunicationEvent, 'id'>): Promise<CommunicationEvent> {
    const newEvent: CommunicationEvent = {
      ...event,
      id: this.generateId('EVT'),
    };

    await this.saveEvent(newEvent);
    return newEvent;
  }

  /**
   * Search customers by name, phone, email, or address.
   */
  async searchCustomers(query: string): Promise<CustomerProfile[]> {
    const data = await this.loadCached();
    const q = query.toLowerCase().trim();

    if (!q) {
      return data.customers.slice(0, 50);
    }

    // Search stored customer profiles
    const matchedCustomers = data.customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        this.normalizePhone(c.phone).includes(this.normalizePhone(q)) ||
        c.phone.includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q),
    );

    // Also search call records for customers not in the profile store
    const allCalls = await callsService.getCalls({ searchQuery: query });
    const callCustomerIds = new Set(matchedCustomers.map((c) => c.id));

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
    const data = await this.loadCached();

    const events: CommunicationEvent[] = [];

    // 1. Stored communication events (includes notes)
    events.push(...data.events);

    // 2. Recent calls
    const recentCalls = await callsService.getRecentCalls(limit);
    for (const call of recentCalls) {
      events.push(this.callToEvent(call));
    }

    // Deduplicate by ID
    const seen = new Set<string>();
    const unique = events.filter((e) => {
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
  async markAsRead(eventId: string): Promise<boolean> {
    const data = await this.loadCached();
    const event = data.events.find((e) => e.id === eventId);
    if (!event) return false;
    if (event.isRead) return true;
    event.isRead = true;
    await this.saveEvent(event);
    return true;
  }

  /**
   * Get all stored customer profiles, sorted by last contact.
   */
  async getAllCustomers(): Promise<CustomerProfile[]> {
    const data = await this.loadCached();
    return [...data.customers].sort(
      (a, b) => new Date(b.lastContact).getTime() - new Date(a.lastContact).getTime(),
    );
  }

  /**
   * Get unread event count for a customer.
   */
  async getUnreadCount(customerId: string): Promise<number> {
    const data = await this.loadCached();
    return data.events.filter(
      (e) => e.metadata?.customerId === customerId && !e.isRead,
    ).length;
  }
}

// Export singleton instance
export const communicationHubService = new CommunicationHubService();
