// Team Profiles API — bio + photo URLs per rep
//
// GET   - list all profiles (admin/owner only)
// PUT   - upsert one profile (admin/owner OR the rep themselves for own row)
// POST  - upload a photo (multipart/form-data) → Vercel Blob → returns URL
//
// Photos store as PUBLIC blobs (customer welcome page reads them). No
// security implications — these are professional headshots / truck photos.

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRoleAtLeast } from '@/lib/auth-service';
import { googleSheetsService, type TeamProfileRecord } from '@/lib/google-sheets-service';
import { put } from '@vercel/blob';

export async function GET(_request: NextRequest) {
  const auth = await requireRoleAtLeast(['owner', 'admin', 'manager']);
  if (!auth.authenticated) return auth.response;
  const profiles = await googleSheetsService.getTeamProfiles();
  return NextResponse.json({ success: true, profiles });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const profile = body.profile as TeamProfileRecord;
    if (!profile?.repSlug) {
      return NextResponse.json({ success: false, error: 'profile.repSlug required' }, { status: 400 });
    }

    // Self-edit allowed for own slug; otherwise admin/owner required
    const role = (auth.user.role || '').toLowerCase();
    const ownSlug = (auth.user.userId || '').toLowerCase();
    const isAdmin = ['owner', 'admin', 'manager'].includes(role);
    const isSelf = profile.repSlug.toLowerCase() === ownSlug;
    if (!isAdmin && !isSelf) {
      return NextResponse.json({ success: false, error: 'Forbidden — can only edit own profile' }, { status: 403 });
    }

    profile.updatedBy = auth.user.name || ownSlug || 'admin';
    const ok = await googleSheetsService.upsertTeamProfile(profile);
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Failed to save profile' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Internal error',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ success: false, error: 'Blob storage not configured' }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const repSlug = formData.get('repSlug') as string | null;
    const kind = formData.get('kind') as string | null; // 'headshot' | 'truck'

    if (!file || !repSlug || !kind) {
      return NextResponse.json({ success: false, error: 'file + repSlug + kind required' }, { status: 400 });
    }
    if (!['headshot', 'truck'].includes(kind)) {
      return NextResponse.json({ success: false, error: 'kind must be headshot or truck' }, { status: 400 });
    }

    // Self-upload allowed for own slug; otherwise admin
    const role = (auth.user.role || '').toLowerCase();
    const ownSlug = (auth.user.userId || '').toLowerCase();
    const isAdmin = ['owner', 'admin', 'manager'].includes(role);
    const isSelf = repSlug.toLowerCase() === ownSlug;
    if (!isAdmin && !isSelf) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // Size cap: 4MB
    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'File too large (4MB max)' }, { status: 413 });
    }

    // Type cap: image only
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ success: false, error: 'Only image uploads allowed' }, { status: 400 });
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const path = `team-profiles/${repSlug}-${kind}-${Date.now()}.${ext}`;
    const blob = await put(path, file, { access: 'public', contentType: file.type });
    return NextResponse.json({ success: true, url: blob.url });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Upload failed',
    }, { status: 500 });
  }
}
