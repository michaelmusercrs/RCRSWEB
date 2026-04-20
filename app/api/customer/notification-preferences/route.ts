import { NextRequest, NextResponse } from 'next/server';
import { leadPortalService } from '@/lib/lead-portal-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_PREFERENCES = {
  emailNotifications: true,
  smsNotifications: true,
  weatherAlerts: true,
  statusUpdates: true,
};

// Validate token and return customer info
async function validateCustomerToken(token: string) {
  if (!token) return null;

  const lead = await leadPortalService.getLeadByToken(token);
  if (lead) {
    return {
      customerId: lead.customerId,
      customerName: lead.customerName,
    };
  }

  return null;
}

// GET - Get notification preferences
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 401 });
    }

    const customer = await validateCustomerToken(token);
    if (!customer) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // TODO: persist per-customer preferences. Until then, always return defaults.
    return NextResponse.json({
      preferences: {
        customerId: customer.customerId,
        ...DEFAULT_PREFERENCES,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
  }
}

// PUT - Update notification preferences
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, emailNotifications, smsNotifications, weatherAlerts, statusUpdates } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 401 });
    }

    const customer = await validateCustomerToken(token);
    if (!customer) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const now = new Date().toISOString();

    const updatedPrefs = {
      customerId: customer.customerId,
      emailNotifications: typeof emailNotifications === 'boolean' ? emailNotifications : DEFAULT_PREFERENCES.emailNotifications,
      smsNotifications: typeof smsNotifications === 'boolean' ? smsNotifications : DEFAULT_PREFERENCES.smsNotifications,
      weatherAlerts: typeof weatherAlerts === 'boolean' ? weatherAlerts : DEFAULT_PREFERENCES.weatherAlerts,
      statusUpdates: typeof statusUpdates === 'boolean' ? statusUpdates : DEFAULT_PREFERENCES.statusUpdates,
      updatedAt: now,
    };

    // TODO: persist updatedPrefs once leadPortalService has upsertNotificationPrefs.
    return NextResponse.json({
      success: true,
      preferences: updatedPrefs,
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
  }
}
