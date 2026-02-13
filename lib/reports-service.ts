// Reports Service for River City Roofing Portal
// Provides comprehensive reporting powered by REAL data from Google Sheets,
// delivery workflow, and financial services.
//
// Data sources:
// - Delivery tickets (Google Sheets via delivery-workflow-service)
// - Invoices (Google Sheets via delivery-workflow-service)
// - Inventory (Google Sheets via google-sheets-service)
// - Team members (Google Sheets via google-sheets-service)
// - Commissions (Google Sheets via google-sheets-service)
// - Financial data (financial-service: commissions.json + invoice-service)

import { deliveryWorkflowService } from './delivery-workflow-service';
import { googleSheetsService } from './google-sheets-service';
import { financialService } from './financial-service';

export interface ReportFilter {
  dateFrom?: string;
  dateTo?: string;
  status?: string | string[];
  ticketType?: 'delivery' | 'pickup' | 'return' | 'all';
  driverId?: string;
  projectManagerId?: string;
  jobId?: string;
  minAmount?: number;
  maxAmount?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface DeliveryReport {
  dataSource: 'sheets' | 'none';
  totalDeliveries: number;
  completedDeliveries: number;
  pendingDeliveries: number;
  cancelledDeliveries: number;
  averageDeliveryTime: number; // in minutes
  totalMaterialValue: number;
  byDriver: Array<{
    driverId: string;
    driverName: string;
    deliveryCount: number;
    completedCount: number;
    averageTime: number;
    totalValue: number;
  }>;
  byDay: Array<{
    date: string;
    count: number;
    completed: number;
    value: number;
  }>;
  byStatus: Record<string, number>;
}

export interface BillingReport {
  dataSource: 'sheets' | 'financial-service' | 'none';
  totalInvoiced: number;
  totalPaid: number;
  totalPending: number;
  totalOverdue: number;
  invoiceCount: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  averageInvoiceAmount: number;
  averageDaysToPayment: number;
  byMonth: Array<{
    month: string;
    invoiced: number;
    paid: number;
    pending: number;
  }>;
  byCustomer: Array<{
    customerId: string;
    customerName: string;
    totalInvoiced: number;
    totalPaid: number;
    invoiceCount: number;
  }>;
}

export interface InventoryReport {
  dataSource: 'sheets' | 'none';
  totalProducts: number;
  totalValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  restocksPending: number;
  turnoverRate: number;
  byCategory: Array<{
    category: string;
    productCount: number;
    totalQty: number;
    totalValue: number;
    lowStockCount: number;
  }>;
  topMoving: Array<{
    productId: string;
    productName: string;
    usedQty: number;
    timesOrdered: number;
    revenue: number;
  }>;
  slowMoving: Array<{
    productId: string;
    productName: string;
    currentQty: number;
    daysInStock: number;
  }>;
}

export interface TeamPerformanceReport {
  dataSource: 'sheets' | 'none';
  totalTeamMembers: number;
  activeMembers: number;
  byRole: Record<string, number>;
  drivers: Array<{
    id: string;
    name: string;
    totalDeliveries: number;
    completedOnTime: number;
    averageRating: number;
    totalMaterialValue: number;
    avgDeliveryTime: number;
  }>;
  projectManagers: Array<{
    id: string;
    name: string;
    totalOrders: number;
    totalValue: number;
    avgOrderSize: number;
    completionRate: number;
  }>;
}

export interface MaterialJobFlowReport {
  dataSource: 'sheets' | 'none';
  stages: Array<{
    stage: string;
    avgTimeInStage: number; // minutes
    ticketsInStage: number;
    bottleneck: boolean;
  }>;
  averageTotalTime: number;
  byTicketType: Record<string, {
    count: number;
    avgTime: number;
    completionRate: number;
  }>;
  alerts: Array<{
    type: 'delay' | 'stuck' | 'overdue';
    ticketId: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
  }>;
}

// Status stages in workflow order for timing calculations
const WORKFLOW_STAGES = [
  'created', 'assigned', 'materials_pulled', 'load_verified',
  'en_route', 'arrived', 'delivered', 'proof_captured', 'qc_photos', 'completed',
] as const;

const STAGE_LABELS: Record<string, string> = {
  created: 'Order Created',
  assigned: 'Driver Assigned',
  materials_pulled: 'Materials Pulled',
  load_verified: 'Load Verified',
  en_route: 'En Route',
  arrived: 'Arrived',
  delivered: 'Delivered',
  proof_captured: 'Proof Captured',
  qc_photos: 'QC Photos',
  completed: 'Completed',
};

class ReportsService {
  // =========================================================================
  // Delivery Report — from delivery-workflow-service (Google Sheets)
  // =========================================================================
  async generateDeliveryReport(filter: ReportFilter): Promise<DeliveryReport> {
    try {
      const allTickets = await deliveryWorkflowService.getTickets();

      if (allTickets.length === 0) {
        return this.emptyDeliveryReport();
      }

      // Apply filters
      let tickets = allTickets;

      if (filter.dateFrom) {
        tickets = tickets.filter(t => t.createdAt >= filter.dateFrom!);
      }
      if (filter.dateTo) {
        tickets = tickets.filter(t => t.createdAt <= filter.dateTo!);
      }
      if (filter.ticketType && filter.ticketType !== 'all') {
        tickets = tickets.filter(t => t.ticketType === filter.ticketType);
      }
      if (filter.driverId) {
        tickets = tickets.filter(t => t.assignedDriver === filter.driverId);
      }
      if (filter.projectManagerId) {
        tickets = tickets.filter(t => t.projectManager === filter.projectManagerId);
      }
      if (filter.status) {
        const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
        tickets = tickets.filter(t => statuses.includes(t.status));
      }

      const completed = tickets.filter(t => t.status === 'completed');
      const pending = tickets.filter(t =>
        !['completed', 'cancelled'].includes(t.status)
      );
      const cancelled = tickets.filter(t => t.status === 'cancelled');

      // Calculate average delivery time from completed tickets with timestamps
      let totalDeliveryMinutes = 0;
      let timedDeliveries = 0;
      for (const t of completed) {
        if (t.createdAt && t.completedAt) {
          const diff = new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime();
          if (diff > 0) {
            totalDeliveryMinutes += diff / 60000;
            timedDeliveries++;
          }
        }
      }

      // Group by driver
      const driverMap = new Map<string, {
        driverId: string; driverName: string;
        deliveryCount: number; completedCount: number;
        totalMinutes: number; timedCount: number; totalValue: number;
      }>();

      for (const t of tickets) {
        const dId = t.assignedDriver || 'unassigned';
        const dName = t.assignedDriverName || 'Unassigned';
        if (!driverMap.has(dId)) {
          driverMap.set(dId, {
            driverId: dId, driverName: dName,
            deliveryCount: 0, completedCount: 0,
            totalMinutes: 0, timedCount: 0, totalValue: 0,
          });
        }
        const d = driverMap.get(dId)!;
        d.deliveryCount++;
        d.totalValue += t.totalMaterialCost || 0;
        if (t.status === 'completed') {
          d.completedCount++;
          if (t.createdAt && t.completedAt) {
            const diff = new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime();
            if (diff > 0) {
              d.totalMinutes += diff / 60000;
              d.timedCount++;
            }
          }
        }
      }

      // Group by day
      const dayMap = new Map<string, { count: number; completed: number; value: number }>();
      for (const t of tickets) {
        const day = (t.createdAt || '').slice(0, 10);
        if (!day) continue;
        if (!dayMap.has(day)) dayMap.set(day, { count: 0, completed: 0, value: 0 });
        const d = dayMap.get(day)!;
        d.count++;
        if (t.status === 'completed') d.completed++;
        d.value += t.totalMaterialCost || 0;
      }

      // Group by status
      const byStatus: Record<string, number> = {};
      for (const t of tickets) {
        byStatus[t.status] = (byStatus[t.status] || 0) + 1;
      }

      return {
        dataSource: 'sheets',
        totalDeliveries: tickets.length,
        completedDeliveries: completed.length,
        pendingDeliveries: pending.length,
        cancelledDeliveries: cancelled.length,
        averageDeliveryTime: timedDeliveries > 0
          ? Math.round(totalDeliveryMinutes / timedDeliveries)
          : 0,
        totalMaterialValue: Math.round(
          tickets.reduce((sum, t) => sum + (t.totalMaterialCost || 0), 0) * 100
        ) / 100,
        byDriver: Array.from(driverMap.values()).map(d => ({
          driverId: d.driverId,
          driverName: d.driverName,
          deliveryCount: d.deliveryCount,
          completedCount: d.completedCount,
          averageTime: d.timedCount > 0 ? Math.round(d.totalMinutes / d.timedCount) : 0,
          totalValue: Math.round(d.totalValue * 100) / 100,
        })),
        byDay: Array.from(dayMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, data]) => ({
            date,
            count: data.count,
            completed: data.completed,
            value: Math.round(data.value * 100) / 100,
          })),
        byStatus,
      };
    } catch (error) {
      console.error('[ReportsService] Error generating delivery report:', error);
      return this.emptyDeliveryReport();
    }
  }

  // =========================================================================
  // Billing Report — from delivery-workflow invoices + financial-service
  // =========================================================================
  async generateBillingReport(filter: ReportFilter): Promise<BillingReport> {
    try {
      // Try delivery workflow invoices first (Google Sheets)
      const invoices = await deliveryWorkflowService.getInvoices();

      if (invoices.length === 0) {
        // Fall back to financial service summary if no invoices in sheets
        return this.billingFromFinancialService(filter);
      }

      let filtered = invoices;
      if (filter.dateFrom) {
        filtered = filtered.filter(i => i.createdAt >= filter.dateFrom!);
      }
      if (filter.dateTo) {
        filtered = filtered.filter(i => i.createdAt <= filter.dateTo!);
      }
      if (filter.status) {
        const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
        filtered = filtered.filter(i => statuses.includes(i.status));
      }
      if (filter.minAmount !== undefined) {
        filtered = filtered.filter(i => i.total >= filter.minAmount!);
      }
      if (filter.maxAmount !== undefined) {
        filtered = filtered.filter(i => i.total <= filter.maxAmount!);
      }

      const now = new Date();
      const paid = filtered.filter(i => i.status === 'paid');
      const pending = filtered.filter(i => i.status === 'pending' || i.status === 'sent');
      const overdue = filtered.filter(i => {
        if (i.status === 'paid' || i.status === 'cancelled') return false;
        return i.dueDate && new Date(i.dueDate) < now && i.total > 0;
      });

      const totalInvoiced = filtered.reduce((s, i) => s + i.total, 0);
      const totalPaid = paid.reduce((s, i) => s + i.total, 0);
      const totalPending = pending.reduce((s, i) => s + i.total, 0);
      const totalOverdue = overdue.reduce((s, i) => s + i.total, 0);

      // Average days to payment for paid invoices
      let totalDays = 0;
      let countedPaid = 0;
      for (const inv of paid) {
        if (inv.paidAt && inv.createdAt) {
          const days = (new Date(inv.paidAt).getTime() - new Date(inv.createdAt).getTime()) / 86400000;
          if (days >= 0) {
            totalDays += days;
            countedPaid++;
          }
        }
      }

      // Group by month
      const monthMap = new Map<string, { invoiced: number; paid: number; pending: number }>();
      for (const inv of filtered) {
        const d = new Date(inv.createdAt);
        const key = `${d.toLocaleString('en-US', { month: 'short' })} ${d.getFullYear()}`;
        if (!monthMap.has(key)) monthMap.set(key, { invoiced: 0, paid: 0, pending: 0 });
        const m = monthMap.get(key)!;
        m.invoiced += inv.total;
        if (inv.status === 'paid') m.paid += inv.total;
        if (inv.status === 'pending' || inv.status === 'sent') m.pending += inv.total;
      }

      // Group by customer
      const custMap = new Map<string, { name: string; invoiced: number; paid: number; count: number }>();
      for (const inv of filtered) {
        const cId = inv.customerName || 'Unknown';
        if (!custMap.has(cId)) custMap.set(cId, { name: cId, invoiced: 0, paid: 0, count: 0 });
        const c = custMap.get(cId)!;
        c.invoiced += inv.total;
        if (inv.status === 'paid') c.paid += inv.total;
        c.count++;
      }

      return {
        dataSource: 'sheets',
        totalInvoiced: Math.round(totalInvoiced * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        totalPending: Math.round(totalPending * 100) / 100,
        totalOverdue: Math.round(totalOverdue * 100) / 100,
        invoiceCount: filtered.length,
        paidCount: paid.length,
        pendingCount: pending.length,
        overdueCount: overdue.length,
        averageInvoiceAmount: filtered.length > 0
          ? Math.round((totalInvoiced / filtered.length) * 100) / 100
          : 0,
        averageDaysToPayment: countedPaid > 0 ? Math.round(totalDays / countedPaid) : 0,
        byMonth: Array.from(monthMap.entries()).map(([month, data]) => ({
          month,
          invoiced: Math.round(data.invoiced * 100) / 100,
          paid: Math.round(data.paid * 100) / 100,
          pending: Math.round(data.pending * 100) / 100,
        })),
        byCustomer: Array.from(custMap.entries()).map(([id, data]) => ({
          customerId: id,
          customerName: data.name,
          totalInvoiced: Math.round(data.invoiced * 100) / 100,
          totalPaid: Math.round(data.paid * 100) / 100,
          invoiceCount: data.count,
        })),
      };
    } catch (error) {
      console.error('[ReportsService] Error generating billing report:', error);
      return this.emptyBillingReport();
    }
  }

  // =========================================================================
  // Inventory Report — from google-sheets-service Inventory sheet
  // =========================================================================
  async generateInventoryReport(filter: ReportFilter): Promise<InventoryReport> {
    try {
      const items = await googleSheetsService.getInventory();

      if (items.length === 0) {
        return this.emptyInventoryReport();
      }

      const lowStock = items.filter(i => i.quantity > 0 && i.quantity <= i.minStock);
      const outOfStock = items.filter(i => i.quantity === 0);

      // Group by category
      const catMap = new Map<string, {
        productCount: number; totalQty: number; totalValue: number; lowStockCount: number;
      }>();
      for (const item of items) {
        const cat = item.category || 'Uncategorized';
        if (!catMap.has(cat)) catMap.set(cat, { productCount: 0, totalQty: 0, totalValue: 0, lowStockCount: 0 });
        const c = catMap.get(cat)!;
        c.productCount++;
        c.totalQty += item.quantity;
        c.totalValue += item.price * item.quantity;
        if (item.quantity > 0 && item.quantity <= item.minStock) c.lowStockCount++;
      }

      const totalValue = items.reduce((s, i) => s + (i.price * i.quantity), 0);

      // We don't have real usage/movement data — return empty for topMoving/slowMoving
      return {
        dataSource: 'sheets',
        totalProducts: items.length,
        totalValue: Math.round(totalValue * 100) / 100,
        lowStockCount: lowStock.length,
        outOfStockCount: outOfStock.length,
        restocksPending: 0, // No restock tracking data available
        turnoverRate: 0, // No usage history to calculate turnover
        byCategory: Array.from(catMap.entries()).map(([category, data]) => ({
          category,
          productCount: data.productCount,
          totalQty: data.totalQty,
          totalValue: Math.round(data.totalValue * 100) / 100,
          lowStockCount: data.lowStockCount,
        })),
        topMoving: [], // No usage tracking data — not faking it
        slowMoving: [], // No usage tracking data — not faking it
      };
    } catch (error) {
      console.error('[ReportsService] Error generating inventory report:', error);
      return this.emptyInventoryReport();
    }
  }

  // =========================================================================
  // Team Performance Report — team from Sheets + delivery ticket data
  // =========================================================================
  async generateTeamPerformanceReport(filter: ReportFilter): Promise<TeamPerformanceReport> {
    try {
      const [teamMembers, tickets] = await Promise.all([
        googleSheetsService.getTeamMembers(),
        deliveryWorkflowService.getTickets(),
      ]);

      if (teamMembers.length === 0 && tickets.length === 0) {
        return this.emptyTeamPerformanceReport();
      }

      // Filter tickets by date if provided
      let filteredTickets = tickets;
      if (filter.dateFrom) filteredTickets = filteredTickets.filter(t => t.createdAt >= filter.dateFrom!);
      if (filter.dateTo) filteredTickets = filteredTickets.filter(t => t.createdAt <= filter.dateTo!);

      // Count by role from team members
      const byRole: Record<string, number> = {};
      for (const m of teamMembers) {
        const role = (m.category || m.position || 'unknown').toLowerCase();
        byRole[role] = (byRole[role] || 0) + 1;
      }

      // Driver stats from actual tickets
      const driverStats = new Map<string, {
        id: string; name: string;
        totalDeliveries: number; completedOnTime: number;
        totalValue: number; totalMinutes: number; timedCount: number;
      }>();

      for (const t of filteredTickets) {
        if (!t.assignedDriver) continue;
        const dId = t.assignedDriver;
        if (!driverStats.has(dId)) {
          driverStats.set(dId, {
            id: dId,
            name: t.assignedDriverName || dId,
            totalDeliveries: 0, completedOnTime: 0,
            totalValue: 0, totalMinutes: 0, timedCount: 0,
          });
        }
        const d = driverStats.get(dId)!;
        d.totalDeliveries++;
        d.totalValue += t.totalMaterialCost || 0;

        if (t.status === 'completed') {
          // Consider "on time" if completed within requested date
          if (t.completedAt && t.requestedDate) {
            const completedDate = t.completedAt.slice(0, 10);
            if (completedDate <= t.requestedDate) {
              d.completedOnTime++;
            }
          } else {
            d.completedOnTime++; // No date data = assume on time
          }

          if (t.createdAt && t.completedAt) {
            const diff = new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime();
            if (diff > 0) {
              d.totalMinutes += diff / 60000;
              d.timedCount++;
            }
          }
        }
      }

      // PM stats from tickets
      const pmStats = new Map<string, {
        id: string; name: string;
        totalOrders: number; totalValue: number; completedCount: number;
      }>();

      for (const t of filteredTickets) {
        if (!t.projectManager) continue;
        const pmId = t.projectManager;
        if (!pmStats.has(pmId)) {
          pmStats.set(pmId, {
            id: pmId,
            name: t.projectManager,
            totalOrders: 0, totalValue: 0, completedCount: 0,
          });
        }
        const p = pmStats.get(pmId)!;
        p.totalOrders++;
        p.totalValue += t.chargeAmount || 0;
        if (t.status === 'completed') p.completedCount++;
      }

      return {
        dataSource: teamMembers.length > 0 || tickets.length > 0 ? 'sheets' : 'none',
        totalTeamMembers: teamMembers.length,
        activeMembers: teamMembers.length, // All fetched members are active
        byRole,
        drivers: Array.from(driverStats.values()).map(d => ({
          id: d.id,
          name: d.name,
          totalDeliveries: d.totalDeliveries,
          completedOnTime: d.completedOnTime,
          averageRating: 0, // No rating system data available
          totalMaterialValue: Math.round(d.totalValue * 100) / 100,
          avgDeliveryTime: d.timedCount > 0 ? Math.round(d.totalMinutes / d.timedCount) : 0,
        })),
        projectManagers: Array.from(pmStats.values()).map(p => ({
          id: p.id,
          name: p.name,
          totalOrders: p.totalOrders,
          totalValue: Math.round(p.totalValue * 100) / 100,
          avgOrderSize: p.totalOrders > 0 ? Math.round((p.totalValue / p.totalOrders) * 100) / 100 : 0,
          completionRate: p.totalOrders > 0
            ? Math.round((p.completedCount / p.totalOrders) * 10000) / 100
            : 0,
        })),
      };
    } catch (error) {
      console.error('[ReportsService] Error generating team performance report:', error);
      return this.emptyTeamPerformanceReport();
    }
  }

  // =========================================================================
  // Job Flow Report — real workflow stages from delivery tickets
  // =========================================================================
  async generateJobFlowReport(filter: ReportFilter): Promise<MaterialJobFlowReport> {
    try {
      const allTickets = await deliveryWorkflowService.getTickets();

      if (allTickets.length === 0) {
        return this.emptyJobFlowReport();
      }

      let tickets = allTickets;
      if (filter.dateFrom) tickets = tickets.filter(t => t.createdAt >= filter.dateFrom!);
      if (filter.dateTo) tickets = tickets.filter(t => t.createdAt <= filter.dateTo!);
      if (filter.ticketType && filter.ticketType !== 'all') {
        tickets = tickets.filter(t => t.ticketType === filter.ticketType);
      }

      // Count tickets currently in each stage
      const stageCountMap: Record<string, number> = {};
      for (const t of tickets) {
        if (t.status !== 'completed' && t.status !== 'cancelled') {
          stageCountMap[t.status] = (stageCountMap[t.status] || 0) + 1;
        }
      }

      // Calculate average time in each stage from completed tickets
      // We use the workflow timestamp fields on the ticket
      const timestampFields: Record<string, string> = {
        created: 'createdAt',
        assigned: 'assignedAt',
        materials_pulled: 'materialsPulledAt',
        load_verified: 'loadVerifiedAt',
        en_route: 'departedAt',
        arrived: 'arrivedAt',
        delivered: 'deliveredAt',
        proof_captured: 'proofCapturedAt',
        qc_photos: 'qcPhotosAt',
        completed: 'completedAt',
      };

      const stageTimesMinutes: Record<string, number[]> = {};
      for (const stage of WORKFLOW_STAGES) {
        stageTimesMinutes[stage] = [];
      }

      for (const t of tickets.filter(tk => tk.status === 'completed')) {
        for (let i = 0; i < WORKFLOW_STAGES.length - 1; i++) {
          const curStage = WORKFLOW_STAGES[i];
          const nextStage = WORKFLOW_STAGES[i + 1];
          const curField = timestampFields[curStage];
          const nextField = timestampFields[nextStage];
          const curTime = (t as any)[curField];
          const nextTime = (t as any)[nextField];

          if (curTime && nextTime) {
            const diff = (new Date(nextTime).getTime() - new Date(curTime).getTime()) / 60000;
            if (diff >= 0) {
              stageTimesMinutes[curStage].push(diff);
            }
          }
        }
      }

      // Build stages array
      const stages = WORKFLOW_STAGES.filter(s => s !== 'completed').map(stage => {
        const times = stageTimesMinutes[stage];
        const avgTime = times.length > 0
          ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
          : 0;
        return {
          stage: STAGE_LABELS[stage] || stage,
          avgTimeInStage: avgTime,
          ticketsInStage: stageCountMap[stage] || 0,
          bottleneck: false, // Will mark below
        };
      });

      // Mark bottlenecks: stages with above-average time AND tickets waiting
      if (stages.length > 0) {
        const avgOfAvgs = stages.reduce((s, st) => s + st.avgTimeInStage, 0) / stages.length;
        for (const stage of stages) {
          stage.bottleneck = stage.avgTimeInStage > avgOfAvgs * 1.5 && stage.ticketsInStage > 0;
        }
      }

      // Total average time
      const completedTickets = tickets.filter(t => t.status === 'completed' && t.createdAt && t.completedAt);
      let averageTotalTime = 0;
      if (completedTickets.length > 0) {
        const totalMins = completedTickets.reduce((s, t) => {
          return s + (new Date(t.completedAt!).getTime() - new Date(t.createdAt).getTime()) / 60000;
        }, 0);
        averageTotalTime = Math.round(totalMins / completedTickets.length);
      }

      // By ticket type
      const byTicketType: Record<string, { count: number; avgTime: number; completionRate: number }> = {};
      const typeGroups = new Map<string, typeof tickets>();
      for (const t of tickets) {
        const type = t.ticketType || 'delivery';
        if (!typeGroups.has(type)) typeGroups.set(type, []);
        typeGroups.get(type)!.push(t);
      }
      for (const [type, group] of typeGroups) {
        const comp = group.filter(t => t.status === 'completed');
        let avgTime = 0;
        if (comp.length > 0) {
          const totalM = comp.reduce((s, t) => {
            if (t.createdAt && t.completedAt) {
              return s + (new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime()) / 60000;
            }
            return s;
          }, 0);
          avgTime = Math.round(totalM / comp.length);
        }
        byTicketType[type] = {
          count: group.length,
          avgTime,
          completionRate: group.length > 0
            ? Math.round((comp.length / group.length) * 1000) / 10
            : 0,
        };
      }

      // Real alerts: tickets stuck in a stage too long
      const alerts: MaterialJobFlowReport['alerts'] = [];
      const now = new Date();
      const TWO_HOURS = 2 * 60 * 60 * 1000;
      const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

      for (const t of tickets) {
        if (t.status === 'completed' || t.status === 'cancelled') continue;

        // Get the timestamp of the current status
        const currentTimestamp = (t as any)[timestampFields[t.status]] || t.createdAt;
        if (!currentTimestamp) continue;
        const elapsed = now.getTime() - new Date(currentTimestamp).getTime();

        if (elapsed > THREE_DAYS) {
          alerts.push({
            type: 'stuck',
            ticketId: t.ticketId,
            message: `Ticket stuck in ${STAGE_LABELS[t.status] || t.status} for ${Math.round(elapsed / 86400000)}+ days`,
            severity: 'high',
          });
        } else if (elapsed > TWO_HOURS && ['materials_pulled', 'en_route'].includes(t.status)) {
          alerts.push({
            type: 'delay',
            ticketId: t.ticketId,
            message: `Ticket in ${STAGE_LABELS[t.status] || t.status} for ${Math.round(elapsed / 3600000)}+ hours`,
            severity: 'medium',
          });
        }
      }

      // Check for overdue invoices via delivery workflow
      try {
        const invoices = await deliveryWorkflowService.getInvoices();
        for (const inv of invoices) {
          if (inv.status !== 'paid' && inv.status !== 'cancelled' && inv.dueDate) {
            const dueDate = new Date(inv.dueDate);
            if (dueDate < now) {
              const daysOverdue = Math.round((now.getTime() - dueDate.getTime()) / 86400000);
              alerts.push({
                type: 'overdue',
                ticketId: inv.ticketId || inv.invoiceId,
                message: `Invoice ${inv.invoiceId} overdue by ${daysOverdue} days`,
                severity: daysOverdue > 30 ? 'high' : 'medium',
              });
            }
          }
        }
      } catch { /* invoices optional */ }

      return {
        dataSource: 'sheets',
        stages,
        averageTotalTime,
        byTicketType,
        alerts,
      };
    } catch (error) {
      console.error('[ReportsService] Error generating job flow report:', error);
      return this.emptyJobFlowReport();
    }
  }

  // =========================================================================
  // CSV Export (unchanged — works on any data)
  // =========================================================================
  exportToCSV(data: any[], filename: string): string {
    if (!data || data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header => {
          const value = row[header];
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ];

    return csvRows.join('\n');
  }

  // =========================================================================
  // Filter builder for UI (unchanged)
  // =========================================================================
  getAvailableFilters(reportType: string): Array<{
    field: string;
    label: string;
    type: 'date' | 'select' | 'multiselect' | 'number' | 'text';
    options?: Array<{ value: string; label: string }>;
  }> {
    const commonFilters = [
      { field: 'dateFrom', label: 'Start Date', type: 'date' as const },
      { field: 'dateTo', label: 'End Date', type: 'date' as const },
    ];

    switch (reportType) {
      case 'delivery':
        return [
          ...commonFilters,
          {
            field: 'status',
            label: 'Status',
            type: 'multiselect' as const,
            options: [
              { value: 'created', label: 'Created' },
              { value: 'assigned', label: 'Assigned' },
              { value: 'materials_pulled', label: 'Materials Pulled' },
              { value: 'load_verified', label: 'Load Verified' },
              { value: 'en_route', label: 'En Route' },
              { value: 'arrived', label: 'Arrived' },
              { value: 'delivered', label: 'Delivered' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
            ],
          },
          {
            field: 'ticketType',
            label: 'Ticket Type',
            type: 'select' as const,
            options: [
              { value: 'all', label: 'All Types' },
              { value: 'delivery', label: 'Delivery' },
              { value: 'pickup', label: 'Pickup' },
              { value: 'return', label: 'Return' },
            ],
          },
          {
            field: 'driverId',
            label: 'Driver',
            type: 'select' as const,
            options: [
              { value: '', label: 'All Drivers' },
            ],
          },
          {
            field: 'projectManagerId',
            label: 'Project Manager',
            type: 'select' as const,
            options: [
              { value: '', label: 'All PMs' },
            ],
          },
        ];

      case 'billing':
        return [
          ...commonFilters,
          {
            field: 'status',
            label: 'Invoice Status',
            type: 'multiselect' as const,
            options: [
              { value: 'pending', label: 'Pending' },
              { value: 'sent', label: 'Sent' },
              { value: 'paid', label: 'Paid' },
              { value: 'overdue', label: 'Overdue' },
              { value: 'cancelled', label: 'Cancelled' },
            ],
          },
          { field: 'minAmount', label: 'Min Amount', type: 'number' as const },
          { field: 'maxAmount', label: 'Max Amount', type: 'number' as const },
        ];

      case 'inventory':
        return [
          {
            field: 'category',
            label: 'Category',
            type: 'multiselect' as const,
            options: [
              { value: 'shingles', label: 'Shingles' },
              { value: 'underlayment', label: 'Underlayment' },
              { value: 'flashing', label: 'Flashing' },
              { value: 'fasteners', label: 'Fasteners' },
              { value: 'ventilation', label: 'Ventilation' },
              { value: 'gutters', label: 'Gutters' },
              { value: 'accessories', label: 'Accessories' },
            ],
          },
          {
            field: 'stockLevel',
            label: 'Stock Level',
            type: 'select' as const,
            options: [
              { value: '', label: 'All Levels' },
              { value: 'low', label: 'Low Stock' },
              { value: 'out', label: 'Out of Stock' },
              { value: 'normal', label: 'Normal' },
            ],
          },
        ];

      case 'team':
        return [
          ...commonFilters,
          {
            field: 'role',
            label: 'Role',
            type: 'multiselect' as const,
            options: [
              { value: 'owner', label: 'Owner' },
              { value: 'admin', label: 'Admin' },
              { value: 'office', label: 'Office' },
              { value: 'project_manager', label: 'Project Manager' },
              { value: 'driver', label: 'Driver' },
              { value: 'viewer', label: 'Viewer' },
            ],
          },
        ];

      case 'jobflow':
        return [
          ...commonFilters,
          {
            field: 'ticketType',
            label: 'Ticket Type',
            type: 'select' as const,
            options: [
              { value: 'all', label: 'All Types' },
              { value: 'delivery', label: 'Delivery' },
              { value: 'pickup', label: 'Pickup' },
              { value: 'return', label: 'Return' },
            ],
          },
          {
            field: 'showAlerts',
            label: 'Show Alerts Only',
            type: 'select' as const,
            options: [
              { value: 'false', label: 'All Items' },
              { value: 'true', label: 'Alerts Only' },
            ],
          },
        ];

      default:
        return commonFilters;
    }
  }

  // =========================================================================
  // Fallback: billing from financial-service (commissions.json + invoices)
  // =========================================================================
  private async billingFromFinancialService(filter: ReportFilter): Promise<BillingReport> {
    try {
      const summary = await financialService.getFinancialSummary();
      const revenueByPeriod = await financialService.getRevenueByPeriod('month', 6);

      return {
        dataSource: 'financial-service',
        totalInvoiced: summary.revenueYTD,
        totalPaid: summary.revenueYTD - summary.accountsReceivable,
        totalPending: summary.accountsReceivable - summary.overdueAmount,
        totalOverdue: summary.overdueAmount,
        invoiceCount: summary.outstandingInvoices + summary.overdueInvoices,
        paidCount: 0, // Can't determine exact count from summary
        pendingCount: summary.outstandingInvoices,
        overdueCount: summary.overdueInvoices,
        averageInvoiceAmount: 0,
        averageDaysToPayment: 0,
        byMonth: revenueByPeriod.map(p => ({
          month: p.periodLabel,
          invoiced: p.revenue,
          paid: p.revenue - (p.revenue * 0.1), // rough estimate
          pending: p.revenue * 0.1,
        })),
        byCustomer: [], // No per-customer breakdown available from commissions
      };
    } catch {
      return this.emptyBillingReport();
    }
  }

  // =========================================================================
  // Empty report factories — explicit "no data" states
  // =========================================================================
  private emptyDeliveryReport(): DeliveryReport {
    return {
      dataSource: 'none',
      totalDeliveries: 0, completedDeliveries: 0, pendingDeliveries: 0,
      cancelledDeliveries: 0, averageDeliveryTime: 0, totalMaterialValue: 0,
      byDriver: [], byDay: [], byStatus: {},
    };
  }

  private emptyBillingReport(): BillingReport {
    return {
      dataSource: 'none',
      totalInvoiced: 0, totalPaid: 0, totalPending: 0, totalOverdue: 0,
      invoiceCount: 0, paidCount: 0, pendingCount: 0, overdueCount: 0,
      averageInvoiceAmount: 0, averageDaysToPayment: 0,
      byMonth: [], byCustomer: [],
    };
  }

  private emptyInventoryReport(): InventoryReport {
    return {
      dataSource: 'none',
      totalProducts: 0, totalValue: 0, lowStockCount: 0,
      outOfStockCount: 0, restocksPending: 0, turnoverRate: 0,
      byCategory: [], topMoving: [], slowMoving: [],
    };
  }

  private emptyTeamPerformanceReport(): TeamPerformanceReport {
    return {
      dataSource: 'none',
      totalTeamMembers: 0, activeMembers: 0, byRole: {},
      drivers: [], projectManagers: [],
    };
  }

  private emptyJobFlowReport(): MaterialJobFlowReport {
    return {
      dataSource: 'none',
      stages: [], averageTotalTime: 0, byTicketType: {}, alerts: [],
    };
  }
}

export const reportsService = new ReportsService();
