import { NextRequest, NextResponse } from 'next/server';
import { leadPortalService } from '@/lib/lead-portal-service';
import {
  getNotificationPreferences,
  setNotificationPreferences,
} from '@/lib/customer-portal-sheets';

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

    // Read persisted prefs from the Customer_Notification_Prefs sheet tab.
    // Falls back to DEFAULT_PREFERENCES when no row exists (first visit),
    // when env is unconfigured, or when the sheet read fails — the helper
    // returns null in all of those cases and never throws.
    const stored = await getNotificationPreferences(token);
    return NextResponse.json({
      preferences: {
        customerId: customer.customerId,
        emailNotifications: stored?.emailNotifications ?? DEFAULT_PREFERENCES.emailNotifications,
        smsNotifications: stored?.smsNotifications ?? DEFAULT_PREFERENCES.smsNotifications,
        weatherAlerts: stored?.weatherAlerts ?? DEFAULT_PREFERENCES.weatherAlerts,
        statusUpdates: stored?.statusUpdates ?? DEFAULT_PREFERENCES.statusUpdates,
        updatedAt: stored?.updatedAt || new Date().toISOString(),
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

    // Fire-and-forget sheet upsert. Never blocks the customer response,
    // never throws — see lib/customer-portal-sheets.ts.
    setNotificationPreferences(
      token,
      {
        emailNotifications: updatedPrefs.emailNotifications,
        smsNotifications: updatedPrefs.smsNotifications,
        weatherAlerts: updatedPrefs.weatherAlerts,
        statusUpdates: updatedPrefs.statusUpdates,
      },
      customer.customerId,
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      preferences: updatedPrefs,
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
  }
}
