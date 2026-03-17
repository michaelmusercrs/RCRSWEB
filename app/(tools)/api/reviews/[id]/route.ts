/**
 * RCRS Single Review API
 *
 * GET   /api/reviews/[id] - Get review details
 * PATCH /api/reviews/[id] - Update review (respond, feature, publish)
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { reviewManagementService } from '@/lib/review-management-service';

/**
 * GET /api/reviews/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const review = reviewManagementService.getReview(params.id);

    if (!review) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, review });
  } catch (error) {
    console.error('[Review API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch review' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/reviews/[id]
 *
 * Body options:
 * - action: "respond" - Add response to review
 *   - response: string
 *   - respondedBy: string
 * - action: "feature" - Toggle featured status
 *   - featured: boolean
 * - action: "publish" - Toggle publish status
 *   - published: boolean
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Missing action field' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'respond': {
        if (!body.response || !body.respondedBy) {
          return NextResponse.json(
            { error: 'Missing response or respondedBy' },
            { status: 400 }
          );
        }
        const review = reviewManagementService.respondToReview(
          params.id,
          body.response,
          body.respondedBy
        );
        if (!review) {
          return NextResponse.json({ error: 'Review not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true, review });
      }

      case 'feature': {
        if (body.featured === undefined) {
          return NextResponse.json(
            { error: 'Missing featured boolean' },
            { status: 400 }
          );
        }
        reviewManagementService.featureReview(params.id, body.featured);
        return NextResponse.json({ success: true, message: 'Featured status updated' });
      }

      case 'publish': {
        if (body.published === undefined) {
          return NextResponse.json(
            { error: 'Missing published boolean' },
            { status: 400 }
          );
        }
        reviewManagementService.publishReview(params.id, body.published);
        return NextResponse.json({ success: true, message: 'Publish status updated' });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Review API] PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update review' },
      { status: 500 }
    );
  }
}
