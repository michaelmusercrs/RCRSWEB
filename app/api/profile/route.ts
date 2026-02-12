/**
 * Profile API Route
 * Handles profile updates and pending change management
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { promises as fs } from 'fs';
import path from 'path';
import { ProfileUpdate, PendingProfileChange } from '@/lib/profile-types';
import { teamMembers } from '@/lib/teamData';

// Path to store profile updates
const UPDATES_FILE = path.join(process.cwd(), 'data', 'profile-updates.json');
const PENDING_FILE = path.join(process.cwd(), 'data', 'pending-profile-changes.json');

// Generate unique ID
function generateId(): string {
  return `chg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Ensure data files exist
 */
async function ensureDataFiles() {
  const dataDir = path.join(process.cwd(), 'data');

  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }

  for (const file of [UPDATES_FILE, PENDING_FILE]) {
    try {
      await fs.access(file);
    } catch {
      await fs.writeFile(file, JSON.stringify([], null, 2));
    }
  }
}

async function readUpdates(): Promise<ProfileUpdate[]> {
  await ensureDataFiles();
  const data = await fs.readFile(UPDATES_FILE, 'utf-8');
  return JSON.parse(data);
}

async function saveUpdates(updates: ProfileUpdate[]): Promise<void> {
  await fs.writeFile(UPDATES_FILE, JSON.stringify(updates, null, 2));
}

async function readPendingChanges(): Promise<PendingProfileChange[]> {
  await ensureDataFiles();
  const data = await fs.readFile(PENDING_FILE, 'utf-8');
  return JSON.parse(data);
}

async function savePendingChanges(changes: PendingProfileChange[]): Promise<void> {
  await fs.writeFile(PENDING_FILE, JSON.stringify(changes, null, 2));
}

