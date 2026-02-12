/**
 * TeamUp Calendar Integration Service
 *
 * Provides integration with TeamUp calendar for scheduling appointments,
 * inspections, installations, and team events.
 *
 * TeamUp API Documentation: https://apidocs.teamup.com/
 */

// TeamUp API Configuration
const TEAMUP_API_BASE = 'https://api.teamup.com';
const TEAMUP_API_KEY = process.env.TEAMUP_API_KEY;
const TEAMUP_CALENDAR_KEY = process.env.TEAMUP_CALENDAR_KEY;

// Event Types for River City Roofing
export type TeamUpEventType =
  | 'inspection'
  | 'installation'
  | 'repair'
  | 'delivery'
  | 'pickup'
  | 'meeting'
  | 'followup'
  | 'estimate'
  | 'other';

export type TeamUpEventStatus =
  | 'scheduled'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'rescheduled';

// TeamUp Sub-Calendar IDs (configure these in your TeamUp account)
export const TEAMUP_SUBCALENDARS = {
  inspections: process.env.TEAMUP_SUBCAL_INSPECTIONS || '',
  installations: process.env.TEAMUP_SUBCAL_INSTALLATIONS || '',
  deliveries: process.env.TEAMUP_SUBCAL_DELIVERIES || '',
  meetings: process.env.TEAMUP_SUBCAL_MEETINGS || '',
  general: process.env.TEAMUP_SUBCAL_GENERAL || '',
};

// Event interface matching TeamUp API
export interface TeamUpEvent {
  id?: string;
  remote_id?: string;
  subcalendar_id?: string;
  subcalendar_ids?: string[];
  all_day?: boolean;
  rrule?: string;
  title: string;
  who?: string;
  location?: string;
  notes?: string;
  start_dt: string; // ISO 8601 format
  end_dt: string;   // ISO 8601 format
  creation_dt?: string;
  update_dt?: string;
  delete_dt?: string;
  readonly?: boolean;
  tz?: string;
  custom?: {
    eventType?: TeamUpEventType;
    status?: TeamUpEventStatus;
    customerId?: string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    jobId?: string;
    assignedTo?: string;
    assignedToName?: string;
    priority?: 'normal' | 'rush' | 'urgent';
  };
  color?: string;
  signup_enabled?: boolean;
  signup_deadline?: string;
  signup_count?: number;
  signup_limit?: number;
  attachments?: Array<{
    id: string;
    name: string;
    type: string;
    size: number;
  }>;
}

// Response interfaces
export interface TeamUpEventResponse {
  event: TeamUpEvent;
}

export interface TeamUpEventsResponse {
  events: TeamUpEvent[];
}

export interface TeamUpSubCalendar {
  id: string;
  name: string;
  active: boolean;
  color: string;
  overlap?: boolean;
  readonly?: boolean;
}

export interface TeamUpSubCalendarsResponse {
  subcalendars: TeamUpSubCalendar[];
}

// Color mapping for event types
export const EVENT_TYPE_COLORS: Record<TeamUpEventType, string> = {
  inspection: '#3B82F6',    // Blue
  installation: '#39FF14',  // Brand green
  repair: '#F59E0B',        // Amber
  delivery: '#8B5CF6',      // Purple
  pickup: '#EC4899',        // Pink
  meeting: '#6366F1',       // Indigo
  followup: '#14B8A6',      // Teal
  estimate: '#F97316',      // Orange
  other: '#6B7280',         // Gray
};

