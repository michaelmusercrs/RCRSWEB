/**
 * RCRS Review Statistics API
 *
 * GET /api/reviews/stats - Get review statistics
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { reviewManagementService } from '@/lib/review-management-service';

/**
 * GET /api/reviews/stats
 *
 * Returns aggregate review statistics including:
 * - Total reviews and average rating
 * - Rating distribution (1-5 star counts)
 * - Breakdown by platform
 * - Breakdown by rep
 * - This month count
 * - Pending requests count
 * - Response rate
 */
export async function GET(request: NextRequest) {
  try {
    const stats = reviewManagementService.getReviewStats();

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('[ReviewStats API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch review statistics' },
      { status: 500 }
    );
  }
}
