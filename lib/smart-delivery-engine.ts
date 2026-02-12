// Smart Delivery Engine for River City Roofing Solutions
// Provides automated decision-making, optimizations, and intelligent workflow management.
// Integrates with delivery-workflow-service, route-optimization-service, and weather-service.

// ============================================
// INTERFACES
// ============================================

export interface RouteStop {
  address: string;
  city: string;
  lat?: number;
  lng?: number;
  priority: 'normal' | 'rush' | 'urgent';
  estimatedUnloadMinutes?: number;
}

export interface TicketInfo {
  ticketId: string;
  ticketType: string;
  status: string;
  priority: string;
  scheduledDate: string;
  scheduledTime?: string;
  assignedDriver?: string;
  materials: MaterialInfo[];
  jobAddress: string;
  city: string;
  customerName: string;
  createdAt: string;
}

export interface DriverInfo {
  id: string;
  name: string;
  vehicle: string;
  currentLoad: number;
  maxLoad: number;
  status: string;
  currentLocation?: string;
}

export interface MaterialInfo {
  productName: string;
  quantity: number;
  unit: string;
  weight?: number;
  fragile?: boolean;
}

export interface InventoryInfo {
  productId: string;
  productName: string;
  currentQty: number;
}

export interface NotificationContext {
  driverName?: string;
  customerName?: string;
  customerPhone?: string;
  pmName?: string;
  jobName?: string;
  address?: string;
  eta?: string;
}

export interface WeatherInfo {
  temp: number;
  condition: string;
  windSpeed: number;
  precipitation: number;
}

export interface PhotoInfo {
  photoType: string;
  ticketId: string;
}

export interface DriverMetrics {
  onTimeRate: number;
  photoComplianceRate: number;
  averageLoadTime: number;
  customerRating: number;
}

interface ConflictInfo {
  ticketId: string;
  conflictWith: string;
  reason: string;
  overlapMinutes: number;
}

interface BottleneckInfo {
  status: string;
  count: number;
  averageDwellMinutes: number;
  tickets: string[];
}

interface DailySummaryResult {
  date: string;
  totalTickets: number;
  completed: number;
  inProgress: number;
  cancelled: number;
  averageCompletionMinutes: number;
  onTimeRate: number;
  totalMaterialValue: number;
  driverBreakdown: Array<{
    driverId: string;
    ticketCount: number;
    completedCount: number;
  }>;
}

// ============================================
// CONSTANTS
// ============================================

// Huntsville, AL warehouse location
const WAREHOUSE_LAT = 34.7304;
const WAREHOUSE_LNG = -86.5861;

// Average speeds and times for the Huntsville metro area
const AVG_SPEED_MPH = 30;
const DEFAULT_UNLOAD_MINUTES = 15;
const RUSH_PRIORITY_WEIGHT = 2;
const URGENT_PRIORITY_WEIGHT = 5;

// Vehicle capacity in approximate weight units (lbs)
const VEHICLE_CAPACITIES: Record<string, number> = {
  'pickup': 2000,
  'flatbed': 5000,
  'box_truck': 8000,
  'trailer': 12000,
  'van': 1500,
};

// Status flow for each ticket type
const DELIVERY_STATUS_FLOW = [
  'created',
  'assigned',
  'materials_pulled',
  'load_verified',
  'en_route',
  'arrived',
  'delivered',
  'proof_captured',
  'qc_photos',
  'completed',
];

const PICKUP_STATUS_FLOW = [
  'created',
  'assigned',
  'en_route',
  'arrived',
  'picked_up',
  'proof_captured',
  'completed',
];

const RETURN_STATUS_FLOW = [
  'created',
  'assigned',
  'en_route',
  'arrived',
  'picked_up',
  'proof_captured',
  'completed',
];

// Required photos per status and ticket type
const PHOTO_REQUIREMENTS: Record<string, Record<string, string[]>> = {
  delivery: {
    load_verified: ['load_verification'],
    delivered: ['delivery_proof', 'job_site_before'],
    proof_captured: ['signature'],
    qc_photos: ['job_site_after', 'qc_inspection'],
  },
  pickup: {
    arrived: ['job_site_before'],
    picked_up: ['pickup_proof'],
    proof_captured: ['signature'],
  },
  return: {
    arrived: ['job_site_before'],
    picked_up: ['return_proof', 'damage_report'],
    proof_captured: ['signature'],
  },
};

// Required actions before a status transition is allowed
const REQUIRED_ACTIONS: Record<string, string[]> = {
  load_verified: ['photo:load_verification', 'checklist:verify_load'],
  en_route: ['assignment:driver', 'assignment:vehicle'],
  delivered: ['photo:delivery_proof'],
  proof_captured: ['photo:signature'],
  qc_photos: ['photo:qc_inspection'],
  completed: ['checklist:all_required'],
};

// ============================================
// SMART DELIVERY ENGINE
// ============================================

export class SmartDeliveryEngine {
  // ============================================
  // 1. SMART ROUTE OPTIMIZATION
  // ============================================

