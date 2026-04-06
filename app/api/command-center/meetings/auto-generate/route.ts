/**
 * RCRS Command Center - Auto-Generate Meeting Content API
 *
 * Pulls together ALL data needed for the Monday meeting presentation in one call:
 * - Bible verse (auto-suggested based on week rotation)
 * - Weather forecast for the week
 * - Sales numbers (from meeting-numbers data)
 * - Leaderboard rankings
 * - Announcements from dept heads
 * - Existing prep data (if any)
 * - Goal progress & week-over-week comparison
 *
 * GET /api/command-center/meetings/auto-generate
 *   ?date=2026-04-07  (optional, defaults to next Monday)
 *
 * Auth required.
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { weatherService } from '@/lib/weather-service';
import { meetingNumbersService, type MeetingRecord } from '@/lib/meeting-numbers-service';
import {
  getBibleVerseByWeek,
  getWeekNumber,
  calculateNextMeetingDate,
  getISODate,
  type BibleVerse,
  type MeetingPrepData,
} from '@/lib/meeting-data';
import { googleSheetsService } from '@/lib/google-sheets-service';

// =============================================================================
// Constants
// =============================================================================

/** Reps excluded from the sales breakdown (non-sales roles, inactive, etc.) */
const EXCLUDED_REPS = [
  'michael', 'chris', 'sara', 'john', 'bart', 'rudy', 'tae',
  'richard', 'destin', 'tia', 'boston',
];

// =============================================================================
// Helper Types
// =============================================================================

interface TeamTotals {
  inspected: number;
  damage: number;
  signed: number;
  repair: number;
  gutter: number;
  revenue: number;
  approved: number;
}

interface RepBreakdownEntry {
  name: string;
  inspected: number;
  damage: number;
  signed: number;
  repair: number;
  gutter: number;
  revenue: number;
  approved: number;
  goal: number;
  present: string;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get date in Central Time (America/Chicago) - RCRS is in Alabama.
 */
function getCentralDate(): Date {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
}

function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Get the previous Monday from a given Monday date string.
 */
function getPreviousMonday(mondayStr: string): string {
  const d = new Date(mondayStr + 'T12:00:00');
  d.setDate(d.getDate() - 7);
  return formatDateISO(d);
}

/**
 * Filter records to only sales reps (excluding EXCLUDED_REPS).
 */
function filterSalesReps(records: MeetingRecord[]): MeetingRecord[] {
  return records.filter(r => {
    const name = r.repName.toLowerCase().trim();
    return !EXCLUDED_REPS.includes(name);
  });
}

/**
 * Build team totals from a set of records.
 */
function buildTeamTotals(records: MeetingRecord[]): TeamTotals {
  const totals: TeamTotals = {
    inspected: 0, damage: 0, signed: 0, repair: 0,
    gutter: 0, revenue: 0, approved: 0,
  };
  for (const r of records) {
    totals.inspected += r.inspected;
    totals.damage += r.damage;
    totals.signed += r.signed;
    totals.repair += r.repair;
    totals.gutter += r.gutter;
    totals.revenue += r.revenue;
    totals.approved += r.approved;
  }
  // Round revenue to 2 decimals
  totals.revenue = Math.round(totals.revenue * 100) / 100;
  return totals;
}

/**
 * Build per-rep breakdown from records for a single meeting week.
 */
function buildRepBreakdown(records: MeetingRecord[]): RepBreakdownEntry[] {
  const byRep = new Map<string, MeetingRecord[]>();
  for (const r of records) {
    const existing = byRep.get(r.repName) || [];
    existing.push(r);
    byRep.set(r.repName, existing);
  }

  const breakdown: RepBreakdownEntry[] = [];
  byRep.forEach((recs, repName) => {
    const entry: RepBreakdownEntry = {
      name: repName,
      inspected: 0, damage: 0, signed: 0, repair: 0,
      gutter: 0, revenue: 0, approved: 0, goal: 0,
      present: '',
    };
    for (const r of recs) {
      entry.inspected += r.inspected;
      entry.damage += r.damage;
      entry.signed += r.signed;
      entry.repair += r.repair;
      entry.gutter += r.gutter;
      entry.revenue += r.revenue;
      entry.approved += r.approved;
      entry.goal += r.goal;
      entry.present = r.present; // last value wins (usually one record per rep per week)
    }
    entry.revenue = Math.round(entry.revenue * 100) / 100;
    breakdown.push(entry);
  });

  // Sort by revenue descending
  breakdown.sort((a, b) => b.revenue - a.revenue);
  return breakdown;
}

/**
 * Safe percentage change calculation.
 */
function percentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/**
 * Deserialize a Google Sheets row into MeetingPrepData.
 * Duplicated from the meetings route to avoid circular dependencies.
 */
function rowToPrepData(row: Record<string, string>, meetingDate: string): MeetingPrepData {
  return {
    id: row.id || `meeting-${meetingDate}`,
    meetingDate,
    bibleVerse: row.bibleVerseRef
      ? {
          reference: row.bibleVerseRef,
          text: row.bibleVerseText || '',
          theme: row.bibleVerseTheme || '',
        }
      : null,
    useRandomVerse: row.useRandomVerse === 'true',
    announcements: {
      part1: row.announcementsPart1 ? JSON.parse(row.announcementsPart1) : [],
      part2: row.announcementsPart2 ? JSON.parse(row.announcementsPart2) : [],
    },
    employeeOfMonth: row.employeeName
      ? {
          name: row.employeeName,
          department: row.employeeDept || '',
          reason: row.employeeReason || '',
        }
      : null,
    trainingTopic: row.trainingTopic || '',
    departmentNotes: {
      sales: row.salesNotes || '',
      operations: row.operationsNotes || '',
      office: row.officeNotes || '',
      drivers: row.driversNotes || '',
    },
    specialNotes: row.specialNotes || '',
    preparedBy: row.preparedBy || '',
    preparedAt: row.updatedAt || row.createdAt || '',
    status: (row.status as 'draft' | 'ready' | 'presented') || 'draft',
    approvedCharts: row.approvedCharts ? JSON.parse(row.approvedCharts) : [],
  };
}

// =============================================================================
// GET Handler
// =============================================================================

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');

