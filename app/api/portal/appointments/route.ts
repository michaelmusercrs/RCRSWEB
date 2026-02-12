// Appointments API
// GET: Get appointments for a customer contact
// POST: Generate Google Calendar link for an appointment

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { appointmentSyncService } from '@/lib/appointment-sync-service';
import { notificationService } from '@/lib/notification-service';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contactId');

    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'contactId parameter required' },
        { status: 400 }
      );
    }

    const appointments = await appointmentSyncService.getAppointmentsForContact(contactId);

    return NextResponse.json({
      success: true,
      count: appointments.length,
      data: appointments,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { title, description, startDate, endDate, location, repSlug, customerId, customerName } = await request.json();

    if (!title || !startDate) {
      return NextResponse.json(
        { success: false, error: 'title and startDate are required' },
        { status: 400 }
      );
    }

    const calendarLink = appointmentSyncService.generateGoogleCalendarLink({
      title,
      description,
      startDate,
      endDate,
      location,
    });

    const reminders = appointmentSyncService.generateReminders(startDate);

    // Send appointment reminder notification via preference cascade (fire-and-forget)
    if (repSlug) {
      const startDateObj = new Date(startDate);
      notificationService.notifyAppointmentReminder({
        repSlug,
        customerId: customerId || undefined,
        customerName: customerName || 'Customer',
        appointmentType: title,
        scheduledDate: startDateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        scheduledTime: startDateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        address: location || 'TBD',
      }).catch(err => {
        console.warn('[Appointments] Notification send failed:', err);
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        calendarLink,
        reminders,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