  /**
   * Optimize route using nearest-neighbor with priority weighting.
   * Urgent stops come first, then rush, then nearest-neighbor for normal stops.
   */
  optimizeRoute(stops: RouteStop[]): RouteStop[] {
    if (stops.length <= 1) return [...stops];

    const urgent = stops.filter(s => s.priority === 'urgent');
    const rush = stops.filter(s => s.priority === 'rush');
    const normal = stops.filter(s => s.priority === 'normal');

    const result: RouteStop[] = [];
    let currentLat = WAREHOUSE_LAT;
    let currentLng = WAREHOUSE_LNG;

    // Process urgent stops first, sorted by nearest neighbor within the group
    const sortedUrgent = this.nearestNeighborSort(urgent, currentLat, currentLng);
    for (const stop of sortedUrgent) {
      result.push(stop);
      currentLat = stop.lat ?? currentLat;
      currentLng = stop.lng ?? currentLng;
    }

    // Then rush stops
    const sortedRush = this.nearestNeighborSort(rush, currentLat, currentLng);
    for (const stop of sortedRush) {
      result.push(stop);
      currentLat = stop.lat ?? currentLat;
      currentLng = stop.lng ?? currentLng;
    }

    // Then normal stops using nearest neighbor from current position
    const sortedNormal = this.nearestNeighborSort(normal, currentLat, currentLng);
    for (const stop of sortedNormal) {
      result.push(stop);
    }

    return result;
  }

  /**
   * Estimate total drive time + unload time for all stops in order.
   * Returns total minutes including warehouse-to-first-stop and last-stop-to-warehouse.
   */
  estimateRouteTime(stops: RouteStop[]): number {
    if (stops.length === 0) return 0;

    let totalMinutes = 0;
    let currentLat = WAREHOUSE_LAT;
    let currentLng = WAREHOUSE_LNG;

    for (const stop of stops) {
      const stopLat = stop.lat ?? WAREHOUSE_LAT;
      const stopLng = stop.lng ?? WAREHOUSE_LNG;

      const distMiles = this.haversineDistance(currentLat, currentLng, stopLat, stopLng);
      const driveMinutes = (distMiles / AVG_SPEED_MPH) * 60;
      const unloadMinutes = stop.estimatedUnloadMinutes ?? DEFAULT_UNLOAD_MINUTES;

      totalMinutes += driveMinutes + unloadMinutes;
      currentLat = stopLat;
      currentLng = stopLng;
    }

    // Add return trip to warehouse
    const lastStop = stops[stops.length - 1];
    const lastLat = lastStop.lat ?? WAREHOUSE_LAT;
    const lastLng = lastStop.lng ?? WAREHOUSE_LNG;
    const returnDist = this.haversineDistance(lastLat, lastLng, WAREHOUSE_LAT, WAREHOUSE_LNG);
    totalMinutes += (returnDist / AVG_SPEED_MPH) * 60;

    return Math.round(totalMinutes);
  }

