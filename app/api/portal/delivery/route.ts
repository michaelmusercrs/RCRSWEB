import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { auditLog } from '@/lib/audit-logger';
import { orderWorkflowService } from '@/lib/order-workflow-service';
import { deliveryWorkflowService } from '@/lib/delivery-workflow-service';
import { ticketSheetService } from '@/lib/ticket-sheet-service';
import { activeDeliveries, ticketsForRouteDate, chicagoToday } from '@/lib/ticket-board-buckets';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

// Best-effort mirror of a delivery status change onto the canonical Tickets
// tab (the store the warehouse board + driver views read). Returns false on a
// swallowed Sheets failure so the caller can 502 instead of stranding the
// ticket (the "delivered-but-never-clears" zombie bug came from silent legacy-
// only writes). Mirrors syncTicketsTabStatus in app/api/portal/tickets/route.ts.
async function mirrorStatusToTicketsTab(
  ticketId: string,
  status: import('@/lib/ticket-sheet-service').TicketStatus,
): Promise<boolean> {
  try {
    return await ticketSheetService.updateStatus(ticketId, status);
  } catch (err) {
    console.warn(`[portal/delivery] Failed to mirror status '${status}' to Tickets tab:`, err);
    return false;
  }
}

// GET - Fetch routes or delivery information
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const routeId = searchParams.get('routeId');
    const driverId = searchParams.get('driverId');
    const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);

    // Get specific route
    if (routeId) {
      try {
        const route = await orderWorkflowService.getRoute(routeId);
        if (!route) {
          return NextResponse.json({ error: 'Route not found' }, { status: 404 });
        }
        return NextResponse.json(route);
      } catch (routeError) {
        console.error('Error fetching route:', routeError);
        return NextResponse.json({ error: 'Route not found' }, { status: 404 });
      }
    }

    // Get routes for a driver
    if (driverId) {
      try {
        const routes = await orderWorkflowService.getDriverRoutes(driverId, date);
        return NextResponse.json({ routes });
      } catch (driverError) {
        console.error('Error fetching driver routes:', driverError);
        return NextResponse.json({ routes: [] });
      }
    }

    // Get all deliveries for the date from the CANONICAL Tickets tab (the same
    // 600+-row store the warehouse board reads) — NOT the near-empty legacy
    // Delivery Tickets sheet that deliveryWorkflowService reads (~20 orphaned
    // rows), which was why this view showed almost nothing. Active deliveries
    // only, so delivered/completed jobs drop off the schedule automatically.
    let tickets;
    try {
      tickets = await ticketSheetService.getAll();
    } catch (ticketError) {
      console.error('Error fetching delivery tickets:', ticketError);
      return NextResponse.json({ routes: [] });
    }
    const todayYmd = chicagoToday();
    const active = activeDeliveries(tickets);
    const forDate = ticketsForRouteDate(active, date, todayYmd);

    // Group by assigned driver (Tickets-tab fields: assignedTo/assignedToName).
    const driverRoutes = new Map<string, typeof forDate>();
    for (const ticket of forDate) {
      const driverId = ticket.assignedTo || 'unassigned';
      if (!driverRoutes.has(driverId)) driverRoutes.set(driverId, []);
      driverRoutes.get(driverId)!.push(ticket);
    }

    const routes = Array.from(driverRoutes.entries()).map(([driverId, deliveries]) => {
      const driver = deliveries[0]?.assignedToName || 'Unassigned';
      // In the active set 'arrived' is the closest-to-done state; delivered/
      // completed have already dropped off. Count those as progress.
      const doneCount = deliveries.filter(d => d.status === 'arrived').length;

      return {
        routeId: `RT-${date.replace(/-/g, '')}-${driverId.slice(0, 4).toUpperCase()}`,
        date,
        driverId,
        driverName: driver,
        vehicle: 'TBD', // vehicle assignment not tracked on the Tickets tab yet
        status: deliveries.some(d => ['en_route', 'arrived'].includes(d.status))
          ? 'in_progress'
          : 'planned',
        totalStops: deliveries.length,
        completedStops: doneCount,
        stops: deliveries.map((d, idx) => ({
          sequence: idx + 1,
          orderId: d.ticketId,
          jobName: d.jobName,
          customerName: d.customerName,
          customerPhone: d.customerPhone,
          address: d.jobAddress,
          city: d.city,
          state: d.state,
          zip: '', // not tracked on the Tickets tab
          scheduledDate: d.scheduledDate || null,
          overdue: Boolean(d.scheduledDate && d.scheduledDate < todayYmd),
          priority: undefined,
          status: d.status === 'arrived' ? 'arrived' :
                  d.status === 'en_route' ? 'in_progress' : 'pending',
          itemCount: d.materials?.length || 0,
          specialInstructions: d.notes,
          inspectorRequired: false,
        })),
      };
    });

    return NextResponse.json({ routes });
  } catch (error) {
    console.error('Error fetching delivery data:', error);
    return NextResponse.json({ error: 'Failed to fetch delivery data' }, { status: 500 });
  }
}

