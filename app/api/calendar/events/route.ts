/**
 * Unified Calendar Events API
 *
 * GET /api/calendar/events - Fetch events from all sources:
 *   - TeamUp calendar (if configured)
 *   - JobNimbus jobs with scheduled dates
 *   - Google Sheets scheduling service (deliveries, pickups, etc.)
 *   - Portal appointments
 *
 * Query Parameters:
 * - startDate: Start date (YYYY-MM-DD), defaults to today
 * - endDate: End date (YYYY-MM-DD), defaults to 30 days from start
 * - eventType: Filter by type (job, delivery, appointment, meeting, inspection, installation, pickup, return)
 * - assignedTo: Filter by team member ID or slug
 * - status: Filter by status (scheduled, in_progress, completed, cancelled)
 * - source: Filter by source (teamup, jobnimbus, sheets, portal)
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { teamupService } from '@/lib/teamup-service';
import { jobNimbusService, isJobNimbusConfigured } from '@/lib/jobnimbus-service';
import { schedulingService } from '@/lib/scheduling-service';
import { appointmentService } from '@/lib/appointment-service';
import { generateGoogleCalendarLink } from '@/lib/google-calendar';
import { teamMembers } from '@/lib/teamData';

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

// Unified calendar event type returned to the frontend
interface UnifiedCalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  who?: string;
  notes?: string;
  color?: string;
  eventType: string;
  status: string;
  source: 'teamup' | 'jobnimbus' | 'sheets' | 'portal';
  customer?: {
    id?: string;
    name: string;
    phone?: string;
    email?: string;
  } | null;
  jobId?: string;
  assignedTo?: string;
  assignedToName?: string;
  priority: string;
  googleCalendarLink?: string;
}

// Color mapping for event types
const EVENT_TYPE_COLORS: Record<string, string> = {
  job: '#3B82F6',           // Blue
  inspection: '#3B82F6',    // Blue
  installation: '#39FF14',  // Brand green
  delivery: '#22C55E',      // Green
  pickup: '#EC4899',        // Pink
  return: '#8B5CF6',        // Purple
  appointment: '#F97316',   // Orange
  meeting: '#8B5CF6',       // Purple
  estimate: '#F97316',      // Orange
  repair: '#F59E0B',        // Amber
  followup: '#14B8A6',      // Teal
  other: '#6B7280',         // Gray
};

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const startDate = searchParams.get('startDate') || new Date().toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') ||
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const filterEventType = searchParams.get('eventType');
    const filterAssignedTo = searchParams.get('assignedTo');
    const filterStatus = searchParams.get('status');
    const filterSource = searchParams.get('source');

    const allEvents: UnifiedCalendarEvent[] = [];
    const errors: string[] = [];

    // ============ SOURCE 1: TeamUp Calendar ============
    if (!filterSource || filterSource === 'teamup') {
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
              allDay: event.all_day || false,
              location: event.location,
              who: event.who,
              notes: event.notes,
              color: event.color || EVENT_TYPE_COLORS[event.custom?.eventType || 'other'],
              eventType: event.custom?.eventType || 'other',
              status: event.custom?.status || 'scheduled',
              source: 'teamup',
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
            });
          }
        }
      } catch (err) {
        errors.push(`TeamUp: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // ============ SOURCE 2: JobNimbus Jobs ============
    if (!filterSource || filterSource === 'jobnimbus') {
      try {
        if (isJobNimbusConfigured()) {
          const jobsResult = await jobNimbusService.getJobs({ limit: 200 });
          for (const job of jobsResult.results) {
            // Only include jobs with scheduled dates in our range
            if (!job.date_start) continue;

            const jobStartDate = new Date(job.date_start * 1000).toISOString();
            const jobDateStr = jobStartDate.split('T')[0];

            // Check if job falls in our date range
            if (jobDateStr < startDate || jobDateStr > endDate) continue;

            const jobEndDate = job.date_end
              ? new Date(job.date_end * 1000).toISOString()
              : new Date(job.date_start * 1000 + 8 * 60 * 60 * 1000).toISOString(); // Default 8 hours

            const address = [
              job.address_line1,
              job.city,
              job.state_text,
              job.zip,
            ].filter(Boolean).join(', ');

            allEvents.push({
              id: `jn-${job.jnid}`,
              title: job.name || `Job #${job.number || job.jnid}`,
              start: jobStartDate,
              end: jobEndDate,
              allDay: false,
              location: address || undefined,
              who: job.sales_rep_name,
              notes: job.description,
              color: EVENT_TYPE_COLORS.job,
              eventType: 'job',
              status: mapJobNimbusStatus(job.status),
              source: 'jobnimbus',
              customer: null,
              jobId: job.jnid,
              assignedTo: job.sales_rep,
              assignedToName: job.sales_rep_name,
              priority: 'normal',
            });
          }
        }
      } catch (err) {
        errors.push(`JobNimbus: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // ============ SOURCE 3: Google Sheets Scheduling Service ============
    if (!filterSource || filterSource === 'sheets') {
      try {
        const sheetsEvents = await schedulingService.getEventsForWeek(startDate, endDate);
        for (const event of sheetsEvents) {
          const eventStart = new Date(`${event.scheduledDate}T${event.scheduledTime}:00`);
          const eventEnd = new Date(eventStart.getTime() + event.estimatedDuration * 60 * 1000);
          const location = [event.jobAddress, event.city, event.state, event.zip].filter(Boolean).join(', ');

          allEvents.push({
            id: `sheets-${event.eventId}`,
            title: `${event.eventType.charAt(0).toUpperCase() + event.eventType.slice(1)} - ${event.jobName}`,
            start: eventStart.toISOString(),
            end: eventEnd.toISOString(),
            allDay: false,
            location: location || undefined,
            who: event.assignedToName,
            notes: event.notes,
            color: EVENT_TYPE_COLORS[event.eventType] || EVENT_TYPE_COLORS.other,
            eventType: event.eventType,
            status: event.status,
            source: 'sheets',
            customer: event.customerName ? {
              name: event.customerName,
              phone: event.customerPhone,
            } : null,
            jobId: event.jobId,
            assignedTo: event.assignedTo,
            assignedToName: event.assignedToName,
            priority: event.priority,
          });
        }
      } catch (err) {
        errors.push(`Sheets: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // ============ SOURCE 4: Portal Appointments (Google Sheets) ============
    if (!filterSource || filterSource === 'portal') {
      try {
        const portalAppointments = await appointmentService.getAppointments({
          startDate,
          endDate,
        });
        for (const appt of portalAppointments) {
          // Avoid duplicates (already added via TeamUp sync)
          const isDuplicate = allEvents.some(e =>
            e.title === appt.title &&
            e.start.split('T')[0] === appt.date
          );
          if (isDuplicate) continue;

          const startDT = new Date(`${appt.date}T${appt.startTime}:00`);
          const endDT = new Date(`${appt.date}T${appt.endTime}:00`);
          const location = [appt.address, appt.city, appt.state, appt.zip].filter(Boolean).join(', ');

          allEvents.push({
            id: `appt-${appt.appointmentId}`,
            title: appt.title,
            start: startDT.toISOString(),
            end: endDT.toISOString(),
            allDay: appt.allDay,
            location: location || undefined,
            who: appt.assignedToName,
            notes: appt.notes,
            color: undefined,
            eventType: appt.type,
            status: appt.status,
            source: 'portal',
            customer: appt.customerName ? {
              id: appt.customerId,
              name: appt.customerName,
              phone: appt.customerPhone,
              email: appt.customerEmail,
            } : null,
            jobId: appt.jobId,
            assignedTo: appt.assignedTo,
            assignedToName: appt.assignedToName,
            priority: appt.priority,
          });
        }
      } catch (err) {
        errors.push(`Portal: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    // ============ Apply Filters ============
    let filteredEvents = allEvents;

    if (filterEventType) {
      filteredEvents = filteredEvents.filter(e => e.eventType === filterEventType);
    }

    if (filterAssignedTo) {
      const filterLower = filterAssignedTo.toLowerCase();
      filteredEvents = filteredEvents.filter(e =>
        e.assignedTo?.toLowerCase() === filterLower ||
        e.assignedToName?.toLowerCase().includes(filterLower) ||
        e.who?.toLowerCase().includes(filterLower)
      );
    }

    if (filterStatus) {
      filteredEvents = filteredEvents.filter(e => e.status === filterStatus);
    }

    // ============ Sort by start date ============
    filteredEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    // ============ Add Google Calendar links with team member emails ============
    filteredEvents = filteredEvents.map(event => {
      // Build attendee emails: @rcrsal.com team email + customer email
      const attendeeEmails: string[] = [];
      const teamEmail = getTeamMemberEmail(event.assignedToName || event.who);
      if (teamEmail) attendeeEmails.push(teamEmail);
      if (event.customer?.email) attendeeEmails.push(event.customer.email);

      const descriptionParts: string[] = [];
      if (event.eventType) descriptionParts.push(`Type: ${event.eventType}`);
      if (event.assignedToName) descriptionParts.push(`Assigned to: ${event.assignedToName}`);
      if (event.customer?.name) descriptionParts.push(`Customer: ${event.customer.name}`);
      if (event.customer?.phone) descriptionParts.push(`Phone: ${event.customer.phone}`);
      if (event.notes) descriptionParts.push('', event.notes);

      return {
        ...event,
        googleCalendarLink: generateGoogleCalendarLink({
          title: event.title,
          startDate: event.start,
          endDate: event.end,
          description: descriptionParts.join('\n'),
          location: event.location,
          attendeeEmails,
          allDay: event.allDay,
        }),
      };
    });

    return NextResponse.json({
      success: true,
      events: filteredEvents,
      meta: {
        startDate,
        endDate,
        totalCount: filteredEvents.length,
        sources: {
          teamup: filteredEvents.filter(e => e.source === 'teamup').length,
          jobnimbus: filteredEvents.filter(e => e.source === 'jobnimbus').length,
          sheets: filteredEvents.filter(e => e.source === 'sheets').length,
          portal: filteredEvents.filter(e => e.source === 'portal').length,
        },
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error('Calendar events API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch events',
      },
      { status: 500 }
    );
  }
}

function mapJobNimbusStatus(status?: string): string {
  const s = (status || '').toLowerCase();
  if (s.includes('complete') || s.includes('closed')) return 'completed';
  if (s.includes('progress') || s.includes('install')) return 'in_progress';
  if (s.includes('cancel')) return 'cancelled';
  if (s.includes('schedul')) return 'scheduled';
  return 'scheduled';
}
