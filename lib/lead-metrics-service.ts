// Lead Metrics Service
// Aggregates metrics from Google Sheets data for the lead distribution dashboard.
// Provides KPIs, per-rep performance, active timer states, and distribution history.

import {
  googleSheetsService,
  LeadDistributionLogRecord,
  LeadResponseLogRecord,
  RepAvailabilityRecord,
} from '@/lib/google-sheets-service';
import { getSalesReps, TeamMember } from '@/lib/team-roles';
import { leadResponseTimerService, TimerState } from '@/lib/lead-response-timer';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface KPIMetrics {
  totalLeads: number;
  totalLeads30d: number;
  conversionRate: number;
  avgResponseMinutes: number;
  activeTimers: number;
  leadsToday: number;
}

export interface RepMetrics {
  repSlug: string;
  repName: string;
  totalLeads: number;
  totalLeads30d: number;
  respondedLeads: number;
  missedLeads: number;
  closeRate: number;
  avgResponseMinutes: number | null;
  isReceivingLeads: boolean;
  adminPaused: boolean;
  autoResumeAt: string | null;
}

export interface DistributionHistoryEntry {
  logId: string;
  customerName: string;
  address: string;
  assignedRep: string;
  assignedRepName: string;
  method: string;
  timestamp: string;
  scores: Record<string, number>;
}

// =============================================================================
// LEAD METRICS SERVICE CLASS
// =============================================================================

class LeadMetricsService {

  // ---------------------------------------------------------------------------
  // KPI METRICS
  // ---------------------------------------------------------------------------

  /**
   * Calculate dashboard-level KPI metrics from distribution and response logs.
   */
  async getKPIMetrics(): Promise<KPIMetrics> {
    const [distributionLogs, responseLogs] = await Promise.all([
      googleSheetsService.getDistributionLogs(),
      googleSheetsService.getLeadResponseLogs(),
    ]);

    const now = Date.now();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const todayStr = new Date().toISOString().split('T')[0];

    // Total leads
    const totalLeads = distributionLogs.length;

    // Last 30 days
    const totalLeads30d = distributionLogs.filter(log => {
      if (!log.timestamp) return false;
      return new Date(log.timestamp) >= thirtyDaysAgo;
    }).length;

    // Today's leads
    const leadsToday = distributionLogs.filter(log => {
      if (!log.timestamp) return false;
      return log.timestamp.split('T')[0] === todayStr;
    }).length;

    // Conversion rate (responded / total from response logs)
    const respondedLogs = responseLogs.filter(
      log => log.responseMinutes && parseFloat(log.responseMinutes) > 0
    );
    const conversionRate = responseLogs.length > 0
      ? (respondedLogs.length / responseLogs.length) * 100
      : 0;

    // Average response time across all reps
    let avgResponseMinutes = 0;
    if (respondedLogs.length > 0) {
      const totalMinutes = respondedLogs.reduce(
        (sum, log) => sum + parseFloat(log.responseMinutes),
        0
      );
      avgResponseMinutes = totalMinutes / respondedLogs.length;
    }

    // Active timers
    const activeTimers = leadResponseTimerService.getActiveTimers().length;

    return {
      totalLeads,
      totalLeads30d,
      conversionRate: Math.round(conversionRate * 10) / 10,
      avgResponseMinutes: Math.round(avgResponseMinutes * 10) / 10,
      activeTimers,
      leadsToday,
    };
  }

  // ---------------------------------------------------------------------------
  // REP METRICS
  // ---------------------------------------------------------------------------

