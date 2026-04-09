// Location/GPS Logs Data
// Last Updated: December 2025

export interface LocationLog {
  logId: string;
  userId: string;
  userName: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  accuracy: number; // in meters
  address?: string;
  city?: string;
  state?: string;
  activity: 'login' | 'delivery_start' | 'delivery_arrive' | 'delivery_complete' | 'inspection' | 'check_in' | 'check_out' | 'break' | 'manual';
  relatedJobNumber?: string;
  relatedTaskId?: string;
  notes?: string;
  deviceInfo?: string;
}

// Location logs are written by the GPS check-in flow at runtime. Empty here.
// Previous hardcoded sample data ("Smith Commercial", "Williams residence")
// was placeholder content removed per the no-fake-data rule.
export const locationLogs: LocationLog[] = [];

// Helper functions
export function getLogsByUser(userId: string): LocationLog[] {
  return locationLogs.filter(l => l.userId === userId);
}

export function getLogsByDate(date: string): LocationLog[] {
  return locationLogs.filter(l => l.timestamp.startsWith(date));
}

export function getLogsByJobNumber(jobNumber: string): LocationLog[] {
  return locationLogs.filter(l => l.relatedJobNumber === jobNumber);
}

export function getLogsByActivity(activity: LocationLog['activity']): LocationLog[] {
  return locationLogs.filter(l => l.activity === activity);
}

export function getRecentLogs(limit: number = 50): LocationLog[] {
  return [...locationLogs]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

export function getTodaysLogs(): LocationLog[] {
  const today = new Date().toISOString().slice(0, 10);
  return getLogsByDate(today);
}

export function getUserRoute(userId: string, date: string): LocationLog[] {
  return locationLogs
    .filter(l => l.userId === userId && l.timestamp.startsWith(date))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function getActiveUsers(): { userId: string; userName: string; lastLocation: LocationLog }[] {
  const userMap = new Map<string, LocationLog>();

  // Get latest log for each user
  locationLogs.forEach(log => {
    const existing = userMap.get(log.userId);
    if (!existing || new Date(log.timestamp) > new Date(existing.timestamp)) {
      userMap.set(log.userId, log);
    }
  });

  return Array.from(userMap.entries()).map(([userId, log]) => ({
    userId,
    userName: log.userName,
    lastLocation: log
  }));
}

// Calculate distance between two points (Haversine formula)
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate total distance traveled by user on a date
export function getUserTravelDistance(userId: string, date: string): number {
  const route = getUserRoute(userId, date);
  let totalDistance = 0;

  for (let i = 1; i < route.length; i++) {
    totalDistance += calculateDistance(
      route[i - 1].latitude,
      route[i - 1].longitude,
      route[i].latitude,
      route[i].longitude
    );
  }

  return totalDistance;
}
