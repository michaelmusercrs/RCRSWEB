// My Response Time — rep dashboard widget data
//
// GET returns the requesting rep's own response-time stats over the last
// 30 days. Sales rep only sees own data; admin/manager can pass ?rep=slug
// to view any rep. Customers and reps-viewing-other-reps are denied.

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { googleSheetsService } from '@/lib/google-sheets-service';
import { TEAM_MEMBERS } from '@/lib/team-roles';

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function p95(arr: number[]): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1];
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const role = (auth.user.role || '').toLowerCase();
  const requestedRep = request.nextUrl.searchParams.get('rep') || '';
  const ownSlug = (auth.user.userId || '').toLowerCase();
  const isElevated = ['owner', 'admin', 'manager'].includes(role);

  // Rep can only see own data. Elevated roles can see anyone via ?rep=.
  const targetSlug = isElevated && requestedRep ? requestedRep.toLowerCase() : ownSlug;
  if (!targetSlug) {
    return NextResponse.json({ success: false, error: 'No rep identified' }, { status: 400 });
  }
  if (!isElevated && requestedRep && requestedRep.toLowerCase() !== ownSlug) {
    return NextResponse.json({ success: false, error: 'Forbidden — sales role can only view own response time' }, { status: 403 });
  }

  try {
    const cutoff = Date.now() - 30 * 86400000;
    const all = await googleSheetsService.getLeadResponseLogs({ repSlug: targetSlug });
    const recent = all.filter(l => {
      const t = new Date(l.assignedAt).getTime();
      return !isNaN(t) && t >= cutoff;
    });

    const responses: number[] = [];
    let breaches = 0;
    let reassigned = 0;
    for (const log of recent) {
      const min = parseFloat(log.responseMinutes || '');
      if (!isNaN(min) && min > 0) {
        responses.push(min);
        if (min > 60) breaches++;
      } else if (log.reassignedAt) {
        breaches++;
        reassigned++;
      }
    }
    const avg = responses.length ? responses.reduce((a, b) => a + b, 0) / responses.length : 0;
    const member = TEAM_MEMBERS.find(m => m.slug === targetSlug);

    return NextResponse.json({
      success: true,
      rep: { slug: targetSlug, name: member?.name || targetSlug },
      window: 'last 30 days',
      assignments: recent.length,
      responded: responses.length,
      avgMinutes: Math.round(avg * 10) / 10,
      medianMinutes: Math.round(median(responses) * 10) / 10,
      p95Minutes: Math.round(p95(responses) * 10) / 10,
      slaBreaches: breaches,
      reassignedOut: reassigned,
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to compute stats',
    }, { status: 500 });
  }
}
