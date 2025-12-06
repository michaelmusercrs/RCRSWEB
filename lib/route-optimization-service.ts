// Route Optimization Service for River City Roofing Solutions
// Optimizes delivery routes based on distance, time windows, and priorities
// Last Updated: December 2025

import { Ticket, tickets, getTicketsByDriver } from './ticketsData';
import { gpsTrackingService } from './voice-notification-service';

// Huntsville, AL area coordinates (warehouse location)
const WAREHOUSE_LOCATION = {
  lat: 34.7304,
  lng: -86.5861,
  address: '2710 Memorial Pkwy SW, Huntsville, AL 35801'
};

// Service area cities with approximate coordinates
const SERVICE_AREA_CITIES: Record<string, { lat: number; lng: number }> = {
  'Huntsville': { lat: 34.7304, lng: -86.5861 },
  'Madison': { lat: 34.6993, lng: -86.7483 },
  'Decatur': { lat: 34.6059, lng: -86.9833 },
  'Athens': { lat: 34.8025, lng: -86.9717 },
  'Harvest': { lat: 34.8537, lng: -86.7517 },
  'Hazel Green': { lat: 34.9320, lng: -86.5722 },
  'Owens Cross Roads': { lat: 34.5881, lng: -86.4556 },
  'New Market': { lat: 34.9106, lng: -86.4278 },
  'Meridianville': { lat: 34.8517, lng: -86.5739 },
  'Toney': { lat: 34.8987, lng: -86.7183 },
  'Gurley': { lat: 34.7009, lng: -86.3836 },
  'Triana': { lat: 34.6106, lng: -86.7339 },
  'Brownsboro': { lat: 34.7445, lng: -86.4678 },
  'Scottsboro': { lat: 34.6723, lng: -86.0344 },
  'Albertville': { lat: 34.2679, lng: -86.2086 },
  'Guntersville': { lat: 34.3582, lng: -86.2947 },
  'Arab': { lat: 34.3176, lng: -86.4958 },
  'Fayetteville': { lat: 35.1517, lng: -86.5706 }
};

// Delivery stop interface
export interface DeliveryStop {
  ticketId: string;
  jobName: string;
  address: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  estimatedTime: number; // minutes at stop
  priority: 'normal' | 'high' | 'urgent';
  timeWindow?: { start: string; end: string };
  itemCount: number;
  customerName?: string;
  customerPhone?: string;
}

// Optimized route interface
export interface OptimizedRoute {
  routeId: string;
  driverId: string;
  driverName: string;
  createdAt: string;
  stops: DeliveryStop[];
  totalDistance: number; // miles
  totalTime: number; // minutes
  estimatedStartTime: string;
  estimatedEndTime: string;
  warehouseReturn: boolean;
}

// Route segment
interface RouteSegment {
  fromStop: number;
  toStop: number;
  distance: number;
  duration: number;
}

