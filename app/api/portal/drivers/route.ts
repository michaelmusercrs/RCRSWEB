import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { deliveryPortalService } from '@/lib/delivery-portal-service';

export async function GET() {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const drivers = await deliveryPortalService.getDrivers();
    return NextResponse.json(drivers);
  } catch (error) {
    console.error('Error fetching drivers:', error);
    return NextResponse.json({ error: 'Failed to fetch drivers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // PIN-based driver auth removed - drivers now use email+password login
  return NextResponse.json(
    { success: false, error: 'PIN login has been removed. Please use email and password.' },
    { status: 410 }
  );
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

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
