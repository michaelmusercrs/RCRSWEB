// Appointment Sync Service
// Syncs appointments between app, JobNimbus tasks, and Google Calendar
// Currently supports JN task read + Google Calendar link generation
//
// COST-PRIVACY: tasks/appointments don't carry cost fields, but the
// underlying JN read still threads the viewer for consistency.

import { jobNimbusService } from './jobnimbus-service';
import type { JNViewer } from './jn-redact';

export interface Appointment {
  id: string;
  title: string;
  description?: string;
  startDate: string; // ISO string
  endDate?: string;
  location?: string;
  type: 'inspection' | 'install' | 'follow_up' | 'meeting' | 'other';
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';
  assignedTo: string; // rep slug
  customerId?: string;
  customerName?: string;
  jobnimbusTaskId?: string;
  createdAt: string;
  updatedAt: string;
}

class AppointmentSyncService {
  // Get appointments for a contact from JobNimbus
  async getAppointmentsForContact(contactJnid: string, viewer?: JNViewer): Promise<Appointment[]> {
    try {
      const tasks = await jobNimbusService.getTasksForContact(contactJnid, viewer);

      return tasks
        .filter(t => t.date_start) // Only tasks with dates
        .map(task => ({
          id: task.jnid,
          title: task.title || 'Appointment',
          description: task.description,
          startDate: task.date_start ? new Date(task.date_start * 1000).toISOString() : '',
          endDate: task.date_end ? new Date(task.date_end * 1000).toISOString() : undefined,
          location: undefined,
          type: this.inferType(task.title, task.type),
          status: this.mapStatus(task.status),
          assignedTo: task.assigned_to?.[0] || '',
          jobnimbusTaskId: task.jnid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));
    } catch (error) {
      console.error('Error fetching appointments:', error);
      return [];
    }
  }

  // Generate Google Calendar link for an appointment
  generateGoogleCalendarLink(appointment: {
    title: string;
    description?: string;
    startDate: string;
    endDate?: string;
    location?: string;
  }): string {
    const params = new URLSearchParams();
    params.set('action', 'TEMPLATE');
    params.set('text', appointment.title);

    if (appointment.description) {
      params.set('details', appointment.description);
    }
    if (appointment.location) {
      params.set('location', appointment.location);
    }

    // Format dates for Google Calendar (YYYYMMDDTHHmmssZ)
    const start = new Date(appointment.startDate);
    const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

    params.set('dates', `${formatDate(start)}/${formatDate(
      appointment.endDate ? new Date(appointment.endDate) : new Date(start.getTime() + 60 * 60 * 1000)
    )}`);

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  // Generate reminder dates for an appointment
  generateReminders(startDate: string): { label: string; date: string }[] {
    const start = new Date(startDate);
    return [
      { label: '1 day before', date: new Date(start.getTime() - 24 * 60 * 60 * 1000).toISOString() },
      { label: '3 days before', date: new Date(start.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString() },
      { label: '1 week before', date: new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString() },
      { label: '1 month before', date: new Date(start.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString() },
    ].filter(r => new Date(r.date) > new Date()); // Only future reminders
  }

  private inferType(title?: string, taskType?: string): Appointment['type'] {
    const t = (title || '').toLowerCase();
    const tt = (taskType || '').toLowerCase();
    if (t.includes('inspect') || tt.includes('inspect')) return 'inspection';
    if (t.includes('install') || tt.includes('install')) return 'install';
    if (t.includes('follow') || tt.includes('follow')) return 'follow_up';
    if (t.includes('meet') || tt.includes('meet')) return 'meeting';
    return 'other';
  }

  private mapStatus(status?: string): Appointment['status'] {
    const s = (status || '').toLowerCase();
    if (s.includes('complete') || s.includes('done')) return 'completed';
    if (s.includes('cancel')) return 'cancelled';
    if (s.includes('reschedule')) return 'rescheduled';
    if (s.includes('confirm')) return 'confirmed';
    return 'scheduled';
  }
}

export const appointmentSyncService = new AppointmentSyncService();
