/**
 * Route Tracker Service for River City Roofing Solutions
 *
 * GPS route tracking with stop management, route optimization (nearest-neighbor),
 * and driver analytics.
 *
 * Persisted to the Google Sheets master workbook (Routes tab). One row per
 * route; stops are stored as a JSON blob within the row. The legacy
 * data/routes.json file is left in place as a dev seed but no longer
 * read or written at runtime.
 *
 * @version 2.0.0
 */

import crypto from 'crypto';
import { googleSheetsService, SHEET_NAMES } from './google-sheets-service';

// =============================================================================
// TYPES
// =============================================================================

export interface RouteStop {
  id: string;
  order: number;
  address: string;
  lat: number;
  lng: number;
  customerName: string;
  jobId?: string;
  type: 'pickup' | 'delivery' | 'inspection' | 'meeting' | 'other';
  estimatedArrival: string;
  actualArrival?: string;
  departedAt?: string;
  duration?: number; // minutes on site
  status: 'pending' | 'en_route' | 'arrived' | 'completed' | 'skipped';
  notes: string;
  signature?: string; // base64 data url
  photos: string[];
}

export interface Route {
  id: string;
  date: string;
  driverId: string;
  driverName: string;
  vehicleId?: string;

  stops: RouteStop[];

  startLocation: { address: string; lat: number; lng: number };
  startTime: string;
  endTime?: string;

  totalMiles: number;
  totalStops: number;
  completedStops: number;

  status: 'planned' | 'active' | 'completed' | 'cancelled';

  optimizedOrder?: number[]; // indexes of stops in optimal order
  estimatedTotalTime: number; // minutes
  actualTotalTime?: number;

  createdAt: string;
  updatedAt: string;
}

