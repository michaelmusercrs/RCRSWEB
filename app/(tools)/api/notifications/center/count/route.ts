/**
 * Notification Center - Unread Count API
 *
 * GET /api/notifications/center/count - Get unread count for a user
 *
 * Lightweight endpoint designed for frequent polling (bell badge).
 */

import { NextRequest, NextResponse } from 'next/server';
import { notificationCenterService } from '@/lib/notification-center-service';

/**
 * GET /api/notifications/center/count
 *
 * Query params:
 *  - repSlug (required): user identifier
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

    const unreadCount = notificationCenterService.getUnreadCount(repSlug);
    const unreadByType = notificationCenterService.getUnreadCountsByType(repSlug);

    return NextResponse.json({
      success: true,
      data: {
        unreadCount,
        unreadByType,
      },
    });
  } catch (error) {
    console.error('GET /api/notifications/center/count error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch unread count' },
      { status: 500 }
    );
  }
}
