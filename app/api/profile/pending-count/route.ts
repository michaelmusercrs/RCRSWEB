import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { profileApprovalService } from '@/lib/profile-approval-service';

// GET /api/profile/pending-count
// Get the count of pending profile edits (for badge display)
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const count = await profileApprovalService.getPendingCount();

    return NextResponse.json({
      count,
    });
  } catch (error) {
    console.error('Error fetching pending count:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending count', count: 0 },
      { status: 500 }
    );
  }
}
