/**
 * RCRS Reviews API
 *
 * GET  /api/reviews - List reviews with filters
 * POST /api/reviews - Add a new review
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { reviewManagementService, ReviewPlatform } from '@/lib/review-management-service';

/**
 * GET /api/reviews
 *
 * Query params:
 * - platform: google | facebook | yelp | bbb | internal | homeadvisor
 * - repSlug: filter by rep
 * - rating: filter by exact rating (1-5)
 * - limit: max results
 * - featured: "true" for featured only
 * - published: "true" or "false"
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform') as ReviewPlatform | null;
    const repSlug = searchParams.get('repSlug') || undefined;
    const ratingStr = searchParams.get('rating');
    const rating = ratingStr ? parseInt(ratingStr, 10) : undefined;
    const limitStr = searchParams.get('limit');
    const limit = limitStr ? parseInt(limitStr, 10) : undefined;
    const featuredStr = searchParams.get('featured');
    const featured = featuredStr === 'true' ? true : featuredStr === 'false' ? false : undefined;
    const publishedStr = searchParams.get('published');
    const published = publishedStr === 'true' ? true : publishedStr === 'false' ? false : undefined;

    const reviews = reviewManagementService.getReviews({
      platform: platform || undefined,
      repSlug,
      rating,
      limit,
      featured,
      published,
    });

    const stats = reviewManagementService.getReviewStats();

    return NextResponse.json({
      success: true,
      reviews,
      total: reviews.length,
      stats,
    });
  } catch (error) {
    console.error('[Reviews API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reviews
 *
 * Body:
 * - customerName: string (required)
 * - address: string (required)
 * - platform: ReviewPlatform (required)
 * - rating: number 1-5 (required)
 * - content: string (required)
 * - title: string (optional)
 * - customerId: string (optional)
 * - jobId: string (optional)
 * - repSlug: string (optional)
 * - repName: string (optional)
 * - photos: string[] (optional)
 * - isPublished: boolean (optional, default true)
 * - isFeatured: boolean (optional, default false)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const required = ['customerName', 'address', 'platform', 'rating', 'content'];
    const missing = required.filter(f => !body[f] && body[f] !== 0);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate rating
    const rating = parseInt(body.rating, 10);
    if (isNaN(rating) || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    // Validate platform
    const validPlatforms = ['google', 'facebook', 'yelp', 'bbb', 'internal', 'homeadvisor'];
    if (!validPlatforms.includes(body.platform)) {
      return NextResponse.json(
        { error: `Invalid platform. Must be one of: ${validPlatforms.join(', ')}` },
        { status: 400 }
      );
    }

    const review = reviewManagementService.addReview({
      customerId: body.customerId,
      customerName: body.customerName,
      address: body.address,
      jobId: body.jobId,
      platform: body.platform,
      rating,
      title: body.title,
      content: body.content,
      repSlug: body.repSlug,
      repName: body.repName,
      isPublished: body.isPublished,
      isFeatured: body.isFeatured,
      photos: body.photos,
    });

    return NextResponse.json({
      success: true,
      review,
    }, { status: 201 });
  } catch (error) {
    console.error('[Reviews API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to add review' },
      { status: 500 }
    );
  }
}
