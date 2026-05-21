// Lead Reassignment Queue API
// GET  - list pending reassignment requests (default) or all with ?status=
// POST - resolve a queue entry (confirm reassignment OR decline)
//
// Manual-execution policy per Michael 2026-05-21: the SLA cron writes to
// this queue when a lead breaches its response timer, but never actually
// moves the lead. A dispatcher reviews and confirms here.

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { googleSheetsService } from '@/lib/google-sheets-service';
import { leadResponseTimerService } from '@/lib/lead-response-timer';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  const status = request.nextUrl.searchParams.get('status') || 'pending';
  const queue = await googleSheetsService.getReassignmentQueue({
    status: status === 'all' ? undefined : status,
    limit: 100,
  });
  return NextResponse.json({ success: true, queue });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { queueId, action, notes } = body as {
      queueId: string;
      action: 'confirm' | 'decline';
      notes?: string;
    };

    if (!queueId || !['confirm', 'decline'].includes(action)) {
      return NextResponse.json({ success: false, error: 'queueId + action (confirm|decline) required' }, { status: 400 });
    }

    // Look up the queue entry to learn the suggested rep
    const all = await googleSheetsService.getReassignmentQueue();
    const entry = all.find(e => e.queueId === queueId);
    if (!entry) {
      return NextResponse.json({ success: false, error: 'queue entry not found' }, { status: 404 });
    }
    if (entry.status !== 'pending') {
      return NextResponse.json({ success: false, error: `entry already ${entry.status}` }, { status: 409 });
    }

    if (action === 'confirm') {
      // Execute the reassignment via the timer service (which also upserts
      // the outcome log + restarts the timer for the new rep).
      const repToAssign = entry.suggestedRep;
      if (!repToAssign) {
        return NextResponse.json({ success: false, error: 'no suggested rep on this entry — manually reassign via the distro dashboard instead' }, { status: 400 });
      }
      await leadResponseTimerService.recordReassignment(
        entry.leadId,
        repToAssign,
        `Manually confirmed by ${auth.user.name || 'admin'} after ${entry.minutesElapsed}min SLA breach by ${entry.originalRep}${notes ? `; ${notes}` : ''}`
      );
      await googleSheetsService.resolveReassignmentQueueEntry(queueId, {
        status: 'resolved-reassigned',
        resolvedBy: auth.user.name || 'admin',
        resolutionNotes: notes || '',
      });
      return NextResponse.json({ success: true, reassignedTo: repToAssign });
    }

    // action === 'decline' — keep the lead with the original rep; just mark resolved
    await googleSheetsService.resolveReassignmentQueueEntry(queueId, {
      status: 'resolved-declined',
      resolvedBy: auth.user.name || 'admin',
      resolutionNotes: notes || '',
    });
    return NextResponse.json({ success: true, declined: true });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Internal error',
    }, { status: 500 });
  }
}
