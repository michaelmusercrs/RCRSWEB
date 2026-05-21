// Customer Portal Config API — admin ceiling for what tiles/fields/docs
// the customer portal can render. Owner/admin only.
import { NextRequest, NextResponse } from 'next/server';
import { requireRoleAtLeast } from '@/lib/auth-service';
import { getCustomerPortalConfig, saveCustomerPortalConfig, DEFAULT_CONFIG } from '@/lib/customer-portal-config';

export async function GET(_request: NextRequest) {
  const auth = await requireRoleAtLeast(['owner', 'admin', 'manager']);
  if (!auth.authenticated) return auth.response;
  return NextResponse.json({ success: true, config: getCustomerPortalConfig(), defaults: DEFAULT_CONFIG });
}

export async function PUT(request: NextRequest) {
  const auth = await requireRoleAtLeast(['owner', 'admin']);
  if (!auth.authenticated) return auth.response;
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid body' }, { status: 400 });
    }
    const ok = saveCustomerPortalConfig(body, auth.user.name || 'admin');
    return NextResponse.json({ success: ok, config: getCustomerPortalConfig() });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Internal error',
    }, { status: 500 });
  }
}
