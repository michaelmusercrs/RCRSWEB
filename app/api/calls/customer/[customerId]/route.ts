/**
 * RCRS Customer Calls API
 *
 * Get calls for a specific customer by ID or phone number.
 * Used by:
 * - Customer portal to display call history
 * - Admin views to see customer call history
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { callsService } from '@/lib/calls-service';

/**
 * GET /api/calls/customer/[customerId]
 *
 * Get all calls for a specific customer
 *
 * The customerId parameter can be:
 * - A customer ID (CUST-xxx)
 * - A phone number (will be normalized)
 *
 * Query params:
 * - limit: Max records (default 20)
 * - includeRecordings: 'true' to include recording URLs (requires permission)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const includeRecordings = searchParams.get('includeRecordings') === 'true';

    const identifier = params.customerId;

    let calls;

    // Check if it's a phone number (all digits or has dashes)
    const isPhone = /^[\d\-\(\)\s]+$/.test(identifier);

    if (isPhone) {
      calls = await callsService.getCallsByPhone(identifier);
    } else {
      calls = await callsService.getCallsByCustomer(identifier);
    }

    // Limit results
    calls = calls.slice(0, limit);

    // Optionally strip recording URLs for privacy
    if (!includeRecordings) {
      calls = calls.map(call => ({
        ...call,
        recordingUrl: call.recordingAvailable ? '[available]' : '',
      }));
    }

    // Calculate summary stats for this customer
    const summary = {
      totalCalls: calls.length,
      inboundCalls: calls.filter(c => c.direction === 'inbound').length,
      outboundCalls: calls.filter(c => c.direction === 'outbound').length,
      missedCalls: calls.filter(c => c.status === 'missed').length,
      totalDuration: calls.reduce((sum, c) => sum + c.duration, 0),
      averageDuration: calls.length > 0
        ? Math.round(calls.reduce((sum, c) => sum + c.duration, 0) / calls.filter(c => c.status === 'completed').length)
        : 0,
      lastCall: calls.length > 0 ? calls[0].startTime : null,
      mostFrequentRep: getMostFrequentRep(calls),
    };

    return NextResponse.json({
      calls,
      summary,
      customerId: isPhone ? null : identifier,
      customerPhone: isPhone ? callsService.normalizePhone(identifier) : null,
    });
  } catch (error) {
    console.error('[Customer Calls API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer calls' },
      { status: 500 }
    );
  }
}

/**
 * Get the most frequent rep for a set of calls
 */
function getMostFrequentRep(calls: any[]): { repId: string; repName: string; count: number } | null {
  const repCounts = new Map<string, { repName: string; count: number }>();

  calls.forEach(call => {
    if (!call.repId) return;
    const existing = repCounts.get(call.repId);
    if (existing) {
      existing.count++;
    } else {
      repCounts.set(call.repId, { repName: call.repName, count: 1 });
    }
  });

  if (repCounts.size === 0) return null;

  let maxRep = { repId: '', repName: '', count: 0 };
  repCounts.forEach((data, repId) => {
    if (data.count > maxRep.count) {
      maxRep = { repId, repName: data.repName, count: data.count };
    }
  });

  return maxRep;
}
