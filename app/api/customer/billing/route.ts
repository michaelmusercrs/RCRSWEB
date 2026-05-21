/**
 * Customer Billing API
 *
 * GET /api/customer/billing?token=<portalToken>
 *   Returns the authenticated customer's invoices from the master sheet
 *   `Invoices` tab. Used by the Billing tab in /customer/dashboard.
 *
 * Auth: customer portal token, validated via leadPortalService — same
 * pattern as other /api/customer/* endpoints (service-request,
 * warranty-claim, notification-preferences).
 *
 * Privacy: only `type === 'customer'` invoices are returned. Internal
 * invoices that carry cost/margin data are filtered out at the source
 * (see lib/material-order-pipeline.ts). Per the cost-visibility rule,
 * material cost never reaches the customer.
 *
 * Status normalization for the customer-facing UI:
 *   - pipeline 'paid'              -> 'paid'   (green)
 *   - pipeline 'sent' (>30 days)   -> 'overdue' (red)
 *   - pipeline 'sent' (recent)     -> 'posted' (orange)
 *   - pipeline 'draft' | 'void'    -> filtered out (never shown)
 */

import { NextRequest, NextResponse } from 'next/server';
import { leadPortalService } from '@/lib/lead-portal-service';
import { materialOrderPipeline } from '@/lib/material-order-pipeline';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const OVERDUE_AFTER_DAYS = 30;

type CustomerStatus = 'posted' | 'paid' | 'overdue';

function normalizeStatus(
  pipelineStatus: 'draft' | 'sent' | 'paid' | 'void',
  sentAt: string | undefined,
  createdAt: string | undefined,
): CustomerStatus | null {
  if (pipelineStatus === 'paid') return 'paid';
  if (pipelineStatus === 'sent') {
    const refTimestamp = sentAt || createdAt;
    if (refTimestamp) {
      const sentDate = new Date(refTimestamp);
      if (!Number.isNaN(sentDate.getTime())) {
        const ageDays = (Date.now() - sentDate.getTime()) / (1000 * 60 * 60 * 24);
        if (ageDays > OVERDUE_AFTER_DAYS) return 'overdue';
      }
    }
    return 'posted';
  }
  // 'draft' and 'void' are never surfaced to the customer.
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json(
      { success: false, error: 'token required' },
      { status: 400 },
    );
  }

  // Validate the token resolves to a real customer (lead-portal service is
  // the canonical token registry; same pattern as service-request route).
  const lead = await leadPortalService.getLeadByToken(token);
  if (!lead) {
    return NextResponse.json(
      { success: false, error: 'Invalid or expired token' },
      { status: 401 },
    );
  }

  try {
    // Pull only customer-facing invoices; internal cost-bearing invoices
    // are excluded by the pipeline filter.
    const all = await materialOrderPipeline.getInvoices({ type: 'customer' });

    const customerName = (lead.customerName || '').toLowerCase().trim();
    const customerEmail = (lead.customerEmail || '').toLowerCase().trim();

    const mine = all.filter((inv) => {
      const invName = (inv.customerName || '').toLowerCase().trim();
      const invEmail = (inv.customerEmail || '').toLowerCase().trim();
      if (customerEmail && invEmail && invEmail === customerEmail) return true;
      if (customerName && invName && invName === customerName) return true;
      return false;
    });

    // Map + status-normalize + drop draft/void.
    const safe = mine
      .map((inv) => {
        const status = normalizeStatus(inv.status, inv.sentAt, inv.createdAt);
        if (!status) return null;
        return {
          invoiceId: inv.invoiceId,
          ticketId: inv.orderId,           // pipeline `orderId` is the work-ticket id
          jobName: inv.jobName || '',
          total: inv.total,
          status,
          paidAt: inv.paidAt,
          createdAt: inv.createdAt,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    // Newest first.
    safe.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    return NextResponse.json({
      success: true,
      invoices: safe,
    });
  } catch (err) {
    console.error('[customer billing] failed:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to load invoices' },
      { status: 500 },
    );
  }
}
