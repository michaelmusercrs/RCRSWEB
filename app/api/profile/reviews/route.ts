/**
 * Profile Reviews API Route
 * Handles CRUD operations for sales rep reviews
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { ProfileReview } from '@/lib/profile-types';

const BLOB_KEY = 'data/profile-reviews.json';
const LOCAL_PATH = 'data/profile-reviews.json';

// Generate unique ID
function generateId(): string {
  return `rev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

async function readReviews(): Promise<ProfileReview[]> {
  try {
    const { list } = await import('@vercel/blob');
    const blobs = await list({ prefix: BLOB_KEY });
    if (blobs.blobs.length > 0) {
      const res = await fetch(blobs.blobs[0].url, { cache: 'no-store' });
      if (res.ok) return await res.json();
    }
  } catch (e) { /* blob not available */ }
  try {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), LOCAL_PATH);
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveReviews(reviews: ProfileReview[]): Promise<void> {
  // Vercel Blob is canonical; fs is dev-only fallback wrapped in try/catch.
  try {
    const { put } = await import('@vercel/blob');
    await put(BLOB_KEY, JSON.stringify(reviews, null, 2), {
      access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true,
    });
    return;
  } catch (e) {
    console.warn('[profile/reviews] Blob write failed, attempting fs fallback:', e);
  }
  try {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), LOCAL_PATH);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(reviews, null, 2));
  } catch (fsErr) {
    console.warn('[profile/reviews] Local fs write skipped (read-only fs?):', fsErr);
  }
}

/**
 * GET /api/profile/reviews
 * List reviews for a specific rep or all pending reviews (admin)
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const repSlug = searchParams.get('repSlug');
    const pending = searchParams.get('pending') === 'true';
    const visible = searchParams.get('visible'); // 'true', 'false', or null for all

    let reviews = await readReviews();

    // Filter by rep slug
    if (repSlug) {
      reviews = reviews.filter((r) => r.repSlug === repSlug);
    }

    // Filter pending only (for admin view)
    if (pending) {
      reviews = reviews.filter((r) => !r.approved);
    }

    // Filter by visibility
    if (visible === 'true') {
      reviews = reviews.filter((r) => r.visible);
    } else if (visible === 'false') {
      reviews = reviews.filter((r) => !r.visible);
    }

    // Sort by date descending
    reviews.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      success: true,
      reviews,
      count: reviews.length,
    });
  } catch (error) {
    console.error('Error listing reviews:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list reviews',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/profile/reviews
 * Create a new review
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await req.json();
    const { repSlug, customerName, rating, text, source, date, createdBy } = body;

    // Validate required fields
    if (!repSlug || !customerName || !rating || !text) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: repSlug, customerName, rating, text' },
        { status: 400 }
      );
    }

    // Validate rating
    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    const reviews = await readReviews();

    const newReview: ProfileReview = {
      id: generateId(),
      repSlug,
      customerName,
      rating: Number(rating),
      text,
      source: source || 'direct',
      date: date || new Date().toISOString().split('T')[0],
      visible: false, // Not visible until rep toggles it on
      featured: false,
      createdAt: new Date().toISOString(),
      createdBy: createdBy || 'unknown',
      approved: false, // Requires admin approval
    };

    reviews.push(newReview);
    await saveReviews(reviews);

    return NextResponse.json({
      success: true,
      review: newReview,
      message: 'Review created successfully. Pending admin approval.',
    });
  } catch (error) {
    console.error('Error creating review:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create review',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/profile/reviews
 * Update review (approve, toggle visibility, edit, etc.)
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Review ID is required' },
        { status: 400 }
      );
    }

    const reviews = await readReviews();
    const reviewIndex = reviews.findIndex((r) => r.id === id);

    if (reviewIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Review not found' },
        { status: 404 }
      );
    }

    // Update allowed fields
    const allowedUpdates = ['visible', 'featured', 'approved', 'approvedBy', 'approvedAt', 'customerName', 'rating', 'text', 'source', 'date'];

    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        (reviews[reviewIndex] as any)[key] = updates[key];
      }
    }

    // If approving, set approval timestamp
    if (updates.approved && !reviews[reviewIndex].approvedAt) {
      reviews[reviewIndex].approvedAt = new Date().toISOString();
    }

    await saveReviews(reviews);

    return NextResponse.json({
      success: true,
      review: reviews[reviewIndex],
      message: 'Review updated successfully',
    });
  } catch (error) {
    console.error('Error updating review:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update review',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/profile/reviews
 * Delete a review
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Review ID is required' },
        { status: 400 }
      );
    }

    let reviews = await readReviews();
    const reviewIndex = reviews.findIndex((r) => r.id === id);

    if (reviewIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Review not found' },
        { status: 404 }
      );
    }

    reviews.splice(reviewIndex, 1);
    await saveReviews(reviews);

    return NextResponse.json({
      success: true,
      message: 'Review deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting review:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete review',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
