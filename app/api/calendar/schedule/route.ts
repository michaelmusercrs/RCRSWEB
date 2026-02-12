/**
 * Calendar Schedule API
 *
 * POST /api/calendar/schedule - Create a new event in TeamUp calendar
 *
 * Request Body:
 * - eventType: 'inspection' | 'installation' | 'delivery' | 'meeting' | 'other'
 * - title: Event title
 * - startTime: ISO 8601 start time
 * - endTime: ISO 8601 end time (optional for fixed-duration events)
 * - duration: Duration in minutes (optional, for auto-calculating end time)
 * - location: Event location/address
 * - customerName: Customer name
 * - customerPhone: Customer phone
 * - customerEmail: Customer email (optional)
 * - customerId: Customer ID (optional)
 * - jobId: Job ID (optional)
 * - assignedTo: Assigned person ID (optional)
 * - assignedToName: Assigned person name (optional)
 * - notes: Additional notes (optional)
 * - priority: 'normal' | 'rush' | 'urgent' (optional)
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { teamupService, TeamUpEventType } from '@/lib/teamup-service';
import { generateGoogleCalendarLink, resolveTeamMemberEmail } from '@/lib/google-calendar';

interface ScheduleRequestBody {
  eventType: TeamUpEventType;
  title?: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  location: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerId?: string;
  jobId?: string;
  assignedTo?: string;
  assignedToName?: string;
  notes?: string;
  priority?: 'normal' | 'rush' | 'urgent';
  // Meeting-specific fields
  attendees?: string[];
  isAllDay?: boolean;
  // Delivery-specific fields
  driver?: string;
  materials?: string;
  // Installation-specific fields
  crewLead?: string;
  crew?: string;
  jobName?: string;
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body: ScheduleRequestBody = await request.json();

    // Validate required fields
    if (!body.eventType) {
      return NextResponse.json(
        { success: false, error: 'Event type is required' },
        { status: 400 }
      );
    }

    if (!body.startTime) {
      return NextResponse.json(
        { success: false, error: 'Start time is required' },
        { status: 400 }
      );
    }

    // Check configuration
    const config = teamupService.checkConfiguration();

    let event;

    // Route to the appropriate scheduling method
    switch (body.eventType) {
      case 'inspection':
        event = await teamupService.scheduleInspection({
          customerName: body.customerName,
          customerPhone: body.customerPhone,
          customerEmail: body.customerEmail,
          address: body.location,
          startTime: body.startTime,
          duration: body.duration || 60,
          notes: body.notes,
          assignedTo: body.assignedTo,
          assignedToName: body.assignedToName,
          customerId: body.customerId,
          jobId: body.jobId,
        });
        break;

      case 'installation':
        if (!body.endTime && !body.duration) {
          return NextResponse.json(
            { success: false, error: 'End time or duration is required for installations' },
            { status: 400 }
          );
        }
        const installEndTime = body.endTime ||
          new Date(new Date(body.startTime).getTime() + (body.duration || 480) * 60000).toISOString();

        event = await teamupService.scheduleInstallation({
          customerName: body.customerName,
          customerPhone: body.customerPhone,
          customerEmail: body.customerEmail,
          jobName: body.jobName || body.title || 'Roofing Installation',
          address: body.location,
          startTime: body.startTime,
          endTime: installEndTime,
          crewLead: body.crewLead || body.assignedToName,
          crew: body.crew,
          notes: body.notes,
          customerId: body.customerId,
          jobId: body.jobId,
          priority: body.priority,
        });
        break;

      case 'delivery':
        event = await teamupService.scheduleDelivery({
          jobName: body.jobName || body.title || 'Material Delivery',
          address: body.location,
          startTime: body.startTime,
          duration: body.duration || 30,
          driver: body.driver || body.assignedToName,
          materials: body.materials,
          notes: body.notes,
          customerId: body.customerId,
          jobId: body.jobId,
          customerName: body.customerName,
          customerPhone: body.customerPhone,
        });
        break;

      case 'meeting':
        const meetingEndTime = body.endTime ||
          new Date(new Date(body.startTime).getTime() + (body.duration || 60) * 60000).toISOString();

        event = await teamupService.scheduleMeeting({
          title: body.title || 'Team Meeting',
          startTime: body.startTime,
          endTime: meetingEndTime,
          location: body.location,
          attendees: body.attendees,
          notes: body.notes,
          isAllDay: body.isAllDay,
        });
        break;

      default:
        // Generic event creation
        const genericEndTime = body.endTime ||
          new Date(new Date(body.startTime).getTime() + (body.duration || 60) * 60000).toISOString();

        event = await teamupService.createEvent({
          title: body.title || `${body.eventType} - ${body.customerName || 'Event'}`,
          who: body.assignedToName,
          location: body.location,
          start_dt: body.startTime,
          end_dt: genericEndTime,
          notes: body.notes,
          custom: {
            eventType: body.eventType,
            status: 'scheduled',
            customerId: body.customerId,
            customerName: body.customerName,
            customerPhone: body.customerPhone,
            customerEmail: body.customerEmail,
            jobId: body.jobId,
            assignedTo: body.assignedTo,
            assignedToName: body.assignedToName,
            priority: body.priority,
          },
        });
    }

    // Build Google Calendar link
    const attendeeEmails: string[] = [];
    const repEmail = resolveTeamMemberEmail(event.custom?.assignedToName || event.who);
    if (repEmail) attendeeEmails.push(repEmail);
    if (event.custom?.customerEmail) attendeeEmails.push(event.custom.customerEmail);

    const descriptionParts: string[] = [];
    if (body.eventType) descriptionParts.push(`Type: ${body.eventType}`);
    if (body.customerName) descriptionParts.push(`Customer: ${body.customerName}`);
    if (body.customerPhone) descriptionParts.push(`Phone: ${body.customerPhone}`);
    if (body.assignedToName) descriptionParts.push(`Rep: ${body.assignedToName}`);
    descriptionParts.push('', 'River City Roofing Solutions - (256) 274-8530');

    const googleCalendarLink = generateGoogleCalendarLink({
      title: event.title,
      startDate: event.start_dt,
      endDate: event.end_dt,
      description: descriptionParts.join('\n'),
      location: event.location,
      attendeeEmails,
      allDay: event.all_day || false,
    });

    // Customer-facing calendar link (no internal details)
    const customerGoogleCalendarLink = generateGoogleCalendarLink({
      title: `${body.eventType ? body.eventType.charAt(0).toUpperCase() + body.eventType.slice(1) : 'Appointment'} - River City Roofing`,
      startDate: event.start_dt,
      endDate: event.end_dt,
      description: `Your ${body.eventType || 'appointment'} with River City Roofing Solutions.\nContact: (256) 274-8530`,
      location: event.location,
    });

    // Transform event for frontend
    const transformedEvent = {
      id: event.id,
      title: event.title,
      start: event.start_dt,
      end: event.end_dt,
      allDay: event.all_day || false,
      location: event.location,
      who: event.who,
      notes: event.notes,
      color: event.color,
      eventType: event.custom?.eventType || body.eventType,
      status: event.custom?.status || 'scheduled',
      customer: event.custom?.customerName ? {
        id: event.custom.customerId,
        name: event.custom.customerName,
        phone: event.custom.customerPhone,
        email: event.custom.customerEmail,
      } : null,
      jobId: event.custom?.jobId,
      assignedTo: event.custom?.assignedTo,
      assignedToName: event.custom?.assignedToName,
      priority: event.custom?.priority || 'normal',
      googleCalendarLink,
    };

    return NextResponse.json({
      success: true,
      configured: config.configured,
      event: transformedEvent,
      googleCalendarLink,
      customerGoogleCalendarLink,
      message: `${body.eventType.charAt(0).toUpperCase() + body.eventType.slice(1)} scheduled successfully`,
      demoMode: !config.configured,
    });
  } catch (error) {
    console.error('Calendar schedule API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to schedule event',
      },
      { status: 500 }
    );
  }
}
