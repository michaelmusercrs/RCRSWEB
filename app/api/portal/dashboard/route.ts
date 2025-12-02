import { NextResponse } from 'next/server';
import { deliveryPortalService } from '@/lib/delivery-portal-service';

export async function GET() {
  try {
    const stats = await deliveryPortalService.getDashboardStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}
