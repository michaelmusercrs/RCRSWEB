/**
 * GAF review-page API.
 *
 *   GET  → list every report in the queue; for open (unmatched/escalated/review)
 *          reports, include live JN address-match suggestions the office can
 *          one-click accept.
 *   POST → office action:
 *            { orderNumber, jobNumber }         → manually match to a JN job
 *            { orderNumber, action: 'skip' }    → dismiss (won't process again)
 *            { orderNumber, action: 'retry' }   → clear error, retry now
 *
 * Office/admin/owner/manager only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllReports, upsertReport, logIngest } from '@/lib/gaf/report-queue';
import { getCandidateJobs, matchJob } from '@/lib/gaf/jn-address-match';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

const ALLOWED = ['admin', 'owner', 'manager', 'office'];

async function guard() {
  const { requireAuth } = await import('@/lib/auth-service');
  const auth = await requireAuth();
  if (!auth.authenticated) return { ok: false as const, response: auth.response };
  if (!ALLOWED.includes(auth.user.role)) {
    return { ok: false as const, response: NextResponse.json({ error: 'Not authorized' }, { status: 403 }) };
  }
  return { ok: true as const, user: auth.user };
}

export async function GET() {
  const g = await guard();
  if (!g.ok) return g.response;

  const reports = await getAllReports();
  const open = reports.filter(r => ['unmatched', 'escalated', 'error', 'new'].includes(r.status) && !r.jobJnid);

  // Live match suggestions for open reports (single job fetch, reused).
  let candidates: Awaited<ReturnType<typeof getCandidateJobs>> = [];
  if (open.length) {
    try { candidates = await getCandidateJobs({ sinceDays: 180 }); } catch { /* best-effort */ }
  }

  const enriched = reports
    .sort((a, b) => (b.firstSeenAt || '').localeCompare(a.firstSeenAt || ''))
    .map(r => {
      const suggestions = (!r.jobJnid && candidates.length)
        ? matchJob(r.address, candidates, r.repLocalPart || r.repName).candidates
        : [];
      return { ...r, suggestions };
    });

  return NextResponse.json({ success: true, reports: enriched });
}

export async function POST(request: NextRequest) {
  const g = await guard();
  if (!g.ok) return g.response;

  const body = await request.json().catch(() => ({}));
  const orderNumber = String(body.orderNumber || '').trim();
  if (!orderNumber) return NextResponse.json({ error: 'orderNumber required' }, { status: 400 });

  const action = String(body.action || '').trim();

  if (action === 'skip') {
    await upsertReport({ orderNumber, status: 'skipped', lastAttemptAt: new Date().toISOString() });
    await logIngest({ orderNumber, address: '', status: 'skipped_by_office', detail: g.user.email || g.user.role });
    return NextResponse.json({ success: true, status: 'skipped' });
  }

  if (action === 'retry') {
    await upsertReport({ orderNumber, status: 'new', nextAttemptAt: '', lastError: '' });
    return NextResponse.json({ success: true, status: 'requeued' });
  }

  const jobNumber = String(body.jobNumber || '').trim();
  if (!jobNumber) return NextResponse.json({ error: 'jobNumber required' }, { status: 400 });

  // Set the manual override + requeue; the next cron run attaches it (and the
  // material summary) through the same verified path as an auto-match.
  await upsertReport({
    orderNumber,
    manualJobNumber: jobNumber,
    status: 'new',
    nextAttemptAt: '',
    lastError: '',
  });
  await logIngest({ orderNumber, address: '', status: 'manual_match_set', jobNumber, detail: g.user.email || g.user.role });
  return NextResponse.json({ success: true, status: 'matched', jobNumber });
}
