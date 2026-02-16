/**
 * Unified Data Service for River City Roofing
 * Aggregates data from all sources (JobNimbus, inventory, orders, team)
 * and provides consistent stats for dashboards with appropriate caching.
 */

import { cache, CACHE_TTL } from './cache';
import { jobNimbusService, isJobNimbusConfigured } from './jobnimbus-service';
import { inventoryProducts, getLowStockItems, getTotalInventoryValue, getInventoryCategories } from './inventoryData';
import { materialOrders, getOrdersByStatus, getPendingOrders, getRecentOrders } from './materialOrders';
import { teamMembers } from './teamData';

// =============================================================================
// Types
// =============================================================================

export interface UnifiedDashboardStats {
  // Jobs & Contacts (from JobNimbus)
  jobs: {
    total: number;
    active: number;
    completed: number;
    pending: number;
    thisMonth: number;
  };
  contacts: {
    total: number;
    leads: number;
    customers: number;
  };
  estimates: {
    total: number;
    pending: number;
    approved: number;
    totalValue: number;
  };
  tasks: {
    total: number;
    overdue: number;
    dueToday: number;
  };

  // Inventory
  inventory: {
    totalProducts: number;
    totalValue: number;
    lowStockCount: number;
    categories: number;
  };

  // Orders
  orders: {
    total: number;
    pending: number;
    approved: number;
    shipped: number;
    delivered: number;
    todayDeliveries: number;
  };

  // Team
  team: {
    totalMembers: number;
    activeToday: number;
    salesReps: number;
    production: number;
  };

  // Deliveries
  deliveries: {
    active: number;
    completedToday: number;
    scheduled: number;
  };

  // Meta
  lastUpdated: string;
  dataSource: 'live' | 'cached' | 'fallback';
}

export interface CommandCenterStats {
  // Sales Performance
  sales: {
    todayTotal: number;
    weekTotal: number;
    monthTotal: number;
    topPerformers: Array<{
      name: string;
      avatar: string;
      sales: number;
      rank: number;
    }>;
  };

  // Operations
  activeJobs: number;
  inventoryAlerts: number;
  scheduledToday: number;
  teamActive: number;

  // Recent Activity
  recentActivity: Array<{
    type: 'sale' | 'delivery' | 'inventory' | 'call' | 'job';
    icon: string;
    color: string;
    text: string;
    detail: string;
    time: string;
  }>;

  // Today's Schedule
  todaySchedule: Array<{
    time: string;
    title: string;
    type: 'meeting' | 'job' | 'call' | 'delivery';
  }>;

  lastUpdated: string;
}

// =============================================================================
// Cache Keys
// =============================================================================

const CACHE_KEYS = {
  JOBNIMBUS_STATS: 'unified:jobnimbus:stats',
  DASHBOARD_STATS: 'unified:dashboard:stats',
  COMMAND_CENTER_STATS: 'unified:command:stats',
} as const;

// =============================================================================
// Unified Data Service
// =============================================================================

class UnifiedDataService {
  /**
   * Get comprehensive dashboard stats from all data sources
   * Uses 5-minute cache for JobNimbus data
   */
  async getDashboardStats(): Promise<UnifiedDashboardStats> {
    // Check cache first
    const cached = cache.get<UnifiedDashboardStats>(CACHE_KEYS.DASHBOARD_STATS);
    if (cached) {
      return { ...cached, dataSource: 'cached' };
    }

    const stats = await this.fetchDashboardStats();

    // Cache for 5 minutes
    cache.set(CACHE_KEYS.DASHBOARD_STATS, stats, CACHE_TTL.MEDIUM);

    return stats;
  }

  /**
   * Get command center specific stats
   */
  async getCommandCenterStats(): Promise<CommandCenterStats> {
    const cached = cache.get<CommandCenterStats>(CACHE_KEYS.COMMAND_CENTER_STATS);
    if (cached) {
      return cached;
    }

    const stats = await this.fetchCommandCenterStats();

    // Cache for 2 minutes (command center needs fresher data)
    cache.set(CACHE_KEYS.COMMAND_CENTER_STATS, stats, 2 * 60 * 1000);

    return stats;
  }

  /**
   * Force refresh all cached data
   */
  async refreshAll(): Promise<void> {
    cache.invalidatePattern('unified:');
  }

  // =============================================================================
  // Private Methods
  // =============================================================================

  private async fetchDashboardStats(): Promise<UnifiedDashboardStats> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Fetch JobNimbus data if configured
    let jnStats = {
      contacts: 0,
      jobs: 0,
      estimates: 0,
      tasks: 0,
    };

    let jobDetails = {
      active: 0,
      completed: 0,
      pending: 0,
      thisMonth: 0,
    };

