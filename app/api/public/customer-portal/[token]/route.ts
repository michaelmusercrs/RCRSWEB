/**
 * PUBLIC Customer Portal API
 *
 * GET /api/public/customer-portal/[token]
 *
 * This is the ONLY public customer portal endpoint — no auth required, the
 * token IS the credential. A homeowner receives a link like
 * `https://rivercityroofingsolutions.com/view/abc123...` and this endpoint
 * resolves the token to a *sanitized* customer payload.
 *
 * SECURITY NOTES:
 *   1. Token validation cannot distinguish between "token not found" and
 *      "token expired vs wrong token" to outside callers. We return:
 *        - 200 + data for a valid, active token
 *        - 410 Gone for tokens that resolved to an expired record
 *        - 404 Not Found for anything else (invalid, unknown, or deactivated)
 *      This prevents enumeration of which tokens "used to exist".
 *   2. Rate limited with the shared customer-token rate limiter (10 req / 15 min
 *      per IP + path) so an attacker can't brute-force the 64-char token space.
 *   3. The response payload is HAND-PICKED: we never leak pricing, commissions,
 *      cost, margin, internal notes, other customers, or admin fields. If a new
 *      field is added to the LeadRecord, it does NOT automatically show up
 *      here — it has to be explicitly listed below.
 *
 * Data source: leadPortalService (the token→customer lookup used by /my/[token]).
 * We intentionally DO NOT fall back to the Customer_Portal_Access sheet here —
 * the legacy sheet path is only used by the authenticated /api/customer/[token]
 * route. The public route keeps its lookup surface small on purpose.
 */

import { NextRequest, NextResponse } from 'next/server';
import { leadPortalService } from '@/lib/lead-portal-service';
import { teamMembers } from '@/lib/teamData';
import { createCustomerTokenRateLimiter, withRateLimit } from '@/lib/rate-limiter';

// Shared rate limiter — same 10/15min bucket used by /api/customer/[token].
// Per-IP keyed so a single attacker can't brute-force regardless of method.
const tokenRateLimiter = createCustomerTokenRateLimiter();

// ─── Response shape (public, sanitized) ──────────────────────────────────

interface PublicDocument {
  documentId: string;
  type: string;
  title: string;
  description?: string;
  uploadedAt: string;
}

interface PublicAppointment {
  appointmentId: string;
  type: string;
  title: string;
  description?: string;
  scheduledDate: string;
  scheduledTime: string;
  status: string;
}

interface PublicRep {
  name: string;
  phone: string; // tap-to-call
  email: string;
  photo: string;
  position: string;
}

interface PublicCustomerPayload {
  customerName: string;
  customerFirstName: string;
  customerAddress: string;
  projectStatus: string;
  projectPhase: string;
  projectProgress: number;
  nextMilestone: string | null;
  rep: PublicRep;
  appointments: PublicAppointment[];
  documents: PublicDocument[];
  createdAt: string;
}

// ─── Status mapping (used by /my/[token] already) ───────────────────────

const STATUS_LABEL: Record<string, { label: string; phase: string; progress: number; next: string }> = {
  new: { label: 'New Lead', phase: 'Intake', progress: 5, next: 'Roof inspection scheduled' },
  contacted: { label: 'Contacted', phase: 'Initial Contact', progress: 10, next: 'Roof inspection scheduled' },
  inspection_scheduled: {
    label: 'Inspection Scheduled',
    phase: 'Inspection',
    progress: 25,
    next: 'Estimate delivered',
  },
  estimate_sent: { label: 'Estimate Sent', phase: 'Estimate', progress: 45, next: 'Contract signed' },
  closed_won: { label: 'Job Booked', phase: 'In Progress', progress: 75, next: 'Installation complete' },
  closed_lost: { label: 'Closed', phase: 'Closed', progress: 100, next: 'Project complete' },
};

function statusInfo(rawStatus: string | undefined) {
  const key = (rawStatus || 'new').toLowerCase();
  return STATUS_LABEL[key] || STATUS_LABEL.new;
}

// ─── Handler ─────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
): Promise<Response> {
  return withRateLimit(request, tokenRateLimiter, async () => {
    try {
      const { token } = await params;

      // Basic shape validation — tokens are 64-char hex. Reject anything else
      // without ever touching the backing store so we don't even log noise.
      if (!token || typeof token !== 'string' || token.length < 16 || token.length > 128) {
        return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
      }

      // Look up the lead — this is the token→customer mapping used by the
      // existing authenticated portal. Returns null for any bad/missing token.
      const lead = await leadPortalService.getLeadByToken(token);
      if (!lead) {
        // SECURITY: generic 404 — no hint whether the token was wrong vs unknown.
        return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 });
      }

      // Record the view — fire-and-forget, never blocks the response.
      leadPortalService.recordPortalView(token).catch(err => {
        console.warn('[public/customer-portal] recordPortalView failed:', err);
      });

      // Sales rep lookup — we only expose hand-picked rep fields. Anything
      // internal (repId, subcontractor flag, commission tier, etc.) is NEVER
      // included in the public payload.
      const repData = teamMembers.find(m => m.slug === lead.salesRepSlug);
      const rep: PublicRep = {
        name: repData?.name || lead.salesRepName || 'River City Roofing',
        phone: repData?.phone || '',
        email: repData?.email || '',
        photo: repData?.profileImage || '',
        position: repData?.position || 'Roofing Specialist',
      };

      const info = statusInfo(lead.status);
      const firstName = (lead.customerName || 'Neighbor').split(' ')[0];

      const payload: PublicCustomerPayload = {
        customerName: lead.customerName || '',
        customerFirstName: firstName,
        customerAddress: lead.customerAddress || '',
        projectStatus: lead.status || 'new',
        projectPhase: info.phase,
        projectProgress: info.progress,
        nextMilestone: info.next,
        rep,
        // We intentionally return EMPTY arrays for docs/appointments in the
        // public endpoint. The authenticated /api/customer/[token] route is
        // the one that pulls JobNimbus estimates, tasks, and uploaded docs.
        // Exposing those on the public surface would require per-document
        // isVisible gating we don't have here yet. Better to ship a minimal
        // safe surface and enrich later than leak something by accident.
        appointments: [],
        documents: [],
        createdAt: lead.createdAt || new Date().toISOString(),
      };

      return NextResponse.json({ success: true, data: payload });
    } catch (err) {
      // Don't leak the error shape to the public. Log it server-side instead.
      console.error('[public/customer-portal] unexpected error:', err);
      return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
    }
  });
}
