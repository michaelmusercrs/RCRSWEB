/**
 * RCRS Rep Statistics & Predictions Service
 *
 * Pre-calculates per-rep and company-wide performance metrics from Monday
 * meeting numbers. Provides goal predictions using an 85/10/5 blended
 * formula (rep history / seasonal company avg / company momentum).
 *
 * Caches all computed stats in memory with a 5-minute TTL so dashboards
 * and API calls do not recompute on every request.
 *
 * @author RCRS Development Team
 */

import {
  meetingNumbersService,
  type MeetingRecord,
} from './meeting-numbers-service';

// =============================================================================
// TYPES
// =============================================================================

export interface RepStatsTotals {
  inspected: number;
  damage: number;
  signed: number;
  repair: number;
  gutter: number;
  revenue: number;
  approved: number;
  referrals: number;
  agents: number;
  homeShow: number;
  goal: number;
}

export interface RepStatsRates {
  damageRate: number;        // damage / inspected
  signRate: number;          // signed / inspected
  revenuePerInspection: number;
  revenuePerSigned: number;  // avg job value
  repairRatio: number;       // repair / inspected
  gutterRatio: number;       // gutter / inspected
  goalAchievement: number;   // actual inspected / goal
  referralRate: number;      // referrals per week present
  agentRate: number;         // agents per week present
}

export interface MonthlyBreakdown {
  month: number;          // 1-12
  year: number;
  weeks: number;
  totals: RepStatsTotals;
  averages: RepStatsTotals;
  rates: RepStatsRates;
}

export type TrendDirection = 'up' | 'down' | 'stable';

export interface RepStatsResult {
  repName: string;
  totalWeeks: number;
  weeksPresent: number;
  attendanceRate: number;
  totals: RepStatsTotals;
  averages: RepStatsTotals;
  rates: RepStatsRates;
  monthlyBreakdown: MonthlyBreakdown[];
  trends: {
    inspected: TrendDirection;
    revenue: TrendDirection;
    signed: TrendDirection;
  };
  strengths: string[];
}

export interface GoalPrediction {
  goalInspections: number;
  predicted: {
    damage: number;
    signed: number;
    repair: number;
    gutter: number;
    revenue: number;
    actualSales: number;
    commission: number;
  };
  historical: {
    actualInspectedWhenGoalSimilar: number;
    weeksWithSimilarGoal: number;
  };
  plusOne: {
    damage: number;
    signed: number;
    repair: number;
    gutter: number;
    revenue: number;
    actualSales: number;
    commission: number;
  };
  monthlyProjection: {
    revenue: number;
    commission: number;
    weeksRemaining: number;
  };
}

export interface CompanyStats {
  overallAverages: RepStatsRates;
  monthlyAverages: Record<number, RepStatsRates>; // month 1-12
  momentum: RepStatsRates; // last 4 weeks
  totalActiveReps: number;
  totalWeeksOfData: number;
}