    let contactDetails = {
      leads: 0,
      customers: 0,
    };

    let estimateDetails = {
      pending: 0,
      approved: 0,
      totalValue: 0,
    };

    let taskDetails = {
      overdue: 0,
      dueToday: 0,
    };

    if (isJobNimbusConfigured()) {
      try {
        // Get overall stats
        jnStats = await jobNimbusService.getStats();

        // Get detailed job data for status breakdown
        const jobsResponse = await jobNimbusService.getJobs({ limit: 100 });
        const jobs = jobsResponse.results || [];

        jobs.forEach(job => {
          const status = String(job.status || '').toLowerCase();
          if (['completed', 'closed', 'complete'].includes(status)) {
            jobDetails.completed++;
          } else if (['in progress', 'work in progress', 'scheduled'].includes(status)) {
            jobDetails.active++;
          } else {
            jobDetails.pending++;
          }

          // Check if created this month
          if (job.created_at && new Date(job.created_at * 1000) >= startOfMonth) {
            jobDetails.thisMonth++;
          }
        });

        // Get detailed contact data
        const contactsResponse = await jobNimbusService.getContacts({ limit: 100 });
        const contacts = contactsResponse.results || [];

        contacts.forEach(contact => {
          const status = (contact.status || '').toLowerCase();
          if (['lead', 'new', 'prospect'].includes(status)) {
            contactDetails.leads++;
          } else {
            contactDetails.customers++;
          }
        });

        // Get estimate details
        const estimatesResponse = await jobNimbusService.getEstimates({ limit: 100 });
        const estimates = estimatesResponse.results || [];

        estimates.forEach(estimate => {
          const status = (estimate.status || '').toLowerCase();
          if (['pending', 'sent', 'draft'].includes(status)) {
            estimateDetails.pending++;
          } else if (['approved', 'accepted'].includes(status)) {
            estimateDetails.approved++;
          }
          estimateDetails.totalValue += estimate.total || 0;
        });

        // Get task details
        const tasksResponse = await jobNimbusService.getTasks({ limit: 100 });
        const tasks = tasksResponse.results || [];

        tasks.forEach(task => {
          if (task.date_end) {
            const dueDate = new Date(task.date_end * 1000);
            if (dueDate < now && task.status !== 'completed') {
              taskDetails.overdue++;
            } else if (dueDate >= startOfDay && dueDate < new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)) {
              taskDetails.dueToday++;
            }
          }
        });

      } catch (error) {
        console.error('Error fetching JobNimbus stats:', error);
      }
    }

    // Get inventory stats (local data - no API call needed)
    const lowStockItems = getLowStockItems();
    const inventoryValue = getTotalInventoryValue();
    const categories = getInventoryCategories();

    // Get order stats (local data)
    const pendingOrders = getPendingOrders();
    const approvedOrders = getOrdersByStatus('Approved');
    const shippedOrders = getOrdersByStatus('Shipped');
    const deliveredOrders = getOrdersByStatus('Delivered');

    // Count today's deliveries
    const todayStr = now.toISOString().split('T')[0];
    const todayDeliveries = materialOrders.filter(o =>
      o.requestedDeliveryDate === todayStr &&
      ['Approved', 'Shipped'].includes(o.status)
    );

    // Get team stats (local data)
    const salesReps = teamMembers.filter(m =>
      m.category === 'Regional Partner' ||
      m.position.toLowerCase().includes('sales')
    );
    const productionTeam = teamMembers.filter(m => m.category === 'Production');

    // Active team members - those in Production, Office, Leadership, or Regional Partner
    const activeCategories = ['Leadership', 'Regional Partner', 'Office', 'Production'];
    const activeTeamMembers = teamMembers.filter(m => activeCategories.includes(m.category));

    // Calculate active deliveries (orders that are shipped or in transit)
    const activeDeliveries = shippedOrders.length;
    const completedTodayDeliveries = deliveredOrders.filter(o => {
      const updatedDate = new Date(o.updatedAt).toISOString().split('T')[0];
      return updatedDate === todayStr;
    }).length;

    return {
      jobs: {
        total: jnStats.jobs,
        active: jobDetails.active,
        completed: jobDetails.completed,
        pending: jobDetails.pending,
        thisMonth: jobDetails.thisMonth,
      },
      contacts: {
        total: jnStats.contacts,
        leads: contactDetails.leads,
        customers: contactDetails.customers,
      },
      estimates: {
        total: jnStats.estimates,
        pending: estimateDetails.pending,
        approved: estimateDetails.approved,
        totalValue: estimateDetails.totalValue,
      },
      tasks: {
        total: jnStats.tasks,
        overdue: taskDetails.overdue,
        dueToday: taskDetails.dueToday,
      },
      inventory: {
        totalProducts: inventoryProducts.length,
        totalValue: inventoryValue.retail,
        lowStockCount: lowStockItems.length,
        categories: categories.length,
      },
      orders: {
        total: materialOrders.length,
        pending: pendingOrders.length,
        approved: approvedOrders.length,
        shipped: shippedOrders.length,
        delivered: deliveredOrders.length,
        todayDeliveries: todayDeliveries.length,
      },
      team: {
        totalMembers: teamMembers.length,
        activeToday: activeTeamMembers.length,
        salesReps: salesReps.length,
        production: productionTeam.length,
      },
      deliveries: {
        active: activeDeliveries,
        completedToday: completedTodayDeliveries,
        scheduled: todayDeliveries.length,
      },
      lastUpdated: now.toISOString(),
      dataSource: 'live',
    };
  }

  private async fetchCommandCenterStats(): Promise<CommandCenterStats> {
    const now = new Date();
    const dashboardStats = await this.getDashboardStats();

    // Get sales team performance
    const salesTeam = teamMembers.filter(m =>
      m.category === 'Regional Partner' ||
      m.position.toLowerCase().includes('sales')
    );

    // Get real sales data from commission records (imported via financial service pattern)
    // Commission data is available in commissions.json - use dynamic import to avoid circular deps
    let commissionsByRep: Map<string, number> = new Map();
    try {
      const commissionsData = (await import('@/data/commissions.json')).default as Array<{ salesRep: string; date: string; amount: number }>;
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      for (const record of commissionsData) {
        // Parse date (M/D/YY format)
        const parts = record.date?.split('/');
        if (!parts || parts.length !== 3) continue;
        let year = parseInt(parts[2], 10);
        if (year < 100) year = 2000 + year;
        const recordDate = new Date(year, parseInt(parts[0], 10) - 1, parseInt(parts[1], 10));
        if (recordDate >= thisMonthStart) {
          const rep = record.salesRep.replace(/\s+/g, ' ').trim();
          commissionsByRep.set(rep, (commissionsByRep.get(rep) || 0) + record.amount);
        }
      }
    } catch {
      // Commission data unavailable
    }

    // Match sales team members to their commission data
    // Commission amounts * 10 = estimated job revenue (commissions are ~10% of job value)
    const COMMISSION_MULTIPLIER = 10;
    const topPerformers = salesTeam
      .map((member) => {
        // Try matching by first name or full name
        let repCommission = 0;
        for (const [rep, amount] of commissionsByRep.entries()) {
          if (rep.includes(member.name.split(' ')[0]) || member.name.includes(rep.split(' ')[0])) {
            repCommission = amount;
            break;
          }
        }
        return {
          name: member.name.split(' ')[0],
          avatar: member.name.charAt(0),
          sales: Math.round(repCommission * COMMISSION_MULTIPLIER),
          rank: 0,
        };
      })
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 3)
      .map((p, idx) => ({ ...p, rank: idx + 1 }));

    // Build recent activity from real data
    const recentOrders = getRecentOrders(5);
    const recentActivity: CommandCenterStats['recentActivity'] = recentOrders.map((order, idx) => ({
      type: 'delivery' as const,
      icon: 'Package',
      color: order.status === 'Delivered' ? 'text-green-400' : 'text-blue-400',
      text: order.status === 'Delivered' ? 'Delivery completed' : 'Order ' + order.status.toLowerCase(),
      detail: `${order.jobName} - ${order.customerName}`,
      time: this.getRelativeTime(new Date(order.updatedAt)),
    }));

    // Add inventory alerts if any
    const lowStockItems = getLowStockItems();
    if (lowStockItems.length > 0) {
      recentActivity.unshift({
        type: 'inventory' as const,
        icon: 'Package',
        color: 'text-orange-400',
        text: 'Low stock alert',
        detail: lowStockItems[0].productName,
        time: 'Now',
      });
    }

    // Build today's schedule from real order data
    const todaySchedule: CommandCenterStats['todaySchedule'] = [];

    // Add team standup (common daily meeting)
    todaySchedule.push({
      time: '9:00 AM',
      title: 'Morning Team Standup',
      type: 'meeting',
    });

    // Add deliveries scheduled for today
    const todayDeliveries = materialOrders.filter(o => {
      const todayStr = now.toISOString().split('T')[0];
      return o.requestedDeliveryDate === todayStr && ['Approved', 'Shipped'].includes(o.status);
    });

    todayDeliveries.forEach((order, idx) => {
      const hour = 10 + (idx * 2); // Spread deliveries throughout the day
      todaySchedule.push({
        time: `${hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`,
        title: `Delivery - ${order.shippingAddress}`,
        type: 'delivery',
      });
    });

    // Calculate real metrics
    const inventoryAlerts = dashboardStats.inventory.lowStockCount;
    const scheduledToday = dashboardStats.orders.todayDeliveries + todaySchedule.length;

    return {
      sales: {
        // Derive sales totals from real commission data (commissions * 10 = estimated revenue)
        todayTotal: (() => {
          let todayCommissions = 0;
          const todayStr = now.toISOString().split('T')[0];
          try {
            for (const [, amount] of commissionsByRep.entries()) {
              // commissionsByRep is already this-month filtered; use as proxy
              todayCommissions += amount;
            }
          } catch { /* no data */ }
          // If we have monthly commission data, estimate daily as month / days elapsed
          const dayOfMonth = now.getDate();
          return dayOfMonth > 0 ? Math.round((todayCommissions * COMMISSION_MULTIPLIER) / dayOfMonth) : 0;
        })(),
        weekTotal: (() => {
          const dayOfMonth = now.getDate();
          const monthTotal = Array.from(commissionsByRep.values()).reduce((s, v) => s + v, 0) * COMMISSION_MULTIPLIER;
          return dayOfMonth >= 7 ? Math.round(monthTotal / Math.floor(dayOfMonth / 7)) : Math.round(monthTotal);
        })(),
        monthTotal: Math.round(Array.from(commissionsByRep.values()).reduce((s, v) => s + v, 0) * COMMISSION_MULTIPLIER),
        topPerformers,
      },
      activeJobs: dashboardStats.jobs.active,
      inventoryAlerts,
      scheduledToday,
      teamActive: dashboardStats.team.activeToday,
      recentActivity: recentActivity.slice(0, 5),
      todaySchedule: todaySchedule.slice(0, 5),
      lastUpdated: now.toISOString(),
    };
  }

  private getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  }
}

