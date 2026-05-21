/**
 * Material Order Pipeline API
 *
 * 18-stage material order lifecycle management.
 *
 * POST actions:
 *   createOrder       - Create a new material order (PM/Office/Admin/Owner only)
 *   advanceStage      - Move order to a later stage (flexible, allows skipping)
 *   transitionStage   - Move order to the exact NEXT stage (strict sequential, no skipping)
 *   cancelOrder       - Cancel an order (Admin/Owner/Office only)
 *   createReturnTicket - Create a return ticket for materials (PM/Office/Admin/Owner)
 *   updateInvoiceStatus - Update invoice payment status (Office/Admin/Owner only)
 *
 * Role enforcement:
 *   - createOrder: PM, Office, Admin, Owner
 *   - transitionStage/advanceStage: role must match STAGE_CONFIG.performedBy or be Admin/Owner
 *   - DELIVERY_CONFIRMED: Driver only (or Admin/Owner override)
 *   - cancelOrder: Admin, Owner, Office
 *   - createReturnTicket: PM, Office, Admin, Owner
 *   - updateInvoiceStatus: Office, Admin, Owner
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import {
  materialOrderPipeline,
  PIPELINE_STAGES,
  STAGE_CONFIG,
  type PipelineStage,
  type OrderPriority,
} from '@/lib/material-order-pipeline';
import { unifiedInventoryService } from '@/lib/unified-inventory-service';
import { filterCostByRole } from '@/lib/cost-visibility';

// ============================================
// ROLE HELPERS
// ============================================

const ORDER_CREATE_ROLES = ['pm', 'office', 'admin', 'owner', 'manager'];
const CANCEL_ROLES = ['office', 'admin', 'owner'];
const INVOICE_ROLES = ['office', 'admin', 'owner'];
const RETURN_TICKET_ROLES = ['pm', 'office', 'admin', 'owner', 'manager', 'driver'];
const ADMIN_OVERRIDE_ROLES = ['admin', 'owner'];

/**
 * Map the user's portal role to the stage's performedBy field.
 * STAGE_CONFIG uses: pm, office, driver, warehouse, system, billing
 * Auth roles: admin, owner, manager, office, pm, sales, driver
 */
