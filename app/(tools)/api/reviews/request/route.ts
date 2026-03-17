/**
 * RCRS Review Request API
 *
 * GET  /api/reviews/request - List review requests
 * POST /api/reviews/request - Send a review request to customer
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { reviewManagementService, RequestStatus } from '@/lib/review-management-service';

/**
 * GET /api/reviews/request
 *
 * Query params:
 * - status: pending | sent | opened | completed | declined
 * - repSlug: filter by rep
 * - limit: max results
 * - pending: "true" for pending requests only
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as RequestStatus | null;
    const repSlug = searchParams.get('repSlug') || undefined;
    const limitStr = searchParams.get('limit');
    const limit = limitStr ? parseInt(limitStr, 10) : undefined;
    const pending = searchParams.get('pending');

    if (pending === 'true') {
      const requests = reviewManagementService.getPendingRequests();
      return NextResponse.json({
        success: true,
        requests,
        total: requests.length,
      });
    }

    const requests = reviewManagementService.getReviewRequests({
      status: status || undefined,
      repSlug,
      limit,
    });

    return NextResponse.json({
      success: true,
      requests,
      total: requests.length,
    });
  } catch (error) {
    console.error('[ReviewRequest API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch review requests' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reviews/request
 *
 * Body:
 * - customerName: string (required)
 * - customerPhone: string (required)
 * - customerEmail: string (required)
 * - jobId: string (required)
 * - repSlug: string (required)
 * - method: "sms" | "email" | "both" (required)
 * - customerId: string (optional)
 *
 * Additional actions:
 * - action: "remind" - Send a reminder
 *   - requestId: string
 * - action: "update_status" - Update request status
 *   - requestId: string
 *   - status: RequestStatus
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Handle action-based requests
    if (body.action === 'remind') {
      if (!body.requestId) {
        return NextResponse.json(
          { error: 'Missing requestId' },
          { status: 400 }
        );
      }
      const updated = reviewManagementService.sendReminder(body.requestId);
      if (!updated) {
        return NextResponse.json(
          { error: 'Review request not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, request: updated });
    }

    if (body.action === 'update_status') {
      if (!body.requestId || !body.status) {
        return NextResponse.json(
          { error: 'Missing requestId or status' },
          { status: 400 }
        );
      }
      const updated = reviewManagementService.updateRequestStatus(body.requestId, body.status);
      if (!updated) {
        return NextResponse.json(
          { error: 'Review request not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, request: updated });
    }

    // Create new review request
    const required = ['customerName', 'customerPhone', 'customerEmail', 'jobId', 'repSlug', 'method'];
    const missing = required.filter(f => !body[f]);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate method
    const validMethods = ['sms', 'email', 'both'];
    if (!validMethods.includes(body.method)) {
      return NextResponse.json(
        { error: `Invalid method. Must be one of: ${validMethods.join(', ')}` },
        { status: 400 }
      );
    }

    const reviewRequest = reviewManagementService.sendReviewRequest({
      customerId: body.customerId,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      customerEmail: body.customerEmail,
      jobId: body.jobId,
      repSlug: body.repSlug,
      method: body.method,
    });

    return NextResponse.json({
      success: true,
      request: reviewRequest,
    }, { status: 201 });
  } catch (error) {
    console.error('[ReviewRequest API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process review request' },
      { status: 500 }
    );
  }
}
