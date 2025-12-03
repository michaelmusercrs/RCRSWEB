import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// Calendar Event Types
export type EventType = 'delivery' | 'pickup' | 'return' | 'inspection' | 'meeting' | 'other';
export type EventStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'rescheduled';

export interface ScheduledEvent {
  eventId: string;
  eventType: EventType;
  ticketId?: string;
  jobId?: string;
  jobName: string;
  jobAddress: string;
  city: string;
  state: string;
  zip: string;

  // Scheduling
  scheduledDate: string;
  scheduledTime: string;
  estimatedDuration: number; // minutes
  actualStartTime?: string;
  actualEndTime?: string;

  // Assignment
  assignedTo: string; // Driver ID or staff ID
  assignedToName: string;
  assignedByName: string;

  // Route info
  routeOrder?: number;
  distanceFromPrevious?: number; // miles
  estimatedArrival?: string;

  // GPS
  gpsLatitude?: number;
  gpsLongitude?: number;

  // Status
  status: EventStatus;
  statusHistory: EventStatusChange[];

  // Details
  customerName: string;
  customerPhone: string;
  projectManager: string;
  priority: 'normal' | 'rush' | 'urgent';
  notes: string;

  // Tracking
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export interface EventStatusChange {
  fromStatus: EventStatus;
  toStatus: EventStatus;
  changedBy: string;
  changedByName: string;
  changedAt: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  notes?: string;
}

export interface DailyRoute {
  routeId: string;
  driverId: string;
  driverName: string;
  date: string;

  // Route details
  events: ScheduledEvent[];
  totalStops: number;
  totalDistance: number; // miles
  estimatedTotalTime: number; // minutes

  // Optimization
  isOptimized: boolean;
  optimizedAt?: string;
  startLocation: string;
  endLocation: string;

  // Status
  status: 'planned' | 'in_progress' | 'completed';
  startedAt?: string;
  completedAt?: string;
}

export interface GPSLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
  address?: string;
}

export interface GPSActivityLog {
  logId: string;
  eventId?: string;
  ticketId?: string;
  activityType: string;
  userId: string;
  userName: string;

  // GPS
  gpsLatitude: number;
  gpsLongitude: number;
  gpsAccuracy?: number;
  gpsAddress?: string;

  // Activity details
  description: string;
  photoUrls?: string[];

  createdAt: string;
}

// Warehouse location (your base)
const WAREHOUSE_LOCATION = {
  address: '123 Warehouse Dr, Huntsville, AL 35801',
  latitude: 34.7304,
  longitude: -86.5861
};

class SchedulingService {
  private doc: GoogleSpreadsheet | null = null;
  private initialized = false;

