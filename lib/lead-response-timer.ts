// Lead Response Timer Service
// Tracks how quickly sales reps respond to assigned leads
// Uses in-memory timers + Google Sheets for persistence

import { googleSheetsService } from './google-sheets-service';

export interface TimerState {
  leadId: string;
  repSlug: string;
  customerName: string;
  assignedAt: Date;
  reminderSent: boolean;
  warningSent: boolean;
  firstContactAt?: Date;
  responseMinutes?: number;
}

export interface TimerConfig {
  reminderMinutes: number;
  warningMinutes: number;
  reassignMinutes: number;
}

const DEFAULT_CONFIG: TimerConfig = {
  reminderMinutes: 10,
  warningMinutes: 30,
  reassignMinutes: 60,
};

class LeadResponseTimerService {
  // In-memory timer store - resets on server restart but persisted data is in Sheets
  private activeTimers: Map<string, TimerState> = new Map();
  private config: TimerConfig = DEFAULT_CONFIG;

  setConfig(config: Partial<TimerConfig>) {
    this.config = { ...this.config, ...config };
  }

  getConfig(): TimerConfig {
    return { ...this.config };
  }

  // Start a timer when a lead is assigned to a rep
  async startTimer(leadId: string, repSlug: string, customerName: string): Promise<TimerState> {
    const now = new Date();

    const timer: TimerState = {
      leadId,
      repSlug,
      customerName,
      assignedAt: now,
      reminderSent: false,
      warningSent: false,
    };

    this.activeTimers.set(leadId, timer);

    // Persist to Google Sheets
    await googleSheetsService.addLeadResponseLog({
      leadId,
      repSlug,
      assignedAt: now.toISOString(),
      firstContactAt: '',
      responseMinutes: '',
      reminderSentAt: '',
      warningSentAt: '',
      reassignedAt: '',
      reassignedTo: '',
      missedReason: '',
    });

    console.log(`[ResponseTimer] Started timer for lead ${leadId} -> rep ${repSlug}`);
    return timer;
  }

  // Record that a rep has made first contact with a lead
  async recordContact(leadId: string): Promise<{ success: boolean; responseMinutes?: number }> {
    const timer = this.activeTimers.get(leadId);
    const now = new Date();

    if (!timer) {
      // Timer not in memory (server restart?), try to update sheet directly
      const responseMinutes = 0; // Unknown since we don't have assignedAt
      await googleSheetsService.updateLeadResponseLog(leadId, {
        firstContactAt: now.toISOString(),
      });
      return { success: true, responseMinutes: undefined };
    }

    timer.firstContactAt = now;
    timer.responseMinutes = Math.round(
      (now.getTime() - timer.assignedAt.getTime()) / (1000 * 60)
    );

    // Update sheet
    await googleSheetsService.updateLeadResponseLog(leadId, {
      firstContactAt: now.toISOString(),
      responseMinutes: String(timer.responseMinutes),
    });

    // Remove from active timers
    this.activeTimers.delete(leadId);

    console.log(`[ResponseTimer] Contact made for lead ${leadId} in ${timer.responseMinutes} minutes`);
    return { success: true, responseMinutes: timer.responseMinutes };
  }

  // Check all active timers and return actions needed
  checkTimers(): {
    reminders: TimerState[];
    warnings: TimerState[];
    reassignments: TimerState[];
  } {
    const now = new Date();
    const reminders: TimerState[] = [];
    const warnings: TimerState[] = [];
    const reassignments: TimerState[] = [];

    for (const [leadId, timer] of this.activeTimers) {
      if (timer.firstContactAt) continue; // Already contacted

      const elapsedMinutes = (now.getTime() - timer.assignedAt.getTime()) / (1000 * 60);

      if (elapsedMinutes >= this.config.reassignMinutes) {
        reassignments.push(timer);
      } else if (elapsedMinutes >= this.config.warningMinutes && !timer.warningSent) {
        warnings.push(timer);
      } else if (elapsedMinutes >= this.config.reminderMinutes && !timer.reminderSent) {
        reminders.push(timer);
      }
    }

    return { reminders, warnings, reassignments };
  }

