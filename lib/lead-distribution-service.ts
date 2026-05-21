// Lead Distribution Service
// Core algorithm for scoring and assigning incoming leads to sales reps
// based on proximity, referrals, attendance, and performance metrics.

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { geocodingService, GeocodedContact } from '@/lib/geocoding-service';
import {
  googleSheetsService,
  GeocodedContactRecord,
  RepAvailabilityRecord,
  RepPreferencesRecord,
  LeadDistributionLogRecord,
} from '@/lib/google-sheets-service';
import { TEAM_MEMBERS, getSalesReps, TeamMember } from '@/lib/team-roles';
import { jnResponseMiner, RepResponseStats } from '@/lib/jn-response-miner';
import { leadResponseTimerService } from '@/lib/lead-response-timer';
import { groupMeService, getGroupMeConfigFromEnv } from '@/lib/groupme-service';
import { riverBot } from '@/lib/river-bot-service';
import defaultConfig from '@/data/lead-distro-config.json';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface LeadDistroConfig {
  weights: {
    installProximity: number;
    contactProximity: number;
    doorKnockRecency: number;
    referralBonus: number;
    meetingAttendance: number;
    closeRate: number;
    responseTime: number;
  };
  // Per-factor enabled flag. Missing or true = factor counts; false = factor
  // is dismissed entirely (audit log shows "DISABLED (admin)" not "weight=0").
  // The UI constraint "weights must total 100" applies only to ENABLED factors.
  weightsEnabled?: {
    installProximity?: boolean;
    contactProximity?: boolean;
    doorKnockRecency?: boolean;
    referralBonus?: boolean;
    meetingAttendance?: boolean;
    closeRate?: boolean;
    responseTime?: boolean;
  };
  // Routing mode. 'auto' = algorithm assigns immediately (legacy behavior).
  // 'suggest' = algorithm returns top-N candidates with reasons but does NOT
  // assign or start the response timer; a dispatcher confirms. Default: auto.
  routingMode?: 'auto' | 'suggest';
  // Number of suggestions to surface in suggest mode. Default: 3.
  suggestionCount?: number;
  thresholds: {
    proximityRadiusMiles: number;
    recentInteractionDays: number;
    staleInteractionDays: number;
    minRepsForDistribution: number;
    clearWinnerGapPercent?: number; // round-robin trigger when gap < N%; default 10
    newRepTenureDays?: number; // reps younger than this get default-factor boost; default 30
    newRepDefaultBoost?: number; // boost value for new reps' default factors (vs 0.5); default 0.7
  };
  responseTimers: {
    reminderMinutes: number;
    warningMinutes: number;
    urgentWarningMinutes: number;
    reassignMinutes: number;
  };
  counties: string[];
  updatedAt: string;
  updatedBy: string;
}

export interface ScoreFactor {
  score: number;
  weight: number;
  raw: number;
  explanation: string;
}

export interface RepScore {
  repSlug: string;
  repName: string;
  totalScore: number;
  factors: Record<string, ScoreFactor>;
  isAvailable: boolean;
  isEligible: boolean;
  disqualifyReason?: string;
  // For tiebreaker / explainability
  lastAssignedAt?: string; // ISO timestamp from lead-response-log; '' if never
  isNewRep?: boolean;
}

export interface DistributionResult {
  assignedRep: RepScore;
  allScores: RepScore[];
  method: 'algorithm' | 'round_robin' | 'manual';
  logId: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CONFIG_FILE_PATH = path.join(process.cwd(), 'data', 'lead-distro-config.json');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// =============================================================================
// LEAD DISTRIBUTION SERVICE CLASS
// =============================================================================

class LeadDistributionService {
  private roundRobinIndex = 0;
  private jnResponseTimeCache: RepResponseStats[] | null = null;

  // ---------------------------------------------------------------------------
  // CONFIG MANAGEMENT
  // ---------------------------------------------------------------------------

  /**
   * Read the current lead distribution configuration.
   * Attempts to read from disk first (runtime updates), falls back to imported default.
   */
  getConfig(): LeadDistroConfig {
    try {
      const raw = readFileSync(CONFIG_FILE_PATH, 'utf-8');
      return JSON.parse(raw) as LeadDistroConfig;
    } catch {
      return defaultConfig as LeadDistroConfig;
    }
  }

