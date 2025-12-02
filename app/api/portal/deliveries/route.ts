import { NextRequest, NextResponse } from 'next/server';
import { deliveryPortalService } from '@/lib/delivery-portal-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const driverId = searchParams.get('driverId') || undefined;
    const status = searchParams.get('status') as any || undefined;
    const date = searchParams.get('date') || undefined;

    const deliveries = await deliveryPortalService.getDeliveries(driverId, status, date);
    return NextResponse.json(deliveries);
  } catch (error) {
    console.error('Error fetching deliveries:', error);
    return NextResponse.json({ error: 'Failed to fetch deliveries' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const delivery = await deliveryPortalService.createDelivery(data);
    return NextResponse.json(delivery);
  } catch (error) {
    console.error('Error creating delivery:', error);
    return NextResponse.json({ error: 'Failed to create delivery' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const data = await request.json();
    const { deliveryId, action, ...updates } = data;

    switch (action) {
      case 'confirmLoad':
        await deliveryPortalService.confirmLoad(deliveryId, updates.driverName);
        break;
      case 'updateStatus':
        await deliveryPortalService.updateDeliveryStatus(deliveryId, updates.status, updates);
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating delivery:', error);
    return NextResponse.json({ error: 'Failed to update delivery' }, { status: 500 });
  }
}
