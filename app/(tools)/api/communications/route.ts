/**
 * RCRS Communications Hub API
 *
 * GET  /api/communications - Get recent activity feed or filtered events
 * POST /api/communications - Add a new communication event (note, message, etc.)
 *
 * Query params (GET):
 *   customerId - Filter events for a specific customer
 *   search     - Search across event content
 *   limit      - Max results (default 50)
 *   offset     - Pagination offset (default 0)
 *   type       - Filter by event type (call, sms, email, note, voicemail, etc.)
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  communicationHubService,
  CommunicationEventType,
} from '@/lib/communication-hub-service';

// =============================================================================
// GET - Recent activity feed / filtered events
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const type = searchParams.get('type') as CommunicationEventType | null;

    // If customerId is provided, get that customer's thread
    if (customerId) {
      const thread = await communicationHubService.getCustomerThread(customerId);
      let events = thread.events;

      // Filter by type if specified
      if (type) {
        events = events.filter(e => e.type === type);
      }

      // Filter by search if specified
      if (search) {
        const q = search.toLowerCase();
        events = events.filter(
          e =>
            e.body.toLowerCase().includes(q) ||
            e.from.toLowerCase().includes(q) ||
            e.to.toLowerCase().includes(q) ||
            (e.subject && e.subject.toLowerCase().includes(q))
        );
      }

      // Apply pagination
      const total = events.length;
      const paginated = events.slice(offset, offset + limit);

      return NextResponse.json({
        success: true,
        data: {
          events: paginated,
          customer: thread.customer,
          summary: thread.summary,
          pagination: { total, limit, offset, hasMore: offset + limit < total },
        },
      });
    }

    // Otherwise, return recent activity feed
    let events = await communicationHubService.getRecentActivity(limit + offset);

    // Filter by type
    if (type) {
      events = events.filter(e => e.type === type);
    }

    // Filter by search
    if (search) {
      const q = search.toLowerCase();
      events = events.filter(
        e =>
          e.body.toLowerCase().includes(q) ||
          e.from.toLowerCase().includes(q) ||
          e.to.toLowerCase().includes(q) ||
          (e.subject && e.subject.toLowerCase().includes(q))
      );
    }

    const total = events.length;
    const paginated = events.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      data: {
        events: paginated,
        pagination: { total, limit, offset, hasMore: offset + limit < total },
      },
    });
  } catch (error) {
    console.error('[Communications API] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch communications' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Add a new communication event
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, customerId, message, channel, author, note, type, eventData } = body;

    if (!customerId) {
      return NextResponse.json(
        { success: false, error: 'customerId is required' },
        { status: 400 }
      );
    }

    // Route by action
    switch (action) {
      case 'note': {
        if (!note || !author) {
          return NextResponse.json(
            { success: false, error: 'note and author are required for action=note' },
            { status: 400 }
          );
        }
        if (typeof note !== 'string' || note.length > 10000) {
          return NextResponse.json(
            { success: false, error: 'Note must be a string under 10000 characters' },
            { status: 400 }
          );
        }

        const event = await communicationHubService.addNote(customerId, note, author);
        return NextResponse.json({ success: true, data: event });
      }

      case 'message': {
        if (!message || !channel) {
          return NextResponse.json(
            { success: false, error: 'message and channel are required for action=message' },
            { status: 400 }
          );
        }
        if (!['sms', 'email'].includes(channel)) {
          return NextResponse.json(
            { success: false, error: 'channel must be "sms" or "email"' },
            { status: 400 }
          );
        }
        if (typeof message !== 'string' || message.length > 5000) {
          return NextResponse.json(
            { success: false, error: 'Message must be a string under 5000 characters' },
            { status: 400 }
          );
        }

        const fromName = author || 'River City Roofing';
        const event = await communicationHubService.sendMessage(
          customerId,
          message,
          channel as 'sms' | 'email',
          fromName
        );
        return NextResponse.json({ success: true, data: event });
      }

      case 'event': {
        // Add a raw event (status change, appointment, document, etc.)
        if (!eventData) {
          return NextResponse.json(
            { success: false, error: 'eventData is required for action=event' },
            { status: 400 }
          );
        }

        const event = communicationHubService.addEvent({
          type: type || eventData.type || 'note',
          timestamp: eventData.timestamp || new Date().toISOString(),
          direction: eventData.direction,
          from: eventData.from || author || 'System',
          to: eventData.to || customerId,
          subject: eventData.subject,
          body: eventData.body || '',
          duration: eventData.duration,
          recordingUrl: eventData.recordingUrl,
          attachments: eventData.attachments,
          metadata: { ...eventData.metadata, customerId },
          repId: eventData.repId,
          repName: eventData.repName || author,
          isRead: false,
          jobId: eventData.jobId,
          leadId: eventData.leadId,
        });

        return NextResponse.json({ success: true, data: event });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'action must be "note", "message", or "event"' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Communications API] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create communication event' },
      { status: 500 }
    );
  }
}
