import { NextRequest, NextResponse } from 'next/server';
import { reviewManagementService } from '@/lib/review-management-service';
import { leadPortalService } from '@/lib/lead-portal-service';

const GOOGLE_REVIEW_URL = 'https://g.page/r/CdVKlmRIhPZ-EBM/review';

// Validate token and return customer info
async function validateCustomerToken(token: string) {
  if (!token) return null;

  const lead = await leadPortalService.getLeadByToken(token);
  if (lead) {
    return {
      customerId: lead.customerId,
      customerName: lead.customerName,
      customerAddress: lead.customerAddress || '',
      repSlug: lead.salesRepSlug,
      repName: lead.salesRepName,
      jobId: lead.jobnimbusId,
    };
  }

  return null;
}

// POST - Submit a customer review
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, rating, text, platform, customerName: nameOverride } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 401 });
    }

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'Review text is required' }, { status: 400 });
    }

    const customer = await validateCustomerToken(token);
    if (!customer) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // Map platform preference
    const reviewPlatform = platform === 'google' ? 'google'
      : platform === 'facebook' ? 'facebook'
      : 'internal';

    const review = reviewManagementService.addReview({
      customerId: customer.customerId,
      customerName: nameOverride || customer.customerName,
      address: customer.customerAddress,
      jobId: customer.jobId,
      platform: reviewPlatform,
      rating: Math.round(rating),
      content: text.trim(),
      repSlug: customer.repSlug,
      repName: customer.repName,
      isPublished: true,
      isFeatured: false,
      requestMethod: 'both',
    });

    return NextResponse.json({
      success: true,
      review: {
        id: review.id,
        rating: review.rating,
        content: review.content,
        platform: review.platform,
        createdAt: review.createdAt,
      },
      googleReviewUrl: GOOGLE_REVIEW_URL,
    });
  } catch (error) {
    console.error('Error submitting review:', error);
    return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 });
  }
}

// GET - Get existing reviews for this customer
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 401 });
    }

    const customer = await validateCustomerToken(token);
    if (!customer) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const allReviews = reviewManagementService.getReviews({ published: true });
    const customerReviews = allReviews.filter(r => r.customerId === customer.customerId);

    return NextResponse.json({
      reviews: customerReviews.map(r => ({
        id: r.id,
        rating: r.rating,
        content: r.content,
        platform: r.platform,
        createdAt: r.createdAt,
        response: r.response,
        respondedAt: r.respondedAt,
      })),
      googleReviewUrl: GOOGLE_REVIEW_URL,
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}
