/**
 * Public Storm Report Share API
 *
 * GET /api/public/storm-report-share/[token]
 *
 * Resolves a magic-link share token to a sanitized rendering payload for
 * the public share page at `/share/storm-report/[token]`. NO auth — the
 * token IS the credential. Mirrors the security model of
 * `/api/public/customer-portal/[token]`:
 *
 *   - Token format is validated (24-char base62) BEFORE any sheet lookup
 *     via STORM_SHARE_TOKEN_REGEX, so malformed input can't trigger
 *     Google Sheets API calls.
 *   - 200 + sanitized payload when the token is live.
 *   - 410 Gone when the token resolved but is past its expiresAt.
 *   - 404 Not Found for anything else (malformed, unknown). Generic
 *     message to prevent enumeration of which tokens "used to exist".
 *   - KV-backed rate limit: 60/hr per IP via
 *     `createStormReportShareViewRateLimiter()`.
 *
 * The response NEVER leaks pricing, internal notes, lead IDs, or other
 * customers. The rep card is sourced from `teamData.ts` (the public-site
 * team module that already exposes name/phone/email/photo), not the
 * internal `team-roles.ts` permissions module.
 *
 * Side effect: best-effort `recordShareAccess(token)` bumps the
 * `accessCount` + `lastAccessedAt` columns on the share row. Errors are
 * swallowed inside the helper.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  verifyShareToken,
  recordShareAccess,
  STORM_SHARE_TOKEN_REGEX,
} from '@/lib/storm-report-share';
import { stormReportService } from '@/lib/storm-report-service';
import { teamMembers } from '@/lib/teamData';
import {
  createStormReportShareViewRateLimiter,
  withRateLimit,
} from '@/lib/rate-limiter-kv';

const rateLimiter = createStormReportShareViewRateLimiter();

// ─── Response shape (public, sanitized) ──────────────────────────────────

interface PublicSharePayload {
  reportId: string;
  customerName: string;
  customerFirstName: string;
  address: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  riskLevel: string;
  riskScore: number;
  totalHailReports: number;
  largestHailSize: string | null;
  closestHailMiles: number | null;
  riskFactors: string[];
  recommendation: string;
  // Truncated event lists — full sets stay on the internal sales-team
  // surface only. We expose the top events so the customer sees evidence
  // without overwhelming the share page.
  hailEvents: Array<{
    date: string;
    size: string;
    distance: number;
    location: string;
    severity: string;
  }>;
  windEvents: Array<{
    date: string;
    event: string;
    description: string;
  }>;
  rep: {
    name: string;
    phone: string;
    email: string;
    photo: string;
    position: string;
  };
  generatedAt: string;
  expiresAt: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
): Promise<Response> {
  return withRateLimit(request, rateLimiter, async () => {
    try {
      const { token } = await params;

      // Shape-check before any I/O. STORM_SHARE_TOKEN_REGEX is the same
      // gate the lib uses internally; checking here saves the round-trip
      // on malformed input.
      if (!token || !STORM_SHARE_TOKEN_REGEX.test(token)) {
        return NextResponse.json(
          { error: 'Invalid or expired link' },
          { status: 404 }
        );
      }

      const verification = await verifyShareToken(token);
      if (!verification.ok) {
        const status = verification.reason === 'expired' ? 410 : 404;
        const message =
          verification.reason === 'expired'
            ? 'This share link has expired'
            : 'Invalid or expired link';
        return NextResponse.json({ error: message }, { status });
      }

      const share = verification.record;

      // Fetch the underlying storm report by reportId. The share row only
      // stores identifying metadata — the actual report (hail events,
      // risk factors, etc.) still lives on the Storm_Reports tab.
      const report = await stormReportService.getReportById(share.reportId);
      if (!report) {
        // Token is valid but the report is gone (shouldn't happen — would
        // require a sheet edit). Treat as expired so the customer gets a
        // friendly message instead of a 500.
        return NextResponse.json(
          { error: 'This share link is no longer available' },
          { status: 410 }
        );
      }

      // Fire-and-forget access tracking. A failure here must NEVER block
      // rendering — the helper already swallows its own errors.
      recordShareAccess(token).catch(() => {});

      // Resolve rep info from the public team directory (teamData.ts).
      // assignedRepSlug is set at share-creation time; if it doesn't
      // match anyone, fall back to a generic company contact.
      const repData = teamMembers.find(m => m.slug === share.assignedRepSlug);
      const rep = {
        name: repData?.name || 'River City Roofing',
        phone: repData?.phone || '256-274-8530',
        email: repData?.email || 'sales@rcrsal.com',
        photo: repData?.profileImage || '',
        position: repData?.position || 'Roofing Specialist',
      };

      const firstName = (share.customerName || 'Neighbor').split(' ')[0];

      // Hand-pick the response. Anything not listed here is NOT exposed.
      const payload: PublicSharePayload = {
        reportId: report.reportId,
        customerName: share.customerName || '',
        customerFirstName: firstName,
        address: share.address || report.fullAddress || '',
        dateRangeStart: report.dateRangeStart,
        dateRangeEnd: report.dateRangeEnd,
        riskLevel: report.riskLevel,
        riskScore: report.riskScore,
        totalHailReports: report.totalHailReports,
        largestHailSize: report.largestHailSize,
        closestHailMiles: report.closestHailMiles,
        riskFactors: report.riskFactors || [],
        recommendation: report.recommendation || '',
        // Cap the event lists to keep the payload light and the page
        // readable. The full lists already went to the sales rep email.
        hailEvents: (report.hailEvents || []).slice(0, 15).map(e => ({
          date: e.date,
          size: e.size,
          distance: e.distance,
          location: e.location,
          severity: e.severity,
        })),
        windEvents: (report.windEvents || []).slice(0, 10).map(e => ({
          date: e.date,
          event: e.event,
          description: e.description,
        })),
        rep,
        generatedAt: report.generatedAt,
        expiresAt: share.expiresAt,
      };

      return NextResponse.json({ success: true, data: payload });
    } catch (err) {
      console.error('[public/storm-report-share] unexpected error:', err);
      return NextResponse.json(
        { error: 'Something went wrong' },
        { status: 500 }
      );
    }
  });
}
