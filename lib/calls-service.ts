/**
 * RCRS Call Recording Service
 *
 * Manages call data storage, retrieval, and integration with:
 * - Google Voice PBX bridge
 * - Customer portal
 * - JobNimbus contacts
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// =============================================================================
// TYPES
// =============================================================================

export type CallDirection = 'inbound' | 'outbound';
export type CallStatus = 'ringing' | 'in_progress' | 'completed' | 'missed' | 'voicemail' | 'failed';

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
  /** Call unique ID from phone system */
  callUuid: string;
  /** Caller phone number */
  from: string;
  /** Callee phone number */
  to: string;
  /** Extension that handled */
  extension?: string;
  /** Call direction */
  direction: 'inbound' | 'outbound';
  /** Duration in seconds */
  duration?: number;
  /** Recording URL */
  recordingUrl?: string;
  /** Timestamp */
  timestamp: string;
  /** Caller ID name if available */
  callerIdName?: string;
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
// DATA PATH
// =============================================================================

const DATA_FILE_PATH = path.join(process.cwd(), 'data', 'calls.json');

// =============================================================================
// SERVICE CLASS
// =============================================================================

class CallsService {
  /**
   * Read calls data from file
   */
  private readData(): CallsData {
    try {
      if (fs.existsSync(DATA_FILE_PATH)) {
        const content = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('Error reading calls data:', error);
    }

    // Return empty data structure
    return {
      calls: [],
      callStats: {
        totalCalls: 0,
        totalDuration: 0,
        inboundCalls: 0,
        outboundCalls: 0,
        missedCalls: 0,
        completedCalls: 0,
        averageDuration: 0,
        lastUpdated: new Date().toISOString(),
      },
    };
  }

  /**
   * Write calls data to file
   */
  private writeData(data: CallsData): void {
    try {
      // Ensure data directory exists
      const dir = path.dirname(DATA_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error writing calls data:', error);
      throw error;
    }
  }

  /**
   * Generate unique call ID
   */
  generateCallId(): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `CALL-${timestamp}-${random}`;
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

  /**
   * Update call stats
   */
  private updateStats(data: CallsData): void {
    const calls = data.calls;

    data.callStats = {
      totalCalls: calls.length,
      totalDuration: calls.reduce((sum, c) => sum + c.duration, 0),
      inboundCalls: calls.filter(c => c.direction === 'inbound').length,
      outboundCalls: calls.filter(c => c.direction === 'outbound').length,
      missedCalls: calls.filter(c => c.status === 'missed').length,
      completedCalls: calls.filter(c => c.status === 'completed').length,
      averageDuration: calls.length > 0
        ? Math.round(calls.reduce((sum, c) => sum + c.duration, 0) / calls.filter(c => c.status === 'completed').length)
        : 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  // ===========================================================================
  // PUBLIC METHODS
  // ===========================================================================

  /**
   * Process incoming webhook from phone system
   */
  async processWebhook(payload: WebhookPayload): Promise<CallRecord> {
    const data = this.readData();
    const now = new Date().toISOString();

    // Find existing call record for this UUID
    let existingIndex = data.calls.findIndex(c => c.callId.includes(payload.callUuid));

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

      data.calls.unshift(newCall);
      this.updateStats(data);
      this.writeData(data);

      return newCall;
    }

    if (payload.event === 'call_end' && existingIndex >= 0) {
      // Update existing call
      const call = data.calls[existingIndex];
      call.status = 'completed';
      call.endTime = payload.timestamp;
      call.duration = payload.duration || 0;
      call.updatedAt = now;

      this.updateStats(data);
      this.writeData(data);

      return call;
    }

    if (payload.event === 'call_missed') {
      // Find or create missed call record
      if (existingIndex >= 0) {
        data.calls[existingIndex].status = 'missed';
        data.calls[existingIndex].endTime = payload.timestamp;
        data.calls[existingIndex].updatedAt = now;
      } else {
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
        data.calls.unshift(missedCall);
      }

      this.updateStats(data);
      this.writeData(data);

      return data.calls[existingIndex >= 0 ? existingIndex : 0];
    }

    if (payload.event === 'voicemail' && existingIndex >= 0) {
      data.calls[existingIndex].status = 'voicemail';
      data.calls[existingIndex].endTime = payload.timestamp;
      data.calls[existingIndex].updatedAt = now;

      this.updateStats(data);
      this.writeData(data);

      return data.calls[existingIndex];
    }

    if (payload.event === 'recording_ready' && existingIndex >= 0) {
      data.calls[existingIndex].recordingUrl = payload.recordingUrl || '';
      data.calls[existingIndex].recordingAvailable = !!payload.recordingUrl;
      data.calls[existingIndex].updatedAt = now;

      this.writeData(data);

      return data.calls[existingIndex];
    }

    // Return a default response if no matching case
    return data.calls[0] || {
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

  /**
   * Create a new call record manually
   */
  createCall(callData: Partial<CallRecord>): CallRecord {
    const data = this.readData();
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

    data.calls.unshift(newCall);
    this.updateStats(data);
    this.writeData(data);

    return newCall;
  }

  /**
   * Get all calls with optional filtering
   */
  getCalls(filter?: CallFilter): CallRecord[] {
    const data = this.readData();
    let calls = [...data.calls];

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
  getCallsByCustomer(customerId: string): CallRecord[] {
    return this.getCalls({ customerId });
  }

  /**
   * Get calls by phone number
   */
  getCallsByPhone(phone: string): CallRecord[] {
    return this.getCalls({ customerPhone: phone });
  }

  /**
   * Get a single call by ID
   */
  getCallById(callId: string): CallRecord | null {
    const data = this.readData();
    return data.calls.find(c => c.callId === callId) || null;
  }

  /**
   * Update a call record
   */
  updateCall(callId: string, updates: Partial<CallRecord>): CallRecord | null {
    const data = this.readData();
    const index = data.calls.findIndex(c => c.callId === callId);

    if (index < 0) return null;

    data.calls[index] = {
      ...data.calls[index],
      ...updates,
      callId, // Prevent changing ID
      updatedAt: new Date().toISOString(),
    };

    this.updateStats(data);
    this.writeData(data);

    return data.calls[index];
  }

  /**
   * Add note to a call
   */
  addCallNote(callId: string, note: string): CallRecord | null {
    return this.updateCall(callId, { notes: note });
  }

  /**
   * Add tags to a call
   */
  addCallTags(callId: string, tags: string[]): CallRecord | null {
    const call = this.getCallById(callId);
    if (!call) return null;

    const uniqueTags = [...new Set([...call.tags, ...tags])];
    return this.updateCall(callId, { tags: uniqueTags });
  }

  /**
   * Link call to JobNimbus contact
   */
  linkToJobNimbus(callId: string, jobNimbusContactId: string): CallRecord | null {
    return this.updateCall(callId, { jobNimbusContactId });
  }

  /**
   * Get call statistics
   */
  getStats(): CallStats {
    const data = this.readData();
    return data.callStats;
  }

  /**
   * Get call analytics
   */
  getAnalytics(daysBack: number = 30): CallAnalytics {
    const data = this.readData();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const recentCalls = data.calls.filter(c => new Date(c.startTime) >= startDate);

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

    // Average response time (placeholder - would need ring time data)
    const avgResponseTime = 0;

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
  getRecentCalls(limit: number = 10): CallRecord[] {
    const data = this.readData();
    return data.calls.slice(0, limit);
  }

  /**
   * Get today's calls
   */
  getTodaysCalls(): CallRecord[] {
    const today = new Date().toISOString().slice(0, 10);
    const data = this.readData();
    return data.calls.filter(c => c.startTime.startsWith(today));
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
    // Would query googleSheetsService.getCustomers() and match on phone field.
    // Not yet implemented because customer phone data is sparse in the current sheet.
    return null;
  }

  /**
   * Find rep by extension
   * Uses phone-data.ts extension directory
   */
  private findRepByExtension(extension: string): { userId: string; name: string } | null {
    // Import from phone-data would cause circular dependency, so we inline the lookup
    const extensionMap: Record<string, { userId: string; name: string }> = {
      '101': { userId: 'michael-muse', name: 'Michael Muse' },
      '102': { userId: 'chris-muse', name: 'Chris Muse' },
      '103': { userId: 'sara-hill', name: 'Sara Hill' },
      '104': { userId: 'tia', name: 'Tia' },
      '105': { userId: 'destin', name: 'Destin' },
      '106': { userId: 'john', name: 'John' },
      '107': { userId: 'bart', name: 'Bart' },
      '108': { userId: 'boston', name: 'Boston' },
    };

    return extensionMap[extension] || null;
  }
}

// Export singleton instance
export const callsService = new CallsService();