    // Calculate meeting date (next Monday, or from ?date param)
    let meetingDate: string;
    if (dateParam) {
      meetingDate = dateParam;
    } else {
      const nextMeeting = calculateNextMeetingDate();
      meetingDate = getISODate(nextMeeting);
    }

    const weekNumber = getWeekNumber(new Date(meetingDate + 'T12:00:00'));
    const lastWeekDate = getPreviousMonday(meetingDate);
    const now = getCentralDate();
    const ytdStart = `${now.getFullYear()}-01-01`;
    const ytdEnd = formatDateISO(now);

    // =========================================================================
    // Fetch all data in parallel
    // =========================================================================

    const [
      weatherResult,
      announcementsResult,
      existingPrepResult,
    ] = await Promise.allSettled([
      // Weather for Decatur, AL
      weatherService.getWeatherByZip('35601'),
      // Announcements (internal fetch)
      fetchAnnouncements(request),
      // Existing prep from Google Sheets
      googleSheetsService.getMeetingPrep(meetingDate),
    ]);

    // =========================================================================
    // Bible verse
    // =========================================================================

    const suggestedVerse: BibleVerse = getBibleVerseByWeek(weekNumber);

    // =========================================================================
    // Weather
    // =========================================================================

    let weatherData = null;
    if (weatherResult.status === 'fulfilled') {
      const w = weatherResult.value;
      weatherData = {
        current: {
          temperature: w.current.temp,
          feelsLike: w.current.feelsLike,
          description: w.current.condition,
          humidity: w.current.humidity,
          windSpeed: w.current.windSpeed,
          icon: w.current.icon,
          isWorkable: w.current.isWorkable,
        },
        weekForecast: w.forecast.slice(0, 7).map(day => ({
          date: day.date,
          dayName: day.dayOfWeek,
          high: day.high,
          low: day.low,
          description: day.condition,
          precipChance: day.precipChance,
          windSpeed: day.windSpeed,
          icon: day.icon,
          isWorkDay: day.isWorkable,
          workabilityReason: day.workabilityReason,
        })),
        alerts: w.alerts,
        workableDays: w.forecast.slice(0, 7).filter(d => d.isWorkable).length,
        stormRisk: w.stormRisk,
        location: w.location,
      };
    }

    // =========================================================================
    // Meeting numbers (synchronous - reads from cached JSON)
    // =========================================================================

    const allRecords = meetingNumbersService.loadAllData();
    const salesRecords = filterSalesReps(allRecords);

    // This week's records (matching meeting date)
    const thisWeekRecords = salesRecords.filter(r => r.meetingDate === meetingDate);
    const lastWeekRecords = salesRecords.filter(r => r.meetingDate === lastWeekDate);

    // If no exact match, find the closest Monday with data
    let effectiveThisWeek = thisWeekRecords;
    let effectiveLastWeek = lastWeekRecords;

    if (effectiveThisWeek.length === 0) {
      // Find the most recent Monday with data
      const uniqueDates = Array.from(new Set(salesRecords.map(r => r.meetingDate))).sort().reverse();
      if (uniqueDates.length > 0) {
        effectiveThisWeek = salesRecords.filter(r => r.meetingDate === uniqueDates[0]);
        if (uniqueDates.length > 1) {
          effectiveLastWeek = salesRecords.filter(r => r.meetingDate === uniqueDates[1]);
        }
      }
    }

    // Team totals
    const thisWeekTotals = buildTeamTotals(effectiveThisWeek);
    const lastWeekTotals = buildTeamTotals(effectiveLastWeek);