function canPerformStage(userRole: string, stage: PipelineStage): boolean {
  if (ADMIN_OVERRIDE_ROLES.includes(userRole)) return true;
  const config = STAGE_CONFIG[stage];
  if (!config) return false;
  if (config.performedBy === 'system') return true; // System stages can be triggered by anyone
  // Direct role match
  if (config.performedBy === userRole) return true;
  // Manager can do PM and office tasks
  if (userRole === 'manager' && ['pm', 'office'].includes(config.performedBy)) return true;
  // Office can do billing tasks
  if (userRole === 'office' && config.performedBy === 'billing') return true;
  return false;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'list';

    switch (action) {
      // Cost visibility gate — every order/list/active/byDriver/atStage/pullSheet
      // response gets filtered through filterCostByRole. Sales reps and any
      // role outside the COST_VISIBLE_ROLES set in lib/cost-visibility.ts
      // will get cost fields (unitCost, totalCost, margin, etc.) stripped
      // before the response leaves the route.
      // Roles allowed to see cost: owner, admin, office, manager, driver.
      // Driver = Richard, who handles inventory accounting.

      case 'list': {
        const stage = searchParams.get('stage') as PipelineStage | null;
        const priority = searchParams.get('priority') as OrderPriority | null;
        const driverId = searchParams.get('driverId') || undefined;
        const jobNumber = searchParams.get('jobNumber') || undefined;
        const limit = parseInt(searchParams.get('limit') || '100');
        const cancelled = searchParams.get('cancelled') === 'true' ? true : searchParams.get('cancelled') === 'false' ? false : undefined;
        const paymentStatus = searchParams.get('paymentStatus') as any || undefined;

        const orders = await materialOrderPipeline.getOrders({
          stage: stage || undefined,
          priority: priority || undefined,
          driverId,
          jobNumber,
          cancelled,
          paymentStatus,
          limit,
        });
        return NextResponse.json(filterCostByRole(orders, auth.user.role));
      }

      case 'order': {
        const orderId = searchParams.get('orderId');
        if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });
        const order = await materialOrderPipeline.getOrderById(orderId);
        if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        return NextResponse.json(filterCostByRole(order, auth.user.role));
      }

      case 'active': {
        const orders = await materialOrderPipeline.getActiveOrders();
        return NextResponse.json(filterCostByRole(orders, auth.user.role));
      }

      case 'byDriver': {
        const driverId = searchParams.get('driverId');
        if (!driverId) return NextResponse.json({ error: 'driverId required' }, { status: 400 });
        const orders = await materialOrderPipeline.getOrdersByDriver(driverId);
        return NextResponse.json(filterCostByRole(orders, auth.user.role));
      }

      case 'atStage': {
        const stage = searchParams.get('stage') as PipelineStage;
        if (!stage) return NextResponse.json({ error: 'stage required' }, { status: 400 });
        const orders = await materialOrderPipeline.getOrdersAtStage(stage);
        return NextResponse.json(filterCostByRole(orders, auth.user.role));
      }

      case 'stats': {
        const stats = await materialOrderPipeline.getOrderStats();
        return NextResponse.json(filterCostByRole(stats, auth.user.role));
      }

      case 'pullSheet': {
        const orderId = searchParams.get('orderId');
        if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });
        const pullSheet = await materialOrderPipeline.generatePullSheet(orderId);
        if (!pullSheet) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        return NextResponse.json(filterCostByRole(pullSheet, auth.user.role));
      }

      case 'stages': {
        return NextResponse.json({ stages: PIPELINE_STAGES, config: STAGE_CONFIG });
      }

      case 'invoices': {
        const orderId = searchParams.get('orderId');
        const type = searchParams.get('type') as any;
        const status = searchParams.get('status') as any;

        if (orderId) {
          const invoices = await materialOrderPipeline.getInvoicesByOrder(orderId);
          // Filter internal invoices for non-admin/office
          const role = auth.user.role;
          if (role !== 'admin' && role !== 'owner' && role !== 'office') {
            return NextResponse.json(filterCostByRole(invoices.filter(i => i.type === 'customer'), role));
          }
          return NextResponse.json(invoices);
        }

        const invoices = await materialOrderPipeline.getInvoices({ type, status });
        // Filter internal invoices for non-admin/office
        const role = auth.user.role;
        if (role !== 'admin' && role !== 'owner' && role !== 'office') {
          return NextResponse.json(filterCostByRole(invoices.filter(i => i.type === 'customer'), role));
        }
        return NextResponse.json(invoices);
      }

      case 'invoice': {
        const invoiceId = searchParams.get('invoiceId');
        if (!invoiceId) return NextResponse.json({ error: 'invoiceId required' }, { status: 400 });
        const invoice = await materialOrderPipeline.getInvoice(invoiceId);
        if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

        // Block internal invoice access for non-admin/office
        const role = auth.user.role;
        if (invoice.type === 'internal' && role !== 'admin' && role !== 'owner' && role !== 'office') {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        return NextResponse.json(filterCostByRole(invoice, role));
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Pipeline API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { action } = body;
    const userRole = auth.user.role;

    switch (action) {
      // ============================================
      // 1. CREATE ORDER
      // ============================================
      case 'createOrder': {
        // Role check: PM, Office, Admin, Owner, Manager
        if (!ORDER_CREATE_ROLES.includes(userRole)) {
          return NextResponse.json(
            { error: 'Access denied. Only PM, Office, Admin, or Owner can create orders.' },
            { status: 403 }
          );
        }

        // Validate required fields
        const requiredFields = ['jobNumber', 'jobName', 'items'];
        for (const field of requiredFields) {
          if (!body[field]) {
            return NextResponse.json(
              { error: `Missing required field: ${field}` },
              { status: 400 }
            );
          }
        }

        // Validate items array
        if (!Array.isArray(body.items) || body.items.length === 0) {
          return NextResponse.json(
            { error: 'items must be a non-empty array of { productId, quantity, unit? }' },
            { status: 400 }
          );
        }
        for (let i = 0; i < body.items.length; i++) {
          const item = body.items[i];
          if (!item.productId || !item.quantity || item.quantity <= 0) {
            return NextResponse.json(
              { error: `items[${i}] must have productId and a positive quantity` },
              { status: 400 }
            );
          }
        }

        // Validate priority if provided
        const validPriorities = ['normal', 'urgent', 'rush'];
        if (body.priority && !validPriorities.includes(body.priority)) {
          return NextResponse.json(
            { error: `priority must be one of: ${validPriorities.join(', ')}` },
            { status: 400 }
          );
        }

        const order = await materialOrderPipeline.createOrder({
          createdBy: auth.user.userId,
          createdByName: auth.user.name,
          createdByRole: auth.user.role,
          priority: body.priority || 'normal',
          jobId: body.jobId,
          jobNimbusId: body.jobNimbusId,
          jobNumber: body.jobNumber,
          jobName: body.jobName,
          customerName: body.customerName || '',
          customerPhone: body.customerPhone || '',
          customerEmail: body.customerEmail,
          deliveryAddress: body.deliveryAddress || body.jobAddress || '',
          deliveryCity: body.deliveryCity || '',
          deliveryState: body.deliveryState || 'AL',
          deliveryZip: body.deliveryZip || '',
          requestedDeliveryDate: body.requestedDeliveryDate || body.scheduledDate || '',
          items: body.items,
          specialInstructions: body.specialInstructions,
          notes: body.notes,
        });

        return NextResponse.json({
          success: true,
          order,
          autoReviewed: order.currentStage === 'ORDER_REVIEWED',
          message: order.currentStage === 'ORDER_REVIEWED'
            ? `Order ${order.orderId} created and auto-reviewed (all items in stock)`
            : `Order ${order.orderId} created successfully`,
        }, { status: 201 });
      }

      // ============================================
      // 2. TRANSITION STAGE (strict sequential)
      // ============================================
      case 'transitionStage': {
        // Validate required fields
        if (!body.orderId) {
          return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
        }
        if (!body.stage) {
          return NextResponse.json({ error: 'stage (target stage) is required' }, { status: 400 });
        }

        const targetStage = body.stage as PipelineStage;
        if (!PIPELINE_STAGES.includes(targetStage)) {
          return NextResponse.json(
            { error: `Invalid stage: ${body.stage}. Valid stages: ${PIPELINE_STAGES.join(', ')}` },
            { status: 400 }
          );
        }

        // Look up the order to get current stage for validation
        const orderForTransition = await materialOrderPipeline.getOrderById(body.orderId);
        if (!orderForTransition) {
          return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }
        if (orderForTransition.cancelled) {
          return NextResponse.json({ error: 'Order is cancelled' }, { status: 400 });
        }

        // Strict sequential validation: must be the EXACT next stage
        const seqValidation = materialOrderPipeline.validateStrictNextStage(
          orderForTransition.currentStage,
          targetStage
        );
        if (!seqValidation.valid) {
          return NextResponse.json({ error: seqValidation.error }, { status: 400 });
        }

        // Role check: user must be authorized to perform this stage
        if (!canPerformStage(userRole, targetStage)) {
          const stageConfig = STAGE_CONFIG[targetStage];
          return NextResponse.json(
            { error: `Access denied. Stage ${targetStage} requires role: ${stageConfig.performedBy}. Your role: ${userRole}` },
            { status: 403 }
          );
        }

        // Special role enforcement for DELIVERY_CONFIRMED: drivers only (or admin override)
        if (targetStage === 'DELIVERY_CONFIRMED' && userRole !== 'driver' && !ADMIN_OVERRIDE_ROLES.includes(userRole)) {
          return NextResponse.json(
            { error: 'Only drivers (or admin/owner) can confirm delivery' },
            { status: 403 }
          );
        }

        // Stage-specific validation for PAYMENT_RECEIVED
        if (targetStage === 'PAYMENT_RECEIVED') {
          if (!body.metadata?.paymentAmount && !body.paymentAmount) {
            return NextResponse.json(
              { error: 'PAYMENT_RECEIVED requires paymentAmount (in metadata or body)' },
              { status: 400 }
            );
          }
        }

        // Build metadata, merging payment fields if present
        const transitionMetadata = body.metadata || {};
        if (targetStage === 'PAYMENT_RECEIVED') {
          if (body.paymentAmount) transitionMetadata.paymentAmount = body.paymentAmount;
          if (body.paymentMethod) transitionMetadata.paymentMethod = body.paymentMethod;
          if (body.paymentReference) transitionMetadata.paymentReference = body.paymentReference;
        }

        const transitionResult = await materialOrderPipeline.advanceStage(
          body.orderId,
          targetStage,
          body.performedBy || auth.user.userId,
          auth.user.name,
          auth.user.role,
          {
            photoUrls: body.photoUrls || (body.photo ? [body.photo] : undefined),
            gpsLatitude: body.gpsLat ?? body.gpsLatitude,
            gpsLongitude: body.gpsLng ?? body.gpsLongitude,
            gpsAddress: body.gpsAddress,
            notes: body.notes,
            metadata: Object.keys(transitionMetadata).length > 0 ? transitionMetadata : undefined,
            assignedDriverId: body.assignedDriverId,
            assignedDriverName: body.assignedDriverName,
            scheduledDeliveryDate: body.scheduledDeliveryDate,
            scheduledDeliveryTime: body.scheduledDeliveryTime,
            pulledItems: body.pulledItems,
            verifiedItems: body.verifiedItems,
            deliveredItems: body.deliveredItems,
          }
        );

        if (!transitionResult.success) {
          return NextResponse.json({ error: transitionResult.error }, { status: 400 });
        }

        // Build response with stage-specific info
        const responseData: Record<string, unknown> = {
          success: true,
          order: transitionResult.order,
          previousStage: orderForTransition.currentStage,
          newStage: targetStage,
          message: `Order ${body.orderId} transitioned to ${STAGE_CONFIG[targetStage].label}`,
        };

        // Include auto-transition info for stages that auto-advance
        if (STAGE_CONFIG[targetStage].autoTransition) {
          const nextIdx = PIPELINE_STAGES.indexOf(targetStage) + 1;
          if (nextIdx < PIPELINE_STAGES.length) {
            responseData.autoTransitionNote = `This stage auto-transitions. Next stage: ${PIPELINE_STAGES[nextIdx]}`;
          }
        }

        return NextResponse.json(responseData);
      }

      // ============================================
      // 3. ADVANCE STAGE (flexible, allows skipping forward)
      // ============================================
      case 'advanceStage': {
        if (!body.orderId || !body.targetStage) {
          return NextResponse.json(
            { error: 'orderId and targetStage are required' },
            { status: 400 }
          );
        }

        const advTargetStage = body.targetStage as PipelineStage;

        // Role check
        if (!canPerformStage(userRole, advTargetStage)) {
          const stageConfig = STAGE_CONFIG[advTargetStage];
          return NextResponse.json(
            { error: `Access denied. Stage ${advTargetStage} requires role: ${stageConfig?.performedBy || 'unknown'}. Your role: ${userRole}` },
            { status: 403 }
          );
        }

        // Build metadata for payment stages
        const advMetadata = body.metadata || {};
        if (advTargetStage === 'PAYMENT_RECEIVED') {
          if (body.paymentAmount) advMetadata.paymentAmount = body.paymentAmount;
          if (body.paymentMethod) advMetadata.paymentMethod = body.paymentMethod;
          if (body.paymentReference) advMetadata.paymentReference = body.paymentReference;
        }

        const result = await materialOrderPipeline.advanceStage(
          body.orderId,
          advTargetStage,
          auth.user.userId,
          auth.user.name,
          auth.user.role,
          {
            photoUrls: body.photoUrls || (body.photo ? [body.photo] : undefined),
            gpsLatitude: body.gpsLat ?? body.gpsLatitude,
            gpsLongitude: body.gpsLng ?? body.gpsLongitude,
            gpsAddress: body.gpsAddress,
            notes: body.notes,
            metadata: Object.keys(advMetadata).length > 0 ? advMetadata : body.metadata,
            assignedDriverId: body.assignedDriverId,
            assignedDriverName: body.assignedDriverName,
            scheduledDeliveryDate: body.scheduledDeliveryDate,
            scheduledDeliveryTime: body.scheduledDeliveryTime,
            pulledItems: body.pulledItems,
            verifiedItems: body.verifiedItems,
            deliveredItems: body.deliveredItems,
          }
        );
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        return NextResponse.json({ success: true, order: result.order });
      }

      // ============================================
      // 4. CANCEL ORDER
      // ============================================
      case 'cancelOrder': {
        // Role check: Admin, Owner, Office
        if (!CANCEL_ROLES.includes(userRole) && !ADMIN_OVERRIDE_ROLES.includes(userRole)) {
          return NextResponse.json(
            { error: 'Access denied. Only Office, Admin, or Owner can cancel orders.' },
            { status: 403 }
          );
        }

        if (!body.orderId) {
          return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
        }

        const cancelledOrder = await materialOrderPipeline.cancelOrder(
          body.orderId, auth.user.userId, auth.user.name, body.reason || 'Cancelled'
        );
        if (!cancelledOrder) {
          return NextResponse.json({ error: 'Order not found or already cancelled' }, { status: 404 });
        }

        return NextResponse.json({
          success: true,
          order: cancelledOrder,
          message: `Order ${body.orderId} has been cancelled. Material holds released.`,
        });
      }

      // ============================================
      // 5. CREATE RETURN TICKET
      // ============================================
      case 'createReturnTicket': {
        // Role check: PM, Office, Admin, Owner, Manager, Driver
        if (!RETURN_TICKET_ROLES.includes(userRole)) {
          return NextResponse.json(
            { error: 'Access denied. Cannot create return tickets with your role.' },
            { status: 403 }
          );
        }

        // Validate required fields
        if (!body.orderId) {
          return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
        }
        if (!body.type || !['return_to_us', 'return_to_distributor', 'return_to_warehouse'].includes(body.type)) {
          return NextResponse.json(
            { error: 'type is required: "return_to_us", "return_to_warehouse", or "return_to_distributor"' },
            { status: 400 }
          );
        }
        if (!Array.isArray(body.items) || body.items.length === 0) {
          return NextResponse.json(
            { error: 'items must be a non-empty array of { productId, quantity, reason }' },
            { status: 400 }
          );
        }
        if (!body.reason) {
          return NextResponse.json({ error: 'reason is required' }, { status: 400 });
        }

        // Look up the pipeline order for context
        const sourceOrder = await materialOrderPipeline.getOrderById(body.orderId);
        if (!sourceOrder) {
          return NextResponse.json({ error: 'Source order not found' }, { status: 404 });
        }

        // Map return type: 'return_to_us' = 'return_to_warehouse'
        const returnType = body.type === 'return_to_us' ? 'return_to_warehouse' : body.type;

        // Build return items with pricing from the order
        const returnItems = [];
        for (const reqItem of body.items) {
          if (!reqItem.productId || !reqItem.quantity || reqItem.quantity <= 0) {
            return NextResponse.json(
              { error: 'Each return item must have productId and a positive quantity' },
              { status: 400 }
            );
          }

          // Find item in order for pricing data
          const orderItem = sourceOrder.items.find(
            i => i.productId === reqItem.productId || i.sku === reqItem.productId
          );

          // Validate quantity does not exceed delivered quantity
          if (orderItem && reqItem.quantity > (orderItem.deliveredQty || orderItem.quantity)) {
            return NextResponse.json(
              { error: `Return quantity for ${orderItem.productName} (${reqItem.quantity}) exceeds delivered quantity (${orderItem.deliveredQty || orderItem.quantity})` },
              { status: 400 }
            );
          }

          returnItems.push({
            productId: orderItem?.productId || reqItem.productId,
            productName: orderItem?.productName || reqItem.productName || 'Unknown',
            quantity: reqItem.quantity,
            unitCost: orderItem?.unitCost || 0,
            unitPrice: orderItem?.unitPrice || 0,
            reason: reqItem.reason || body.reason,
          });
        }

        // Validate distributor name for return_to_distributor
        if (returnType === 'return_to_distributor' && !body.distributor) {
          return NextResponse.json(
            { error: 'distributor name is required for return_to_distributor type' },
            { status: 400 }
          );
        }

        // ── Cumulative cap against the job breakdown ─────────────────
        // Business rule (Michael): returns cannot exceed the original
        // ticket for that job. Per-item qty was already checked against
        // the source order above, but a user could still split an
        // over-return across multiple return tickets. This second gate
        // checks the cumulative credit against the breakdown, which
        // includes all prior returns.
        try {
          const { validateReturnAgainstBreakdown } = await import('@/lib/customer-breakdown-service');
          const validation = await validateReturnAgainstBreakdown({
            jobNumber: sourceOrder.jobNumber || sourceOrder.jobId,
            jobId: sourceOrder.jobId,
            items: returnItems,
          });
          if (!validation.ok && validation.reason && !validation.reason.includes('No breakdown found')) {
            // Only block if a breakdown exists AND the return is too large.
            // If no breakdown exists, fall through (that's a data gap, not
            // a cap violation — logged but non-blocking).
            return NextResponse.json(
              {
                error: validation.reason,
                remainingOnBreakdown: validation.remaining,
                proposedReturn: validation.proposed,
              },
              { status: 400 }
            );
          }
        } catch (err) {
          console.warn('[returns] Breakdown cap check failed (non-fatal):', err);
        }

        // Create the return ticket via unified inventory service
        const ticket = await unifiedInventoryService.createReturnTicket({
          type: returnType as 'return_to_warehouse' | 'return_to_distributor',
          orderId: body.orderId,
          jobId: sourceOrder.jobId,
          jobName: sourceOrder.jobName,
          items: returnItems,
          distributor: body.distributor,
          createdBy: auth.user.userId,
          createdByName: auth.user.name,
          notes: body.reason,
        });

        // Update order items' returnedQty
        for (const retItem of returnItems) {
          const orderItem = sourceOrder.items.find(i => i.productId === retItem.productId);
          if (orderItem) {
            orderItem.returnedQty = (orderItem.returnedQty || 0) + retItem.quantity;
          }
        }

        // Build credit memo reference for return_to_us/return_to_warehouse
        let creditMemoRef: string | undefined;
        if (returnType === 'return_to_warehouse') {
          const totalCredit = returnItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
          creditMemoRef = `CM-${ticket.ticketId}`;
          await unifiedInventoryService.updateReturnStatus(ticket.ticketId, 'created', {
            creditMemoNumber: creditMemoRef,
            creditAmount: Math.round(totalCredit * 100) / 100,
          });
        }

        return NextResponse.json({
          success: true,
          ticket: {
            ticketId: ticket.ticketId,
            type: ticket.type,
            status: ticket.status,
            orderId: ticket.orderId,
            jobName: ticket.jobName,
            items: ticket.items,
            distributor: ticket.distributor,
            creditMemoNumber: creditMemoRef || ticket.creditMemoNumber,
            creditAmount: ticket.creditAmount,
            createdAt: ticket.createdAt,
            notes: ticket.notes,
          },
          message: returnType === 'return_to_warehouse'
            ? `Return ticket ${ticket.ticketId} created. Credit memo: ${creditMemoRef}`
            : `Return ticket ${ticket.ticketId} created for distributor return to ${body.distributor}`,
        }, { status: 201 });
      }

      // ============================================
      // 6. UPDATE INVOICE STATUS
      // ============================================
      case 'updateInvoiceStatus': {
        // Role check: Office, Admin, Owner
        if (!INVOICE_ROLES.includes(userRole)) {
          return NextResponse.json(
            { error: 'Access denied. Only Office, Admin, or Owner can update invoice status.' },
            { status: 403 }
          );
        }

        if (!body.invoiceId || !body.status) {
          return NextResponse.json(
            { error: 'invoiceId and status are required' },
            { status: 400 }
          );
        }

        const validStatuses = ['draft', 'sent', 'paid', 'void'];
        if (!validStatuses.includes(body.status)) {
          return NextResponse.json(
            { error: `status must be one of: ${validStatuses.join(', ')}` },
            { status: 400 }
          );
        }

        const invoice = await materialOrderPipeline.updateInvoiceStatus(
          body.invoiceId, body.status, body.paidAmount
        );
        if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

        return NextResponse.json({ success: true, invoice });
      }

      // ============================================
      // 7. EMAIL INVOICE TO CUSTOMER
      // ============================================
      // Sends a customer-facing invoice (FINAL PRICE ONLY) to the email
      // address on the source pipeline order. Refuses to send internal
      // invoices since they expose cost data. Marks the invoice as 'sent'
      // on success and stamps sentAt.
      case 'emailInvoice': {
        if (!INVOICE_ROLES.includes(userRole)) {
          return NextResponse.json(
            { error: 'Access denied. Only Office, Admin, or Owner can email invoices.' },
            { status: 403 }
          );
        }
        if (!body.invoiceId) {
          return NextResponse.json({ error: 'invoiceId is required' }, { status: 400 });
        }

        const invoice = await materialOrderPipeline.getInvoice(body.invoiceId);
        if (!invoice) {
          return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        }
        if (invoice.type === 'internal') {
          return NextResponse.json(
            { error: 'Cannot email internal invoices — they contain cost data' },
            { status: 400 }
          );
        }

        const order = await materialOrderPipeline.getOrderById(invoice.orderId);
        const recipient = invoice.customerEmail || order?.customerEmail;
        if (!recipient) {
          return NextResponse.json(
            { error: 'No customer email on file. Add one to the order first.' },
            { status: 400 }
          );
        }

        const { emailService } = await import('@/lib/email-service');
        if (!emailService.isConfigured()) {
          return NextResponse.json(
            { error: 'Email service not configured (RESEND_API_KEY missing)' },
            { status: 503 }
          );
        }

        const subject = `Invoice ${invoice.invoiceId} from River City Roofing Solutions`;
        const formatCurrency = (n: number) =>
          new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
        const itemRows = invoice.items
          .map(
            (i) => `
              <tr>
                <td style="padding:8px;border-bottom:1px solid #eee;">${i.productName}</td>
                <td style="padding:8px;text-align:right;border-bottom:1px solid #eee;">${i.quantity} ${i.unit}</td>
                <td style="padding:8px;text-align:right;border-bottom:1px solid #eee;">${formatCurrency(i.unitPrice)}</td>
                <td style="padding:8px;text-align:right;border-bottom:1px solid #eee;font-weight:bold;">${formatCurrency(i.totalPrice)}</td>
              </tr>`
          )
          .join('');

        const body_html = `
          <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;background:#fff;">
            <div style="background:#000;padding:24px;text-align:center;">
              <h2 style="color:#39FF14;margin:0;font-size:20px;">River City Roofing Solutions</h2>
              <p style="color:#aaa;margin:6px 0 0;font-size:12px;">Invoice ${invoice.invoiceId}</p>
            </div>
            <div style="padding:24px;">
              <p>Hi ${invoice.customerName},</p>
              <p>Thanks for choosing RCRS. Your invoice for <strong>${invoice.jobName}</strong> is below.</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
                <thead>
                  <tr style="background:#f5f5f5;">
                    <th style="padding:8px;text-align:left;border-bottom:2px solid #000;">Item</th>
                    <th style="padding:8px;text-align:right;border-bottom:2px solid #000;">Qty</th>
                    <th style="padding:8px;text-align:right;border-bottom:2px solid #000;">Price</th>
                    <th style="padding:8px;text-align:right;border-bottom:2px solid #000;">Total</th>
                  </tr>
                </thead>
                <tbody>${itemRows}</tbody>
                <tfoot>
                  <tr>
                    <td colspan="3" style="padding:12px 8px;text-align:right;font-weight:bold;border-top:2px solid #000;">TOTAL</td>
                    <td style="padding:12px 8px;text-align:right;font-weight:bold;border-top:2px solid #000;font-size:18px;color:#39FF14;">
                      ${formatCurrency(invoice.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
              <p style="font-size:12px;color:#666;">Payment Terms: Net 30. Pay by check, credit card, or Bitcoin via the customer portal.</p>
              <p style="font-size:12px;color:#666;">Questions? Call (256) 274-8530 or email rcrs@rivercityroofingsolutions.com</p>
              <p style="text-align:center;color:#999;font-size:11px;margin-top:24px;">Thank you for your business.</p>
            </div>
          </div>
        `;

        const sendResult = await emailService.send({
          template: 'customer-invoice',
          to: recipient,
          subject,
          body: body_html,
          fromName: 'River City Roofing Solutions',
        });

        if (!sendResult.success) {
          return NextResponse.json(
            { error: sendResult.error || 'Email send failed' },
            { status: 500 }
          );
        }

        // Mark the invoice as sent — also stamps sentAt
        await materialOrderPipeline.updateInvoiceStatus(invoice.invoiceId, 'sent');

        return NextResponse.json({
          success: true,
          message: `Invoice sent to ${recipient}`,
          invoiceId: invoice.invoiceId,
          sentTo: recipient,
        });
      }

      default:
        return NextResponse.json(
          { error: `Invalid action: '${action}'. Valid actions: createOrder, transitionStage, advanceStage, cancelOrder, createReturnTicket, updateInvoiceStatus, emailInvoice` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Pipeline POST error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