  /**
   * Suggest the best driver for a set of tickets based on location proximity,
   * vehicle capacity, and current load count.
   */
  suggestDriverAssignment(
    tickets: TicketInfo[],
    drivers: DriverInfo[]
  ): { driverId: string; driverName: string; score: number; reason: string } | null {
    const availableDrivers = drivers.filter(
      d => d.status === 'Available' || d.status === 'available'
    );

    if (availableDrivers.length === 0) return null;

    // Calculate total weight needed
    const totalWeight = tickets.reduce((sum, t) => {
      return sum + t.materials.reduce((mSum, m) => mSum + (m.weight ?? 50) * m.quantity, 0);
    }, 0);

    // Calculate centroid of delivery addresses for distance scoring
    const ticketCities = tickets.map(t => t.city);

    let bestDriver: DriverInfo | null = null;
    let bestScore = -Infinity;
    let bestReason = '';

    for (const driver of availableDrivers) {
      let score = 0;
      const reasons: string[] = [];

      // Capacity check: can the vehicle handle the load?
      const vehicleCapacity = this.getVehicleCapacity(driver.vehicle);
      const remainingCapacity = driver.maxLoad > 0
        ? driver.maxLoad - driver.currentLoad
        : vehicleCapacity - driver.currentLoad;

      if (remainingCapacity < tickets.length) {
        // Penalize drivers near capacity
        score -= 50;
        reasons.push('near capacity');
      } else {
        score += 20;
        reasons.push('has capacity');
      }

      // Weight check
      if (totalWeight > vehicleCapacity) {
        score -= 100; // Vehicle cannot handle the weight
        reasons.push('vehicle too small for weight');
      } else {
        const utilizationRatio = totalWeight / vehicleCapacity;
        // Prefer vehicles that are well-utilized but not overloaded
        if (utilizationRatio > 0.5 && utilizationRatio <= 1.0) {
          score += 15;
          reasons.push('good vehicle utilization');
        }
      }

      // Current load: prefer drivers with fewer current stops
      score -= driver.currentLoad * 5;
      if (driver.currentLoad === 0) {
        score += 10;
        reasons.push('no current load');
      }

      // Location proximity (if driver has a current location that matches a city)
      if (driver.currentLocation) {
        const isNearDelivery = ticketCities.some(
          city => driver.currentLocation?.toLowerCase().includes(city.toLowerCase())
        );
        if (isNearDelivery) {
          score += 25;
          reasons.push('near delivery area');
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestDriver = driver;
        bestReason = reasons.join(', ');
      }
    }

    if (!bestDriver) return null;

    return {
      driverId: bestDriver.id,
      driverName: bestDriver.name,
      score: bestScore,
      reason: bestReason,
    };
  }

  // ============================================
  // 2. AUTOMATED STATUS PROGRESSION
  // ============================================

  /**
   * Returns the next logical status in the workflow for the given ticket type.
   */
  getNextStatus(currentStatus: string, ticketType: string): string | null {
    const flow = this.getStatusFlow(ticketType);
    const currentIndex = flow.indexOf(currentStatus);

    if (currentIndex === -1 || currentIndex >= flow.length - 1) return null;
    return flow[currentIndex + 1];
  }

  /**
   * Validate whether a status transition is allowed.
   */
  validateStatusTransition(from: string, to: string): boolean {
    // Always allow transition to cancelled
    if (to === 'cancelled') return true;

    // Check all possible flows
    const flows = [DELIVERY_STATUS_FLOW, PICKUP_STATUS_FLOW, RETURN_STATUS_FLOW];

    for (const flow of flows) {
      const fromIndex = flow.indexOf(from);
      const toIndex = flow.indexOf(to);

      if (fromIndex !== -1 && toIndex !== -1) {
        // Allow forward transitions only (next step or skipping to completed)
        if (toIndex === fromIndex + 1) return true;
        // Allow skipping directly to completed from late stages
        if (to === 'completed' && fromIndex >= flow.length - 3) return true;
      }
    }

    return false;
  }

  /**
   * Returns the list of required actions before moving to the given status.
   */
  getRequiredActionsForStatus(status: string): string[] {
    return REQUIRED_ACTIONS[status] || [];
  }

  // ============================================
  // 3. SMART NOTIFICATIONS
  // ============================================

  /**
   * Generate appropriate notification messages for each stakeholder based on status change.
   */
  generateStatusNotification(
    ticketId: string,
    status: string,
    context: NotificationContext
  ): Record<string, string> {
    const notifications: Record<string, string> = {};
    const jobRef = context.jobName || ticketId;
    const addr = context.address || 'the job site';

    switch (status) {
      case 'assigned':
        notifications.driver = `New delivery assigned: ${jobRef} at ${addr}. Check your portal for details.`;
        notifications.customer = `Hi ${context.customerName || 'valued customer'}! Your RCRS delivery has been scheduled. We'll notify you when the driver is on the way.`;
        notifications.office = `[ASSIGNED] ${ticketId} assigned to ${context.driverName || 'driver'} for ${jobRef}.`;
        notifications.pm = `Delivery ${ticketId} for ${jobRef} has been assigned to ${context.driverName || 'a driver'}.`;
        break;

      case 'materials_pulled':
        notifications.driver = `Materials pulled for ${jobRef}. Please verify the load at the warehouse.`;
        notifications.office = `[MATERIALS PULLED] ${ticketId} - materials ready for load verification.`;
        break;

      case 'load_verified':
        notifications.driver = `Load verified for ${jobRef}. Ready to depart when scheduled.`;
        notifications.office = `[LOAD VERIFIED] ${ticketId} - ${context.driverName || 'Driver'} confirmed load.`;
        break;

      case 'en_route':
        notifications.driver = `Navigate to ${addr}. Drive safe!`;
        notifications.customer = `Your RCRS delivery is on the way! Driver ${context.driverName || ''} is heading to ${addr}.${context.eta ? ` ETA: ${context.eta}.` : ''} Call (256) 274-8530 with questions.`;
        notifications.office = `[EN ROUTE] ${context.driverName || 'Driver'} departed for ${jobRef} at ${addr}.`;
        notifications.pm = `Driver ${context.driverName || ''} is en route to ${jobRef}.${context.eta ? ` ETA: ${context.eta}.` : ''}`;
        break;

      case 'arrived':
        notifications.customer = `Your RCRS driver has arrived at ${addr}. Delivery in progress!`;
        notifications.office = `[ARRIVED] ${context.driverName || 'Driver'} arrived at ${jobRef}.`;
        notifications.pm = `Driver arrived at ${jobRef} (${addr}).`;
        break;

      case 'delivered':
        notifications.driver = `Delivery complete at ${jobRef}. Please capture photos and signature.`;
        notifications.customer = `Your RCRS delivery to ${addr} is complete! Thank you for choosing River City Roofing Solutions. Call (256) 274-8530 with any questions.`;
        notifications.office = `[DELIVERED] ${ticketId} materials unloaded at ${jobRef} by ${context.driverName || 'driver'}.`;
        notifications.pm = `Materials delivered to ${jobRef}. Awaiting proof capture.`;
        break;

      case 'proof_captured':
        notifications.office = `[PROOF] Delivery proof captured for ${ticketId} at ${jobRef}.`;
        notifications.pm = `Proof of delivery captured for ${jobRef}. Ticket closing.`;
        break;

      case 'completed':
        notifications.driver = `Ticket ${ticketId} fully completed. Great work!`;
        notifications.office = `[COMPLETED] ${ticketId} for ${jobRef} is fully closed.`;
        notifications.pm = `Delivery ticket ${ticketId} for ${jobRef} has been completed and invoiced.`;
        break;

      case 'cancelled':
        notifications.driver = `Ticket ${ticketId} for ${jobRef} has been cancelled.`;
        notifications.customer = `Your RCRS delivery for ${addr} has been cancelled. We apologize for any inconvenience. Call (256) 274-8530 for more information.`;
        notifications.office = `[CANCELLED] ${ticketId} for ${jobRef} cancelled.`;
        notifications.pm = `Delivery ${ticketId} for ${jobRef} has been cancelled.`;
        break;

      default:
        notifications.office = `[STATUS] ${ticketId} updated to ${status}.`;
        break;
    }

    return notifications;
  }

  /**
   * Determine who should be notified for a given status change.
   */
  getNotificationRecipients(ticketId: string, status: string): string[] {
    const recipientMap: Record<string, string[]> = {
      created: ['office'],
      assigned: ['driver', 'customer', 'office', 'pm'],
      materials_pulled: ['driver', 'office'],
      load_verified: ['driver', 'office'],
      en_route: ['driver', 'customer', 'office', 'pm'],
      arrived: ['customer', 'office', 'pm'],
      delivered: ['driver', 'customer', 'office', 'pm'],
      picked_up: ['driver', 'office', 'pm'],
      proof_captured: ['office', 'pm'],
      qc_photos: ['office', 'pm'],
      completed: ['driver', 'office', 'pm'],
      cancelled: ['driver', 'customer', 'office', 'pm'],
    };

    return recipientMap[status] || ['office'];
  }

  /**
   * Check if a ticket needs manager attention (escalation).
   * Returns true for overdue tickets, high-value orders, or stalled workflows.
   */
  shouldEscalate(ticket: TicketInfo): boolean {
    // Check if ticket is overdue (scheduled date has passed and not completed)
    const now = new Date();
    const scheduledDate = new Date(ticket.scheduledDate + 'T23:59:59');
    const isOverdue = scheduledDate < now &&
      !['completed', 'cancelled'].includes(ticket.status);

    if (isOverdue) return true;

    // Check if ticket is urgent and not yet en_route
    if (ticket.priority === 'urgent') {
      const urgentStatuses = ['created', 'assigned', 'materials_pulled'];
      if (urgentStatuses.includes(ticket.status)) return true;
    }

    // Check if ticket has been in the same status for too long
    const createdAt = new Date(ticket.createdAt);
    const hoursInStatus = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    // Created tickets that have sat for more than 4 hours
    if (ticket.status === 'created' && hoursInStatus > 4) return true;

    // Assigned tickets not moving for more than 8 hours
    if (ticket.status === 'assigned' && hoursInStatus > 8) return true;

    // High value deliveries (more than 10 materials or any ticket with many materials)
    if (ticket.materials.length > 10) return true;

    return false;
  }

  // ============================================
  // 4. LOADING LOGIC
  // ============================================

  /**
   * Suggest optimal loading order: heavy items first on the bottom, fragile last,
   * items for later stops loaded first (so first-stop items are on top/accessible).
   */
  generateLoadingOrder(materials: MaterialInfo[]): MaterialInfo[] {
    const sorted = [...materials].sort((a, b) => {
      // Fragile items always go last (loaded on top)
      if (a.fragile && !b.fragile) return 1;
      if (!a.fragile && b.fragile) return -1;

      // Among non-fragile: heavier items first (go on bottom)
      const weightA = (a.weight ?? 50) * a.quantity;
      const weightB = (b.weight ?? 50) * b.quantity;

      return weightB - weightA;
    });

    return sorted;
  }

  /**
   * Check if all materials fit on the assigned vehicle type.
   * Returns { fits: boolean, totalWeight: number, capacity: number, utilization: number }.
   */
  validateLoadCapacity(
    materials: MaterialInfo[],
    vehicleType: string
  ): { fits: boolean; totalWeight: number; capacity: number; utilization: number } {
    const capacity = this.getVehicleCapacity(vehicleType);
    const totalWeight = materials.reduce(
      (sum, m) => sum + (m.weight ?? 50) * m.quantity,
      0
    );
    const utilization = capacity > 0 ? totalWeight / capacity : 0;

    return {
      fits: totalWeight <= capacity,
      totalWeight,
      capacity,
      utilization: Math.round(utilization * 100) / 100,
    };
  }

  /**
   * Check stock levels before pull. Returns items that are out of stock or have insufficient quantity.
   */
  flagMissingMaterials(
    orderMaterials: MaterialInfo[],
    inventoryLevels: InventoryInfo[]
  ): Array<{ productName: string; needed: number; available: number; shortfall: number }> {
    const missing: Array<{ productName: string; needed: number; available: number; shortfall: number }> = [];

    for (const material of orderMaterials) {
      const inventoryItem = inventoryLevels.find(
        inv => inv.productName.toLowerCase() === material.productName.toLowerCase()
      );

      const available = inventoryItem?.currentQty ?? 0;

      if (available < material.quantity) {
        missing.push({
          productName: material.productName,
          needed: material.quantity,
          available,
          shortfall: material.quantity - available,
        });
      }
    }

    return missing;
  }

  // ============================================
  // 5. DELIVERY WINDOW MANAGEMENT
  // ============================================

  /**
   * Calculate a realistic delivery window based on the scheduled time and number of stops
   * before this delivery.
   */
  calculateDeliveryWindow(
    scheduledTime: string,
    stopsBeforeThis: number
  ): { earliest: string; latest: string; windowMinutes: number } {
    // Parse scheduled time (expected format: "HH:MM" or "HH:MM AM/PM")
    const baseTime = this.parseTime(scheduledTime);

    // Each prior stop adds ~30 min of variability
    const bufferMinutes = Math.min(stopsBeforeThis * 15, 60); // Cap at 60 min buffer

    const earliest = new Date(baseTime.getTime() - bufferMinutes * 60000);
    const latest = new Date(baseTime.getTime() + bufferMinutes * 60000 + 30 * 60000); // +30 min base window

    const windowMinutes = Math.round((latest.getTime() - earliest.getTime()) / 60000);

    return {
      earliest: this.formatTime(earliest),
      latest: this.formatTime(latest),
      windowMinutes,
    };
  }

  /**
   * Check if a new ticket conflicts with existing tickets for the same driver on the same date.
   */
  detectConflicts(newTicket: TicketInfo, existingTickets: TicketInfo[]): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];

