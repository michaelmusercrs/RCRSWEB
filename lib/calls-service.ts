/**
 * RCRS Call Recording Service
 *
 * Manages call data storage, retrieval, and integration with:
 * - Google Voice PBX bridge
 * - Customer portal
 * - JobNimbus contacts
 *
 * Persistence: Google Sheets (Calls tab) via google-sheets-service.
 * The local data/calls.json file is kept as a deprecated dev seed only.
 *
 * @author RCRS Development Team
 * @version 2.0.0
 */

import crypto from 'crypto';
import { googleSheetsService, SHEET_NAMES } from './google-sheets-service';
import {
  seedForExtension,
  isBusinessHours,
  type CallStage,
  type AnsweredVia,
} from './phone-system-config';

// =============================================================================
// TYPES
// =============================================================================

export type CallDirection = 'inbound' | 'outbound';
export type CallStatus = 'ringing' | 'in_progress' | 'completed' | 'missed' | 'voicemail' | 'failed';

/** One CDR leg of an aggregated call (an extension that rang, a GV leg, etc.). */
export interface CallLeg {
  /** Asterisk per-leg uniqueid */
  uniqueid: string;
  channel: string;
  /** Destination of this leg (extension, GV number, or answering service) */
  dst: string;
  dstType: 'ext' | 'gv' | 'answering_service' | 'other';
  disposition: string;
  billsec: number;
  /** Leg start (ISO UTC) */
  start: string;
}

export interface CallRecord {
  /** Unique call identifier */
  callId: string;
  /** Customer ID (if known) */
  customerId: string;
  /** Customer name (from caller ID or database lookup) */
  customerName: string;
  /** Caller/callee phone number */
  customerPhone: string;
  /** Customer email (if known) */
  customerEmail: string;
  /** Sales rep/employee ID */
  repId: string;
  /** Rep name */
  repName: string;
  /** Extension that handled the call */
  repExtension: string;
  /** Call direction */
  direction: CallDirection;
  /** Call status */
  status: CallStatus;
  /** Call start timestamp (ISO string) */
  startTime: string;
  /** Call end timestamp (ISO string) */
  endTime: string;
  /** Call duration in seconds */
  duration: number;
  /** URL to call recording (if available) */
  recordingUrl: string;
  /** Whether recording is available */
  recordingAvailable: boolean;
  /** Notes added by rep */
  notes: string;
  /** Tags for categorization */
  tags: string[];
  /** JobNimbus contact ID (for integration) */
  jobNimbusContactId: string;
  // --- FreePBX bridge enrichment (optional; absent on legacy/manual rows) ---
  /** Asterisk linkedid grouping every leg of this call */
  linkedid?: string;
  /** Ring stage that resolved the call (stage1|stage2|overflow|afterhours) */
  stage?: CallStage | '';
  /** How the call was ultimately answered */
  answeredVia?: AnsweredVia;
  /** Raw CDR disposition (ANSWERED | NO ANSWER | BUSY | FAILED) */
  disposition?: string;
  /** Whether the call arrived inside published business hours (Central) */
  inBusinessHours?: boolean;
  /** Per-leg breakdown: which extensions rang, who answered, via desk/GV */
  legs?: CallLeg[];
  /** Private Blob pathname of the recording (NOT a public URL) */
  recordingPath?: string;
  /** Record creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

export interface CallStats {
  totalCalls: number;
  totalDuration: number;
  inboundCalls: number;
  outboundCalls: number;
  missedCalls: number;
  completedCalls: number;
  averageDuration: number;
  lastUpdated: string;
}

export interface CallsData {
  calls: CallRecord[];
  callStats: CallStats;
}

export interface WebhookPayload {
  /** Event type from phone system */
  event: 'call_start' | 'call_end' | 'call_missed' | 'voicemail' | 'recording_ready';
  /**
   * Bridge identity. When `source === 'freepbx-bridge'` the aggregated,
   * idempotent path runs (one event per real call, keyed by linkedid) instead
   * of the legacy per-leg call_start/call_end sequencing.
   */
  source?: 'freepbx-bridge' | string;
  /** Call unique ID from phone system (legacy) */
  callUuid?: string;
  /** Asterisk linkedid — the call-group key the bridge dedups on */
  linkedid?: string;
  /** Caller phone number */
  from: string;
  /** Callee phone number */
  to: string;
  /** Answering / handling extension */
  extension?: string;
  /** Call direction */
  direction: 'inbound' | 'outbound';
  /** Talk time in seconds (billsec of the answered leg) */
  duration?: number;
  /** Recording URL (legacy) */
  recordingUrl?: string;
  /** Private Blob pathname of the recording (bridge) */
  recordingPath?: string;
  /** Call start timestamp (ISO UTC; bridge converts CDR calldate from Central) */
  timestamp: string;
  /** Caller ID name if available */
  callerIdName?: string;
  // --- bridge aggregated fields ---
  stage?: CallStage;
  answeredVia?: AnsweredVia;
  disposition?: string;
  inBusinessHours?: boolean;
  legs?: CallLeg[];
  // --- voicemail events ---
  vmExtension?: string;
  vmMsgId?: string;
  vmOrigTime?: string;
  vmDuration?: number;
  transcription?: string;
}

