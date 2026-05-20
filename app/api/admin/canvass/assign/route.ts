/**
 * POST /api/admin/canvass/assign
 *
 * Take a generated address list, partition it across the chosen reps via
 * `splitForReps` (geographic K-means), and persist the assignments to the
 * `Canvass Routes` sheet. Idempotent on (stormEventId, repSlug) — calling
 * twice with the same storm + same reps overwrites the previous row
 * instead of creating duplicates.
 *
 * IMPORTANT: this route does NOT send notifications, texts, or emails to
 * the reps. Per the review-automation pattern (env-gate any send, default
 * off), the rep gets the route via the command-center URL only. The
 * owner activates a notification channel later.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRoleAtLeast } from '@/lib/auth-service';
import {
  splitForReps,
  recordCanvassAssignment,
  type CanvassAddress,
  type CanvassRoute,
} from '@/lib/hail-canvass-service';
import { getTeamMember, getLeadEligibleReps, isSalesRole } from '@/lib/team-roles';

interface AssignBody {
  stormEventId: string;
  addresses: CanvassAddress[];
  repSlugs: string[];
  notes?: string;
}

export async function POST(request: NextRequest) {
  const auth = await requireRoleAtLeast(['owner', 'admin', 'manager']);
  if (!auth.authenticated) return auth.response;

  let body: AssignBody;
  try {
    body = (await request.json()) as AssignBody;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  if (!body.stormEventId || typeof body.stormEventId !== 'string') {
    return NextResponse.json(
      { success: false, error: 'stormEventId is required' },
      { status: 400 },
    );
  }
  if (!Array.isArray(body.addresses) || body.addresses.length === 0) {
    return NextResponse.json(
      { success: false, error: 'addresses must be a non-empty array' },
      { status: 400 },
    );
  }
  if (!Array.isArray(body.repSlugs) || body.repSlugs.length === 0) {
    return NextResponse.json(
      { success: false, error: 'repSlugs must be a non-empty array' },
      { status: 400 },
    );
  }

  // Validate each rep slug — must be a known team member AND a sales-
  // eligible role. We use getLeadEligibleReps() as the truth source so
  // BCM/Rudys/Roof Angel rep entities flow correctly.
  const eligibleSlugs = new Set(getLeadEligibleReps().map(m => m.slug));
  const validReps: string[] = [];
  const invalidReps: string[] = [];
  for (const slug of body.repSlugs) {
    const member = getTeamMember(slug);
    if (!member) {
      invalidReps.push(slug);
      continue;
    }
    if (!isSalesRole(member.role) && !eligibleSlugs.has(slug)) {
      // Allow dual-role users (e.g. Richard) if they're sales-eligible.
      if (!member.roles?.some(r => r === 'sales')) {
        invalidReps.push(slug);
        continue;
      }
    }
    validReps.push(slug);
  }

  if (invalidReps.length > 0) {
    return NextResponse.json(
      {
        success: false,
        error: `Unknown or non-sales reps: ${invalidReps.join(', ')}`,
      },
      { status: 400 },
    );
  }

  // Partition.
  const routes: CanvassRoute[] = splitForReps({
    addresses: body.addresses,
    repSlugs: validReps,
  });

  // Persist each rep's route. We do these serially so a partial failure
  // on the sheet API doesn't cascade — and the operation is idempotent
  // so a retry is safe.
  const results: Array<{
    repSlug: string;
    addressCount: number;
    created: boolean;
    updated: boolean;
    error?: string;
  }> = [];

  for (const route of routes) {
    try {
      const { created, updated } = await recordCanvassAssignment({
        stormEventId: body.stormEventId,
        route,
        assignedBy: auth.user.email || auth.user.userId,
        notes: body.notes,
      });
      results.push({
        repSlug: route.repSlug,
        addressCount: route.addresses.length,
        created,
        updated,
      });
    } catch (err) {
      results.push({
        repSlug: route.repSlug,
        addressCount: route.addresses.length,
        created: false,
        updated: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  const failures = results.filter(r => r.error);
  return NextResponse.json({
    success: failures.length === 0,
    data: {
      stormEventId: body.stormEventId,
      assignments: results,
      routes: routes.map(r => ({
        repSlug: r.repSlug,
        addressCount: r.addresses.length,
        centroid: r.centroid,
        approxRouteMiles: r.approxRouteMiles,
      })),
    },
  });
}