  // Mark reminder as sent
  async markReminderSent(leadId: string): Promise<void> {
    const timer = this.activeTimers.get(leadId);
    if (timer) {
      timer.reminderSent = true;
    }
    await googleSheetsService.updateLeadResponseLog(leadId, {
      reminderSentAt: new Date().toISOString(),
    });
  }

  // Mark warning as sent
  async markWarningSent(leadId: string): Promise<void> {
    const timer = this.activeTimers.get(leadId);
    if (timer) {
      timer.warningSent = true;
    }
    await googleSheetsService.updateLeadResponseLog(leadId, {
      warningSentAt: new Date().toISOString(),
    });
  }

  // Record a reassignment
  async recordReassignment(leadId: string, newRepSlug: string, reason: string): Promise<void> {
    const timer = this.activeTimers.get(leadId);

    await googleSheetsService.updateLeadResponseLog(leadId, {
      reassignedAt: new Date().toISOString(),
      reassignedTo: newRepSlug,
      missedReason: reason,
    });

    // Remove old timer and start new one
    this.activeTimers.delete(leadId);

    // Start a new timer for the new rep
    if (timer) {
      await this.startTimer(leadId, newRepSlug, timer.customerName);
    }

    console.log(`[ResponseTimer] Lead ${leadId} reassigned from ${timer?.repSlug} to ${newRepSlug}: ${reason}`);
  }

  // Get all active timers
  getActiveTimers(): TimerState[] {
    return Array.from(this.activeTimers.values()).filter(t => !t.firstContactAt);
  }

  // Get timer for a specific lead
  getTimer(leadId: string): TimerState | undefined {
    return this.activeTimers.get(leadId);
  }

  // Get average response time for a rep (from persisted data)
  async getRepAverageResponseTime(repSlug: string): Promise<number | null> {
    const logs = await googleSheetsService.getLeadResponseLogs({ repSlug });

    const responded = logs.filter(l => l.responseMinutes && parseFloat(l.responseMinutes) > 0);
    if (responded.length === 0) return null;

    const total = responded.reduce((sum, l) => sum + parseFloat(l.responseMinutes), 0);
    return total / responded.length;
  }

  // Get response time stats for all reps
  async getAllRepResponseStats(): Promise<Record<string, {
    avgMinutes: number | null;
    totalLeads: number;
    respondedLeads: number;
    missedLeads: number;
  }>> {
    const logs = await googleSheetsService.getLeadResponseLogs();
    const stats: Record<string, {
      avgMinutes: number | null;
      totalLeads: number;
      respondedLeads: number;
      missedLeads: number;
      totalMinutes: number;
    }> = {};

    for (const log of logs) {
      if (!stats[log.repSlug]) {
        stats[log.repSlug] = {
          avgMinutes: null,
          totalLeads: 0,
          respondedLeads: 0,
          missedLeads: 0,
          totalMinutes: 0,
        };
      }

      const repStats = stats[log.repSlug];
      repStats.totalLeads++;

      if (log.responseMinutes && parseFloat(log.responseMinutes) > 0) {
        repStats.respondedLeads++;
        repStats.totalMinutes += parseFloat(log.responseMinutes);
      }

      if (log.reassignedAt) {
        repStats.missedLeads++;
      }
    }

    // Calculate averages
    const result: Record<string, any> = {};
    for (const [slug, s] of Object.entries(stats)) {
      result[slug] = {
        avgMinutes: s.respondedLeads > 0 ? s.totalMinutes / s.respondedLeads : null,
        totalLeads: s.totalLeads,
        respondedLeads: s.respondedLeads,
        missedLeads: s.missedLeads,
      };
    }

    return result;
  }
}

// Export singleton
export const leadResponseTimerService = new LeadResponseTimerService();
