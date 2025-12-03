import { NextRequest, NextResponse } from 'next/server';
import { deliveryWorkflowService, TicketStatus, TicketType, MaterialItem } from '@/lib/delivery-workflow-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get('ticketId');
    const status = searchParams.get('status');
    const ticketType = searchParams.get('type');
    const driverId = searchParams.get('driverId');
    const projectManager = searchParams.get('pm');
    const date = searchParams.get('date');
    const limit = searchParams.get('limit');

    // Get single ticket
    if (ticketId) {
      const ticket = await deliveryWorkflowService.getTicketById(ticketId);
      if (!ticket) {
        return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
      }
      return NextResponse.json(ticket);
    }

    // Get tickets with filters
    const tickets = await deliveryWorkflowService.getTickets({
      status: status as TicketStatus | undefined,
      ticketType: ticketType as TicketType | undefined,
      driverId: driverId || undefined,
      projectManager: projectManager || undefined,
      date: date || undefined,
      limit: limit ? parseInt(limit) : undefined,
    });

    return NextResponse.json({ tickets });
  } catch (error) {
    console.error('Tickets API GET error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'create': {
        // Create new delivery ticket from material order
        const ticket = await deliveryWorkflowService.createTicket({
          ticketType: data.ticketType || 'delivery',
          createdBy: data.createdBy,
          createdByName: data.createdByName || 'Unknown',
          createdByRole: data.createdByRole || 'project_manager',
          jobId: data.jobId,
          jobName: data.jobName,
          jobAddress: data.jobAddress,
          city: data.city,
          state: data.state,
          zip: data.zip,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerEmail: data.customerEmail,
          projectManager: data.projectManager,
          pmPhone: data.pmPhone,
          pmEmail: data.pmEmail,
          materials: data.materials as MaterialItem[],
          requestedDate: data.requestedDate,
          requestedTime: data.requestedTime,
          priority: data.priority,
          specialInstructions: data.specialInstructions,
          returnReason: data.returnReason,
          pickupReason: data.pickupReason,
          relatedTicketId: data.relatedTicketId,
        });

        return NextResponse.json({ success: true, ticket });
      }

      case 'assign-driver': {
        const ticket = await deliveryWorkflowService.assignDriver(
          data.ticketId,
          data.driverId,
          data.driverName,
          data.vehicle,
          data.scheduledDate,
          data.scheduledTime
        );
        return NextResponse.json({ success: true, ticket });
      }

      case 'pull-materials': {
        const ticket = await deliveryWorkflowService.pullMaterials(data.ticketId, data.pulledBy);
        return NextResponse.json({ success: true, ticket });
      }

      case 'verify-load': {
        const ticket = await deliveryWorkflowService.verifyLoad(
          data.ticketId,
          data.verifiedBy,
          data.gpsLocation
        );
        return NextResponse.json({ success: true, ticket });
      }

      case 'start-delivery': {
        const ticket = await deliveryWorkflowService.startDelivery(data.ticketId);
        return NextResponse.json({ success: true, ticket });
      }

      case 'mark-arrived': {
        const ticket = await deliveryWorkflowService.markArrived(data.ticketId, data.gpsLocation);
        return NextResponse.json({ success: true, ticket });
      }

      case 'complete-delivery': {
        const ticket = await deliveryWorkflowService.completeDelivery(data.ticketId, data.notes);
        return NextResponse.json({ success: true, ticket });
      }

      case 'capture-proof': {
        const ticket = await deliveryWorkflowService.captureProof(
          data.ticketId,
          data.signature,
          data.signedBy
        );
        return NextResponse.json({ success: true, ticket });
      }

      case 'upload-qc': {
        const ticket = await deliveryWorkflowService.uploadQCPhotos(data.ticketId);
        return NextResponse.json({ success: true, ticket });
      }

      case 'complete-ticket': {
        const ticket = await deliveryWorkflowService.completeTicket(data.ticketId);
        return NextResponse.json({ success: true, ticket });
      }

      case 'add-photo': {
        const photo = await deliveryWorkflowService.addPhoto({
          ticketId: data.ticketId,
          jobId: data.jobId,
          photoType: data.photoType,
          photoUrl: data.photoUrl,
          thumbnailUrl: data.thumbnailUrl,
          uploadedBy: data.uploadedBy,
          gpsLocation: data.gpsLocation,
          description: data.description,
        });
        return NextResponse.json({ success: true, photo });
      }

      case 'complete-pickup': {
        const ticket = await deliveryWorkflowService.completePickup(
          data.ticketId,
          data.gpsLocation,
          data.notes
        );
        return NextResponse.json({ success: true, ticket });
      }

      case 'process-return': {
        const ticket = await deliveryWorkflowService.processReturn(
          data.ticketId,
          data.returnedMaterials,
          data.condition
        );
        return NextResponse.json({ success: true, ticket });
      }

      case 'stock-adjustment': {
        const adjustment = await deliveryWorkflowService.createStockAdjustment({
          productId: data.productId,
          productName: data.productName,
          previousQty: data.previousQty,
          newQty: data.newQty,
          reason: data.reason,
          adjustedBy: data.adjustedBy,
          adjustedByName: data.adjustedByName,
          adjustedByRole: data.adjustedByRole,
          ticketId: data.ticketId,
        });
        return NextResponse.json({ success: true, adjustment });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Tickets API POST error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
