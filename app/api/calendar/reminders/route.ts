/**
 * Calendar Reminders API
 *
 * GET  /api/calendar/reminders - Fetch pending reminders for today/tomorrow
 *   Query Params:
 *     - startDate (YYYY-MM-DD) - defaults to today
 *     - endDate (YYYY-MM-DD) - defaults to tomorrow
 *     - limit (number) - max reminders to return
 *
 * POST /api/calendar/reminders
 *   Body: { action: 'check-and-send' | 'send-single', reminderId?: string }
 *
 *   action 'check-and-send': Check for upcoming events and send all due reminders
 *   action 'send-single': Send a specific reminder by reminderId
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import {
  calendarReminderService,
  type CalendarEvent,
} from '@/lib/calendar-reminder-service';
import { teamupService } from '@/lib/teamup-service';
import { jobNimbusService, isJobNimbusConfigured } from '@/lib/jobnimbus-service';
import { schedulingService } from '@/lib/scheduling-service';
import { appointmentService } from '@/lib/appointment-service';
import { generateGoogleCalendarLinkFromEvent } from '@/lib/google-calendar';

// ---------------------------------------------------------------------------
// Helper: Gather events from all sources (same logic as /api/calendar/events)
// ---------------------------------------------------------------------------

async function gatherCalendarEvents(
  startDate: string,
  endDate: string
): Promise<CalendarEvent[]> {
  const allEvents: CalendarEvent[] = [];

  // TeamUp
  try {
    const config = teamupService.checkConfiguration();
    if (config.configured) {
      const teamupEvents = await teamupService.getEvents(startDate, endDate);
      for (const event of teamupEvents) {
        allEvents.push({
          id: `teamup-${event.id}`,
          title: event.title,
          start: event.start_dt,
          end: event.end_dt,
          location: event.location,
          eventType: event.custom?.eventType || 'other',
          status: event.custom?.status || 'scheduled',
          source: 'teamup',
          assignedTo: event.custom?.assignedTo,
          assignedToName: event.custom?.assignedToName || event.who,
          customer: event.custom?.customerName
            ? {
                name: event.custom.customerName,
                phone: event.custom.customerPhone,
                email: event.custom.customerEmail,
              }
            : null,
          notes: event.notes,
          priority: event.custom?.priority || 'normal',
        });
      }
    }
  } catch (err) {
    console.error('Reminders: TeamUp fetch error:', err);
  }

  // JobNimbus
  try {
    if (isJobNimbusConfigured()) {
      const jobsResult = await jobNimbusService.getJobs({ limit: 200 });
      for (const job of jobsResult.results) {
        if (!job.date_start) continue;

        const jobStartDate = new Date(job.date_start * 1000).toISOString();
        const jobDateStr = jobStartDate.split('T')[0];
        if (jobDateStr < startDate || jobDateStr > endDate) continue;

        const jobEndDate = job.date_end
          ? new Date(job.date_end * 1000).toISOString()
          : new Date(job.date_start * 1000 + 8 * 60 * 60 * 1000).toISOString();

        const address = [
          job.address_line1,
          job.city,
          job.state_text,
          job.zip,
        ]
          .filter(Boolean)
          .join(', ');

        allEvents.push({
          id: `jn-${job.jnid}`,
          title: job.name || `Job #${job.number || job.jnid}`,
          start: jobStartDate,
          end: jobEndDate,
          location: address || undefined,
          eventType: 'job',
          status: 'scheduled',
          source: 'jobnimbus',
          assignedTo: job.sales_rep,
          assignedToName: job.sales_rep_name,
          customer: null,
          notes: job.description,
          priority: 'normal',
        });
      }
    }
  } catch (err) {
    console.error('Reminders: JobNimbus fetch error:', err);
  }

  // Google Sheets scheduling
  try {
    const sheetsEvents = await schedulingService.getEventsForWeek(
      startDate,
      endDate
    );
    for (const event of sheetsEvents) {
      const eventStart = new Date(
        `${event.scheduledDate}T${event.scheduledTime}:00`
      );
      const eventEnd = new Date(
        eventStart.getTime() + event.estimatedDuration * 60 * 1000
      );
      const location = [
        event.jobAddress,
        event.city,
        event.state,
        event.zip,
      ]
        .filter(Boolean)
        .join(', ');

      allEvents.push({
        id: `sheets-${event.eventId}`,
        title: `${event.eventType.charAt(0).toUpperCase() + event.eventType.slice(1)} - ${event.jobName}`,
        start: eventStart.toISOString(),
        end: eventEnd.toISOString(),
        location: location || undefined,
        eventType: event.eventType,
        status: event.status,
        source: 'sheets',
        assignedTo: event.assignedTo,
        assignedToName: event.assignedToName,
        customer: event.customerName
          ? { name: event.customerName, phone: event.customerPhone }
          : null,
        notes: event.notes,
        priority: event.priority,
      });
    }
  } catch (err) {
    console.error('Reminders: Sheets fetch error:', err);
  }

  // Portal Appointments
  try {
    const portalAppointments = await appointmentService.getAppointments({
      startDate,
      endDate,
    });
    for (const appt of portalAppointments) {
      const startDT = new Date(`${appt.date}T${appt.startTime}:00`);
      const endDT = new Date(`${appt.date}T${appt.endTime}:00`);
      const location = [appt.address, appt.city, appt.state, appt.zip].filter(Boolean).join(', ');

      allEvents.push({
        id: `appt-${appt.appointmentId}`,
        title: appt.title,
        start: startDT.toISOString(),
        end: endDT.toISOString(),
        location: location || undefined,
        eventType: appt.type,
        status: appt.status,
        source: 'portal',
        assignedTo: appt.assignedTo,
        assignedToName: appt.assignedToName,
        customer: appt.customerName
          ? {
              name: appt.customerName,
              phone: appt.customerPhone,
              email: appt.customerEmail,
            }
          : null,
        notes: appt.notes,
        priority: appt.priority,
      });
    }
  } catch (err) {
    console.error('Reminders: Portal appointments fetch error:', err);
  }

  return allEvents;
}

// ---------------------------------------------------------------------------
// GET - Fetch pending reminders
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);

    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const startDate = searchParams.get('startDate') || today;
    const endDate = searchParams.get('endDate') || tomorrow;
    const limit = parseInt(searchParams.get('limit') || '100');

    // Gather events
    const events = await gatherCalendarEvents(startDate, endDate);

    // Get pending reminders
    const pending = await calendarReminderService.getPendingReminders(events);

    // Get recently sent reminders
    const recent = await calendarReminderService.getRecentReminders(20);

    return NextResponse.json({
      success: true,
      pending: pending.slice(0, limit),
      recentlySent: recent,
      meta: {
        startDate,
        endDate,
        eventsFound: events.length,
        pendingCount: pending.length,
      },
    });
  } catch (error) {
    console.error('Calendar reminders GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch reminders',
      },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST - Send reminders
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'check-and-send') {
      // Gather events for today and tomorrow
      const today = new Date().toISOString().split('T')[0];
      const dayAfterTomorrow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      const events = await gatherCalendarEvents(today, dayAfterTomorrow);
      const result = await calendarReminderService.checkAndSendDueReminders(
        events
      );

      return NextResponse.json({
        success: true,
        action: 'check-and-send',
        sent: result.sent,
        failed: result.failed,
        skipped: result.skipped,
        reminders: result.reminders,
        eventsChecked: events.length,
      });
    }

    if (action === 'send-single') {
      // Send a specific pending reminder
      // This requires generating the reminder from events and matching by ID
      const { reminder: reminderData } = body;

      if (!reminderData) {
        return NextResponse.json(
          { success: false, error: 'Missing reminder data in request body' },
          { status: 400 }
        );
      }

      const result = await calendarReminderService.sendReminder(reminderData);

      return NextResponse.json({
        success: true,
        action: 'send-single',
        reminder: result,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error:
          'Invalid action. Use "check-and-send" or "send-single".',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Calendar reminders POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to process reminders',
      },
      { status: 500 }
    );
  }
}
