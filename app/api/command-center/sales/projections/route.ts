/**
 * RCRS Command Center - Sales Projections API
 *
 * Provides sales projections, predictions, and motivational suggestions for
 * each active sales rep based on their historical meeting numbers and
 * commission data.
 *
 * GET /api/command-center/sales/projections
 *
 * Returns:
 *   - Monthly projections (pace vs last month)
 *   - Yearly projections (pace vs last year)
 *   - 4-week trend direction
 *   - Motivational suggestions based on metrics
 *   - Commission projections from commissions.json
 *   - Team summary
 *
 * @author RCRS Development Team
 */

import { NextRequest, NextResponse } from 'next/server';
import { meetingNumbersService, type MeetingRecord } from '@/lib/meeting-numbers-service';
import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// TYPES
// =============================================================================

interface CommissionRecord {
  salesRep: string;
  date: string;       // MM/DD/YYYY
  amount: number;
  balance: number;
  jobNumber: string;
  customer: string;
}

interface BonusTier {
  threshold: number;
  bonus: number;
  label: string;
}

interface CompetitionConfig {
  monthlyBonusTiers: BonusTier[];
  biannualBonusTiers: BonusTier[];
  awardsTrip: { threshold: number; periodType: string; description: string };
  monthlyGasCard: { amount: number; minDeals: number; minSales: number; description: string };
}

interface RepProjection {
  name: string;
  monthly: {
    currentRevenue: number;
    projectedRevenue: number;
    lastMonthRevenue: number;
    paceVsLastMonth: 'ahead' | 'behind' | 'on-track';
    pacePercentage: number;
    daysElapsed: number;
    daysInMonth: number;
  };
  yearly: {
    ytdRevenue: number;
    projectedAnnual: number;
    lastYearRevenue: number | null;
    hasLastYearData: boolean;
    daysElapsedThisYear: number;
  };
  trend: {
    direction: 'improving' | 'declining' | 'steady';
    weeklyRevenues: number[];
    percentChange: number;
  };
  suggestions: string[];
  commission: {
    ytdCommission: number;
    currentMonthCommission: number;
    projectedMonthlyCommission: number;
    projectedAnnualCommission: number;
    lastMonthCommission: number;
  };
  metrics: {
    inspected: number;
    signed: number;
    referrals: number;
    approved: number;
    signRate: number;
    avgWeeklyReferrals: number;
  };
}

