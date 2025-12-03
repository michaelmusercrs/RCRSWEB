import { NextRequest, NextResponse } from 'next/server';
import { deliveryWorkflowService, PhotoType } from '@/lib/delivery-workflow-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get('ticketId');
    const photoType = searchParams.get('type') as PhotoType | null;

    if (!ticketId) {
      return NextResponse.json({ error: 'ticketId is required' }, { status: 400 });
    }

    const photos = await deliveryWorkflowService.getTicketPhotos(ticketId, photoType || undefined);
    return NextResponse.json(photos);
  } catch (error) {
    console.error('Photos API GET error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
