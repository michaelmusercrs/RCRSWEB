/**
 * Appointment Service
 *
 * Central service for creating, managing, and persisting appointments.
 * Persists to Google Sheets (Appointments tab), generates Google Calendar links,
 * and integrates with the calendar reminder system.
 *
 * Appointment types: inspection, estimate, installation, followup, repair, meeting, other
 * Sources: portal (rep-created), customer (customer-requested), jobnimbus, teamup
 */

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { generateGoogleCalendarLink, resolveTeamMemberEmail } from './google-calendar';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AppointmentType =
  | 'inspection'
  | 'estimate'
  | 'installation'
  | 'followup'
  | 'repair'
  | 'meeting'
  | 'other';

export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'rescheduled'
  | 'no_show';

export type ReminderPreference = 'none' | 'day_before' | 'hour_before' | 'both';

export interface Appointment {
  appointmentId: string;
  type: AppointmentType;
  title: string;
  description: string;

  // Scheduling
  date: string;            // YYYY-MM-DD
  startTime: string;       // HH:mm (24h)
  endTime: string;         // HH:mm (24h)
  duration: number;        // minutes
  allDay: boolean;

  // Location
  address: string;
  city: string;
  state: string;
  zip: string;

  // Customer
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerId: string;

  // Assignment
  assignedTo: string;       // rep slug or ID
  assignedToName: string;
  assignedToEmail: string;

  // Job reference
  jobId: string;
  jobName: string;

  // Status
  status: AppointmentStatus;
  priority: 'normal' | 'rush' | 'urgent';

  // Reminders
  customerReminderPref: ReminderPreference;
  repReminderSent: boolean;
  customerReminderSent: boolean;

  // Google Calendar
  googleCalendarLink: string;
  customerGoogleCalendarLink: string;

  // Notes
  notes: string;
  internalNotes: string;

