import { NextRequest, NextResponse } from 'next/server';
import { deliveryPortalService } from '@/lib/delivery-portal-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as any || undefined;

    const requests = await deliveryPortalService.getRestockRequests(status);
    return NextResponse.json(requests);
  } catch (error) {
    console.error('Error fetching restock requests:', error);
    return NextResponse.json({ error: 'Failed to fetch restock requests' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const restockRequest = await deliveryPortalService.createRestockRequest(data);
    return NextResponse.json(restockRequest);
  } catch (error) {
    console.error('Error creating restock request:', error);
    return NextResponse.json({ error: 'Failed to create restock request' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const data = await request.json();
    const { requestId, approvedBy } = data;

    await deliveryPortalService.approveRestockRequest(requestId, approvedBy);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error approving restock request:', error);
    return NextResponse.json({ error: 'Failed to approve restock request' }, { status: 500 });
  }
}