// Route Optimization Algorithm
class RouteOptimizer {
  // Calculate distance between two points (Haversine formula)
  calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * Math.PI / 180;
  }

  // Estimate drive time (assuming average 30 mph in urban/suburban)
  estimateDriveTime(distanceMiles: number): number {
    const avgSpeed = 30; // mph
    return Math.round((distanceMiles / avgSpeed) * 60); // minutes
  }

  // Get coordinates for a city
  getCityCoordinates(city: string): { lat: number; lng: number } {
    const normalized = city.trim();
    return SERVICE_AREA_CITIES[normalized] || WAREHOUSE_LOCATION;
  }

  // Convert ticket to delivery stop
  ticketToStop(ticket: Ticket): DeliveryStop {
    const cityCoords = this.getCityCoordinates(ticket.city || 'Huntsville');

    // Add some random offset for address within city (simulated)
    const latOffset = (Math.random() - 0.5) * 0.05;
    const lngOffset = (Math.random() - 0.5) * 0.05;

    return {
      ticketId: ticket.ticketId,
      jobName: ticket.jobName || 'Delivery ' + ticket.ticketId,
      address: ticket.jobAddress || 'Address TBD',
      city: ticket.city || 'Huntsville',
      state: ticket.state || 'AL',
      lat: cityCoords.lat + latOffset,
      lng: cityCoords.lng + lngOffset,
      estimatedTime: 15 + (ticket.materials.length * 2), // Base + per item
      priority: 'normal',
      itemCount: ticket.materials.length,
      customerName: ticket.customerName,
      customerPhone: ticket.customerPhone
    };
  }

  // Nearest neighbor algorithm for route optimization
  optimizeRouteNearestNeighbor(stops: DeliveryStop[]): DeliveryStop[] {
    if (stops.length <= 1) return stops;

    const optimized: DeliveryStop[] = [];
    const remaining = [...stops];

    // Start from warehouse
    let currentLat = WAREHOUSE_LOCATION.lat;
    let currentLng = WAREHOUSE_LOCATION.lng;

    // First, prioritize urgent/high priority stops
    const urgent = remaining.filter(s => s.priority === 'urgent');
    const high = remaining.filter(s => s.priority === 'high');
    const normal = remaining.filter(s => s.priority === 'normal');

    // Add urgent stops first (still optimize within urgent)
    this.sortByDistance(urgent, currentLat, currentLng);
    urgent.forEach(stop => {
      optimized.push(stop);
      remaining.splice(remaining.indexOf(stop), 1);
      currentLat = stop.lat;
      currentLng = stop.lng;
    });

    // Then high priority
    this.sortByDistance(high, currentLat, currentLng);
    high.forEach(stop => {
      optimized.push(stop);
      remaining.splice(remaining.indexOf(stop), 1);
      currentLat = stop.lat;
      currentLng = stop.lng;
    });

    // Then normal priority using nearest neighbor
    while (remaining.length > 0) {
      let nearestIndex = 0;
      let nearestDistance = Infinity;

      remaining.forEach((stop, index) => {
        const distance = this.calculateDistance(currentLat, currentLng, stop.lat, stop.lng);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });

      const nearest = remaining.splice(nearestIndex, 1)[0];
      optimized.push(nearest);
      currentLat = nearest.lat;
      currentLng = nearest.lng;
    }

    return optimized;
  }

  // Sort stops by distance from current location
  private sortByDistance(stops: DeliveryStop[], fromLat: number, fromLng: number): void {
    stops.sort((a, b) => {
      const distA = this.calculateDistance(fromLat, fromLng, a.lat, a.lng);
      const distB = this.calculateDistance(fromLat, fromLng, b.lat, b.lng);
      return distA - distB;
    });
  }

  // Calculate total route metrics
  calculateRouteMetrics(stops: DeliveryStop[]): { totalDistance: number; totalTime: number } {
    let totalDistance = 0;
    let totalTime = 0;

    // Distance from warehouse to first stop
    if (stops.length > 0) {
      totalDistance += this.calculateDistance(
        WAREHOUSE_LOCATION.lat, WAREHOUSE_LOCATION.lng,
        stops[0].lat, stops[0].lng
      );
    }

    // Distance between stops
    for (let i = 0; i < stops.length - 1; i++) {
      totalDistance += this.calculateDistance(
        stops[i].lat, stops[i].lng,
        stops[i + 1].lat, stops[i + 1].lng
      );
    }

    // Distance back to warehouse
    if (stops.length > 0) {
      totalDistance += this.calculateDistance(
        stops[stops.length - 1].lat, stops[stops.length - 1].lng,
        WAREHOUSE_LOCATION.lat, WAREHOUSE_LOCATION.lng
      );
    }

    // Total time = drive time + time at each stop
    totalTime = this.estimateDriveTime(totalDistance);
    stops.forEach(stop => {
      totalTime += stop.estimatedTime;
    });

    return {
      totalDistance: Math.round(totalDistance * 10) / 10,
      totalTime
    };
  }
}

// Main Route Optimization Service
class RouteOptimizationService {
  private optimizer = new RouteOptimizer();
  private cachedRoutes: Map<string, OptimizedRoute> = new Map();

