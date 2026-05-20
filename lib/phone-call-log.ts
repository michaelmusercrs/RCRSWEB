/**
 * RCRS Phone Call Log
 *
 * Persists click-to-call originate events from the portal phone dashboard
 * to the `Phone Call Log` tab on the master Google Sheet. Same write-only
 * pattern as the email-log and spam-log.
 *
 * NOTE: This is NOT a replacement for `lib/calls-service.ts`. That mirrors
 * the FreePBX CDR (every call, inbound + outbound). This file tracks
 * "what the portal told FreePBX to do" — useful for auditing the
 * click-to-call UI and joining a click to its eventual CDR row.
 */

import { googleSheetsService, SHEET_NAMES } from './google-sheets-service';

export const PHONE_CALL_LOG_HEADERS = [
  'timestamp',
  'fromExt',
  'fromName',
  'toNumber',
  'customerName',
  'customerId',
  'jobNumber',
  'status',
  'duration',
  'recordingUrl',
  'notes',
  'callId',
  'source', // 'click-to-call', 'webhook', etc.
] as const;

export interface PhoneCallLogEntry {
  timestamp: string;
  fromExt: string;
  fromName: string;
  toNumber: string;
  customerName?: string;
  customerId?: string;
  jobNumber?: string;
  status: string;
  duration?: number;
  recordingUrl?: string;
  notes?: string;
  callId?: string;
  source?: string;
}

export async function appendPhoneCallLog(entry: PhoneCallLogEntry): Promise<boolean> {
  // Best-effort write — never blocks the originate call.
  try {
    return await googleSheetsService.appendGenericRow(
      SHEET_NAMES.PHONE_CALL_LOG,
      [...PHONE_CALL_LOG_HEADERS],
      {
        timestamp: entry.timestamp || new Date().toISOString(),
        fromExt: entry.fromExt,
        fromName: entry.fromName || '',
        toNumber: entry.toNumber,
        customerName: entry.customerName || '',
        customerId: entry.customerId || '',
        jobNumber: entry.jobNumber || '',
        status: entry.status,
        duration: entry.duration ?? '',
        recordingUrl: entry.recordingUrl || '',
        notes: entry.notes || '',
        callId: entry.callId || '',
        source: entry.source || 'click-to-call',
      },
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[phone-call-log] write failed', err);
    return false;
  }
}
