import { NextRequest, NextResponse } from 'next/server';

// POST - Upload delivery photo for a pipeline stage
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const photo = formData.get('photo') as File | null;
    const ticketId = formData.get('ticketId') as string;
    const stage = formData.get('stage') as string;
    const gpsLocation = formData.get('gpsLocation') as string | null;

    if (!photo || !ticketId || !stage) {
      return NextResponse.json({ error: 'Missing required fields: photo, ticketId, stage' }, { status: 400 });
    }

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
        url: `/uploads/delivery/${ticketId}/${stage}/${photo.name}`,
      },
    });
  } catch (error) {
    console.error('Photo upload error:', error);
    return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 });
  }
}
