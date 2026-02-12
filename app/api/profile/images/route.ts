/**
 * Profile Images API Route
 * Handles image uploads for sales rep profiles using Vercel Blob
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { put, del, list } from '@vercel/blob';
import { ProfileImage } from '@/lib/profile-types';

// Generate unique ID
function generateId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * GET /api/profile/images
 * List images for a specific rep or all pending images (admin)
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const repSlug = searchParams.get('repSlug');
    const type = searchParams.get('type') as ProfileImage['type'] | null;
    const pending = searchParams.get('pending') === 'true';

    // List blobs from Vercel Blob storage
    const { blobs } = await list({
      prefix: repSlug ? `profiles/${repSlug}/` : 'profiles/',
    });

    // Filter and map to ProfileImage structure
    let images: ProfileImage[] = blobs.map((blob) => {
      // Parse metadata from pathname: profiles/{repSlug}/{type}/{filename}
      const parts = blob.pathname.split('/');
      const imgType = (parts[2] || 'profile') as ProfileImage['type'];

      return {
        id: blob.pathname,
        type: imgType,
        url: blob.url,
        thumbnailUrl: blob.url, // Vercel Blob doesn't auto-generate thumbnails
        filename: parts[parts.length - 1],
        uploadedAt: blob.uploadedAt.toISOString(),
        uploadedBy: '', // Would need to store this separately
        approved: true, // Default to approved for now
      };
    });

    // Filter by type if specified
    if (type) {
      images = images.filter((img) => img.type === type);
    }

    // Filter pending only (for admin view)
    if (pending) {
      images = images.filter((img) => !img.approved);
    }

    return NextResponse.json({
      success: true,
      images,
      count: images.length,
    });
  } catch (error) {
    console.error('Error listing profile images:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list images',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/profile/images
 * Upload a new profile image
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const repSlug = formData.get('repSlug') as string | null;
    const imageType = (formData.get('type') as ProfileImage['type']) || 'profile';
    const uploadedBy = formData.get('uploadedBy') as string || 'unknown';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!repSlug) {
      return NextResponse.json(
        { success: false, error: 'Rep slug is required' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Allowed: JPEG, PNG, WebP' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum size: 10MB' },
        { status: 400 }
      );
    }

    // Generate filename
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `${generateId()}.${ext}`;
    const pathname = `profiles/${repSlug}/${imageType}/${filename}`;

    // Upload to Vercel Blob
    const blob = await put(pathname, file, {
      access: 'public',
      contentType: file.type,
    });

    const imageData: ProfileImage = {
      id: pathname,
      type: imageType,
      url: blob.url,
      thumbnailUrl: blob.url,
      filename,
      uploadedAt: new Date().toISOString(),
      uploadedBy,
      approved: false, // Require admin approval for new uploads
    };

    return NextResponse.json({
      success: true,
      image: imageData,
      message: 'Image uploaded successfully. Pending admin approval.',
    });
  } catch (error) {
    console.error('Error uploading profile image:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to upload image',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/profile/images
 * Approve or update image metadata
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await req.json();
    const { imageId, approved, approvedBy } = body;

    if (!imageId) {
      return NextResponse.json(
        { success: false, error: 'Image ID is required' },
        { status: 400 }
      );
    }

    // For now, we just return success
    // In a real implementation, you'd update a database record
    return NextResponse.json({
      success: true,
      message: approved ? 'Image approved' : 'Image updated',
      imageId,
      approved,
      approvedBy,
      approvedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error updating profile image:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update image',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/profile/images
 * Delete a profile image
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: 'Image URL is required' },
        { status: 400 }
      );
    }

    // Delete from Vercel Blob
    await del(imageUrl);

    return NextResponse.json({
      success: true,
      message: 'Image deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting profile image:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete image',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
