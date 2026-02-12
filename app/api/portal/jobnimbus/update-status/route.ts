// POST /api/portal/jobnimbus/update-status
// Push status updates from our portal to JobNimbus

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { isJobNimbusConfigured } from '@/lib/jobnimbus-service';
import { jnSyncEngine, PORTAL_TO_JN_STATUS } from '@/lib/jn-sync-engine';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  if (!isJobNimbusConfigured()) {
    return NextResponse.json(
      { success: false, error: 'JobNimbus API not configured' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { jobJnid, newStatus } = body;

    if (!jobJnid || !newStatus) {
      return NextResponse.json(
        { success: false, error: 'jobJnid and newStatus are required' },
        { status: 400 }
      );
    }

    // Validate that the status is a known mapping
    const jnStatus = PORTAL_TO_JN_STATUS[newStatus];
    if (!jnStatus) {
      return NextResponse.json(
        {
          success: false,
          error: `Unknown status: ${newStatus}. Valid statuses: ${Object.keys(PORTAL_TO_JN_STATUS).join(', ')}`,
        },
        { status: 400 }
      );
    }

    const result = await jnSyncEngine.pushStatusUpdate(
      jobJnid,
      newStatus,
      auth.user.name
    );

    return NextResponse.json({
      success: result.success,
      message: result.message,
      jobJnid,
      portalStatus: newStatus,
      jnStatus,
      updatedBy: auth.user.name,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error updating JN status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update status',
      },
      { status: 500 }
    );
  }
}
