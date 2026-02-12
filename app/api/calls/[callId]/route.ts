/**
 * RCRS Single Call API
 *
 * Operations on individual call records:
 * - GET: Fetch call details
 * - PATCH: Update call (notes, tags, etc.)
 * - DELETE: Delete call record
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { callsService } from '@/lib/calls-service';

/**
 * GET /api/calls/[callId]
 *
 * Get a single call record by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { callId: string } }
) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const call = callsService.getCallById(params.callId);

    if (!call) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ call });
  } catch (error) {
    console.error('[Calls API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch call' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/calls/[callId]
 *
 * Update a call record
 * Allowed fields: notes, tags, customerId, customerName, jobNimbusContactId
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { callId: string } }
) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();

    // Only allow certain fields to be updated
    const allowedUpdates: Record<string, any> = {};

    if ('notes' in body) allowedUpdates.notes = body.notes;
    if ('tags' in body) allowedUpdates.tags = body.tags;
    if ('customerId' in body) allowedUpdates.customerId = body.customerId;
    if ('customerName' in body) allowedUpdates.customerName = body.customerName;
    if ('customerEmail' in body) allowedUpdates.customerEmail = body.customerEmail;
    if ('jobNimbusContactId' in body) allowedUpdates.jobNimbusContactId = body.jobNimbusContactId;

    if (Object.keys(allowedUpdates).length === 0) {
      return NextResponse.json(
        { error: 'No valid update fields provided' },
        { status: 400 }
      );
    }

    const updatedCall = callsService.updateCall(params.callId, allowedUpdates);

    if (!updatedCall) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      call: updatedCall,
    });
  } catch (error) {
    console.error('[Calls API] PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update call' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/calls/[callId]
 *
 * Delete a call record (admin only - not implemented)
 * Placeholder for future implementation
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { callId: string } }
) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  // For now, don't allow deletion
  return NextResponse.json(
    { error: 'Call deletion is not permitted' },
    { status: 403 }
  );
}