export interface CallFilter {
  customerId?: string;
  customerPhone?: string;
  repId?: string;
  repExtension?: string;
  direction?: CallDirection;
  status?: CallStatus;
  startDate?: string;
  endDate?: string;
  tags?: string[];
  searchQuery?: string;
}

export interface CallAnalytics {
  /** Calls grouped by day */
  dailyVolume: { date: string; count: number; duration: number }[];
  /** Calls grouped by rep */
  byRep: { repId: string; repName: string; count: number; avgDuration: number }[];
  /** Calls grouped by status */
  byStatus: { status: string; count: number }[];
  /** Peak hours */
  peakHours: { hour: number; count: number }[];
  /** Average response time */
  avgResponseTime: number;
}

// =============================================================================
// SHEET SCHEMA
// =============================================================================

const CALL_HEADERS: string[] = [
  'callId',
  'customerId',
  'customerName',
  'customerPhone',
  'customerEmail',
  'repId',
  'repName',
  'repExtension',
  'direction',
  'status',
  'startTime',
  'endTime',
  'duration',
  'recordingUrl',
  'recordingAvailable',
  'notes',
  'tags',
  'jobNimbusContactId',
  'linkedid',
  'stage',
  'answeredVia',
  'disposition',
  'inBusinessHours',
  'legsJson',
  'recordingPath',
  'createdAt',
  'updatedAt',
];

// =============================================================================
// SERVICE CLASS
// =============================================================================

class CallsService {
  private cache: CallRecord[] | null = null;
  private cacheExpiresAt = 0;
  private readonly CACHE_TTL_MS = 60_000;

  // ---------------------------------------------------------------------------
  // Sheet I/O
  // ---------------------------------------------------------------------------

  private parseCallRow(row: Record<string, string>): CallRecord {
    let tags: string[] = [];
    try {
      tags = row.tags ? JSON.parse(row.tags) : [];
      if (!Array.isArray(tags)) tags = [];
    } catch {
      tags = row.tags ? row.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    }

    let legs: CallLeg[] = [];
    try {
      legs = row.legsJson ? JSON.parse(row.legsJson) : [];
      if (!Array.isArray(legs)) legs = [];
    } catch {
      legs = [];
    }

    const ibh = row.inBusinessHours;

    return {
      callId: row.callId || '',
      customerId: row.customerId || '',
      customerName: row.customerName || '',
      customerPhone: row.customerPhone || '',
      customerEmail: row.customerEmail || '',
      repId: row.repId || '',
      repName: row.repName || '',
      repExtension: row.repExtension || '',
      direction: (row.direction as CallDirection) || 'inbound',
      status: (row.status as CallStatus) || 'completed',
      startTime: row.startTime || '',
      endTime: row.endTime || '',
      duration: Number(row.duration) || 0,
      recordingUrl: row.recordingUrl || '',
      recordingAvailable: row.recordingAvailable === 'true',
      notes: row.notes || '',
      tags,
      jobNimbusContactId: row.jobNimbusContactId || '',
      linkedid: row.linkedid || '',
      stage: (row.stage as CallStage) || '',
      answeredVia: (row.answeredVia as AnsweredVia) || null,
      disposition: row.disposition || '',
      inBusinessHours: ibh === undefined || ibh === '' ? undefined : ibh === 'true',
      legs,
      recordingPath: row.recordingPath || '',
      createdAt: row.createdAt || '',
      updatedAt: row.updatedAt || '',
    };
  }

