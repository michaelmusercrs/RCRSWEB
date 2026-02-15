import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';

// POST - Upload delivery photo for a pipeline stage
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const formData = await req.formData();
    const photo = formData.get('photo') as File | null;
    const ticketId = formData.get('ticketId') as string;
    const stage = formData.get('stage') as string;
    const gpsLocation = formData.get('gpsLocation') as string | null;

    if (!photo || !ticketId || !stage) {
      return NextResponse.json({ error: 'Missing required fields: photo, ticketId, stage' }, { status: 400 });
    }

    // SECURITY: Validate file type
    const allowedPhotoTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (!allowedPhotoTypes.includes(photo.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, WebP, HEIC' },
        { status: 400 }
      );
    }

    // SECURITY: Validate file size (max 15MB for delivery photos)
    const maxPhotoSize = 15 * 1024 * 1024;
    if (photo.size > maxPhotoSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 15MB' },
        { status: 400 }
      );
    }

    // SECURITY: Sanitize ticketId and stage to prevent path traversal
    const safeTicketId = ticketId.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeStage = stage.replace(/[^a-zA-Z0-9_-]/g, '');

    // In production: upload to cloud storage (S3, GCS, etc.)
    // For now, log the upload and return success
    const metadata = {
      ticketId,
      stage,
      filename: photo.name,
      size: photo.size,
      type: photo.type,
      gpsLocation: gpsLocation || null,
      uploadedAt: new Date().toISOString(),
    };
    return NextResponse.json({
      success: true,
      photo: {
        id: `photo-${Date.now()}`,
        ...metadata,
        url: `/uploads/delivery/${safeTicketId}/${safeStage}/${photo.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`,
      },
    });
  } catch (error) {
    console.error('Photo upload error:', error);
    return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 });
  }
}