export interface RouteAnalytics {
  totalRoutes: number;
  avgStopsPerRoute: number;
  avgMilesPerRoute: number;
  avgTimePerStop: number;
  onTimeRate: number;
  completionRate: number;
  byDriver: {
    driverSlug: string;
    name: string;
    routes: number;
    avgMiles: number;
    onTimeRate: number;
  }[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Huntsville, AL warehouse
const WAREHOUSE_LOCATION = {
  address: '2710 Memorial Pkwy SW, Huntsville, AL 35801',
  lat: 34.7304,
  lng: -86.5861,
};

// Average driving speed for time estimates (mph)
const AVG_SPEED_MPH = 30;
// Average minutes spent at each stop
const AVG_STOP_DURATION = 20;

// =============================================================================
// SHEET SCHEMA
// =============================================================================

const ROUTE_HEADERS: string[] = [
  'id',
  'date',
  'driverId',
  'driverName',
  'vehicleId',
  'stops',           // JSON RouteStop[]
  'startLocation',   // JSON {address, lat, lng}
  'startTime',
  'endTime',
  'totalMiles',
  'totalStops',
  'completedStops',
  'status',
  'optimizedOrder',  // JSON number[]
  'estimatedTotalTime',
  'actualTotalTime',
  'createdAt',
  'updatedAt',
];

function parseNumber(raw: string): number {
  if (!raw) return 0;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

function parseJson<T>(raw: string, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function rowToRoute(row: Record<string, string>): Route {
  const route: Route = {
    id: row.id || '',
    date: row.date || '',
    driverId: row.driverId || '',
    driverName: row.driverName || '',
    stops: parseJson<RouteStop[]>(row.stops, []),
    startLocation: parseJson<Route['startLocation']>(
      row.startLocation,
      { ...WAREHOUSE_LOCATION }
    ),
    startTime: row.startTime || '',
    totalMiles: parseNumber(row.totalMiles),
    totalStops: parseNumber(row.totalStops),
    completedStops: parseNumber(row.completedStops),
    status: (row.status as Route['status']) || 'planned',
    estimatedTotalTime: parseNumber(row.estimatedTotalTime),
    createdAt: row.createdAt || '',
    updatedAt: row.updatedAt || '',
  };
  if (row.vehicleId) route.vehicleId = row.vehicleId;
  if (row.endTime) route.endTime = row.endTime;
  if (row.optimizedOrder) route.optimizedOrder = parseJson<number[]>(row.optimizedOrder, []);
  if (row.actualTotalTime) route.actualTotalTime = parseNumber(row.actualTotalTime);
  return route;
}

function routeToRow(route: Route): Record<string, unknown> {
  return {
    id: route.id,
    date: route.date,
    driverId: route.driverId,
    driverName: route.driverName,
    vehicleId: route.vehicleId || '',
    stops: JSON.stringify(route.stops || []),
    startLocation: JSON.stringify(route.startLocation),
    startTime: route.startTime,
    endTime: route.endTime || '',
    totalMiles: route.totalMiles,
    totalStops: route.totalStops,
    completedStops: route.completedStops,
    status: route.status,
    optimizedOrder: route.optimizedOrder ? JSON.stringify(route.optimizedOrder) : '',
    estimatedTotalTime: route.estimatedTotalTime,
    actualTotalTime: route.actualTotalTime ?? '',
    createdAt: route.createdAt,
    updatedAt: route.updatedAt,
  };
}

function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
}

// =============================================================================
// SERVICE
// =============================================================================

class RouteTrackerService {
  // 60-second in-memory cache
  private cache: Route[] | null = null;
  private cacheExpiresAt = 0;
  private readonly CACHE_TTL_MS = 60_000;

  private async loadFromSheet(): Promise<Route[]> {
    const rows = await googleSheetsService.getGenericRows(
      SHEET_NAMES.ROUTES,
      ROUTE_HEADERS
    );
    return rows.map(rowToRoute);
  }

  private async loadCached(): Promise<Route[]> {
    if (this.cache && Date.now() < this.cacheExpiresAt) {
      return this.cache;
    }
    this.cache = await this.loadFromSheet();
    this.cacheExpiresAt = Date.now() + this.CACHE_TTL_MS;
    return this.cache;
  }

  private invalidateCache(): void {
    this.cache = null;
    this.cacheExpiresAt = 0;
  }

  private async persist(route: Route): Promise<void> {
    await googleSheetsService.upsertGenericRow(
      SHEET_NAMES.ROUTES,
      ROUTE_HEADERS,
      'id',
      routeToRow(route)
    );
    this.invalidateCache();
  }

  /**
   * Haversine distance between two lat/lng points in miles.
   */
  calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 3959; // Earth radius in miles
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  /**
   * Estimate driving time in minutes between two points.
   */
  private estimateDriveTime(miles: number): number {
    return Math.round((miles / AVG_SPEED_MPH) * 60);
  }

  /**
   * Compute total route miles by summing segment distances (start -> stop1 -> stop2 -> ... ).
   */
  private computeTotalMiles(
    startLat: number,
    startLng: number,
    stops: RouteStop[]
  ): number {
    if (stops.length === 0) return 0;
    let total = this.calculateDistance(startLat, startLng, stops[0].lat, stops[0].lng);
    for (let i = 1; i < stops.length; i++) {
      total += this.calculateDistance(
        stops[i - 1].lat,
        stops[i - 1].lng,
        stops[i].lat,
        stops[i].lng
      );
    }
    return Math.round(total * 10) / 10;
  }

  /**
   * Assign estimated arrival times to stops based on distances and stop durations.
   */
  private assignETAs(route: Route): void {
    const startDate = new Date(route.startTime || route.date + 'T08:00:00');
    let currentTime = startDate.getTime();
    let prevLat = route.startLocation.lat;
    let prevLng = route.startLocation.lng;

    for (const stop of route.stops) {
      const dist = this.calculateDistance(prevLat, prevLng, stop.lat, stop.lng);
      const driveMinutes = this.estimateDriveTime(dist);
      currentTime += driveMinutes * 60 * 1000;
      stop.estimatedArrival = new Date(currentTime).toISOString();
      // Add stop duration for next leg
      currentTime += (stop.duration || AVG_STOP_DURATION) * 60 * 1000;
      prevLat = stop.lat;
      prevLng = stop.lng;
    }
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  /**
   * Create a new route with stops.
   */
  async createRoute(
    driverId: string,
    driverName: string,
    date: string,
    stops: Omit<RouteStop, 'id' | 'order' | 'status' | 'estimatedArrival' | 'photos' | 'notes'>[],
    vehicleId?: string
  ): Promise<Route> {
    const routeStops: RouteStop[] = stops.map((s, idx) => ({
      id: generateId('stop'),
      order: idx + 1,
      address: s.address,
      lat: s.lat,
      lng: s.lng,
      customerName: s.customerName,
      jobId: s.jobId,
      type: s.type,
      estimatedArrival: '',
      status: 'pending' as const,
      notes: '',
      photos: [],
      duration: s.duration,
      signature: s.signature,
    }));

    const route: Route = {
      id: generateId('route'),
      date,
      driverId,
      driverName,
      vehicleId,
      stops: routeStops,
      startLocation: { ...WAREHOUSE_LOCATION },
      startTime: date + 'T08:00:00',
      totalMiles: 0,
      totalStops: routeStops.length,
      completedStops: 0,
      status: 'planned',
      estimatedTotalTime: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Compute distances and ETAs
    route.totalMiles = this.computeTotalMiles(
      route.startLocation.lat,
      route.startLocation.lng,
      route.stops
    );
    this.assignETAs(route);

    // Estimated total time = drive time + stop durations
    const driveTime = this.estimateDriveTime(route.totalMiles);
    const stopTime = route.stops.reduce(
      (sum, s) => sum + (s.duration || AVG_STOP_DURATION),
      0
    );
    route.estimatedTotalTime = driveTime + stopTime;

    await this.persist(route);
    return route;
  }

  /**
   * Get a route by ID.
   */
  async getRoute(routeId: string): Promise<Route | null> {
    const routes = await this.loadCached();
    return routes.find((r) => r.id === routeId) || null;
  }

  /**
   * Optimize a route's stop order using nearest-neighbor heuristic.
   * Reorders stops to minimize total distance starting from the warehouse.
   */
  async optimizeRoute(routeId: string): Promise<Route> {
    const routes = await this.loadCached();
    const existing = routes.find((r) => r.id === routeId);
    if (!existing) throw new Error(`Route ${routeId} not found`);
    if (existing.status !== 'planned') {
      throw new Error('Can only optimize planned routes');
    }

    const route: Route = { ...existing, stops: existing.stops.map((s) => ({ ...s })) };
    const stops = [...route.stops];
    if (stops.length <= 1) return route;

    // Nearest-neighbor algorithm
    const optimized: RouteStop[] = [];
    const remaining = new Set(stops.map((_, i) => i));
    let currentLat = route.startLocation.lat;
    let currentLng = route.startLocation.lng;

    while (remaining.size > 0) {
      let nearestIdx = -1;
      let nearestDist = Infinity;

      for (const idx of remaining) {
        const dist = this.calculateDistance(
          currentLat,
          currentLng,
          stops[idx].lat,
          stops[idx].lng
        );
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIdx = idx;
        }
      }

      remaining.delete(nearestIdx);
      const stop = { ...stops[nearestIdx], order: optimized.length + 1 };
      optimized.push(stop);
      currentLat = stop.lat;
      currentLng = stop.lng;
    }

    route.stops = optimized;
    route.optimizedOrder = optimized.map((_, i) => i);
    route.totalMiles = this.computeTotalMiles(
      route.startLocation.lat,
      route.startLocation.lng,
      route.stops
    );
    this.assignETAs(route);

    const driveTime = this.estimateDriveTime(route.totalMiles);
    const stopTime = route.stops.reduce(
      (sum, s) => sum + (s.duration || AVG_STOP_DURATION),
      0
    );
    route.estimatedTotalTime = driveTime + stopTime;
    route.updatedAt = new Date().toISOString();

    await this.persist(route);
    return route;
  }

  /**
   * Optimize a raw array of stops (not yet saved) and return optimized order.
   */
  optimizeStops(
    stops: { lat: number; lng: number; [key: string]: unknown }[]
  ): number[] {
    if (stops.length <= 1) return stops.map((_, i) => i);

    const optimizedOrder: number[] = [];
    const remaining = new Set(stops.map((_, i) => i));
    let currentLat = WAREHOUSE_LOCATION.lat;
    let currentLng = WAREHOUSE_LOCATION.lng;

    while (remaining.size > 0) {
      let nearestIdx = -1;
      let nearestDist = Infinity;

      for (const idx of remaining) {
        const dist = this.calculateDistance(
          currentLat,
          currentLng,
          stops[idx].lat,
          stops[idx].lng
        );
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIdx = idx;
        }
      }

      remaining.delete(nearestIdx);
      optimizedOrder.push(nearestIdx);
      currentLat = stops[nearestIdx].lat;
      currentLng = stops[nearestIdx].lng;
    }

    return optimizedOrder;
  }

  /**
   * Start a route — set status to active and record start time.
   */
  async startRoute(routeId: string): Promise<Route> {
    const routes = await this.loadCached();
    const existing = routes.find((r) => r.id === routeId);
    if (!existing) throw new Error(`Route ${routeId} not found`);
    if (existing.status !== 'planned') {
      throw new Error('Can only start a planned route');
    }

    const route: Route = { ...existing, stops: existing.stops.map((s) => ({ ...s })) };
    route.status = 'active';
    route.startTime = new Date().toISOString();
    // Set first stop as en_route
    if (route.stops.length > 0) {
      route.stops[0].status = 'en_route';
    }
    route.updatedAt = new Date().toISOString();

    await this.persist(route);
    return route;
  }

  /**
   * Mark arrival at a stop.
   */
  async arriveAtStop(routeId: string, stopId: string): Promise<RouteStop> {
    const routes = await this.loadCached();
    const existing = routes.find((r) => r.id === routeId);
    if (!existing) throw new Error(`Route ${routeId} not found`);

    const route: Route = { ...existing, stops: existing.stops.map((s) => ({ ...s })) };
    const stop = route.stops.find((s) => s.id === stopId);
    if (!stop) throw new Error(`Stop ${stopId} not found`);

    stop.status = 'arrived';
    stop.actualArrival = new Date().toISOString();
    route.updatedAt = new Date().toISOString();

    await this.persist(route);
    return stop;
  }

  /**
   * Depart from a stop — mark completed and optionally add notes/photos.
   */
  async departStop(
    routeId: string,
    stopId: string,
    notes?: string,
    photos?: string[]
  ): Promise<RouteStop> {
    const routes = await this.loadCached();
    const existing = routes.find((r) => r.id === routeId);
    if (!existing) throw new Error(`Route ${routeId} not found`);

    const route: Route = { ...existing, stops: existing.stops.map((s) => ({ ...s })) };
    const stop = route.stops.find((s) => s.id === stopId);
    if (!stop) throw new Error(`Stop ${stopId} not found`);

    stop.status = 'completed';
    stop.departedAt = new Date().toISOString();
    if (notes) stop.notes = notes;
    if (photos) stop.photos = [...stop.photos, ...photos];

    // Calculate duration
    if (stop.actualArrival) {
      const arrived = new Date(stop.actualArrival).getTime();
      const departed = new Date(stop.departedAt).getTime();
      stop.duration = Math.round((departed - arrived) / 60000);
    }

    // Update completed count
    route.completedStops = route.stops.filter(
      (s) => s.status === 'completed'
    ).length;

    // Set next stop as en_route
    const currentIdx = route.stops.findIndex((s) => s.id === stopId);
    if (currentIdx < route.stops.length - 1) {
      const nextStop = route.stops[currentIdx + 1];
      if (nextStop.status === 'pending') {
        nextStop.status = 'en_route';
      }
    }

    route.updatedAt = new Date().toISOString();
    await this.persist(route);
    return stop;
  }

  /**
   * Skip a stop with a reason.
   */
  async skipStop(routeId: string, stopId: string, reason: string): Promise<RouteStop> {
    const routes = await this.loadCached();
    const existing = routes.find((r) => r.id === routeId);
    if (!existing) throw new Error(`Route ${routeId} not found`);

    const route: Route = { ...existing, stops: existing.stops.map((s) => ({ ...s })) };
    const stop = route.stops.find((s) => s.id === stopId);
    if (!stop) throw new Error(`Stop ${stopId} not found`);

    stop.status = 'skipped';
    stop.notes = reason;

    // Set next stop as en_route if applicable
    const currentIdx = route.stops.findIndex((s) => s.id === stopId);
    if (currentIdx < route.stops.length - 1) {
      const nextStop = route.stops[currentIdx + 1];
      if (nextStop.status === 'pending') {
        nextStop.status = 'en_route';
      }
    }

    route.updatedAt = new Date().toISOString();
    await this.persist(route);
    return stop;
  }

  /**
   * Complete the entire route.
   */
  async completeRoute(routeId: string): Promise<Route> {
    const routes = await this.loadCached();
    const existing = routes.find((r) => r.id === routeId);
    if (!existing) throw new Error(`Route ${routeId} not found`);

    const route: Route = { ...existing, stops: existing.stops.map((s) => ({ ...s })) };
    route.status = 'completed';
    route.endTime = new Date().toISOString();
    route.completedStops = route.stops.filter(
      (s) => s.status === 'completed'
    ).length;

    // Calculate actual total time
    if (route.startTime) {
      const start = new Date(route.startTime).getTime();
      const end = new Date(route.endTime).getTime();
      route.actualTotalTime = Math.round((end - start) / 60000);
    }

    route.updatedAt = new Date().toISOString();
    await this.persist(route);
    return route;
  }

  // ---------------------------------------------------------------------------
  // QUERIES
  // ---------------------------------------------------------------------------

  /**
   * Get all currently active routes.
   */
  async getActiveRoutes(): Promise<Route[]> {
    const routes = await this.loadCached();
    return routes.filter((r) => r.status === 'active');
  }

  /**
   * Get route history with optional filters.
   */
  async getRouteHistory(driverId?: string, limit?: number): Promise<Route[]> {
    const all = await this.loadCached();
    let routes = [...all].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    if (driverId) {
      routes = routes.filter((r) => r.driverId === driverId);
    }
    if (limit) {
      routes = routes.slice(0, limit);
    }
    return routes;
  }

  /**
   * List routes with filters.
   */
  async listRoutes(filters?: {
    driverId?: string;
    date?: string;
    status?: string;
    limit?: number;
  }): Promise<Route[]> {
    const all = await this.loadCached();
    let routes = [...all];

    if (filters?.driverId) {
      routes = routes.filter((r) => r.driverId === filters.driverId);
    }
    if (filters?.date) {
      routes = routes.filter((r) => r.date === filters.date);
    }
    if (filters?.status) {
      routes = routes.filter((r) => r.status === filters.status);
    }

    // Sort newest first
    routes.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    if (filters?.limit) {
      routes = routes.slice(0, filters.limit);
    }

    return routes;
  }

  // ---------------------------------------------------------------------------
  // ANALYTICS
  // ---------------------------------------------------------------------------

  /**
   * Get route analytics, optionally filtered by date range.
   */
  async getAnalytics(startDate?: string, endDate?: string): Promise<RouteAnalytics> {
    const all = await this.loadCached();
    let routes = all.filter((r) => r.status === 'completed');

    if (startDate) {
      routes = routes.filter((r) => r.date >= startDate);
    }
    if (endDate) {
      routes = routes.filter((r) => r.date <= endDate);
    }

    const totalRoutes = routes.length;
    if (totalRoutes === 0) {
      return {
        totalRoutes: 0,
        avgStopsPerRoute: 0,
        avgMilesPerRoute: 0,
        avgTimePerStop: 0,
        onTimeRate: 0,
        completionRate: 0,
        byDriver: [],
      };
    }

    const totalStops = routes.reduce((sum, r) => sum + r.totalStops, 0);
    const totalMiles = routes.reduce((sum, r) => sum + r.totalMiles, 0);

    // Count completed stops and on-time arrivals
    let completedStopsTotal = 0;
    let onTimeStops = 0;
    let totalTimeAtStops = 0;
    let stopsWithDuration = 0;

    for (const route of routes) {
      for (const stop of route.stops) {
        if (stop.status === 'completed') {
          completedStopsTotal++;
          if (stop.duration) {
            totalTimeAtStops += stop.duration;
            stopsWithDuration++;
          }
          // On-time: arrived within 15 min of estimate
          if (stop.actualArrival && stop.estimatedArrival) {
            const actual = new Date(stop.actualArrival).getTime();
            const estimated = new Date(stop.estimatedArrival).getTime();
            if (actual - estimated <= 15 * 60 * 1000) {
              onTimeStops++;
            }
          }
        }
      }
    }

    // Per-driver breakdown
    const driverMap = new Map<
      string,
      { name: string; routes: number; totalMiles: number; onTime: number; total: number }
    >();

    for (const route of routes) {
      const existing = driverMap.get(route.driverId) || {
        name: route.driverName,
        routes: 0,
        totalMiles: 0,
        onTime: 0,
        total: 0,
      };
      existing.routes++;
      existing.totalMiles += route.totalMiles;

      for (const stop of route.stops) {
        if (stop.status === 'completed') {
          existing.total++;
          if (stop.actualArrival && stop.estimatedArrival) {
            const actual = new Date(stop.actualArrival).getTime();
            const estimated = new Date(stop.estimatedArrival).getTime();
            if (actual - estimated <= 15 * 60 * 1000) {
              existing.onTime++;
            }
          }
        }
      }

      driverMap.set(route.driverId, existing);
    }

    const byDriver = Array.from(driverMap.entries()).map(([slug, d]) => ({
      driverSlug: slug,
      name: d.name,
      routes: d.routes,
      avgMiles: Math.round((d.totalMiles / d.routes) * 10) / 10,
      onTimeRate: d.total > 0 ? Math.round((d.onTime / d.total) * 100) : 0,
    }));

    return {
      totalRoutes,
      avgStopsPerRoute: Math.round((totalStops / totalRoutes) * 10) / 10,
      avgMilesPerRoute: Math.round((totalMiles / totalRoutes) * 10) / 10,
      avgTimePerStop:
        stopsWithDuration > 0
          ? Math.round(totalTimeAtStops / stopsWithDuration)
          : AVG_STOP_DURATION,
      onTimeRate:
        completedStopsTotal > 0
          ? Math.round((onTimeStops / completedStopsTotal) * 100)
          : 0,
      completionRate:
        totalStops > 0
          ? Math.round((completedStopsTotal / totalStops) * 100)
          : 0,
      byDriver,
    };
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const routeTrackerService = new RouteTrackerService();
