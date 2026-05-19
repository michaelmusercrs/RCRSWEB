/**
 * /api/portal/admin/audit — read the AuditLog Sheets tab.
 *
 * Admin/owner only. Supports server-side filtering by action, actor, target,
 * date range, and free-text search across details. Returns rows in reverse
 * chronological order, paginated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { googleSheetsService } from '@/lib/google-sheets-service';

function isAdmin(role: string): boolean {
  return role === 'admin' || role === 'owner';
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;
  if (!isAdmin(auth.user.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || undefined;
    const userEmail = searchParams.get('userEmail') || undefined;
    const target = searchParams.get('target') || undefined;
    const search = searchParams.get('search') || undefined;
    const startDate = searchParams.get('startDate') || undefined; // ISO date
    const endDate = searchParams.get('endDate') || undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1);
    const pageSize = Math.min(500, Math.max(10, parseInt(searchParams.get('pageSize') || '50') || 50));

    // googleSheetsService.getAuditLog supports basic action/userEmail filters
    // + a limit. We pull a wider window then filter the rest in memory so the
    // page can show distinct actions/users in the filter dropdowns.
    const fetchLimit = 5000; // upper bound to keep response time sane
    const raw = await googleSheetsService.getAuditLog({
      action,
      userEmail,
      limit: fetchLimit,
    });

    let filtered = raw;
    if (target) {
      const q = target.toLowerCase();
      filtered = filtered.filter(r => (r.Details || '').toLowerCase().includes(q));
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(r =>
        (r.Details || '').toLowerCase().includes(q) ||
        (r.Action || '').toLowerCase().includes(q) ||
        (r.UserEmail || '').toLowerCase().includes(q),
      );
    }
    if (startDate) {
      filtered = filtered.filter(r => (r.Timestamp || '') >= startDate);
    }
    if (endDate) {
      // endDate is inclusive — treat as end-of-day if no time component
      const end = endDate.length === 10 ? `${endDate}T23:59:59.999Z` : endDate;
      filtered = filtered.filter(r => (r.Timestamp || '') <= end);
    }

    const total = filtered.length;
    const offset = (page - 1) * pageSize;
    const rows = filtered.slice(offset, offset + pageSize);

    // Distinct values for filter dropdowns (computed off the raw pull, not
    // post-filter, so the dropdowns don't shrink when a filter is applied).
    const distinctActions = Array.from(new Set(raw.map(r => r.Action).filter(Boolean))).sort();
    const distinctUsers = Array.from(new Set(raw.map(r => r.UserEmail).filter(Boolean))).sort();

    return NextResponse.json({
      rows,
      total,
      page,
      pageSize,
      pages: Math.ceil(total / pageSize),
      distinctActions,
      distinctUsers,
    });
  } catch (err) {
    console.error('[audit api] GET error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