  private async getDoc(): Promise<GoogleSpreadsheet> {
    if (this.doc && this.initialized) {
      return this.doc;
    }

    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const sheetId = process.env.GOOGLE_SHEET_ID;

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

  private async getOrCreateSheet(sheetName: string, headers: string[]) {
    const doc = await this.getDoc();
    let sheet = doc.sheetsByTitle[sheetName];

    if (!sheet) {
      sheet = await doc.addSheet({ title: sheetName, headerValues: headers });
    }

    return sheet;
  }

  // ============ CALENDAR EVENTS ============

  async createEvent(data: {
    eventType: EventType;
    ticketId?: string;
    jobId?: string;
    jobName: string;
    jobAddress: string;
    city: string;
    state: string;
    zip: string;
    scheduledDate: string;
    scheduledTime: string;
    estimatedDuration?: number;
    assignedTo: string;
    assignedToName: string;
    assignedByName: string;
    customerName: string;
    customerPhone: string;
    projectManager: string;
    priority?: 'normal' | 'rush' | 'urgent';
    notes?: string;
    createdBy: string;
    gpsLatitude?: number;
    gpsLongitude?: number;
  }): Promise<ScheduledEvent> {
    const sheet = await this.getOrCreateSheet('Calendar_Events', [
      'eventId', 'eventType', 'ticketId', 'jobId', 'jobName', 'jobAddress',
      'city', 'state', 'zip', 'scheduledDate', 'scheduledTime', 'estimatedDuration',
      'actualStartTime', 'actualEndTime', 'assignedTo', 'assignedToName',
      'assignedByName', 'routeOrder', 'distanceFromPrevious', 'estimatedArrival',
      'gpsLatitude', 'gpsLongitude', 'status', 'statusHistory', 'customerName',
      'customerPhone', 'projectManager', 'priority', 'notes', 'createdAt',
      'createdBy', 'updatedAt'
    ]);

    const eventId = `EVT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const now = new Date().toISOString();

    const event: ScheduledEvent = {
      eventId,
      eventType: data.eventType,
      ticketId: data.ticketId,
      jobId: data.jobId,
      jobName: data.jobName,
      jobAddress: data.jobAddress,
      city: data.city,
      state: data.state,
      zip: data.zip,
      scheduledDate: data.scheduledDate,
      scheduledTime: data.scheduledTime,
      estimatedDuration: data.estimatedDuration || 30,
      assignedTo: data.assignedTo,
      assignedToName: data.assignedToName,
      assignedByName: data.assignedByName,
      gpsLatitude: data.gpsLatitude,
      gpsLongitude: data.gpsLongitude,
      status: 'scheduled',
      statusHistory: [{
        fromStatus: 'scheduled',
        toStatus: 'scheduled',
        changedBy: data.createdBy,
        changedByName: data.assignedByName,
        changedAt: now,
        notes: 'Event created'
      }],
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      projectManager: data.projectManager,
      priority: data.priority || 'normal',
      notes: data.notes || '',
      createdAt: now,
      createdBy: data.createdBy,
      updatedAt: now
    };

    await sheet.addRow({
      ...event,
      statusHistory: JSON.stringify(event.statusHistory)
    });

    // Log GPS activity
    if (data.gpsLatitude && data.gpsLongitude) {
      await this.logGPSActivity({
        eventId,
        ticketId: data.ticketId,
        activityType: 'event_created',
        userId: data.createdBy,
        userName: data.assignedByName,
        gpsLatitude: data.gpsLatitude,
        gpsLongitude: data.gpsLongitude,
        description: `Event scheduled: ${data.eventType} for ${data.jobName}`
      });
    }

    return event;
  }

  async updateEventStatus(
    eventId: string,
    newStatus: EventStatus,
    userId: string,
    userName: string,
    gpsLocation?: GPSLocation,
    notes?: string
  ): Promise<ScheduledEvent | null> {
    const sheet = await this.getOrCreateSheet('Calendar_Events', []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('eventId') === eventId);

    if (!row) return null;

    const oldStatus = row.get('status') as EventStatus;
    const now = new Date().toISOString();

    const statusHistory = JSON.parse(row.get('statusHistory') || '[]');
    statusHistory.push({
      fromStatus: oldStatus,
      toStatus: newStatus,
      changedBy: userId,
      changedByName: userName,
      changedAt: now,
      gpsLatitude: gpsLocation?.latitude,
      gpsLongitude: gpsLocation?.longitude,
      notes
    });

    row.set('status', newStatus);
    row.set('statusHistory', JSON.stringify(statusHistory));
    row.set('updatedAt', now);

    if (newStatus === 'in_progress' && !row.get('actualStartTime')) {
      row.set('actualStartTime', now);
    }
    if (newStatus === 'completed' && !row.get('actualEndTime')) {
      row.set('actualEndTime', now);
    }

    await row.save();

    // Log GPS activity
    if (gpsLocation) {
      await this.logGPSActivity({
        eventId,
        ticketId: row.get('ticketId'),
        activityType: `status_${newStatus}`,
        userId,
        userName,
        gpsLatitude: gpsLocation.latitude,
        gpsLongitude: gpsLocation.longitude,
        gpsAccuracy: gpsLocation.accuracy,
        description: `Status changed to ${newStatus}${notes ? `: ${notes}` : ''}`
      });
    }

    return this.rowToEvent(row);
  }

  async getEventsForDate(date: string, driverId?: string): Promise<ScheduledEvent[]> {
    const sheet = await this.getOrCreateSheet('Calendar_Events', []);
    const rows = await sheet.getRows();

    let events = rows
      .filter(r => r.get('scheduledDate') === date)
      .map(r => this.rowToEvent(r));

    if (driverId) {
      events = events.filter(e => e.assignedTo === driverId);
    }

    // Sort by scheduled time
    events.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

    return events;
  }

  async getEventsForWeek(startDate: string, endDate: string, driverId?: string): Promise<ScheduledEvent[]> {
    const sheet = await this.getOrCreateSheet('Calendar_Events', []);
    const rows = await sheet.getRows();

    let events = rows
      .filter(r => {
        const eventDate = r.get('scheduledDate');
        return eventDate >= startDate && eventDate <= endDate;
      })
      .map(r => this.rowToEvent(r));

    if (driverId) {
      events = events.filter(e => e.assignedTo === driverId);
    }

    return events;
  }

  private rowToEvent(row: any): ScheduledEvent {
    return {
      eventId: row.get('eventId'),
      eventType: row.get('eventType') as EventType,
      ticketId: row.get('ticketId'),
      jobId: row.get('jobId'),
      jobName: row.get('jobName'),
      jobAddress: row.get('jobAddress'),
      city: row.get('city'),
      state: row.get('state'),
      zip: row.get('zip'),
      scheduledDate: row.get('scheduledDate'),
      scheduledTime: row.get('scheduledTime'),
      estimatedDuration: parseInt(row.get('estimatedDuration')) || 30,
      actualStartTime: row.get('actualStartTime'),
      actualEndTime: row.get('actualEndTime'),
      assignedTo: row.get('assignedTo'),
      assignedToName: row.get('assignedToName'),
      assignedByName: row.get('assignedByName'),
      routeOrder: parseInt(row.get('routeOrder')) || undefined,
      distanceFromPrevious: parseFloat(row.get('distanceFromPrevious')) || undefined,
      estimatedArrival: row.get('estimatedArrival'),
      gpsLatitude: parseFloat(row.get('gpsLatitude')) || undefined,
      gpsLongitude: parseFloat(row.get('gpsLongitude')) || undefined,
      status: row.get('status') as EventStatus,
      statusHistory: JSON.parse(row.get('statusHistory') || '[]'),
      customerName: row.get('customerName'),
      customerPhone: row.get('customerPhone'),
      projectManager: row.get('projectManager'),
      priority: row.get('priority') as 'normal' | 'rush' | 'urgent',
      notes: row.get('notes'),
      createdAt: row.get('createdAt'),
      createdBy: row.get('createdBy'),
      updatedAt: row.get('updatedAt')
    };
  }

  // ============ ROUTE OPTIMIZATION ============

  async optimizeRoute(driverId: string, date: string): Promise<DailyRoute> {
    const events = await this.getEventsForDate(date, driverId);

    if (events.length === 0) {
      throw new Error('No events found for optimization');
    }

    // Get coordinates for all events (geocode addresses if needed)
    const eventsWithCoords = await Promise.all(events.map(async (event) => {
      if (!event.gpsLatitude || !event.gpsLongitude) {
        // Geocode the address (simplified - would use actual geocoding API)
        const coords = await this.geocodeAddress(
          `${event.jobAddress}, ${event.city}, ${event.state} ${event.zip}`
        );
        event.gpsLatitude = coords.latitude;
        event.gpsLongitude = coords.longitude;
      }
      return event;
    }));

    // Simple nearest-neighbor algorithm for route optimization
    const optimizedEvents = this.nearestNeighborOptimization(
      eventsWithCoords,
      WAREHOUSE_LOCATION.latitude,
      WAREHOUSE_LOCATION.longitude
    );

    // Calculate distances and update route order
    let totalDistance = 0;
    let totalTime = 0;
    let prevLat = WAREHOUSE_LOCATION.latitude;
    let prevLng = WAREHOUSE_LOCATION.longitude;
    let currentTime = this.parseTime(optimizedEvents[0]?.scheduledTime || '08:00');

    for (let i = 0; i < optimizedEvents.length; i++) {
      const event = optimizedEvents[i];
      const distance = this.calculateDistance(
        prevLat, prevLng,
        event.gpsLatitude!, event.gpsLongitude!
      );

      totalDistance += distance;
      const travelTime = Math.round(distance / 30 * 60); // Assume 30 mph average
      totalTime += travelTime + event.estimatedDuration;

      event.routeOrder = i + 1;
      event.distanceFromPrevious = Math.round(distance * 10) / 10;

      currentTime += travelTime;
      event.estimatedArrival = this.formatTime(currentTime);
      currentTime += event.estimatedDuration;

      prevLat = event.gpsLatitude!;
      prevLng = event.gpsLongitude!;

      // Update in sheet
      await this.updateEventRoute(event.eventId, {
        routeOrder: event.routeOrder,
        distanceFromPrevious: event.distanceFromPrevious,
        estimatedArrival: event.estimatedArrival,
        gpsLatitude: event.gpsLatitude,
        gpsLongitude: event.gpsLongitude
      });
    }

    // Create/update daily route record
    const route: DailyRoute = {
      routeId: `RTE-${driverId}-${date}`,
      driverId,
      driverName: optimizedEvents[0]?.assignedToName || 'Unknown',
      date,
      events: optimizedEvents,
      totalStops: optimizedEvents.length,
      totalDistance: Math.round(totalDistance * 10) / 10,
      estimatedTotalTime: totalTime,
      isOptimized: true,
      optimizedAt: new Date().toISOString(),
      startLocation: WAREHOUSE_LOCATION.address,
      endLocation: WAREHOUSE_LOCATION.address,
      status: 'planned'
    };

    await this.saveDailyRoute(route);

    return route;
  }

  private nearestNeighborOptimization(
    events: ScheduledEvent[],
    startLat: number,
    startLng: number
  ): ScheduledEvent[] {
    const remaining = [...events];
    const optimized: ScheduledEvent[] = [];
    let currentLat = startLat;
    let currentLng = startLng;

    // Prioritize urgent items first
    remaining.sort((a, b) => {
      const priorityOrder = { urgent: 0, rush: 1, normal: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // Take urgent/rush items first in their order
    const urgent = remaining.filter(e => e.priority === 'urgent');
    const rush = remaining.filter(e => e.priority === 'rush');
    const normal = remaining.filter(e => e.priority === 'normal');

    // For normal priority, use nearest neighbor
    while (normal.length > 0) {
      let nearestIdx = 0;
      let nearestDist = Infinity;

      for (let i = 0; i < normal.length; i++) {
        const dist = this.calculateDistance(
          currentLat, currentLng,
          normal[i].gpsLatitude!, normal[i].gpsLongitude!
        );
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIdx = i;
        }
      }

      const nearest = normal.splice(nearestIdx, 1)[0];
      optimized.push(nearest);
      currentLat = nearest.gpsLatitude!;
      currentLng = nearest.gpsLongitude!;
    }

    // Return urgent first, then rush, then optimized normal
    return [...urgent, ...rush, ...optimized];
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    // Haversine formula for distance in miles
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * Math.PI / 180;
  }

  private parseTime(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private formatTime(minutes: number): string {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  private async geocodeAddress(address: string): Promise<{ latitude: number; longitude: number }> {
    // Simplified geocoding - in production, use Google Maps Geocoding API
    // For Huntsville area, return approximate coordinates based on zip
    const zipCoords: Record<string, { lat: number; lng: number }> = {
      '35801': { lat: 34.7304, lng: -86.5861 },
      '35802': { lat: 34.6977, lng: -86.5500 },
      '35803': { lat: 34.6523, lng: -86.5336 },
      '35805': { lat: 34.7465, lng: -86.6089 },
      '35806': { lat: 34.7854, lng: -86.6531 },
      '35810': { lat: 34.7954, lng: -86.5561 },
      '35816': { lat: 34.7154, lng: -86.5261 },
      '35824': { lat: 34.6254, lng: -86.6761 },
      '35758': { lat: 34.7126, lng: -86.7483 }, // Madison
      '35601': { lat: 34.6059, lng: -86.9833 }, // Decatur
    };

    const zipMatch = address.match(/\d{5}/);
    if (zipMatch && zipCoords[zipMatch[0]]) {
      const coords = zipCoords[zipMatch[0]];
      // Add small random offset for variety
      return {
        latitude: coords.lat + (Math.random() - 0.5) * 0.02,
        longitude: coords.lng + (Math.random() - 0.5) * 0.02
      };
    }

    // Default to Huntsville center
    return { latitude: 34.7304, longitude: -86.5861 };
  }

  private async updateEventRoute(eventId: string, data: {
    routeOrder?: number;
    distanceFromPrevious?: number;
    estimatedArrival?: string;
    gpsLatitude?: number;
    gpsLongitude?: number;
  }): Promise<void> {
    const sheet = await this.getOrCreateSheet('Calendar_Events', []);
    const rows = await sheet.getRows();
    const row = rows.find(r => r.get('eventId') === eventId);

    if (row) {
      if (data.routeOrder !== undefined) row.set('routeOrder', data.routeOrder.toString());
      if (data.distanceFromPrevious !== undefined) row.set('distanceFromPrevious', data.distanceFromPrevious.toString());
      if (data.estimatedArrival) row.set('estimatedArrival', data.estimatedArrival);
      if (data.gpsLatitude !== undefined) row.set('gpsLatitude', data.gpsLatitude.toString());
      if (data.gpsLongitude !== undefined) row.set('gpsLongitude', data.gpsLongitude.toString());
      row.set('updatedAt', new Date().toISOString());
      await row.save();
    }
  }

  private async saveDailyRoute(route: DailyRoute): Promise<void> {
    const sheet = await this.getOrCreateSheet('Daily_Routes', [
      'routeId', 'driverId', 'driverName', 'date', 'events', 'totalStops',
      'totalDistance', 'estimatedTotalTime', 'isOptimized', 'optimizedAt',
      'startLocation', 'endLocation', 'status', 'startedAt', 'completedAt'
    ]);

    const rows = await sheet.getRows();
    const existingRow = rows.find(r => r.get('routeId') === route.routeId);

    const rowData = {
      routeId: route.routeId,
      driverId: route.driverId,
      driverName: route.driverName,
      date: route.date,
      events: JSON.stringify(route.events.map(e => e.eventId)),
      totalStops: route.totalStops.toString(),
      totalDistance: route.totalDistance.toString(),
      estimatedTotalTime: route.estimatedTotalTime.toString(),
      isOptimized: route.isOptimized.toString(),
      optimizedAt: route.optimizedAt || '',
      startLocation: route.startLocation,
      endLocation: route.endLocation,
      status: route.status,
      startedAt: route.startedAt || '',
      completedAt: route.completedAt || ''
    };

    if (existingRow) {
      Object.entries(rowData).forEach(([key, value]) => {
        existingRow.set(key, value);
      });
      await existingRow.save();
    } else {
      await sheet.addRow(rowData);
    }
  }

  async getDailyRoute(driverId: string, date: string): Promise<DailyRoute | null> {
    const sheet = await this.getOrCreateSheet('Daily_Routes', []);
    const rows = await sheet.getRows();
    const routeId = `RTE-${driverId}-${date}`;
    const row = rows.find(r => r.get('routeId') === routeId);

    if (!row) return null;

    const events = await this.getEventsForDate(date, driverId);

    return {
      routeId: row.get('routeId'),
      driverId: row.get('driverId'),
      driverName: row.get('driverName'),
      date: row.get('date'),
      events,
      totalStops: parseInt(row.get('totalStops')) || 0,
      totalDistance: parseFloat(row.get('totalDistance')) || 0,
      estimatedTotalTime: parseInt(row.get('estimatedTotalTime')) || 0,
      isOptimized: row.get('isOptimized') === 'true',
      optimizedAt: row.get('optimizedAt'),
      startLocation: row.get('startLocation'),
      endLocation: row.get('endLocation'),
      status: row.get('status') as 'planned' | 'in_progress' | 'completed',
      startedAt: row.get('startedAt'),
      completedAt: row.get('completedAt')
    };
  }

  // ============ GPS ACTIVITY LOGGING ============

  async logGPSActivity(data: {
    eventId?: string;
    ticketId?: string;
    activityType: string;
    userId: string;
    userName: string;
    gpsLatitude: number;
    gpsLongitude: number;
    gpsAccuracy?: number;
    gpsAddress?: string;
    description: string;
    photoUrls?: string[];
  }): Promise<GPSActivityLog> {
    const sheet = await this.getOrCreateSheet('GPS_Activity_Log', [
      'logId', 'eventId', 'ticketId', 'activityType', 'userId', 'userName',
      'gpsLatitude', 'gpsLongitude', 'gpsAccuracy', 'gpsAddress',
      'description', 'photoUrls', 'createdAt'
    ]);

    const logId = `GPS-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const now = new Date().toISOString();

    const log: GPSActivityLog = {
      logId,
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
      photoUrls: data.photoUrls,
      createdAt: now
    };

    await sheet.addRow({
      ...log,
      photoUrls: JSON.stringify(log.photoUrls || [])
    });

    return log;
  }

  async getGPSActivityForTicket(ticketId: string): Promise<GPSActivityLog[]> {
    const sheet = await this.getOrCreateSheet('GPS_Activity_Log', []);
    const rows = await sheet.getRows();

    return rows
      .filter(r => r.get('ticketId') === ticketId)
      .map(r => ({
        logId: r.get('logId'),
        eventId: r.get('eventId'),
        ticketId: r.get('ticketId'),
        activityType: r.get('activityType'),
        userId: r.get('userId'),
        userName: r.get('userName'),
        gpsLatitude: parseFloat(r.get('gpsLatitude')),
        gpsLongitude: parseFloat(r.get('gpsLongitude')),
        gpsAccuracy: parseFloat(r.get('gpsAccuracy')) || undefined,
        gpsAddress: r.get('gpsAddress'),
        description: r.get('description'),
        photoUrls: JSON.parse(r.get('photoUrls') || '[]'),
        createdAt: r.get('createdAt')
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // ============ CALENDAR VIEWS ============

  async getCalendarMonth(year: number, month: number): Promise<Map<string, ScheduledEvent[]>> {
    const startDate = `${year}-${(month).toString().padStart(2, '0')}-01`;
    const endDate = `${year}-${(month).toString().padStart(2, '0')}-31`;

    const sheet = await this.getOrCreateSheet('Calendar_Events', []);
    const rows = await sheet.getRows();

    const calendar = new Map<string, ScheduledEvent[]>();

    rows.forEach(row => {
      const eventDate = row.get('scheduledDate');
      if (eventDate >= startDate && eventDate <= endDate) {
        const event = this.rowToEvent(row);
        const existing = calendar.get(eventDate) || [];
        existing.push(event);
        calendar.set(eventDate, existing);
      }
    });

    return calendar;
  }

  async getDriverSchedule(driverId: string, startDate: string, endDate: string): Promise<ScheduledEvent[]> {
    return this.getEventsForWeek(startDate, endDate, driverId);
  }
}

export const schedulingService = new SchedulingService();
