/**
 * Notification Center - Preferences API
 *
 * GET /api/notifications/center/preferences - Get preferences for a user
 * PUT /api/notifications/center/preferences - Update preferences for a user
 */

import { NextRequest, NextResponse } from 'next/server';
import { notificationCenterService } from '@/lib/notification-center-service';

/**
 * GET /api/notifications/center/preferences
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

    const preferences = notificationCenterService.getPreferences(repSlug);

    return NextResponse.json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    console.error('GET /api/notifications/center/preferences error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch preferences' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/notifications/center/preferences
 *
 * Body:
 *  - repSlug (required): user identifier
 *  - channels?: { inPortal, groupme, sms, email }
 *  - quietHours?: { start, end, enabled }
 *  - mutedTypes?: string[]
 *  - urgentOnly?: boolean
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.repSlug) {
      return NextResponse.json(
        { success: false, error: 'repSlug is required' },
        { status: 400 }
      );
    }

    const updated = notificationCenterService.updatePreferences(body.repSlug, {
      channels: body.channels,
      quietHours: body.quietHours,
      mutedTypes: body.mutedTypes,
      urgentOnly: body.urgentOnly,
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('PUT /api/notifications/center/preferences error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}