    // Rep breakdowns
    const thisWeekBreakdown = buildRepBreakdown(effectiveThisWeek);
    const lastWeekBreakdown = buildRepBreakdown(effectiveLastWeek);

    // YTD totals
    const ytdRecords = salesRecords.filter(r => r.meetingDate >= ytdStart && r.meetingDate <= ytdEnd);
    const ytdTotals = buildTeamTotals(ytdRecords);

    // YTD top performer by revenue
    const ytdByRep = new Map<string, number>();
    for (const r of ytdRecords) {
      ytdByRep.set(r.repName, (ytdByRep.get(r.repName) || 0) + r.revenue);
    }
    let topPerformer = { name: 'N/A', revenue: 0 };
    ytdByRep.forEach((revenue, name) => {
      if (revenue > topPerformer.revenue) {
        topPerformer = { name, revenue: Math.round(revenue * 100) / 100 };
      }
    });

    // Week-over-week comparison
    const revenueChange = percentChange(thisWeekTotals.revenue, lastWeekTotals.revenue);
    const inspectedChange = percentChange(thisWeekTotals.inspected, lastWeekTotals.inspected);
    const signedChange = percentChange(thisWeekTotals.signed, lastWeekTotals.signed);
    let trend: 'up' | 'down' | 'flat' = 'flat';
    if (revenueChange > 5) trend = 'up';
    else if (revenueChange < -5) trend = 'down';

    // =========================================================================
    // Announcements
    // =========================================================================

    let announcements = { early: [] as unknown[], late: [] as unknown[] };
    if (announcementsResult.status === 'fulfilled' && announcementsResult.value) {
      announcements = announcementsResult.value;
    }

    // =========================================================================
    // Existing prep
    // =========================================================================

    let existingPrep: MeetingPrepData | null = null;
    if (existingPrepResult.status === 'fulfilled' && existingPrepResult.value) {
      const row = existingPrepResult.value;
      if (row.meetingDate) {
        existingPrep = rowToPrepData(row, meetingDate);
      }
    }

    // =========================================================================
    // Data freshness (when was the meeting numbers JSON last modified)
    // =========================================================================

    let dataFreshness = 'unknown';
    try {
      const fs = await import('fs');
      const path = await import('path');
      const currentYear = now.getFullYear();
      const dataFile = path.join(process.cwd(), 'data', `meeting-numbers-${currentYear}.json`);
      if (fs.existsSync(dataFile)) {
        const stat = fs.statSync(dataFile);
        dataFreshness = stat.mtime.toISOString();
      }
    } catch {
      // Ignore - freshness is optional metadata
    }

    // =========================================================================
    // Build response
    // =========================================================================

    const effectiveThisWeekDate = effectiveThisWeek.length > 0
      ? effectiveThisWeek[0].meetingDate
      : meetingDate;
    const effectiveLastWeekDate = effectiveLastWeek.length > 0
      ? effectiveLastWeek[0].meetingDate
      : lastWeekDate;

    return NextResponse.json({
      success: true,
      data: {
        meetingDate,
        weekNumber,

        // Auto-suggested content
        suggestedVerse,
        weather: weatherData,

        // This week's numbers
        thisWeek: {
          date: effectiveThisWeekDate,
          teamTotals: thisWeekTotals,
          repBreakdown: thisWeekBreakdown,
          repCount: thisWeekBreakdown.length,
        },

        // Last week's numbers (for comparison)
        lastWeek: {
          date: effectiveLastWeekDate,
          teamTotals: lastWeekTotals,
          repBreakdown: lastWeekBreakdown,
          repCount: lastWeekBreakdown.length,
        },

        // Week-over-week comparison
        comparison: {
          revenueChange,
          inspectedChange,
          signedChange,
          trend,
        },

        // Year-to-date
        ytd: {
          teamTotals: ytdTotals,
          topPerformer,
        },

        // Announcements
        announcements,

        // Existing prep (if someone already started preparing)
        existingPrep,

        // Meta
        generatedAt: new Date().toISOString(),
        dataFreshness,
      },
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'private, max-age=60', // 1 min cache (data changes frequently)
      },
    });
  } catch (error) {
    console.error('[Auto-Generate Meeting] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to auto-generate meeting content',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Fetch announcements via internal request to the monday-notes API.
 * Returns { early: [...], late: [...] } or null on failure.
 */
async function fetchAnnouncements(
  request: NextRequest
): Promise<{ early: unknown[]; late: unknown[] } | null> {
  try {
    const baseUrl = request.nextUrl.origin;
    const res = await fetch(`${baseUrl}/api/portal/monday-notes/announcements`, {
      headers: Object.fromEntries(request.headers),
    });

    if (!res.ok) return null;

    const data = await res.json();
    // The announcements endpoint returns { success, announcements: { early, late } }
    if (data.announcements) {
      return data.announcements;
    }
    // Or it might return { early, late } directly
    if (data.early || data.late) {
      return { early: data.early || [], late: data.late || [] };
    }
    return null;
  } catch {
    return null;
  }
}
