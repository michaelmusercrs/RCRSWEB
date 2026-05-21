// Profile Approval Queue API
//
// Approvers (per stated rule 2026-05-21): Chris, Michael, Sara.
// All edits require approval — no auto-approve path.
//
// GET    list pending profile edits (one row per rep with a pendingDraft)
// POST   approve OR reject (action: 'approve' | 'needs-changes')

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { googleSheetsService, type TeamProfileRecord } from '@/lib/google-sheets-service';
import { invalidateProfileOverridesCache } from '@/lib/profile-overrides-bridge';

const APPROVER_SLUGS = ['michael', 'chris-muse', 'sara-hill'];
const APPROVER_EMAILS = ['michaelmuse@rcrsal.com', 'chrismuse@rcrsal.com', 'sara@rcrsal.com'];

function isApprover(user: { role?: string; userId?: string; email?: string }): boolean {
  const role = (user.role || '').toLowerCase();
  if (role === 'owner') return true; // owner can always approve
  const slug = (user.userId || '').toLowerCase();
  const email = (user.email || '').toLowerCase();
  return APPROVER_SLUGS.includes(slug) || APPROVER_EMAILS.includes(email);
}

export async function GET(_request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;
  if (!isApprover(auth.user)) {
    return NextResponse.json({ success: false, error: 'Approver role required (Chris / Michael / Sara)' }, { status: 403 });
  }

  const profiles = await googleSheetsService.getTeamProfiles();
  const pending = profiles.filter(p => p.status === 'pending-approval');
  // Return the parsed pendingDraft alongside the current published state so
  // the UI can render a side-by-side diff.
  const items = pending.map(p => {
    let draft: Partial<TeamProfileRecord> = {};
    try {
      draft = p.pendingDraft ? JSON.parse(p.pendingDraft) : {};
    } catch { /* skip malformed */ }
    return {
      repSlug: p.repSlug,
      submittedAt: p.submittedAt,
      submittedBy: p.submittedBy,
      version: p.version,
      // Current published values
      current: {
        bio: p.bio,
        headshotUrl: p.headshotUrl,
        truckPicUrl: p.truckPicUrl,
        certifications: p.certifications,
        yearsExperience: p.yearsExperience,
        favoriteQuote: p.favoriteQuote,
        personalReviewIds: p.personalReviewIds,
        reviewDisplayMode: p.reviewDisplayMode,
      },
      // Proposed changes
      proposed: draft,
    };
  });

  return NextResponse.json({ success: true, items });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;
  if (!isApprover(auth.user)) {
    return NextResponse.json({ success: false, error: 'Approver role required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { repSlug, action, notes } = body as {
      repSlug: string;
      action: 'approve' | 'needs-changes';
      notes?: string;
    };
    if (!repSlug || !['approve', 'needs-changes'].includes(action)) {
      return NextResponse.json({ success: false, error: 'repSlug + action required' }, { status: 400 });
    }

    const profile = await googleSheetsService.getTeamProfile(repSlug);
    if (!profile || profile.status !== 'pending-approval') {
      return NextResponse.json({ success: false, error: 'No pending approval for this rep' }, { status: 404 });
    }

    const now = new Date().toISOString();
    const approverName = auth.user.name || auth.user.userId || 'admin';

    if (action === 'approve') {
      let draft: Partial<TeamProfileRecord> = {};
      try {
        draft = JSON.parse(profile.pendingDraft || '{}');
      } catch {
        return NextResponse.json({ success: false, error: 'Pending draft is malformed' }, { status: 500 });
      }
      // Merge approved draft fields into the published record. Bump version.
      const newVersion = String(parseInt(profile.version || '1', 10) + 1);
      const merged: Partial<TeamProfileRecord> & { repSlug: string } = {
        repSlug,
        ...draft,
        status: 'published',
        pendingDraft: '',
        approvedBy: approverName,
        approvedAt: now,
        publishedAt: now,
        rejectionNotes: '',
        version: newVersion,
      };
      const ok = await googleSheetsService.upsertTeamProfile(merged);
      if (!ok) return NextResponse.json({ success: false, error: 'Save failed' }, { status: 500 });
      invalidateProfileOverridesCache();
      return NextResponse.json({ success: true, action: 'approved' });
    }

    // needs-changes — keep the draft so the rep can edit it, but flag
    const merged: Partial<TeamProfileRecord> & { repSlug: string } = {
      repSlug,
      status: 'needs-changes',
      rejectionNotes: notes || '',
    };
    const ok = await googleSheetsService.upsertTeamProfile(merged);
    if (!ok) return NextResponse.json({ success: false, error: 'Save failed' }, { status: 500 });
    return NextResponse.json({ success: true, action: 'sent-back' });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Internal error',
    }, { status: 500 });
  }
}
