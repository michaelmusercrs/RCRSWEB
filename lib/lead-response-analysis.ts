/**
 * Lead Response Time Analysis Service
 *
 * Calculates and aggregates response time metrics from multiple data sources:
 * 1. Google Sheets Lead_Response_Log (real-time lead timer data)
 * 2. Google Sheets JN_Response_Times (mined JN historical data)
 * 3. Commissions data (pipeline timing from transaction dates)
 *
 * Provides: averages, medians, per-rep stats, trends, and breakdowns
 * by source, month, and pipeline stage.
 */

import { googleSheetsService } from './google-sheets-service';
import { jnResponseMiner } from './jn-response-miner';
import { isJobNimbusConfigured } from './jobnimbus-service';
import { TEAM_MEMBERS } from './team-roles';
import commissionsData from '@/data/commissions.json';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResponseTimeEntry {
  leadId: string;
  repSlug: string;
  repName: string;
  assignedAt: string;       // ISO date
  firstContactAt: string;   // ISO date
  responseMinutes: number;
  source: string;            // 'sheets' | 'jn_mined' | 'commissions'
  leadSource?: string;       // Where the lead came from (if known)
  wasReassigned: boolean;
}

export interface RepResponseSummary {
  repSlug: string;
  repName: string;
  avgMinutes: number;
  medianMinutes: number;
  fastestMinutes: number;
  slowestMinutes: number;
  totalLeads: number;
  respondedLeads: number;
  missedLeads: number;
  under5Min: number;       // count of leads responded to in <5 min
  under15Min: number;      // count in <15 min
  over60Min: number;       // count in >60 min
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface WeeklyTrendPoint {
  weekLabel: string;      // e.g. "Jan 6" or "W1"
  weekStart: string;      // ISO date
  avgMinutes: number;
  totalLeads: number;
  respondedLeads: number;
}

export interface MonthlyBreakdown {
  month: string;           // e.g. "2026-01"
  monthLabel: string;      // e.g. "Jan 2026"
  avgMinutes: number;
  medianMinutes: number;
  totalLeads: number;
  respondedLeads: number;
}

export interface PipelineStageTime {
  stage: string;
  label: string;
  avgDays: number;
  medianDays: number;
  sampleSize: number;
}

export interface ResponseTimeAnalytics {
  // Overall stats
  overallAvgMinutes: number;
  overallMedianMinutes: number;
  overallFastestMinutes: number;
  overallSlowestMinutes: number;
  totalLeadsAnalyzed: number;
  totalResponded: number;
  totalMissed: number;
  responseRate: number;          // percentage 0-100

  // Breakdowns
  byRep: RepResponseSummary[];
  weeklyTrend: WeeklyTrendPoint[];
  monthlyBreakdown: MonthlyBreakdown[];
  pipelineStages: PipelineStageTime[];

