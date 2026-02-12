import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { profileApprovalService } from '@/lib/profile-approval-service';
import { promises as fs } from 'fs';
import path from 'path';

// POST /api/profile/approve
// Approve a pending profile edit request (admin only)
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { editId } = body;
    const reviewerName = auth.user?.name || auth.user?.email || 'Admin';

    if (!editId) {
      return NextResponse.json(
        { error: 'Edit ID is required' },
        { status: 400 }
      );
    }

    // Get the edit to be approved
    const edit = await profileApprovalService.getEditById(editId);
    if (!edit) {
      return NextResponse.json(
        { error: 'Edit request not found' },
        { status: 404 }
      );
    }

    // Approve the edit
    const result = await profileApprovalService.approveEdit(editId, reviewerName);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    // Apply the changes to the live data
    // This updates the teamData.ts file with the approved changes
    const applyResult = await applyProfileChanges(edit.userSlug, edit.changes as Record<string, unknown>);

    if (!applyResult.success) {
      // Rollback the approval status if applying changes failed
      console.error('Failed to apply profile changes:', applyResult.error);
      // Note: In a production system, you'd want proper transaction handling here
    }

    return NextResponse.json({
      success: true,
      message: `Profile edit approved successfully${applyResult.success ? ' and changes applied.' : ', but failed to apply changes automatically.'}`,
      edit: result.edit,
      changesApplied: applyResult.success,
    });
  } catch (error) {
    console.error('Error approving profile edit:', error);
    return NextResponse.json(
      { error: 'Failed to approve profile edit' },
      { status: 500 }
    );
  }
}

// Helper function to apply approved changes to teamData.ts
// In a production system, this would update a database
async function applyProfileChanges(userSlug: string, changes: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    // Read the current teamData.ts file
    const teamDataPath = path.join(process.cwd(), 'lib', 'teamData.ts');
    let content = await fs.readFile(teamDataPath, 'utf-8');

    // Find the team member object by slug
    const memberRegex = new RegExp(
      `(\\{[^}]*slug:\\s*['"]${userSlug}['"][^}]*\\})`,
      'gs'
    );

    // This is a simplified approach - in production, use a proper AST parser
    // or store team data in a database/JSON file for easier updates

    // For now, we'll store approved changes in a separate "live overrides" file
    // that gets merged with teamData at runtime
    const overridesPath = path.join(process.cwd(), 'data', 'profile-overrides.json');

    let overrides: Record<string, Record<string, unknown>> = {};
    try {
      const existingOverrides = await fs.readFile(overridesPath, 'utf-8');
      overrides = JSON.parse(existingOverrides);
    } catch {
      // File doesn't exist yet
    }

    // Apply the changes as overrides
    overrides[userSlug] = {
      ...(overrides[userSlug] || {}),
      ...changes,
      _lastUpdated: new Date().toISOString(),
    };

    // Write the overrides file
    await fs.writeFile(overridesPath, JSON.stringify(overrides, null, 2));

    return { success: true };
  } catch (error) {
    console.error('Error applying profile changes:', error);
    return { success: false, error: String(error) };
  }
}
