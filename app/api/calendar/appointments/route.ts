/**
 * Appointments API
 *
 * GET  /api/calendar/appointments - List appointments with filters
 *   Query params: startDate, endDate, assignedTo, customerId, status, type
 *
 * POST /api/calendar/appointments - Create new appointment
 *   Body: CreateAppointmentInput fields
 *   Returns: appointment object with googleCalendarLink
 *
 * PATCH /api/calendar/appointments?id=APT-xxx - Update appointment
 *   Body: UpdateAppointmentInput fields
 *
 * All responses include Google Calendar links for both rep (internal) and customer views.
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import {
  appointmentService,
  type AppointmentType,
  type AppointmentStatus,
} from '@/lib/appointment-service';
import { teamupService } from '@/lib/teamup-service';

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);

    const filters = {
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      assignedTo: searchParams.get('assignedTo') || undefined,
      customerId: searchParams.get('customerId') || undefined,
      status: (searchParams.get('status') || undefined) as AppointmentStatus | undefined,
      type: (searchParams.get('type') || undefined) as AppointmentType | undefined,
    };

    const appointments = await appointmentService.getAppointments(filters);

    return NextResponse.json({
      success: true,
      appointments,
      count: appointments.length,
    });
  } catch (error) {
    console.error('Appointments GET error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch appointments' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.type) {
      return NextResponse.json(
        { success: false, error: 'Appointment type is required' },
        { status: 400 }
      );
    }
    if (!body.date) {
      return NextResponse.json(
        { success: false, error: 'Date is required' },
        { status: 400 }
      );
    }
    if (!body.startTime) {
      return NextResponse.json(
        { success: false, error: 'Start time is required' },
        { status: 400 }
      );
    }
    if (!body.customerName) {
      return NextResponse.json(
        { success: false, error: 'Customer name is required' },
        { status: 400 }
      );
    }
    if (!body.address) {
      return NextResponse.json(
        { success: false, error: 'Address is required' },
        { status: 400 }
      );
    }

    // Create appointment
    const appointment = await appointmentService.createAppointment({
      type: body.type,
      title: body.title,
      description: body.description,
      date: body.date,
      startTime: body.startTime,
      duration: body.duration,
      allDay: body.allDay,
      address: body.address,
      city: body.city,
      state: body.state,
      zip: body.zip,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      customerEmail: body.customerEmail,
      customerId: body.customerId,
      assignedTo: body.assignedTo,
      assignedToName: body.assignedToName,
      jobId: body.jobId,
      jobName: body.jobName,
      priority: body.priority,
      customerReminderPref: body.customerReminderPref,
      notes: body.notes,
      internalNotes: body.internalNotes,
      source: body.source || 'portal',
      createdBy: body.createdBy,
    });

    // Also push to TeamUp if configured
    let teamupEventId: string | null = null;
    try {
      const teamupConfig = teamupService.checkConfiguration();
      if (teamupConfig.configured) {
        const startDT = new Date(`${appointment.date}T${appointment.startTime}:00`);
        const endDT = new Date(`${appointment.date}T${appointment.endTime}:00`);
        const location = [appointment.address, appointment.city, appointment.state, appointment.zip]
          .filter(Boolean).join(', ');

        const teamupEvent = await teamupService.createEvent({
          title: appointment.title,
          who: appointment.assignedToName,
          location,
          start_dt: startDT.toISOString(),
          end_dt: endDT.toISOString(),
          notes: appointment.description,
          custom: {
            eventType: appointment.type as any,
            status: 'scheduled',
            customerName: appointment.customerName,
            customerPhone: appointment.customerPhone,
            customerEmail: appointment.customerEmail,
            customerId: appointment.customerId,
            jobId: appointment.jobId,
            assignedTo: appointment.assignedTo,
            assignedToName: appointment.assignedToName,
            priority: appointment.priority as any,
          },
        });
        teamupEventId = teamupEvent.id || null;
      }
    } catch (err) {
      console.error('Failed to sync appointment to TeamUp:', err);
    }

    return NextResponse.json({
      success: true,
      appointment,
      teamupEventId,
      googleCalendarLink: appointment.googleCalendarLink,
      customerGoogleCalendarLink: appointment.customerGoogleCalendarLink,
      message: `${appointment.title} scheduled for ${appointment.date} at ${appointment.startTime}`,
    });
  } catch (error) {
    console.error('Appointments POST error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create appointment' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const appointmentId = searchParams.get('id');

    if (!appointmentId) {
      return NextResponse.json(
        { success: false, error: 'Appointment ID is required (?id=APT-xxx)' },
        { status: 400 }
      );
    }

    const body = await request.json();

    const updated = await appointmentService.updateAppointment(appointmentId, {
      status: body.status,
      date: body.date,
      startTime: body.startTime,
      duration: body.duration,
      assignedTo: body.assignedTo,
      assignedToName: body.assignedToName,
      notes: body.notes,
      internalNotes: body.internalNotes,
      customerReminderPref: body.customerReminderPref,
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, error: `Appointment ${appointmentId} not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      appointment: updated,
      googleCalendarLink: updated.googleCalendarLink,
    });
  } catch (error) {
    console.error('Appointments PATCH error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update appointment' },
      { status: 500 }
    );
  }
}
