/**
 * RCRS Review Request API
 *
 * GET  /api/reviews/request - List review requests with status
 * POST /api/reviews/request - Send a review request to customer
 *
 * Rate limit: max 1 request per customer email per 30 days
 *
 * @author RCRS Development Team
 * @version 2.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  reviewManagementService,
  RequestStatus,
  GOOGLE_REVIEW_URL,
} from '@/lib/review-management-service';

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
      googleReviewUrl: GOOGLE_REVIEW_URL,
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
 * - jobType: string (required) - e.g., "Roof Replacement", "Roof Repair"
 * - completionDate: string (optional) - ISO date of job completion
 * - repSlug: string (required)
 * - repName: string (optional) - display name of the rep
 * - method: "sms" | "email" | "both" (required)
 * - jobId: string (optional)
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
      const updated = reviewManagementService.updateRequestStatus(
        body.requestId,
        body.status
      );
      if (!updated) {
        return NextResponse.json(
          { error: 'Review request not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, request: updated });
    }

    // Create new review request
    const requiredFields = [
      'customerName',
      'customerPhone',
      'customerEmail',
      'jobType',
      'repSlug',
      'method',
    ];
    const missing = requiredFields.filter(f => !body[f]);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.customerEmail)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Validate method
    const validMethods = ['sms', 'email', 'both'];
    if (!validMethods.includes(body.method)) {
      return NextResponse.json(
        {
          error: `Invalid method. Must be one of: ${validMethods.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Rate limit check: max 1 request per customer email per 30 days
    const existingRequest = reviewManagementService.checkRateLimit(
      body.customerEmail
    );
    if (existingRequest) {
      const sentDate = new Date(existingRequest.createdAt);
      const formattedDate = sentDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      return NextResponse.json(
        {
          error: `A review request was already sent to this email on ${formattedDate}. Please wait 30 days between requests.`,
          existingRequest: {
            id: existingRequest.id,
            sentAt: existingRequest.sentAt,
            status: existingRequest.status,
          },
        },
        { status: 429 }
      );
    }

    const reviewRequest = await reviewManagementService.sendReviewRequest({
      customerId: body.customerId,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      customerEmail: body.customerEmail,
      jobId: body.jobId || `JOB-${Date.now()}`,
      jobType: body.jobType,
      completionDate: body.completionDate,
      repSlug: body.repSlug,
      repName: body.repName,
      method: body.method,
    });

    return NextResponse.json(
      {
        success: true,
        request: reviewRequest,
        googleReviewUrl: GOOGLE_REVIEW_URL,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[ReviewRequest API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process review request' },
      { status: 500 }
    );
  }
}