  // Metadata
  dataSource: string;            // which sources were used
  lastUpdated: string;           // ISO date
  cacheExpiry: string;           // ISO date
}

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

interface AnalyticsCache {
  data: ResponseTimeAnalytics;
  createdAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let analyticsCache: AnalyticsCache | null = null;

function isCacheValid(filters?: AnalyticsFilters): boolean {
  if (!analyticsCache) return false;
  // If filters are applied, skip cache (filtered results are not cached)
  if (filters?.rep || filters?.startDate || filters?.endDate || filters?.leadSource) return false;
  return Date.now() - analyticsCache.createdAt < CACHE_TTL_MS;
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export interface AnalyticsFilters {
  rep?: string;
  startDate?: string;   // ISO date
  endDate?: string;     // ISO date
  leadSource?: string;
}

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function gradeResponseTime(avgMinutes: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (avgMinutes <= 5) return 'A';
  if (avgMinutes <= 15) return 'B';
  if (avgMinutes <= 30) return 'C';
  if (avgMinutes <= 60) return 'D';
  return 'F';
}

function getWeekLabel(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getMonthLabel(key: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [year, monthStr] = key.split('-');
  const monthIndex = parseInt(monthStr, 10) - 1;
  return `${months[monthIndex]} ${year}`;
}

function matchRepName(name: string): { slug: string; name: string } | null {
  if (!name) return null;
  const lower = name.toLowerCase().trim();

  for (const m of TEAM_MEMBERS) {
    if (!m.isActive) continue;
    if (m.name.toLowerCase() === lower) return { slug: m.slug, name: m.name };
    const firstName = m.name.toLowerCase().split(' ')[0];
    if (lower.includes(firstName) || firstName === lower) return { slug: m.slug, name: m.name };
    if (m.slug === lower) return { slug: m.slug, name: m.name };
  }
  return null;
}

// Parse date string in MM/DD/YYYY format
function parseCommissionDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  let year = parseInt(parts[2], 10);
  if (isNaN(month) || isNaN(day) || isNaN(year)) return null;
  if (year < 100) year += 2000;
  return new Date(year, month - 1, day);
}

// ---------------------------------------------------------------------------
// Data Collection: Google Sheets Lead Response Log
// ---------------------------------------------------------------------------

async function collectSheetsResponseData(): Promise<ResponseTimeEntry[]> {
  const entries: ResponseTimeEntry[] = [];

  try {
    const logs = await googleSheetsService.getLeadResponseLogs();

    for (const log of logs) {
      if (!log.assignedAt || !log.repSlug) continue;

      const responseMinutes = log.responseMinutes ? parseFloat(log.responseMinutes) : 0;
      const hasResponse = responseMinutes > 0 && !!log.firstContactAt;

      // Skip obviously bad data
      if (hasResponse && (responseMinutes < 0 || responseMinutes > 43200)) continue;

      const rep = matchRepName(log.repSlug);

      entries.push({
        leadId: log.leadId,
        repSlug: rep?.slug || log.repSlug,
        repName: rep?.name || log.repSlug,
        assignedAt: log.assignedAt,
        firstContactAt: log.firstContactAt || '',
        responseMinutes: hasResponse ? responseMinutes : -1, // -1 = no response yet
        source: 'sheets',
        wasReassigned: !!log.reassignedAt,
      });
    }
  } catch (error) {
    console.warn('[ResponseAnalysis] Could not load Sheets response logs:', error);
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Data Collection: JN Mined Response Times
// ---------------------------------------------------------------------------

async function collectJNResponseData(): Promise<ResponseTimeEntry[]> {
  const entries: ResponseTimeEntry[] = [];

  try {
    const storedStats = await jnResponseMiner.getStoredResponseTimes();

    for (const stat of storedStats) {
      if (!stat.repSlug || stat.totalJobsAnalyzed === 0) continue;

      // JN mined data gives aggregate stats per rep, not individual entries.
      // We create a synthetic summary entry for each rep to blend with real data.
      entries.push({
        leadId: `jn-mined-${stat.repSlug}`,
        repSlug: stat.repSlug,
        repName: stat.repName,
        assignedAt: stat.lastMinedAt,
        firstContactAt: stat.lastMinedAt,
        responseMinutes: stat.avgResponseMinutes,
        source: 'jn_mined',
        wasReassigned: false,
      });
    }
  } catch (error) {
    console.warn('[ResponseAnalysis] Could not load JN mined response times:', error);
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Data Collection: Commission Pipeline Timing
// ---------------------------------------------------------------------------

interface RawCommission {
  salesRep: string;
  date: string;
  amount: number;
  balance: number;
}

function collectCommissionPipelineData(): {
  pipelineStages: PipelineStageTime[];
  repTransactionGaps: Map<string, number[]>;
} {
  const rawData = commissionsData as RawCommission[];

  // Group transactions by rep, sorted by date
  const repTransactions = new Map<string, Date[]>();

  for (const record of rawData) {
    const rep = record.salesRep;
    const date = parseCommissionDate(record.date);
    if (!date || !rep) continue;

    if (!repTransactions.has(rep)) {
      repTransactions.set(rep, []);
    }
    repTransactions.get(rep)!.push(date);
  }

  // Calculate gaps between consecutive transactions per rep
  // This approximates "time between deals closing"
  const repGaps = new Map<string, number[]>();
  const allGapsDays: number[] = [];

  for (const [rep, dates] of repTransactions) {
    const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
    const gaps: number[] = [];

    for (let i = 1; i < sorted.length; i++) {
      const gapMs = sorted[i].getTime() - sorted[i - 1].getTime();
      const gapDays = gapMs / (1000 * 60 * 60 * 24);
      // Only include reasonable gaps (between 0.5 and 120 days)
      if (gapDays >= 0.5 && gapDays <= 120) {
        gaps.push(gapDays);
        allGapsDays.push(gapDays);
      }
    }

    if (gaps.length > 0) {
      repGaps.set(rep, gaps);
    }
  }

  // Build pipeline stage estimates from commission data patterns
  // These are approximations based on commission closing patterns
  const pipelineStages: PipelineStageTime[] = [];

  if (allGapsDays.length > 0) {
    // Estimate pipeline stages from deal-close gap distribution
    const sortedGaps = [...allGapsDays].sort((a, b) => a - b);
    const p25 = sortedGaps[Math.floor(sortedGaps.length * 0.25)] || 0;
    const p50 = sortedGaps[Math.floor(sortedGaps.length * 0.50)] || 0;
    const p75 = sortedGaps[Math.floor(sortedGaps.length * 0.75)] || 0;
    const avgGap = allGapsDays.reduce((a, b) => a + b, 0) / allGapsDays.length;

    pipelineStages.push(
      {
        stage: 'lead_to_contact',
        label: 'Lead to First Contact',
        avgDays: round1(Math.min(p25 * 0.1, 1)),  // Typically < 1 day
        medianDays: round1(Math.min(p25 * 0.05, 0.5)),
        sampleSize: allGapsDays.length,
      },
      {
        stage: 'contact_to_appointment',
        label: 'Contact to Appointment',
        avgDays: round1(p25 * 0.5),
        medianDays: round1(p25 * 0.4),
        sampleSize: allGapsDays.length,
      },
      {
        stage: 'appointment_to_estimate',
        label: 'Appointment to Estimate',
        avgDays: round1(p25 * 0.3),
        medianDays: round1(p25 * 0.2),
        sampleSize: allGapsDays.length,
      },
      {
        stage: 'estimate_to_contract',
        label: 'Estimate to Contract Signed',
        avgDays: round1(p50 * 0.6),
        medianDays: round1(p50 * 0.5),
        sampleSize: allGapsDays.length,
      },
      {
        stage: 'full_pipeline',
        label: 'Full Pipeline (Lead to Close)',
        avgDays: round1(avgGap),
        medianDays: round1(p50),
        sampleSize: allGapsDays.length,
      }
    );
  }

  return { pipelineStages, repTransactionGaps: repGaps };
}

// ---------------------------------------------------------------------------
// Main Analysis Engine
// ---------------------------------------------------------------------------

export async function analyzeResponseTimes(
  filters?: AnalyticsFilters
): Promise<ResponseTimeAnalytics> {
  // Check cache for unfiltered requests
  if (!filters && isCacheValid()) {
    return analyticsCache!.data;
  }

  const now = new Date();
  const dataSources: string[] = [];

  // Collect data from all sources
  const sheetsData = await collectSheetsResponseData();
  if (sheetsData.length > 0) dataSources.push('sheets');

  let jnData: ResponseTimeEntry[] = [];
  if (isJobNimbusConfigured()) {
    jnData = await collectJNResponseData();
    if (jnData.length > 0) dataSources.push('jn_mined');
  }

  const { pipelineStages, repTransactionGaps } = collectCommissionPipelineData();
  if (pipelineStages.length > 0) dataSources.push('commissions');

  // Merge all individual response entries (Sheets + JN mined)
  let allEntries = [...sheetsData, ...jnData];

  // Apply filters
  if (filters?.rep) {
    const repLower = filters.rep.toLowerCase();
    allEntries = allEntries.filter(e =>
      e.repSlug.toLowerCase().includes(repLower) ||
      e.repName.toLowerCase().includes(repLower)
    );
  }

  if (filters?.startDate) {
    const start = new Date(filters.startDate);
    allEntries = allEntries.filter(e => {
      const d = new Date(e.assignedAt);
      return !isNaN(d.getTime()) && d >= start;
    });
  }

  if (filters?.endDate) {
    const end = new Date(filters.endDate);
    allEntries = allEntries.filter(e => {
      const d = new Date(e.assignedAt);
      return !isNaN(d.getTime()) && d <= end;
    });
  }

  if (filters?.leadSource) {
    const srcLower = filters.leadSource.toLowerCase();
    allEntries = allEntries.filter(e =>
      (e.leadSource || '').toLowerCase().includes(srcLower)
    );
  }

  // Separate responded vs not-yet-responded entries
  const respondedEntries = allEntries.filter(e => e.responseMinutes > 0);
  const missedEntries = allEntries.filter(e => e.responseMinutes <= 0 && e.wasReassigned);
  const allResponseTimes = respondedEntries.map(e => e.responseMinutes);

  // Overall stats
  const overallAvgMinutes = allResponseTimes.length > 0
    ? round1(allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length)
    : 0;
  const overallMedianMinutes = round1(median(allResponseTimes));
  const overallFastestMinutes = allResponseTimes.length > 0
    ? round1(Math.min(...allResponseTimes))
    : 0;
  const overallSlowestMinutes = allResponseTimes.length > 0
    ? round1(Math.max(...allResponseTimes))
    : 0;
  const responseRate = allEntries.length > 0
    ? round1((respondedEntries.length / allEntries.length) * 100)
    : 0;

  // ---------- By Rep Breakdown ----------
  const repMap = new Map<string, {
    slug: string;
    name: string;
    times: number[];
    total: number;
    responded: number;
    missed: number;
  }>();

  for (const entry of allEntries) {
    if (!repMap.has(entry.repSlug)) {
      repMap.set(entry.repSlug, {
        slug: entry.repSlug,
        name: entry.repName,
        times: [],
        total: 0,
        responded: 0,
        missed: 0,
      });
    }
    const rep = repMap.get(entry.repSlug)!;
    rep.total++;

    if (entry.responseMinutes > 0) {
      rep.times.push(entry.responseMinutes);
      rep.responded++;
    }
    if (entry.wasReassigned) {
      rep.missed++;
    }
  }

  // Also include commission-based gap data as supplementary rep info
  for (const [repName, gaps] of repTransactionGaps) {
    const match = matchRepName(repName);
    if (!match) continue;
    // Only add if rep not already in the map with real response time data
    if (!repMap.has(match.slug) && gaps.length > 0) {
      const avgDays = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      repMap.set(match.slug, {
        slug: match.slug,
        name: match.name,
        times: [],  // No real response times, just pipeline data
        total: gaps.length,
        responded: gaps.length,
        missed: 0,
      });
    }
  }

  const byRep: RepResponseSummary[] = [];
  for (const [, rep] of repMap) {
    const avg = rep.times.length > 0
      ? round1(rep.times.reduce((a, b) => a + b, 0) / rep.times.length)
      : 0;
    const med = round1(median(rep.times));
    const fastest = rep.times.length > 0 ? round1(Math.min(...rep.times)) : 0;
    const slowest = rep.times.length > 0 ? round1(Math.max(...rep.times)) : 0;

    byRep.push({
      repSlug: rep.slug,
      repName: rep.name,
      avgMinutes: avg,
      medianMinutes: med,
      fastestMinutes: fastest,
      slowestMinutes: slowest,
      totalLeads: rep.total,
      respondedLeads: rep.responded,
      missedLeads: rep.missed,
      under5Min: rep.times.filter(t => t <= 5).length,
      under15Min: rep.times.filter(t => t <= 15).length,
      over60Min: rep.times.filter(t => t > 60).length,
      grade: rep.times.length > 0 ? gradeResponseTime(avg) : 'F',
    });
  }

  // Sort by avg response time ascending (fastest first)
  byRep.sort((a, b) => {
    if (a.avgMinutes === 0 && b.avgMinutes === 0) return 0;
    if (a.avgMinutes === 0) return 1;
    if (b.avgMinutes === 0) return -1;
    return a.avgMinutes - b.avgMinutes;
  });

  // ---------- Weekly Trend (last 12 weeks) ----------
  const weeklyTrend: WeeklyTrendPoint[] = [];
  const twelveWeeksAgo = new Date(now);
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

  const weekBuckets = new Map<string, { times: number[]; total: number; start: Date }>();

  for (const entry of allEntries) {
    const date = new Date(entry.assignedAt);
    if (isNaN(date.getTime()) || date < twelveWeeksAgo) continue;

    const weekStart = getWeekStart(date);
    const key = weekStart.toISOString().split('T')[0];

    if (!weekBuckets.has(key)) {
      weekBuckets.set(key, { times: [], total: 0, start: weekStart });
    }
    const bucket = weekBuckets.get(key)!;
    bucket.total++;
    if (entry.responseMinutes > 0) {
      bucket.times.push(entry.responseMinutes);
    }
  }

  // Sort weeks chronologically
  const sortedWeeks = [...weekBuckets.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  for (const [key, bucket] of sortedWeeks) {
    weeklyTrend.push({
      weekLabel: getWeekLabel(bucket.start),
      weekStart: key,
      avgMinutes: bucket.times.length > 0
        ? round1(bucket.times.reduce((a, b) => a + b, 0) / bucket.times.length)
        : 0,
      totalLeads: bucket.total,
      respondedLeads: bucket.times.length,
    });
  }

  // ---------- Monthly Breakdown ----------
  const monthBuckets = new Map<string, { times: number[]; total: number }>();

  for (const entry of allEntries) {
    const date = new Date(entry.assignedAt);
    if (isNaN(date.getTime())) continue;

    const key = getMonthKey(date);
    if (!monthBuckets.has(key)) {
      monthBuckets.set(key, { times: [], total: 0 });
    }
    const bucket = monthBuckets.get(key)!;
    bucket.total++;
    if (entry.responseMinutes > 0) {
      bucket.times.push(entry.responseMinutes);
    }
  }

  const monthlyBreakdown: MonthlyBreakdown[] = [];
  const sortedMonths = [...monthBuckets.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  for (const [key, bucket] of sortedMonths) {
    monthlyBreakdown.push({
      month: key,
      monthLabel: getMonthLabel(key),
      avgMinutes: bucket.times.length > 0
        ? round1(bucket.times.reduce((a, b) => a + b, 0) / bucket.times.length)
        : 0,
      medianMinutes: round1(median(bucket.times)),
      totalLeads: bucket.total,
      respondedLeads: bucket.times.length,
    });
  }

  // Build result
  const result: ResponseTimeAnalytics = {
    overallAvgMinutes,
    overallMedianMinutes,
    overallFastestMinutes,
    overallSlowestMinutes,
    totalLeadsAnalyzed: allEntries.length,
    totalResponded: respondedEntries.length,
    totalMissed: missedEntries.length,
    responseRate,

    byRep,
    weeklyTrend,
    monthlyBreakdown,
    pipelineStages,

    dataSource: dataSources.length > 0 ? dataSources.join(', ') : 'none',
    lastUpdated: now.toISOString(),
    cacheExpiry: new Date(now.getTime() + CACHE_TTL_MS).toISOString(),
  };

  // Cache unfiltered results
  if (!filters || (!filters.rep && !filters.startDate && !filters.endDate && !filters.leadSource)) {
    analyticsCache = {
      data: result,
      createdAt: Date.now(),
    };
  }

  return result;
}

// ---------------------------------------------------------------------------
// Export for use by API route
// ---------------------------------------------------------------------------

export { median, gradeResponseTime };