class TeamUpService {
  private apiKey: string;
  private calendarKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = TEAMUP_API_KEY || '';
    this.calendarKey = TEAMUP_CALENDAR_KEY || '';
    this.baseUrl = TEAMUP_API_BASE;
  }

  private get isConfigured(): boolean {
    return Boolean(this.apiKey && this.calendarKey);
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.isConfigured) {
      throw new Error('TeamUp API not configured. Set TEAMUP_API_KEY and TEAMUP_CALENDAR_KEY environment variables.');
    }

    const url = `${this.baseUrl}/${this.calendarKey}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Teamup-Token': this.apiKey,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('TeamUp API Error:', response.status, errorText);
      throw new Error(`TeamUp API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  // ============ EVENTS ============

  /**
   * Get events for a date range
   */
  async getEvents(
    startDate: string,
    endDate: string,
    subcalendarId?: string
  ): Promise<TeamUpEvent[]> {
    if (!this.isConfigured) {
      return this.getPlaceholderEvents(startDate, endDate);
    }

    const params = new URLSearchParams({
      startDate,
      endDate,
      tz: 'America/Chicago',
    });

    if (subcalendarId) {
      params.append('subcalendarId[]', subcalendarId);
    }

    const response = await this.request<TeamUpEventsResponse>(
      `/events?${params.toString()}`
    );

    return response.events;
  }

  /**
   * Get a single event by ID
   */
  async getEvent(eventId: string): Promise<TeamUpEvent> {
    if (!this.isConfigured) {
      throw new Error('TeamUp API not configured');
    }

    const response = await this.request<TeamUpEventResponse>(
      `/events/${eventId}`
    );

    return response.event;
  }

  /**
   * Create a new event
   */
  async createEvent(event: Omit<TeamUpEvent, 'id' | 'creation_dt' | 'update_dt'>): Promise<TeamUpEvent> {
    if (!this.isConfigured) {
      return this.createPlaceholderEvent(event);
    }

    const response = await this.request<TeamUpEventResponse>('/events', {
      method: 'POST',
      body: JSON.stringify(event),
    });

    return response.event;
  }

  /**
   * Update an existing event
   */
  async updateEvent(eventId: string, updates: Partial<TeamUpEvent>): Promise<TeamUpEvent> {
    if (!this.isConfigured) {
      throw new Error('TeamUp API not configured');
    }

    const response = await this.request<TeamUpEventResponse>(
      `/events/${eventId}`,
      {
        method: 'PUT',
        body: JSON.stringify(updates),
      }
    );

    return response.event;
  }

  /**
   * Delete an event
   */
  async deleteEvent(eventId: string): Promise<void> {
    if (!this.isConfigured) {
      throw new Error('TeamUp API not configured');
    }

    await this.request(`/events/${eventId}`, {
      method: 'DELETE',
    });
  }

  // ============ SUB-CALENDARS ============

  /**
   * Get all sub-calendars
   */
  async getSubCalendars(): Promise<TeamUpSubCalendar[]> {
    if (!this.isConfigured) {
      return this.getPlaceholderSubCalendars();
    }

    const response = await this.request<TeamUpSubCalendarsResponse>('/subcalendars');
    return response.subcalendars;
  }

  // ============ SCHEDULING HELPERS ============

  /**
   * Schedule an inspection
   */
  async scheduleInspection(data: {
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    address: string;
    startTime: string; // ISO 8601
    duration?: number; // minutes, default 60
    notes?: string;
    assignedTo?: string;
    assignedToName?: string;
    customerId?: string;
    jobId?: string;
  }): Promise<TeamUpEvent> {
    const duration = data.duration || 60;
    const endTime = new Date(new Date(data.startTime).getTime() + duration * 60000).toISOString();

    return this.createEvent({
      title: `Inspection - ${data.customerName}`,
      who: data.assignedToName || 'Unassigned',
      location: data.address,
      start_dt: data.startTime,
      end_dt: endTime,
      subcalendar_id: TEAMUP_SUBCALENDARS.inspections || undefined,
      notes: this.buildEventNotes(data),
      color: EVENT_TYPE_COLORS.inspection,
      custom: {
        eventType: 'inspection',
        status: 'scheduled',
        customerId: data.customerId,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail,
        jobId: data.jobId,
        assignedTo: data.assignedTo,
        assignedToName: data.assignedToName,
      },
    });
  }

  /**
   * Schedule an installation
   */
  async scheduleInstallation(data: {
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    jobName: string;
    address: string;
    startTime: string;
    endTime: string;
    crewLead?: string;
    crew?: string;
    notes?: string;
    customerId?: string;
    jobId?: string;
    priority?: 'normal' | 'rush' | 'urgent';
  }): Promise<TeamUpEvent> {
    return this.createEvent({
      title: `Installation - ${data.jobName}`,
      who: data.crewLead || data.crew || 'Unassigned',
      location: data.address,
      start_dt: data.startTime,
      end_dt: data.endTime,
      subcalendar_id: TEAMUP_SUBCALENDARS.installations || undefined,
      notes: this.buildEventNotes(data),
      color: EVENT_TYPE_COLORS.installation,
      custom: {
        eventType: 'installation',
        status: 'scheduled',
        customerId: data.customerId,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail,
        jobId: data.jobId,
        assignedTo: data.crewLead,
        assignedToName: data.crewLead,
        priority: data.priority || 'normal',
      },
    });
  }

  /**
   * Schedule a delivery
   */
  async scheduleDelivery(data: {
    jobName: string;
    address: string;
    startTime: string;
    duration?: number;
    driver?: string;
    materials?: string;
    notes?: string;
    customerId?: string;
    jobId?: string;
    customerName?: string;
    customerPhone?: string;
  }): Promise<TeamUpEvent> {
    const duration = data.duration || 30;
    const endTime = new Date(new Date(data.startTime).getTime() + duration * 60000).toISOString();

    return this.createEvent({
      title: `Delivery - ${data.jobName}`,
      who: data.driver || 'Unassigned',
      location: data.address,
      start_dt: data.startTime,
      end_dt: endTime,
      subcalendar_id: TEAMUP_SUBCALENDARS.deliveries || undefined,
      notes: data.materials ? `Materials: ${data.materials}\n\n${data.notes || ''}` : data.notes,
      color: EVENT_TYPE_COLORS.delivery,
      custom: {
        eventType: 'delivery',
        status: 'scheduled',
        customerId: data.customerId,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        jobId: data.jobId,
        assignedTo: data.driver,
        assignedToName: data.driver,
      },
    });
  }

  /**
   * Schedule a meeting
   */
  async scheduleMeeting(data: {
    title: string;
    startTime: string;
    endTime: string;
    location?: string;
    attendees?: string[];
    notes?: string;
    isAllDay?: boolean;
  }): Promise<TeamUpEvent> {
    return this.createEvent({
      title: data.title,
      who: data.attendees?.join(', ') || '',
      location: data.location,
      start_dt: data.startTime,
      end_dt: data.endTime,
      all_day: data.isAllDay,
      subcalendar_id: TEAMUP_SUBCALENDARS.meetings || undefined,
      notes: data.notes,
      color: EVENT_TYPE_COLORS.meeting,
      custom: {
        eventType: 'meeting',
        status: 'scheduled',
      },
    });
  }

  /**
   * Update event status
   */
  async updateEventStatus(
    eventId: string,
    status: TeamUpEventStatus,
    notes?: string
  ): Promise<TeamUpEvent> {
    const event = await this.getEvent(eventId);

    const updatedNotes = notes
      ? `${event.notes || ''}\n\n[${new Date().toLocaleString()}] Status changed to: ${status}${notes ? ` - ${notes}` : ''}`
      : event.notes;

    return this.updateEvent(eventId, {
      notes: updatedNotes,
      custom: {
        ...event.custom,
        status,
      },
    });
  }

  /**
   * Get events for a specific customer
   */
  async getCustomerEvents(
    customerId: string,
    startDate?: string,
    endDate?: string
  ): Promise<TeamUpEvent[]> {
    const start = startDate || new Date().toISOString().split('T')[0];
    const end = endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const events = await this.getEvents(start, end);

    return events.filter(event =>
      event.custom?.customerId === customerId
    );
  }

  /**
   * Get events for a specific job
   */
  async getJobEvents(
    jobId: string,
    startDate?: string,
    endDate?: string
  ): Promise<TeamUpEvent[]> {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const end = endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const events = await this.getEvents(start, end);

    return events.filter(event =>
      event.custom?.jobId === jobId
    );
  }

  /**
   * Get available time slots for a given date and event type
   */
  async getAvailableSlots(
    date: string,
    eventType: TeamUpEventType,
    durationMinutes: number = 60
  ): Promise<string[]> {
    const events = await this.getEvents(date, date);

    // Business hours: 8 AM to 5 PM
    const businessStart = 8;
    const businessEnd = 17;
    const slotDuration = durationMinutes;

    const slots: string[] = [];

    for (let hour = businessStart; hour < businessEnd; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const slotStart = new Date(`${date}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`);
        const slotEnd = new Date(slotStart.getTime() + slotDuration * 60000);

        if (slotEnd.getHours() > businessEnd || (slotEnd.getHours() === businessEnd && slotEnd.getMinutes() > 0)) {
          continue;
        }

        const isAvailable = !events.some(event => {
          const eventStart = new Date(event.start_dt);
          const eventEnd = new Date(event.end_dt);
          return (slotStart < eventEnd && slotEnd > eventStart);
        });

        if (isAvailable) {
          slots.push(slotStart.toISOString());
        }
      }
    }

    return slots;
  }

  // ============ HELPER METHODS ============

  private buildEventNotes(data: {
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    notes?: string;
  }): string {
    const parts = [];

    if (data.customerName) {
      parts.push(`Customer: ${data.customerName}`);
    }
    if (data.customerPhone) {
      parts.push(`Phone: ${data.customerPhone}`);
    }
    if (data.customerEmail) {
      parts.push(`Email: ${data.customerEmail}`);
    }
    if (data.notes) {
      parts.push('', data.notes);
    }

    return parts.join('\n');
  }

  // ============ FALLBACK FOR UNCONFIGURED API ============

  private getPlaceholderEvents(startDate: string, endDate: string): TeamUpEvent[] {
    // Return empty array when TeamUp is not configured
    // Events will be loaded from TeamUp API when TEAMUP_API_KEY is set
    return [];
  }

  private createPlaceholderEvent(event: Omit<TeamUpEvent, 'id' | 'creation_dt' | 'update_dt'>): TeamUpEvent {
    return {
      ...event,
      id: `placeholder-${Date.now()}`,
      creation_dt: new Date().toISOString(),
      update_dt: new Date().toISOString(),
    };
  }

  private getPlaceholderSubCalendars(): TeamUpSubCalendar[] {
    // Return empty sub-calendars when not configured
    // Configure TEAMUP_API_KEY and TEAMUP_CALENDAR_KEY to enable calendar features
    return [];
  }

  /**
   * Check if the service is properly configured
   */
  checkConfiguration(): { configured: boolean; message: string } {
    if (!this.apiKey) {
      return { configured: false, message: 'TEAMUP_API_KEY not set' };
    }
    if (!this.calendarKey) {
      return { configured: false, message: 'TEAMUP_CALENDAR_KEY not set' };
    }
    return { configured: true, message: 'TeamUp API configured' };
  }
}

// Export singleton instance
export const teamupService = new TeamUpService();

// Export types
export type { TeamUpService };