  /**
   * Calculate per-rep performance metrics from distribution logs,
   * response logs, and availability records.
   */
  async getRepMetrics(): Promise<RepMetrics[]> {
    const [distributionLogs, responseLogs, availabilityRecords] = await Promise.all([
      googleSheetsService.getDistributionLogs(),
      googleSheetsService.getLeadResponseLogs(),
      googleSheetsService.getRepAvailability(),
    ]);

    const salesReps = getSalesReps();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Build availability lookup
    const availabilityMap = new Map<string, RepAvailabilityRecord>();
    for (const rec of availabilityRecords) {
      availabilityMap.set(rec.repSlug, rec);
    }

    // Build response log lookup by rep
    const responseByRep = new Map<string, LeadResponseLogRecord[]>();
    for (const log of responseLogs) {
      const existing = responseByRep.get(log.repSlug) || [];
      existing.push(log);
      responseByRep.set(log.repSlug, existing);
    }

    const metrics: RepMetrics[] = [];

    for (const rep of salesReps) {
      // Distribution logs for this rep
      const repDistLogs = distributionLogs.filter(
        log => log.assignedRep === rep.slug
      );

      const totalLeads = repDistLogs.length;

      const totalLeads30d = repDistLogs.filter(log => {
        if (!log.timestamp) return false;
        return new Date(log.timestamp) >= thirtyDaysAgo;
      }).length;

      // Response logs for this rep
      const repResponseLogs = responseByRep.get(rep.slug) || [];

      const respondedLeads = repResponseLogs.filter(
        log => log.responseMinutes && parseFloat(log.responseMinutes) > 0
      ).length;

      const missedLeads = repResponseLogs.filter(
        log => !!log.reassignedAt
      ).length;

      // Close rate (responded / total)
      const closeRate = totalLeads > 0
        ? (respondedLeads / totalLeads) * 100
        : 0;

      // Average response time for this rep
      const respondedWithTime = repResponseLogs.filter(
        log => log.responseMinutes && parseFloat(log.responseMinutes) > 0
      );

      let avgResponseMinutes: number | null = null;
      if (respondedWithTime.length > 0) {
        const totalMinutes = respondedWithTime.reduce(
          (sum, log) => sum + parseFloat(log.responseMinutes),
          0
        );
        avgResponseMinutes = Math.round((totalMinutes / respondedWithTime.length) * 10) / 10;
      }

      // Availability status
      const availability = availabilityMap.get(rep.slug);
      const isReceivingLeads = availability
        ? availability.isReceivingLeads === 'true'
        : true;
      const adminPaused = availability
        ? availability.adminOverride === 'true'
        : false;
      const autoResumeAt = availability?.autoResumeAt || null;

      metrics.push({
        repSlug: rep.slug,
        repName: rep.name,
        totalLeads,
        totalLeads30d,
        respondedLeads,
        missedLeads,
        closeRate: Math.round(closeRate * 10) / 10,
        avgResponseMinutes,
        isReceivingLeads,
        adminPaused,
        autoResumeAt: autoResumeAt || null,
      });
    }

    return metrics;
  }

  // ---------------------------------------------------------------------------
  // ACTIVE TIMER STATES
  // ---------------------------------------------------------------------------

  /**
   * Get active response timers from the lead response timer service.
   */
  getActiveTimerStates(): TimerState[] {
    return leadResponseTimerService.getActiveTimers();
  }

  // ---------------------------------------------------------------------------
  // DISTRIBUTION HISTORY
  // ---------------------------------------------------------------------------

  /**
   * Get recent lead distributions formatted for dashboard display.
   * Parses algorithm scores JSON and resolves rep names.
   */
  async getDistributionHistory(limit?: number): Promise<DistributionHistoryEntry[]> {
    const logs = await googleSheetsService.getDistributionLogs({
      limit: limit || 50,
    });

    const salesReps = getSalesReps();

    return logs.map(log => {
      // Parse algorithm scores JSON
      let scores: Record<string, number> = {};
      try {
        scores = JSON.parse(log.algorithmScores || '{}');
      } catch {
        scores = {};
      }

      // Determine method from overrideReason
      let method = 'algorithm';
      if (log.overrideReason) {
        if (log.overrideReason.includes('Manual')) {
          method = 'manual';
        } else if (log.overrideReason.includes('Round robin')) {
          method = 'round_robin';
        }
      }

      // Resolve rep name
      const assignedRepName = salesReps.find(r => r.slug === log.assignedRep)?.name || log.assignedRep;

      return {
        logId: log.logId,
        customerName: log.customerName,
        address: log.address,
        assignedRep: log.assignedRep,
        assignedRepName,
        method,
        timestamp: log.timestamp,
        scores,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // SINGLE REP METRIC
  // ---------------------------------------------------------------------------

  /**
   * Get metrics for a single rep by slug.
   * Returns null if the rep is not found in the sales reps list.
   */
  async getRepMetric(repSlug: string): Promise<RepMetrics | null> {
    const salesReps = getSalesReps();
    const rep = salesReps.find(r => r.slug === repSlug);

    if (!rep) {
      return null;
    }

    const allMetrics = await this.getRepMetrics();
    return allMetrics.find(m => m.repSlug === repSlug) || null;
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const leadMetricsService = new LeadMetricsService();
