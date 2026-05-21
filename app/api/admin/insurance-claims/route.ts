/**
 * Admin insurance-claim coordination endpoint.
 *
 * GET   /api/admin/insurance-claims
 *   List every claim. Newest-updated first. Returns per-status counts so
 *   the page can render the "X claims need adjuster chase" callouts
 *   without a second round trip.
 *
 * PATCH /api/admin/insurance-claims
 *   Advance a single claim's status and merge any optional field
 *   updates into the same row. Body:
 *     {
 *       claimId: string;
 *       status: InsuranceClaimStatus;
 *       updates?: Partial<InsuranceClaim>; // any subset
 *     }
 *
 * Auth: requireRoleAtLeast(['owner','admin','office','manager']).
 * Per the cost-visibility rule, Richard ("Rick") is also allowed by
 * identity — that's the requireRoleAtLeast default.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRoleAtLeast } from '@/lib/auth-service';
import {
  INSURANCE_CLAIM_STATUSES,
  listAllInsuranceClaims,
  updateInsuranceClaimStatus,
  type InsuranceClaim,
  type InsuranceClaimStatus,
  type InsuranceClaimUpdate,
} from '@/lib/insurance-claims-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_ROLES = ['owner', 'admin', 'office', 'manager'];

export async function GET() {
  const auth = await requireRoleAtLeast(ALLOWED_ROLES);
  if (!auth.authenticated) return auth.response;

  try {
    const claims = await listAllInsuranceClaims();

    // Per-status counts for the admin dashboard tiles.
    const counts: Record<InsuranceClaimStatus, number> = {
      damage_reported: 0,
      claim_filed: 0,
      awaiting_adjuster: 0,
      adjuster_visited: 0,
      claim_approved: 0,
      supplement_submitted: 0,
      supplement_approved: 0,
      final_settlement: 0,
      depreciation_released: 0,
      complete: 0,
      denied: 0,
    };
    claims.forEach(c => {
      if (counts[c.status] !== undefined) counts[c.status] += 1;
    });

    const sheetsId = process.env.GOOGLE_SHEETS_ID;
    const svcEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const svcKey = process.env.GOOGLE_PRIVATE_KEY;
    const configured = Boolean(sheetsId && svcEmail && svcKey);

    return NextResponse.json({
      success: true,
      claims,
      counts,
      total: claims.length,
      configured,
    });
  } catch (error) {
    console.error('Error listing insurance claims:', error);
    return NextResponse.json({ success: false, error: 'Failed to list claims' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireRoleAtLeast(ALLOWED_ROLES);
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { claimId, status, updates } = (body || {}) as {
      claimId?: string;
      status?: InsuranceClaimStatus;
      updates?: InsuranceClaimUpdate;
    };

    if (!claimId) {
      return NextResponse.json({ success: false, error: 'claimId is required' }, { status: 400 });
    }
    if (!status || !INSURANCE_CLAIM_STATUSES.includes(status)) {
      return NextResponse.json({ success: false, error: 'Valid status is required' }, { status: 400 });
    }

    // Strip claimId/createdAt from updates so callers can't rewrite the
    // primary key or backdate the row.
    const safeUpdates: InsuranceClaimUpdate | undefined = updates
      ? (() => {
          const u: Partial<InsuranceClaim> = { ...updates };
          delete (u as Record<string, unknown>).claimId;
          delete (u as Record<string, unknown>).createdAt;
          return u;
        })()
      : undefined;

    const updated = await updateInsuranceClaimStatus(claimId, status, safeUpdates);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Claim not found or sheet write failed' }, { status: 404 });
    }

    return NextResponse.json({ success: true, claim: updated });
  } catch (error) {
    console.error('Error updating insurance claim:', error);
    return NextResponse.json({ success: false, error: 'Failed to update claim' }, { status: 500 });
  }
}
