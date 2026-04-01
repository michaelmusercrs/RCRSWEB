import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { auditLog } from '@/lib/audit-logger';
import { orderWorkflowService } from '@/lib/order-workflow-service';
import { deliveryWorkflowService } from '@/lib/delivery-workflow-service';

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
      const route = await orderWorkflowService.getRoute(routeId);
      if (!route) {
        return NextResponse.json({ error: 'Route not found' }, { status: 404 });
      }
      return NextResponse.json(route);
    }

    // Get routes for a driver
    if (driverId) {
      const routes = await orderWorkflowService.getDriverRoutes(driverId, date);
      return NextResponse.json({ routes });
    }

    // Get all deliveries for the date
    const tickets = await deliveryWorkflowService.getTickets({
      date,
      ticketType: 'delivery',
    });

    // Group by driver for route view
    const driverRoutes = new Map<string, any[]>();
    for (const ticket of tickets) {
      const driverId = ticket.assignedDriver || 'unassigned';
      if (!driverRoutes.has(driverId)) {
        driverRoutes.set(driverId, []);
      }
      driverRoutes.get(driverId)!.push(ticket);
    }

    const routes = Array.from(driverRoutes.entries()).map(([driverId, deliveries]) => {
      const driver = deliveries[0]?.assignedDriverName || 'Unassigned';
      const completedCount = deliveries.filter(d =>
        ['delivered', 'completed'].includes(d.status)
      ).length;

      return {
        routeId: `RT-${date.replace(/-/g, '')}-${driverId.slice(0, 4).toUpperCase()}`,
        date,
        driverId,
        driverName: driver,
        vehicle: deliveries[0]?.assignedVehicle || 'TBD',
        status: completedCount === deliveries.length ? 'completed' :
                completedCount > 0 ? 'in_progress' : 'planned',
        totalStops: deliveries.length,
        completedStops: completedCount,
        stops: deliveries.map((d, idx) => ({
          sequence: idx + 1,
          orderId: d.ticketId,
          jobName: d.jobName,
          customerName: d.customerName,
          customerPhone: d.customerPhone,
          address: d.jobAddress,
          city: d.city,
          state: d.state,
          zip: d.zip,
          scheduledTime: d.scheduledTime,
          priority: d.priority,
          status: d.status === 'delivered' || d.status === 'completed' ? 'delivered' :
                  d.status === 'arrived' ? 'arrived' :
                  d.status === 'en_route' ? 'in_progress' : 'pending',
          itemCount: d.materials?.length || 0,
          specialInstructions: d.specialInstructions,
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
        const ticket = await deliveryWorkflowService.startDelivery(ticketId);
        auditLog('DELIVERY_START', auth.user.email, `Started delivery ${ticketId}`, request);
        return NextResponse.json(ticket);
      }

      case 'arrive': {
        const { ticketId, gpsLocation } = data;
        const ticket = await deliveryWorkflowService.markArrived(ticketId, gpsLocation);
        auditLog('DELIVERY_ARRIVE', auth.user.email, `Arrived at delivery ${ticketId}`, request);
        return NextResponse.json(ticket);
      }

      case 'complete_delivery': {
        const { ticketId, notes } = data;
        await deliveryWorkflowService.completeDelivery(ticketId, notes);
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

    auditLog('DELIVERY_STATUS', auth.user.email, `Delivery ${ticketId} status changed to ${status}`, request);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating delivery:', error);
    return NextResponse.json({ error: 'Failed to update delivery' }, { status: 500 });
  }
}
