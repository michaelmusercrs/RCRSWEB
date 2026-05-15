import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { requireAuth } from '@/lib/auth-service';

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

    const allowedPhotoTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (!allowedPhotoTypes.includes(photo.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, WebP, HEIC' },
        { status: 400 }
      );
    }

    const maxPhotoSize = 15 * 1024 * 1024;
    if (photo.size > maxPhotoSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 15MB' },
        { status: 400 }
      );
    }

    const safeTicketId = ticketId.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeStage = stage.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeName = photo.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `delivery-photos/${safeTicketId}/${safeStage}/${Date.now()}-${safeName}`;

    const blob = await put(path, photo, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    return NextResponse.json({
      success: true,
      photo: {
        id: `photo-${Date.now()}`,
        ticketId,
        stage,
        filename: photo.name,
        size: photo.size,
        type: photo.type,
        gpsLocation: gpsLocation || null,
        uploadedAt: new Date().toISOString(),
        url: blob.url,
      },
    });
  } catch (error) {
    console.error('Photo upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload photo' },
      { status: 500 }
    );
  }
}