    // Only check tickets on the same date for the same driver
    const sameDateTickets = existingTickets.filter(
      t =>
        t.scheduledDate === newTicket.scheduledDate &&
        t.assignedDriver === newTicket.assignedDriver &&
        t.ticketId !== newTicket.ticketId &&
        !['completed', 'cancelled'].includes(t.status)
    );

    if (!newTicket.scheduledTime) return conflicts;

    const newTime = this.parseTime(newTicket.scheduledTime);
    const newDuration = this.estimateTicketDuration(newTicket);

    for (const existing of sameDateTickets) {
      if (!existing.scheduledTime) continue;

      const existingTime = this.parseTime(existing.scheduledTime);
      const existingDuration = this.estimateTicketDuration(existing);

      const newEnd = new Date(newTime.getTime() + newDuration * 60000);
      const existingEnd = new Date(existingTime.getTime() + existingDuration * 60000);

      // Check overlap
      if (newTime < existingEnd && newEnd > existingTime) {
        const overlapStart = Math.max(newTime.getTime(), existingTime.getTime());
        const overlapEnd = Math.min(newEnd.getTime(), existingEnd.getTime());
        const overlapMinutes = Math.round((overlapEnd - overlapStart) / 60000);

        conflicts.push({
          ticketId: newTicket.ticketId,
          conflictWith: existing.ticketId,
          reason: `Time overlap: ${this.formatTime(newTime)}-${this.formatTime(newEnd)} conflicts with ${existing.ticketId} (${this.formatTime(existingTime)}-${this.formatTime(existingEnd)})`,
          overlapMinutes,
        });
      }
    }

