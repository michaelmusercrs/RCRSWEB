import { NextRequest, NextResponse } from 'next/server';
import { deliveryReminderService } from '@/lib/delivery-reminder-service';
import { deliveryWorkflowService } from '@/lib/delivery-workflow-service';
import { leadPortalService } from '@/lib/lead-portal-service';
import { validateSession } from '@/lib/auth-service';

// SECURITY: Validate that a token belongs to a customer with the given phone number
async function validateTokenForPhone(token: string, phone: string): Promise<boolean> {
  try {
    const lead = await leadPortalService.getLeadByToken(token);
    if (!lead) return false;

    // Normalize phone numbers for comparison (strip non-digits, compare last 10)
    const normalizePhone = (p: string) => p.replace(/\D/g, '').slice(-10);
    return normalizePhone(lead.customerPhone) === normalizePhone(phone);
  } catch {
    return false;
  }
}

// GET - Customer delivery status (requires authentication)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const ticketId = searchParams.get('ticketId');
    const customerPhone = searchParams.get('phone');

    // SECURITY: Check authentication
    // Option 1: Valid admin/portal session
    const session = await validateSession();
    const hasAdminAuth = session.valid;

    // Option 2: Valid customer portal token (for phone/ticketId lookups)
    let hasCustomerAuth = false;
    if (token && customerPhone) {
      hasCustomerAuth = await validateTokenForPhone(token, customerPhone);
    }

    // Require at least one valid authentication method
    if (!hasAdminAuth && !hasCustomerAuth) {
      return NextResponse.json(
        {
          error: 'Authentication required. Provide a valid session or customer portal token.',
          hint: 'For phone lookup, include both token and phone parameters where token belongs to that customer.'
        },
        { status: 401 }
      );
    }

    // Must provide at least one identifier
    if (!ticketId && !customerPhone && !token) {
      return NextResponse.json(
        { error: 'Provide ticketId, phone, or token to look up delivery status' },
        { status: 400 }
      );
    }

    // Look up by ticket ID
    if (ticketId) {
      const result = await deliveryReminderService.getCustomerDeliveryStatus(ticketId);
      if (!result) {
        return NextResponse.json({ error: 'Delivery not found' }, { status: 404 });
      }

      // SECURITY: For ticket lookups without admin auth, verify the token belongs to this customer
      if (!hasAdminAuth && token) {
        const ticketPhone = result.ticket.customerPhone;
        if (ticketPhone) {
          const isAuthorized = await validateTokenForPhone(token, ticketPhone);
          if (!isAuthorized) {
            return NextResponse.json(
              { error: 'Not authorized to view this delivery' },
              { status: 403 }
            );
          }
        }
      } else if (!hasAdminAuth) {
        // No admin auth and no token - deny access
        return NextResponse.json(
          { error: 'Authentication required to view delivery details' },
          { status: 401 }
        );
      }

      // Return sanitized customer-facing data (no internal costs, etc.)
      return NextResponse.json({
        success: true,
        delivery: {
          ticketId: result.ticket.ticketId,
          jobName: result.ticket.jobName,
          jobAddress: result.ticket.jobAddress,
          city: result.ticket.city,
          state: result.ticket.state,
          zip: result.ticket.zip,
          customerName: result.ticket.customerName,
          scheduledDate: result.ticket.scheduledDate,
          scheduledTime: result.ticket.scheduledTime,
          driverName: result.ticket.assignedDriverName || null,
          materialsSummary: result.ticket.materialsSummary,
          specialInstructions: result.ticket.specialInstructions,
          priority: result.ticket.priority,
        },
        status: result.statusStage,
        eta: result.eta ? {
          estimatedArrival: result.eta.estimatedArrival,
          estimatedMinutesAway: result.eta.estimatedMinutesAway,
          stopNumber: result.eta.stopNumber,
          totalStops: result.eta.totalStops,
        } : null,
        proofPhotos: result.photos,
        timestamps: {
          departedAt: result.ticket.departedAt || null,
          arrivedAt: result.ticket.arrivedAt || null,
          deliveredAt: result.ticket.deliveredAt || null,
        },
      });
    }

    // Look up by customer phone (returns all active deliveries)
    if (customerPhone || token) {
      // SECURITY: For phone lookups without admin auth, verify the token belongs to this customer
      if (customerPhone && !hasAdminAuth) {
        if (!token) {
          return NextResponse.json(
            { error: 'Token required for phone lookup without admin session' },
            { status: 401 }
          );
        }
        if (!hasCustomerAuth) {
          return NextResponse.json(
            { error: 'Token does not match the provided phone number' },
            { status: 403 }
          );
        }
      }

      const lookupValue = customerPhone || token;

      // Get all non-completed tickets
      const allTickets = await deliveryWorkflowService.getTickets();
      const customerTickets = allTickets.filter(t => {
        if (customerPhone) {
          // Match by phone (strip non-digits for comparison)
          const normalizePhone = (p: string) => p.replace(/\D/g, '').slice(-10);
          return normalizePhone(t.customerPhone) === normalizePhone(customerPhone);
        }
        // Token-based lookup would match by customer email or access token
        return false;
      }).filter(t => !['completed', 'cancelled'].includes(t.status));

      if (customerTickets.length === 0) {
        return NextResponse.json({
          success: true,
          deliveries: [],
          message: 'No active deliveries found',
        });
      }

      const deliveries = await Promise.all(
        customerTickets.map(async (ticket) => {
          const result = await deliveryReminderService.getCustomerDeliveryStatus(ticket.ticketId);
          if (!result) return null;

          return {
            ticketId: result.ticket.ticketId,
            jobName: result.ticket.jobName,
            jobAddress: result.ticket.jobAddress,
            city: result.ticket.city,
            scheduledDate: result.ticket.scheduledDate,
            scheduledTime: result.ticket.scheduledTime,
            driverName: result.ticket.assignedDriverName || null,
            materialsSummary: result.ticket.materialsSummary,
            status: result.statusStage,
            eta: result.eta ? {
              estimatedArrival: result.eta.estimatedArrival,
              estimatedMinutesAway: result.eta.estimatedMinutesAway,
            } : null,
          };
        })
      );

      return NextResponse.json({
        success: true,
        deliveries: deliveries.filter(Boolean),
      });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('Customer delivery status error:', error);
    return NextResponse.json({ error: 'Failed to fetch delivery status' }, { status: 500 });
  }
}
