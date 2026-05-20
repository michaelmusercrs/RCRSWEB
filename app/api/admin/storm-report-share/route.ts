/**
 * Storm Report Share — Rep-side Regeneration API
 *
 * POST /api/admin/storm-report-share
 *
 * Use case: a sales rep is on the phone with a customer who lost the
 * original storm-report email and wants to text them the magic link
 * again. The rep hits this endpoint with the original `reportId` and
 * gets back a fresh share token + URL they can paste into iMessage / SMS.
 *
 * Auth: `requireAuth` — any signed-in team member can mint shares for
 * leads they're working. We don't downscope by role because every active
 * member of the team needs to be able to re-text a link to a customer
 * standing in their driveway. (If we needed per-rep isolation later, we
 * could check that the report's salesRepSlug matches the caller — but
 * that would also block the office staff who actually do most of the
 * "resend the link" calls, so leaving it open to all signed-in users.)
 *
 * Request body:
 *   {
 *     reportId: string;             // required — must match a row on Storm_Reports
 *     ttlDays?: number;             // optional — override default 90d
 *     assignedRepSlug?: string;     // optional — overrides the rep stored on the new share row
 *   }
 *
 * Response:
 *   200 { success: true, token, shareUrl, expiresAt, reportId }
 *   400 { success: false, error }   — missing reportId or report not found
 *   401 { success: false, error }   — unauthenticated (from requireAuth)
 *   500 { success: false, error }   — sheet write failed
 *
 * Each call mints a NEW token — previous tokens are NOT invalidated.
 * That's deliberate: if the customer already bookmarked the first link
 * we don't want to break them. Use case here is "I lost the email," not
 * "the link was leaked." If revocation becomes a need, add a separate
 * DELETE endpoint that flips an `isRevoked` column on the share row.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { stormReportService } from '@/lib/storm-report-service';
import { createShareToken, buildShareUrl } from '@/lib/storm-report-share';

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  let body: { reportId?: string; ttlDays?: number; assignedRepSlug?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const reportId = (body.reportId || '').trim();
  if (!reportId) {
    return NextResponse.json(
      { success: false, error: 'reportId is required' },
      { status: 400 }
    );
  }

  // Verify the report exists before minting — minting a share for a
  // bogus reportId would create dead links the customer would hit a
  // 410 on, which is a worse experience than a 400 here.
  const report = await stormReportService.getReportById(reportId);
  if (!report) {
    return NextResponse.json(
      { success: false, error: 'Storm report not found' },
      { status: 400 }
    );
  }

  try {
    // Mint with the freshest identifying info from the report row so the
    // share page shows what's actually on file (not stale data from the
    // original form submission). assignedRepSlug override lets the caller
    // re-route the share to a different rep if assignments changed.
    const share = await createShareToken({
      reportId: report.reportId,
      customerEmail: '', // not stored on the report row; share row keeps blank if unknown
      customerName: '',
      address: report.fullAddress || report.address || '',
      assignedRepSlug:
        body.assignedRepSlug && body.assignedRepSlug.trim()
          ? body.assignedRepSlug.trim().toLowerCase()
          : undefined,
      ttlDays: body.ttlDays && body.ttlDays > 0 ? body.ttlDays : undefined,
    });

    return NextResponse.json({
      success: true,
      token: share.token,
      shareUrl: buildShareUrl(share.token),
      expiresAt: share.expiresAt,
      reportId: share.reportId,
    });
  } catch (err) {
    console.error('[admin/storm-report-share] mint failed', err);
    return NextResponse.json(
      { success: false, error: 'Failed to mint share token' },
      { status: 500 }
    );
  }
}
