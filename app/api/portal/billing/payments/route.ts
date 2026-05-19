/**
 * Billing — Payments API
 *
 * GET  /api/portal/billing/payments
 *      List all PipelineInvoice rows whose status is 'sent' (i.e., issued
 *      to customer, awaiting payment). Joined with the source PipelineOrder
 *      so the UI has the job address, customer email, and order context.
 *
 *      Cost data is STRIPPED for non-admin roles via filterCostByRole.
 *
 * POST /api/portal/billing/payments
 *      Body: { invoiceId, amount, date, method, reference?, notes? }
 *      Records the payment by:
 *        1. advancing the source order to PAYMENT_RECEIVED (which marks the
 *           customer invoice paid AND fires the receipt email + JN sync)
 *        2. advancing the source order to JOB_CLOSED
 *      Returns the updated order + invoice.
 *
 * Permissions: any authenticated user with billing access. Restricted by the
 *              portal layout's role gating — the API double-checks role to
 *              return 403 for unauthorized callers (sales reps, drivers).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { materialOrderPipeline } from '@/lib/material-order-pipeline';
import { apiSuccess, apiError, getErrorMessage } from '@/lib/api-response';
import { filterCostByRole } from '@/lib/cost-visibility';

// Force dynamic so route runs at request time. The pipeline service reads
// from Google Sheets on each call so caching here would be incorrect.
export const dynamic = 'force-dynamic';

// Roles allowed to view + record payments. Anyone outside this list gets 403.
const ALLOWED_ROLES = new Set([
  'owner',
  'admin',
  'office',
  'manager',
  'project_manager',
  'pm',
]);

function isAllowed(role: string | undefined | null): boolean {
  if (!role) return false;
  return ALLOWED_ROLES.has(role.toLowerCase());
}

// Whitelist of acceptable payment methods to keep audit data clean
const VALID_METHODS = new Set(['check', 'card', 'ach', 'cash', 'other']);

// -----------------------------------------------------------------------
// GET — list invoices awaiting payment
// -----------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  if (!isAllowed(auth.user.role)) {
    return apiError('Billing access required', 403, 'FORBIDDEN');
  }

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'sent'; // default: awaiting payment

    // Pull customer invoices at the requested status.
    const invoices = await materialOrderPipeline.getInvoices({
      type: 'customer',
      status: status as 'draft' | 'sent' | 'paid' | 'void',
      limit: 500,
    });

    // Fetch the source order for each invoice so the UI has full context.
    // Group orderIds to avoid N+1 fetches when invoices share an order.
    const orderIds = Array.from(new Set(invoices.map(i => i.orderId)));
    const orderMap = new Map<string, Awaited<ReturnType<typeof materialOrderPipeline.getOrderById>>>();
    for (const oid of orderIds) {
      const o = await materialOrderPipeline.getOrderById(oid);
      orderMap.set(oid, o);
    }

    const rows = invoices.map((inv) => {
      const order = orderMap.get(inv.orderId);
      return {
        invoiceId: inv.invoiceId,
        orderId: inv.orderId,
        jobNumber: inv.jobNumber,
        jobName: inv.jobName,
        customerName: inv.customerName,
        customerEmail: inv.customerEmail || order?.customerEmail || '',
        customerPhone: order?.customerPhone || '',
        deliveryAddress: order?.deliveryAddress || '',
        deliveryCity: order?.deliveryCity || '',
        deliveryState: order?.deliveryState || '',
        deliveryZip: order?.deliveryZip || '',
        total: inv.total,
        paidAmount: inv.paidAmount || 0,
        balanceDue: Math.max(0, (inv.total || 0) - (inv.paidAmount || 0)),
        status: inv.status,
        createdAt: inv.createdAt,
        sentAt: inv.sentAt,
        items: inv.items,
        currentStage: order?.currentStage || null,
      };
    });

    // Strip cost fields if the user isn't allowed to see them.
    const safe = filterCostByRole(rows, auth.user.role);
    return apiSuccess({ invoices: safe, count: safe.length });
  } catch (error) {
    console.error('[billing/payments] GET failed:', error);
    return apiError(getErrorMessage(error), 500, 'PAYMENTS_GET_FAILED');
  }
}

// -----------------------------------------------------------------------
// POST — record a payment, advance order to PAYMENT_RECEIVED then JOB_CLOSED
// -----------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  if (!isAllowed(auth.user.role)) {
    return apiError('Billing access required', 403, 'FORBIDDEN');
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError('Invalid JSON body', 400, 'BAD_BODY');
  }

  // Validate inputs ----------------------------------------------------
  const invoiceId = String(body.invoiceId || '').trim();
  const amountNum = Number(body.amount);
  const method = String(body.method || '').toLowerCase().trim();
  const reference = body.reference ? String(body.reference).trim() : '';
  const dateStr = body.date ? String(body.date) : new Date().toISOString();
  const notes = body.notes ? String(body.notes).trim() : '';

  const validation: Record<string, string> = {};
  if (!invoiceId) validation.invoiceId = 'invoiceId is required';
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    validation.amount = 'amount must be a positive number';
  }
  if (!VALID_METHODS.has(method)) {
    validation.method = `method must be one of: ${Array.from(VALID_METHODS).join(', ')}`;
  }
  // date parses cleanly
  if (Number.isNaN(new Date(dateStr).getTime())) {
    validation.date = 'date must be a valid ISO date';
  }
  if (Object.keys(validation).length > 0) {
    return NextResponse.json(
      { success: false, error: 'Validation failed', validation },
      { status: 400 }
    );
  }

  try {
    // Locate the invoice + the order it belongs to.
    const invoice = await materialOrderPipeline.getInvoice(invoiceId);
    if (!invoice) {
      return apiError(`Invoice ${invoiceId} not found`, 404, 'INVOICE_NOT_FOUND');
    }
    if (invoice.status === 'paid') {
      return apiError(`Invoice ${invoiceId} is already paid`, 400, 'ALREADY_PAID');
    }
    const order = await materialOrderPipeline.getOrderById(invoice.orderId);
    if (!order) {
      return apiError(`Source order ${invoice.orderId} not found`, 404, 'ORDER_NOT_FOUND');
    }

    // The order may not yet be at INVOICE_SENT (Stage 16). Recording a
    // payment from this UI implies the office is acknowledging payment for
    // an invoice that was already sent. We require currentStage === INVOICE_SENT.
    if (order.currentStage !== 'INVOICE_SENT') {
      return apiError(
        `Order is at stage ${order.currentStage}; expected INVOICE_SENT before recording payment.`,
        400,
        'WRONG_STAGE'
      );
    }

    // Stage 17: PAYMENT_RECEIVED
    const paidResult = await materialOrderPipeline.advanceStage(
      order.orderId,
      'PAYMENT_RECEIVED',
      auth.user.userId,
      auth.user.name,
      auth.user.role,
      {
        notes:
          notes ||
          `Payment ${method.toUpperCase()}${reference ? ` ref ${reference}` : ''}, $${amountNum.toFixed(2)}`,
        metadata: {
          paymentAmount: amountNum,
          paymentMethod: method,
          paymentReference: reference,
          paymentDate: dateStr,
          recordedBy: auth.user.name,
        },
      }
    );

    if (!paidResult.success) {
      return apiError(
        paidResult.error || 'PAYMENT_RECEIVED transition failed',
        500,
        'STAGE_FAILED'
      );
    }

    // Stage 18: JOB_CLOSED (auto-close on payment)
    const closedResult = await materialOrderPipeline.advanceStage(
      order.orderId,
      'JOB_CLOSED',
      auth.user.userId,
      auth.user.name,
      auth.user.role,
      {
        notes: `Auto-closed after payment ${method.toUpperCase()}${reference ? ` ref ${reference}` : ''}`,
      }
    );

    if (!closedResult.success) {
      // Don't fail the whole request — payment was recorded. Log it.
      console.warn(
        `[billing/payments] PAYMENT_RECEIVED succeeded but JOB_CLOSED failed for ${order.orderId}:`,
        closedResult.error
      );
    }

    // Re-fetch the freshest copies for the response
    const updatedInvoice = await materialOrderPipeline.getInvoice(invoiceId);
    const updatedOrder = await materialOrderPipeline.getOrderById(order.orderId);

    const payload = filterCostByRole(
      {
        invoice: updatedInvoice,
        order: updatedOrder,
        jobClosed: closedResult.success,
        payment: {
          amount: amountNum,
          method,
          reference,
          date: dateStr,
        },
      },
      auth.user.role
    );

    return apiSuccess(payload, 200, 'Payment recorded');
  } catch (error) {
    console.error('[billing/payments] POST failed:', error);
    return apiError(getErrorMessage(error), 500, 'PAYMENT_FAILED');
  }
}
