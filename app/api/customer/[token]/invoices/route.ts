/**
 * Customer Invoices API
 *
 * GET /api/customer/[token]/invoices
 *   Returns all customer-facing invoices for the authenticated customer.
 *   Each invoice includes line items, totals, status, and how much is still
 *   owed (total - paidAmount).
 *
 * Auth: customer portal token, validated via leadPortalService.
 * Privacy: only returns invoices of type 'customer' — internal invoices that
 * include cost/margin data are stripped.
 */

import { NextRequest, NextResponse } from 'next/server';
import { leadPortalService } from '@/lib/lead-portal-service';
import { materialOrderPipeline } from '@/lib/material-order-pipeline';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) {
    return NextResponse.json({ success: false, error: 'token required' }, { status: 400 });
  }

  // Validate the token resolves to a real customer
  const lead = await leadPortalService.getLeadByToken(token);
  if (!lead) {
    return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 401 });
  }

  try {
    // Pull all customer-facing invoices and filter by name match.
    // (Pipeline invoices are keyed by customerName/customerEmail rather than
    // customerId, so name match is the most reliable join.)
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

    // Strip any internal-only fields just in case (defense in depth)
    const safe = mine.map((inv) => ({
      invoiceId: inv.invoiceId,
      jobNumber: inv.jobNumber,
      jobName: inv.jobName,
      customerName: inv.customerName,
      items: inv.items.map((i) => ({
        productName: i.productName,
        quantity: i.quantity,
        unit: i.unit,
        unitPrice: i.unitPrice,
        totalPrice: i.totalPrice,
      })),
      subtotal: inv.subtotal,
      tax: inv.tax,
      total: inv.total,
      paidAmount: inv.paidAmount || 0,
      balanceDue: Math.max(0, inv.total - (inv.paidAmount || 0)),
      status: inv.status,
      createdAt: inv.createdAt,
      sentAt: inv.sentAt,
      paidAt: inv.paidAt,
    }));

    // Sort newest first
    safe.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    const totalOwed = safe.reduce((sum, inv) => sum + inv.balanceDue, 0);

    return NextResponse.json({
      success: true,
      invoices: safe,
      totalOwed,
      paymentMethods: ['check', 'cash', 'card', 'insurance', 'financing', 'bitcoin'] as const,
    });
  } catch (err) {
    console.error('[customer invoices] failed:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to load invoices' },
      { status: 500 }
    );
  }
}