/**
 * GET /api/profile
 * Get profile data for a rep, or list all pending changes (admin)
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    const pendingOnly = searchParams.get('pending') === 'true';

    // If requesting pending changes (admin view)
    if (pendingOnly) {
      const pendingChanges = await readPendingChanges();
      const pending = pendingChanges.filter((c) => c.status === 'pending');

      return NextResponse.json({
        success: true,
        changes: pending,
        count: pending.length,
      });
    }

    // Get specific rep's profile
    if (!slug) {
      return NextResponse.json(
        { success: false, error: 'Slug parameter required' },
        { status: 400 }
      );
    }

    // Find base team member data
    const member = teamMembers.find((m) => m.slug === slug);
    if (!member) {
      return NextResponse.json(
        { success: false, error: 'Team member not found' },
        { status: 404 }
      );
    }

    // Get any profile updates/customizations
    const updates = await readUpdates();
    const profileUpdate = updates.find((u) => u.slug === slug);

    // Merge base data with updates
    const profile = {
      slug: member.slug,
      name: member.name,
      position: member.position,
      category: member.category,
      email: member.email,
      phone: member.phone,
      bio: profileUpdate?.bio || member.bio,
      tagline: profileUpdate?.tagline || member.tagline,
      region: member.region,
      profileImage: profileUpdate?.profileImageUrl || member.profileImage,
      truckImage: profileUpdate?.truckImageUrl || member.truckImage,
      socialMedia: profileUpdate?.socialMedia || {
        facebook: member.facebook,
        instagram: member.instagram,
        tiktok: member.tiktok,
        x: member.x,
        linkedin: member.linkedin,
      },
      contactPreferences: profileUpdate?.contactPreferences || {
        preferredContact: 'any',
        showPhone: true,
        showEmail: true,
      },
      keyStrengths: profileUpdate?.keyStrengths || member.keyStrengths || [],
      responsibilities: profileUpdate?.responsibilities || member.responsibilities || [],
      pendingUpdate: profileUpdate?.pendingChanges ? profileUpdate : undefined,
    };

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (error) {
    console.error('Error getting profile:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get profile',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/profile
 * Submit profile updates (creates pending changes for admin review)
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await req.json();
    const { slug, changes, submittedBy } = body;

    if (!slug || !changes) {
      return NextResponse.json(
        { success: false, error: 'Slug and changes are required' },
        { status: 400 }
      );
    }

    // Find the team member
    const member = teamMembers.find((m) => m.slug === slug);
    if (!member) {
      return NextResponse.json(
        { success: false, error: 'Team member not found' },
        { status: 404 }
      );
    }

    // Get existing updates and pending changes
    const updates = await readUpdates();
    const pendingChanges = await readPendingChanges();

    // Create pending change records for each field
    const newPendingChanges: PendingProfileChange[] = [];

    for (const [field, newValue] of Object.entries(changes)) {
      // Get old value
      let oldValue: string | null = null;
      const existingUpdate = updates.find((u) => u.slug === slug);

      if (field === 'bio') {
        oldValue = existingUpdate?.bio || member.bio;
      } else if (field === 'tagline') {
        oldValue = existingUpdate?.tagline || member.tagline || null;
      } else if (field === 'profileImageUrl') {
        oldValue = existingUpdate?.profileImageUrl || member.profileImage || null;
      } else if (field === 'truckImageUrl') {
        oldValue = existingUpdate?.truckImageUrl || member.truckImage || null;
      } else if (field === 'keyStrengths' || field === 'responsibilities') {
        oldValue = JSON.stringify(existingUpdate?.[field as keyof ProfileUpdate] || (member as any)[field] || []);
      } else if (field === 'socialMedia') {
        oldValue = JSON.stringify(existingUpdate?.socialMedia || {
          facebook: member.facebook,
          instagram: member.instagram,
          tiktok: member.tiktok,
          x: member.x,
          linkedin: member.linkedin,
        });
      } else if (field === 'contactPreferences') {
        oldValue = JSON.stringify(existingUpdate?.contactPreferences || {
          preferredContact: 'any',
          showPhone: true,
          showEmail: true,
        });
      }

      const pendingChange: PendingProfileChange = {
        id: generateId(),
        repSlug: slug,
        repName: member.name,
        fieldName: field,
        oldValue,
        newValue: typeof newValue === 'string' ? newValue : JSON.stringify(newValue),
        submittedAt: new Date().toISOString(),
        status: 'pending',
      };

      newPendingChanges.push(pendingChange);
    }

    // Add to pending changes
    pendingChanges.push(...newPendingChanges);
    await savePendingChanges(pendingChanges);

    // Update the profile update record to mark as having pending changes
    const existingUpdateIndex = updates.findIndex((u) => u.slug === slug);
    if (existingUpdateIndex >= 0) {
      updates[existingUpdateIndex].pendingChanges = true;
      updates[existingUpdateIndex].submittedAt = new Date().toISOString();
    } else {
      updates.push({
        slug,
        pendingChanges: true,
        submittedAt: new Date().toISOString(),
      });
    }
    await saveUpdates(updates);

    return NextResponse.json({
      success: true,
      message: 'Profile changes submitted for review',
      pendingChanges: newPendingChanges.length,
    });
  } catch (error) {
    console.error('Error submitting profile changes:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to submit profile changes',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/profile
 * Admin: Approve or reject pending changes
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await req.json();
    const { changeId, action, reviewedBy, comment } = body;

    if (!changeId || !action) {
      return NextResponse.json(
        { success: false, error: 'changeId and action are required' },
        { status: 400 }
      );
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Action must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    const pendingChanges = await readPendingChanges();
    const changeIndex = pendingChanges.findIndex((c) => c.id === changeId);

    if (changeIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Change not found' },
        { status: 404 }
      );
    }

    const change = pendingChanges[changeIndex];

    // Update change status
    change.status = action === 'approve' ? 'approved' : 'rejected';
    change.reviewedAt = new Date().toISOString();
    change.reviewedBy = reviewedBy;
    change.comment = comment;

    // If approved, apply the change to the profile update record
    if (action === 'approve') {
      const updates = await readUpdates();
      let updateIndex = updates.findIndex((u) => u.slug === change.repSlug);

      if (updateIndex === -1) {
        updates.push({
          slug: change.repSlug,
          pendingChanges: false,
        });
        updateIndex = updates.length - 1;
      }

      // Apply the change
      const fieldName = change.fieldName as keyof ProfileUpdate;
      if (fieldName === 'keyStrengths' || fieldName === 'responsibilities' ||
          fieldName === 'socialMedia' || fieldName === 'contactPreferences') {
        (updates[updateIndex] as any)[fieldName] = JSON.parse(change.newValue);
      } else {
        (updates[updateIndex] as any)[fieldName] = change.newValue;
      }

      updates[updateIndex].approvedAt = new Date().toISOString();
      updates[updateIndex].approvedBy = reviewedBy;
      updates[updateIndex].pendingChanges = false;

      await saveUpdates(updates);
    }

    await savePendingChanges(pendingChanges);

    return NextResponse.json({
      success: true,
      message: `Change ${action}d successfully`,
      change: pendingChanges[changeIndex],
    });
  } catch (error) {
    console.error('Error processing change:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process change',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
