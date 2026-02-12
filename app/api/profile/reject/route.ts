import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { profileApprovalService } from '@/lib/profile-approval-service';

// POST /api/profile/reject
// Reject a pending profile edit request (admin only)
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { editId, reason } = body;
    const reviewerName = auth.user?.name || auth.user?.email || 'Admin';

    if (!editId) {
      return NextResponse.json(
        { error: 'Edit ID is required' },
        { status: 400 }
      );
    }

    // Reject the edit
    const result = await profileApprovalService.rejectEdit(editId, reviewerName, reason);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Profile edit rejected.',
      edit: result.edit,
    });
  } catch (error) {
    console.error('Error rejecting profile edit:', error);
    return NextResponse.json(
      { error: 'Failed to reject profile edit' },
      { status: 500 }
    );
  }
}
