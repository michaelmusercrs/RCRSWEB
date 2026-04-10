/**
 * RCRS Communications Hub - Customer Thread API
 *
 * GET  /api/communications/[customerId] - Get full communication thread
 * POST /api/communications/[customerId] - Add note or send message
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { communicationHubService } from '@/lib/communication-hub-service';

// =============================================================================
// GET - Full communication thread for a customer
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  try {
    const { customerId } = params;

    if (!customerId) {
      return NextResponse.json(
        { success: false, error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const thread = await communicationHubService.getCustomerThread(customerId);

    // Filter by type if specified
    let events = thread.events;
    if (type) {
      events = events.filter(e => e.type === type);
    }

    // Apply pagination
    const total = events.length;
    const paginated = events.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      data: {
        customer: thread.customer,
        events: paginated,
        summary: thread.summary,
        pagination: { total, limit, offset, hasMore: offset + limit < total },
      },
    });
  } catch (error) {
    console.error('[Communications Customer API] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch customer thread' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Add note or send message to a customer
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { customerId: string } }
) {
  try {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

    const { customerId } = params;

    if (!customerId) {
      return NextResponse.json(
        { success: false, error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { action, content, channel, author, subject, jobId, leadId, metadata } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'action is required (note, sms, email, status_change, appointment)' },
        { status: 400 }
      );
    }

    if (!content) {
      return NextResponse.json(
        { success: false, error: 'content is required' },
        { status: 400 }
      );
    }

    if (typeof content !== 'string' || content.length > 10000) {
      return NextResponse.json(
        { success: false, error: 'Content must be a string under 10000 characters' },
        { status: 400 }
      );
    }

    const authorName = author || 'System';

    switch (action) {
      case 'note': {
        const event = await communicationHubService.addNote(customerId, content, authorName);
        return NextResponse.json({ success: true, data: event, action: 'note_added' });
      }

      case 'sms': {
        const event = await communicationHubService.sendMessage(
          customerId,
          content,
          'sms',
          authorName
        );
        return NextResponse.json({ success: true, data: event, action: 'sms_sent' });
      }

      case 'email': {
        const event = await communicationHubService.sendMessage(
          customerId,
          content,
          'email',
          authorName
        );
        // Add subject if provided
        if (subject) {
          event.subject = subject;
        }
        return NextResponse.json({ success: true, data: event, action: 'email_sent' });
      }

      case 'status_change': {
        const event = await communicationHubService.addEvent({
          type: 'status_change',
          timestamp: new Date().toISOString(),
          from: authorName,
          to: customerId,
          body: content,
          repName: authorName,
          isRead: false,
          jobId,
          leadId,
          metadata: {
            customerId,
            ...(metadata || {}),
          },
        });
        return NextResponse.json({ success: true, data: event, action: 'status_changed' });
      }

      case 'appointment': {
        const event = await communicationHubService.addEvent({
          type: 'appointment',
          timestamp: new Date().toISOString(),
          from: authorName,
          to: customerId,
          subject: subject || 'Appointment',
          body: content,
          repName: authorName,
          isRead: false,
          jobId,
          leadId,
          metadata: {
            customerId,
            ...(metadata || {}),
          },
        });
        return NextResponse.json({ success: true, data: event, action: 'appointment_created' });
      }

      case 'document': {
        const event = await communicationHubService.addEvent({
          type: 'document',
          timestamp: new Date().toISOString(),
          from: authorName,
          to: customerId,
          body: content,
          attachments: body.attachments || [],
          repName: authorName,
          isRead: false,
          jobId,
          metadata: {
            customerId,
            ...(metadata || {}),
          },
        });
        return NextResponse.json({ success: true, data: event, action: 'document_shared' });
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown action: ${action}. Use: note, sms, email, status_change, appointment, document`,
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Communications Customer API] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process communication action' },
      { status: 500 }
    );
  }
}
