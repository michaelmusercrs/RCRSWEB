/**
 * TeamUp Calendar Sync API (Bi-directional)
 *
 * GET /api/calendar/teamup - Fetch events from TeamUp calendar
 * POST /api/calendar/teamup - Create/sync event in TeamUp calendar
 *
 * Query Parameters (GET):
 * - startDate: Start date (YYYY-MM-DD)
 * - endDate: End date (YYYY-MM-DD)
 * - subcalendarId: Filter by sub-calendar
 *
 * POST body:
 * - action: 'create' (default) | 'sync-from-sheets' | 'sync-to-jobnimbus'
 * - For 'create': title, who, location, startTime, endTime, etc.
 * - For 'sync-from-sheets': date range to push Sheets events to TeamUp
 * - For 'sync-to-jobnimbus': push TeamUp event as JN task
 *
 * Sub-calendar mapping:
 *   inspection, estimate  -> TEAMUP_SUBCAL_INSPECTIONS
 *   installation, repair  -> TEAMUP_SUBCAL_INSTALLATIONS
 *   delivery, pickup      -> TEAMUP_SUBCAL_DELIVERIES
 *   meeting               -> TEAMUP_SUBCAL_MEETINGS
 *   other                 -> TEAMUP_SUBCAL_GENERAL
 *
 * All events include team member @rcrsal.com emails in Google Calendar links.
 *
 * Gracefully degrades if TeamUp is not configured.
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { teamupService, TEAMUP_SUBCALENDARS } from '@/lib/teamup-service';
import { generateGoogleCalendarLink } from '@/lib/google-calendar';
import { teamMembers } from '@/lib/teamData';
import { schedulingService } from '@/lib/scheduling-service';
import { jobNimbusService, isJobNimbusConfigured } from '@/lib/jobnimbus-service';

// Map event types to TeamUp sub-calendar IDs
function getSubCalendarForEventType(eventType: string): string | undefined {
  switch (eventType) {
    case 'inspection':
    case 'estimate':
      return TEAMUP_SUBCALENDARS.inspections || undefined;
    case 'installation':
    case 'repair':
      return TEAMUP_SUBCALENDARS.installations || undefined;
    case 'delivery':
    case 'pickup':
    case 'return':
      return TEAMUP_SUBCALENDARS.deliveries || undefined;
    case 'meeting':
      return TEAMUP_SUBCALENDARS.meetings || undefined;
    default:
      return TEAMUP_SUBCALENDARS.general || undefined;
  }
}

// Look up team member email by name or slug
function getTeamMemberEmail(nameOrSlug?: string): string | undefined {
  if (!nameOrSlug) return undefined;
  const member = teamMembers.find(
    (m) =>
      m.slug === nameOrSlug.toLowerCase() ||
      m.name.toLowerCase() === nameOrSlug.toLowerCase() ||
      m.name.split(' ')[0].toLowerCase() === nameOrSlug.toLowerCase()
  );
  return member?.email;
}

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || new Date().toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') ||
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const subcalendarId = searchParams.get('subcalendarId');

    // Check if TeamUp is configured
    const config = teamupService.checkConfiguration();

    if (!config.configured) {
      return NextResponse.json({
        success: true,
        configured: false,
        message: 'TeamUp calendar not configured. Set TEAMUP_API_KEY and TEAMUP_CALENDAR_KEY in .env.local to enable.',
        events: [],
        subcalendars: [],
      });
    }

    // Fetch events and subcalendars in parallel
    const [events, subcalendars] = await Promise.all([
      teamupService.getEvents(startDate, endDate, subcalendarId || undefined),
      teamupService.getSubCalendars(),
    ]);

    // Sort by start date
    events.sort((a, b) => new Date(a.start_dt).getTime() - new Date(b.start_dt).getTime());

    // Transform and add Google Calendar links with team member emails
    const transformedEvents = events.map(event => {
      // Build attendee emails: team member @rcrsal.com + optional customer email
      const attendeeEmails: string[] = [];
      const teamEmail = getTeamMemberEmail(event.custom?.assignedToName || event.who);
      if (teamEmail) attendeeEmails.push(teamEmail);
      if (event.custom?.customerEmail) attendeeEmails.push(event.custom.customerEmail);

      const gcalLink = generateGoogleCalendarLink({
        title: event.title,
        startDate: event.start_dt,
        endDate: event.end_dt,
        description: event.notes,
        location: event.location,
        allDay: event.all_day,
        attendeeEmails,
      });

      return {
        id: event.id,
        title: event.title,
        start: event.start_dt,
        end: event.end_dt,
        allDay: event.all_day || false,
        location: event.location,
        who: event.who,
        notes: event.notes,
        color: event.color,
        subcalendarId: event.subcalendar_id,
        eventType: event.custom?.eventType || 'other',
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
        googleCalendarLink: gcalLink,
      };
    });

    return NextResponse.json({
      success: true,
      configured: true,
      events: transformedEvents,
      subcalendars,
      meta: {
        startDate,
        endDate,
        totalCount: transformedEvents.length,
      },
    });
  } catch (error) {
    console.error('TeamUp calendar API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch TeamUp events',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const config = teamupService.checkConfiguration();

    if (!config.configured) {
      return NextResponse.json(
        {
          success: false,
          error: 'TeamUp calendar not configured. Set TEAMUP_API_KEY and TEAMUP_CALENDAR_KEY.',
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const action = body.action || 'create';

    // ================================================================
    // ACTION: sync-from-sheets
    // Push Google Sheets scheduled events to TeamUp
    // ================================================================
    if (action === 'sync-from-sheets') {
      const startDate = body.startDate || new Date().toISOString().split('T')[0];
      const endDate = body.endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const sheetsEvents = await schedulingService.getEventsForWeek(startDate, endDate);
      const results: Array<{ eventId: string; title: string; teamupId?: string; error?: string }> = [];

      for (const sheetEvent of sheetsEvents) {
        try {
          const eventStart = new Date(`${sheetEvent.scheduledDate}T${sheetEvent.scheduledTime}:00`);
          const eventEnd = new Date(eventStart.getTime() + sheetEvent.estimatedDuration * 60 * 1000);
          const location = [sheetEvent.jobAddress, sheetEvent.city, sheetEvent.state, sheetEvent.zip].filter(Boolean).join(', ');

          // Determine sub-calendar by event type
          const subcalId = getSubCalendarForEventType(sheetEvent.eventType);

          // Get team member email for the event
          const repEmail = getTeamMemberEmail(sheetEvent.assignedToName);

          const teamupEvent = await teamupService.createEvent({
            title: `${sheetEvent.eventType.charAt(0).toUpperCase() + sheetEvent.eventType.slice(1)} - ${sheetEvent.jobName}`,
            who: sheetEvent.assignedToName,
            location,
            start_dt: eventStart.toISOString(),
            end_dt: eventEnd.toISOString(),
            subcalendar_id: subcalId,
            notes: [
              `Customer: ${sheetEvent.customerName}`,
              `Phone: ${sheetEvent.customerPhone}`,
              `Assigned: ${sheetEvent.assignedToName}`,
              repEmail ? `Email: ${repEmail}` : '',
              sheetEvent.notes ? `\nNotes: ${sheetEvent.notes}` : '',
              `\nSynced from scheduling system (${sheetEvent.eventId})`,
            ].filter(Boolean).join('\n'),
            custom: {
              eventType: sheetEvent.eventType as any,
              status: sheetEvent.status as any,
              customerName: sheetEvent.customerName,
              customerPhone: sheetEvent.customerPhone,
              jobId: sheetEvent.jobId,
              assignedTo: sheetEvent.assignedTo,
              assignedToName: sheetEvent.assignedToName,
              priority: sheetEvent.priority as any,
            },
          });

          results.push({
            eventId: sheetEvent.eventId,
            title: teamupEvent.title,
            teamupId: teamupEvent.id,
          });
        } catch (err) {
          results.push({
            eventId: sheetEvent.eventId,
            title: `${sheetEvent.eventType} - ${sheetEvent.jobName}`,
            error: err instanceof Error ? err.message : 'Failed to sync',
          });
        }
      }

      return NextResponse.json({
        success: true,
        action: 'sync-from-sheets',
        synced: results.filter(r => r.teamupId).length,
        failed: results.filter(r => r.error).length,
        results,
      });
    }

    // ================================================================
    // ACTION: sync-to-jobnimbus
    // Push a TeamUp event as a JN task/activity
    // ================================================================
    if (action === 'sync-to-jobnimbus') {
      if (!isJobNimbusConfigured()) {
        return NextResponse.json(
          { success: false, error: 'JobNimbus API not configured' },
          { status: 503 }
        );
      }

      const { teamupEventId, contactJnid } = body;
      if (!teamupEventId) {
        return NextResponse.json(
          { success: false, error: 'teamupEventId is required' },
          { status: 400 }
        );
      }

      const teamupEvent = await teamupService.getEvent(teamupEventId);

      // Create a JN task for this event
      const dueDate = Math.floor(new Date(teamupEvent.start_dt).getTime() / 1000);
      const endDate = Math.floor(new Date(teamupEvent.end_dt).getTime() / 1000);

      const taskData: Record<string, unknown> = {
        title: teamupEvent.title,
        description: [
          teamupEvent.notes || '',
          `Location: ${teamupEvent.location || 'N/A'}`,
          `TeamUp Event ID: ${teamupEvent.id}`,
        ].join('\n'),
        date_start: dueDate,
        date_end: endDate,
        record_type_name: 'Task',
        is_active: true,
      };

      if (contactJnid) {
        (taskData as any).primary = { jnid: contactJnid };
      }

      const jnTask = await jobNimbusService.createNote(
        contactJnid || '',
        `[Calendar Event] ${teamupEvent.title}\nDate: ${new Date(teamupEvent.start_dt).toLocaleString()}\nLocation: ${teamupEvent.location || 'N/A'}\n${teamupEvent.notes || ''}`
      );

      return NextResponse.json({
        success: true,
        action: 'sync-to-jobnimbus',
        teamupEvent: {
          id: teamupEvent.id,
          title: teamupEvent.title,
        },
        jobnimbusActivity: jnTask,
      });
    }

    // ================================================================
    // ACTION: create (default) - Create a single event in TeamUp
    // ================================================================

    // Auto-determine sub-calendar from event type if not specified
    const subcalId = body.subcalendarId || getSubCalendarForEventType(body.eventType || 'other');

    // Get team member email for Google Calendar integration
    const repEmail = getTeamMemberEmail(body.assignedToName || body.who);

    // Build notes with team email for Google Calendar sync
    let notes = body.notes || '';
    if (repEmail) {
      notes += notes ? '\n' : '';
      notes += `Rep email: ${repEmail}`;
    }

    const event = await teamupService.createEvent({
      title: body.title,
      who: body.who,
      location: body.location,
      start_dt: body.startTime,
      end_dt: body.endTime,
      all_day: body.allDay,
      notes,
      subcalendar_id: subcalId,
      custom: {
        eventType: body.eventType,
        status: body.status || 'scheduled',
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

    // Build Google Calendar link with team + customer attendee emails
    const attendeeEmails: string[] = [];
    if (repEmail) attendeeEmails.push(repEmail);
    if (body.customerEmail) attendeeEmails.push(body.customerEmail);

    const gcalLink = generateGoogleCalendarLink({
      title: event.title,
      startDate: event.start_dt,
      endDate: event.end_dt,
      description: event.notes,
      location: event.location,
      attendeeEmails,
    });

    return NextResponse.json({
      success: true,
      action: 'create',
      event: {
        id: event.id,
        title: event.title,
        start: event.start_dt,
        end: event.end_dt,
        allDay: event.all_day || false,
        location: event.location,
        eventType: event.custom?.eventType || body.eventType,
        subcalendarId: subcalId,
      },
      googleCalendarLink: gcalLink,
      message: 'Event created in TeamUp calendar',
    });
  } catch (error) {
    console.error('TeamUp calendar POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create event',
      },
      { status: 500 }
    );
  }
}
