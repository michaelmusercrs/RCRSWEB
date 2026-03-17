import { NextRequest, NextResponse } from 'next/server';
import { leadPortalService } from '@/lib/lead-portal-service';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'notification-preferences.json');

interface NotificationPreferences {
  customerId: string;
  emailNotifications: boolean;
  smsNotifications: boolean;
  weatherAlerts: boolean;
  statusUpdates: boolean;
  updatedAt: string;
}

interface PreferencesData {
  preferences: NotificationPreferences[];
}

function readData(): PreferencesData {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('[NotificationPreferences] Error reading data:', error);
  }
  return { preferences: [] };
}

function writeData(data: PreferencesData): void {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('[NotificationPreferences] Error writing data:', error);
    throw error;
  }
}

const DEFAULT_PREFERENCES: Omit<NotificationPreferences, 'customerId' | 'updatedAt'> = {
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

    const data = readData();
    const existing = data.preferences.find(p => p.customerId === customer.customerId);

    if (existing) {
      return NextResponse.json({ preferences: existing });
    }

    // Return defaults if no preferences saved
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

    const data = readData();
    const now = new Date().toISOString();

    const updatedPrefs: NotificationPreferences = {
      customerId: customer.customerId,
      emailNotifications: typeof emailNotifications === 'boolean' ? emailNotifications : DEFAULT_PREFERENCES.emailNotifications,
      smsNotifications: typeof smsNotifications === 'boolean' ? smsNotifications : DEFAULT_PREFERENCES.smsNotifications,
      weatherAlerts: typeof weatherAlerts === 'boolean' ? weatherAlerts : DEFAULT_PREFERENCES.weatherAlerts,
      statusUpdates: typeof statusUpdates === 'boolean' ? statusUpdates : DEFAULT_PREFERENCES.statusUpdates,
      updatedAt: now,
    };

    const existingIndex = data.preferences.findIndex(p => p.customerId === customer.customerId);
    if (existingIndex >= 0) {
      data.preferences[existingIndex] = updatedPrefs;
    } else {
      data.preferences.push(updatedPrefs);
    }

    writeData(data);

    return NextResponse.json({
      success: true,
      preferences: updatedPrefs,
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
  }
}
