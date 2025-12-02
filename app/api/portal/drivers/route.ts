import { NextRequest, NextResponse } from 'next/server';
import { deliveryPortalService } from '@/lib/delivery-portal-service';

export async function GET() {
  try {
    const drivers = await deliveryPortalService.getDrivers();
    return NextResponse.json(drivers);
  } catch (error) {
    console.error('Error fetching drivers:', error);
    return NextResponse.json({ error: 'Failed to fetch drivers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { pin } = data;

    // Driver login by PIN
    const driver = await deliveryPortalService.getDriverByPin(pin);

    if (driver) {
      return NextResponse.json({ success: true, driver });
    } else {
      return NextResponse.json({ success: false, error: 'Invalid PIN' }, { status: 401 });
    }
  } catch (error) {
    console.error('Error authenticating driver:', error);
    return NextResponse.json({ error: 'Failed to authenticate' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const data = await request.json();
    const { driverId, status, location } = data;

    await deliveryPortalService.updateDriverStatus(driverId, status, location);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating driver:', error);
    return NextResponse.json({ error: 'Failed to update driver' }, { status: 500 });
  }
}
