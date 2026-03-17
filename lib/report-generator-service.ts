/**
 * RCRS Report Generator Service
 *
 * Generates daily, weekly, monthly, and custom reports pulling data from
 * existing services (calls, leads, inventory, deliveries, etc.).
 * Produces HTML-formatted reports suitable for email or on-screen viewing.
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// =============================================================================
// TYPES
// =============================================================================

export type ReportType = 'daily' | 'weekly' | 'monthly' | 'custom';
export type ReportFormat = 'html' | 'summary';
export type SectionType =
  | 'sales_summary'
  | 'lead_activity'
  | 'call_stats'
  | 'delivery_status'
  | 'inventory_levels'
  | 'revenue'
  | 'appointments'
  | 'weather_alerts'
  | 'team_performance'
  | 'customer_feedback'
  | 'open_items'
  | 'achievements';

export interface ReportSection {
  id: string;
  name: string;
  type: SectionType;
  enabled: boolean;
  order: number;
}

export interface ReportConfig {
  id: string;
  name: string;
  type: ReportType;
  sections: ReportSection[];
  recipients: string[];
  schedule: string; // cron expression or 'manual'
  format: ReportFormat;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
}

export interface SalesSummaryData {
  totalRevenue: number;
  dealsClosed: number;
  avgDealSize: number;
  topRep: string;
  newLeads: number;
  conversionRate: number;
}

export interface LeadActivityData {
  newLeads: number;
  contacted: number;
  scheduled: number;
  quoted: number;
  closed: number;
  avgResponseTime: number;
  reassigned: number;
}

export interface CallStatsData {
  totalCalls: number;
  inbound: number;
  outbound: number;
  missed: number;
  voicemails: number;
  avgDuration: number;
  busiestHour: number;
}

export interface DeliveryStatusData {
  scheduled: number;
  inTransit: number;
  delivered: number;
  delayed: number;
}

export interface InventoryLevelsData {
  lowStockItems: number;
  totalItems: number;
  reorderNeeded: string[];
}

export interface TeamPerformanceData {
  repStats: {
    name: string;
    sales: number;
    leads: number;
    responseTime: number;
    rating: number;
  }[];
}

export interface WeatherAlertsData {
  activeAlerts: number;
  recentStorms: number;
  potentialLeads: number;
}

export interface OpenItemsData {
  pendingApprovals: number;
  overdueFollowups: number;
  expiringWarranties: number;
  unreadMessages: number;
}

export interface ReportData {
  salesSummary?: SalesSummaryData;
  leadActivity?: LeadActivityData;
  callStats?: CallStatsData;
  deliveryStatus?: DeliveryStatusData;
  inventoryLevels?: InventoryLevelsData;
  teamPerformance?: TeamPerformanceData;
  weatherAlerts?: WeatherAlertsData;
  openItems?: OpenItemsData;
}

export interface GeneratedReport {
  id: string;
  configId: string;
  reportName: string;
  type: string;
  period: { start: string; end: string };
  generatedAt: string;
  generatedBy: string;
  data: ReportData;
  htmlContent: string;
  sentTo: string[];
  sentAt?: string;
}

interface ConfigsFile {
  configs: ReportConfig[];
}

interface ReportsFile {
  reports: GeneratedReport[];
}

// =============================================================================
// DATA PATHS
// =============================================================================

const CONFIGS_PATH = path.join(process.cwd(), 'data', 'report-configs.json');
const REPORTS_PATH = path.join(process.cwd(), 'data', 'generated-reports.json');
const CALLS_PATH = path.join(process.cwd(), 'data', 'calls.json');
const LEADS_PATH = path.join(process.cwd(), 'data', 'leads.json');
const INVENTORY_PATH = path.join(process.cwd(), 'data', 'inventory.json');

// =============================================================================
// SERVICE CLASS
// =============================================================================

class ReportGeneratorService {
  // ---------------------------------------------------------------------------
  // File I/O
  // ---------------------------------------------------------------------------

  private readConfigs(): ConfigsFile {
    try {
      if (fs.existsSync(CONFIGS_PATH)) {
        const content = fs.readFileSync(CONFIGS_PATH, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('[ReportGenerator] Error reading configs:', error);
    }
    return { configs: [] };
  }

  private writeConfigs(data: ConfigsFile): void {
    try {
      const dir = path.dirname(CONFIGS_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(CONFIGS_PATH, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[ReportGenerator] Error writing configs:', error);
      throw error;
    }
  }

  private readReports(): ReportsFile {
    try {
      if (fs.existsSync(REPORTS_PATH)) {
        const content = fs.readFileSync(REPORTS_PATH, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('[ReportGenerator] Error reading reports:', error);
    }
    return { reports: [] };
  }

  private writeReports(data: ReportsFile): void {
    try {
      const dir = path.dirname(REPORTS_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(REPORTS_PATH, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[ReportGenerator] Error writing reports:', error);
      throw error;
    }
  }

  private readJsonSafe(filePath: string): Record<string, unknown> {
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }
    } catch {
      // Silently fall back to empty
    }
    return {};
  }

  // ---------------------------------------------------------------------------
  // ID generation
  // ---------------------------------------------------------------------------

  private generateId(prefix: string): string {
    return `${prefix}-${crypto.randomBytes(6).toString('hex')}`;
  }

  // ---------------------------------------------------------------------------
  // Date helpers
  // ---------------------------------------------------------------------------

  private getDateRange(type: ReportType): { start: string; end: string } {
    const now = new Date();
    const end = now.toISOString();

    switch (type) {
      case 'daily': {
        const start = new Date(now);
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        return { start: start.toISOString(), end };
      }
      case 'weekly': {
        const start = new Date(now);
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        return { start: start.toISOString(), end };
      }
      case 'monthly': {
        const start = new Date(now);
        start.setMonth(start.getMonth() - 1);
        start.setHours(0, 0, 0, 0);
        return { start: start.toISOString(), end };
      }
      default:
        return { start: end, end };
    }
  }

  // ---------------------------------------------------------------------------
  // Data collectors — pull from existing data files
  // ---------------------------------------------------------------------------

  private collectSalesSummary(start: string, end: string): SalesSummaryData {
    const leadsData = this.readJsonSafe(LEADS_PATH) as { leads?: Array<Record<string, unknown>> };
    const leads = leadsData.leads || [];

    const startDate = new Date(start);
    const endDate = new Date(end);

    const periodLeads = leads.filter((l) => {
      const created = new Date(l.createdAt as string || '');
      return created >= startDate && created <= endDate;
    });

    const closedLeads = periodLeads.filter(
      (l) => l.status === 'closed' || l.status === 'won' || l.status === 'sold'
    );

    // Compute rep with most closed deals
    const repCounts: Record<string, number> = {};
    closedLeads.forEach((l) => {
      const rep = (l.assignedTo as string) || (l.repName as string) || 'Unassigned';
      repCounts[rep] = (repCounts[rep] || 0) + 1;
    });
    const topRep = Object.entries(repCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    const totalRevenue = closedLeads.reduce(
      (sum, l) => sum + (Number(l.dealValue || l.amount || l.revenue || 0)),
      0
    );
    const dealsClosed = closedLeads.length;
    const avgDealSize = dealsClosed > 0 ? Math.round(totalRevenue / dealsClosed) : 0;
    const conversionRate =
      periodLeads.length > 0
        ? Math.round((dealsClosed / periodLeads.length) * 100)
        : 0;

    return {
      totalRevenue,
      dealsClosed,
      avgDealSize,
      topRep,
      newLeads: periodLeads.length,
      conversionRate,
    };
  }

  private collectLeadActivity(start: string, end: string): LeadActivityData {
    const leadsData = this.readJsonSafe(LEADS_PATH) as { leads?: Array<Record<string, unknown>> };
    const leads = leadsData.leads || [];

    const startDate = new Date(start);
    const endDate = new Date(end);

    const periodLeads = leads.filter((l) => {
      const created = new Date(l.createdAt as string || '');
      return created >= startDate && created <= endDate;
    });

    const contacted = periodLeads.filter(
      (l) => l.status === 'contacted' || l.status === 'follow_up'
    ).length;
    const scheduled = periodLeads.filter(
      (l) => l.status === 'scheduled' || l.status === 'appointment_set'
    ).length;
    const quoted = periodLeads.filter(
      (l) => l.status === 'quoted' || l.status === 'estimate_sent'
    ).length;
    const closed = periodLeads.filter(
      (l) => l.status === 'closed' || l.status === 'won' || l.status === 'sold'
    ).length;
    const reassigned = periodLeads.filter(
      (l) => l.reassigned === true || l.reassignedAt
    ).length;

    // Average response time in minutes (mock reasonable value if no data)
    const responseTimes = periodLeads
      .filter((l) => l.respondedAt && l.createdAt)
      .map((l) => {
        const created = new Date(l.createdAt as string).getTime();
        const responded = new Date(l.respondedAt as string).getTime();
        return (responded - created) / 60000; // minutes
      });

    const avgResponseTime =
      responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0;

    return {
      newLeads: periodLeads.length,
      contacted,
      scheduled,
      quoted,
      closed,
      avgResponseTime,
      reassigned,
    };
  }

  private collectCallStats(start: string, end: string): CallStatsData {
    const callsData = this.readJsonSafe(CALLS_PATH) as {
      calls?: Array<Record<string, unknown>>;
    };
    const calls = callsData.calls || [];

    const startDate = new Date(start);
    const endDate = new Date(end);

    const periodCalls = calls.filter((c) => {
      const callDate = new Date(c.startTime as string || c.createdAt as string || '');
      return callDate >= startDate && callDate <= endDate;
    });

    const inbound = periodCalls.filter((c) => c.direction === 'inbound').length;
    const outbound = periodCalls.filter((c) => c.direction === 'outbound').length;
    const missed = periodCalls.filter(
      (c) => c.status === 'missed' || c.status === 'no_answer'
    ).length;
    const voicemails = periodCalls.filter((c) => c.status === 'voicemail').length;

    const durations = periodCalls
      .filter((c) => typeof c.duration === 'number')
      .map((c) => c.duration as number);
    const avgDuration =
      durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;

    // Find busiest hour
    const hourCounts = new Array(24).fill(0);
    periodCalls.forEach((c) => {
      const date = new Date(c.startTime as string || c.createdAt as string || '');
      if (!isNaN(date.getTime())) {
        hourCounts[date.getHours()]++;
      }
    });
    const busiestHour = hourCounts.indexOf(Math.max(...hourCounts));

    return {
      totalCalls: periodCalls.length,
      inbound,
      outbound,
      missed,
      voicemails,
      avgDuration,
      busiestHour: busiestHour >= 0 ? busiestHour : 10,
    };
  }

  private collectDeliveryStatus(): DeliveryStatusData {
    // Pull from inventory transactions or delivery data
    const inventoryData = this.readJsonSafe(
      path.join(process.cwd(), 'data', 'inventory-transactions.json')
    ) as { transactions?: Array<Record<string, unknown>> };
    const transactions = inventoryData.transactions || [];

    const recent = transactions.filter((t) => {
      const date = new Date(t.dateTime as string || t.createdAt as string || '');
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return date >= weekAgo;
    });

    const scheduled = recent.filter(
      (t) => t.status === 'scheduled' || t.status === 'pending'
    ).length;
    const inTransit = recent.filter(
      (t) => t.status === 'in_transit' || t.status === 'en_route'
    ).length;
    const delivered = recent.filter(
      (t) => t.status === 'delivered' || t.status === 'completed'
    ).length;
    const delayed = recent.filter(
      (t) => t.status === 'delayed' || t.status === 'issue'
    ).length;

    return { scheduled, inTransit, delivered, delayed };
  }

  private collectInventoryLevels(): InventoryLevelsData {
    const inventoryData = this.readJsonSafe(INVENTORY_PATH) as {
      items?: Array<Record<string, unknown>>;
      products?: Array<Record<string, unknown>>;
    };
    const items = inventoryData.items || inventoryData.products || [];

    const lowStock = items.filter((item) => {
      const current = Number(item.currentQty || item.quantity || 0);
      const min = Number(item.minQty || item.reorderPoint || 10);
      return current <= min;
    });

    const reorderNeeded = lowStock
      .map((item) => (item.productName || item.name || 'Unknown Item') as string)
      .slice(0, 10);

    return {
      lowStockItems: lowStock.length,
      totalItems: items.length,
      reorderNeeded,
    };
  }

  private collectTeamPerformance(start: string, end: string): TeamPerformanceData {
    const leadsData = this.readJsonSafe(LEADS_PATH) as { leads?: Array<Record<string, unknown>> };
    const leads = leadsData.leads || [];

    const startDate = new Date(start);
    const endDate = new Date(end);

    const periodLeads = leads.filter((l) => {
      const created = new Date(l.createdAt as string || '');
      return created >= startDate && created <= endDate;
    });

    // Group by rep
    const repMap: Record<string, { sales: number; leads: number; responseTimes: number[]; ratings: number[] }> = {};

    periodLeads.forEach((l) => {
      const rep = (l.assignedTo as string) || (l.repName as string) || 'Unassigned';
      if (!repMap[rep]) {
        repMap[rep] = { sales: 0, leads: 0, responseTimes: [], ratings: [] };
      }
      repMap[rep].leads++;
      if (l.status === 'closed' || l.status === 'won' || l.status === 'sold') {
        repMap[rep].sales += Number(l.dealValue || l.amount || 0);
      }
      if (l.respondedAt && l.createdAt) {
        const rt =
          (new Date(l.respondedAt as string).getTime() -
            new Date(l.createdAt as string).getTime()) /
          60000;
        repMap[rep].responseTimes.push(rt);
      }
      if (typeof l.rating === 'number') {
        repMap[rep].ratings.push(l.rating as number);
      }
    });

    const repStats = Object.entries(repMap).map(([name, data]) => ({
      name,
      sales: data.sales,
      leads: data.leads,
      responseTime:
        data.responseTimes.length > 0
          ? Math.round(data.responseTimes.reduce((a, b) => a + b, 0) / data.responseTimes.length)
          : 0,
      rating:
        data.ratings.length > 0
          ? Math.round((data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length) * 10) / 10
          : 0,
    }));

    // Sort by sales descending
    repStats.sort((a, b) => b.sales - a.sales);

    return { repStats };
  }

  private collectWeatherAlerts(): WeatherAlertsData {
    const stormData = this.readJsonSafe(
      path.join(process.cwd(), 'data', 'storm-events.json')
    ) as { events?: Array<Record<string, unknown>> };
    const events = stormData.events || [];

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const recentStorms = events.filter((e) => {
      const date = new Date(e.date as string || e.createdAt as string || '');
      return date >= weekAgo;
    });

    const activeAlerts = events.filter(
      (e) => e.status === 'active' || e.status === 'warning'
    ).length;

    return {
      activeAlerts,
      recentStorms: recentStorms.length,
      potentialLeads: Math.round(recentStorms.length * 3.5), // estimate
    };
  }

  private collectOpenItems(): OpenItemsData {
    const leadsData = this.readJsonSafe(LEADS_PATH) as { leads?: Array<Record<string, unknown>> };
    const leads = leadsData.leads || [];

    const notificationsData = this.readJsonSafe(
      path.join(process.cwd(), 'data', 'notifications.json')
    ) as { notifications?: Array<Record<string, unknown>> };
    const notifications = notificationsData.notifications || [];

    const pendingApprovals = leads.filter(
      (l) => l.status === 'pending_approval' || l.status === 'awaiting_approval'
    ).length;

    const now = new Date();
    const overdueFollowups = leads.filter((l) => {
      if (l.followUpDate) {
        return new Date(l.followUpDate as string) < now && l.status !== 'closed' && l.status !== 'won';
      }
      return false;
    }).length;

    // Check warranty data for expiring warranties
    const warrantyData = this.readJsonSafe(
      path.join(process.cwd(), 'data', 'warranties.json')
    ) as { warranties?: Array<Record<string, unknown>> };
    const warranties = warrantyData.warranties || [];
    const thirtyDays = new Date();
    thirtyDays.setDate(thirtyDays.getDate() + 30);
    const expiringWarranties = warranties.filter((w) => {
      if (w.expiryDate || w.endDate) {
        const expiry = new Date((w.expiryDate || w.endDate) as string);
        return expiry <= thirtyDays && expiry >= now;
      }
      return false;
    }).length;

    const unreadMessages = notifications.filter(
      (n) => n.read === false || n.status === 'unread'
    ).length;

    return {
      pendingApprovals,
      overdueFollowups,
      expiringWarranties,
      unreadMessages,
    };
  }

  // ---------------------------------------------------------------------------
  // Report data collector — runs enabled sections
  // ---------------------------------------------------------------------------

  private collectReportData(
    sections: ReportSection[],
    start: string,
    end: string
  ): ReportData {
    const data: ReportData = {};
    const enabledSections = sections
      .filter((s) => s.enabled)
      .sort((a, b) => a.order - b.order);

    for (const section of enabledSections) {
      switch (section.type) {
        case 'sales_summary':
        case 'revenue':
          data.salesSummary = this.collectSalesSummary(start, end);
          break;
        case 'lead_activity':
          data.leadActivity = this.collectLeadActivity(start, end);
          break;
        case 'call_stats':
          data.callStats = this.collectCallStats(start, end);
          break;
        case 'delivery_status':
          data.deliveryStatus = this.collectDeliveryStatus();
          break;
        case 'inventory_levels':
          data.inventoryLevels = this.collectInventoryLevels();
          break;
        case 'team_performance':
          data.teamPerformance = this.collectTeamPerformance(start, end);
          break;
        case 'weather_alerts':
          data.weatherAlerts = this.collectWeatherAlerts();
          break;
        case 'open_items':
          data.openItems = this.collectOpenItems();
          break;
        // customer_feedback, achievements, appointments — included in summary if no specific data
        default:
          break;
      }
    }

    return data;
  }

  // ---------------------------------------------------------------------------
  // HTML Builder
  // ---------------------------------------------------------------------------

  buildReportHTML(report: GeneratedReport): string {
    const periodStart = new Date(report.period.start).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const periodEnd = new Date(report.period.end).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const { data } = report;
    let sectionsHTML = '';

    // Sales Summary
    if (data.salesSummary) {
      const s = data.salesSummary;
      sectionsHTML += `
      <div style="margin-bottom: 24px; background: #1f2937; border-radius: 8px; padding: 20px; border-left: 4px solid #39FF14;">
        <h2 style="color: #39FF14; margin: 0 0 16px 0; font-size: 18px;">Sales Summary</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 16px 8px 0; color: #9ca3af; font-size: 14px;">Total Revenue</td>
            <td style="padding: 8px 0; color: #39FF14; font-size: 18px; font-weight: bold; text-align: right;">$${s.totalRevenue.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding: 8px 16px 8px 0; color: #9ca3af; font-size: 14px;">Deals Closed</td>
            <td style="padding: 8px 0; color: #ffffff; font-size: 16px; text-align: right;">${s.dealsClosed}</td>
          </tr>
          <tr>
            <td style="padding: 8px 16px 8px 0; color: #9ca3af; font-size: 14px;">Avg Deal Size</td>
            <td style="padding: 8px 0; color: #ffffff; font-size: 16px; text-align: right;">$${s.avgDealSize.toLocaleString()}</td>
          </tr>
          <tr>
            <td style="padding: 8px 16px 8px 0; color: #9ca3af; font-size: 14px;">Top Rep</td>
            <td style="padding: 8px 0; color: #ffffff; font-size: 16px; text-align: right;">${s.topRep}</td>
          </tr>
          <tr>
            <td style="padding: 8px 16px 8px 0; color: #9ca3af; font-size: 14px;">New Leads</td>
            <td style="padding: 8px 0; color: #ffffff; font-size: 16px; text-align: right;">${s.newLeads}</td>
          </tr>
          <tr>
            <td style="padding: 8px 16px 8px 0; color: #9ca3af; font-size: 14px;">Conversion Rate</td>
            <td style="padding: 8px 0; color: #ffffff; font-size: 16px; text-align: right;">${s.conversionRate}%</td>
          </tr>
        </table>
      </div>`;
    }

    // Lead Activity
    if (data.leadActivity) {
      const l = data.leadActivity;
      sectionsHTML += `
      <div style="margin-bottom: 24px; background: #1f2937; border-radius: 8px; padding: 20px; border-left: 4px solid #3b82f6;">
        <h2 style="color: #3b82f6; margin: 0 0 16px 0; font-size: 18px;">Lead Activity</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #374151;">
            <th style="padding: 8px 0; color: #9ca3af; font-size: 12px; text-align: left; text-transform: uppercase;">Stage</th>
            <th style="padding: 8px 0; color: #9ca3af; font-size: 12px; text-align: right; text-transform: uppercase;">Count</th>
          </tr>
          <tr><td style="padding: 8px 0; color: #ffffff;">New Leads</td><td style="padding: 8px 0; color: #ffffff; text-align: right;">${l.newLeads}</td></tr>
          <tr><td style="padding: 8px 0; color: #ffffff;">Contacted</td><td style="padding: 8px 0; color: #ffffff; text-align: right;">${l.contacted}</td></tr>
          <tr><td style="padding: 8px 0; color: #ffffff;">Scheduled</td><td style="padding: 8px 0; color: #ffffff; text-align: right;">${l.scheduled}</td></tr>
          <tr><td style="padding: 8px 0; color: #ffffff;">Quoted</td><td style="padding: 8px 0; color: #ffffff; text-align: right;">${l.quoted}</td></tr>
          <tr><td style="padding: 8px 0; color: #ffffff;">Closed</td><td style="padding: 8px 0; color: #39FF14; text-align: right; font-weight: bold;">${l.closed}</td></tr>
          <tr><td style="padding: 8px 0; color: #ffffff;">Reassigned</td><td style="padding: 8px 0; color: #ffffff; text-align: right;">${l.reassigned}</td></tr>
          <tr style="border-top: 1px solid #374151;">
            <td style="padding: 8px 0; color: #9ca3af; font-size: 13px;">Avg Response Time</td>
            <td style="padding: 8px 0; color: #ffffff; text-align: right;">${l.avgResponseTime} min</td>
          </tr>
        </table>
      </div>`;
    }

    // Call Stats
    if (data.callStats) {
      const c = data.callStats;
      const busiestFormatted = c.busiestHour > 12
        ? `${c.busiestHour - 12}:00 PM`
        : c.busiestHour === 12
          ? '12:00 PM'
          : `${c.busiestHour}:00 AM`;
      const avgMin = Math.floor(c.avgDuration / 60);
      const avgSec = c.avgDuration % 60;

      sectionsHTML += `
      <div style="margin-bottom: 24px; background: #1f2937; border-radius: 8px; padding: 20px; border-left: 4px solid #a855f7;">
        <h2 style="color: #a855f7; margin: 0 0 16px 0; font-size: 18px;">Call Stats</h2>
        <div style="display: flex; flex-wrap: wrap; gap: 16px;">
          <div style="flex: 1; min-width: 120px; text-align: center; padding: 12px; background: #111827; border-radius: 6px;">
            <div style="color: #9ca3af; font-size: 12px; text-transform: uppercase;">Total</div>
            <div style="color: #ffffff; font-size: 24px; font-weight: bold;">${c.totalCalls}</div>
          </div>
          <div style="flex: 1; min-width: 120px; text-align: center; padding: 12px; background: #111827; border-radius: 6px;">
            <div style="color: #9ca3af; font-size: 12px; text-transform: uppercase;">Inbound</div>
            <div style="color: #ffffff; font-size: 24px; font-weight: bold;">${c.inbound}</div>
          </div>
          <div style="flex: 1; min-width: 120px; text-align: center; padding: 12px; background: #111827; border-radius: 6px;">
            <div style="color: #9ca3af; font-size: 12px; text-transform: uppercase;">Outbound</div>
            <div style="color: #ffffff; font-size: 24px; font-weight: bold;">${c.outbound}</div>
          </div>
          <div style="flex: 1; min-width: 120px; text-align: center; padding: 12px; background: #111827; border-radius: 6px;">
            <div style="color: #9ca3af; font-size: 12px; text-transform: uppercase;">Missed</div>
            <div style="color: ${c.missed > 0 ? '#ef4444' : '#ffffff'}; font-size: 24px; font-weight: bold;">${c.missed}</div>
          </div>
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
          <tr><td style="padding: 6px 0; color: #9ca3af; font-size: 13px;">Voicemails</td><td style="padding: 6px 0; color: #ffffff; text-align: right;">${c.voicemails}</td></tr>
          <tr><td style="padding: 6px 0; color: #9ca3af; font-size: 13px;">Avg Duration</td><td style="padding: 6px 0; color: #ffffff; text-align: right;">${avgMin}:${String(avgSec).padStart(2, '0')}</td></tr>
          <tr><td style="padding: 6px 0; color: #9ca3af; font-size: 13px;">Busiest Hour</td><td style="padding: 6px 0; color: #ffffff; text-align: right;">${busiestFormatted}</td></tr>
        </table>
      </div>`;
    }

    // Delivery Status
    if (data.deliveryStatus) {
      const d = data.deliveryStatus;
      const total = d.scheduled + d.inTransit + d.delivered + d.delayed;
      sectionsHTML += `
      <div style="margin-bottom: 24px; background: #1f2937; border-radius: 8px; padding: 20px; border-left: 4px solid #f59e0b;">
        <h2 style="color: #f59e0b; margin: 0 0 16px 0; font-size: 18px;">Delivery Status</h2>
        <div style="display: flex; flex-wrap: wrap; gap: 12px;">
          <div style="flex: 1; min-width: 100px; text-align: center; padding: 10px; background: #111827; border-radius: 6px;">
            <div style="color: #3b82f6; font-size: 22px; font-weight: bold;">${d.scheduled}</div>
            <div style="color: #9ca3af; font-size: 11px; text-transform: uppercase;">Scheduled</div>
          </div>
          <div style="flex: 1; min-width: 100px; text-align: center; padding: 10px; background: #111827; border-radius: 6px;">
            <div style="color: #f59e0b; font-size: 22px; font-weight: bold;">${d.inTransit}</div>
            <div style="color: #9ca3af; font-size: 11px; text-transform: uppercase;">In Transit</div>
          </div>
          <div style="flex: 1; min-width: 100px; text-align: center; padding: 10px; background: #111827; border-radius: 6px;">
            <div style="color: #39FF14; font-size: 22px; font-weight: bold;">${d.delivered}</div>
            <div style="color: #9ca3af; font-size: 11px; text-transform: uppercase;">Delivered</div>
          </div>
          <div style="flex: 1; min-width: 100px; text-align: center; padding: 10px; background: #111827; border-radius: 6px;">
            <div style="color: ${d.delayed > 0 ? '#ef4444' : '#9ca3af'}; font-size: 22px; font-weight: bold;">${d.delayed}</div>
            <div style="color: #9ca3af; font-size: 11px; text-transform: uppercase;">Delayed</div>
          </div>
        </div>
        <div style="margin-top: 8px; color: #9ca3af; font-size: 12px; text-align: right;">Total: ${total} deliveries</div>
      </div>`;
    }

    // Inventory Levels
    if (data.inventoryLevels) {
      const inv = data.inventoryLevels;
      sectionsHTML += `
      <div style="margin-bottom: 24px; background: #1f2937; border-radius: 8px; padding: 20px; border-left: 4px solid #06b6d4;">
        <h2 style="color: #06b6d4; margin: 0 0 16px 0; font-size: 18px;">Inventory Levels</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #9ca3af;">Total Items Tracked</td><td style="padding: 8px 0; color: #ffffff; text-align: right;">${inv.totalItems}</td></tr>
          <tr><td style="padding: 8px 0; color: ${inv.lowStockItems > 0 ? '#ef4444' : '#9ca3af'};">Low Stock Items</td><td style="padding: 8px 0; color: ${inv.lowStockItems > 0 ? '#ef4444' : '#ffffff'}; text-align: right; font-weight: bold;">${inv.lowStockItems}</td></tr>
        </table>
        ${inv.reorderNeeded.length > 0 ? `
        <div style="margin-top: 12px; padding: 12px; background: #111827; border-radius: 6px;">
          <div style="color: #ef4444; font-size: 13px; font-weight: bold; margin-bottom: 8px;">Reorder Needed:</div>
          <ul style="margin: 0; padding-left: 20px; color: #ffffff; font-size: 13px;">
            ${inv.reorderNeeded.map((item) => `<li style="padding: 2px 0;">${item}</li>`).join('')}
          </ul>
        </div>` : ''}
      </div>`;
    }

    // Team Performance
    if (data.teamPerformance && data.teamPerformance.repStats.length > 0) {
      const team = data.teamPerformance;
      sectionsHTML += `
      <div style="margin-bottom: 24px; background: #1f2937; border-radius: 8px; padding: 20px; border-left: 4px solid #10b981;">
        <h2 style="color: #10b981; margin: 0 0 16px 0; font-size: 18px;">Team Performance</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="border-bottom: 2px solid #374151;">
            <th style="padding: 8px 4px; color: #9ca3af; font-size: 12px; text-align: left; text-transform: uppercase;">Rep</th>
            <th style="padding: 8px 4px; color: #9ca3af; font-size: 12px; text-align: right; text-transform: uppercase;">Sales</th>
            <th style="padding: 8px 4px; color: #9ca3af; font-size: 12px; text-align: right; text-transform: uppercase;">Leads</th>
            <th style="padding: 8px 4px; color: #9ca3af; font-size: 12px; text-align: right; text-transform: uppercase;">Resp Time</th>
            <th style="padding: 8px 4px; color: #9ca3af; font-size: 12px; text-align: right; text-transform: uppercase;">Rating</th>
          </tr>
          ${team.repStats.map((rep, i) => `
          <tr style="border-bottom: 1px solid #374151; ${i === 0 ? 'background: rgba(57, 255, 20, 0.05);' : ''}">
            <td style="padding: 8px 4px; color: #ffffff; font-size: 14px;">${i === 0 ? '&#9733; ' : ''}${rep.name}</td>
            <td style="padding: 8px 4px; color: #39FF14; font-size: 14px; text-align: right;">$${rep.sales.toLocaleString()}</td>
            <td style="padding: 8px 4px; color: #ffffff; font-size: 14px; text-align: right;">${rep.leads}</td>
            <td style="padding: 8px 4px; color: #ffffff; font-size: 14px; text-align: right;">${rep.responseTime}m</td>
            <td style="padding: 8px 4px; color: #f59e0b; font-size: 14px; text-align: right;">${rep.rating > 0 ? rep.rating.toFixed(1) : '-'}</td>
          </tr>`).join('')}
        </table>
      </div>`;
    }

    // Weather Alerts
    if (data.weatherAlerts) {
      const w = data.weatherAlerts;
      sectionsHTML += `
      <div style="margin-bottom: 24px; background: #1f2937; border-radius: 8px; padding: 20px; border-left: 4px solid #ef4444;">
        <h2 style="color: #ef4444; margin: 0 0 16px 0; font-size: 18px;">Weather Alerts</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #9ca3af;">Active Alerts</td><td style="padding: 8px 0; color: ${w.activeAlerts > 0 ? '#ef4444' : '#ffffff'}; text-align: right; font-weight: bold;">${w.activeAlerts}</td></tr>
          <tr><td style="padding: 8px 0; color: #9ca3af;">Recent Storms (7 days)</td><td style="padding: 8px 0; color: #ffffff; text-align: right;">${w.recentStorms}</td></tr>
          <tr><td style="padding: 8px 0; color: #9ca3af;">Potential Leads</td><td style="padding: 8px 0; color: #39FF14; text-align: right; font-weight: bold;">${w.potentialLeads}</td></tr>
        </table>
      </div>`;
    }

    // Open Items
    if (data.openItems) {
      const o = data.openItems;
      const hasIssues =
        o.pendingApprovals > 0 ||
        o.overdueFollowups > 0 ||
        o.expiringWarranties > 0 ||
        o.unreadMessages > 0;

      sectionsHTML += `
      <div style="margin-bottom: 24px; background: #1f2937; border-radius: 8px; padding: 20px; border-left: 4px solid ${hasIssues ? '#f59e0b' : '#39FF14'};">
        <h2 style="color: ${hasIssues ? '#f59e0b' : '#39FF14'}; margin: 0 0 16px 0; font-size: 18px;">Open Items</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #9ca3af;">Pending Approvals</td><td style="padding: 8px 0; color: ${o.pendingApprovals > 0 ? '#f59e0b' : '#ffffff'}; text-align: right; font-weight: bold;">${o.pendingApprovals}</td></tr>
          <tr><td style="padding: 8px 0; color: #9ca3af;">Overdue Follow-ups</td><td style="padding: 8px 0; color: ${o.overdueFollowups > 0 ? '#ef4444' : '#ffffff'}; text-align: right; font-weight: bold;">${o.overdueFollowups}</td></tr>
          <tr><td style="padding: 8px 0; color: #9ca3af;">Expiring Warranties (30d)</td><td style="padding: 8px 0; color: ${o.expiringWarranties > 0 ? '#f59e0b' : '#ffffff'}; text-align: right;">${o.expiringWarranties}</td></tr>
          <tr><td style="padding: 8px 0; color: #9ca3af;">Unread Messages</td><td style="padding: 8px 0; color: #ffffff; text-align: right;">${o.unreadMessages}</td></tr>
        </table>
      </div>`;
    }

    // Wrap in full HTML document
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${report.reportName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #111827; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 640px; margin: 0 auto; padding: 24px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px; padding: 24px; background: linear-gradient(135deg, #1f2937, #111827); border-radius: 12px; border: 1px solid #374151;">
      <h1 style="color: #39FF14; margin: 0 0 8px 0; font-size: 24px; letter-spacing: 1px;">RIVER CITY ROOFING</h1>
      <h2 style="color: #ffffff; margin: 0 0 12px 0; font-size: 18px; font-weight: normal;">${report.reportName}</h2>
      <div style="color: #9ca3af; font-size: 13px;">${periodStart} &mdash; ${periodEnd}</div>
      <div style="color: #6b7280; font-size: 12px; margin-top: 4px;">Generated ${new Date(report.generatedAt).toLocaleString('en-US')}</div>
    </div>

    <!-- Sections -->
    ${sectionsHTML}

    <!-- Footer -->
    <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px; border-top: 1px solid #374151; margin-top: 16px;">
      <p style="margin: 0;">River City Roofing Solutions &bull; (256) 274-8530 &bull; rivercityroofingsolutions.com</p>
      <p style="margin: 4px 0 0 0;">This report was auto-generated. Do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Generate a report from a saved config
   */
  generateReport(
    configId: string,
    dateRange?: { start: string; end: string }
  ): GeneratedReport {
    const { configs } = this.readConfigs();
    const config = configs.find((c) => c.id === configId);

    if (!config) {
      throw new Error(`Report config not found: ${configId}`);
    }

    const period = dateRange || this.getDateRange(config.type as ReportType);
    const data = this.collectReportData(config.sections, period.start, period.end);

    const report: GeneratedReport = {
      id: this.generateId('rpt'),
      configId: config.id,
      reportName: config.name,
      type: config.type,
      period,
      generatedAt: new Date().toISOString(),
      generatedBy: 'system',
      data,
      htmlContent: '',
      sentTo: config.recipients,
    };

    // Build HTML content
    report.htmlContent = this.buildReportHTML(report);

    // Save to history
    const reportsFile = this.readReports();
    reportsFile.reports.unshift(report);

    // Keep last 100 reports
    if (reportsFile.reports.length > 100) {
      reportsFile.reports = reportsFile.reports.slice(0, 100);
    }

    this.writeReports(reportsFile);

    return report;
  }

  /**
   * Generate a daily report using the daily config
   */
  generateDailyReport(): GeneratedReport {
    return this.generateReport('config-daily');
  }

  /**
   * Generate a weekly report using the weekly config
   */
  generateWeeklyReport(): GeneratedReport {
    return this.generateReport('config-weekly');
  }

  /**
   * Get all report configs
   */
  getReportConfigs(): ReportConfig[] {
    return this.readConfigs().configs;
  }

  /**
   * Create a new report config
   */
  createReportConfig(
    config: Omit<ReportConfig, 'id' | 'createdAt'>
  ): ReportConfig {
    const file = this.readConfigs();
    const newConfig: ReportConfig = {
      ...config,
      id: this.generateId('config'),
      createdAt: new Date().toISOString(),
    };

    file.configs.push(newConfig);
    this.writeConfigs(file);

    return newConfig;
  }

  /**
   * Update an existing report config
   */
  updateReportConfig(
    id: string,
    updates: Partial<ReportConfig>
  ): ReportConfig {
    const file = this.readConfigs();
    const index = file.configs.findIndex((c) => c.id === id);

    if (index === -1) {
      throw new Error(`Report config not found: ${id}`);
    }

    // Don't allow changing the id
    const { id: _ignoreId, ...safeUpdates } = updates;
    file.configs[index] = { ...file.configs[index], ...safeUpdates };
    this.writeConfigs(file);

    return file.configs[index];
  }

  /**
   * Get report history, optionally limited
   */
  getReportHistory(limit?: number): GeneratedReport[] {
    const { reports } = this.readReports();
    if (limit && limit > 0) {
      return reports.slice(0, limit);
    }
    return reports;
  }

  /**
   * Get a single report by ID
   */
  getReport(id: string): GeneratedReport | null {
    const { reports } = this.readReports();
    return reports.find((r) => r.id === id) || null;
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const reportGeneratorService = new ReportGeneratorService();
