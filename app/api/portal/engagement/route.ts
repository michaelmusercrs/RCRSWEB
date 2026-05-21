// Rep engagement panel — per-customer summary of portal usage.
//
// GET /api/portal/engagement?leadId=...  → engagement for one specific lead
// GET /api/portal/engagement              → list across the rep's leads (last 30)
//
// Self only — sales role can only see own leads' engagement. Admin/owner
// can pass ?rep= to view any rep's customers.

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { googleSheetsService } from '@/lib/google-sheets-service';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const role = (auth.user.role || '').toLowerCase();
  const ownSlug = (auth.user.userId || '').toLowerCase();
  const isElevated = ['owner', 'admin', 'manager'].includes(role);

  const leadId = request.nextUrl.searchParams.get('leadId') || '';
  const repFilter = isElevated
    ? (request.nextUrl.searchParams.get('rep') || ownSlug)
    : ownSlug;

  if (!repFilter && !leadId) {
    return NextResponse.json({ success: false, error: 'rep or leadId required' }, { status: 400 });
  }

  try {
    const events = await googleSheetsService.getCustomerPortalEvents({
      leadId: leadId || undefined,
      assignedRep: leadId ? undefined : repFilter,
      excludePreview: true,
      limit: 5000,
    });

    if (leadId) {
      // Single-lead detail
      const views = events.filter(e => e.eventType === 'portal_view');
      const totalTimeMs = events.reduce((a, e) => a + (parseInt(e.timeOnPageMs || '0') || 0), 0);
      const lastView = views[0]?.createdAt || '';
      const tileInteractions: Record<string, number> = {};
      for (const e of events.filter(x => x.eventType === 'tile_interact' && x.tileKey)) {
        tileInteractions[e.tileKey] = (tileInteractions[e.tileKey] || 0) + 1;
      }
      return NextResponse.json({
        success: true,
        leadId,
        portalViews: views.length,
        totalEvents: events.length,
        totalTimeOnPageMs: totalTimeMs,
        lastViewedAt: lastView,
        tileInteractions,
        callClickedCount: events.filter(e => e.eventType === 'call_clicked').length,
        ikoClickedCount: events.filter(e => e.eventType === 'iko_clickthrough').length,
        docViewCount: events.filter(e => e.eventType === 'doc_view').length,
      });
    }

    // Per-rep summary across leads
    const byLead: Record<string, { customerName: string; views: number; lastView: string; calls: number }> = {};
    for (const e of events) {
      const k = e.leadId;
      if (!k) continue;
      const acc = byLead[k] || { customerName: e.customerName, views: 0, lastView: '', calls: 0 };
      if (e.eventType === 'portal_view') {
        acc.views++;
        if (!acc.lastView || e.createdAt > acc.lastView) acc.lastView = e.createdAt;
      }
      if (e.eventType === 'call_clicked') acc.calls++;
      acc.customerName = acc.customerName || e.customerName;
      byLead[k] = acc;
    }
    const leads = Object.entries(byLead)
      .map(([leadId, s]) => ({ leadId, ...s }))
      .sort((a, b) => b.lastView.localeCompare(a.lastView))
      .slice(0, 30);
    return NextResponse.json({ success: true, rep: repFilter, leads });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Internal error',
    }, { status: 500 });
  }
}
