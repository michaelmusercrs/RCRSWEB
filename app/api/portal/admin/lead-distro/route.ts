// Lead Distribution Dispatch API (Portal Admin)
// GET: returns the unassigned lead queue + recently assigned leads + today's stats
// POST: (action=assign) thin wrapper around the existing assignment pipeline
//
// Used by: app/(tools)/portal/admin/lead-distro/dispatch/page.tsx
//
// Role gate: owner, admin, office, manager, project_manager
// (Sales reps and drivers are NOT allowed — they have their own views.)

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { leadPortalService, LeadRecord } from '@/lib/lead-portal-service';
import { leadPipelineOrchestrator } from '@/lib/lead-pipeline-orchestrator';
import { getSalesReps } from '@/lib/team-roles';

const DISPATCH_ROLES = new Set([
  'owner',
  'admin',
  'office',
  'manager',
  'project_manager',
]);

// ---------------------------------------------------------------------------
// Shape returned to the UI. Kept deliberately small so the dispatch table can
// render without secondary lookups.
// ---------------------------------------------------------------------------
export interface DispatchLead {
  leadId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  source: string;
  sourceDetails?: string;
  status: LeadRecord['status'];
  salesRepSlug: string;
  salesRepName: string;
  assignedAt?: string;
  createdAt: string;
}

export interface DispatchStats {
  unassignedCount: number;
  assignedTodayCount: number;
  avgResponseMinutesToday: number | null;
  topAssigneeToday: { name: string; slug: string; count: number } | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isUnassigned(lead: LeadRecord): boolean {
  // A lead is "unassigned" when it has no sales rep slug AND it's still new.
  // We purposely don't use status alone — a 'new' lead might already have a rep.
  const noRep = !lead.salesRepSlug || lead.salesRepSlug.trim() === '';
  return noRep && lead.status === 'new';
}

function isAssigned(lead: LeadRecord): boolean {
  return !!(lead.salesRepSlug && lead.salesRepSlug.trim() !== '');
}

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function toDispatchLead(lead: LeadRecord): DispatchLead {
  return {
    leadId: lead.leadId,
    customerName: lead.customerName || '',
    customerPhone: lead.customerPhone || '',
    customerEmail: lead.customerEmail || '',
    customerAddress: lead.customerAddress || '',
    source: lead.source || 'unknown',
    sourceDetails: lead.sourceDetails,
    status: lead.status,
    salesRepSlug: lead.salesRepSlug || '',
    salesRepName: lead.salesRepName || '',
    assignedAt: lead.updatedAt,
    createdAt: lead.createdAt,
  };
}

// ---------------------------------------------------------------------------
// GET — dispatch queue snapshot
// ---------------------------------------------------------------------------
export async function GET(_request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  if (!DISPATCH_ROLES.has(auth.user.role)) {
    return NextResponse.json(
      { success: false, error: 'You do not have permission to dispatch leads.' },
      { status: 403 }
    );
  }

  try {
    // Pull a generous window. The underlying sheet service caps naturally.
    const allLeads = await leadPortalService.getLeads({ limit: 500 });

    const unassigned: DispatchLead[] = allLeads
      .filter(isUnassigned)
      .map(toDispatchLead);

    const assignedAll = allLeads.filter(isAssigned);
    const recentlyAssigned: DispatchLead[] = assignedAll
      .slice(0, 50)
      .map(toDispatchLead);

    // Today's stats — computed from whichever timestamp we have.
    const todayStart = startOfTodayIso();
    const assignedToday = assignedAll.filter(l => {
      const stamp = l.updatedAt || l.createdAt;
      return stamp && stamp >= todayStart;
    });

    const byRepToday = new Map<string, { name: string; slug: string; count: number }>();
    for (const l of assignedToday) {
      const slug = l.salesRepSlug;
      if (!slug) continue;
      const existing = byRepToday.get(slug);
      if (existing) {
        existing.count += 1;
      } else {
        byRepToday.set(slug, { slug, name: l.salesRepName || slug, count: 1 });
      }
    }
    let topAssigneeToday: DispatchStats['topAssigneeToday'] = null;
    for (const entry of byRepToday.values()) {
      if (!topAssigneeToday || entry.count > topAssigneeToday.count) {
        topAssigneeToday = entry;
      }
    }

    // Rough average response time — time from createdAt to updatedAt for
    // leads assigned today. The underlying service doesn't expose a clean
    // "first responded" timestamp, so this is a best-effort proxy and we
    // only count rows where updatedAt > createdAt.
    let avgResponseMinutesToday: number | null = null;
    const responseGaps: number[] = [];
    for (const l of assignedToday) {
      if (!l.updatedAt || !l.createdAt) continue;
      const created = new Date(l.createdAt).getTime();
      const updated = new Date(l.updatedAt).getTime();
      if (Number.isNaN(created) || Number.isNaN(updated)) continue;
      if (updated <= created) continue;
      responseGaps.push((updated - created) / 60000);
    }
    if (responseGaps.length > 0) {
      avgResponseMinutesToday =
        responseGaps.reduce((a, b) => a + b, 0) / responseGaps.length;
    }

    const stats: DispatchStats = {
      unassignedCount: unassigned.length,
      assignedTodayCount: assignedToday.length,
      avgResponseMinutesToday,
      topAssigneeToday,
    };

    return NextResponse.json({
      success: true,
      unassigned,
      recentlyAssigned,
      stats,
      salesReps: getSalesReps().map(r => ({
        slug: r.slug,
        name: r.name,
        email: r.email,
      })),
    });
  } catch (err) {
    console.error('[portal/admin/lead-distro GET] Failed:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST — assign action (thin wrapper over the existing pipeline)
// Body: { action: 'assign', leadId, repSlug, notes? }
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  if (!DISPATCH_ROLES.has(auth.user.role)) {
    return NextResponse.json(
      { success: false, error: 'You do not have permission to dispatch leads.' },
      { status: 403 }
    );
  }

  let body: {
    action?: string;
    leadId?: string;
    repSlug?: string;
    notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  if (body.action !== 'assign') {
    return NextResponse.json(
      { success: false, error: `Unknown action: ${body.action}` },
      { status: 400 }
    );
  }

  if (!body.leadId || !body.repSlug) {
    return NextResponse.json(
      { success: false, error: 'leadId and repSlug are required' },
      { status: 400 }
    );
  }

  try {
    // Look up the lead record so we can pass the full customer context
    // through to the orchestrator (it needs these for the JN sync step).
    const existing = await leadPortalService.getLeadById(body.leadId);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: `Lead ${body.leadId} not found` },
        { status: 404 }
      );
    }

    const result = await leadPipelineOrchestrator.confirmAssignment({
      leadId: body.leadId,
      repSlug: body.repSlug,
      customerName: existing.customerName || '',
      customerEmail: existing.customerEmail || '',
      customerPhone: existing.customerPhone || '',
      customerAddress: existing.customerAddress || '',
      createPortal: true,
      syncToJN: true,
    });

    // Update portal status to contacted (best-effort — may not exist)
    try {
      await leadPortalService.updateLeadStatus(
        body.leadId,
        'contacted',
        auth.user.name || auth.user.email
      );
    } catch {
      // ignore
    }

    return NextResponse.json({
      success: result.success,
      data: {
        leadId: result.leadId,
        portalUrl: result.portalUrl,
        jnContactId: result.jnContactId,
        timerStarted: result.timerStarted,
        repSlug: body.repSlug,
      },
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (err) {
    console.error('[portal/admin/lead-distro POST] Failed:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
