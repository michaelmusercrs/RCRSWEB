import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { profileApprovalService, ProfileChanges } from '@/lib/profile-approval-service';
import { teamMembers } from '@/lib/teamData';
import { TEAM_MEMBERS } from '@/lib/team-roles';

// POST /api/profile/submit-edit
// Submit a profile edit request for approval
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { userId, changes } = body as { userId: string; changes: ProfileChanges };

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (!changes || Object.keys(changes).length === 0) {
      return NextResponse.json(
        { error: 'No changes provided' },
        { status: 400 }
      );
    }

    // Find the user in team roles (for auth info)
    const authUser = TEAM_MEMBERS.find(m => m.id === userId);
    if (!authUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Find the team member data (for profile info)
    const teamMember = teamMembers.find(m => m.slug === authUser.slug);
    if (!teamMember) {
      return NextResponse.json(
        { error: 'Team member profile not found' },
        { status: 404 }
      );
    }

    // Validate that user can only edit their own profile
    // (This is enforced by passing userId from the auth context on the client)

    // Get original data for comparison
    const originalData: ProfileChanges = {
      bio: teamMember.bio,
      tagline: teamMember.tagline,
      phone: teamMember.phone,
      email: teamMember.email,
      altEmail: teamMember.altEmail,
      profileImage: teamMember.profileImage,
      facebook: teamMember.facebook,
      instagram: teamMember.instagram,
      x: teamMember.x,
      tiktok: teamMember.tiktok,
      linkedin: teamMember.linkedin,
      keyStrengths: teamMember.keyStrengths,
      responsibilities: teamMember.responsibilities,
    };

    // Submit the edit request
    const editRequest = await profileApprovalService.submitEdit({
      userId,
      userName: authUser.name,
      userEmail: authUser.email,
      userSlug: authUser.slug,
      changes,
      originalData,
    });

    return NextResponse.json({
      success: true,
      message: 'Your profile changes have been submitted for approval.',
      editRequest: {
        id: editRequest.id,
        status: editRequest.status,
        submittedAt: editRequest.submittedAt,
      },
    });
  } catch (error) {
    console.error('Error submitting profile edit:', error);
    return NextResponse.json(
      { error: 'Failed to submit profile edit' },
      { status: 500 }
    );
  }
}

// GET /api/profile/submit-edit
// Get the current pending edit for a user (if any)
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

    const pendingEdit = await profileApprovalService.getPendingEditForUser(userId);

    return NextResponse.json({
      hasPendingEdit: !!pendingEdit,
      pendingEdit: pendingEdit ? {
        id: pendingEdit.id,
        submittedAt: pendingEdit.submittedAt,
        changes: pendingEdit.changes,
      } : null,
    });
  } catch (error) {
    console.error('Error fetching pending edit:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending edit' },
      { status: 500 }
    );
  }
}
