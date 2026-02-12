/**
 * Call Recording Types
 *
 * Shared type definitions for call recording integration.
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

// =============================================================================
// ENUMS
// =============================================================================

export type CallDirection = 'inbound' | 'outbound';

export type CallStatus =
  | 'ringing'
  | 'in_progress'
  | 'completed'
  | 'missed'
  | 'voicemail'
  | 'failed';

// =============================================================================
// CORE TYPES
// =============================================================================

/**
 * Full call record as stored in the database
 */
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

/**
 * Simplified call record for customer portal display
 */
export interface CustomerCallRecord {
  callId: string;
  direction: CallDirection;
  status: 'completed' | 'missed' | 'voicemail';
  startTime: string;
  duration: number;
  repName: string;
  notes?: string;
  recordingAvailable?: boolean;
  recordingUrl?: string;
}

/**
 * Call statistics summary
 */
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

// =============================================================================
// WEBHOOK TYPES
// =============================================================================

/**
 * Webhook payload from phone system
 */
export interface CallWebhookPayload {
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
  direction: CallDirection;
  /** Duration in seconds */
  duration?: number;
  /** Recording URL */
  recordingUrl?: string;
  /** Timestamp */
  timestamp: string;
  /** Caller ID name if available */
  callerIdName?: string;
}

// =============================================================================
// FILTER & QUERY TYPES
// =============================================================================

/**
 * Filter options for querying calls
 */
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

// =============================================================================
// ANALYTICS TYPES
// =============================================================================

/**
 * Call analytics data
 */
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

/**
 * Customer call summary
 */
export interface CustomerCallSummary {
  totalCalls: number;
  inboundCalls: number;
  outboundCalls: number;
  missedCalls: number;
  totalDuration: number;
  averageDuration: number;
  lastCall: string | null;
  mostFrequentRep: {
    repId: string;
    repName: string;
    count: number;
  } | null;
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

/**
 * Response from /api/calls endpoint
 */
export interface CallsApiResponse {
  calls: CallRecord[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  stats: CallStats;
  analytics?: CallAnalytics;
}

/**
 * Response from /api/calls/customer/[customerId] endpoint
 */
export interface CustomerCallsApiResponse {
  calls: CallRecord[];
  summary: CustomerCallSummary;
  customerId: string | null;
  customerPhone: string | null;
}

/**
 * Response from webhook endpoint
 */
export interface WebhookApiResponse {
  success: boolean;
  event: string;
  callId: string;
  status: CallStatus;
  timestamp: string;
}
