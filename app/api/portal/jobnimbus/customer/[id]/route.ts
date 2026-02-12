// GET /api/portal/jobnimbus/customer/[id]
// Get full customer detail from JobNimbus (contact + jobs + estimates + tasks + notes + files + invoices)

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { isJobNimbusConfigured } from '@/lib/jobnimbus-service';
import { jnSyncEngine } from '@/lib/jn-sync-engine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  if (!isJobNimbusConfigured()) {
    return NextResponse.json(
      { success: false, error: 'JobNimbus API not configured' },
      { status: 500 }
    );
  }

  try {
    const { id: contactJnid } = await params;

    if (!contactJnid) {
      return NextResponse.json(
        { success: false, error: 'Contact ID is required' },
        { status: 400 }
      );
    }

    const data = await jnSyncEngine.getFullCustomerData(contactJnid);

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Contact not found in JobNimbus' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error fetching customer data:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch customer data',
      },
      { status: 500 }
    );
  }
}
