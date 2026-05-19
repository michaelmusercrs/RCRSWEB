/**
 * /api/portal/delivery/returns
 *
 * Returns workflow API (Phase 3 polish).
 *
 * Two flavors share one ticket type:
 *   - return_to_warehouse: material we're keeping → addStock on receipt,
 *     emit credit memo against the original job's CustomerBreakdown
 *   - return_to_distributor: material going back to Beacon / Gold Eagle /
 *     Advance / Lowe's / Home Depot. We never stock it, so no addStock —
 *     just track stages and credit-memo number when the distributor issues
 *     one.
 *
 * Both flavors capture pickup photos + GPS, transit photos, and
 * destination photos — mirroring the delivery flow.
 *
 * GET  ?ticketId=...               → fetch one ticket
 * GET  ?type=...&status=...        → list (filterable)
 * POST                              → create ticket
 * PATCH                             → advance status / attach photos / set credit memo
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { unifiedInventoryService } from '@/lib/unified-inventory-service';
import type { ReturnStatus, ReturnType } from '@/lib/unified-inventory-service';
import { auditLog } from '@/lib/audit-logger';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get('ticketId');

    if (ticketId) {
      const ticket = await unifiedInventoryService.getReturnTicketById(ticketId);
      if (!ticket) {
        return NextResponse.json({ error: 'Return ticket not found' }, { status: 404 });
      }
      return NextResponse.json({ ticket });
    }

    const type = (searchParams.get('type') || undefined) as ReturnType | undefined;
    const status = (searchParams.get('status') || undefined) as ReturnStatus | undefined;
    const tickets = await unifiedInventoryService.getReturnTickets(type, status);

    return NextResponse.json({
      tickets,
      count: tickets.length,
      summary: {
        toWarehouse: tickets.filter((t) => t.type === 'return_to_warehouse').length,
        toDistributor: tickets.filter((t) => t.type === 'return_to_distributor').length,
        active: tickets.filter((t) => !['completed', 'cancelled'].includes(t.status)).length,
        completed: tickets.filter((t) => t.status === 'completed').length,
        totalCreditAmount: tickets.reduce((sum, t) => sum + (t.creditAmount || 0), 0),
      },
    });
  } catch (err) {
    console.error('[returns API] GET failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();

    // Validate
    if (!body.type || !['return_to_warehouse', 'return_to_distributor'].includes(body.type)) {
      return NextResponse.json(
        { error: 'type must be return_to_warehouse or return_to_distributor' },
        { status: 400 }
      );
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'At least one return item is required' }, { status: 400 });
    }
    for (const it of body.items) {
      if (!it.productId || typeof it.quantity !== 'number' || it.quantity <= 0) {
        return NextResponse.json(
          { error: 'Each item needs productId and quantity > 0' },
          { status: 400 }
        );
      }
    }
    if (body.type === 'return_to_distributor' && !body.distributor) {
      return NextResponse.json(
        { error: 'distributor is required for return_to_distributor' },
        { status: 400 }
      );
    }

    // Enrich items with current product data
    const catalog = await unifiedInventoryService.getInventory();
    const enrichedItems = body.items.map((it: any) => {
      const product = catalog.find((p) => p.productId === it.productId);
      return {
        productId: it.productId,
        productName: it.productName || product?.productName || it.productId,
        quantity: Number(it.quantity),
        unitCost: typeof it.unitCost === 'number' ? it.unitCost : product?.unitCost || 0,
        unitPrice: typeof it.unitPrice === 'number' ? it.unitPrice : product?.unitPrice || 0,
        reason: it.reason || 'No reason given',
      };
    });

    const ticket = await unifiedInventoryService.createReturnTicket({
      type: body.type,
      orderId: body.orderId,
      jobId: body.jobId,
      jobName: body.jobName,
      items: enrichedItems,
      distributor: body.distributor,
      createdBy: auth.user.userId,
      createdByName: auth.user.name,
      notes: body.notes || '',
    });

    auditLog(
      'RETURN_TICKET_CREATED',
      auth.user.email,
      `Created ${body.type} ticket ${ticket.ticketId} for ${enrichedItems.length} item(s). Job: ${body.jobName || 'n/a'}.`,
      request
    );

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (err) {
    console.error('[returns API] POST failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { ticketId, status, ...updates } = body;

    if (!ticketId) {
      return NextResponse.json({ error: 'ticketId required' }, { status: 400 });
    }
    if (!status) {
      return NextResponse.json({ error: 'status required' }, { status: 400 });
    }

    const validStatuses: ReturnStatus[] = [
      'created',
      'picked_up',
      'in_transit',
      'received',
      'credited',
      'completed',
      'cancelled',
    ];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate updates shape — only allow whitelisted fields
    const sanitizedUpdates: any = {};
    if (Array.isArray(updates.pickupPhotos)) sanitizedUpdates.pickupPhotos = updates.pickupPhotos;
    if (Array.isArray(updates.transitPhotos)) sanitizedUpdates.transitPhotos = updates.transitPhotos;
    if (Array.isArray(updates.deliveryPhotos)) sanitizedUpdates.deliveryPhotos = updates.deliveryPhotos;
    if (typeof updates.gpsPickup === 'string') sanitizedUpdates.gpsPickup = updates.gpsPickup;
    if (typeof updates.gpsDelivery === 'string') sanitizedUpdates.gpsDelivery = updates.gpsDelivery;
    if (typeof updates.creditMemoNumber === 'string')
      sanitizedUpdates.creditMemoNumber = updates.creditMemoNumber;
    if (typeof updates.creditAmount === 'number')
      sanitizedUpdates.creditAmount = updates.creditAmount;
    if (typeof updates.notes === 'string') sanitizedUpdates.notes = updates.notes;

    const ticket = await unifiedInventoryService.updateReturnStatus(
      ticketId,
      status,
      sanitizedUpdates
    );

    if (!ticket) {
      return NextResponse.json({ error: 'Return ticket not found' }, { status: 404 });
    }

    auditLog(
      'RETURN_TICKET_UPDATED',
      auth.user.email,
      `${ticketId} → ${status}. Photos: ${
        (sanitizedUpdates.pickupPhotos?.length || 0) +
        (sanitizedUpdates.transitPhotos?.length || 0) +
        (sanitizedUpdates.deliveryPhotos?.length || 0)
      } added.${sanitizedUpdates.creditMemoNumber ? ' Credit: ' + sanitizedUpdates.creditMemoNumber : ''}`,
      request
    );

    return NextResponse.json({ ticket });
  } catch (err) {
    console.error('[returns API] PATCH failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
