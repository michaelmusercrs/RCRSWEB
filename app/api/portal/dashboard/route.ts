import { NextResponse } from 'next/server';
import { deliveryPortalService } from '@/lib/delivery-portal-service';

// Fallback stats when Google Sheets is not configured
const FALLBACK_STATS = {
  totalOrders: 0,
  pendingOrders: 0,
  todayDeliveries: 0,
  activeDrivers: 0,
  completedToday: 0,
  lowStockItems: 0,
  recentActivity: [],
};

export async function GET() {
  try {
    // Check if Google Sheets credentials are configured
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      return NextResponse.json({
        ...FALLBACK_STATS,
        _note: 'Using fallback data - Google Sheets not configured',
      });
    }

    const stats = await deliveryPortalService.getDashboardStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    // Return fallback data instead of error
    return NextResponse.json({
      ...FALLBACK_STATS,
      _note: 'Using fallback data due to service error',
    });
  }
}
