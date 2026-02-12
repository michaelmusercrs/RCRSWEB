/**
 * Google Calendar Link Generator
 *
 * Generates Google Calendar URL links for events.
 * IMPORTANT: Google Calendar URL links only - never .ics files.
 *
 * All calendar events include attendee emails (@rcrsal.com) for team members.
 * Customer email is added as optional attendee for customer-facing events.
 *
 * Format: https://calendar.google.com/calendar/render?action=TEMPLATE&text=...&dates=...&details=...&location=...&add=email1,email2
 */

// Import team member data for @rcrsal.com email lookups
// NOTE: Lazy-loaded below to avoid circular deps on server init
let _teamMembers: Array<{ slug: string; name: string; email: string }> | null = null;

function getTeamMembers() {
  if (!_teamMembers) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { teamMembers } = require('./teamData');
      _teamMembers = teamMembers;
    } catch {
      _teamMembers = [];
    }
  }
  return _teamMembers!;
}

/**
 * Look up a team member's @rcrsal.com email by name or slug.
 */
export function resolveTeamMemberEmail(nameOrSlug?: string): string | undefined {
  if (!nameOrSlug) return undefined;
  const lower = nameOrSlug.toLowerCase();
  const members = getTeamMembers();
  const member = members.find(
    (m) =>
      m.slug === lower ||
      m.name.toLowerCase() === lower ||
      m.name.split(' ')[0].toLowerCase() === lower
  );
  return member?.email;
}

export interface GoogleCalendarEventInput {
  title: string;
  startDate: string; // ISO 8601 string or YYYY-MM-DD
  endDate?: string; // ISO 8601 string or YYYY-MM-DD
  description?: string;
  location?: string;
  attendeeEmails?: string[];
  allDay?: boolean;
}

/**
 * Format a Date object to Google Calendar date format.
 * For timed events: YYYYMMDDTHHmmssZ
 * For all-day events: YYYYMMDD
 */