    return conflicts;
  }

  /**
   * Suggest alternative delivery times based on detected conflicts.
   */
  suggestAlternativeTime(conflicts: ConflictInfo[]): string[] {
    if (conflicts.length === 0) return [];

    const suggestions: string[] = [];

    const businessStart = 7; // 7 AM
    const businessEnd = 17; // 5 PM

    // Extract conflict time windows from their reason strings
    const conflictWindows: Array<{ start: number; end: number }> = [];
    for (const conflict of conflicts) {
      // Parse the conflict time ranges from the reason string (e.g., "Time overlap: HH:MM-HH:MM conflicts with ...")
      const match = conflict.reason.match(/(\d{2}:\d{2})-(\d{2}:\d{2}) conflicts with .+ \((\d{2}:\d{2})-(\d{2}:\d{2})\)/);
      if (match) {
        const newStart = this.parseTime(match[1]).getTime();
        const newEnd = this.parseTime(match[2]).getTime();
        const existStart = this.parseTime(match[3]).getTime();
        const existEnd = this.parseTime(match[4]).getTime();
        conflictWindows.push(
          { start: newStart, end: newEnd },
          { start: existStart, end: existEnd }
        );
      }
    }

    for (let hour = businessStart; hour < businessEnd; hour++) {
      for (const minutes of [0, 30]) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        const time = this.parseTime(timeStr);
        const timeMs = time.getTime();

        // Check if this time avoids all conflict windows (with 30 min buffer)
        const bufferMs = 30 * 60000;
        let hasConflict = false;
        for (const window of conflictWindows) {
          if (timeMs >= window.start - bufferMs && timeMs <= window.end + bufferMs) {
            hasConflict = true;
            break;
          }
        }

        if (!hasConflict) {
          suggestions.push(timeStr);
        }
      }
    }

    // If all times have potential conflicts, suggest early morning and late afternoon
    if (suggestions.length === 0) {
      suggestions.push('07:00', '07:30', '16:00', '16:30');
    }

    return suggestions.slice(0, 5); // Return top 5 suggestions
  }

  // ============================================
  // 6. PERFORMANCE TRACKING
  // ============================================

  /**
   * Calculate a composite driver score (0-100) based on key performance metrics.
   */
  calculateDriverScore(driverId: string, metrics: DriverMetrics): number {
    // Weights for each component
    const weights = {
      onTime: 0.35,
      photoCompliance: 0.25,
      loadTime: 0.15,
      customerRating: 0.25,
    };

    // On-time rate: 0-1, already normalized
    const onTimeScore = metrics.onTimeRate * 100;

    // Photo compliance: 0-1, already normalized
    const photoScore = metrics.photoComplianceRate * 100;

    // Load time: lower is better. Baseline is 30 min. Score inversely.
    const baselineLoadMinutes = 30;
    const loadTimeScore = Math.max(0, Math.min(100,
      (baselineLoadMinutes / Math.max(metrics.averageLoadTime, 1)) * 100
    ));

    // Customer rating: 0-5 scale, normalize to 0-100
    const customerScore = (metrics.customerRating / 5) * 100;

    const composite =
      onTimeScore * weights.onTime +
      photoScore * weights.photoCompliance +
      loadTimeScore * weights.loadTime +
      customerScore * weights.customerRating;

    return Math.round(Math.max(0, Math.min(100, composite)));
  }

  /**
   * Identify workflow bottlenecks - statuses where tickets are getting stuck.
   */
  identifyBottlenecks(tickets: TicketInfo[]): BottleneckInfo[] {
    const activeTickets = tickets.filter(
      t => !['completed', 'cancelled'].includes(t.status)
    );

    // Group by status
    const statusGroups: Record<string, TicketInfo[]> = {};
    for (const ticket of activeTickets) {
      if (!statusGroups[ticket.status]) {
        statusGroups[ticket.status] = [];
      }
      statusGroups[ticket.status].push(ticket);
    }

    const now = new Date();
    const bottlenecks: BottleneckInfo[] = [];

    for (const [status, group] of Object.entries(statusGroups)) {
      if (group.length < 2) continue; // Only flag if multiple tickets are stuck

      // Calculate average dwell time in this status
      const totalDwellMinutes = group.reduce((sum, t) => {
        const created = new Date(t.createdAt);
        return sum + (now.getTime() - created.getTime()) / (1000 * 60);
      }, 0);
      const avgDwell = totalDwellMinutes / group.length;

      // Flag as bottleneck if average dwell > 120 min (2 hours) or 3+ tickets stuck
      if (avgDwell > 120 || group.length >= 3) {
        bottlenecks.push({
          status,
          count: group.length,
          averageDwellMinutes: Math.round(avgDwell),
          tickets: group.map(t => t.ticketId),
        });
      }
    }

    // Sort by severity (count * avgDwell)
    bottlenecks.sort(
      (a, b) => b.count * b.averageDwellMinutes - a.count * a.averageDwellMinutes
    );

    return bottlenecks;
  }

  /**
   * Generate an end-of-day summary with stats for the given date.
   */
  generateDailySummary(date: string, tickets: TicketInfo[]): DailySummaryResult {
    const dayTickets = tickets.filter(t => t.scheduledDate === date);

    const completed = dayTickets.filter(t => t.status === 'completed');
    const cancelled = dayTickets.filter(t => t.status === 'cancelled');
    const inProgress = dayTickets.filter(
      t => !['completed', 'cancelled'].includes(t.status)
    );

    // Calculate average completion time (createdAt to scheduledDate + rough estimate)
    let totalCompletionMinutes = 0;
    let completionCount = 0;
    for (const ticket of completed) {
      const created = new Date(ticket.createdAt);
      // Use end-of-scheduled-date as rough completion time
      const completedAt = new Date(ticket.scheduledDate + 'T17:00:00');
      const minutes = (completedAt.getTime() - created.getTime()) / (1000 * 60);
      if (minutes > 0) {
        totalCompletionMinutes += minutes;
        completionCount++;
      }
    }

    // On-time rate: completed tickets that finished on or before their scheduled date
    // Since we lack a completedAt timestamp, compare the summary date with scheduled date
    const summaryDate = new Date(date + 'T23:59:59');
    const onTimeCount = completed.filter(t => {
      const scheduled = new Date(t.scheduledDate + 'T23:59:59');
      return summaryDate <= scheduled;
    }).length;

    // Total material value estimate
    const totalMaterialValue = dayTickets.reduce((sum, t) => {
      return sum + t.materials.reduce((mSum, m) => mSum + m.quantity * (m.weight ?? 1), 0);
    }, 0);

    // Driver breakdown
    const driverMap: Record<string, { total: number; completed: number }> = {};
    for (const ticket of dayTickets) {
      const driverId = ticket.assignedDriver || 'unassigned';
      if (!driverMap[driverId]) {
        driverMap[driverId] = { total: 0, completed: 0 };
      }
      driverMap[driverId].total++;
      if (ticket.status === 'completed') {
        driverMap[driverId].completed++;
      }
    }

    return {
      date,
      totalTickets: dayTickets.length,
      completed: completed.length,
      inProgress: inProgress.length,
      cancelled: cancelled.length,
      averageCompletionMinutes: completionCount > 0
        ? Math.round(totalCompletionMinutes / completionCount)
        : 0,
      onTimeRate: dayTickets.length > 0
        ? Math.round((onTimeCount / Math.max(completed.length, 1)) * 100) / 100
        : 0,
      totalMaterialValue,
      driverBreakdown: Object.entries(driverMap).map(([driverId, stats]) => ({
        driverId,
        ticketCount: stats.total,
        completedCount: stats.completed,
      })),
    };
  }

  // ============================================
  // 7. WEATHER INTEGRATION
  // ============================================

  /**
   * Assess the impact of weather on deliveries for a given date.
   * Returns an impact assessment with recommendation.
   */
  getWeatherImpact(
    date: string,
    weatherData?: WeatherInfo
  ): { impact: 'none' | 'minor' | 'moderate' | 'severe'; recommendation: string; details: string } {
    if (!weatherData) {
      return {
        impact: 'none',
        recommendation: 'No weather data available. Proceed as normal.',
        details: 'Weather data not provided.',
      };
    }

    const issues: string[] = [];
    const impactLevels = ['none', 'minor', 'moderate', 'severe'] as const;
    type ImpactLevel = typeof impactLevels[number];
    let impactIndex = 0; // Start at 'none'

    const raiseImpact = (level: ImpactLevel) => {
      const idx = impactLevels.indexOf(level);
      if (idx > impactIndex) impactIndex = idx;
    };

    // Check precipitation
    if (weatherData.precipitation > 50) {
      issues.push(`High precipitation chance (${weatherData.precipitation}%)`);
      raiseImpact('moderate');
    } else if (weatherData.precipitation > 30) {
      issues.push(`Moderate precipitation chance (${weatherData.precipitation}%)`);
      raiseImpact('minor');
    }

    // Check wind
    if (weatherData.windSpeed > 30) {
      issues.push(`Dangerous winds (${weatherData.windSpeed} mph)`);
      raiseImpact('severe');
    } else if (weatherData.windSpeed > 20) {
      issues.push(`High winds (${weatherData.windSpeed} mph)`);
      raiseImpact('moderate');
    }

    // Check temperature extremes
    if (weatherData.temp > 105) {
      issues.push(`Extreme heat (${weatherData.temp}F) - heat safety risk`);
      raiseImpact('severe');
    } else if (weatherData.temp > 95) {
      issues.push(`High heat (${weatherData.temp}F) - schedule early/late`);
      raiseImpact('minor');
    } else if (weatherData.temp < 32) {
      issues.push(`Freezing conditions (${weatherData.temp}F) - ice/slip risk`);
      raiseImpact('moderate');
    }

    // Check condition
    const severeConditions = ['thunderstorm', 'severe', 'tornado', 'hail'];
    const conditionLower = weatherData.condition.toLowerCase();
    if (severeConditions.some(c => conditionLower.includes(c))) {
      issues.push(`Severe weather: ${weatherData.condition}`);
      raiseImpact('severe');
    } else if (conditionLower.includes('rain') || conditionLower.includes('storm')) {
      issues.push(`Weather condition: ${weatherData.condition}`);
      raiseImpact('moderate');
    }

    const impact = impactLevels[impactIndex];

    // Generate recommendation
    let recommendation = 'Proceed with deliveries as scheduled.';
    if (impact === 'minor') {
      recommendation = 'Minor weather concerns. Proceed with caution. Ensure tarps/covers for materials.';
    } else if (impact === 'moderate') {
      recommendation = 'Weather may cause delays. Consider rescheduling non-urgent deliveries. Protect materials from elements.';
    } else if (impact === 'severe') {
      recommendation = 'Severe weather expected. Strongly recommend delaying all non-emergency deliveries for safety.';
    }

    return {
      impact,
      recommendation,
      details: issues.length > 0 ? issues.join('; ') : 'Good conditions for deliveries.',
    };
  }

  /**
   * Recommend whether a delivery should be delayed based on weather data.
   */
  shouldDelayDelivery(weatherData: WeatherInfo): boolean {
    // Delay if severe conditions
    if (weatherData.windSpeed > 30) return true;
    if (weatherData.temp > 105 || weatherData.temp < 25) return true;
    if (weatherData.precipitation > 70) return true;

    const conditionLower = weatherData.condition.toLowerCase();
    if (conditionLower.includes('thunderstorm') || conditionLower.includes('tornado')) return true;
    if (conditionLower.includes('severe') || conditionLower.includes('hail')) return true;
    if (conditionLower.includes('ice') || conditionLower.includes('blizzard')) return true;

    return false;
  }

  // ============================================
  // 8. PHOTO REQUIREMENTS ENGINE
  // ============================================

  /**
   * Get the list of required photo types for the current ticket type and status.
   */
  getRequiredPhotos(ticketType: string, status: string): string[] {
    const typeKey = ticketType.toLowerCase();
    const requirements = PHOTO_REQUIREMENTS[typeKey];
    if (!requirements) return [];
    return requirements[status] || [];
  }

  /**
   * Check if all required photos have been taken for the current status.
   */
  validatePhotoCompliance(
    ticketId: string,
    photos: PhotoInfo[],
    ticketType: string = 'delivery',
    status: string = 'delivered'
  ): { compliant: boolean; missing: string[]; taken: string[] } {
    const required = this.getRequiredPhotos(ticketType, status);
    const ticketPhotos = photos.filter(p => p.ticketId === ticketId);
    const takenTypes = new Set(ticketPhotos.map(p => p.photoType));

    const missing = required.filter(req => !takenTypes.has(req));
    const taken = required.filter(req => takenTypes.has(req));

    return {
      compliant: missing.length === 0,
      missing,
      taken,
    };
  }

  /**
   * Generate TTS prompts reminding the driver what to photograph at the current stage.
   */
  generatePhotoPrompts(status: string, ticketType: string = 'delivery'): string {
    const required = this.getRequiredPhotos(ticketType, status);

    if (required.length === 0) {
      return 'No photos required for this step.';
    }

    const photoDescriptions: Record<string, string> = {
      load_verification: 'a photo of the loaded materials on the truck',
      delivery_proof: 'a photo of the materials at the delivery location',
      job_site_before: 'a photo of the job site before unloading',
      job_site_after: 'a photo of the job site after delivery',
      qc_inspection: 'a quality control inspection photo',
      signature: 'a photo of the customer signature',
      pickup_proof: 'a photo of the materials being picked up',
      return_proof: 'a photo of the returned materials',
      damage_report: 'a photo of any damage to materials',
    };

    const descriptions = required.map(
      r => photoDescriptions[r] || `a ${r.replace(/_/g, ' ')} photo`
    );

    if (descriptions.length === 1) {
      return `Please take ${descriptions[0]}.`;
    }

    const lastItem = descriptions.pop();
    return `Please take ${descriptions.join(', ')}, and ${lastItem}.`;
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  /**
   * Haversine distance between two lat/lng points in miles.
   */
  private haversineDistance(
    lat1: number, lng1: number,
    lat2: number, lng2: number
  ): number {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Sort stops using nearest-neighbor algorithm from a starting position.
   */
  private nearestNeighborSort(
    stops: RouteStop[],
    startLat: number,
    startLng: number
  ): RouteStop[] {
    if (stops.length <= 1) return [...stops];

    const result: RouteStop[] = [];
    const remaining = [...stops];
    let currentLat = startLat;
    let currentLng = startLng;

    while (remaining.length > 0) {
      let nearestIndex = 0;
      let nearestDist = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const stopLat = remaining[i].lat ?? WAREHOUSE_LAT;
        const stopLng = remaining[i].lng ?? WAREHOUSE_LNG;
        const dist = this.haversineDistance(currentLat, currentLng, stopLat, stopLng);

        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIndex = i;
        }
      }

      const nearest = remaining.splice(nearestIndex, 1)[0];
      result.push(nearest);
      currentLat = nearest.lat ?? currentLat;
      currentLng = nearest.lng ?? currentLng;
    }

    return result;
  }

  /**
   * Get the status flow array for a given ticket type.
   */
  private getStatusFlow(ticketType: string): string[] {
    switch (ticketType.toLowerCase()) {
      case 'pickup':
        return PICKUP_STATUS_FLOW;
      case 'return':
        return RETURN_STATUS_FLOW;
      case 'delivery':
      default:
        return DELIVERY_STATUS_FLOW;
    }
  }

  /**
   * Get vehicle weight capacity by type string.
   */
  private getVehicleCapacity(vehicleType: string): number {
    const normalized = vehicleType.toLowerCase().replace(/[^a-z_]/g, '');

    // Try exact match first
    if (VEHICLE_CAPACITIES[normalized]) {
      return VEHICLE_CAPACITIES[normalized];
    }

    // Try partial match
    for (const [key, capacity] of Object.entries(VEHICLE_CAPACITIES)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return capacity;
      }
    }

    // Default to pickup capacity
    return VEHICLE_CAPACITIES['pickup'];
  }

  /**
   * Parse a time string ("HH:MM", "H:MM AM/PM") into a Date object (today's date).
   */
  private parseTime(timeStr: string): Date {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    // Handle "HH:MM" format
    const match24 = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (match24) {
      const hours = parseInt(match24[1], 10);
      const minutes = parseInt(match24[2], 10);
      return new Date(`${today}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`);
    }

    // Handle "H:MM AM/PM" format
    const match12 = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match12) {
      let hours = parseInt(match12[1], 10);
      const minutes = parseInt(match12[2], 10);
      const ampm = match12[3].toUpperCase();

      if (ampm === 'PM' && hours !== 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;

      return new Date(`${today}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`);
    }

    // Fallback: 8 AM
    return new Date(`${today}T08:00:00`);
  }

  /**
   * Format a Date into "HH:MM" (24-hour) string.
   */
  private formatTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * Estimate how long a ticket's delivery will take (drive + unload) in minutes.
   */
  private estimateTicketDuration(ticket: TicketInfo): number {
    const materialCount = ticket.materials.length;
    const baseUnload = DEFAULT_UNLOAD_MINUTES + materialCount * 2;
    const baseDrive = 20; // Assume ~20 min avg drive within service area
    return baseDrive + baseUnload;
  }
}

// Export singleton instance
export const smartDeliveryEngine = new SmartDeliveryEngine();
