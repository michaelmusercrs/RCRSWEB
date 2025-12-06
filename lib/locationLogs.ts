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

// Sample location logs for demonstration
export const locationLogs: LocationLog[] = [
  // Richard (Driver) - December 4, 2025
  {
    logId: 'LOC-20251204-001',
    userId: 'RVR-136',
    userName: 'Richard',
    timestamp: '2025-12-04T06:30:00Z',
    latitude: 34.7303,
    longitude: -86.5861,
    accuracy: 10,
    address: 'RCRS Office',
    city: 'Huntsville',
    state: 'AL',
    activity: 'login',
    deviceInfo: 'Android 13 - Samsung Galaxy'
  },
  {
    logId: 'LOC-20251204-002',
    userId: 'RVR-136',
    userName: 'Richard',
    timestamp: '2025-12-04T07:15:00Z',
    latitude: 34.7303,
    longitude: -86.5861,
    accuracy: 5,
    address: 'RCRS Warehouse A',
    city: 'Huntsville',
    state: 'AL',
    activity: 'delivery_start',
    relatedJobNumber: 'JOB-2024-1235',
    notes: 'Loaded materials for Smith Commercial'
  },
  {
    logId: 'LOC-20251204-003',
    userId: 'RVR-136',
    userName: 'Richard',
    timestamp: '2025-12-04T08:30:00Z',
    latitude: 34.6059,
    longitude: -86.9833,
    accuracy: 15,
    address: '456 Industrial Blvd',
    city: 'Decatur',
    state: 'AL',
    activity: 'delivery_arrive',
    relatedJobNumber: 'JOB-2024-1235'
  },
  {
    logId: 'LOC-20251204-004',
    userId: 'RVR-136',
    userName: 'Richard',
    timestamp: '2025-12-04T09:00:00Z',
    latitude: 34.6059,
    longitude: -86.9833,
    accuracy: 10,
    address: '456 Industrial Blvd',
    city: 'Decatur',
    state: 'AL',
    activity: 'delivery_complete',
    relatedJobNumber: 'JOB-2024-1235',
    notes: 'Materials delivered, customer signature obtained'
  },

  // Tae (Materials Manager) - December 4, 2025
  {
    logId: 'LOC-20251204-005',
    userId: 'a8ad2e33',
    userName: 'Tae Orr',
    timestamp: '2025-12-04T06:00:00Z',
    latitude: 34.7303,
    longitude: -86.5861,
    accuracy: 8,
    address: 'RCRS Warehouse A',
    city: 'Huntsville',
    state: 'AL',
    activity: 'check_in',
    deviceInfo: 'iPhone 15 Pro'
  },
  {
    logId: 'LOC-20251204-006',
    userId: 'a8ad2e33',
    userName: 'Tae Orr',
    timestamp: '2025-12-04T12:00:00Z',
    latitude: 34.7303,
    longitude: -86.5861,
    accuracy: 10,
    address: 'RCRS Warehouse A',
    city: 'Huntsville',
    state: 'AL',
    activity: 'break',
    notes: 'Lunch break'
  },

  // Hunter (Sales Inspector) - December 4, 2025
  {
    logId: 'LOC-20251204-007',
    userId: 'EMP-011',
    userName: 'Hunter',
    timestamp: '2025-12-04T08:00:00Z',
    latitude: 34.7303,
    longitude: -86.5861,
    accuracy: 12,
    address: 'RCRS Office',
    city: 'Huntsville',
    state: 'AL',
    activity: 'login'
  },
  {
    logId: 'LOC-20251204-008',
    userId: 'EMP-011',
    userName: 'Hunter',
    timestamp: '2025-12-04T09:00:00Z',
    latitude: 34.7464,
    longitude: -86.5924,
    accuracy: 20,
    address: '123 Oak Street',
    city: 'Huntsville',
    state: 'AL',
    activity: 'inspection',
    relatedJobNumber: 'JOB-2024-1234',
    relatedTaskId: 'TASK-20251204-001',
    notes: 'Arrived for storm damage inspection'
  },

  // John (Production Manager) - December 4, 2025
  {
    logId: 'LOC-20251204-009',
    userId: 'EMP-006',
    userName: 'John',
    timestamp: '2025-12-04T06:45:00Z',
    latitude: 34.6993,
    longitude: -86.7483,
    accuracy: 8,
    address: '789 Maple Lane',
    city: 'Madison',
    state: 'AL',
    activity: 'check_in',
    relatedJobNumber: 'JOB-2024-1236',
    notes: 'Arrived at Williams residence for installation'
  },
  {
    logId: 'LOC-20251204-010',
    userId: 'EMP-006',
    userName: 'John',
    timestamp: '2025-12-04T12:30:00Z',
    latitude: 34.6993,
    longitude: -86.7483,
    accuracy: 5,
    address: '789 Maple Lane',
    city: 'Madison',
    state: 'AL',
    activity: 'manual',
    relatedJobNumber: 'JOB-2024-1236',
    notes: 'Tear-off complete, starting shingle installation'
  },

  // December 3, 2025 - Previous day logs
  {
    logId: 'LOC-20251203-001',
    userId: 'RVR-136',
    userName: 'Richard',
    timestamp: '2025-12-03T06:30:00Z',
    latitude: 34.7303,
    longitude: -86.5861,
    accuracy: 10,
    address: 'RCRS Office',
    city: 'Huntsville',
    state: 'AL',
    activity: 'login'
  },
  {
    logId: 'LOC-20251203-002',
    userId: 'RVR-136',
    userName: 'Richard',
    timestamp: '2025-12-03T07:00:00Z',
    latitude: 34.7303,
    longitude: -86.5861,
    accuracy: 8,
    address: 'RCRS Warehouse A',
    city: 'Huntsville',
    state: 'AL',
    activity: 'delivery_start',
    relatedJobNumber: 'JOB-2024-1234'
  },
  {
    logId: 'LOC-20251203-003',
    userId: 'RVR-136',
    userName: 'Richard',
    timestamp: '2025-12-03T08:15:00Z',
    latitude: 34.7464,
    longitude: -86.5924,
    accuracy: 12,
    address: '123 Oak Street',
    city: 'Huntsville',
    state: 'AL',
    activity: 'delivery_complete',
    relatedJobNumber: 'JOB-2024-1234'
  },
  {
    logId: 'LOC-20251203-004',
    userId: 'RVR-136',
    userName: 'Richard',
    timestamp: '2025-12-03T16:00:00Z',
    latitude: 34.7303,
    longitude: -86.5861,
    accuracy: 5,
    address: 'RCRS Office',
    city: 'Huntsville',
    state: 'AL',
    activity: 'check_out'
  }
];

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