// POST - Create route or update delivery status
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const data = await request.json();
    const { action } = data;

    switch (action) {
      case 'create_route': {
        const { date, driverId, driverName, vehicleId, orderIds } = data;
        const route = await orderWorkflowService.createRoute({
          date,
          driverId,
          driverName,
          vehicleId,
          orderIds,
        });
        auditLog('DELIVERY_ROUTE_CREATE', auth.user.email, `Created route for ${driverName || driverId} on ${date} with ${orderIds?.length || 0} stops`, request);
        return NextResponse.json(route);
      }

      case 'start_route': {
        const { routeId } = data;
        auditLog('DELIVERY_ROUTE_START', auth.user.email, `Started route ${routeId}`, request);
        // Update route status to in_progress
        return NextResponse.json({ success: true, status: 'in_progress' });
      }

      case 'start_delivery': {
        const { ticketId } = data;
        // Canonical Tickets tab FIRST — 502 if it fails so the caller retries
        // instead of the board silently missing the change.
        if (!(await mirrorStatusToTicketsTab(ticketId, 'en_route'))) {
          return NextResponse.json({ error: 'Board update failed — tap again' }, { status: 502 });
        }
        let ticket: unknown = { success: true };
        try { ticket = await deliveryWorkflowService.startDelivery(ticketId); } catch (e) { console.warn('[portal/delivery] legacy startDelivery failed (non-fatal):', e); }
        auditLog('DELIVERY_START', auth.user.email, `Started delivery ${ticketId}`, request);
        return NextResponse.json(ticket);
      }

      case 'arrive': {
        const { ticketId, gpsLocation } = data;
        if (!(await mirrorStatusToTicketsTab(ticketId, 'arrived'))) {
          return NextResponse.json({ error: 'Board update failed — tap again' }, { status: 502 });
        }
        let ticket: unknown = { success: true };
        try { ticket = await deliveryWorkflowService.markArrived(ticketId, gpsLocation); } catch (e) { console.warn('[portal/delivery] legacy markArrived failed (non-fatal):', e); }
        auditLog('DELIVERY_ARRIVE', auth.user.email, `Arrived at delivery ${ticketId}`, request);
        return NextResponse.json(ticket);
      }

      case 'complete_delivery': {
        const { ticketId, notes } = data;
        if (!(await mirrorStatusToTicketsTab(ticketId, 'delivered'))) {
          return NextResponse.json({ error: 'Board update failed — tap again' }, { status: 502 });
        }
        try { await deliveryWorkflowService.completeDelivery(ticketId, notes); } catch (e) { console.warn('[portal/delivery] legacy completeDelivery failed (non-fatal):', e); }
        auditLog('DELIVERY_COMPLETE', auth.user.email, `Completed delivery ${ticketId}${notes ? ': ' + notes : ''}`, request);
        return NextResponse.json({ success: true });
      }

      case 'upload_photo': {
        const { ticketId, jobId, photoType, photoUrl, uploadedBy, gpsLocation, description } = data;
        const photo = await deliveryWorkflowService.addPhoto({
          ticketId,
          jobId,
          photoType,
          photoUrl,
          uploadedBy,
          gpsLocation,
          description,
        });
        return NextResponse.json(photo);
      }

      case 'skip_stop': {
        const { ticketId, reason } = data;
        // Log skip with reason
        await deliveryWorkflowService.logActivity({
          ticketId,
          ticketType: 'delivery',
          action: `Stop skipped: ${reason}`,
          actionType: 'status_change',
          performedBy: 'driver',
          performedByName: 'Driver',
          performedByRole: 'driver',
          notes: reason,
        });
        return NextResponse.json({ success: true });
      }

      case 'optimize_route': {
        const { routeId, stops } = data;
        // In a real implementation, this would call a route optimization API
        // For now, just return the stops as-is
        return NextResponse.json({ optimized: true, stops });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error processing delivery action:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}

// PATCH - Update delivery status
export async function PATCH(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const data = await request.json();
    const { ticketId, status, ...updates } = data;

    if (!ticketId) {
      return NextResponse.json({ error: 'Ticket ID required' }, { status: 400 });
    }

    // Mirror to the canonical Tickets tab FIRST for statuses it tracks; 502 on
    // failure so the board can't silently miss the change. proof_captured has
    // no canonical equivalent, so it only touches the legacy enrichment store.
    const canonicalStatus: Record<string, import('@/lib/ticket-sheet-service').TicketStatus> = {
      en_route: 'en_route', arrived: 'arrived', delivered: 'delivered', completed: 'completed',
    };
    if (canonicalStatus[status]) {
      if (!(await mirrorStatusToTicketsTab(ticketId, canonicalStatus[status]))) {
        return NextResponse.json({ error: 'Board update failed — try again' }, { status: 502 });
      }
    }

    try {
      switch (status) {
        case 'en_route':
          await deliveryWorkflowService.startDelivery(ticketId);
          break;
        case 'arrived':
          await deliveryWorkflowService.markArrived(ticketId, updates.gpsLocation);
          break;
        case 'delivered':
          await deliveryWorkflowService.completeDelivery(ticketId, updates.notes);
          break;
        case 'proof_captured':
          await deliveryWorkflowService.captureProof(ticketId);
          break;
        case 'completed':
          await deliveryWorkflowService.completeTicket(ticketId);
          break;
      }
    } catch (e) {
      // Legacy enrichment store is best-effort; the canonical write already
      // succeeded above, so don't fail the request on a legacy-sheet miss.
      console.warn('[portal/delivery] legacy PATCH status write failed (non-fatal):', e);
    }

    auditLog('DELIVERY_STATUS', auth.user.email, `Delivery ${ticketId} status changed to ${status}`, request);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating delivery:', error);
    return NextResponse.json({ error: 'Failed to update delivery' }, { status: 500 });
  }
}
