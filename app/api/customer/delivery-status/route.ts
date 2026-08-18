import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/api-response';
import { deliveryReminderService } from '@/lib/delivery-reminder-service';
import { leadPortalService } from '@/lib/lead-portal-service';
import { validateSession } from '@/lib/auth-service';
import { ticketSheetService, type SheetTicket } from '@/lib/ticket-sheet-service';

// Map an internal ticket status to a customer-facing delivery stage. Used as
// the fallback when the enrichment service (which reads the legacy Delivery
// Tickets sheet) has no row for a canonical-only ticket. Deliberately does NOT
// expose overdue/late — that's an internal ops flag, not customer-facing.
function customerStage(status?: string): string {
  switch (status) {
    case 'en_route': return 'out_for_delivery';
    case 'arrived': return 'arriving';
    case 'delivered':
    case 'completed': return 'delivered';
    case 'cancelled': return 'cancelled';
    default: return 'preparing'; // created / assigned / materials_pulled / load_verified
  }
}

function materialsSummaryOf(t: SheetTicket): string {
  return (t.materials || []).slice(0, 6).map(m => `${m.quantity || 0} ${m.productName || ''}`.trim()).join('; ');
}

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
      // Enrichment-first: the reminder service adds ETA + proof photos, but it
      // reads the legacy Delivery Tickets sheet and returns null for the 600+
      // email-created (canonical-only) tickets — the exact gap we're closing.
      // Fall back to the canonical Tickets tab when it has no row.
      let result: Awaited<ReturnType<typeof deliveryReminderService.getCustomerDeliveryStatus>> | null = null;
      try { result = await deliveryReminderService.getCustomerDeliveryStatus(ticketId); } catch { result = null; }
      const canonical = await ticketSheetService.getById(ticketId).catch(() => null);

      if (!result && !canonical) {
        return apiError('Delivery not found', 404);
      }

      const phoneForAuth = result?.ticket?.customerPhone || canonical?.customerPhone || '';
      // SECURITY: For ticket lookups without admin auth, verify the token belongs to this customer
      if (!hasAdminAuth && token) {
        if (phoneForAuth) {
          const isAuthorized = await validateTokenForPhone(token, phoneForAuth);
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

      const t = result?.ticket; // legacy enrichment ticket (may be undefined)
      const c = canonical;       // canonical SheetTicket (may be null)

      // Return sanitized customer-facing data (no internal costs, etc.),
      // preferring enrichment fields and falling back to the canonical ticket.
      return NextResponse.json({
        success: true,
        delivery: {
          ticketId: t?.ticketId || c?.ticketId,
          jobName: t?.jobName ?? c?.jobName,
          jobAddress: t?.jobAddress ?? c?.jobAddress,
          city: t?.city ?? c?.city,
          state: t?.state ?? c?.state,
          zip: t?.zip ?? '',
          customerName: t?.customerName ?? c?.customerName,
          scheduledDate: t?.scheduledDate ?? c?.scheduledDate ?? null,
          scheduledTime: t?.scheduledTime ?? null,
          driverName: t?.assignedDriverName ?? c?.assignedToName ?? null,
          materialsSummary: t?.materialsSummary ?? (c ? materialsSummaryOf(c) : ''),
          specialInstructions: t?.specialInstructions ?? c?.notes,
          priority: t?.priority ?? null,
        },
        status: result?.statusStage ?? customerStage(c?.status),
        eta: result?.eta ? {
          estimatedArrival: result.eta.estimatedArrival,
          estimatedMinutesAway: result.eta.estimatedMinutesAway,
          stopNumber: result.eta.stopNumber,
          totalStops: result.eta.totalStops,
        } : null,
        proofPhotos: result?.photos ?? [],
        timestamps: {
          departedAt: t?.departedAt || null,
          arrivedAt: t?.arrivedAt || null,
          deliveredAt: t?.deliveredAt || (c?.status === 'completed' ? c?.completedAt : null) || null,
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

      // Get all active deliveries from the CANONICAL Tickets tab (600+ rows),
      // not the near-empty legacy sheet. Phone-matched, non-terminal only.
      const normalizePhone = (p: string) => (p || '').replace(/\D/g, '').slice(-10);
      const TERMINAL = new Set(['completed', 'cancelled', 'voided', 'delivered']);
      const allTickets = await ticketSheetService.getAll();
      const customerTickets = allTickets.filter(t => {
        if (t.ticketType !== 'delivery') return false;
        if (TERMINAL.has(t.status)) return false;
        if (customerPhone) {
          return normalizePhone(t.customerPhone || '') === normalizePhone(customerPhone);
        }
        // Token-based lookup would match by customer email or access token
        return false;
      });

      if (customerTickets.length === 0) {
        return NextResponse.json({
          success: true,
          deliveries: [],
          message: 'No active deliveries found',
        });
      }

      const deliveries = await Promise.all(
        customerTickets.map(async (c) => {
          // Enrichment-first (ETA), falling back to the canonical ticket.
          let result: Awaited<ReturnType<typeof deliveryReminderService.getCustomerDeliveryStatus>> | null = null;
          try { result = await deliveryReminderService.getCustomerDeliveryStatus(c.ticketId); } catch { result = null; }
          const t = result?.ticket;
          return {
            ticketId: c.ticketId,
            jobName: t?.jobName ?? c.jobName,
            jobAddress: t?.jobAddress ?? c.jobAddress,
            city: t?.city ?? c.city,
            scheduledDate: t?.scheduledDate ?? c.scheduledDate ?? null,
            scheduledTime: t?.scheduledTime ?? null,
            driverName: t?.assignedDriverName ?? c.assignedToName ?? null,
            materialsSummary: t?.materialsSummary ?? materialsSummaryOf(c),
            status: result?.statusStage ?? customerStage(c.status),
            eta: result?.eta ? {
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

    return apiError('Invalid request', 400);
  } catch (error) {
    console.error('Customer delivery status error:', error);
    return apiError('Failed to fetch delivery status', 500);
  }
}
