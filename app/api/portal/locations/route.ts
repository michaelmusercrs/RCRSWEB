import { NextRequest, NextResponse } from 'next/server';
import {
  locationLogs,
  getLogsByUser,
  getLogsByDate,
  getLogsByJobNumber,
  getLogsByActivity,
  getRecentLogs,
  getTodaysLogs,
  getUserRoute,
  getActiveUsers,
  getUserTravelDistance,
  LocationLog
} from '@/lib/locationLogs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const date = searchParams.get('date');
    const jobNumber = searchParams.get('jobNumber');
    const activity = searchParams.get('activity') as LocationLog['activity'] | null;
    const recent = searchParams.get('recent');
    const today = searchParams.get('today');
    const route = searchParams.get('route');
    const active = searchParams.get('active');
    const distance = searchParams.get('distance');

    // Get active users with last location
    if (active === 'true') {
      const users = getActiveUsers();
      return NextResponse.json(users);
    }

    // Get user's route for a date
    if (route && userId && date) {
      const userRoute = getUserRoute(userId, date);
      const totalDistance = getUserTravelDistance(userId, date);
      return NextResponse.json({
        route: userRoute,
        totalDistance: Math.round(totalDistance * 10) / 10 // round to 1 decimal
      });
    }

    // Get user's travel distance
    if (distance && userId && date) {
      const totalDistance = getUserTravelDistance(userId, date);
      return NextResponse.json({
        userId,
        date,
        distanceMiles: Math.round(totalDistance * 10) / 10
      });
    }

    // Get logs by user
    if (userId) {
      const logs = getLogsByUser(userId);
      return NextResponse.json(logs);
    }

    // Get logs by date
    if (date) {
      const logs = getLogsByDate(date);
      return NextResponse.json(logs);
    }

    // Get logs by job number
    if (jobNumber) {
      const logs = getLogsByJobNumber(jobNumber);
      return NextResponse.json(logs);
    }

    // Get logs by activity
    if (activity) {
      const logs = getLogsByActivity(activity);
      return NextResponse.json(logs);
    }

    // Get recent logs
    if (recent) {
      const limit = parseInt(recent) || 50;
      const logs = getRecentLogs(limit);
      return NextResponse.json(logs);
    }

    // Get today's logs
    if (today === 'true') {
      const logs = getTodaysLogs();
      return NextResponse.json(logs);
    }

    // Return all logs with active users
    return NextResponse.json({
      logs: getRecentLogs(100),
      activeUsers: getActiveUsers(),
      total: locationLogs.length
    });

  } catch (error) {
    console.error('Error fetching location logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch location logs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { action, ...params } = data;

    switch (action) {
      case 'log':
        // Create new location log
        const newLog: LocationLog = {
          logId: `LOC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
          userId: params.userId,
          userName: params.userName,
          timestamp: new Date().toISOString(),
          latitude: params.latitude,
          longitude: params.longitude,
          accuracy: params.accuracy || 10,
          address: params.address,
          city: params.city,
          state: params.state,
          activity: params.activity,
          relatedJobNumber: params.jobNumber,
          relatedTaskId: params.taskId,
          notes: params.notes,
          deviceInfo: params.deviceInfo
        };

        return NextResponse.json({ success: true, log: newLog });

      case 'getRoute':
        const route = getUserRoute(params.userId, params.date);
        const distance = getUserTravelDistance(params.userId, params.date);
        return NextResponse.json({
          route,
          totalDistance: Math.round(distance * 10) / 10
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error processing location request:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
