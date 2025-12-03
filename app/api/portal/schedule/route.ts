import { NextRequest, NextResponse } from 'next/server';
import { schedulingService, EventType, EventStatus, GPSLocation } from '@/lib/scheduling-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'events-for-date': {
        const date = searchParams.get('date');
        const driverId = searchParams.get('driverId');

        if (!date) {
          return NextResponse.json({ error: 'Date is required' }, { status: 400 });
        }

        const events = await schedulingService.getEventsForDate(date, driverId || undefined);
        return NextResponse.json({ events });
      }

      case 'events-for-week': {
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const driverId = searchParams.get('driverId');

        if (!startDate || !endDate) {
          return NextResponse.json({ error: 'Start and end dates are required' }, { status: 400 });
        }

        const events = await schedulingService.getEventsForWeek(startDate, endDate, driverId || undefined);
        return NextResponse.json({ events });
      }

      case 'daily-route': {
        const driverId = searchParams.get('driverId');
        const date = searchParams.get('date');

        if (!driverId || !date) {
          return NextResponse.json({ error: 'Driver ID and date are required' }, { status: 400 });
        }

        const route = await schedulingService.getDailyRoute(driverId, date);
        return NextResponse.json({ route });
      }

      case 'calendar-month': {
        const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
        const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());

        const calendar = await schedulingService.getCalendarMonth(year, month);
        // Convert Map to object for JSON serialization
        const calendarObj: Record<string, any[]> = {};
        calendar.forEach((events, date) => {
          calendarObj[date] = events;
        });

        return NextResponse.json({ calendar: calendarObj });
      }

      case 'driver-schedule': {
        const driverId = searchParams.get('driverId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        if (!driverId || !startDate || !endDate) {
          return NextResponse.json({ error: 'Driver ID, start date, and end date are required' }, { status: 400 });
        }

        const events = await schedulingService.getDriverSchedule(driverId, startDate, endDate);
        return NextResponse.json({ events });
      }

      case 'gps-activity': {
        const ticketId = searchParams.get('ticketId');

        if (!ticketId) {
          return NextResponse.json({ error: 'Ticket ID is required' }, { status: 400 });
        }

        const activities = await schedulingService.getGPSActivityForTicket(ticketId);
        return NextResponse.json({ activities });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Schedule API GET error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'create-event': {
        const event = await schedulingService.createEvent({
          eventType: data.eventType as EventType,
          ticketId: data.ticketId,
          jobId: data.jobId,
          jobName: data.jobName,
          jobAddress: data.jobAddress,
          city: data.city,
          state: data.state,
          zip: data.zip,
          scheduledDate: data.scheduledDate,
          scheduledTime: data.scheduledTime,
          estimatedDuration: data.estimatedDuration,
          assignedTo: data.assignedTo,
          assignedToName: data.assignedToName,
          assignedByName: data.assignedByName,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          projectManager: data.projectManager,
          priority: data.priority,
          notes: data.notes,
          createdBy: data.createdBy,
          gpsLatitude: data.gpsLatitude,
          gpsLongitude: data.gpsLongitude
        });

        return NextResponse.json({ success: true, event });
      }

      case 'update-event-status': {
        const gpsLocation: GPSLocation | undefined = data.gpsLatitude && data.gpsLongitude
          ? {
              latitude: data.gpsLatitude,
              longitude: data.gpsLongitude,
              accuracy: data.gpsAccuracy,
              timestamp: new Date().toISOString(),
              address: data.gpsAddress
            }
          : undefined;

        const event = await schedulingService.updateEventStatus(
          data.eventId,
          data.newStatus as EventStatus,
          data.userId,
          data.userName,
          gpsLocation,
          data.notes
        );

        if (!event) {
          return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, event });
      }

      case 'optimize-route': {
        const route = await schedulingService.optimizeRoute(data.driverId, data.date);
        return NextResponse.json({ success: true, route });
      }

      case 'log-gps-activity': {
        const log = await schedulingService.logGPSActivity({
          eventId: data.eventId,
          ticketId: data.ticketId,
          activityType: data.activityType,
          userId: data.userId,
          userName: data.userName,
          gpsLatitude: data.gpsLatitude,
          gpsLongitude: data.gpsLongitude,
          gpsAccuracy: data.gpsAccuracy,
          gpsAddress: data.gpsAddress,
          description: data.description,
          photoUrls: data.photoUrls
        });

        return NextResponse.json({ success: true, log });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Schedule API POST error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
