/**
 * Profile Images API Route
 * Handles image/video uploads for sales rep profiles using Vercel Blob
 * Approval metadata is stored in profile-image-metadata.json
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireAdmin } from '@/lib/auth-service';
import { ProfileImage } from '@/lib/profile-types';
import { readImageMetadata, saveImageMetadata } from '@/lib/portal-images';

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
    const pending = searchParams.get('pending') === 'true';

    let images = await readImageMetadata();

    // Filter by rep slug
    if (repSlug) {
      images = images.filter(img => {
        const parts = img.id.split('/');
        return parts[1] === repSlug;
      });
    }

    // Filter pending only (for admin view)
    if (pending) {
      images = images.filter(img => !img.approved);
    }

    return NextResponse.json({
      success: true,
      images,
      count: images.length,
    });
  } catch (error) {
    console.error('Error listing profile images:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list images' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/profile/images
 * Upload a new profile image or video
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
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }
    if (!repSlug) {
      return NextResponse.json({ success: false, error: 'Rep slug is required' }, { status: 400 });
    }

    // Validate file type (images + videos)
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    const allAllowed = [...allowedImageTypes, ...allowedVideoTypes];

    if (!allAllowed.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Allowed: JPEG, PNG, WebP, MP4, WebM, MOV' },
        { status: 400 }
      );
    }

    // Validate file size (10MB for images, 50MB for videos)
    const isVideo = allowedVideoTypes.includes(file.type);
    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: `File too large. Maximum: ${isVideo ? '50MB' : '10MB'}` },
        { status: 400 }
      );
    }

    // Auto-set type to 'video' for video files
    const effectiveType = isVideo ? 'video' as ProfileImage['type'] : imageType;

    // Generate filename
    const ext = file.name.split('.').pop() || (isVideo ? 'mp4' : 'jpg');
    const filename = `${generateId()}.${ext}`;
    const pathname = `profiles/${repSlug}/${effectiveType}/${filename}`;

    // Upload to Vercel Blob
    let blobUrl: string;
    try {
      const { put } = await import('@vercel/blob');
      const blob = await put(pathname, file, {
        access: 'public',
        contentType: file.type,
      });
      blobUrl = blob.url;
    } catch {
      // Fallback: save locally for dev
      const fs = await import('fs');
      const path = await import('path');
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', repSlug, effectiveType);
      fs.mkdirSync(uploadDir, { recursive: true });
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(path.join(uploadDir, filename), buffer);
      blobUrl = `/uploads/${repSlug}/${effectiveType}/${filename}`;
    }

    const imageData: ProfileImage = {
      id: pathname,
      type: effectiveType,
      url: blobUrl,
      thumbnailUrl: blobUrl,
      filename,
      uploadedAt: new Date().toISOString(),
      uploadedBy,
      approved: false, // Requires admin approval
    };

    // Save to metadata store
    const allImages = await readImageMetadata();
    allImages.push(imageData);
    await saveImageMetadata(allImages);

    return NextResponse.json({
      success: true,
      image: imageData,
      message: `${isVideo ? 'Video' : 'Image'} uploaded successfully. Pending admin approval.`,
    });
  } catch (error) {
    console.error('Error uploading profile image:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/profile/images
 * Approve or update image metadata (admin only)
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await req.json();
    const { imageId, approved, approvedBy } = body;

    if (!imageId) {
      return NextResponse.json({ success: false, error: 'Image ID is required' }, { status: 400 });
    }

    const images = await readImageMetadata();
    const idx = images.findIndex(img => img.id === imageId);

    if (idx === -1) {
      return NextResponse.json({ success: false, error: 'Image not found' }, { status: 404 });
    }

    if (approved !== undefined) {
      images[idx].approved = approved;
      images[idx].approvedAt = new Date().toISOString();
      images[idx].approvedBy = approvedBy || 'Admin';
    }

    await saveImageMetadata(images);

    return NextResponse.json({
      success: true,
      message: approved ? 'Image approved' : 'Image updated',
      image: images[idx],
    });
  } catch (error) {
    console.error('Error updating profile image:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update image' },
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
      return NextResponse.json({ success: false, error: 'Image URL is required' }, { status: 400 });
    }

    // Delete from Vercel Blob
    try {
      const { del } = await import('@vercel/blob');
      await del(imageUrl);
    } catch {
      // Local dev - ignore blob errors
    }

    // Remove from metadata store
    const images = await readImageMetadata();
    const filtered = images.filter(img => img.url !== imageUrl);
    await saveImageMetadata(filtered);

    return NextResponse.json({
      success: true,
      message: 'Image deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting profile image:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete image' },
      { status: 500 }
    );
  }
}
