/**
 * GET /api/portal/billing/payments/pdf?invoiceId=CINV-...&variant=customer|internal|receipt
 *
 * Streams a generated PDF for the given invoice. Variants:
 *   - customer (default): price-only customer-facing invoice
 *   - internal: cost + price + margin (admin/office/owner only)
 *   - receipt: paid receipt (uses payment info from the most recent
 *              PAYMENT_RECEIVED event on the order, falls back to total)
 *
 * Role gating:
 *   - customer  -> any billing-allowed role
 *   - internal  -> admin / owner / office / manager only (cost visible)
 *   - receipt   -> any billing-allowed role
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { materialOrderPipeline } from '@/lib/material-order-pipeline';
import { canSeeCost } from '@/lib/cost-visibility';
import { apiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const BILLING_ROLES = new Set([
  'owner', 'admin', 'office', 'manager', 'project_manager', 'pm',
]);

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  if (!BILLING_ROLES.has(auth.user.role.toLowerCase())) {
    return apiError('Billing access required', 403, 'FORBIDDEN');
  }

  const url = new URL(request.url);
  const invoiceId = url.searchParams.get('invoiceId') || '';
  const variant = (url.searchParams.get('variant') || 'customer').toLowerCase();

  if (!invoiceId) {
    return apiError('invoiceId query param required', 400, 'BAD_REQUEST');
  }

  // Internal PDF is restricted to cost-visible roles
  if (variant === 'internal' && !canSeeCost(auth.user.role)) {
    return apiError('Internal invoice requires admin/office access', 403, 'COST_HIDDEN');
  }

  try {
    const invoice = await materialOrderPipeline.getInvoice(invoiceId);
    if (!invoice) {
      return apiError(`Invoice ${invoiceId} not found`, 404, 'NOT_FOUND');
    }
    const order = await materialOrderPipeline.getOrderById(invoice.orderId);
    if (!order) {
      return apiError(`Order ${invoice.orderId} not found`, 404, 'NOT_FOUND');
    }

    const {
      renderCustomerInvoicePDF,
      renderInternalInvoicePDF,
      renderPaymentReceiptPDF,
    } = await import('@/lib/invoice-pdf');

    let buf: Buffer;
    let filename: string;

    if (variant === 'internal') {
      buf = await renderInternalInvoicePDF(invoice, order);
      filename = `internal-${invoice.invoiceId}.pdf`;
    } else if (variant === 'receipt') {
      // Pull the most recent PAYMENT_RECEIVED event for payment details
      const payEvent = [...order.events]
        .reverse()
        .find((e) => e.stage === 'PAYMENT_RECEIVED');
      let amount = order.paymentAmount || invoice.paidAmount || invoice.total || 0;
      let method = 'check';
      let reference: string | undefined;
      let date = order.paymentDate || invoice.paidAt || new Date().toISOString();
      if (payEvent?.metadata) {
        try {
          const meta = JSON.parse(payEvent.metadata) as Record<string, unknown>;
          if (meta.paymentAmount != null) amount = Number(meta.paymentAmount);
          if (meta.paymentMethod) method = String(meta.paymentMethod);
          if (meta.paymentReference) reference = String(meta.paymentReference);
          if (meta.paymentDate) date = String(meta.paymentDate);
        } catch {
          // ignore malformed metadata
        }
      }
      buf = await renderPaymentReceiptPDF(invoice, order, { amount, method, reference, date });
      filename = `receipt-${invoice.invoiceId}.pdf`;
    } else {
      buf = await renderCustomerInvoicePDF(invoice, order);
      filename = `invoice-${invoice.invoiceId}.pdf`;
    }

    // Copy into a fresh ArrayBuffer to satisfy DOM types (which prohibit
    // SharedArrayBuffer-backed views).
    const ab = new ArrayBuffer(buf.byteLength);
    new Uint8Array(ab).set(buf);
    const blob = new Blob([ab], { type: 'application/pdf' });
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('[billing/payments/pdf] failed:', error);
    return apiError(
      error instanceof Error ? error.message : 'PDF generation failed',
      500,
      'PDF_FAILED'
    );
  }
}
