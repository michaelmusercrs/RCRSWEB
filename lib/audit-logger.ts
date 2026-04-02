/**
 * Centralized Audit Logger
 *
 * Writes audit events to the AuditLog tab in the master Google Sheet.
 * Fire-and-forget: never blocks the caller, errors are logged to console only.
 *
 * Columns: Timestamp | Action | UserEmail | Details | IP | UserAgent
 *
 * Usage:
 *   import { auditLog } from '@/lib/audit-logger';
 *   auditLog('INVENTORY_ADD', user.email, 'Added 50x Shingles (SKU-123)', request);
 */

import { googleSheetsService } from '@/lib/google-sheets-service';
import { NextRequest } from 'next/server';

/**
 * Write an audit log entry to the AuditLog Google Sheet tab.
 * This is fire-and-forget -- it never throws and never blocks the response.
 *
 * @param action   - Short action label, e.g. 'INVENTORY_ADD', 'ORDER_CREATE'
 * @param userEmail - Email of the user performing the action
 * @param details  - Human-readable description of what happened
 * @param request  - Optional NextRequest to extract IP and UserAgent
 */
export function auditLog(
  action: string,
  userEmail: string,
  details: string,
  request?: NextRequest | null
): void {
  // Extract IP and UserAgent from request if provided
  const ip = request?.headers?.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const userAgent = request?.headers?.get('user-agent')?.substring(0, 200) || '';
  const timestamp = new Date().toISOString();

  // Fire-and-forget: run async but don't await
  writeToSheet(timestamp, action, userEmail, details, ip, userAgent).catch((err) => {
    console.error('[AuditLog] Write failed:', err);
  });
}

async function writeToSheet(
  timestamp: string,
  action: string,
  userEmail: string,
  details: string,
  ip: string,
  userAgent: string
): Promise<void> {
  await googleSheetsService.appendToAuditLog({
    action,
    userEmail,
    details,
    ip,
    userAgent,
    timestamp,
  });
}
