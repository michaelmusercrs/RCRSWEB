/**
 * Portal Profile Approve/Reject API
 * POST: Admin approves or rejects a pending profile change
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { profileApprovalService } from '@/lib/profile-approval-service';
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

async function writeOverrides(overrides: Record<string, Record<string, unknown>>): Promise<void> {
  await fs.writeFile(OVERRIDES_FILE, JSON.stringify(overrides, null, 2));
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { editId, action, reason } = body as {
      editId: string;
      action: 'approve' | 'reject';
      reason?: string;
    };

    if (!editId || !action) {
      return NextResponse.json(
        { success: false, error: 'editId and action are required' },
        { status: 400 }
      );
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Action must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    const reviewerName = auth.user.name || auth.user.email;

    if (action === 'approve') {
      // Get the edit first so we can apply changes
      const edit = await profileApprovalService.getEditById(editId);
      if (!edit) {
        return NextResponse.json(
          { success: false, error: 'Edit request not found' },
          { status: 404 }
        );
      }

      const result = await profileApprovalService.approveEdit(editId, reviewerName);
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }

      // Apply changes to overrides file
      try {
        const overrides = await readOverrides();
        overrides[edit.userSlug] = {
          ...(overrides[edit.userSlug] || {}),
          ...edit.changes,
          _lastUpdated: new Date().toISOString(),
        };
        await writeOverrides(overrides);
      } catch (applyErr) {
        console.error('Failed to apply profile overrides:', applyErr);
      }

      return NextResponse.json({
        success: true,
        message: 'Profile changes approved and applied',
        edit: result.edit,
      });
    } else {
      // Reject
      if (!reason) {
        return NextResponse.json(
          { success: false, error: 'Rejection reason is required' },
          { status: 400 }
        );
      }

      const result = await profileApprovalService.rejectEdit(editId, reviewerName, reason);
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Profile changes rejected',
        edit: result.edit,
      });
    }
  } catch (error) {
    console.error('Error processing profile approval:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process approval' },
      { status: 500 }
    );
  }
}