// =============================================================================
// Export Singleton
// =============================================================================

export const unifiedDataService = new UnifiedDataService();

// =============================================================================
// Helper Functions for Quick Access
// =============================================================================

/**
 * Get quick stats for portal dashboard
 */
export async function getPortalDashboardStats() {
  const stats = await unifiedDataService.getDashboardStats();

  // Build recent activity from real orders data
  const recentOrders = getRecentOrders(5);
  const lowStockItems = getLowStockItems();

  const recentActivity: Array<{
    action: string;
    detail: string;
    time: string;
    color: string;
  }> = [];

  // Add recent order activities
  recentOrders.forEach((order) => {
    const orderDate = new Date(order.updatedAt);
    const now = new Date();
    const diffMs = now.getTime() - orderDate.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    let timeStr: string;
    if (diffMins < 60) {
      timeStr = `${diffMins} min ago`;
    } else if (diffHours < 24) {
      timeStr = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      timeStr = orderDate.toLocaleDateString();
    }

    let action: string;
    let color: string;

    switch (order.status) {
      case 'Delivered':
        action = 'Delivery completed';
        color = 'text-green-400';
        break;
      case 'Shipped':
        action = 'Order shipped';
        color = 'text-blue-400';
        break;
      case 'Approved':
        action = 'Order approved';
        color = 'text-cyan-400';
        break;
      case 'Pending':
        action = 'New order created';
        color = 'text-orange-400';
        break;
      default:
        action = `Order ${order.status.toLowerCase()}`;
        color = 'text-purple-400';
    }

    recentActivity.push({
      action,
      detail: `${order.jobNumber} - ${order.customerName}`,
      time: timeStr,
      color,
    });
  });

  // Add low stock alerts if any
  if (lowStockItems.length > 0 && recentActivity.length < 5) {
    recentActivity.unshift({
      action: 'Low stock alert',
      detail: `${lowStockItems.length} item${lowStockItems.length > 1 ? 's' : ''} need reorder`,
      time: 'Now',
      color: 'text-red-400',
    });
  }

  return {
    activeDeliveries: stats.deliveries.active,
    completedToday: stats.deliveries.completedToday,
    pendingOrders: stats.orders.pending,
    lowStockItems: stats.inventory.lowStockCount,
    upcomingSchedule: stats.orders.todayDeliveries,
    totalJobs: stats.jobs.total,
    activeJobs: stats.jobs.active,
    totalContacts: stats.contacts.total,
    // For backward compatibility
    totalOrders: stats.orders.total,
    todayDeliveries: stats.orders.todayDeliveries,
    activeDrivers: Math.min(stats.deliveries.active, 3), // Estimate based on active deliveries
    // Recent activity from real data
    recentActivity: recentActivity.slice(0, 5),
  };
}

/**
 * Get quick stats for command center
 */
export async function getCommandCenterQuickStats() {
  return unifiedDataService.getCommandCenterStats();
}
