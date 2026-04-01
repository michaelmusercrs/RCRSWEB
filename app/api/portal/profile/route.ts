/**
 * Portal Profile API
 * GET: Load current profile for authenticated rep
 * PUT: Submit profile changes for approval
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { auditLog } from '@/lib/audit-logger';
import { teamMembers } from '@/lib/teamData';
import { TEAM_MEMBERS } from '@/lib/team-roles';
import { profileApprovalService, ProfileChanges } from '@/lib/profile-approval-service';
import { promises as fs } from 'fs';
import path from 'path';

const OVERRIDES_FILE = path.join(process.cwd(), 'data', 'profile-overrides.json');

async function readOverrides(): Promise<Record<string, Record<string, unknown>>> {
  try {
    const data = await fs.readFile(OVERRIDES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

/**
 * GET /api/portal/profile
 * Returns the authenticated user's profile data merged with any approved overrides
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    // Find user in team-roles to get slug
    const authMember = TEAM_MEMBERS.find(m => m.id === auth.user.userId);
    if (!authMember) {
      return NextResponse.json({ success: false, error: 'User not found in team' }, { status: 404 });
    }

    // Find team member data
    const member = teamMembers.find(m => m.slug === authMember.slug);
    if (!member) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
    }

    // Get approved overrides
    const overrides = await readOverrides();
    const profileOverrides = overrides[member.slug] || {};

    // Check for pending edit
    const pendingEdit = await profileApprovalService.getPendingEditForUser(auth.user.userId);

    // Build merged profile
    const profile = {
      slug: member.slug,
      name: member.name,
      position: member.position,
      category: member.category,
      email: (profileOverrides.email as string) || member.email,
      phone: (profileOverrides.phone as string) || member.phone,
      altEmail: (profileOverrides.altEmail as string) || member.altEmail,
      bio: (profileOverrides.bio as string) || member.bio,
      tagline: (profileOverrides.tagline as string) || member.tagline || '',
      region: member.region,
      profileImage: (profileOverrides.profileImage as string) || member.profileImage || '',
      truckImage: (profileOverrides.truckImage as string) || member.truckImage || '',
      facebook: (profileOverrides.facebook as string) || member.facebook || '',
      instagram: (profileOverrides.instagram as string) || member.instagram || '',
      x: (profileOverrides.x as string) || member.x || '',
      tiktok: (profileOverrides.tiktok as string) || member.tiktok || '',
      linkedin: (profileOverrides.linkedin as string) || member.linkedin || '',
      keyStrengths: (profileOverrides.keyStrengths as string[]) || member.keyStrengths || [],
      responsibilities: (profileOverrides.responsibilities as string[]) || member.responsibilities || [],
      hasPendingEdit: !!pendingEdit,
      pendingEdit: pendingEdit ? {
        id: pendingEdit.id,
        submittedAt: pendingEdit.submittedAt,
        changes: pendingEdit.changes,
      } : null,
    };

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error('Error loading profile:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load profile' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/portal/profile
 * Submit profile changes for admin approval
 */
export async function PUT(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await req.json();
    const { changes } = body as { changes: ProfileChanges };

    if (!changes || Object.keys(changes).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No changes provided' },
        { status: 400 }
      );
    }

    // Find user
    const authMember = TEAM_MEMBERS.find(m => m.id === auth.user.userId);
    if (!authMember) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const member = teamMembers.find(m => m.slug === authMember.slug);
    if (!member) {
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
    }

    // Build original data for comparison
    const originalData: ProfileChanges = {
      bio: member.bio,
      tagline: member.tagline,
      phone: member.phone,
      email: member.email,
      altEmail: member.altEmail,
      profileImage: member.profileImage,
      facebook: member.facebook,
      instagram: member.instagram,
      x: member.x,
      tiktok: member.tiktok,
      linkedin: member.linkedin,
      keyStrengths: member.keyStrengths,
      responsibilities: member.responsibilities,
    };

    // Submit edit request
    const editRequest = await profileApprovalService.submitEdit({
      userId: auth.user.userId,
      userName: auth.user.name,
      userEmail: auth.user.email,
      userSlug: authMember.slug,
      changes,
      originalData,
    });

    auditLog('PROFILE_EDIT', auth.user.email, `Submitted profile changes: ${Object.keys(changes).join(', ')}`, req);

    return NextResponse.json({
      success: true,
      message: 'Profile changes submitted for approval',
      editRequest: {
        id: editRequest.id,
        status: editRequest.status,
        submittedAt: editRequest.submittedAt,
      },
    });
  } catch (error) {
    console.error('Error submitting profile changes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit profile changes' },
      { status: 500 }
    );
  }
}