export interface RepComparison {
  strengths: string[];
  vsCompany: Record<string, { rep: number; company: number; percentile: string }>;
  encouragement: string[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Active sales reps - only these are included in stats calculations */
const ACTIVE_SALES_REPS = [
  'aaron', 'brendon', 'greg', 'hunter', 'adam', 'rudy',
  'joseph', 'alijah', 'travis', 'rick',
];

/** Excluded from all stats: owners, admin, PMs, office, drivers-only, inactive */
const EXCLUDED_REPS = [
  'michael', 'chris', 'sara', 'john', 'bart', 'destin',
  'tia', 'richard', 'boston',
];

/** Default profit margin for commission estimate when no rep-specific data */
const DEFAULT_PROFIT_MARGIN = 0.12;

/** Default actual-vs-estimated ratio when no historical data */
const DEFAULT_ACTUAL_VS_ESTIMATED = 0.8;

/** Blended formula weights */
const WEIGHT_REP_HISTORY = 0.85;
const WEIGHT_SEASONAL = 0.10;
const WEIGHT_MOMENTUM = 0.05;

// =============================================================================
// HELPERS
// =============================================================================

function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function isPresent(val: string): boolean {
  return val === '1';
}

function isExcused(val: string): boolean {
  const lower = val.toLowerCase().trim();
  return lower === 'e' || lower === 'ex' || lower === 'excused';
}

function isExcludedRep(name: string): boolean {
  return EXCLUDED_REPS.includes(name.toLowerCase().trim());
}

function buildTotals(records: MeetingRecord[]): RepStatsTotals {
  return {
    inspected: records.reduce((s, r) => s + r.inspected, 0),
    damage: records.reduce((s, r) => s + r.damage, 0),
    signed: records.reduce((s, r) => s + r.signed, 0),
    repair: records.reduce((s, r) => s + r.repair, 0),
    gutter: records.reduce((s, r) => s + r.gutter, 0),
    revenue: records.reduce((s, r) => s + r.revenue, 0),
    approved: records.reduce((s, r) => s + r.approved, 0),
    referrals: records.reduce((s, r) => s + r.referrals, 0),
    agents: records.reduce((s, r) => s + r.agents, 0),
    homeShow: records.reduce((s, r) => s + r.homeShow, 0),
    goal: records.reduce((s, r) => s + r.goal, 0),
  };
}

function buildAverages(totals: RepStatsTotals, weeks: number): RepStatsTotals {
  if (weeks === 0) {
    return { inspected: 0, damage: 0, signed: 0, repair: 0, gutter: 0, revenue: 0, approved: 0, referrals: 0, agents: 0, homeShow: 0, goal: 0 };
  }
  return {
    inspected: round2(totals.inspected / weeks),
    damage: round2(totals.damage / weeks),
    signed: round2(totals.signed / weeks),
    repair: round2(totals.repair / weeks),
    gutter: round2(totals.gutter / weeks),
    revenue: round2(totals.revenue / weeks),
    approved: round2(totals.approved / weeks),
    referrals: round2(totals.referrals / weeks),
    agents: round2(totals.agents / weeks),
    homeShow: round2(totals.homeShow / weeks),
    goal: round2(totals.goal / weeks),
  };
}

function buildRates(totals: RepStatsTotals, weeksPresent: number): RepStatsRates {
  return {
    damageRate: round4(safeDivide(totals.damage, totals.inspected)),
    signRate: round4(safeDivide(totals.signed, totals.inspected)),
    revenuePerInspection: round2(safeDivide(totals.revenue, totals.inspected)),
    revenuePerSigned: round2(safeDivide(totals.revenue, totals.signed)),
    repairRatio: round4(safeDivide(totals.repair, totals.inspected)),
    gutterRatio: round4(safeDivide(totals.gutter, totals.inspected)),
    goalAchievement: round4(safeDivide(totals.inspected, totals.goal)),
    referralRate: round2(safeDivide(totals.referrals, weeksPresent || 1)),
    agentRate: round2(safeDivide(totals.agents, weeksPresent || 1)),
  };
}

/**
 * Determine trend direction by comparing last 4 weeks avg to previous 4 weeks avg.
 */
function determineTrend(recent: number, previous: number): TrendDirection {
  if (previous === 0 && recent === 0) return 'stable';
  if (previous === 0) return 'up';
  const change = (recent - previous) / previous;
  if (change > 0.10) return 'up';
  if (change < -0.10) return 'down';
  return 'stable';
}

/**
 * Get the month number (1-12) from a YYYY-MM-DD date string.
 */
function getMonth(dateStr: string): number {
  return parseInt(dateStr.split('-')[1], 10);
}

/**
 * Get the year from a YYYY-MM-DD date string.
 */
function getYear(dateStr: string): number {
  return parseInt(dateStr.split('-')[0], 10);
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

class RepStatsService {
  private repStats: Map<string, RepStatsResult> = new Map();
  private companyStats: CompanyStats | null = null;
  private lastCalculated: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // ---------------------------------------------------------------------------
  // CACHE MANAGEMENT
  // ---------------------------------------------------------------------------

  private isCacheValid(): boolean {
    return this.lastCalculated > 0 && Date.now() - this.lastCalculated < this.CACHE_TTL;
  }

  private ensureCalculated(): void {
    if (!this.isCacheValid()) {
      this.calculateAll();
    }
  }

  /**
   * Force a recalculation. Called automatically when cache expires.
   */
  invalidateCache(): void {
    this.lastCalculated = 0;
    this.repStats.clear();
    this.companyStats = null;
  }

  // ---------------------------------------------------------------------------
  // CORE CALCULATION
  // ---------------------------------------------------------------------------

  /**
   * Load all data and compute stats for every active rep plus company-wide.
   * This is the heavy lift - results are cached for CACHE_TTL milliseconds.
   */
  calculateAll(): void {
    const allRecords = meetingNumbersService.loadAllData();

    // Filter to active sales reps only
    const salesRecords = allRecords.filter(r => {
      const lower = r.repName.toLowerCase().trim();
      return ACTIVE_SALES_REPS.includes(lower) && !isExcludedRep(r.repName);
    });

    if (salesRecords.length === 0) {
      this.repStats.clear();
      this.companyStats = this.buildEmptyCompanyStats();
      this.lastCalculated = Date.now();
      return;
    }

    // Group records by rep
    const byRep = new Map<string, MeetingRecord[]>();
    for (const rec of salesRecords) {
      const key = rec.repName.toLowerCase().trim();
      if (!byRep.has(key)) byRep.set(key, []);
      byRep.get(key)!.push(rec);
    }

    // Sort each rep's records by date
    byRep.forEach(records => {
      records.sort((a, b) => a.meetingDate.localeCompare(b.meetingDate));
    });

    // Calculate per-rep stats
    this.repStats.clear();
    const allRatesForPercentile: Map<string, number[]> = new Map();

    byRep.forEach((records, repKey) => {
      const stats = this.calculateRepStats(records);
      this.repStats.set(repKey, stats);

      // Collect rates for percentile calculations
      const rateEntries = Object.entries(stats.rates);
      for (const [key, value] of rateEntries) {
        if (!allRatesForPercentile.has(key)) allRatesForPercentile.set(key, []);
        allRatesForPercentile.get(key)!.push(value);
      }
    });

    // Calculate company-wide stats
    this.companyStats = this.calculateCompanyStats(salesRecords);

    // Compute strengths for each rep (requires company stats)
    this.repStats.forEach((stats, repKey) => {
      stats.strengths = this.identifyStrengths(stats, this.companyStats!);
    });

    this.lastCalculated = Date.now();
    console.log(`[RepStats] Calculated stats for ${this.repStats.size} reps from ${salesRecords.length} records`);
  }

  /**
   * Calculate all stats for a single rep's records.
   */
  private calculateRepStats(records: MeetingRecord[]): RepStatsResult {
    const repName = records[0].repName; // preserve original casing
    const totalWeeks = records.length;
    const weeksPresent = records.filter(r => isPresent(r.present)).length;
    const excusedWeeks = records.filter(r => isExcused(r.present)).length;
    const eligibleWeeks = totalWeeks - excusedWeeks;
    const attendanceRate = eligibleWeeks > 0 ? round4(weeksPresent / eligibleWeeks) : 0;

    const totals = buildTotals(records);
    const averages = buildAverages(totals, weeksPresent > 0 ? weeksPresent : totalWeeks);
    const rates = buildRates(totals, weeksPresent);

    // Monthly breakdown
    const monthlyBreakdown = this.buildMonthlyBreakdown(records);

    // Trends: compare last 4 weeks to previous 4 weeks
    const trends = this.calculateTrends(records);

    return {
      repName,
      totalWeeks,
      weeksPresent,
      attendanceRate,
      totals,
      averages,
      rates,
      monthlyBreakdown,
      trends,
      strengths: [], // filled in after company stats are computed
    };
  }

  /**
   * Build monthly breakdown of stats grouped by year-month.
   */
  private buildMonthlyBreakdown(records: MeetingRecord[]): MonthlyBreakdown[] {
    const byMonth = new Map<string, MeetingRecord[]>();

    for (const rec of records) {
      const key = `${getYear(rec.meetingDate)}-${String(getMonth(rec.meetingDate)).padStart(2, '0')}`;
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key)!.push(rec);
    }

    const breakdowns: MonthlyBreakdown[] = [];
    byMonth.forEach((recs, key) => {
      const [yearStr, monthStr] = key.split('-');
      const weeks = recs.length;
      const weeksPresent = recs.filter(r => isPresent(r.present)).length;
      const totals = buildTotals(recs);
      const averages = buildAverages(totals, weeksPresent > 0 ? weeksPresent : weeks);
      const rates = buildRates(totals, weeksPresent > 0 ? weeksPresent : weeks);

      breakdowns.push({
        month: parseInt(monthStr, 10),
        year: parseInt(yearStr, 10),
        weeks,
        totals,
        averages,
        rates,
      });
    });

    // Sort by date
    breakdowns.sort((a, b) => {
      const yearDiff = a.year - b.year;
      if (yearDiff !== 0) return yearDiff;
      return a.month - b.month;
    });

    return breakdowns;
  }

  /**
   * Calculate trends by comparing last 4 weeks average to previous 4 weeks.
   */
  private calculateTrends(records: MeetingRecord[]): RepStatsResult['trends'] {
    // Get unique dates, sorted descending
    const dates = Array.from(new Set(records.map(r => r.meetingDate))).sort().reverse();

    if (dates.length < 2) {
      return { inspected: 'stable', revenue: 'stable', signed: 'stable' };
    }

    const recentDates = dates.slice(0, 4);
    const prevDates = dates.slice(4, 8);

    const recentRecords = records.filter(r => recentDates.includes(r.meetingDate));
    const prevRecords = records.filter(r => prevDates.includes(r.meetingDate));

    const recentTotals = buildTotals(recentRecords);
    const prevTotals = buildTotals(prevRecords);

    const recentWeeks = recentDates.length || 1;
    const prevWeeks = prevDates.length || 1;

    return {
      inspected: determineTrend(recentTotals.inspected / recentWeeks, prevWeeks > 0 ? prevTotals.inspected / prevWeeks : 0),
      revenue: determineTrend(recentTotals.revenue / recentWeeks, prevWeeks > 0 ? prevTotals.revenue / prevWeeks : 0),
      signed: determineTrend(recentTotals.signed / recentWeeks, prevWeeks > 0 ? prevTotals.signed / prevWeeks : 0),
    };
  }

  // ---------------------------------------------------------------------------
  // COMPANY STATS
  // ---------------------------------------------------------------------------

  private calculateCompanyStats(salesRecords: MeetingRecord[]): CompanyStats {
    const totalWeeks = new Set(salesRecords.map(r => r.meetingDate)).size;
    const totalPresent = salesRecords.filter(r => isPresent(r.present)).length;
    const totals = buildTotals(salesRecords);
    const overallAverages = buildRates(totals, totalPresent > 0 ? totalPresent : salesRecords.length);

    // Monthly averages (by calendar month, across all years)
    const byCalendarMonth = new Map<number, MeetingRecord[]>();
    for (const rec of salesRecords) {
      const month = getMonth(rec.meetingDate);
      if (!byCalendarMonth.has(month)) byCalendarMonth.set(month, []);
      byCalendarMonth.get(month)!.push(rec);
    }

    const monthlyAverages: Record<number, RepStatsRates> = {};
    byCalendarMonth.forEach((recs, month) => {
      const mTotals = buildTotals(recs);
      const mPresent = recs.filter(r => isPresent(r.present)).length;
      monthlyAverages[month] = buildRates(mTotals, mPresent > 0 ? mPresent : recs.length);
    });

    // Momentum: last 4 weeks of data across all reps
    const allDates = Array.from(new Set(salesRecords.map(r => r.meetingDate))).sort().reverse();
    const momentumDates = allDates.slice(0, 4);
    const momentumRecords = salesRecords.filter(r => momentumDates.includes(r.meetingDate));
    const momTotals = buildTotals(momentumRecords);
    const momPresent = momentumRecords.filter(r => isPresent(r.present)).length;
    const momentum = buildRates(momTotals, momPresent > 0 ? momPresent : momentumRecords.length);

    // Count unique active reps that have actual data
    const activeReps = new Set<string>();
    for (const rec of salesRecords) {
      if (rec.inspected > 0 || rec.signed > 0 || rec.revenue > 0) {
        activeReps.add(rec.repName.toLowerCase().trim());
      }
    }

    return {
      overallAverages,
      monthlyAverages,
      momentum,
      totalActiveReps: activeReps.size,
      totalWeeksOfData: totalWeeks,
    };
  }

  private buildEmptyCompanyStats(): CompanyStats {
    const emptyRates: RepStatsRates = {
      damageRate: 0, signRate: 0, revenuePerInspection: 0, revenuePerSigned: 0,
      repairRatio: 0, gutterRatio: 0, goalAchievement: 0, referralRate: 0, agentRate: 0,
    };
    return {
      overallAverages: emptyRates,
      monthlyAverages: {},
      momentum: emptyRates,
      totalActiveReps: 0,
      totalWeeksOfData: 0,
    };
  }

  // ---------------------------------------------------------------------------
  // STRENGTHS IDENTIFICATION
  // ---------------------------------------------------------------------------

  /**
   * Identify a rep's top 2-3 strengths vs company average.
   * NEVER names other reps - just "company average".
   */
  private identifyStrengths(repStats: RepStatsResult, company: CompanyStats): string[] {
    const strengths: string[] = [];

    const checks: Array<{ label: string; repVal: number; companyVal: number; higherIsBetter: boolean }> = [
      { label: 'Highest sign rate', repVal: repStats.rates.signRate, companyVal: company.overallAverages.signRate, higherIsBetter: true },
      { label: 'Highest per-job revenue', repVal: repStats.rates.revenuePerSigned, companyVal: company.overallAverages.revenuePerSigned, higherIsBetter: true },
      { label: 'Highest revenue per inspection', repVal: repStats.rates.revenuePerInspection, companyVal: company.overallAverages.revenuePerInspection, higherIsBetter: true },
      { label: 'Best damage finder', repVal: repStats.rates.damageRate, companyVal: company.overallAverages.damageRate, higherIsBetter: true },
      { label: 'Best attendance', repVal: repStats.attendanceRate, companyVal: 0.85, higherIsBetter: true },
      { label: 'Top goal achiever', repVal: repStats.rates.goalAchievement, companyVal: company.overallAverages.goalAchievement, higherIsBetter: true },
      { label: 'Referral champion', repVal: repStats.rates.referralRate, companyVal: company.overallAverages.referralRate, higherIsBetter: true },
      { label: 'Agent network builder', repVal: repStats.rates.agentRate, companyVal: company.overallAverages.agentRate, higherIsBetter: true },
      { label: 'Strong repair sales', repVal: repStats.rates.repairRatio, companyVal: company.overallAverages.repairRatio, higherIsBetter: true },
      { label: 'Gutter add-on specialist', repVal: repStats.rates.gutterRatio, companyVal: company.overallAverages.gutterRatio, higherIsBetter: true },
    ];

    // Rank by how much the rep exceeds the company average (as a multiplier)
    const scored = checks
      .filter(c => c.companyVal > 0 && c.repVal > 0) // skip zero-data categories
      .map(c => ({
        label: c.label,
        advantage: c.higherIsBetter
          ? c.repVal / c.companyVal
          : c.companyVal / c.repVal,
      }))
      .filter(s => s.advantage > 1.0) // rep must be above average
      .sort((a, b) => b.advantage - a.advantage);

    // Take top 3
    for (const s of scored.slice(0, 3)) {
      strengths.push(s.label);
    }

    // If no strengths found, add a generic one for attendance or effort
    if (strengths.length === 0) {
      if (repStats.weeksPresent > 0) {
        strengths.push('Consistent presence');
      }
      if (repStats.totals.inspected > 0) {
        strengths.push('Active in the field');
      }
    }

    return strengths;
  }

  // ---------------------------------------------------------------------------
  // PUBLIC METHODS
  // ---------------------------------------------------------------------------

  /**
   * Get stats for a specific rep.
   */
  getRepStats(repName: string): RepStatsResult | null {
    this.ensureCalculated();
    const key = repName.toLowerCase().trim();
    return this.repStats.get(key) || null;
  }

  /**
   * Get company-wide stats.
   */
  getCompanyStats(): CompanyStats {
    this.ensureCalculated();
    return this.companyStats || this.buildEmptyCompanyStats();
  }

  /**
   * Get all active reps' stats (for admin/leaderboard use).
   */
  getAllRepStats(): RepStatsResult[] {
    this.ensureCalculated();
    return Array.from(this.repStats.values());
  }

  /**
   * Goal prediction using the 85/10/5 blended formula.
   *
   * 85% weight: Rep's personal historical averages
   * 10% weight: Company-wide averages for the current month (seasonality)
   * 5%  weight: Current company momentum (last 4 weeks)
   */
  predictGoal(repName: string, goalInspections: number): GoalPrediction | null {
    this.ensureCalculated();

    const repStats = this.getRepStats(repName);
    const company = this.getCompanyStats();

    if (!repStats) return null;
    if (goalInspections <= 0) goalInspections = 1;

    // Determine current month for seasonal data
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const seasonal = company.monthlyAverages[currentMonth] || company.overallAverages;

    // Blend each rate: 85% rep + 10% seasonal + 5% momentum
    const blend = (repRate: number, seasonalRate: number, momentumRate: number): number => {
      return (WEIGHT_REP_HISTORY * repRate) +
             (WEIGHT_SEASONAL * seasonalRate) +
             (WEIGHT_MOMENTUM * momentumRate);
    };

    const blendedDamageRate = blend(repStats.rates.damageRate, seasonal.damageRate, company.momentum.damageRate);
    const blendedSignRate = blend(repStats.rates.signRate, seasonal.signRate, company.momentum.signRate);
    const blendedRepairRatio = blend(repStats.rates.repairRatio, seasonal.repairRatio, company.momentum.repairRatio);
    const blendedGutterRatio = blend(repStats.rates.gutterRatio, seasonal.gutterRatio, company.momentum.gutterRatio);
    const blendedRevenuePerInspection = blend(
      repStats.rates.revenuePerInspection,
      seasonal.revenuePerInspection,
      company.momentum.revenuePerInspection,
    );

    // Predict for the given goal
    const predicted = this.runPrediction(goalInspections, blendedDamageRate, blendedSignRate, blendedRepairRatio, blendedGutterRatio, blendedRevenuePerInspection);

    // Plus-one scenario
    const plusOne = this.runPrediction(goalInspections + 1, blendedDamageRate, blendedSignRate, blendedRepairRatio, blendedGutterRatio, blendedRevenuePerInspection);

    // Historical: what did they actually inspect when they had a similar goal?
    const historical = this.getHistoricalGoalPerformance(repStats, goalInspections);

    // Monthly projection: assume ~4.33 weeks per month at this pace
    const weeksPerMonth = 4.33;
    const currentDate = new Date();
    const daysLeftInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate() - currentDate.getDate();
    const weeksRemaining = Math.max(0, Math.round((daysLeftInMonth / 7) * 100) / 100);

    return {
      goalInspections,
      predicted,
      historical,
      plusOne,
      monthlyProjection: {
        revenue: round2(predicted.revenue * weeksPerMonth),
        commission: round2(predicted.commission * weeksPerMonth),
        weeksRemaining,
      },
    };
  }

  /**
   * Run the prediction math for a given inspection count.
   */
  private runPrediction(
    inspections: number,
    damageRate: number,
    signRate: number,
    repairRatio: number,
    gutterRatio: number,
    revenuePerInspection: number,
  ): GoalPrediction['predicted'] {
    const damage = round2(inspections * damageRate);
    const signed = round2(inspections * signRate);
    const repair = round2(inspections * repairRatio);
    const gutter = round2(inspections * gutterRatio);
    const revenue = round2(inspections * revenuePerInspection);
    const actualSales = round2(revenue * DEFAULT_ACTUAL_VS_ESTIMATED);
    const commission = round2(actualSales * DEFAULT_PROFIT_MARGIN);

    return { damage, signed, repair, gutter, revenue, actualSales, commission };
  }

  /**
   * Look at what the rep actually did in weeks where they had a similar goal.
   * "Similar" means within +/- 1 of the target goal.
   */
  private getHistoricalGoalPerformance(
    repStats: RepStatsResult,
    targetGoal: number,
  ): GoalPrediction['historical'] {
    // We need the raw records to filter by goal
    const records = meetingNumbersService.loadAllData().filter(
      r => r.repName.toLowerCase().trim() === repStats.repName.toLowerCase().trim(),
    );

    const similarGoalRecords = records.filter(r =>
      r.goal > 0 && Math.abs(r.goal - targetGoal) <= 1,
    );

    if (similarGoalRecords.length === 0) {
      return { actualInspectedWhenGoalSimilar: 0, weeksWithSimilarGoal: 0 };
    }

    const totalInspected = similarGoalRecords.reduce((s, r) => s + r.inspected, 0);
    const avgInspected = round2(totalInspected / similarGoalRecords.length);

    return {
      actualInspectedWhenGoalSimilar: avgInspected,
      weeksWithSimilarGoal: similarGoalRecords.length,
    };
  }

  // ---------------------------------------------------------------------------
  // REP COMPARISON (anonymized)
  // ---------------------------------------------------------------------------

  /**
   * Get anonymized comparison for a rep's personalized dashboard.
   * NEVER names other reps. Uses "company average" language only.
   */
  getRepComparison(repName: string): RepComparison | null {
    this.ensureCalculated();

    const repStats = this.getRepStats(repName);
    const company = this.getCompanyStats();
    if (!repStats) return null;

    const strengths = repStats.strengths;

    // Build vsCompany entries for each key rate
    const vsCompany: RepComparison['vsCompany'] = {};

    const rateLabels: Array<{ key: keyof RepStatsRates; label: string; format: 'percent' | 'dollar' | 'ratio' }> = [
      { key: 'damageRate', label: 'Damage Rate', format: 'percent' },
      { key: 'signRate', label: 'Sign Rate', format: 'percent' },
      { key: 'revenuePerInspection', label: 'Revenue per Inspection', format: 'dollar' },
      { key: 'revenuePerSigned', label: 'Avg Job Value', format: 'dollar' },
      { key: 'repairRatio', label: 'Repair Rate', format: 'percent' },
      { key: 'gutterRatio', label: 'Gutter Add-On Rate', format: 'percent' },
      { key: 'goalAchievement', label: 'Goal Achievement', format: 'percent' },
      { key: 'referralRate', label: 'Referrals per Week', format: 'ratio' },
      { key: 'agentRate', label: 'Agents per Week', format: 'ratio' },
    ];

    // Collect all rep values for percentile calculation
    const allRepStats = this.getAllRepStats();

    for (const { key, label, format } of rateLabels) {
      const repVal = repStats.rates[key];
      const companyVal = company.overallAverages[key];

      // Calculate percentile: what fraction of reps is this rep above?
      const allValues = allRepStats.map(s => s.rates[key]).sort((a, b) => a - b);
      const rank = allValues.filter(v => v <= repVal).length;
      const percentile = allValues.length > 0
        ? Math.round((rank / allValues.length) * 100)
        : 50;

      let percentileLabel: string;
      if (percentile >= 90) percentileLabel = 'Top 10%';
      else if (percentile >= 75) percentileLabel = 'Top 25%';
      else if (percentile >= 50) percentileLabel = 'Above average';
      else if (percentile >= 25) percentileLabel = 'Below average';
      else percentileLabel = 'Bottom 25%';

      vsCompany[label] = {
        rep: round2(repVal),
        company: round2(companyVal),
        percentile: percentileLabel,
      };
    }

    // Build encouragement messages based on data
    const encouragement = this.buildEncouragement(repStats, company);

    return { strengths, vsCompany, encouragement };
  }

  /**
   * Build personalized encouragement messages.
   */
  private buildEncouragement(repStats: RepStatsResult, company: CompanyStats): string[] {
    const messages: string[] = [];

    // High-inspection months correlation with revenue
    const highInspectionMonths = repStats.monthlyBreakdown.filter(m => m.totals.inspected >= 15);
    if (highInspectionMonths.length > 0) {
      const avgRevenue = highInspectionMonths.reduce((s, m) => s + m.totals.revenue, 0) / highInspectionMonths.length;
      if (avgRevenue > 0) {
        messages.push(
          `In months you inspected 15+, you averaged $${Math.round(avgRevenue).toLocaleString()} in estimated revenue.`,
        );
      }
    }

    // Trend-based encouragement
    if (repStats.trends.revenue === 'up') {
      messages.push('Your revenue trend is climbing — keep the momentum going!');
    }
    if (repStats.trends.signed === 'up') {
      messages.push('Your closing rate has been trending up recently — great work!');
    }

    // Attendance correlation
    if (repStats.attendanceRate >= 0.90) {
      messages.push(`Your ${Math.round(repStats.attendanceRate * 100)}% attendance rate shows consistency — that's a winning habit.`);
    }

    // Sign rate vs company
    if (repStats.rates.signRate > company.overallAverages.signRate * 1.15 && company.overallAverages.signRate > 0) {
      const repPer10 = round2(repStats.rates.signRate * 10);
      const companyPer10 = round2(company.overallAverages.signRate * 10);
      messages.push(
        `Company avg: ${companyPer10} signed per 10 inspections. You: ${repPer10} — you're converting above average.`,
      );
    }

    // Goal achievement
    if (repStats.rates.goalAchievement >= 1.0) {
      messages.push(
        `You consistently meet or exceed your goals (${Math.round(repStats.rates.goalAchievement * 100)}% achievement).`,
      );
    } else if (repStats.rates.goalAchievement >= 0.8 && repStats.rates.goalAchievement < 1.0) {
      messages.push(
        `You're at ${Math.round(repStats.rates.goalAchievement * 100)}% goal achievement — just a bit more push to hit 100%.`,
      );
    }

    // Revenue per signed (if above average)
    if (repStats.rates.revenuePerSigned > company.overallAverages.revenuePerSigned && company.overallAverages.revenuePerSigned > 0) {
      messages.push(
        `Your average job is $${Math.round(repStats.rates.revenuePerSigned).toLocaleString()} vs company avg of $${Math.round(company.overallAverages.revenuePerSigned).toLocaleString()} — you're landing the bigger jobs.`,
      );
    }

    // If no specific messages, add a generic one
    if (messages.length === 0) {
      if (repStats.weeksPresent > 0) {
        messages.push('Keep showing up and putting in the work — the numbers will follow.');
      }
    }

    return messages;
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const repStatsService = new RepStatsService();
