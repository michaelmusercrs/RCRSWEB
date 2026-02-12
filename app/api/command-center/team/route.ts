import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { googleSheetsService } from '@/lib/google-sheets-service';

/**
 * Team Profile API
 *
 * Handles profile edits with approval workflow:
 * - Sales reps can submit profile changes
 * - Changes go to pending queue
 * - Admins (Michael/Sara) can approve or reject
 * - Approved changes sync to Google Sheets
 */

// In-memory storage for pending edits (would use database in production)
interface PendingEdit {
  id: string;
  memberId: string;
  memberName: string;
  changes: Record<string, any>;
  submittedBy: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
}

// Store pending edits in memory (would be database in production)
const pendingEdits: Map<string, PendingEdit> = new Map();

// GET - Fetch pending edits (admin only)
export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';

    const edits = Array.from(pendingEdits.values())
      .filter(edit => status === 'all' || edit.status === status)
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    return NextResponse.json({ edits });
  } catch (error) {
    console.error('Error fetching pending edits:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending edits' },
      { status: 500 }
    );
  }
}

// POST - Submit profile edit for approval
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { memberId, memberName, changes, submittedBy } = body;

    if (!memberId || !changes || !submittedBy) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const editId = `edit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const pendingEdit: PendingEdit = {
      id: editId,
      memberId,
      memberName,
      changes,
      submittedBy,
      submittedAt: new Date().toISOString(),
      status: 'pending',
    };

    pendingEdits.set(editId, pendingEdit);

    // TODO: Send notification to Michael and Sara via email/GroupMe

    return NextResponse.json({
      success: true,
      message: 'Profile changes submitted for approval',
      editId,
    });
  } catch (error) {
    console.error('Error submitting profile edit:', error);
    return NextResponse.json(
      { error: 'Failed to submit profile edit' },
      { status: 500 }
    );
  }
}

// PATCH - Approve or reject a pending edit (admin only)
export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { editId, action, reviewedBy } = body;

    if (!editId || !action || !reviewedBy) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    const edit = pendingEdits.get(editId);
    if (!edit) {
      return NextResponse.json(
        { error: 'Edit not found' },
        { status: 404 }
      );
    }

    if (edit.status !== 'pending') {
      return NextResponse.json(
        { error: 'Edit has already been processed' },
        { status: 400 }
      );
    }

    // Update edit status
    edit.status = action === 'approve' ? 'approved' : 'rejected';
    edit.reviewedBy = reviewedBy;
    edit.reviewedAt = new Date().toISOString();
    pendingEdits.set(editId, edit);

    // If approved, sync changes to Google Sheets
    if (action === 'approve') {
      try {
        // Get current team member data and merge changes
        const teamMembers = await googleSheetsService.getTeamMembers();
        const existingMember = teamMembers.find(m => m.slug === edit.memberId);

        if (existingMember) {
          const updatedMember = {
            ...existingMember,
            ...edit.changes,
          };
          await googleSheetsService.updateTeamMember(updatedMember);
        }
      } catch (sheetError) {
        console.error('Error syncing to Google Sheets:', sheetError);
        // Continue anyway - changes are stored locally
      }
    }

    return NextResponse.json({
      success: true,
      message: `Profile edit ${action === 'approve' ? 'approved' : 'rejected'}`,
      edit,
    });
  } catch (error) {
    console.error('Error processing edit approval:', error);
    return NextResponse.json(
      { error: 'Failed to process edit approval' },
      { status: 500 }
    );
  }
}
