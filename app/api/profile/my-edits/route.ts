import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { profileApprovalService } from '@/lib/profile-approval-service';

// GET /api/profile/my-edits
// Get edit history for a specific user
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const edits = await profileApprovalService.getUserEdits(userId);

    return NextResponse.json({
      edits,
      totalCount: edits.length,
      pendingCount: edits.filter(e => e.status === 'pending').length,
    });
  } catch (error) {
    console.error('Error fetching user edits:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user edits' },
      { status: 500 }
    );
  }
}

// DELETE /api/profile/my-edits
// Cancel a pending edit
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const editId = searchParams.get('editId');
    const userId = searchParams.get('userId');

    if (!editId || !userId) {
      return NextResponse.json(
        { error: 'Edit ID and User ID are required' },
        { status: 400 }
      );
    }

    const result = await profileApprovalService.cancelEdit(editId, userId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Pending edit cancelled.',
    });
  } catch (error) {
    console.error('Error cancelling edit:', error);
    return NextResponse.json(
      { error: 'Failed to cancel edit' },
      { status: 500 }
    );
  }
}