  /**
   * Save updated configuration to disk. Best-effort: Vercel filesystem is
   * read-only at runtime, so failures are logged but not thrown. The Phase 1
   * backup cron snapshots data/*.json hourly so dev writes are still captured.
   */
  saveConfig(config: LeadDistroConfig, updatedBy: string): void {
    const updated: LeadDistroConfig = {
      ...config,
      updatedAt: new Date().toISOString(),
      updatedBy,
    };
    try {
      writeFileSync(CONFIG_FILE_PATH, JSON.stringify(updated, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[LeadDistribution] Local config write skipped (read-only fs?):', err);
    }
  }

  // ---------------------------------------------------------------------------
  // MAIN SCORING ALGORITHM
  // ---------------------------------------------------------------------------

  /**
   * Calculate scores for all active sales reps for a given lead address.
   * This is the core distribution algorithm.
   */
  async calculateRepScores(
    leadAddress: string,
    leadSource?: string,
    referralRepSlug?: string
  ): Promise<RepScore[]> {
    const config = this.getConfig();

    // Geocode the lead address
    const geocoded = await geocodingService.geocodeAddress(leadAddress);
    if (!geocoded) {
      console.warn(`[LeadDistro] Could not geocode address: ${leadAddress}`);
      return [];
    }

    const leadCounty = geocoded.components.county || '';

    // Fetch all data in parallel (including JN mined response times)
    const [allContacts, availabilityRecords, preferencesRecords, responseLogs, jnResponseTimes] =
      await Promise.all([
        googleSheetsService.getGeocodedContacts(),
        googleSheetsService.getRepAvailability(),
        googleSheetsService.getRepPreferences(),
        googleSheetsService.getLeadResponseLogs(),
        jnResponseMiner.getStoredResponseTimes().catch(() => [] as RepResponseStats[]),
      ]);

    // Cache JN response times for use in scoreResponseTime()
    this.jnResponseTimeCache = jnResponseTimes;

    // Build lookup maps
    const availabilityMap = new Map<string, RepAvailabilityRecord>();
    for (const rec of availabilityRecords) {
      availabilityMap.set(rec.repSlug, rec);
    }

    const preferencesMap = new Map<string, RepPreferencesRecord>();
    for (const rec of preferencesRecords) {
      preferencesMap.set(rec.repSlug, rec);
    }

    // Convert sheet records to GeocodedContact format with numeric lat/lng.
    // Parse FIRST, then filter NaN — guards against malformed lat/lng strings
    // ("abc", "34.6N", trailing spaces) that would corrupt downstream haversine
    // math and propagate NaN scores through the algorithm.
    const contacts: GeocodedContact[] = allContacts
      .map(c => ({
        jnid: c.jnid,
        name: c.name,
        address: c.address,
        lat: parseFloat(c.lat),
        lng: parseFloat(c.lng),
        placeId: c.placeId,
        type: c.type as GeocodedContact['type'],
        salesRep: c.salesRep,
        jobStatus: c.jobStatus,
        lastInteraction: c.lastInteraction,
        interactionType: c.interactionType,
        createdAt: c.createdAt,
      }))
      .filter(c => !Number.isNaN(c.lat) && !Number.isNaN(c.lng));

    const salesReps = getSalesReps();
    const scores: RepScore[] = [];

    // Build per-rep "last assigned at" map from the response log (used for tiebreaker)
    const lastAssignedByRep = new Map<string, string>();
    for (const log of responseLogs) {
      const cur = lastAssignedByRep.get(log.repSlug) || '';
      if (log.assignedAt && (!cur || log.assignedAt > cur)) {
        lastAssignedByRep.set(log.repSlug, log.assignedAt);
      }
    }

    const now = Date.now();
    const newRepWindow = config.thresholds.newRepTenureDays ?? 30;

    for (const rep of salesReps) {
      const score = this.scoreRep(
        rep,
        geocoded.lat,
        geocoded.lng,
        leadCounty,
        contacts,
        availabilityMap.get(rep.slug),
        preferencesMap.get(rep.slug),
        responseLogs.filter(l => l.repSlug === rep.slug),
        config,
        referralRepSlug
      );
      score.lastAssignedAt = lastAssignedByRep.get(rep.slug) || '';
      score.isNewRep = this.getTenureDays(rep, now) <= newRepWindow;
      scores.push(score);
    }

    // Sort by total score descending
    scores.sort((a, b) => b.totalScore - a.totalScore);

    return scores;
  }

  /**
   * Build a short human-readable reason for why a particular rep was chosen.
   * Picks the two highest-contributing factors and surfaces their explanations.
   */
  private buildReasonString(score: RepScore, tiebreaker: string): string {
    const sortedFactors = Object.entries(score.factors)
      .filter(([, f]) => f.score > 0)
      .sort((a, b) => b[1].score - a[1].score);
    const top = sortedFactors.slice(0, 2);
    if (top.length === 0) {
      return `${score.repName}: no positive factor scores; selected via ${tiebreaker || 'round-robin'}`;
    }
    const bits = top.map(([k, f]) => `${k} ${f.score.toFixed(1)} (${f.explanation})`);
    const tail = tiebreaker ? ` · tiebreaker: ${tiebreaker}` : '';
    return `${score.repName}: ${bits.join(' + ')}${tail}`;
  }

  /**
   * Score an individual rep for a given lead location.
   */
  private scoreRep(
    rep: TeamMember,
    leadLat: number,
    leadLng: number,
    leadCounty: string,
    allContacts: GeocodedContact[],
    availability: RepAvailabilityRecord | undefined,
    preferences: RepPreferencesRecord | undefined,
    repResponseLogs: { responseMinutes: string }[],
    config: LeadDistroConfig,
    referralRepSlug?: string
  ): RepScore {
    const factors: Record<string, ScoreFactor> = {};
    let isAvailable = true;
    let isEligible = true;
    let disqualifyReason: string | undefined;

    // --- Availability check ---
    if (availability) {
      const receiving = availability.isReceivingLeads === 'true';
      const adminOverride = availability.adminOverride === 'true';

      if (!receiving || adminOverride) {
        isAvailable = false;
        isEligible = false;
        disqualifyReason = adminOverride
          ? `Admin override: ${availability.adminOverrideReason || 'paused by admin'}`
          : 'Rep is not receiving leads';
      }
    }

    // --- County check ---
    if (isEligible && preferences && leadCounty) {
      try {
        const countiesEnabled: string[] = JSON.parse(preferences.countiesEnabled || '[]');
        // If the rep has specified counties and the lead's county is not in the list, disqualify
        if (countiesEnabled.length > 0 && !countiesEnabled.includes(leadCounty)) {
          isEligible = false;
          disqualifyReason = `County "${leadCounty}" not in rep's enabled counties`;
        }
      } catch {
        // If parsing fails, don't disqualify
      }
    }

    const radius = config.thresholds.proximityRadiusMiles;
    const now = Date.now();
    // Lenient rep match: writers may store first-name slug ('aaron'), full-name
    // slug ('aaron-lussi'), or the raw display name ('Aaron Lussi'). Accept all.
    const repFullSlug = rep.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const repContacts = allContacts.filter(c =>
      c.salesRep === rep.slug ||
      c.salesRep === rep.name ||
      c.salesRep === repFullSlug
    );

    // Per-factor weight access with safe defaults. Guards against the case
    // where a manual JSON edit removed a weight field — without defaults,
    // `undefined * score` would propagate NaN through totalScore and corrupt
    // the sort comparison.
    const w = {
      installProximity: config.weights.installProximity ?? 0,
      contactProximity: config.weights.contactProximity ?? 0,
      doorKnockRecency: config.weights.doorKnockRecency ?? 0,
      referralBonus: config.weights.referralBonus ?? 0,
      meetingAttendance: config.weights.meetingAttendance ?? 0,
      closeRate: config.weights.closeRate ?? 0,
      responseTime: config.weights.responseTime ?? 0,
    };

    // --- 1. Install Proximity ---
    const installScore = this.scoreProximity(
      repContacts.filter(c => c.type === 'install'),
      leadLat,
      leadLng,
      radius,
      now,
      config
    );
    factors.installProximity = {
      score: installScore.score * w.installProximity,
      weight: w.installProximity,
      raw: installScore.score,
      explanation: installScore.explanation,
    };

    // --- 2. Contact Proximity ---
    const contactScore = this.scoreProximity(
      repContacts.filter(c => c.type === 'contact' || c.type === 'lead' || c.type === 'referral'),
      leadLat,
      leadLng,
      radius,
      now,
      config
    );
    factors.contactProximity = {
      score: contactScore.score * w.contactProximity,
      weight: w.contactProximity,
      raw: contactScore.score,
      explanation: contactScore.explanation,
    };

    // --- 3. Door Knock Recency ---
    const knockScore = this.scoreDoorKnocks(
      repContacts.filter(c => c.type === 'door_knock'),
      leadLat,
      leadLng,
      radius,
      now,
      config
    );
    factors.doorKnockRecency = {
      score: knockScore.score * w.doorKnockRecency,
      weight: w.doorKnockRecency,
      raw: knockScore.score,
      explanation: knockScore.explanation,
    };

    // --- 4. Referral Bonus ---
    const isReferral = referralRepSlug === rep.slug;
    factors.referralBonus = {
      score: isReferral ? w.referralBonus : 0,
      weight: w.referralBonus,
      raw: isReferral ? 1.0 : 0.0,
      explanation: isReferral
        ? 'This rep referred the lead - full referral bonus applied'
        : 'No referral bonus',
    };

    // --- New-rep tenure boost ---
    // Reps within the configured tenure window get a higher default score for
    // factors that depend on accumulated history (attendance, close rate,
    // response time). Without this, brand-new reps structurally score at the
    // floor and only ever win via round-robin.
    const tenureDays = this.getTenureDays(rep, now);
    const newRepWindow = config.thresholds.newRepTenureDays ?? 30;
    const newRepBoost = config.thresholds.newRepDefaultBoost ?? 0.7;
    const isNewRep = tenureDays <= newRepWindow;

    // --- 5. Meeting Attendance ---
    const attendanceScore = this.scoreMeetingAttendance(repResponseLogs, isNewRep ? newRepBoost : 0.5);
    factors.meetingAttendance = {
      score: attendanceScore.score * w.meetingAttendance,
      weight: w.meetingAttendance,
      raw: attendanceScore.score,
      explanation: attendanceScore.explanation + (isNewRep ? ' (new-rep boost applied)' : ''),
    };

    // --- 6. Close Rate ---
    const closeRateScore = this.scoreCloseRate(repResponseLogs, isNewRep ? newRepBoost : 0.5);
    factors.closeRate = {
      score: closeRateScore.score * w.closeRate,
      weight: w.closeRate,
      raw: closeRateScore.score,
      explanation: closeRateScore.explanation + (isNewRep ? ' (new-rep boost applied)' : ''),
    };

    // --- 7. Response Time (uses JN mined data when available) ---
    const responseScore = this.scoreResponseTime(repResponseLogs, rep.slug, isNewRep ? newRepBoost : 0.5);
    factors.responseTime = {
      score: responseScore.score * w.responseTime,
      weight: w.responseTime,
      raw: responseScore.score,
      explanation: responseScore.explanation + (isNewRep ? ' (new-rep boost applied)' : ''),
    };

    // --- Apply dismissible-toggle: zero out any disabled factor ---
    // weightsEnabled is optional; missing or true = enabled. False = dismissed.
    const enabledMap = config.weightsEnabled || {};
    for (const key of Object.keys(factors)) {
      const isEnabled = enabledMap[key as keyof typeof enabledMap] !== false;
      if (!isEnabled) {
        factors[key].score = 0;
        factors[key].raw = 0;
        factors[key].explanation = `DISABLED (admin) — ${factors[key].explanation}`;
      }
    }

    // --- Calculate total score ---
    let totalScore = 0;
    if (isEligible) {
      for (const factor of Object.values(factors)) {
        totalScore += factor.score;
      }
    }

    return {
      repSlug: rep.slug,
      repName: rep.name,
      totalScore,
      factors,
      isAvailable,
      isEligible,
      disqualifyReason,
    };
  }

  // ---------------------------------------------------------------------------
  // SCORING HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Score proximity-based factors (installs or contacts).
   * Finds records within radius, scores by (1 - distance/radius) * recencyMultiplier.
   * Returns the best single score among nearby records.
   */
  private scoreProximity(
    contacts: GeocodedContact[],
    leadLat: number,
    leadLng: number,
    radius: number,
    now: number,
    config: LeadDistroConfig
  ): { score: number; explanation: string } {
    if (contacts.length === 0) {
      return { score: 0, explanation: 'No records found for this rep' };
    }

    let bestScore = 0;
    let bestExplanation = '';
    let nearbyCount = 0;

    for (const contact of contacts) {
      const distance = geocodingService.calculateDistance(
        leadLat,
        leadLng,
        contact.lat,
        contact.lng
      );

      if (distance > radius) continue;

      nearbyCount++;
      const distanceScore = 1 - distance / radius;
      const recencyMultiplier = this.getRecencyMultiplier(contact.lastInteraction, now, config);
      const combined = distanceScore * recencyMultiplier;

      if (combined > bestScore) {
        bestScore = combined;
        bestExplanation = `${contact.name} at ${distance.toFixed(2)}mi (recency: ${recencyMultiplier}x)`;
      }
    }

    if (nearbyCount === 0) {
      return { score: 0, explanation: `No records within ${radius}mi radius` };
    }

    return {
      score: Math.min(bestScore, 1.0),
      explanation: `${nearbyCount} record(s) within ${radius}mi. Best: ${bestExplanation}`,
    };
  }

  /**
   * Score door knock recency in the area.
   * Decays over 90 days.
   */
  private scoreDoorKnocks(
    knocks: GeocodedContact[],
    leadLat: number,
    leadLng: number,
    radius: number,
    now: number,
    config: LeadDistroConfig
  ): { score: number; explanation: string } {
    if (knocks.length === 0) {
      return { score: 0, explanation: 'No door knocks recorded for this rep' };
    }

    const recentDays = config.thresholds.recentInteractionDays; // 90
    let bestScore = 0;
    let nearbyKnocks = 0;

    for (const knock of knocks) {
      const distance = geocodingService.calculateDistance(
        leadLat,
        leadLng,
        knock.lat,
        knock.lng
      );

      if (distance > radius) continue;

      nearbyKnocks++;

      // Decay over recentDays (90 days default)
      const interactionDate = knock.lastInteraction ? new Date(knock.lastInteraction).getTime() : 0;
      const daysSince = interactionDate > 0 ? (now - interactionDate) / MS_PER_DAY : recentDays;
      const recencyScore = Math.max(0, 1 - daysSince / recentDays);
      const distanceScore = 1 - distance / radius;
      const combined = distanceScore * recencyScore;

      if (combined > bestScore) {
        bestScore = combined;
      }
    }

    if (nearbyKnocks === 0) {
      return { score: 0, explanation: `No door knocks within ${radius}mi radius` };
    }

    return {
      score: Math.min(bestScore, 1.0),
      explanation: `${nearbyKnocks} knock(s) within ${radius}mi. Best score: ${bestScore.toFixed(3)}`,
    };
  }

  /**
   * Calculate recency multiplier via smooth exponential decay.
   * `0.1 + 0.9 * exp(-days/180)` — 1.0 today, 0.55 at 90d, 0.32 at 180d, 0.18 at 365d, 0.10 floor.
   * Smoother than the old 90/365/730-day step cliffs (which dropped 30% in a single day).
   */
  private getRecencyMultiplier(
    lastInteraction: string,
    now: number,
    _config: LeadDistroConfig
  ): number {
    if (!lastInteraction) return 0.1;
    const interactionTime = new Date(lastInteraction).getTime();
    if (isNaN(interactionTime)) return 0.1;
    const daysSince = Math.max(0, (now - interactionTime) / MS_PER_DAY);
    const decayHalfLifeDays = 180;
    return Math.max(0.1, 0.1 + 0.9 * Math.exp(-daysSince / decayHalfLifeDays));
  }

  /**
   * Days since the rep was added to the system. Used to give new reps a
   * tenure-based default-factor boost (avoids structural starvation when
   * they have no historical performance data yet).
   */
  private getTenureDays(rep: TeamMember, now: number): number {
    if (!rep.createdAt) return Infinity;
    const created = new Date(rep.createdAt).getTime();
    if (isNaN(created)) return Infinity;
    return Math.max(0, (now - created) / MS_PER_DAY);
  }

  /**
   * Score a rep's response time based on historical lead response logs
   * AND mined JN response time data.
   *
   * Priority:
   * 1. JN mined data (from JN_Response_Times sheet) — most accurate
   * 2. Lead response logs (from Lead_Response_Log sheet) — in-portal data
   * 3. Default 0.5 if no data exists
   *
   * Scoring curve (based on avg response minutes):
   *   <15min = 1.0, <30min = 0.8, <60min = 0.6,
   *   <2hr = 0.4, <4hr = 0.2, >4hr = 0.1
   */
  private scoreResponseTime(
    responseLogs: { responseMinutes: string }[],
    repSlug?: string,
    defaultScore: number = 0.5
  ): { score: number; explanation: string } {
    // Check JN mined data first (loaded into cache by calculateRepScores)
    if (repSlug && this.jnResponseTimeCache) {
      const jnData = this.jnResponseTimeCache.find(r => r.repSlug === repSlug);
      if (jnData && jnData.totalJobsAnalyzed > 0) {
        const avgMin = jnData.avgResponseMinutes;
        const score = this.responseTimeToScore(avgMin);
        return {
          score,
          explanation: `JN avg: ${avgMin.toFixed(0)}min (median ${jnData.medianResponseMinutes.toFixed(0)}min) over ${jnData.totalJobsAnalyzed} jobs`,
        };
      }
    }

    // Fallback to lead response logs
    const validLogs = responseLogs.filter(
      l => l.responseMinutes && parseFloat(l.responseMinutes) > 0
    );

    if (validLogs.length === 0) {
      return { score: defaultScore, explanation: `No response time data - using default ${defaultScore.toFixed(2)}` };
    }

    const totalMinutes = validLogs.reduce(
      (sum, l) => sum + parseFloat(l.responseMinutes),
      0
    );
    const avgMinutes = totalMinutes / validLogs.length;
    const score = this.responseTimeToScore(avgMinutes);

    return {
      score,
      explanation: `Avg response: ${avgMinutes.toFixed(1)}min over ${validLogs.length} lead(s)`,
    };
  }

  /**
   * Score a rep's "meeting attendance" based on their lead engagement rate.
   * Uses the ratio of responded leads to total assigned leads as a proxy.
   * Reps who consistently engage with their leads score higher.
   *
   * Scoring: >90% engaged = 1.0, >75% = 0.8, >50% = 0.6, >25% = 0.3, else 0.1
   * Default 0.5 if fewer than 3 leads (insufficient data).
   */
  private scoreMeetingAttendance(
    responseLogs: { responseMinutes: string }[],
    defaultScore: number = 0.5
  ): { score: number; explanation: string } {
    if (responseLogs.length < 3) {
      return { score: defaultScore, explanation: `Insufficient data (${responseLogs.length} leads) - using default ${defaultScore.toFixed(2)}` };
    }

    const responded = responseLogs.filter(
      l => l.responseMinutes && parseFloat(l.responseMinutes) > 0
    ).length;
    const total = responseLogs.length;
    const engagementRate = responded / total;

    let score: number;
    if (engagementRate >= 0.9) score = 1.0;
    else if (engagementRate >= 0.75) score = 0.8;
    else if (engagementRate >= 0.5) score = 0.6;
    else if (engagementRate >= 0.25) score = 0.3;
    else score = 0.1;

    return {
      score,
      explanation: `${responded}/${total} leads engaged (${(engagementRate * 100).toFixed(0)}% rate)`,
    };
  }

  /**
   * Score a rep's close rate from their lead response data.
   * Uses the number of responded leads relative to total.
   * Effectively the same data as attendance but scored on a continuous curve.
   *
   * Scoring: Linear map from 0-100% engagement to 0.0-1.0, clamped.
   * Default 0.5 if fewer than 3 leads.
   */
  private scoreCloseRate(
    responseLogs: { responseMinutes: string }[],
    defaultScore: number = 0.5
  ): { score: number; explanation: string } {
    if (responseLogs.length < 3) {
      return { score: defaultScore, explanation: `Insufficient data (${responseLogs.length} leads) - using default ${defaultScore.toFixed(2)}` };
    }

    const responded = responseLogs.filter(
      l => l.responseMinutes && parseFloat(l.responseMinutes) > 0
    ).length;
    const total = responseLogs.length;
    const rate = responded / total;
    const score = Math.min(1.0, Math.max(0, rate));

    return {
      score,
      explanation: `${responded}/${total} leads closed/responded (${(rate * 100).toFixed(0)}%)`,
    };
  }

  /**
   * Convert average response time in minutes to a 0-1 score.
   * Faster = higher score.
   */
  private responseTimeToScore(avgMinutes: number): number {
    if (avgMinutes <= 15) return 1.0;
    if (avgMinutes <= 30) return 0.8;
    if (avgMinutes <= 60) return 0.6;
    if (avgMinutes <= 120) return 0.4;
    if (avgMinutes <= 240) return 0.2;
    return 0.1;
  }

  // ---------------------------------------------------------------------------
  // LEAD DISTRIBUTION
  // ---------------------------------------------------------------------------

  /**
   * Distribute a lead to the best-fit sales rep.
   * Supports manual override, algorithmic assignment, and round-robin fallback.
   * After assignment:
   *   - Logs the distribution to Google Sheets
   *   - Starts a response timer for the assigned rep
   *   - Sends GroupMe notification (group post + rep DM)
   *   - Syncs timer config from lead-distro-config
   */
  async distributeLead(
    leadAddress: string,
    customerName: string,
    leadId: string,
    source?: string,
    referralRepSlug?: string,
    overrideRepSlug?: string
  ): Promise<DistributionResult> {
    const logId = this.generateLogId();
    const config = this.getConfig();

    // Sync response timer config from lead distribution config
    leadResponseTimerService.setConfig({
      reminderMinutes: config.responseTimers.reminderMinutes,
      warningMinutes: config.responseTimers.warningMinutes,
      urgentWarningMinutes: config.responseTimers.urgentWarningMinutes,
      reassignMinutes: config.responseTimers.reassignMinutes,
    });

    let result: DistributionResult;

    // --- Manual override ---
    if (overrideRepSlug) {
      const overrideRep = getSalesReps().find(r => r.slug === overrideRepSlug);
      if (!overrideRep) {
        throw new Error(`Override rep "${overrideRepSlug}" not found among active sales reps`);
      }

      // Check rep availability — warn but allow the override (admin's choice).
      // Audit trail captures the bypass.
      let availWarn = '';
      try {
        const availRecords = await googleSheetsService.getRepAvailability(overrideRep.slug);
        const rec = availRecords.find(r => r.repSlug === overrideRep.slug);
        if (rec) {
          if (rec.isReceivingLeads !== 'true') {
            availWarn = '[OVERRIDE-AVAIL-WARN] Rep was marked not-receiving-leads';
          }
          if (rec.adminOverride === 'true') {
            availWarn = '[OVERRIDE-AVAIL-WARN] Rep was admin-overridden off';
          }
        }
      } catch {
        // availability check is best-effort
      }

      const manualScore: RepScore = {
        repSlug: overrideRep.slug,
        repName: overrideRep.name,
        totalScore: 100,
        factors: {
          manual: {
            score: 100,
            weight: 100,
            raw: 1.0,
            explanation: `Manually assigned to ${overrideRep.name}${availWarn ? ' — ' + availWarn : ''}`,
          },
        },
        isAvailable: !availWarn,
        isEligible: true,
      };

      const manualReason = `${overrideRep.name}: manual override by dispatcher${availWarn ? ' (' + availWarn + ')' : ''}`;
      await this.logDistribution(logId, leadId, customerName, leadAddress, manualScore, [], 'manual', manualReason, null, '', config.updatedAt || '');

      // Parity with the auto-assign path: write the outcome-log stub so any
      // post-assignment event (first contact, sold, lost) can upsert against it.
      if (leadId && leadId !== 'pending') {
        googleSheetsService.upsertLeadOutcomeLog({
          logId,
          leadId,
          assignedRep: overrideRep.slug,
          originalAssignedRep: overrideRep.slug,
          finalDisposition: 'open',
        }).catch(err => {
          console.warn(`[LeadDistro] Failed to create outcome-log stub for manual override on ${leadId}:`, err);
        });
      }

      result = {
        assignedRep: manualScore,
        allScores: [manualScore],
        method: 'manual',
        logId,
      };
    } else {
      // --- Algorithmic assignment ---
      const allScores = await this.calculateRepScores(leadAddress, source, referralRepSlug);
      const eligibleScores = allScores.filter(s => s.isEligible);

      if (eligibleScores.length === 0) {
        throw new Error('No eligible sales reps available for lead distribution');
      }

      // --- Suggest mode: surface top-N, write a pending-pick outcome stub,
      // but do NOT actually assign or start a timer. Manager must confirm via
      // overrideRepSlug to finalize. The distribution log's assignedRep stays
      // EMPTY in suggest mode — the provisional #1 is captured separately in
      // the reason field. This way the audit shows the lead was NOT assigned.
      if ((config.routingMode || 'auto') === 'suggest' && leadId && leadId !== 'pending') {
        const count = config.suggestionCount ?? 3;
        const top = eligibleScores.slice(0, count);
        const winner = top[0]; // for surface purposes only — NOT assigned
        const candidatesText = top
          .map((s, i) => `${i + 1}. ${s.repName} (score ${s.totalScore.toFixed(1)})`)
          .join(' · ');
        const reason = `Suggest mode — awaiting manager pick. Top ${top.length}: ${candidatesText}`;
        // Write log with EMPTY assignedRep — explicitly NOT assigned yet
        const emptyAssign: RepScore = {
          repSlug: '',
          repName: '(pending manager pick)',
          totalScore: 0,
          factors: winner.factors, // surface the provisional #1's breakdown for context
          isAvailable: false,
          isEligible: false,
        };
        await this.logDistribution(
          logId, leadId, customerName, leadAddress,
          emptyAssign, allScores, 'algorithm', reason,
          top[1] || null, 'pending-manager-pick', config.updatedAt || ''
        );
        googleSheetsService.upsertLeadOutcomeLog({
          logId,
          leadId,
          assignedRep: '',
          originalAssignedRep: '',
          finalDisposition: 'pending-manager-pick',
        }).catch(err => {
          console.warn(`[LeadDistro] Failed to create pending-pick outcome stub for ${leadId}:`, err);
        });
        return {
          assignedRep: winner, // returned for caller's display purposes (top-1 hint)
          allScores,
          method: 'algorithm',
          logId,
        };
      }

      const topScore = eligibleScores[0];
      const secondScore = eligibleScores.length > 1 ? eligibleScores[1] : null;

      // Clear-winner gap threshold from config (default 10%)
      const gapPct = (config.thresholds.clearWinnerGapPercent ?? 10) / 100;
      const hasClearWinner =
        topScore.totalScore > 0 &&
        (!secondScore || (topScore.totalScore - secondScore.totalScore) / topScore.totalScore > gapPct);

      if (hasClearWinner) {
        const reason = this.buildReasonString(topScore, '');
        await this.logDistribution(logId, leadId, customerName, leadAddress, topScore, allScores, 'algorithm', reason, secondScore, '', config.updatedAt || '');

        result = {
          assignedRep: topScore,
          allScores,
          method: 'algorithm',
          logId,
        };
      } else {
        // --- Tiebreaker: longest time since last assignment ---
        // Take all candidates within `gapPct` of the top, pick the one with the
        // oldest lastAssignedAt (or never assigned). Falls back to round-robin
        // counter if everyone has identical history.
        const threshold = topScore.totalScore * (1 - gapPct);
        const candidates = eligibleScores.filter(s => s.totalScore >= threshold);
        const candidateByOldest = [...candidates].sort((a, b) => {
          const aTime = a.lastAssignedAt ? new Date(a.lastAssignedAt).getTime() : 0;
          const bTime = b.lastAssignedAt ? new Date(b.lastAssignedAt).getTime() : 0;
          return aTime - bTime; // ascending: oldest first
        });

        let tiebreakerApplied = '';
        let pick: RepScore;
        if (candidateByOldest.length > 0 && candidateByOldest[0].lastAssignedAt !== candidateByOldest[candidateByOldest.length - 1]?.lastAssignedAt) {
          pick = candidateByOldest[0];
          tiebreakerApplied = 'longest-since-last';
        } else {
          pick = this.getNextRoundRobin(candidates.length ? candidates : eligibleScores);
          tiebreakerApplied = 'round-robin-counter';
        }

        const reason = this.buildReasonString(pick, tiebreakerApplied);
        await this.logDistribution(logId, leadId, customerName, leadAddress, pick, allScores, 'round_robin', reason, secondScore, tiebreakerApplied, config.updatedAt || '');

        result = {
          assignedRep: pick,
          allScores,
          method: 'round_robin',
          logId,
        };
      }
    }

    // --- Post-distribution actions (non-blocking) ---
    const assignedRepSlug = result.assignedRep.repSlug;
    const assignedRepName = result.assignedRep.repName;
    const assignedMember = TEAM_MEMBERS.find(m => m.slug === assignedRepSlug);

    // Start response timer (only if real lead, not preview)
    if (leadId && leadId !== 'pending') {
      leadResponseTimerService.startTimer(leadId, assignedRepSlug, customerName).catch(err => {
        console.warn(`[LeadDistro] Failed to start response timer for ${leadId}:`, err);
      });

      // Open a stub outcome-log row so downstream events (first contact,
      // estimate, sold/lost, reassignment) can upsert against this logId.
      googleSheetsService.upsertLeadOutcomeLog({
        logId,
        leadId,
        assignedRep: assignedRepSlug,
        originalAssignedRep: assignedRepSlug,
        finalDisposition: 'open',
      }).catch(err => {
        console.warn(`[LeadDistro] Failed to create outcome-log stub for ${leadId}:`, err);
      });
    }

    // Send GroupMe notifications (fire and forget)
    this.sendDistributionNotifications(
      customerName,
      leadAddress,
      source || 'unknown',
      assignedRepName,
      assignedMember?.email || '',
      result.method,
      result.assignedRep.totalScore
    ).catch(err => {
      console.warn('[LeadDistro] Notification send failed:', err);
    });

    return result;
  }

  /**
   * Send GroupMe notifications after lead distribution.
   * Posts to group and sends DM to assigned rep.
   */
  private async sendDistributionNotifications(
    customerName: string,
    address: string,
    source: string,
    repName: string,
    repEmail: string,
    method: string,
    score: number
  ): Promise<void> {
    const methodLabel = method === 'algorithm' ? 'Auto-matched' : method === 'round_robin' ? 'Round Robin' : 'Manual';

    // 1. GroupMe bot notification (if configured)
    const gmConfig = getGroupMeConfigFromEnv();
    if (gmConfig.enabled && gmConfig.botId) {
      const notification = groupMeService.createNewLeadNotification({
        name: customerName,
        source: `${source} (${methodLabel}, score: ${score.toFixed(1)})`,
        message: `Assigned to ${repName} at ${address}`,
      });
      await groupMeService.sendNotification(gmConfig, notification);
    }

    // 2. River Bot DM to assigned rep
    if (repEmail) {
      await riverBot.sendPrivateDM(
        repEmail,
        `New lead assigned to you!\nCustomer: ${customerName}\nAddress: ${address}\nSource: ${source}\nMethod: ${methodLabel}\n\nPlease respond within 5 minutes.`
      );
    }
  }

  /**
   * Preview the distribution algorithm result without logging or assigning.
   */
  async getDistributionPreview(address: string): Promise<RepScore[]> {
    return this.calculateRepScores(address);
  }

  /**
   * Return top-N eligible candidates with reasons attached, for suggestion-mode
   * UIs. Doesn't write to any log and doesn't start any timers. Caller picks
   * one and calls distributeLead with overrideRepSlug to commit.
   */
  async getTopSuggestions(
    address: string,
    n?: number,
    source?: string,
    referralRepSlug?: string,
  ): Promise<Array<RepScore & { reason: string; rank: number }>> {
    const config = this.getConfig();
    const count = n ?? config.suggestionCount ?? 3;
    const scores = await this.calculateRepScores(address, source, referralRepSlug);
    const eligible = scores.filter(s => s.isEligible);
    return eligible.slice(0, count).map((score, idx) => ({
      ...score,
      reason: this.buildReasonString(score, ''),
      rank: idx + 1,
    }));
  }

  /**
   * Get recent distribution history from the log sheet.
   */
  async getDistributionHistory(limit?: number, assignedRep?: string): Promise<LeadDistributionLogRecord[]> {
    return googleSheetsService.getDistributionLogs({ limit: limit || 50, assignedRep });
  }

  // ---------------------------------------------------------------------------
  // INTERNAL HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Round-robin selection among eligible reps.
   */
  private getNextRoundRobin(eligibleScores: RepScore[]): RepScore {
    const index = this.roundRobinIndex % eligibleScores.length;
    this.roundRobinIndex++;
    return eligibleScores[index];
  }

  /**
   * Generate a unique log ID for distribution tracking.
   */
  private generateLogId(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `DIST-${dateStr}-${random}`;
  }

  /**
   * Log a distribution event to Google Sheets. Persists the winner, runner-up,
   * weight-set version, tiebreaker (if any), and a human-readable reason.
   */
  private async logDistribution(
    logId: string,
    leadId: string,
    customerName: string,
    address: string,
    assignedRep: RepScore,
    allScores: RepScore[],
    method: 'algorithm' | 'round_robin' | 'manual',
    reason: string,
    runnerUp: RepScore | null,
    tiebreakerApplied: string,
    weightSetVersion: string
  ): Promise<void> {
    const scoresForLog: Record<string, number> = {};
    for (const score of allScores) {
      scoresForLog[score.repSlug] = score.totalScore;
    }

    const log: LeadDistributionLogRecord = {
      logId,
      leadId,
      customerName,
      address,
      assignedRep: assignedRep.repSlug,
      algorithmScores: JSON.stringify(scoresForLog),
      factors: JSON.stringify(assignedRep.factors),
      overrideReason: method === 'manual' ? 'Manual override' : method === 'round_robin' ? 'Round robin fallback - no clear winner' : '',
      timestamp: new Date().toISOString(),
      reason,
      runnerUpRep: runnerUp?.repSlug || '',
      runnerUpScore: runnerUp ? runnerUp.totalScore.toFixed(2) : '',
      weightSetVersion,
      tiebreakerApplied,
    };

    try {
      await googleSheetsService.addDistributionLog(log);
    } catch (error) {
      console.error('[LeadDistro] Failed to log distribution:', error);
    }
  }
}

// =============================================================================
// EXPORT SINGLETON
// =============================================================================

export const leadDistributionService = new LeadDistributionService();
