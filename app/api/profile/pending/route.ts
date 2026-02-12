import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { profileApprovalService } from '@/lib/profile-approval-service';

// GET /api/profile/pending
// Get all pending profile edit requests (admin only)
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const includeHistory = searchParams.get('history') === 'true';

    let edits;
    if (includeHistory) {
      edits = await profileApprovalService.getAllEdits();
    } else {
      edits = await profileApprovalService.getPendingEdits();
    }

    // Get pending count for badge
    const pendingCount = await profileApprovalService.getPendingCount();

    return NextResponse.json({
      edits,
      pendingCount,
      totalCount: edits.length,
    });
  } catch (error) {
    console.error('Error fetching pending edits:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending edits' },
      { status: 500 }
    );
  }
}