function formatGoogleDate(date: Date, allDay: boolean): string {
  if (allDay) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Generate a Google Calendar URL link for an event.
 *
 * @param event - The event details
 * @returns A fully-formed Google Calendar URL string
 */
export function generateGoogleCalendarLink(event: GoogleCalendarEventInput): string {
  const params = new URLSearchParams();
  params.set('action', 'TEMPLATE');
  params.set('text', event.title);

  // Parse dates
  const start = new Date(event.startDate);
  const isAllDay = event.allDay || false;

  let end: Date;
  if (event.endDate) {
    end = new Date(event.endDate);
  } else if (isAllDay) {
    // All-day events: end date is next day
    end = new Date(start);
    end.setDate(end.getDate() + 1);
  } else {
    // Default to 1 hour duration
    end = new Date(start.getTime() + 60 * 60 * 1000);
  }

  const startStr = formatGoogleDate(start, isAllDay);
  const endStr = formatGoogleDate(end, isAllDay);
  params.set('dates', `${startStr}/${endStr}`);

  if (event.description) {
    params.set('details', event.description);
  }

  if (event.location) {
    params.set('location', event.location);
  }

  if (event.attendeeEmails && event.attendeeEmails.length > 0) {
    params.set('add', event.attendeeEmails.join(','));
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generate a Google Calendar link from a calendar event object
 * (the format returned by /api/calendar/events)
 *
 * Automatically includes team member @rcrsal.com email as attendee
 * and customer email for customer-facing events.
 */
export function generateGoogleCalendarLinkFromEvent(event: {
  title: string;
  start: string;
  end: string;
  location?: string;
  notes?: string;
  assignedToName?: string;
  assignedTo?: string;
  customer?: { name?: string; phone?: string; email?: string } | null;
  eventType?: string;
  allDay?: boolean;
}): string {
  const descriptionParts: string[] = [];

  if (event.eventType) {
    descriptionParts.push(`Type: ${event.eventType}`);
  }
  if (event.assignedToName) {
    descriptionParts.push(`Assigned to: ${event.assignedToName}`);
  }
  if (event.customer?.name) {
    descriptionParts.push(`Customer: ${event.customer.name}`);
  }
  if (event.customer?.phone) {
    descriptionParts.push(`Phone: ${event.customer.phone}`);
  }
  if (event.notes) {
    descriptionParts.push('', event.notes);
  }

  // Build attendee emails: team member @rcrsal.com + customer email
  const attendeeEmails: string[] = [];
  const teamEmail = resolveTeamMemberEmail(event.assignedToName || event.assignedTo);
  if (teamEmail) {
    attendeeEmails.push(teamEmail);
  }
  if (event.customer?.email) {
    attendeeEmails.push(event.customer.email);
  }

  return generateGoogleCalendarLink({
    title: event.title,
    startDate: event.start,
    endDate: event.end,
    description: descriptionParts.join('\n'),
    location: event.location,
    attendeeEmails,
    allDay: event.allDay,
  });
}

/**
 * Generate a Google Calendar link for a scheduled event
 * (from scheduling-service ScheduledEvent format)
 *
 * Automatically adds the assigned team member's @rcrsal.com email as attendee.
 */
export function generateGoogleCalendarLinkFromScheduledEvent(event: {
  jobName: string;
  scheduledDate: string;
  scheduledTime: string;
  estimatedDuration: number;
  jobAddress: string;
  city: string;
  state: string;
  zip: string;
  customerName: string;
  customerPhone: string;
  assignedToName: string;
  eventType: string;
  notes?: string;
  customerEmail?: string;
}): string {
  // Build ISO date from scheduledDate + scheduledTime
  const startDate = new Date(`${event.scheduledDate}T${event.scheduledTime}:00`);
  const endDate = new Date(startDate.getTime() + event.estimatedDuration * 60 * 1000);
  const location = `${event.jobAddress}, ${event.city}, ${event.state} ${event.zip}`;

  const descriptionParts = [
    `Type: ${event.eventType}`,
    `Customer: ${event.customerName}`,
    `Phone: ${event.customerPhone}`,
    `Assigned to: ${event.assignedToName}`,
  ];
  if (event.notes) {
    descriptionParts.push('', event.notes);
  }

  // Build attendee list: team member + optional customer
  const attendeeEmails: string[] = [];
  const teamEmail = resolveTeamMemberEmail(event.assignedToName);
  if (teamEmail) attendeeEmails.push(teamEmail);
  if (event.customerEmail) attendeeEmails.push(event.customerEmail);

  return generateGoogleCalendarLink({
    title: `${event.eventType.charAt(0).toUpperCase() + event.eventType.slice(1)} - ${event.jobName}`,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    description: descriptionParts.join('\n'),
    location,
    attendeeEmails,
  });
}

/**
 * Generate a Google Calendar link for a JobNimbus job
 *
 * Automatically includes the sales rep's @rcrsal.com email as attendee.
 */
export function generateGoogleCalendarLinkFromJob(job: {
  name?: string;
  description?: string;
  status?: string;
  address?: string;
  startDate?: string | null;
  endDate?: string | null;
  salesRep?: string;
  customerEmail?: string;
}): string | null {
  if (!job.startDate) return null;

  const descriptionParts: string[] = [];
  if (job.status) descriptionParts.push(`Status: ${job.status}`);
  if (job.salesRep) descriptionParts.push(`Sales Rep: ${job.salesRep}`);
  if (job.description) descriptionParts.push('', job.description);

  // Build attendee list from sales rep + customer
  const attendeeEmails: string[] = [];
  const repEmail = resolveTeamMemberEmail(job.salesRep);
  if (repEmail) attendeeEmails.push(repEmail);
  if (job.customerEmail) attendeeEmails.push(job.customerEmail);

  return generateGoogleCalendarLink({
    title: job.name || 'Roofing Job',
    startDate: job.startDate,
    endDate: job.endDate || undefined,
    description: descriptionParts.join('\n'),
    location: job.address,
    attendeeEmails,
    allDay: !job.startDate.includes('T'),
  });
}
