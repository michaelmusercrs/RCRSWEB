// Workflow Alerts & SLA Monitoring Service
// Handles bottleneck detection, SLA violations, and proactive notifications

import { JobFlowStage, JOB_FLOW_STAGES, getStageDetails, MaterialOrderWorkflow } from './material-job-flow';
import { DeliveryTicket, TicketStatus } from './delivery-workflow-service';

export interface SLAAlert {
  alertId: string;
  alertType: 'sla_warning' | 'sla_violation' | 'bottleneck' | 'duplicate' | 'low_stock' | 'eta_update';
  severity: 'low' | 'medium' | 'high' | 'critical';
  ticketId?: string;
  jobId?: string;
  stage?: string;
  message: string;
  details: string;
  assignedTo?: string;
  notifyRoles: string[];
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  status: 'active' | 'acknowledged' | 'resolved' | 'escalated';
}

export interface PerformanceMetrics {
  userId: string;
  userName: string;
  role: string;
  period: 'daily' | 'weekly' | 'monthly';
  periodStart: string;
  periodEnd: string;

  // Delivery metrics
  totalDeliveries: number;
  onTimeDeliveries: number;
  lateDeliveries: number;
  onTimeRate: number;

  // Time metrics
  avgDeliveryTime: number; // minutes from assignment to completion
  avgLoadTime: number; // minutes for loading verification
  avgTransitTime: number; // minutes in transit
  avgUnloadTime: number; // minutes for unloading

  // Quality metrics
  photoCompliance: number; // percentage of required photos taken
  signatureCompliance: number; // percentage of signatures captured
  checklistCompliance: number; // percentage of checklists completed

  // Issue tracking
  stockAdjustments: number;
  customerComplaints: number;
  damageReports: number;
}

// SLA time limits in minutes for each stage
const STAGE_SLA_LIMITS: Record<TicketStatus, { warning: number; violation: number }> = {
  'created': { warning: 30, violation: 60 },
  'assigned': { warning: 15, violation: 30 },
  'materials_pulled': { warning: 60, violation: 120 },
  'load_verified': { warning: 20, violation: 45 },
  'en_route': { warning: 90, violation: 180 },
  'arrived': { warning: 10, violation: 20 },
  'delivered': { warning: 30, violation: 60 },
  'picked_up': { warning: 30, violation: 60 },
  'proof_captured': { warning: 10, violation: 20 },
  'qc_photos': { warning: 15, violation: 30 },
  'completed': { warning: 5, violation: 15 },
  'cancelled': { warning: 0, violation: 0 },
};

class WorkflowAlertsService {
  private alerts: SLAAlert[] = [];

