/**
 * Admin Team Photo Upload
 *
 * Uploads a profile photo for a team member to Vercel Blob storage and
 * persists the public URL to the team member's profileImage field via the
 * existing team-members admin API.
 *
 * Admin/Owner only.
 *
 * POST /api/admin/team-photo-upload
 *   multipart/form-data:
 *     file: image file (JPEG/PNG/WebP/HEIC, max 5MB)
 *     slug: team member slug (e.g. "michael-muse")
 *     field?: "profileImage" | "truckImage"  (defaults to profileImage)
 */

import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { requireAuth } from '@/lib/auth-service';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const VALID_FIELDS = new Set(['profileImage', 'truckImage']);

export async function POST(request: NextRequest) {
  // Auth: admin/owner only
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;
  if (!['admin', 'owner'].includes(auth.user.role)) {
    return NextResponse.json(
      { success: false, error: 'Admin or owner role required' },
      { status: 403 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const slug = (formData.get('slug') as string | null)?.trim() || '';
    const fieldRaw = (formData.get('field') as string | null)?.trim() || 'profileImage';
    const field = VALID_FIELDS.has(fieldRaw) ? fieldRaw : 'profileImage';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'file is required' },
        { status: 400 }
      );
    }
    if (!slug) {
      return NextResponse.json(
        { success: false, error: 'slug is required' },
        { status: 400 }
      );
    }

    // Validate file type — must be a real image
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: `Invalid file type ${file.type}. Allowed: ${ALLOWED_TYPES.join(', ')}` },
        { status: 400 }
      );
    }
    if (file.size === 0) {
      return NextResponse.json(
        { success: false, error: 'File is empty' },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max ${MAX_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Build blob path. Include timestamp so each upload gets a unique URL
    // (no caching weirdness when the same slug uploads a new photo).
    const timestamp = Date.now();
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const safeSlug = slug.replace(/[^a-z0-9-]/gi, '').toLowerCase();
    const path = `team-photos/${safeSlug}/${field}-${timestamp}.${ext}`;

    // AWAIT the upload — must complete before returning so the URL is real
    const blob = await put(path, file, {
      access: 'public',
      addRandomSuffix: false,
      contentType: file.type,
    });

    // Update the team member record with the new image URL via the existing
    // admin team-members API. We do this server-side so the client only has
    // to make a single round-trip.
    const updateRes = await fetch(
      new URL(`/api/admin/team-members/${safeSlug}`, request.url).toString(),
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          // Forward auth cookie so the inner request authenticates
          cookie: request.headers.get('cookie') || '',
        },
        body: JSON.stringify({ [field]: blob.url }),
      }
    );

    if (!updateRes.ok) {
      const err = await updateRes.json().catch(() => ({}));
      // Photo is uploaded but the team member record update failed.
      // Return the URL anyway so the client can retry the metadata save
      // (or save it manually). Better than losing the upload.
      return NextResponse.json(
        {
          success: false,
          error: `Photo uploaded but team member update failed: ${err?.error || updateRes.status}`,
          url: blob.url,
          field,
          slug: safeSlug,
        },
        { status: 207 } // Multi-status — partial success
      );
    }

    return NextResponse.json({
      success: true,
      url: blob.url,
      field,
      slug: safeSlug,
      uploadedAt: new Date().toISOString(),
      uploadedBy: auth.user.name,
    });
  } catch (error) {
    console.error('[team-photo-upload] failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      },
      { status: 500 }
    );
  }
}