  // Generate unique route ID
  private generateRouteId(): string {
    return 'ROUTE-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  // Create optimized route for a driver
  createOptimizedRoute(
    driverId: string,
    driverName: string,
    ticketIds: string[]
  ): OptimizedRoute {
    // Get tickets and convert to stops
    const stops: DeliveryStop[] = ticketIds
      .map(id => {
        const ticket = tickets.find(t => t.ticketId === id);
        return ticket ? this.optimizer.ticketToStop(ticket) : null;
      })
      .filter((stop): stop is DeliveryStop => stop !== null);

    // Optimize the route
    const optimizedStops = this.optimizer.optimizeRouteNearestNeighbor(stops);

    // Calculate metrics
    const metrics = this.optimizer.calculateRouteMetrics(optimizedStops);

    // Calculate estimated times
    const now = new Date();
    const startTime = new Date(now.getTime() + 30 * 60000); // Start in 30 min
    const endTime = new Date(startTime.getTime() + metrics.totalTime * 60000);

    const route: OptimizedRoute = {
      routeId: this.generateRouteId(),
      driverId,
      driverName,
      createdAt: now.toISOString(),
      stops: optimizedStops,
      totalDistance: metrics.totalDistance,
      totalTime: metrics.totalTime,
      estimatedStartTime: startTime.toISOString(),
      estimatedEndTime: endTime.toISOString(),
      warehouseReturn: true
    };

    // Cache the route
    this.cachedRoutes.set(route.routeId, route);

    return route;
  }

  // Create route for driver's assigned tickets
  createDriverRoute(driverId: string, driverName: string): OptimizedRoute {
    const driverTickets = getTicketsByDriver(driverId);
    const pendingTickets = driverTickets.filter(t =>
      t.status !== 'completed' && t.status !== 'cancelled'
    );

    return this.createOptimizedRoute(
      driverId,
      driverName,
      pendingTickets.map(t => t.ticketId)
    );
  }

  // Get cached route
  getRoute(routeId: string): OptimizedRoute | undefined {
    return this.cachedRoutes.get(routeId);
  }

  // Get Google Maps URL for entire route
  getGoogleMapsRouteUrl(route: OptimizedRoute): string {
    if (route.stops.length === 0) {
      return 'https://www.google.com/maps';
    }

    const origin = encodeURIComponent(WAREHOUSE_LOCATION.address);
    const destination = encodeURIComponent(WAREHOUSE_LOCATION.address);

    const waypoints = route.stops
      .map(stop => encodeURIComponent(stop.address + ', ' + stop.city + ', ' + stop.state))
      .join('|');

    return 'https://www.google.com/maps/dir/?api=1' +
      '&origin=' + origin +
      '&destination=' + destination +
      '&waypoints=' + waypoints +
      '&travelmode=driving';
  }

  // Get navigation URL for single stop
  getStopNavigationUrl(stop: DeliveryStop): string {
    const address = encodeURIComponent(stop.address + ', ' + stop.city + ', ' + stop.state);
    return 'https://www.google.com/maps/dir/?api=1&destination=' + address + '&travelmode=driving';
  }

  // Format route for voice announcement
  getRouteVoiceScript(route: OptimizedRoute): string {
    let script = 'Your optimized route has ' + route.stops.length + ' stops. ';
    script += 'Total distance: ' + route.totalDistance + ' miles. ';
    script += 'Estimated time: ' + Math.round(route.totalTime / 60) + ' hours and ' + (route.totalTime % 60) + ' minutes. ';
    script += 'Stops in order: ';

    route.stops.forEach((stop, index) => {
      script += 'Stop ' + (index + 1) + ': ' + stop.jobName + ' in ' + stop.city + '. ';
    });

    script += 'Route ends at warehouse.';

    return script;
  }

  // Format route summary for display
  getRouteSummary(route: OptimizedRoute): {
    stopCount: number;
    totalDistance: string;
    totalTime: string;
    estimatedEnd: string;
    stops: Array<{ order: number; jobName: string; city: string; items: number }>;
  } {
    const hours = Math.floor(route.totalTime / 60);
    const minutes = route.totalTime % 60;

    return {
      stopCount: route.stops.length,
      totalDistance: route.totalDistance.toFixed(1) + ' mi',
      totalTime: hours + 'h ' + minutes + 'm',
      estimatedEnd: new Date(route.estimatedEndTime).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      }),
      stops: route.stops.map((stop, index) => ({
        order: index + 1,
        jobName: stop.jobName,
        city: stop.city,
        items: stop.itemCount
      }))
    };
  }

  // Recalculate route after a stop is completed
  recalculateRoute(routeId: string, completedStopId: string): OptimizedRoute | null {
    const route = this.cachedRoutes.get(routeId);
    if (!route) return null;

    // Remove completed stop
    const remainingStops = route.stops.filter(s => s.ticketId !== completedStopId);

    if (remainingStops.length === 0) {
      // Route complete
      route.stops = [];
      route.totalDistance = 0;
      route.totalTime = 0;
      return route;
    }

    // Re-optimize remaining stops from current location
    const optimizedStops = this.optimizer.optimizeRouteNearestNeighbor(remainingStops);
    const metrics = this.optimizer.calculateRouteMetrics(optimizedStops);

    route.stops = optimizedStops;
    route.totalDistance = metrics.totalDistance;
    route.totalTime = metrics.totalTime;
    route.estimatedEndTime = new Date(
      Date.now() + metrics.totalTime * 60000
    ).toISOString();

    return route;
  }

  // Get ETA to specific stop
  getStopETA(route: OptimizedRoute, stopIndex: number): { eta: string; distanceRemaining: number } {
    let distance = 0;
    let time = 0;

    // From warehouse or current location to target stop
    for (let i = 0; i <= stopIndex; i++) {
      const fromLat = i === 0 ? WAREHOUSE_LOCATION.lat : route.stops[i - 1].lat;
      const fromLng = i === 0 ? WAREHOUSE_LOCATION.lng : route.stops[i - 1].lng;

      distance += this.optimizer.calculateDistance(
        fromLat, fromLng,
        route.stops[i].lat, route.stops[i].lng
      );

      if (i < stopIndex) {
        time += route.stops[i].estimatedTime;
      }
    }

    time += this.optimizer.estimateDriveTime(distance);

    const etaTime = new Date(Date.now() + time * 60000);

    return {
      eta: etaTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      distanceRemaining: Math.round(distance * 10) / 10
    };
  }

  // Clear cached route
  clearRoute(routeId: string): void {
    this.cachedRoutes.delete(routeId);
  }

  // Get all active routes
  getActiveRoutes(): OptimizedRoute[] {
    return Array.from(this.cachedRoutes.values());
  }
}

// Export singleton
export const routeOptimizationService = new RouteOptimizationService();

// Export warehouse location
export { WAREHOUSE_LOCATION, SERVICE_AREA_CITIES };
