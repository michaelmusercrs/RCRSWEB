import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { profileApprovalService } from '@/lib/profile-approval-service';

const BLOB_KEY = 'data/profile-overrides.json';
const LOCAL_PATH = 'data/profile-overrides.json';

async function readOverrides(): Promise<Record<string, Record<string, unknown>>> {
  try {
    const { list } = await import('@vercel/blob');
    const blobs = await list({ prefix: BLOB_KEY });
    if (blobs.blobs.length > 0) {
      const res = await fetch(blobs.blobs[0].url, { cache: 'no-store' });
      if (res.ok) return await res.json();
    }
  } catch (e) { /* blob not available */ }
  try {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), LOCAL_PATH);
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function writeOverrides(overrides: Record<string, Record<string, unknown>>): Promise<void> {
  // Vercel Blob is canonical; fs is dev-only fallback wrapped in try/catch.
  try {
    const { put } = await import('@vercel/blob');
    await put(BLOB_KEY, JSON.stringify(overrides, null, 2), {
      access: 'public', contentType: 'application/json', addRandomSuffix: false,
    });
    return;
  } catch (e) {
    console.warn('[profile/approve] Blob write failed, attempting fs fallback:', e);
  }
  try {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), LOCAL_PATH);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(overrides, null, 2));
  } catch (fsErr) {
    console.warn('[profile/approve] Local fs write skipped (read-only fs?):', fsErr);
  }
}

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
    const applyResult = await applyProfileChanges(edit.userSlug, edit.changes as Record<string, unknown>);

    if (!applyResult.success) {
      console.error('Failed to apply profile changes:', applyResult.error);
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

// Helper function to apply approved changes to profile overrides
async function applyProfileChanges(userSlug: string, changes: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    let overrides = await readOverrides();

    // Apply the changes as overrides
    overrides[userSlug] = {
      ...(overrides[userSlug] || {}),
      ...changes,
      _lastUpdated: new Date().toISOString(),
    };

    await writeOverrides(overrides);

    return { success: true };
  } catch (error) {
    console.error('Error applying profile changes:', error);
    return { success: false, error: String(error) };
  }
}
