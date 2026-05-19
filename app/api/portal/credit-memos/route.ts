/**
 * Credit Memos API
 *
 * POST  /api/portal/credit-memos             Create a credit memo manually
 * GET   /api/portal/credit-memos?job=R-...   List credit memos for a job
 * GET   /api/portal/credit-memos?ticket=...  List credit memos for a ticket
 *
 * Credit memos track materials FROM OUR CATALOG that came back to the
 * warehouse and were re-shelved (verified restock). They reduce the job's
 * material cost in the breakdown / P&L.
 *
 * Most credit memos are created automatically by the return-ticket flow
 * (see app/api/portal/tickets/route.ts). This endpoint is for the manual
 * case: PM or driver discovers leftover material at the shop, restocks it,
 * and needs to back the cost off the originating job.
 *
 * Format: `CM<job-digits>-<n>` (e.g. CM11071-1).
 *
 * For OUTSIDE-vendor returns (SRS / ABC material we didn't stock), use
 * /api/portal/vendor-returns instead — that flow chases a vendor credit.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import {
  jobMaterialCostService,
  type JobMaterialCostLine,
} from '@/lib/job-material-cost-service';
import { auditLog } from '@/lib/audit-logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_CREATE_ROLES = new Set([
  'driver',
  'admin',
  'owner',
  'office',
  'manager',
  'project_manager',
]);

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const { searchParams } = new URL(request.url);
  const job = searchParams.get('job');
  const ticket = searchParams.get('ticket');

  try {
    if (ticket) {
      const records = (await jobMaterialCostService.getByTicket(ticket))
        .filter(r => r.type === 'credit_memo');
      return NextResponse.json({ records });
    }
    if (job) {
      const records = (await jobMaterialCostService.getByJobNumber(job))
        .filter(r => r.type === 'credit_memo');
      return NextResponse.json({ records });
    }
    return NextResponse.json(
      { error: 'Provide ?job=<jobNumber> or ?ticket=<ticketId>' },
      { status: 400 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;
  if (!ALLOWED_CREATE_ROLES.has(auth.user.role)) {
    return NextResponse.json(
      { error: 'PM / driver / office / admin role required' },
      { status: 403 },
    );
  }

  let body: {
    jobNumber?: string;
    jobId?: string;
    jobName?: string;
    customerName?: string;
    customerAddress?: string;
    salesRepName?: string;
    ticketId?: string;
    referenceNumber?: string;
    lines?: JobMaterialCostLine[];
    notes?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.jobNumber) {
    return NextResponse.json({ error: 'jobNumber is required' }, { status: 400 });
  }
  if (!Array.isArray(body.lines) || body.lines.length === 0) {
    return NextResponse.json(
      { error: 'At least one line is required' },
      { status: 400 },
    );
  }

  const lines: JobMaterialCostLine[] = body.lines
    .map(l => ({
      productId: String(l.productId || '').trim(),
      productName: String(l.productName || '').trim(),
      quantity: Number(l.quantity) || 0,
      unitCost: Number(l.unitCost) || 0,
      lineCost:
        Number(l.lineCost) ||
        (Number(l.quantity) || 0) * (Number(l.unitCost) || 0),
    }))
    .filter(l => l.productId && l.quantity > 0);

  if (lines.length === 0) {
    return NextResponse.json(
      { error: 'No valid lines provided (each needs productId + quantity > 0)' },
      { status: 400 },
    );
  }

  try {
    const record = await jobMaterialCostService.createCreditMemoFromReturn({
      ticketId: body.ticketId || `manual-${Date.now()}`,
      referenceNumber: body.referenceNumber || body.jobNumber,
      jobId: body.jobId,
      jobNumber: body.jobNumber,
      jobName: body.jobName,
      customerName: body.customerName,
      customerAddress: body.customerAddress,
      salesRepName: body.salesRepName,
      lines,
      createdBy: auth.user.userId,
      createdByName: auth.user.name,
      notes:
        body.notes ||
        `Manual credit memo created by ${auth.user.name} via portal — materials returned to warehouse and restocked.`,
    });

    try {
      auditLog(
        'CREDIT_MEMO_CREATED',
        auth.user.email,
        `Credit memo ${record.invoiceId} created. Job: ${record.jobNumber}. Lines: ${record.lines.length}. Total cost credited: $${record.totalCost.toFixed(2)}.`,
        request,
      );
    } catch (auditErr) {
      console.warn('[audit] CREDIT_MEMO_CREATED log failed:', auditErr);
    }

    return NextResponse.json({ success: true, creditMemo: record });
  } catch (err) {
    console.error('[credit-memos] create failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
