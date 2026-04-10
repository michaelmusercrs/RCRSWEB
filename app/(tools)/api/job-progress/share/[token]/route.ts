/**
 * RCRS Job Progress Share API
 *
 * GET /api/job-progress/share/[token] - Get customer-visible timeline (no auth required)
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { jobProgressService } from '@/lib/job-progress-service';

/**
 * GET /api/job-progress/share/[token]
 *
 * Public endpoint for customer-facing timeline view.
 * Only returns photos and entries marked as customer-visible.
 * No authentication required.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const timeline = await jobProgressService.getCustomerTimeline(params.token);

    if (!timeline) {
      return NextResponse.json(
        { error: 'Timeline not found or link has expired' },
        { status: 404 }
      );
    }

    // Mark as viewed
    await jobProgressService.markCustomerViewed(params.token);

    return NextResponse.json({
      success: true,
      timeline: {
        customerName: timeline.customerName,
        address: timeline.address,
        status: timeline.status,
        startDate: timeline.startDate,
        completionDate: timeline.completionDate,
        entries: timeline.entries,
        totalPhotos: timeline.totalPhotos,
        completionPercentage: timeline.completionPercentage,
      },
    });
  } catch (error) {
    console.error('[JobProgress Share API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shared timeline' },
      { status: 500 }
    );
  }
}
