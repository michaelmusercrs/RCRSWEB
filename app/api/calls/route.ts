/**
 * RCRS Calls API
 *
 * Main calls endpoint for:
 * - Getting all calls with filters
 * - Creating manual call records
 * - Getting call statistics and analytics
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { callsService, CallFilter } from '@/lib/calls-service';

/**
 * GET /api/calls
 *
 * Get calls with optional filters
 *
 * Query params:
 * - customerId: Filter by customer ID
 * - customerPhone: Filter by phone number
 * - repId: Filter by rep/employee ID
 * - repExtension: Filter by extension
 * - direction: 'inbound' | 'outbound'
 * - status: 'completed' | 'missed' | 'voicemail' | etc.
 * - startDate: ISO date string (filter from)
 * - endDate: ISO date string (filter to)
 * - search: Search query for name/phone/notes
 * - limit: Max records to return
 * - offset: Pagination offset
 * - analytics: 'true' to include analytics
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);

    // Build filter from query params
    const filter: CallFilter = {};

    if (searchParams.get('customerId')) {
      filter.customerId = searchParams.get('customerId')!;
    }
    if (searchParams.get('customerPhone')) {
      filter.customerPhone = searchParams.get('customerPhone')!;
    }
    if (searchParams.get('repId')) {
      filter.repId = searchParams.get('repId')!;
    }
    if (searchParams.get('repExtension')) {
      filter.repExtension = searchParams.get('repExtension')!;
    }
    if (searchParams.get('direction')) {
      filter.direction = searchParams.get('direction') as 'inbound' | 'outbound';
    }
    if (searchParams.get('status')) {
      filter.status = searchParams.get('status') as any;
    }
    if (searchParams.get('startDate')) {
      filter.startDate = searchParams.get('startDate')!;
    }
    if (searchParams.get('endDate')) {
      filter.endDate = searchParams.get('endDate')!;
    }
    if (searchParams.get('search')) {
      filter.searchQuery = searchParams.get('search')!;
    }
    if (searchParams.get('tags')) {
      filter.tags = searchParams.get('tags')!.split(',');
    }

    // Get calls
    let calls = callsService.getCalls(Object.keys(filter).length > 0 ? filter : undefined);

    // Pagination
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const total = calls.length;

    calls = calls.slice(offset, offset + limit);

    // Build response
    const response: any = {
      calls,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + calls.length < total,
      },
      stats: callsService.getStats(),
    };

    // Include analytics if requested
    if (searchParams.get('analytics') === 'true') {
      const daysBack = parseInt(searchParams.get('analyticsDays') || '30');
      response.analytics = callsService.getAnalytics(daysBack);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Calls API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calls' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/calls
 *
 * Create a manual call record (for logging calls made outside the PBX)
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.customerPhone) {
      return NextResponse.json(
        { error: 'customerPhone is required' },
        { status: 400 }
      );
    }

    // Create the call record
    const call = callsService.createCall({
      customerId: body.customerId,
      customerName: body.customerName || 'Unknown',
      customerPhone: body.customerPhone,
      customerEmail: body.customerEmail,
      repId: body.repId,
      repName: body.repName,
      repExtension: body.repExtension,
      direction: body.direction || 'outbound',
      status: body.status || 'completed',
      startTime: body.startTime,
      endTime: body.endTime,
      duration: body.duration || 0,
      recordingUrl: body.recordingUrl,
      notes: body.notes,
      tags: body.tags,
      jobNimbusContactId: body.jobNimbusContactId,
    });

    return NextResponse.json({
      success: true,
      call,
    });
  } catch (error) {
    console.error('[Calls API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create call record' },
      { status: 500 }
    );
  }
}
