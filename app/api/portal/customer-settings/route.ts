import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth-service';
import {
  customerPortalService,
  CustomerSettingsOverride,
  PORTAL_SETTING_KEYS,
} from '@/lib/customer-portal-service';

// GET - Fetch per-customer settings
// ?customerId=X  → single customer's overrides
// ?repSlug=X     → all customers for a rep
export async function GET(request: NextRequest) {
  const session = await validateSession();
  if (!session.valid) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const repSlug = searchParams.get('repSlug');

    if (customerId) {
      const settings = await customerPortalService.getCustomerSettings(customerId);
      return NextResponse.json({
        success: true,
        data: settings,
      });
    }

    if (repSlug) {
      const allSettings = await customerPortalService.getCustomerSettingsForRep(repSlug);
      return NextResponse.json({
        success: true,
        data: allSettings,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Provide customerId or repSlug query parameter' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error fetching customer settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch customer settings' },
      { status: 500 }
    );
  }
}

// PUT - Save per-customer settings overrides
export async function PUT(request: NextRequest) {
  const session = await validateSession();
  if (!session.valid) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { customerId, repSlug, settings } = body;

    if (!customerId || !repSlug) {
      return NextResponse.json(
        { success: false, error: 'customerId and repSlug are required' },
        { status: 400 }
      );
    }

    // Validate settings keys
    const validSettings: Partial<CustomerSettingsOverride> = {};
    for (const key of PORTAL_SETTING_KEYS) {
      if (key in settings) {
        const val = settings[key];
        (validSettings as any)[key] = val === null ? null : Boolean(val);
      }
    }

    await customerPortalService.saveCustomerSettings(
      customerId,
      repSlug,
      validSettings,
      session.user?.name || 'rep'
    );

    // Return the effective settings after saving
    const effective = await customerPortalService.getEffectiveCustomerSettings(repSlug, customerId);

    return NextResponse.json({
      success: true,
      message: 'Customer settings saved',
      effectiveSettings: effective,
    });
  } catch (error) {
    console.error('Error saving customer settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save customer settings' },
      { status: 500 }
    );
  }
}