interface TeamSummary {
  totalReps: number;
  teamMonthlyRevenue: number;
  teamProjectedMonthly: number;
  teamYtdRevenue: number;
  teamProjectedAnnual: number;
  avgRepMonthlyProjection: number;
  repsImproving: number;
  repsDeclining: number;
  repsSteady: number;
  teamYtdCommission: number;
  teamProjectedAnnualCommission: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Active sales reps - HARD RULE: exclude owners, admin, PMs, inactive, office
const ACTIVE_SALES_REPS = [
  'hunter', 'aaron', 'greg', 'brendon', 'adam', 'joseph',
  'alijah', 'travis', 'rick',
];

// Map first names (meeting data) to full names (commissions data)
const REP_FULL_NAMES: Record<string, string> = {
  hunter: 'Hunter Rivers',
  aaron: 'Aaron Lussi',
  greg: 'Greg Muse',
  brendon: 'Brendon Muse',
  adam: 'Adam Rudell',
  joseph: 'Joseph Dowd',
  alijah: 'Alijah',
  travis: 'Travis Wages',
  rick: 'Rick',
};

// =============================================================================
// HELPERS
// =============================================================================

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function formatDateYYYYMMDD(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Parse commission date from MM/DD/YYYY to Date object.
 */
function parseCommissionDate(dateStr: string): Date | null {
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const month = parseInt(parts[0], 10) - 1;
  const day = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  if (isNaN(month) || isNaN(day) || isNaN(year)) return null;
  return new Date(year, month, day);
}

function round2(num: number): number {
  return Math.round(num * 100) / 100;
}

/**
 * Load commissions.json from the data directory.
 */
function loadCommissions(): CommissionRecord[] {
  try {
    const filePath = path.join(process.cwd(), 'data', 'commissions.json');
    if (!fs.existsSync(filePath)) {
      console.warn('[Projections] commissions.json not found');
      return [];
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as CommissionRecord[];
  } catch (err) {
    console.error('[Projections] Error loading commissions.json:', err);
    return [];
  }
}

/**
 * Load competition-config.json for bonus tier information.
 */
function loadCompetitionConfig(): CompetitionConfig | null {
  try {
    const filePath = path.join(process.cwd(), 'data', 'competition-config.json');
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as CompetitionConfig;
  } catch {
    return null;
  }
}

/**
 * Filter meeting records to only active sales reps.
 */
function filterActiveSalesReps(records: MeetingRecord[]): MeetingRecord[] {
  return records.filter(r =>
    ACTIVE_SALES_REPS.includes(r.repName.toLowerCase().trim())
  );
}

/**
 * Get records in a date range.
 */
function recordsInRange(records: MeetingRecord[], start: string, end: string): MeetingRecord[] {
  return records.filter(r => r.meetingDate >= start && r.meetingDate <= end);
}

/**
 * Sum revenue for a set of records.
 */
function sumRevenue(records: MeetingRecord[]): number {
  return records.reduce((sum, r) => sum + r.revenue, 0);
}

/**
 * Sum a numeric metric across records.
 */
function sumMetric(records: MeetingRecord[], field: keyof MeetingRecord): number {
  return records.reduce((sum, r) => {
    const val = r[field];
    return sum + (typeof val === 'number' ? val : 0);
  }, 0);
}

/**
 * Get the last N weeks of meeting dates from the data, working backwards from today.
 * Returns week boundaries as [start, end] pairs in YYYY-MM-DD format.
 */
function getLastNWeekBoundaries(now: Date, n: number): Array<{ start: string; end: string }> {
  const weeks: Array<{ start: string; end: string }> = [];
  for (let i = 0; i < n; i++) {
    const refDate = new Date(now);
    refDate.setDate(refDate.getDate() - (i * 7));
    const day = refDate.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(refDate);
    monday.setDate(refDate.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    weeks.push({
      start: formatDateYYYYMMDD(monday),
      end: formatDateYYYYMMDD(sunday),
    });
  }
  return weeks.reverse(); // oldest first
}

/**
 * Determine trend direction from last 4 weeks of revenue.
 * Compares the average of weeks 3-4 to weeks 1-2.
 */
function calculateTrend(weeklyRevenues: number[]): { direction: 'improving' | 'declining' | 'steady'; percentChange: number } {
  if (weeklyRevenues.length < 4) {
    return { direction: 'steady', percentChange: 0 };
  }

  // weeks are oldest-first: [week1, week2, week3, week4]
  const olderAvg = (weeklyRevenues[0] + weeklyRevenues[1]) / 2;
  const recentAvg = (weeklyRevenues[2] + weeklyRevenues[3]) / 2;

  if (olderAvg === 0 && recentAvg === 0) {
    return { direction: 'steady', percentChange: 0 };
  }

  if (olderAvg === 0) {
    return { direction: 'improving', percentChange: 100 };
  }

  const percentChange = round2(((recentAvg - olderAvg) / olderAvg) * 100);

  if (percentChange > 15) {
    return { direction: 'improving', percentChange };
  } else if (percentChange < -15) {
    return { direction: 'declining', percentChange };
  }
  return { direction: 'steady', percentChange };
}

/**
 * Generate motivational suggestions based on a rep's metrics.
 */
function generateSuggestions(
  rep: {
    name: string;
    monthlyProjected: number;
    inspected: number;
    signed: number;
    referrals: number;
    weeksActive: number;
    trendDirection: 'improving' | 'declining' | 'steady';
    ytdRevenue: number;
  },
  teamAvgReferralsPerWeek: number,
  bonusTiers: BonusTier[],
): string[] {
  const suggestions: string[] = [];

  // Inspection-to-sign ratio
  if (rep.inspected > 0 && rep.signed > 0) {
    const signRate = rep.signed / rep.inspected;
    if (signRate < 0.3 && rep.inspected >= 5) {
      suggestions.push(
        `Focus on closing - your inspection-to-sign ratio is ${Math.round(signRate * 100)}%, below the 30% target.`
      );
    }
  } else if (rep.inspected > 5 && rep.signed === 0) {
    suggestions.push(
      'You have inspections but no signs this period. Review your pitch and follow-up process.'
    );
  }

  // Referrals
  const avgWeeklyReferrals = rep.weeksActive > 0 ? rep.referrals / rep.weeksActive : 0;
  if (avgWeeklyReferrals < teamAvgReferralsPerWeek && teamAvgReferralsPerWeek > 0) {
    suggestions.push(
      `Ask for referrals - top performers average ${round2(teamAvgReferralsPerWeek)} per week. You're at ${round2(avgWeeklyReferrals)}.`
    );
  }

  // Trending up momentum
  if (rep.trendDirection === 'improving') {
    suggestions.push(
      `Great momentum! Keep pushing to hit $${Math.round(rep.monthlyProjected).toLocaleString()} this month.`
    );
  }

  // Trending down warning
  if (rep.trendDirection === 'declining') {
    suggestions.push(
      'Your numbers are trending down. Schedule extra inspections this week to reverse the slide.'
    );
  }

  // Bonus tier proximity
  if (bonusTiers.length > 0) {
    // Find the next tier above current monthly projected revenue
    const nextTier = bonusTiers.find(t => t.threshold > rep.monthlyProjected);
    if (nextTier) {
      const gap = nextTier.threshold - rep.monthlyProjected;
      if (gap < rep.monthlyProjected * 0.25 && gap > 0) {
        suggestions.push(
          `Only $${Math.round(gap).toLocaleString()} away from the ${nextTier.label} bonus tier ($${nextTier.bonus} bonus)!`
        );
      }
    }

    // Check if already at or above a tier
    const currentTier = [...bonusTiers].reverse().find(t => rep.monthlyProjected >= t.threshold);
    if (currentTier) {
      suggestions.push(
        `On pace for the ${currentTier.label} bonus tier ($${currentTier.bonus} bonus). Keep it up!`
      );
    }
  }

  // Low activity
  if (rep.inspected === 0 && rep.signed === 0 && rep.weeksActive > 0) {
    suggestions.push(
      'No inspections or signs recorded yet this month. Get out there and knock some doors!'
    );
  }

  return suggestions;
}

// =============================================================================
// API HANDLER
// =============================================================================

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();

  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed
    const currentDay = now.getDate();
    const daysInCurrentMonth = getDaysInMonth(currentYear, currentMonth);
    const daysElapsedInMonth = currentDay;
    const daysElapsedInYear = getDayOfYear(now);
    const daysInYear = isLeapYear(currentYear) ? 366 : 365;

    // -------------------------------------------------------------------------
    // Load all data sources
    // -------------------------------------------------------------------------
    const allMeetingRecords = filterActiveSalesReps(meetingNumbersService.loadAllData());
    const allCommissions = loadCommissions();
    const competitionConfig = loadCompetitionConfig();
    const bonusTiers = competitionConfig?.monthlyBonusTiers || [];

    if (allMeetingRecords.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No meeting numbers data found for active sales reps',
        timestamp,
      }, { status: 404 });
    }

    // -------------------------------------------------------------------------
    // Date boundaries
    // -------------------------------------------------------------------------
    const currentMonthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    const currentMonthEnd = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(daysInCurrentMonth).padStart(2, '0')}`;

    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const daysInLastMonth = getDaysInMonth(lastMonthYear, lastMonth);
    const lastMonthStart = `${lastMonthYear}-${String(lastMonth + 1).padStart(2, '0')}-01`;
    const lastMonthEnd = `${lastMonthYear}-${String(lastMonth + 1).padStart(2, '0')}-${String(daysInLastMonth).padStart(2, '0')}`;

    const ytdStart = `${currentYear}-01-01`;
    const ytdEnd = formatDateYYYYMMDD(now);

    const lastYearStart = `${currentYear - 1}-01-01`;
    const lastYearEnd = `${currentYear - 1}-12-31`;

    // Last 4 weeks for trend analysis
    const last4Weeks = getLastNWeekBoundaries(now, 4);

    // -------------------------------------------------------------------------
    // Commission date boundaries (MM/DD/YYYY format)
    // -------------------------------------------------------------------------
    const commissionCurrentMonthStart = new Date(currentYear, currentMonth, 1);
    const commissionCurrentMonthEnd = new Date(currentYear, currentMonth + 1, 0);
    const commissionLastMonthStart = new Date(lastMonthYear, lastMonth, 1);
    const commissionLastMonthEnd = new Date(lastMonthYear, lastMonth + 1, 0);
    const commissionYtdStart = new Date(currentYear, 0, 1);

    // -------------------------------------------------------------------------
    // Group meeting data by rep
    // -------------------------------------------------------------------------
    const repMeetingMap = new Map<string, MeetingRecord[]>();
    for (const rec of allMeetingRecords) {
      const key = rec.repName.toLowerCase().trim();
      if (!ACTIVE_SALES_REPS.includes(key)) continue;
      const existing = repMeetingMap.get(key) || [];
      existing.push(rec);
      repMeetingMap.set(key, existing);
    }

    // -------------------------------------------------------------------------
    // Group commission data by rep (case-insensitive first name match)
    // -------------------------------------------------------------------------
    const repCommissionMap = new Map<string, CommissionRecord[]>();
    for (const comm of allCommissions) {
      const firstName = comm.salesRep.split(' ')[0].toLowerCase().trim();
      if (!ACTIVE_SALES_REPS.includes(firstName)) continue;
      const existing = repCommissionMap.get(firstName) || [];
      existing.push(comm);
      repCommissionMap.set(firstName, existing);
    }

    // -------------------------------------------------------------------------
    // Calculate team-wide referrals average for suggestions
    // -------------------------------------------------------------------------
    const currentMonthRecords = recordsInRange(allMeetingRecords, currentMonthStart, currentMonthEnd);
    const totalReferralsThisMonth = sumMetric(currentMonthRecords, 'referrals');
    // Get unique weeks in current month data
    const uniqueWeeks = new Set(currentMonthRecords.map(r => r.meetingDate));
    const weeksThisMonth = Math.max(uniqueWeeks.size, 1);
    const totalActiveReps = repMeetingMap.size;
    const teamAvgReferralsPerWeek = totalActiveReps > 0
      ? round2(totalReferralsThisMonth / (weeksThisMonth * totalActiveReps))
      : 0;

    // -------------------------------------------------------------------------
    // Build projections for each rep
    // -------------------------------------------------------------------------
    const projections: RepProjection[] = [];

    for (const repKey of ACTIVE_SALES_REPS) {
      const meetingRecords = repMeetingMap.get(repKey) || [];
      const commissionRecords = repCommissionMap.get(repKey) || [];
      const fullName = REP_FULL_NAMES[repKey] || repKey;

      // Skip reps with zero data across everything
      if (meetingRecords.length === 0 && commissionRecords.length === 0) continue;

      // --- Monthly projections (meeting revenue) ---
      const thisMonthMeetings = recordsInRange(meetingRecords, currentMonthStart, currentMonthEnd);
      const lastMonthMeetings = recordsInRange(meetingRecords, lastMonthStart, lastMonthEnd);
      const currentMonthRevenue = sumRevenue(thisMonthMeetings);
      const lastMonthRevenue = sumRevenue(lastMonthMeetings);

      const projectedMonthlyRevenue = daysElapsedInMonth > 0
        ? round2((currentMonthRevenue / daysElapsedInMonth) * daysInCurrentMonth)
        : 0;

      let paceVsLastMonth: 'ahead' | 'behind' | 'on-track' = 'on-track';
      let pacePercentage = 0;
      if (lastMonthRevenue > 0) {
        pacePercentage = round2(((projectedMonthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100);
        if (pacePercentage > 10) {
          paceVsLastMonth = 'ahead';
        } else if (pacePercentage < -10) {
          paceVsLastMonth = 'behind';
        }
      } else if (projectedMonthlyRevenue > 0) {
        paceVsLastMonth = 'ahead';
        pacePercentage = 100;
      }

      // --- Yearly projections ---
      const ytdMeetings = recordsInRange(meetingRecords, ytdStart, ytdEnd);
      const ytdRevenue = sumRevenue(ytdMeetings);
      const projectedAnnualRevenue = daysElapsedInYear > 0
        ? round2((ytdRevenue / daysElapsedInYear) * daysInYear)
        : 0;

      const lastYearMeetings = recordsInRange(meetingRecords, lastYearStart, lastYearEnd);
      const lastYearRevenue = sumRevenue(lastYearMeetings);
      const hasLastYearData = lastYearMeetings.length > 0;

      // --- 4-week trend ---
      const weeklyRevenues: number[] = [];
      for (const week of last4Weeks) {
        const weekRecords = recordsInRange(meetingRecords, week.start, week.end);
        weeklyRevenues.push(sumRevenue(weekRecords));
      }
      const { direction: trendDirection, percentChange: trendPercentChange } = calculateTrend(weeklyRevenues);

      // --- Current month metrics for suggestions ---
      const monthInspected = sumMetric(thisMonthMeetings, 'inspected');
      const monthSigned = sumMetric(thisMonthMeetings, 'signed');
      const monthReferrals = sumMetric(thisMonthMeetings, 'referrals');
      const monthApproved = sumMetric(thisMonthMeetings, 'approved');
      const signRate = monthInspected > 0 ? round2(monthSigned / monthInspected) : 0;

      // Weeks with meeting data this month
      const repWeeksThisMonth = new Set(thisMonthMeetings.map(r => r.meetingDate)).size;
      const avgWeeklyReferrals = repWeeksThisMonth > 0 ? round2(monthReferrals / repWeeksThisMonth) : 0;

      // --- Commission projections ---
      let ytdCommission = 0;
      let currentMonthCommission = 0;
      let lastMonthCommission = 0;

      for (const comm of commissionRecords) {
        const d = parseCommissionDate(comm.date);
        if (!d) continue;

        // YTD
        if (d >= commissionYtdStart && d <= now) {
          ytdCommission += comm.amount;
        }

        // Current month
        if (d >= commissionCurrentMonthStart && d <= commissionCurrentMonthEnd) {
          currentMonthCommission += comm.amount;
        }

        // Last month
        if (d >= commissionLastMonthStart && d <= commissionLastMonthEnd) {
          lastMonthCommission += comm.amount;
        }
      }

      ytdCommission = round2(ytdCommission);
      currentMonthCommission = round2(currentMonthCommission);
      lastMonthCommission = round2(lastMonthCommission);

      const projectedMonthlyCommission = daysElapsedInMonth > 0
        ? round2((currentMonthCommission / daysElapsedInMonth) * daysInCurrentMonth)
        : 0;

      const projectedAnnualCommission = daysElapsedInYear > 0
        ? round2((ytdCommission / daysElapsedInYear) * daysInYear)
        : 0;

      // --- Motivational suggestions ---
      const suggestions = generateSuggestions(
        {
          name: fullName,
          monthlyProjected: projectedMonthlyRevenue,
          inspected: monthInspected,
          signed: monthSigned,
          referrals: monthReferrals,
          weeksActive: repWeeksThisMonth,
          trendDirection,
          ytdRevenue,
        },
        teamAvgReferralsPerWeek,
        bonusTiers,
      );

      projections.push({
        name: fullName,
        monthly: {
          currentRevenue: round2(currentMonthRevenue),
          projectedRevenue: projectedMonthlyRevenue,
          lastMonthRevenue: round2(lastMonthRevenue),
          paceVsLastMonth,
          pacePercentage,
          daysElapsed: daysElapsedInMonth,
          daysInMonth: daysInCurrentMonth,
        },
        yearly: {
          ytdRevenue: round2(ytdRevenue),
          projectedAnnual: projectedAnnualRevenue,
          lastYearRevenue: hasLastYearData ? round2(lastYearRevenue) : null,
          hasLastYearData,
          daysElapsedThisYear: daysElapsedInYear,
        },
        trend: {
          direction: trendDirection,
          weeklyRevenues: weeklyRevenues.map(v => round2(v)),
          percentChange: trendPercentChange,
        },
        suggestions,
        commission: {
          ytdCommission,
          currentMonthCommission,
          projectedMonthlyCommission,
          projectedAnnualCommission,
          lastMonthCommission,
        },
        metrics: {
          inspected: monthInspected,
          signed: monthSigned,
          referrals: monthReferrals,
          approved: monthApproved,
          signRate,
          avgWeeklyReferrals,
        },
      });
    }

    // Sort by projected monthly revenue descending
    projections.sort((a, b) => b.monthly.projectedRevenue - a.monthly.projectedRevenue);

    // -------------------------------------------------------------------------
    // Team summary
    // -------------------------------------------------------------------------
    const teamMonthlyRevenue = projections.reduce((s, p) => s + p.monthly.currentRevenue, 0);
    const teamProjectedMonthly = projections.reduce((s, p) => s + p.monthly.projectedRevenue, 0);
    const teamYtdRevenue = projections.reduce((s, p) => s + p.yearly.ytdRevenue, 0);
    const teamProjectedAnnual = projections.reduce((s, p) => s + p.yearly.projectedAnnual, 0);
    const teamYtdCommission = projections.reduce((s, p) => s + p.commission.ytdCommission, 0);
    const teamProjectedAnnualCommission = projections.reduce((s, p) => s + p.commission.projectedAnnualCommission, 0);

    const teamSummary: TeamSummary = {
      totalReps: projections.length,
      teamMonthlyRevenue: round2(teamMonthlyRevenue),
      teamProjectedMonthly: round2(teamProjectedMonthly),
      teamYtdRevenue: round2(teamYtdRevenue),
      teamProjectedAnnual: round2(teamProjectedAnnual),
      avgRepMonthlyProjection: projections.length > 0
        ? round2(teamProjectedMonthly / projections.length)
        : 0,
      repsImproving: projections.filter(p => p.trend.direction === 'improving').length,
      repsDeclining: projections.filter(p => p.trend.direction === 'declining').length,
      repsSteady: projections.filter(p => p.trend.direction === 'steady').length,
      teamYtdCommission: round2(teamYtdCommission),
      teamProjectedAnnualCommission: round2(teamProjectedAnnualCommission),
    };

    return NextResponse.json({
      success: true,
      projections,
      teamSummary,
      meta: {
        generatedAt: timestamp,
        currentMonth: now.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
        daysElapsedInMonth: daysElapsedInMonth,
        daysInMonth: daysInCurrentMonth,
        daysElapsedInYear: daysElapsedInYear,
        dataSource: 'meeting-numbers + commissions.json',
      },
    }, {
      headers: {
        'Cache-Control': 'private, max-age=60',
      },
    });
  } catch (error) {
    console.error('[Projections API Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp,
      },
      { status: 500 },
    );
  }
}
