/**
 * Portal Profile Pending Changes API
 * GET: List pending profile changes (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { profileApprovalService } from '@/lib/profile-approval-service';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const includeHistory = searchParams.get('history') === 'true';

    const edits = includeHistory
      ? await profileApprovalService.getAllEdits()
      : await profileApprovalService.getPendingEdits();

    const pendingCount = await profileApprovalService.getPendingCount();

    return NextResponse.json({
      success: true,
      edits,
      pendingCount,
      totalCount: edits.length,
    });
  } catch (error) {
    console.error('Error fetching pending edits:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch pending edits' },
      { status: 500 }
    );
  }
}