  // Generate unique ID for alerts
  private generateAlertId(): string {
    return `ALT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }

  // Check if a ticket stage has exceeded SLA limits
  checkStageSLA(ticket: DeliveryTicket, currentStageStartTime: string): SLAAlert | null {
    const stageStart = new Date(currentStageStartTime);
    const now = new Date();
    const elapsedMinutes = (now.getTime() - stageStart.getTime()) / (1000 * 60);

    const limits = STAGE_SLA_LIMITS[ticket.status];
    if (!limits) return null;

    if (elapsedMinutes >= limits.violation) {
      return this.createAlert({
        alertType: 'sla_violation',
        severity: 'critical',
        ticketId: ticket.ticketId,
        jobId: ticket.jobId,
        stage: ticket.status,
        message: `SLA VIOLATION: ${ticket.status} stage exceeded time limit`,
        details: `Ticket ${ticket.ticketId} has been in "${ticket.status}" for ${Math.round(elapsedMinutes)} minutes (limit: ${limits.violation} min). Job: ${ticket.jobName}`,
        assignedTo: ticket.assignedDriver,
        notifyRoles: ['admin', 'office', 'project_manager'],
      });
    } else if (elapsedMinutes >= limits.warning) {
      return this.createAlert({
        alertType: 'sla_warning',
        severity: 'medium',
        ticketId: ticket.ticketId,
        jobId: ticket.jobId,
        stage: ticket.status,
        message: `SLA Warning: ${ticket.status} approaching time limit`,
        details: `Ticket ${ticket.ticketId} has been in "${ticket.status}" for ${Math.round(elapsedMinutes)} minutes (warning at: ${limits.warning} min). Job: ${ticket.jobName}`,
        assignedTo: ticket.assignedDriver,
        notifyRoles: ['office'],
      });
    }

    return null;
  }

  // Detect bottlenecks across all active tickets
  detectBottlenecks(tickets: DeliveryTicket[]): SLAAlert[] {
    const stageCounts: Record<TicketStatus, DeliveryTicket[]> = {} as any;
    const alerts: SLAAlert[] = [];

    // Group tickets by status
    tickets.forEach(ticket => {
      if (!stageCounts[ticket.status]) {
        stageCounts[ticket.status] = [];
      }
      stageCounts[ticket.status].push(ticket);
    });

    // Check for bottlenecks (more than 3 tickets stuck at same stage)
    Object.entries(stageCounts).forEach(([status, ticketsInStage]) => {
      if (ticketsInStage.length >= 3 && status !== 'completed' && status !== 'cancelled') {
        alerts.push(this.createAlert({
          alertType: 'bottleneck',
          severity: ticketsInStage.length >= 5 ? 'high' : 'medium',
          stage: status,
          message: `Bottleneck detected at "${status}" stage`,
          details: `${ticketsInStage.length} tickets are stuck at the "${status}" stage. Tickets: ${ticketsInStage.map(t => t.ticketId).join(', ')}`,
          notifyRoles: ['admin', 'office'],
        }));
      }
    });

    return alerts;
  }

  // Check for potential duplicate orders
  checkDuplicateOrder(newOrder: {
    jobId: string;
    jobAddress: string;
    requestedDate: string;
    materials: string;
  }, existingTickets: DeliveryTicket[]): SLAAlert | null {
    // Look for tickets to same address on same date
    const potentialDuplicates = existingTickets.filter(ticket =>
      ticket.status !== 'completed' &&
      ticket.status !== 'cancelled' &&
      ticket.jobAddress.toLowerCase() === newOrder.jobAddress.toLowerCase() &&
      ticket.requestedDate === newOrder.requestedDate
    );

    if (potentialDuplicates.length > 0) {
      return this.createAlert({
        alertType: 'duplicate',
        severity: 'high',
        jobId: newOrder.jobId,
        message: `Potential duplicate order detected`,
        details: `A new order for ${newOrder.jobAddress} on ${newOrder.requestedDate} may duplicate existing ticket(s): ${potentialDuplicates.map(t => t.ticketId).join(', ')}. Please verify before proceeding.`,
        notifyRoles: ['office', 'project_manager'],
      });
    }

    return null;
  }

  // Check for low stock before pulling materials
  checkMaterialAvailability(
    materials: Array<{ productId: string; productName: string; quantity: number }>,
    inventory: Array<{ productId: string; productName: string; currentQty: number; minQty: number }>
  ): SLAAlert[] {
    const alerts: SLAAlert[] = [];

    materials.forEach(material => {
      const inventoryItem = inventory.find(i => i.productId === material.productId);

      if (!inventoryItem) {
        alerts.push(this.createAlert({
          alertType: 'low_stock',
          severity: 'high',
          message: `Product not found in inventory: ${material.productName}`,
          details: `Cannot fulfill order for ${material.quantity} of ${material.productName} - product not in inventory system`,
          notifyRoles: ['office', 'admin'],
        }));
      } else if (inventoryItem.currentQty < material.quantity) {
        alerts.push(this.createAlert({
          alertType: 'low_stock',
          severity: 'critical',
          message: `Insufficient stock: ${material.productName}`,
          details: `Order requires ${material.quantity} but only ${inventoryItem.currentQty} available. Short by ${material.quantity - inventoryItem.currentQty}`,
          notifyRoles: ['office', 'admin'],
        }));
      } else if (inventoryItem.currentQty - material.quantity < inventoryItem.minQty) {
        alerts.push(this.createAlert({
          alertType: 'low_stock',
          severity: 'medium',
          message: `Stock will fall below minimum: ${material.productName}`,
          details: `After this order, ${material.productName} will have ${inventoryItem.currentQty - material.quantity} remaining (min: ${inventoryItem.minQty}). Consider reordering.`,
          notifyRoles: ['office'],
        }));
      }
    });

    return alerts;
  }

  // Generate ETA notification when driver is approaching
  generateETANotification(
    ticket: DeliveryTicket,
    currentLocation: { lat: number; lng: number },
    destination: { lat: number; lng: number }
  ): SLAAlert | null {
    const distance = this.calculateDistance(
      currentLocation.lat, currentLocation.lng,
      destination.lat, destination.lng
    );

    // Estimate time at 30 mph average
    const etaMinutes = Math.round((distance / 30) * 60);

    // Notify when 15 minutes away or less
    if (etaMinutes <= 15 && etaMinutes > 0) {
      return this.createAlert({
        alertType: 'eta_update',
        severity: 'low',
        ticketId: ticket.ticketId,
        jobId: ticket.jobId,
        message: `Driver arriving in approximately ${etaMinutes} minutes`,
        details: `${ticket.assignedDriverName} is approximately ${etaMinutes} minutes away from ${ticket.jobAddress}. Distance: ${distance.toFixed(1)} miles.`,
        notifyRoles: ['project_manager'],
      });
    }

    return null;
  }

  // Calculate distance between two GPS points
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

  // Create alert object
  private createAlert(data: Omit<SLAAlert, 'alertId' | 'createdAt' | 'status'>): SLAAlert {
    const alert: SLAAlert = {
      ...data,
      alertId: this.generateAlertId(),
      createdAt: new Date().toISOString(),
      status: 'active',
    };

    this.alerts.push(alert);
    return alert;
  }

  // Validate workflow transition
  validateStageTransition(
    currentStatus: TicketStatus,
    newStatus: TicketStatus,
    ticket: DeliveryTicket
  ): { valid: boolean; message: string; warnings: string[] } {
    const warnings: string[] = [];

    // Define valid transitions
    const validTransitions: Record<TicketStatus, TicketStatus[]> = {
      'created': ['assigned', 'cancelled'],
      'assigned': ['materials_pulled', 'cancelled'],
      'materials_pulled': ['load_verified', 'cancelled'],
      'load_verified': ['en_route', 'cancelled'],
      'en_route': ['arrived', 'cancelled'],
      'arrived': ['delivered', 'picked_up', 'cancelled'],
      'delivered': ['proof_captured', 'cancelled'],
      'picked_up': ['proof_captured', 'cancelled'],
      'proof_captured': ['qc_photos', 'completed', 'cancelled'],
      'qc_photos': ['completed', 'cancelled'],
      'completed': [],
      'cancelled': [],
    };

    const allowedNext = validTransitions[currentStatus];

    if (!allowedNext.includes(newStatus)) {
      return {
        valid: false,
        message: `Cannot transition from "${currentStatus}" to "${newStatus}". Allowed transitions: ${allowedNext.join(', ') || 'none'}`,
        warnings,
      };
    }

    // Check for missing requirements
    if (newStatus === 'en_route' && ticket.photoCount === 0) {
      warnings.push('No load verification photos uploaded - consider adding before departure');
    }

    if (newStatus === 'completed' && !ticket.customerSignature) {
      warnings.push('No customer signature captured');
    }

    if (newStatus === 'completed' && ticket.photoCount < 2) {
      warnings.push('Fewer than 2 photos - consider adding more documentation');
    }

    return {
      valid: true,
      message: 'Transition allowed',
      warnings,
    };
  }

  // Calculate performance metrics for a user
  calculatePerformanceMetrics(
    userId: string,
    userName: string,
    role: string,
    tickets: DeliveryTicket[],
    period: 'daily' | 'weekly' | 'monthly'
  ): PerformanceMetrics {
    // Calculate period bounds
    const now = new Date();
    let periodStart: Date;

    switch (period) {
      case 'daily':
        periodStart = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'weekly':
        periodStart = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'monthly':
        periodStart = new Date(now.setMonth(now.getMonth() - 1));
        break;
    }

    // Filter tickets for this user and period
    const userTickets = tickets.filter(t =>
      (t.assignedDriver === userId || t.createdBy === userId) &&
      new Date(t.createdAt) >= periodStart
    );

    const completedTickets = userTickets.filter(t => t.status === 'completed' && t.completedAt);

    // Calculate time metrics
    let totalDeliveryTime = 0;
    let totalLoadTime = 0;
    let totalTransitTime = 0;
    let totalUnloadTime = 0;
    let onTimeCount = 0;

    completedTickets.forEach(ticket => {
      if (ticket.assignedAt && ticket.completedAt) {
        const assignedTime = new Date(ticket.assignedAt).getTime();
        const completedTime = new Date(ticket.completedAt).getTime();
        totalDeliveryTime += (completedTime - assignedTime) / (1000 * 60);
      }

      if (ticket.assignedAt && ticket.loadVerifiedAt) {
        const assignedTime = new Date(ticket.assignedAt).getTime();
        const loadTime = new Date(ticket.loadVerifiedAt).getTime();
        totalLoadTime += (loadTime - assignedTime) / (1000 * 60);
      }

      if (ticket.departedAt && ticket.arrivedAt) {
        const departedTime = new Date(ticket.departedAt).getTime();
        const arrivedTime = new Date(ticket.arrivedAt).getTime();
        totalTransitTime += (arrivedTime - departedTime) / (1000 * 60);
      }

      if (ticket.arrivedAt && ticket.deliveredAt) {
        const arrivedTime = new Date(ticket.arrivedAt).getTime();
        const deliveredTime = new Date(ticket.deliveredAt).getTime();
        totalUnloadTime += (deliveredTime - arrivedTime) / (1000 * 60);
      }

      // Check if on time (within 30 min of scheduled time)
      if (ticket.scheduledDate && ticket.scheduledTime && ticket.arrivedAt) {
        const scheduled = new Date(`${ticket.scheduledDate}T${ticket.scheduledTime}`);
        const arrived = new Date(ticket.arrivedAt);
        const diffMinutes = (arrived.getTime() - scheduled.getTime()) / (1000 * 60);
        if (diffMinutes <= 30) onTimeCount++;
      }
    });

    const deliveryCount = completedTickets.length;

    // Calculate compliance
    const withSignature = completedTickets.filter(t => t.customerSignature).length;
    const withEnoughPhotos = completedTickets.filter(t => t.photoCount >= 2).length;
    const withChecklist = completedTickets.filter(t => t.checklistComplete).length;

    return {
      userId,
      userName,
      role,
      period,
      periodStart: periodStart.toISOString(),
      periodEnd: new Date().toISOString(),
      totalDeliveries: deliveryCount,
      onTimeDeliveries: onTimeCount,
      lateDeliveries: deliveryCount - onTimeCount,
      onTimeRate: deliveryCount > 0 ? Math.round((onTimeCount / deliveryCount) * 100) : 0,
      avgDeliveryTime: deliveryCount > 0 ? Math.round(totalDeliveryTime / deliveryCount) : 0,
      avgLoadTime: deliveryCount > 0 ? Math.round(totalLoadTime / deliveryCount) : 0,
      avgTransitTime: deliveryCount > 0 ? Math.round(totalTransitTime / deliveryCount) : 0,
      avgUnloadTime: deliveryCount > 0 ? Math.round(totalUnloadTime / deliveryCount) : 0,
      photoCompliance: deliveryCount > 0 ? Math.round((withEnoughPhotos / deliveryCount) * 100) : 0,
      signatureCompliance: deliveryCount > 0 ? Math.round((withSignature / deliveryCount) * 100) : 0,
      checklistCompliance: deliveryCount > 0 ? Math.round((withChecklist / deliveryCount) * 100) : 0,
      stockAdjustments: 0, // Would be populated from stock adjustment logs
      customerComplaints: 0, // Would be populated from complaint logs
      damageReports: 0, // Would be populated from damage reports
    };
  }

  // Get active alerts
  getActiveAlerts(): SLAAlert[] {
    return this.alerts.filter(a => a.status === 'active');
  }

  // Acknowledge alert
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.alertId === alertId);
    if (alert) {
      alert.status = 'acknowledged';
      alert.acknowledgedAt = new Date().toISOString();
    }
  }

  // Resolve alert
  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.alertId === alertId);
    if (alert) {
      alert.status = 'resolved';
      alert.resolvedAt = new Date().toISOString();
    }
  }

  // Get daily summary for dashboard
  getDailySummary(tickets: DeliveryTicket[]): {
    totalActive: number;
    completedToday: number;
    slaViolations: number;
    bottlenecks: number;
    avgCompletionTime: number;
    onTimeRate: number;
  } {
    const today = new Date().toISOString().slice(0, 10);
    const activeTickets = tickets.filter(t =>
      t.status !== 'completed' && t.status !== 'cancelled'
    );
    const completedToday = tickets.filter(t =>
      t.status === 'completed' &&
      t.completedAt?.startsWith(today)
    );

    const activeAlerts = this.getActiveAlerts();
    const violations = activeAlerts.filter(a => a.alertType === 'sla_violation').length;
    const bottleneckAlerts = activeAlerts.filter(a => a.alertType === 'bottleneck').length;

    // Calculate avg completion time for today
    let totalTime = 0;
    let onTimeCount = 0;
    completedToday.forEach(t => {
      if (t.assignedAt && t.completedAt) {
        const assigned = new Date(t.assignedAt).getTime();
        const completed = new Date(t.completedAt).getTime();
        totalTime += (completed - assigned) / (1000 * 60);
      }
      // Check if on time
      if (t.scheduledDate && t.scheduledTime && t.arrivedAt) {
        const scheduled = new Date(`${t.scheduledDate}T${t.scheduledTime}`);
        const arrived = new Date(t.arrivedAt);
        if (arrived <= new Date(scheduled.getTime() + 30 * 60 * 1000)) {
          onTimeCount++;
        }
      }
    });

    return {
      totalActive: activeTickets.length,
      completedToday: completedToday.length,
      slaViolations: violations,
      bottlenecks: bottleneckAlerts,
      avgCompletionTime: completedToday.length > 0 ? Math.round(totalTime / completedToday.length) : 0,
      onTimeRate: completedToday.length > 0 ? Math.round((onTimeCount / completedToday.length) * 100) : 0,
    };
  }
}

export const workflowAlertsService = new WorkflowAlertsService();
