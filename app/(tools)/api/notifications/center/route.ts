/**
 * Notification Center API
 *
 * GET    /api/notifications/center - List notifications for a user
 * POST   /api/notifications/center - Create a new notification
 * PATCH  /api/notifications/center - Mark notifications as read
 * DELETE /api/notifications/center - Archive or delete notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { notificationCenterService, NotificationType } from '@/lib/notification-center-service';

/**
 * GET /api/notifications/center
 *
 * Query params:
 *  - repSlug (required): user identifier
 *  - unreadOnly: 'true' to only return unread
 *  - type: filter by notification type
 *  - limit: max results (default 50)
 *  - offset: pagination offset (default 0)
 *  - includeArchived: 'true' to include archived
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const repSlug = searchParams.get('repSlug');

    if (!repSlug) {
      return NextResponse.json(
        { success: false, error: 'repSlug is required' },
        { status: 400 }
      );
    }

    const options = {
      unreadOnly: searchParams.get('unreadOnly') === 'true',
      type: searchParams.get('type') as NotificationType | undefined,
      limit: parseInt(searchParams.get('limit') || '50', 10),
      offset: parseInt(searchParams.get('offset') || '0', 10),
      includeArchived: searchParams.get('includeArchived') === 'true',
    };

    // Validate type if provided
    if (searchParams.get('type') && !isValidNotificationType(searchParams.get('type')!)) {
      options.type = undefined;
    }

    const notifications = notificationCenterService.getForUser(repSlug, options);
    const unreadCount = notificationCenterService.getUnreadCount(repSlug);
    const unreadByType = notificationCenterService.getUnreadCountsByType(repSlug);

    return NextResponse.json({
      success: true,
      data: {
        notifications,
        total: notifications.length,
        unreadCount,
        unreadByType,
      },
    });
  } catch (error) {
    console.error('GET /api/notifications/center error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications/center
 *
 * Body:
 *  - type, title, message, priority, recipient, sender,
 *    actionUrl, actionLabel, metadata, expiresAt, groupId
 *  - broadcast: true to send to all users
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.title || !body.message) {
      return NextResponse.json(
        { success: false, error: 'title and message are required' },
        { status: 400 }
      );
    }

    let notification;

    if (body.broadcast) {
      notification = notificationCenterService.broadcast({
        type: body.type,
        title: body.title,
        message: body.message,
        priority: body.priority,
        sender: body.sender,
        actionUrl: body.actionUrl,
        actionLabel: body.actionLabel,
        metadata: body.metadata,
        expiresAt: body.expiresAt,
        groupId: body.groupId,
      });
    } else {
      if (!body.recipient) {
        return NextResponse.json(
          { success: false, error: 'recipient is required (or set broadcast: true)' },
          { status: 400 }
        );
      }

      notification = notificationCenterService.create({
        type: body.type,
        title: body.title,
        message: body.message,
        priority: body.priority,
        recipient: body.recipient,
        sender: body.sender,
        actionUrl: body.actionUrl,
        actionLabel: body.actionLabel,
        metadata: body.metadata,
        expiresAt: body.expiresAt,
        groupId: body.groupId,
      });
    }

    return NextResponse.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    console.error('POST /api/notifications/center error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create notification' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications/center
 *
 * Body:
 *  - ids: string[] - notification IDs to mark as read
 *  - markAllRead: true + repSlug to mark all as read for user
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.markAllRead && body.repSlug) {
      notificationCenterService.markAllRead(body.repSlug);
      return NextResponse.json({ success: true, message: 'All notifications marked as read' });
    }

    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ids array is required' },
        { status: 400 }
      );
    }

    notificationCenterService.markMultipleAsRead(body.ids);

    return NextResponse.json({
      success: true,
      message: `${body.ids.length} notification(s) marked as read`,
    });
  } catch (error) {
    console.error('PATCH /api/notifications/center error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update notifications' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/notifications/center
 *
 * Body:
 *  - ids: string[] - notification IDs
 *  - action: 'archive' | 'delete' (default: 'archive')
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ids array is required' },
        { status: 400 }
      );
    }

    const action = body.action || 'archive';

    if (action === 'delete') {
      notificationCenterService.deleteMultiple(body.ids);
    } else {
      notificationCenterService.archiveMultiple(body.ids);
    }

    return NextResponse.json({
      success: true,
      message: `${body.ids.length} notification(s) ${action === 'delete' ? 'deleted' : 'archived'}`,
    });
  } catch (error) {
    console.error('DELETE /api/notifications/center error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process deletion' },
      { status: 500 }
    );
  }
}

// =============================================================================
// HELPERS
// =============================================================================

const VALID_TYPES: Set<string> = new Set([
  'lead_assigned', 'lead_warning', 'lead_reassigned', 'voicemail', 'missed_call',
  'appointment_reminder', 'delivery_update', 'inventory_alert', 'customer_message',
  'system_alert', 'team_announcement', 'document_shared', 'approval_needed',
  'payment_received', 'job_status_change', 'weather_alert', 'training_due',
]);

function isValidNotificationType(type: string): boolean {
  return VALID_TYPES.has(type);
}
