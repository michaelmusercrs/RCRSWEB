/**
 * Notifications API Route
 *
 * GET  - Fetch in-app notifications for the authenticated user
 * POST - Mark notification(s) as read
 * PUT  - Send a notification through the preference cascade
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import {
  notificationService,
  SendNotificationPayload,
  ALL_TRIGGERS,
  NotificationTrigger,
} from '@/lib/notification-service';

/**
 * GET /api/notifications
 * Query params:
 *   recipientId - repSlug or customerId
 *   unreadOnly  - 'true' to filter unread only
 *   limit       - max number of notifications
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const recipientId = searchParams.get('recipientId') || auth.user.userId || '';
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;

    const notifications = await notificationService.getInAppNotifications(recipientId, {
      unreadOnly,
      limit,
    });

    const unreadCount = notifications.filter(n => !n.read).length;

    return NextResponse.json({
      success: true,
      count: notifications.length,
      unreadCount,
      data: notifications,
    });
  } catch (error) {
    console.error('[Notifications API] GET error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications
 * Body:
 *   action: 'mark_read' | 'mark_all_read'
 *   notificationId?: string (for mark_read)
 *   recipientId?: string (for mark_all_read)
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { action, notificationId, recipientId } = body;

    if (action === 'mark_read' && notificationId) {
      const result = await notificationService.markNotificationRead(notificationId);
      return NextResponse.json({ success: result.success });
    }

    if (action === 'mark_all_read') {
      const id = recipientId || auth.user.userId || '';
      const result = await notificationService.markAllRead(id);
      return NextResponse.json({ success: result.success, markedRead: result.count });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use "mark_read" or "mark_all_read"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Notifications API] POST error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/notifications
 * Body: SendNotificationPayload
 * Sends a notification through all enabled channels based on preference cascade.
 */
export async function PUT(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json() as SendNotificationPayload;

    // Validate trigger
    if (!body.trigger || !ALL_TRIGGERS.includes(body.trigger as NotificationTrigger)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid or missing trigger',
          validTriggers: ALL_TRIGGERS,
        },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body.title || !body.message) {
      return NextResponse.json(
        { success: false, error: 'title and message are required' },
        { status: 400 }
      );
    }

    // Validate that at least one recipient is provided
    if (!body.recipientRepSlug && !body.recipientCustomerId && !body.recipientEmail) {
      return NextResponse.json(
        { success: false, error: 'At least one recipient (recipientRepSlug, recipientCustomerId, or recipientEmail) is required' },
        { status: 400 }
      );
    }

    const result = await notificationService.sendNotification(body);

    // Count channels that were actually sent
    const sentChannels = Object.entries(result.channelResults)
      .filter(([, r]) => r.sent)
      .map(([ch]) => ch);

    return NextResponse.json({
      success: true,
      trigger: result.trigger,
      sentVia: sentChannels,
      channelResults: result.channelResults,
    });
  } catch (error) {
    console.error('[Notifications API] PUT error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