  private async loadFromSheet(): Promise<CallRecord[]> {
    const rows = await googleSheetsService.getGenericRows(SHEET_NAMES.CALLS, CALL_HEADERS);
    return rows.map(r => this.parseCallRow(r));
  }

  private async loadCached(): Promise<CallRecord[]> {
    if (this.cache && Date.now() < this.cacheExpiresAt) return this.cache;
    this.cache = await this.loadFromSheet();
    this.cacheExpiresAt = Date.now() + this.CACHE_TTL_MS;
    return this.cache;
  }

  private invalidateCache(): void {
    this.cache = null;
    this.cacheExpiresAt = 0;
  }

  private async upsertCall(call: CallRecord): Promise<void> {
    // Build an explicit, header-aligned row: arrays/objects → JSON strings,
    // optionals coalesced to '' so undefined never serializes as "undefined".
    const row: Record<string, unknown> = {
      ...call,
      tags: JSON.stringify(call.tags || []),
      legsJson: JSON.stringify(call.legs || []),
      recordingAvailable: String(call.recordingAvailable),
      linkedid: call.linkedid || '',
      stage: call.stage || '',
      answeredVia: call.answeredVia || '',
      disposition: call.disposition || '',
      inBusinessHours: call.inBusinessHours === undefined ? '' : String(call.inBusinessHours),
      recordingPath: call.recordingPath || '',
    };
    delete (row as Record<string, unknown>).legs; // 'legs' has no column; stored as legsJson
    await googleSheetsService.upsertGenericRow(
      SHEET_NAMES.CALLS,
      CALL_HEADERS,
      'callId',
      row,
    );
    this.invalidateCache();
  }

  private computeStats(calls: CallRecord[]): CallStats {
    const completedCount = calls.filter(c => c.status === 'completed').length;
    return {
      totalCalls: calls.length,
      totalDuration: calls.reduce((sum, c) => sum + c.duration, 0),
      inboundCalls: calls.filter(c => c.direction === 'inbound').length,
      outboundCalls: calls.filter(c => c.direction === 'outbound').length,
      missedCalls: calls.filter(c => c.status === 'missed').length,
      completedCalls: completedCount,
      averageDuration: completedCount > 0
        ? Math.round(calls.reduce((sum, c) => sum + c.duration, 0) / completedCount)
        : 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Generate unique call ID (legacy manual/outbound records only).
   */
  generateCallId(): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `CALL-${timestamp}-${random}`;
  }

  /**
   * Deterministic call ID derived from Asterisk linkedid. Same call → same id,
   * which makes every bridge event an idempotent upsert (no correlation lookup,
   * no duplicate rows on webhook redelivery).
   */
  deterministicCallId(key: string): string {
    const safe = String(key || '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `CALL-${safe || 'unknown'}`;
  }

  /**
   * Format phone number for storage (digits only)
   */
  normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '').replace(/^1/, '');
  }

  /**
   * Format phone for display
   */
  formatPhoneDisplay(phone: string): string {
    const digits = this.normalizePhone(phone);
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  }

