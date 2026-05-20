/**
 * /api/team-profile
 *
 * POST: a team member submits an edit to their own public profile. The edit
 *       lands in the `Team_Profile_Edits` Sheet tab with status='PENDING'.
 *       Admin reviews via /portal/admin/profile-approvals (existing page).
 *       Nothing applies to the public profile until an admin approves.
 *
 * GET:  the team member views their own submitted edits (?slug=<their-slug>).
 *       Admins viewing other slugs get a 403 here — they should use the admin
 *       approvals page for the full queue.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { teamMembers } from '@/lib/teamData';
import {
  listProfileEdits,
  submitProfileEdit,
  type TeamProfileFieldChanges,
} from '@/lib/team-profile-edits';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_FIELDS = new Set<keyof TeamProfileFieldChanges>([
  'name',
  'position',
  'phone',
  'bio',
  'tagline',
  'profileImage',
  'truckMake',
  'truckModel',
  'truckColor',
  'truckLicense',
  'publicVisibility',
]);

function sanitizeFieldChanges(input: unknown): TeamProfileFieldChanges {
  if (!input || typeof input !== 'object') return {};
  const raw = input as Record<string, unknown>;
  const out: TeamProfileFieldChanges = {};
  for (const key of Object.keys(raw)) {
    if (!ALLOWED_FIELDS.has(key as keyof TeamProfileFieldChanges)) continue;
    const value = raw[key];
    if (key === 'publicVisibility') {
      if (typeof value === 'boolean') out.publicVisibility = value;
      continue;
    }
    if (typeof value === 'string') {
      // Trim and cap length defensively — bio can be long, others short.
      const max = key === 'bio' ? 5000 : 500;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (out as any)[key] = value.trim().slice(0, max);
    }
  }
  return out;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { slug, fieldChanges, originalSnapshot } = body as {
      slug?: string;
      fieldChanges?: unknown;
      originalSnapshot?: unknown;
    };

    if (!slug || typeof slug !== 'string') {
      return NextResponse.json({ error: 'slug is required' }, { status: 400 });
    }

    // The slug must match a real team member
    const member = teamMembers.find((m) => m.slug === slug);
    if (!member) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    // Authz: only allow editing your OWN profile.
    // Match by email (canonical) OR alt-email OR the auth user's userId-slug.
    const userEmail = (auth.user.email || '').toLowerCase();
    const memberEmail = (member.email || '').toLowerCase();
    const memberAltEmail = (member.altEmail || '').toLowerCase();
    const userIdSlug = (auth.user.userId || '').toLowerCase();
    const userRole = (auth.user.role || '').toLowerCase();
    const isOwnProfile =
      (memberEmail && memberEmail === userEmail) ||
      (memberAltEmail && memberAltEmail === userEmail) ||
      (member.slug.toLowerCase() === userIdSlug);
    const isAdmin = userRole === 'admin' || userRole === 'owner';

    if (!isOwnProfile && !isAdmin) {
      return NextResponse.json(
        { error: 'You can only edit your own profile.' },
        { status: 403 },
      );
    }

    const sanitized = sanitizeFieldChanges(fieldChanges);
    if (Object.keys(sanitized).length === 0) {
      return NextResponse.json(
        { error: 'No editable fields supplied.' },
        { status: 400 },
      );
    }

    const sanitizedOriginal = sanitizeFieldChanges(originalSnapshot);

    const record = await submitProfileEdit({
      userId: auth.user.userId,
      userSlug: member.slug,
      userName: auth.user.name,
      userEmail: auth.user.email,
      fieldChanges: sanitized,
      originalSnapshot: sanitizedOriginal,
    });

    return NextResponse.json({
      success: true,
      edit: {
        id: record.id,
        submittedAt: record.submittedAt,
        status: record.status,
        fieldChanges: record.fieldChanges,
      },
    });
  } catch (error) {
    console.error('[POST /api/team-profile] error:', error);
    return NextResponse.json(
      { error: 'Failed to submit profile edit.' },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');

  if (!slug) {
    return NextResponse.json({ error: 'slug query parameter is required' }, { status: 400 });
  }

  const member = teamMembers.find((m) => m.slug === slug);
  if (!member) {
    return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
  }

  // Only the team member themselves OR an admin may see this slug's edits.
  const userEmail = (auth.user.email || '').toLowerCase();
  const memberEmail = (member.email || '').toLowerCase();
  const memberAltEmail = (member.altEmail || '').toLowerCase();
  const userIdSlug = (auth.user.userId || '').toLowerCase();
  const userRole = (auth.user.role || '').toLowerCase();
  const isOwnProfile =
    (memberEmail && memberEmail === userEmail) ||
    (memberAltEmail && memberAltEmail === userEmail) ||
    (member.slug.toLowerCase() === userIdSlug);
  const isAdmin = userRole === 'admin' || userRole === 'owner';

  if (!isOwnProfile && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const edits = await listProfileEdits({ userSlug: slug });
    edits.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    return NextResponse.json({
      edits: edits.map((e) => ({
        id: e.id,
        submittedAt: e.submittedAt,
        status: e.status,
        reviewedAt: e.reviewedAt,
        reviewedBy: e.reviewedBy,
        reviewNotes: e.reviewNotes,
        fieldChanges: e.fieldChanges,
      })),
    });
  } catch (error) {
    console.error('[GET /api/team-profile] error:', error);
    return NextResponse.json({ error: 'Failed to load edits.' }, { status: 500 });
  }
}
