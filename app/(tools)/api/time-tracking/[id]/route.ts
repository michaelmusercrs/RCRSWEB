/**
 * RCRS Time Tracking Entry API
 *
 * PATCH  /api/time-tracking/[id] - Clock out, start/end break, update entry
 * DELETE /api/time-tracking/[id] - Delete entry (only today + not approved)
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { timeTrackingService } from '@/lib/time-tracking-service';

/**
 * PATCH /api/time-tracking/[id]
 *
 * Actions:
 * - { action: "clockOut" } - Clock out the entry
 * - { action: "startBreak" } - Start a break
 * - { action: "endBreak" } - End a break
 * - { notes?, category?, jobId?, customerName?, address? } - Update fields
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

    const { id } = params;
    const body = await request.json();
    const { action } = body;

    let entry;

    switch (action) {
      case 'clockOut':
        entry = await timeTrackingService.clockOut(id);
        return NextResponse.json({
          success: true,
          message: 'Clocked out successfully',
          entry,
        });

      case 'startBreak':
        entry = await timeTrackingService.startBreak(id);
        return NextResponse.json({
          success: true,
          message: 'Break started',
          entry,
        });

      case 'endBreak':
        entry = await timeTrackingService.endBreak(id);
        return NextResponse.json({
          success: true,
          message: 'Break ended',
          entry,
        });

      default:
        // Update fields
        entry = await timeTrackingService.updateEntry(id, {
          notes: body.notes,
          category: body.category,
          jobId: body.jobId,
          customerName: body.customerName,
          address: body.address,
        });
        return NextResponse.json({
          success: true,
          message: 'Entry updated',
          entry,
        });
    }
  } catch (error: any) {
    console.error('[TimeTracking API] PATCH error:', error);
    const message = error?.message || 'Failed to update time entry';
    const statusCode = message.includes('not found') ? 404 : 400;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

/**
 * DELETE /api/time-tracking/[id]
 *
 * Delete a time entry. Only allowed for today's entries that are not approved.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

    const { id } = params;
    await timeTrackingService.deleteEntry(id);

    return NextResponse.json({
      success: true,
      message: 'Entry deleted',
    });
  } catch (error: any) {
    console.error('[TimeTracking API] DELETE error:', error);
    const message = error?.message || 'Failed to delete time entry';
    const statusCode = message.includes('not found') ? 404 : 400;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