  /**
   * Format duration for display
   */
  formatDuration(seconds: number): string {
    if (seconds === 0) return '0:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  // ===========================================================================
  // PUBLIC METHODS
  // ===========================================================================

  /**
   * Process incoming webhook from phone system
   */
  async processWebhook(payload: WebhookPayload): Promise<CallRecord> {
    // FreePBX bridge → aggregated, idempotent path (one event per real call).
    if (payload.source === 'freepbx-bridge') {
      return this.processBridgeEvent(payload);
    }

    const calls = await this.loadCached();
    const now = new Date().toISOString();

    // Find existing call record for this UUID (legacy path)
    const existing = payload.callUuid
      ? calls.find(c => c.callId.includes(payload.callUuid as string))
      : undefined;

    if (payload.event === 'call_start') {
      // Create new call record
      const newCall: CallRecord = {
        callId: this.generateCallId(),
        customerId: '',
        customerName: payload.callerIdName || 'Unknown Caller',
        customerPhone: this.normalizePhone(payload.direction === 'inbound' ? payload.from : payload.to),
        customerEmail: '',
        repId: '',
        repName: '',
        repExtension: payload.extension || '',
        direction: payload.direction,
        status: 'ringing',
        startTime: payload.timestamp,
        endTime: '',
        duration: 0,
        recordingUrl: '',
        recordingAvailable: false,
        notes: '',
        tags: [],
        jobNimbusContactId: '',
        createdAt: now,
        updatedAt: now,
      };

      // Try to match customer by phone
      const matchedCustomer = await this.findCustomerByPhone(newCall.customerPhone);
      if (matchedCustomer) {
        newCall.customerId = matchedCustomer.customerId;
        newCall.customerName = matchedCustomer.customerName;
        newCall.customerEmail = matchedCustomer.customerEmail || '';
      }

      // Try to match rep by extension
      const matchedRep = this.findRepByExtension(payload.extension || '');
      if (matchedRep) {
        newCall.repId = matchedRep.userId || '';
        newCall.repName = matchedRep.name;
      }

      await this.upsertCall(newCall);
      return newCall;
    }

    if (payload.event === 'call_end' && existing) {
      const updated: CallRecord = {
        ...existing,
        status: 'completed',
        endTime: payload.timestamp,
        duration: payload.duration || 0,
        updatedAt: now,
      };
      await this.upsertCall(updated);
      return updated;
    }

    if (payload.event === 'call_missed') {
      if (existing) {
        const updated: CallRecord = {
          ...existing,
          status: 'missed',
          endTime: payload.timestamp,
          updatedAt: now,
        };
        await this.upsertCall(updated);
        return updated;
      }
      const missedCall: CallRecord = {
        callId: this.generateCallId(),
        customerId: '',
        customerName: payload.callerIdName || 'Unknown Caller',
        customerPhone: this.normalizePhone(payload.from),
        customerEmail: '',
        repId: '',
        repName: '',
        repExtension: payload.extension || '',
        direction: 'inbound',
        status: 'missed',
        startTime: payload.timestamp,
        endTime: payload.timestamp,
        duration: 0,
        recordingUrl: '',
        recordingAvailable: false,
        notes: '',
        tags: ['missed'],
        jobNimbusContactId: '',
        createdAt: now,
        updatedAt: now,
      };
      await this.upsertCall(missedCall);
      return missedCall;
    }

    if (payload.event === 'voicemail' && existing) {
      const updated: CallRecord = {
        ...existing,
        status: 'voicemail',
        endTime: payload.timestamp,
        updatedAt: now,
      };
      await this.upsertCall(updated);
      return updated;
    }

    if (payload.event === 'recording_ready' && existing) {
      const updated: CallRecord = {
        ...existing,
        recordingUrl: payload.recordingUrl || '',
        recordingAvailable: !!payload.recordingUrl,
        updatedAt: now,
      };
      await this.upsertCall(updated);
      return updated;
    }

    // Return a default response if no matching case
    return calls[0] || {
      callId: '',
      customerId: '',
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      repId: '',
      repName: '',
      repExtension: '',
      direction: 'inbound',
      status: 'failed',
      startTime: now,
      endTime: now,
      duration: 0,
      recordingUrl: '',
      recordingAvailable: false,
      notes: '',
      tags: [],
      jobNimbusContactId: '',
      createdAt: now,
      updatedAt: now,
    };
  }

  /** Blank record shell used when a bridge event arrives before its siblings. */
  private emptyRecord(callId: string, now: string): CallRecord {
    return {
      callId,
      customerId: '',
      customerName: 'Unknown Caller',
      customerPhone: '',
      customerEmail: '',
      repId: '',
      repName: '',
      repExtension: '',
      direction: 'inbound',
      status: 'completed',
      startTime: now,
      endTime: '',
      duration: 0,
      recordingUrl: '',
      recordingAvailable: false,
      notes: '',
      tags: [],
      jobNimbusContactId: '',
      linkedid: '',
      stage: '',
      answeredVia: null,
      disposition: '',
      inBusinessHours: undefined,
      legs: [],
      recordingPath: '',
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * FreePBX bridge event handler — aggregated + idempotent.
   *
   * One real inbound call produces ~10 CDR legs (each rung extension, each
   * Google Voice leg, the answering-service leg). The bridge collapses them by
   * Asterisk linkedid and sends ONE event per call. We key the record on a
   * deterministic callId derived from linkedid, so:
   *   - redelivery is safe (upsert, never a duplicate row)
   *   - recording_ready / voicemail can arrive before or after the call event
   *     and still land on the same record (create-or-update, no correlation
   *     lookup — this is the bug the legacy path had)
   */
  private async processBridgeEvent(payload: WebhookPayload): Promise<CallRecord> {
    const now = new Date().toISOString();
    const key = payload.linkedid || payload.callUuid || '';
    const callId = this.deterministicCallId(key);
    const calls = await this.loadCached();
    const existing = calls.find(c => c.callId === callId) || null;
    const base: CallRecord = existing ? { ...existing } : this.emptyRecord(callId, now);
    base.linkedid = key;
    base.updatedAt = now;
    if (!existing) base.createdAt = now;

    // recording_ready — attach the recording, leave call fields untouched.
    if (payload.event === 'recording_ready') {
      base.recordingPath = payload.recordingPath || base.recordingPath || '';
      base.recordingUrl = payload.recordingUrl || base.recordingUrl || '';
      base.recordingAvailable = !!(base.recordingPath || base.recordingUrl);
      await this.upsertCall(base);
      return base;
    }

    // call_end / call_missed / voicemail / call_start — populate call fields.
    const inboundNumber = payload.direction === 'outbound' ? payload.to : payload.from;
    base.direction = payload.direction || base.direction || 'inbound';
    base.customerPhone = this.normalizePhone(inboundNumber || base.customerPhone);
    if (payload.callerIdName && (!base.customerName || base.customerName === 'Unknown Caller')) {
      base.customerName = payload.callerIdName;
    }
    base.repExtension = payload.extension || base.repExtension || '';
    const rep = this.findRepByExtension(base.repExtension);
    if (rep) {
      base.repId = rep.userId;
      base.repName = rep.name;
    }
    base.startTime = payload.timestamp || base.startTime || now;
    base.duration = payload.duration ?? base.duration ?? 0;
    base.stage = payload.stage || base.stage || '';
    base.answeredVia = payload.answeredVia ?? base.answeredVia ?? null;
    base.disposition = payload.disposition || base.disposition || '';
    base.inBusinessHours = payload.inBusinessHours ?? base.inBusinessHours
      ?? isBusinessHours(new Date(base.startTime));
    if (payload.legs && payload.legs.length) base.legs = payload.legs;

    // End time: for answered calls approximate as start + talk time; otherwise
    // the call ended at ring timeout ≈ the event timestamp.
    const startMs = new Date(base.startTime).getTime();
    base.endTime = base.duration > 0 && !Number.isNaN(startMs)
      ? new Date(startMs + base.duration * 1000).toISOString()
      : (payload.timestamp || base.startTime);

    if (payload.event === 'call_missed') {
      base.status = 'missed';
      if (!base.tags.includes('missed')) base.tags = [...base.tags, 'missed'];
    } else if (payload.event === 'voicemail') {
      base.status = 'voicemail';
      if (!base.tags.includes('voicemail')) base.tags = [...base.tags, 'voicemail'];
    } else {
      base.status = 'completed';
    }

    // Best-effort customer match (no-op until findCustomerByPhone is wired).
    const matched = await this.findCustomerByPhone(base.customerPhone);
    if (matched) {
      base.customerId = matched.customerId;
      base.customerName = matched.customerName;
      base.customerEmail = matched.customerEmail || '';
    }

    await this.upsertCall(base);
    return base;
  }

  /**
   * Create a new call record manually
   */
  async createCall(callData: Partial<CallRecord>): Promise<CallRecord> {
    const now = new Date().toISOString();

    const newCall: CallRecord = {
      callId: this.generateCallId(),
      customerId: callData.customerId || '',
      customerName: callData.customerName || 'Unknown',
      customerPhone: this.normalizePhone(callData.customerPhone || ''),
      customerEmail: callData.customerEmail || '',
      repId: callData.repId || '',
      repName: callData.repName || '',
      repExtension: callData.repExtension || '',
      direction: callData.direction || 'outbound',
      status: callData.status || 'completed',
      startTime: callData.startTime || now,
      endTime: callData.endTime || now,
      duration: callData.duration || 0,
      recordingUrl: callData.recordingUrl || '',
      recordingAvailable: !!callData.recordingUrl,
      notes: callData.notes || '',
      tags: callData.tags || [],
      jobNimbusContactId: callData.jobNimbusContactId || '',
      createdAt: now,
      updatedAt: now,
    };

    await this.upsertCall(newCall);
    return newCall;
  }

  /**
   * Get all calls with optional filtering
   */
  async getCalls(filter?: CallFilter): Promise<CallRecord[]> {
    const all = await this.loadCached();
    let calls = [...all];
    // Sort newest first (by startTime descending)
    calls.sort((a, b) => (b.startTime || '').localeCompare(a.startTime || ''));

    if (filter) {
      if (filter.customerId) {
        calls = calls.filter(c => c.customerId === filter.customerId);
      }
      if (filter.customerPhone) {
        const phone = this.normalizePhone(filter.customerPhone);
        calls = calls.filter(c => c.customerPhone === phone);
      }
      if (filter.repId) {
        calls = calls.filter(c => c.repId === filter.repId);
      }
      if (filter.repExtension) {
        calls = calls.filter(c => c.repExtension === filter.repExtension);
      }
      if (filter.direction) {
        calls = calls.filter(c => c.direction === filter.direction);
      }
      if (filter.status) {
        calls = calls.filter(c => c.status === filter.status);
      }
      if (filter.startDate) {
        const start = new Date(filter.startDate);
        calls = calls.filter(c => new Date(c.startTime) >= start);
      }
      if (filter.endDate) {
        const end = new Date(filter.endDate);
        calls = calls.filter(c => new Date(c.startTime) <= end);
      }
      if (filter.tags && filter.tags.length > 0) {
        calls = calls.filter(c => filter.tags!.some(t => c.tags.includes(t)));
      }
      if (filter.searchQuery) {
        const query = filter.searchQuery.toLowerCase();
        calls = calls.filter(c =>
          c.customerName.toLowerCase().includes(query) ||
          c.customerPhone.includes(query) ||
          c.repName.toLowerCase().includes(query) ||
          c.notes.toLowerCase().includes(query)
        );
      }
    }

    return calls;
  }

  /**
   * Get calls for a specific customer
   */
  async getCallsByCustomer(customerId: string): Promise<CallRecord[]> {
    return this.getCalls({ customerId });
  }

  /**
   * Get calls by phone number
   */
  async getCallsByPhone(phone: string): Promise<CallRecord[]> {
    return this.getCalls({ customerPhone: phone });
  }

  /**
   * Get a single call by ID
   */
  async getCallById(callId: string): Promise<CallRecord | null> {
    const calls = await this.loadCached();
    return calls.find(c => c.callId === callId) || null;
  }

  /**
   * Update a call record
   */
  async updateCall(callId: string, updates: Partial<CallRecord>): Promise<CallRecord | null> {
    const existing = await this.getCallById(callId);
    if (!existing) return null;

    const updated: CallRecord = {
      ...existing,
      ...updates,
      callId, // Prevent changing ID
      updatedAt: new Date().toISOString(),
    };
    await this.upsertCall(updated);
    return updated;
  }

  /**
   * Add note to a call
   */
  async addCallNote(callId: string, note: string): Promise<CallRecord | null> {
    return this.updateCall(callId, { notes: note });
  }

  /**
   * Add tags to a call
   */
  async addCallTags(callId: string, tags: string[]): Promise<CallRecord | null> {
    const call = await this.getCallById(callId);
    if (!call) return null;

    const uniqueTags = [...new Set([...call.tags, ...tags])];
    return this.updateCall(callId, { tags: uniqueTags });
  }

  /**
   * Link call to JobNimbus contact
   */
  async linkToJobNimbus(callId: string, jobNimbusContactId: string): Promise<CallRecord | null> {
    return this.updateCall(callId, { jobNimbusContactId });
  }

  /**
   * Get call statistics
   */
  async getStats(): Promise<CallStats> {
    const calls = await this.loadCached();
    return this.computeStats(calls);
  }

  /**
   * Get call analytics
   */
  async getAnalytics(daysBack: number = 30): Promise<CallAnalytics> {
    const calls = await this.loadCached();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const recentCalls = calls.filter(c => new Date(c.startTime) >= startDate);

    // Daily volume
    const dailyMap = new Map<string, { count: number; duration: number }>();
    recentCalls.forEach(call => {
      const date = call.startTime.slice(0, 10);
      const existing = dailyMap.get(date) || { count: 0, duration: 0 };
      dailyMap.set(date, {
        count: existing.count + 1,
        duration: existing.duration + call.duration,
      });
    });

    const dailyVolume = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // By rep
    const repMap = new Map<string, { repName: string; count: number; totalDuration: number }>();
    recentCalls.forEach(call => {
      if (!call.repId) return;
      const existing = repMap.get(call.repId) || { repName: call.repName, count: 0, totalDuration: 0 };
      repMap.set(call.repId, {
        repName: call.repName,
        count: existing.count + 1,
        totalDuration: existing.totalDuration + call.duration,
      });
    });

    const byRep = Array.from(repMap.entries())
      .map(([repId, data]) => ({
        repId,
        repName: data.repName,
        count: data.count,
        avgDuration: Math.round(data.totalDuration / data.count),
      }))
      .sort((a, b) => b.count - a.count);

    // By status
    const statusMap = new Map<string, number>();
    recentCalls.forEach(call => {
      statusMap.set(call.status, (statusMap.get(call.status) || 0) + 1);
    });

    const byStatus = Array.from(statusMap.entries())
      .map(([status, count]) => ({ status, count }));

    // Peak hours
    const hourMap = new Map<number, number>();
    recentCalls.forEach(call => {
      const hour = new Date(call.startTime).getHours();
      hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
    });

    const peakHours = Array.from(hourMap.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => b.count - a.count);

    // Average response time in seconds for answered inbound calls.
    const answeredInbound = recentCalls.filter(
      c => c.direction === 'inbound' && c.status === 'completed' && c.startTime && c.endTime && c.duration > 0
    );
    let avgResponseTime = 0;
    if (answeredInbound.length > 0) {
      const totalWaitTime = answeredInbound.reduce((sum, call) => {
        const totalElapsed = (new Date(call.endTime).getTime() - new Date(call.startTime).getTime()) / 1000;
        const ringTime = Math.max(0, totalElapsed - call.duration);
        return sum + ringTime;
      }, 0);
      avgResponseTime = Math.round(totalWaitTime / answeredInbound.length);
    }

    return {
      dailyVolume,
      byRep,
      byStatus,
      peakHours,
      avgResponseTime,
    };
  }

  /**
   * Get recent calls for dashboard
   */
  async getRecentCalls(limit: number = 10): Promise<CallRecord[]> {
    const all = await this.getCalls();
    return all.slice(0, limit);
  }

  /**
   * Get today's calls
   */
  async getTodaysCalls(): Promise<CallRecord[]> {
    const today = new Date().toISOString().slice(0, 10);
    const calls = await this.loadCached();
    return calls.filter(c => c.startTime.startsWith(today));
  }

  // ===========================================================================
  // INTEGRATION HELPERS
  // ===========================================================================

  /**
   * Find customer by phone number
   * This would integrate with your customer database/Google Sheets
   */
  private async findCustomerByPhone(phone: string): Promise<{
    customerId: string;
    customerName: string;
    customerEmail?: string;
  } | null> {
    // FUTURE: Look up customer by phone number from Google Sheets Customer_Portal_Access tab.
    return null;
  }

  /**
   * Find rep by extension
   * Uses phone-data.ts extension directory
   */
  private findRepByExtension(extension: string): { userId: string; name: string } | null {
    // Single source of truth: the canonical seed in phone-system-config.ts
    // (slug == the TeamMember slug, so repId stays consistent with the roster).
    const seed = seedForExtension(extension);
    if (!seed || !seed.slug) return null;
    return { userId: seed.slug, name: seed.name };
  }
}

// Export singleton instance
export const callsService = new CallsService();