  // Source tracking
  source: 'portal' | 'customer' | 'jobnimbus' | 'teamup' | 'api';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAppointmentInput {
  type: AppointmentType;
  title?: string;
  description?: string;

  date: string;
  startTime: string;
  duration?: number;
  allDay?: boolean;

  address: string;
  city?: string;
  state?: string;
  zip?: string;

  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerId?: string;

  assignedTo?: string;
  assignedToName?: string;

  jobId?: string;
  jobName?: string;

  priority?: 'normal' | 'rush' | 'urgent';
  customerReminderPref?: ReminderPreference;

  notes?: string;
  internalNotes?: string;

  source?: 'portal' | 'customer' | 'jobnimbus' | 'teamup' | 'api';
  createdBy?: string;
}

export interface UpdateAppointmentInput {
  status?: AppointmentStatus;
  date?: string;
  startTime?: string;
  duration?: number;
  assignedTo?: string;
  assignedToName?: string;
  notes?: string;
  internalNotes?: string;
  customerReminderPref?: ReminderPreference;
}

// Default durations by appointment type (minutes)
const DEFAULT_DURATIONS: Record<AppointmentType, number> = {
  inspection: 60,
  estimate: 60,
  installation: 480,
  followup: 30,
  repair: 240,
  meeting: 60,
  other: 60,
};

// Friendly labels for appointment types
export const APPOINTMENT_TYPE_LABELS: Record<AppointmentType, string> = {
  inspection: 'Roof Inspection',
  estimate: 'Estimate',
  installation: 'Installation',
  followup: 'Follow-up',
  repair: 'Repair',
  meeting: 'Meeting',
  other: 'Other',
};

// Color config for each type
export const APPOINTMENT_TYPE_COLORS: Record<AppointmentType, { bg: string; text: string; dot: string }> = {
  inspection: { bg: 'bg-blue-500/20', text: 'text-blue-400', dot: 'bg-blue-500' },
  estimate: { bg: 'bg-orange-500/20', text: 'text-orange-400', dot: 'bg-orange-500' },
  installation: { bg: 'bg-lime-500/20', text: 'text-lime-400', dot: 'bg-lime-500' },
  followup: { bg: 'bg-teal-500/20', text: 'text-teal-400', dot: 'bg-teal-500' },
  repair: { bg: 'bg-amber-500/20', text: 'text-amber-400', dot: 'bg-amber-500' },
  meeting: { bg: 'bg-purple-500/20', text: 'text-purple-400', dot: 'bg-purple-500' },
  other: { bg: 'bg-zinc-500/20', text: 'text-zinc-400', dot: 'bg-zinc-500' },
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class AppointmentService {
  private doc: GoogleSpreadsheet | null = null;
  private initialized = false;

  private async getDoc(): Promise<GoogleSpreadsheet> {
    if (this.doc && this.initialized) return this.doc;

    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const sheetId = process.env.GOOGLE_SHEET_ID
      || process.env.GOOGLE_SHEETS_ID
      || process.env.DELIVERY_SHEETS_ID;

    if (!serviceAccountEmail || !privateKey || !sheetId) {
      throw new Error('Missing Google Sheets credentials');
    }

    const jwt = new JWT({
      email: serviceAccountEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    this.doc = new GoogleSpreadsheet(sheetId, jwt);
    await this.doc.loadInfo();
    this.initialized = true;
    return this.doc;
  }

  private async getOrCreateSheet() {
    const doc = await this.getDoc();
    const headers = [
      'appointmentId', 'type', 'title', 'description',
      'date', 'startTime', 'endTime', 'duration', 'allDay',
      'address', 'city', 'state', 'zip',
      'customerName', 'customerPhone', 'customerEmail', 'customerId',
      'assignedTo', 'assignedToName', 'assignedToEmail',
      'jobId', 'jobName',
      'status', 'priority',
      'customerReminderPref', 'repReminderSent', 'customerReminderSent',
      'googleCalendarLink', 'customerGoogleCalendarLink',
      'notes', 'internalNotes',
      'source', 'createdBy', 'createdAt', 'updatedAt',
    ];

    let sheet = doc.sheetsByTitle['Appointments'];
    if (!sheet) {
      sheet = await doc.addSheet({
        title: 'Appointments',
        headerValues: headers,
        gridProperties: { columnCount: headers.length + 5 },
      });
    } else {
      try {
        await sheet.loadHeaderRow();
      } catch {
        await sheet.setHeaderRow(headers);
      }
    }
    return sheet;
  }

  // =========================================================================
  // Create Appointment
  // =========================================================================

  async createAppointment(input: CreateAppointmentInput): Promise<Appointment> {
    const duration = input.duration || DEFAULT_DURATIONS[input.type] || 60;
    const startDateTime = new Date(`${input.date}T${input.startTime}:00`);
    const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 1000);
    const endTime = `${String(endDateTime.getHours()).padStart(2, '0')}:${String(endDateTime.getMinutes()).padStart(2, '0')}`;

    // Resolve team member email
    const assignedToEmail = resolveTeamMemberEmail(input.assignedToName || input.assignedTo) || '';

    // Generate title if not provided
    const title = input.title ||
      `${APPOINTMENT_TYPE_LABELS[input.type]} - ${input.customerName}`;

    // Build full location string
    const locationParts = [input.address, input.city, input.state, input.zip].filter(Boolean);
    const fullLocation = locationParts.join(', ');

    // Build description for Google Calendar
    const descriptionParts: string[] = [];
    descriptionParts.push(`Type: ${APPOINTMENT_TYPE_LABELS[input.type]}`);
    descriptionParts.push(`Customer: ${input.customerName}`);
    if (input.customerPhone) descriptionParts.push(`Phone: ${input.customerPhone}`);
    if (input.assignedToName) descriptionParts.push(`Rep: ${input.assignedToName}`);
    if (input.jobName) descriptionParts.push(`Job: ${input.jobName}`);
    if (input.notes) descriptionParts.push('', `Notes: ${input.notes}`);
    descriptionParts.push('', 'River City Roofing Solutions - (256) 274-8530');

    // Build attendee emails
    const attendeeEmails: string[] = [];
    if (assignedToEmail) attendeeEmails.push(assignedToEmail);
    if (input.customerEmail) attendeeEmails.push(input.customerEmail);

    // Generate Google Calendar link (internal / rep version)
    const googleCalendarLink = generateGoogleCalendarLink({
      title,
      startDate: startDateTime.toISOString(),
      endDate: endDateTime.toISOString(),
      description: descriptionParts.join('\n'),
      location: fullLocation,
      attendeeEmails,
      allDay: input.allDay || false,
    });

    // Generate customer-facing Google Calendar link (no internal notes)
    const customerGoogleCalendarLink = generateGoogleCalendarLink({
      title: `${APPOINTMENT_TYPE_LABELS[input.type]} - River City Roofing`,
      startDate: startDateTime.toISOString(),
      endDate: endDateTime.toISOString(),
      description: [
        `Your ${APPOINTMENT_TYPE_LABELS[input.type].toLowerCase()} with River City Roofing Solutions`,
        fullLocation ? `Location: ${fullLocation}` : '',
        input.assignedToName ? `Your rep: ${input.assignedToName}` : '',
        '',
        'Contact: (256) 274-8530',
      ].filter(Boolean).join('\n'),
      location: fullLocation,
      allDay: input.allDay || false,
    });

    const appointment: Appointment = {
      appointmentId: this.generateId(),
      type: input.type,
      title,
      description: input.description || descriptionParts.join('\n'),
      date: input.date,
      startTime: input.startTime,
      endTime,
      duration,
      allDay: input.allDay || false,
      address: input.address,
      city: input.city || '',
      state: input.state || '',
      zip: input.zip || '',
      customerName: input.customerName,
      customerPhone: input.customerPhone || '',
      customerEmail: input.customerEmail || '',
      customerId: input.customerId || '',
      assignedTo: input.assignedTo || '',
      assignedToName: input.assignedToName || '',
      assignedToEmail,
      jobId: input.jobId || '',
      jobName: input.jobName || '',
      status: 'scheduled',
      priority: input.priority || 'normal',
      customerReminderPref: input.customerReminderPref || 'both',
      repReminderSent: false,
      customerReminderSent: false,
      googleCalendarLink,
      customerGoogleCalendarLink,
      notes: input.notes || '',
      internalNotes: input.internalNotes || '',
      source: input.source || 'portal',
      createdBy: input.createdBy || 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Persist to Google Sheets
    await this.saveAppointment(appointment);

    return appointment;
  }

  // =========================================================================
  // Get Appointments
  // =========================================================================

  async getAppointments(filters?: {
    startDate?: string;
    endDate?: string;
    assignedTo?: string;
    customerId?: string;
    status?: AppointmentStatus;
    type?: AppointmentType;
  }): Promise<Appointment[]> {
    try {
      const sheet = await this.getOrCreateSheet();
      const rows = await sheet.getRows({ limit: 100000 });

      let appointments: Appointment[] = rows.map(row => ({
        appointmentId: row.get('appointmentId') || '',
        type: (row.get('type') || 'other') as AppointmentType,
        title: row.get('title') || '',
        description: row.get('description') || '',
        date: row.get('date') || '',
        startTime: row.get('startTime') || '',
        endTime: row.get('endTime') || '',
        duration: parseInt(row.get('duration') || '60'),
        allDay: row.get('allDay') === 'true',
        address: row.get('address') || '',
        city: row.get('city') || '',
        state: row.get('state') || '',
        zip: row.get('zip') || '',
        customerName: row.get('customerName') || '',
        customerPhone: row.get('customerPhone') || '',
        customerEmail: row.get('customerEmail') || '',
        customerId: row.get('customerId') || '',
        assignedTo: row.get('assignedTo') || '',
        assignedToName: row.get('assignedToName') || '',
        assignedToEmail: row.get('assignedToEmail') || '',
        jobId: row.get('jobId') || '',
        jobName: row.get('jobName') || '',
        status: (row.get('status') || 'scheduled') as AppointmentStatus,
        priority: (row.get('priority') || 'normal') as 'normal' | 'rush' | 'urgent',
        customerReminderPref: (row.get('customerReminderPref') || 'both') as ReminderPreference,
        repReminderSent: row.get('repReminderSent') === 'true',
        customerReminderSent: row.get('customerReminderSent') === 'true',
        googleCalendarLink: row.get('googleCalendarLink') || '',
        customerGoogleCalendarLink: row.get('customerGoogleCalendarLink') || '',
        notes: row.get('notes') || '',
        internalNotes: row.get('internalNotes') || '',
        source: (row.get('source') || 'portal') as Appointment['source'],
        createdBy: row.get('createdBy') || '',
        createdAt: row.get('createdAt') || '',
        updatedAt: row.get('updatedAt') || '',
      }));

      // Apply filters
      if (filters?.startDate) {
        appointments = appointments.filter(a => a.date >= filters.startDate!);
      }
      if (filters?.endDate) {
        appointments = appointments.filter(a => a.date <= filters.endDate!);
      }
      if (filters?.assignedTo) {
        const filterLower = filters.assignedTo.toLowerCase();
        appointments = appointments.filter(a =>
          a.assignedTo.toLowerCase() === filterLower ||
          a.assignedToName.toLowerCase().includes(filterLower)
        );
      }
      if (filters?.customerId) {
        appointments = appointments.filter(a => a.customerId === filters.customerId);
      }
      if (filters?.status) {
        appointments = appointments.filter(a => a.status === filters.status);
      }
      if (filters?.type) {
        appointments = appointments.filter(a => a.type === filters.type);
      }

      // Sort by date + time ascending
      appointments.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.startTime.localeCompare(b.startTime);
      });

      return appointments;
    } catch (error) {
      console.error('Failed to get appointments:', error);
      return [];
    }
  }

  // =========================================================================
  // Get Single Appointment
  // =========================================================================

  async getAppointment(appointmentId: string): Promise<Appointment | null> {
    try {
      const sheet = await this.getOrCreateSheet();
      const rows = await sheet.getRows({ limit: 100000 });
      const row = rows.find(r => r.get('appointmentId') === appointmentId);
      if (!row) return null;

      return {
        appointmentId: row.get('appointmentId'),
        type: row.get('type') as AppointmentType,
        title: row.get('title'),
        description: row.get('description'),
        date: row.get('date'),
        startTime: row.get('startTime'),
        endTime: row.get('endTime'),
        duration: parseInt(row.get('duration') || '60'),
        allDay: row.get('allDay') === 'true',
        address: row.get('address'),
        city: row.get('city'),
        state: row.get('state'),
        zip: row.get('zip'),
        customerName: row.get('customerName'),
        customerPhone: row.get('customerPhone'),
        customerEmail: row.get('customerEmail'),
        customerId: row.get('customerId'),
        assignedTo: row.get('assignedTo'),
        assignedToName: row.get('assignedToName'),
        assignedToEmail: row.get('assignedToEmail'),
        jobId: row.get('jobId'),
        jobName: row.get('jobName'),
        status: row.get('status') as AppointmentStatus,
        priority: row.get('priority') as 'normal' | 'rush' | 'urgent',
        customerReminderPref: row.get('customerReminderPref') as ReminderPreference,
        repReminderSent: row.get('repReminderSent') === 'true',
        customerReminderSent: row.get('customerReminderSent') === 'true',
        googleCalendarLink: row.get('googleCalendarLink'),
        customerGoogleCalendarLink: row.get('customerGoogleCalendarLink'),
        notes: row.get('notes'),
        internalNotes: row.get('internalNotes'),
        source: row.get('source') as Appointment['source'],
        createdBy: row.get('createdBy'),
        createdAt: row.get('createdAt'),
        updatedAt: row.get('updatedAt'),
      };
    } catch {
      return null;
    }
  }

  // =========================================================================
  // Update Appointment
  // =========================================================================

  async updateAppointment(
    appointmentId: string,
    updates: UpdateAppointmentInput
  ): Promise<Appointment | null> {
    try {
      const sheet = await this.getOrCreateSheet();
      const rows = await sheet.getRows({ limit: 100000 });
      const row = rows.find(r => r.get('appointmentId') === appointmentId);
      if (!row) return null;

      // Apply updates
      if (updates.status) row.set('status', updates.status);
      if (updates.date) row.set('date', updates.date);
      if (updates.startTime) row.set('startTime', updates.startTime);
      if (updates.assignedTo) row.set('assignedTo', updates.assignedTo);
      if (updates.assignedToName) row.set('assignedToName', updates.assignedToName);
      if (updates.notes !== undefined) row.set('notes', updates.notes);
      if (updates.internalNotes !== undefined) row.set('internalNotes', updates.internalNotes);
      if (updates.customerReminderPref) row.set('customerReminderPref', updates.customerReminderPref);

      // Recalculate end time if date or startTime changed
      if (updates.startTime || updates.duration) {
        const date = updates.date || row.get('date');
        const startTime = updates.startTime || row.get('startTime');
        const duration = updates.duration || parseInt(row.get('duration') || '60');
        const startDateTime = new Date(`${date}T${startTime}:00`);
        const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 1000);
        const endTime = `${String(endDateTime.getHours()).padStart(2, '0')}:${String(endDateTime.getMinutes()).padStart(2, '0')}`;
        row.set('endTime', endTime);
        if (updates.duration) row.set('duration', String(updates.duration));
      }

      // Regenerate Google Calendar link if scheduling changed
      if (updates.date || updates.startTime || updates.assignedToName) {
        const repEmail = resolveTeamMemberEmail(
          updates.assignedToName || row.get('assignedToName')
        ) || '';
        if (updates.assignedToName) row.set('assignedToEmail', repEmail);

        const date = updates.date || row.get('date');
        const startTime = updates.startTime || row.get('startTime');
        const endTime = row.get('endTime');
        const startDT = new Date(`${date}T${startTime}:00`);
        const endDT = new Date(`${date}T${endTime}:00`);
        const title = row.get('title');
        const location = [row.get('address'), row.get('city'), row.get('state'), row.get('zip')].filter(Boolean).join(', ');

        const attendeeEmails: string[] = [];
        if (repEmail) attendeeEmails.push(repEmail);
        const custEmail = row.get('customerEmail');
        if (custEmail) attendeeEmails.push(custEmail);

        const gcalLink = generateGoogleCalendarLink({
          title,
          startDate: startDT.toISOString(),
          endDate: endDT.toISOString(),
          description: row.get('description'),
          location,
          attendeeEmails,
        });
        row.set('googleCalendarLink', gcalLink);
      }

      row.set('updatedAt', new Date().toISOString());
      await row.save();

      return this.getAppointment(appointmentId);
    } catch (error) {
      console.error('Failed to update appointment:', error);
      return null;
    }
  }

  // =========================================================================
  // Persistence
  // =========================================================================

  private async saveAppointment(appointment: Appointment): Promise<void> {
    try {
      const sheet = await this.getOrCreateSheet();
      await sheet.addRow(
        appointment as unknown as Record<string, string | number | boolean>
      );
    } catch (error) {
      console.error('Failed to save appointment:', error);
    }
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  private generateId(): string {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `APT-${dateStr}-${random}`;
  }
}

export const appointmentService = new AppointmentService();
