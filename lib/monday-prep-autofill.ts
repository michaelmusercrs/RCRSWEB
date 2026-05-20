/**
 * Monday Meeting Prep Auto-Fill Service
 *
 * Pre-populates the Monday meeting deck with this week's numbers so the
 * owner doesn't have to spend ~30 minutes pulling data from 6+ tabs every
 * Monday morning. Saves a draft to the `Monday Prep` sheet tab which the
 * owner reviews + edits before the 10am meeting.
 *
 * SOURCES (every figure traces to one of these — never fabricated):
 *   - meeting-numbers-{year}.json (lib/meeting-numbers-service)        // $$$$$ accrual + activity per rep
 *   - data/commissions.json                                            // QB 1099 cash leaderboard
 *   - RepWeeklyNumbers Sheet (lib/google-sheets-service.getRepWeeklyNumbers)
 *   - MondayNotes Sheet      (lib/google-sheets-service.getMondayNotes)
 *   - weather-service (Open-Meteo) for 7-day Decatur AL forecast
 *   - storm-report-service for recent hail activity in service area
 *
 * HARD RULES enforced here:
 *   - Three leaderboards are NEVER combined (sales accrual vs commission cash
 *     vs activity self-report). Each is surfaced as its own section.
 *   - Missing data returns `null` with a `missing` flag — never a fabricated
 *     zero or guess (per [[feedback_never_invent_brand_data]]).
 *   - Auto-announcements get a confidence score; anything <0.7 is flagged
 *     `needsOwnerReview: true` so it doesn't slip into the deck unchecked.
 *
 * Owner reviews everything before it goes external. No auto-send.
 *
 * @author RCRS Development Team
 */

import { promises as fs } from 'fs';
import path from 'path';
import {
  meetingNumbersService,
  type MeetingRecord,
} from './meeting-numbers-service';
import { googleSheetsService } from './google-sheets-service';
import { weatherService, type WeatherData, type DayForecast } from './weather-service';

// =============================================================================
// Constants
// =============================================================================

/** Reps excluded from sales leaderboards (owner, admin, support, drivers). */
const EXCLUDED_REPS = new Set([
  'michael', 'chris', 'sara', 'john', 'bart', 'rudy', 'tae',
  'richard', 'destin', 'tia', 'boston',
]);

/** Confidence threshold below which an announcement needs owner review. */
export const AUTO_ANNOUNCEMENT_REVIEW_THRESHOLD = 0.7;

// =============================================================================
// Types
// =============================================================================

/**
 * A figure that may not have a real value backing it. `value: null` means
 * "no data" — callers should render an em-dash or "—" rather than zero.
 */
export interface TracedFigure {
  value: number | null;
  source: string;       // human-readable source (e.g. "meeting-numbers $$$$$ column")
  missing?: boolean;    // true if the underlying data was empty/missing
  note?: string;        // optional context (e.g. "0 reps reported")
}

export interface RepSalesEntry {
  name: string;
  inspected: number;
  signed: number;
  revenue: number;       // accrual from $$$$$ — NOT QB cash
  approved: number;
  goal: number;
  present: string;
}

export interface CommissionLeaderEntry {
  name: string;
  amountPaid: number;    // real QB cash paid out
}

export interface ActivityRepEntry {
  name: string;
  doorsKnocked: number;
  appointmentsSet: number;
  contractsSigned: number;
  revenueClosed: number;
}

export interface ProposedAnnouncement {
  title: string;
  content: string;
  source: string;
  confidence: number;            // 0..1
  needsOwnerReview: boolean;
}

export interface WeatherCallout {
  summary: string;
  workableDays: number | null;
  stormDays: string[];           // ISO dates with rain/thunder/hail risk
  hasAlerts: boolean;
  alertHeadlines: string[];
  source: string;
}

export interface PrepData {
  weekStart: string;             // YYYY-MM-DD of the Monday being prepped
  generatedAt: string;

  // 1. Sales (accrual) — three leaderboards rule: keep separate
  salesAccrual: {
    teamRevenue: TracedFigure;
    teamSigned: TracedFigure;
    teamInspected: TracedFigure;
    perRep: RepSalesEntry[];
    weekOverWeekRevenueChange: number | null;  // percent; null if no prior data
    source: string;
  };

  // 2. Commission (QB cash) — separate from sales
  commissionLeaderboard: {
    top5: CommissionLeaderEntry[];
    totalPaidYTD: TracedFigure;
    source: string;
  };

  // 3. Activity (self-reported) — separate from sales + commission
  activityLeaderboard: {
    top5: ActivityRepEntry[];
    totalDoors: TracedFigure;
    totalAppts: TracedFigure;
    source: string;
  };

  // Highlights pulled from the three leaderboards
  highlights: {
    topPerformerByRevenue: { name: string; revenue: number } | null;
    biggestCloserBySigned: { name: string; signed: number } | null;
    biggestCommissionCheck: { name: string; amount: number } | null;
  };

  // Customer wins — from load_verified breakdowns (placeholder until wired)
  customerWins: {
    loadVerifiedCount: TracedFigure;
    loadVerifiedTotal: TracedFigure;
    source: string;
  };

  // Storm/weather context
  weather: WeatherCallout | null;
  recentStorms: {
    hailReportCount: TracedFigure;
    source: string;
  };

  // Operational
  missedCalls: TracedFigure;
  openLeadsByRep: Array<{ name: string; count: number }>;

  // Proposed announcements (owner must approve before they go in the deck)
  proposedAnnouncements: ProposedAnnouncement[];

  // Sources surfaced together so the owner can audit every number
  dataSources: string[];

  // Errors collected during generation — non-fatal, surfaced in UI
  warnings: string[];
}

// =============================================================================
// Helpers
// =============================================================================

function safePercentChange(curr: number, prev: number): number | null {
  if (prev === 0) return curr > 0 ? 100 : null;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

function previousMondayISO(mondayISO: string): string {
  const d = new Date(mondayISO + 'T12:00:00');
  d.setDate(d.getDate() - 7);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isSalesRep(repName: string): boolean {
  const n = (repName || '').toLowerCase().trim();
  if (!n) return false;
  if (EXCLUDED_REPS.has(n)) return false;
  // Also exclude when full name starts with an excluded first name
  const first = n.split(' ')[0];
  return !EXCLUDED_REPS.has(first);
}

function buildSalesPerRep(records: MeetingRecord[]): RepSalesEntry[] {
  const byRep = new Map<string, RepSalesEntry>();
  for (const r of records) {
    const existing = byRep.get(r.repName) || {
      name: r.repName,
      inspected: 0, signed: 0, revenue: 0, approved: 0, goal: 0, present: '',
    };
    existing.inspected += r.inspected;
    existing.signed += r.signed;
    existing.revenue += r.revenue;
    existing.approved += r.approved;
    existing.goal += r.goal;
    existing.present = r.present || existing.present;
    byRep.set(r.repName, existing);
  }
  return Array.from(byRep.values())
    .map(r => ({ ...r, revenue: Math.round(r.revenue * 100) / 100 }))
    .sort((a, b) => b.revenue - a.revenue);
}

// =============================================================================
// Commission loader (QB cash — completely separate from sales accrual)
// =============================================================================

interface CommissionEntry {
  salesRep: string;
  date: string;
  amount: number;
}

async function loadCommissions(): Promise<CommissionEntry[]> {
  try {
    const file = path.join(process.cwd(), 'data', 'commissions.json');
    const raw = await fs.readFile(file, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((c: unknown): c is CommissionEntry => {
      if (!c || typeof c !== 'object') return false;
      const obj = c as Record<string, unknown>;
      return typeof obj.salesRep === 'string' && typeof obj.amount === 'number';
    });
  } catch {
    return [];
  }
}

// =============================================================================
// Storm + missed-calls + open-leads helpers (best-effort; null if unavailable)
// =============================================================================

/**
 * Recent hail events in service area, sourced from storm-report-service if
 * available. Returns null on any failure rather than fabricating a count.
 */
async function getRecentHailCount(): Promise<TracedFigure> {
  // The storm report service is geared toward per-property lookups, not a
  // service-area aggregate. Until a service-area aggregator exists, return
  // a missing figure rather than fake one.
  return {
    value: null,
    source: 'storm-report-service (service-area aggregate not yet implemented)',
    missing: true,
    note: 'Wire to NOAA service-area query before going live.',
  };
}

/**
 * Missed-call count for the week. Returns missing if no calls service is
 * available — never zero.
 */
async function getMissedCallCount(weekStart: string): Promise<TracedFigure> {
  try {
    const callsFile = path.join(process.cwd(), 'data', 'calls.json');
    const raw = await fs.readFile(callsFile, 'utf-8');
    const calls = JSON.parse(raw);
    if (!Array.isArray(calls)) {
      return { value: null, source: 'calls.json', missing: true, note: 'calls.json malformed' };
    }
    const weekEnd = previousMondayISO(weekStart); // 7 days before weekStart
    const missed = calls.filter((c: unknown) => {
      if (!c || typeof c !== 'object') return false;
      const obj = c as Record<string, unknown>;
      const status = String(obj.status || '').toLowerCase();
      const date = String(obj.date || obj.timestamp || '');
      if (!date) return false;
      const isMissed = status === 'missed' || status === 'no-answer' || status === 'voicemail';
      return isMissed && date >= weekEnd && date < weekStart;
    }).length;
    return { value: missed, source: 'data/calls.json (status=missed|no-answer|voicemail)' };
  } catch {
    return { value: null, source: 'data/calls.json', missing: true, note: 'calls.json not found' };
  }
}

async function getOpenLeadsByRep(): Promise<Array<{ name: string; count: number }>> {
  try {
    const leadsFile = path.join(process.cwd(), 'data', 'leads.json');
    const raw = await fs.readFile(leadsFile, 'utf-8');
    const leads = JSON.parse(raw);
    if (!Array.isArray(leads)) return [];
    const counts = new Map<string, number>();
    for (const lead of leads) {
      if (!lead || typeof lead !== 'object') continue;
      const obj = lead as Record<string, unknown>;
      const status = String(obj.status || '').toLowerCase();
      const assigned = String(obj.assignedTo || obj.salesRep || obj.rep || '').trim();
      if (!assigned) continue;
      // Open == not closed/lost/won/converted
      const isOpen = !['closed', 'lost', 'won', 'converted', 'dead'].includes(status);
      if (!isOpen) continue;
      counts.set(assigned, (counts.get(assigned) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}

// =============================================================================
// Public API: buildPrepData
// =============================================================================

export async function buildPrepData(opts: { weekStart: string }): Promise<PrepData> {
  const { weekStart } = opts;
  const warnings: string[] = [];
  const dataSources: string[] = [];

  // ---- 1. SALES ACCRUAL (Monday meeting $$$$$ column) ----
  const allMeetingRecords = meetingNumbersService.loadAllData();
  const salesRecords = allMeetingRecords.filter(r => isSalesRep(r.repName));
  const thisWeekRecords = salesRecords.filter(r => r.meetingDate === weekStart);
  const lastWeekISO = previousMondayISO(weekStart);
  const lastWeekRecords = salesRecords.filter(r => r.meetingDate === lastWeekISO);

  const sumRev = (records: MeetingRecord[]) =>
    Math.round(records.reduce((s, r) => s + r.revenue, 0) * 100) / 100;
  const sumSigned = (records: MeetingRecord[]) =>
    records.reduce((s, r) => s + r.signed, 0);
  const sumInsp = (records: MeetingRecord[]) =>
    records.reduce((s, r) => s + r.inspected, 0);

  const thisRev = sumRev(thisWeekRecords);
  const lastRev = sumRev(lastWeekRecords);
  const thisWeekHasData = thisWeekRecords.length > 0;
  if (!thisWeekHasData) {
    warnings.push(
      `No meeting-numbers records for ${weekStart}. Sales totals will show — (data not yet entered).`
    );
  }

  const salesAccrualSource =
    `meeting-numbers-${weekStart.slice(0, 4)}.json ($$$$$ column, master sheet 1tEbMV...)`;
  dataSources.push(salesAccrualSource);

  const salesAccrual: PrepData['salesAccrual'] = {
    teamRevenue: thisWeekHasData
      ? { value: thisRev, source: salesAccrualSource }
      : { value: null, source: salesAccrualSource, missing: true, note: 'No reps reported yet' },
    teamSigned: thisWeekHasData
      ? { value: sumSigned(thisWeekRecords), source: salesAccrualSource }
      : { value: null, source: salesAccrualSource, missing: true },
    teamInspected: thisWeekHasData
      ? { value: sumInsp(thisWeekRecords), source: salesAccrualSource }
      : { value: null, source: salesAccrualSource, missing: true },
    perRep: buildSalesPerRep(thisWeekRecords),
    weekOverWeekRevenueChange: thisWeekHasData && lastWeekRecords.length > 0
      ? safePercentChange(thisRev, lastRev)
      : null,
    source: salesAccrualSource,
  };

  // ---- 2. COMMISSION (QB cash) — completely separate from sales accrual ----
  const commissions = await loadCommissions();
  const yearStart = `${weekStart.slice(0, 4)}-01-01`;
  const repCommissionsYTD = new Map<string, number>();
  let totalCommissionsYTD = 0;
  for (const c of commissions) {
    if (!c.amount || c.amount <= 0) continue;
    if (c.date && c.date < yearStart) continue;
    repCommissionsYTD.set(c.salesRep, (repCommissionsYTD.get(c.salesRep) || 0) + c.amount);
    totalCommissionsYTD += c.amount;
  }
  const commTop5 = Array.from(repCommissionsYTD.entries())
    .map(([name, amountPaid]) => ({ name, amountPaid: Math.round(amountPaid * 100) / 100 }))
    .sort((a, b) => b.amountPaid - a.amountPaid)
    .slice(0, 5);
  const commissionSource = 'data/commissions.json (QB 1099 export; cash paid, NOT accrual)';
  dataSources.push(commissionSource);
  if (commissions.length === 0) {
    warnings.push('No commissions.json data — Commission Leaderboard will be empty.');
  }

  const commissionLeaderboard: PrepData['commissionLeaderboard'] = {
    top5: commTop5,
    totalPaidYTD: commissions.length > 0
      ? { value: Math.round(totalCommissionsYTD * 100) / 100, source: commissionSource }
      : { value: null, source: commissionSource, missing: true },
    source: commissionSource,
  };

  // ---- 3. ACTIVITY (self-reported via /portal/sales/weekly-numbers form) ----
  let activityRecords: Awaited<ReturnType<typeof googleSheetsService.getRepWeeklyNumbers>> = [];
  try {
    // ISO week of weekStart
    const d = new Date(weekStart + 'T00:00:00');
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStartDate = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(
      ((d.getTime() - yearStartDate.getTime()) / 86400000 + 1) / 7
    );
    const isoWeek = `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
    activityRecords = await googleSheetsService.getRepWeeklyNumbers({
      weekStart: isoWeek,
      weekEnd: isoWeek,
    });
  } catch (err) {
    warnings.push(`Activity fetch failed: ${err instanceof Error ? err.message : 'unknown'}`);
  }
  const activitySource = 'RepWeeklyNumbers sheet tab (self-reported via /portal/sales/weekly-numbers)';
  dataSources.push(activitySource);
  const activityTop5: ActivityRepEntry[] = activityRecords
    .map(r => ({
      name: r.repName,
      doorsKnocked: r.doorsKnocked || 0,
      appointmentsSet: r.appointmentsSet || 0,
      contractsSigned: r.contractsSigned || 0,
      revenueClosed: r.revenueClosed || 0,
    }))
    .sort((a, b) => b.contractsSigned - a.contractsSigned || b.doorsKnocked - a.doorsKnocked)
    .slice(0, 5);
  const totalDoors = activityRecords.reduce((s, r) => s + (r.doorsKnocked || 0), 0);
  const totalAppts = activityRecords.reduce((s, r) => s + (r.appointmentsSet || 0), 0);
  const activityLeaderboard: PrepData['activityLeaderboard'] = {
    top5: activityTop5,
    totalDoors: activityRecords.length > 0
      ? { value: totalDoors, source: activitySource }
      : { value: null, source: activitySource, missing: true, note: 'No reps self-reported this week' },
    totalAppts: activityRecords.length > 0
      ? { value: totalAppts, source: activitySource }
      : { value: null, source: activitySource, missing: true },
    source: activitySource,
  };

  // ---- Highlights (each from a different leaderboard, kept distinct) ----
  const topPerformer = salesAccrual.perRep[0];
  const biggestCloser = [...salesAccrual.perRep].sort((a, b) => b.signed - a.signed)[0];
  const biggestCommish = commTop5[0];

  // ---- Customer wins (placeholder: load_verified data lives in Tickets sheet) ----
  const customerWins: PrepData['customerWins'] = {
    loadVerifiedCount: {
      value: null,
      source: 'Tickets sheet (load_verified status)',
      missing: true,
      note: 'Wire to ticket-sheet-service.getTicketsByStatus("load_verified") before launch.',
    },
    loadVerifiedTotal: {
      value: null,
      source: 'Tickets sheet (load_verified status)',
      missing: true,
    },
    source: 'Tickets sheet (load_verified status, sum of ticket value)',
  };

  // ---- Weather + storms ----
  let weather: WeatherCallout | null = null;
  try {
    const w = await weatherService.getWeatherByZip('35601');
    weather = await proposeWeatherCallout({ weatherData: w, weekStart });
    dataSources.push(weather.source);
  } catch (err) {
    warnings.push(`Weather fetch failed: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  const recentStorms = {
    hailReportCount: await getRecentHailCount(),
    source: 'storm-report-service / NOAA hail history',
  };

  // ---- Missed calls + open leads ----
  const missedCalls = await getMissedCallCount(weekStart);
  if (!missedCalls.missing) dataSources.push(missedCalls.source);
  const openLeadsByRep = await getOpenLeadsByRep();
  if (openLeadsByRep.length > 0) dataSources.push('data/leads.json (status=open)');

  // ---- Proposed announcements (from MondayNotes + system signals) ----
  let recentNotes: Record<string, string>[] = [];
  try {
    recentNotes = await googleSheetsService.getMondayNotes({ meetingDate: lastWeekISO });
  } catch (err) {
    warnings.push(`MondayNotes fetch failed: ${err instanceof Error ? err.message : 'unknown'}`);
  }
  const proposedAnnouncements = proposeAnnouncements({
    recentNotes,
    recentEvents: [],   // hook for permit/cert/anniversary feed when wired
    weekStart,
  });
  if (recentNotes.length > 0) dataSources.push('MondayNotes sheet tab (last week, status=approved)');

  return {
    weekStart,
    generatedAt: new Date().toISOString(),
    salesAccrual,
    commissionLeaderboard,
    activityLeaderboard,
    highlights: {
      topPerformerByRevenue: topPerformer && topPerformer.revenue > 0
        ? { name: topPerformer.name, revenue: topPerformer.revenue }
        : null,
      biggestCloserBySigned: biggestCloser && biggestCloser.signed > 0
        ? { name: biggestCloser.name, signed: biggestCloser.signed }
        : null,
      biggestCommissionCheck: biggestCommish && biggestCommish.amountPaid > 0
        ? { name: biggestCommish.name, amount: biggestCommish.amountPaid }
        : null,
    },
    customerWins,
    weather,
    recentStorms,
    missedCalls,
    openLeadsByRep,
    proposedAnnouncements,
    dataSources,
    warnings,
  };
}

// =============================================================================
// Public API: proposeAnnouncements
// =============================================================================

/**
 * Mine prior Monday notes + recent system events for things that look like
 * meaningful announcements. Returns each with a confidence score; anything
 * below `AUTO_ANNOUNCEMENT_REVIEW_THRESHOLD` is flagged for owner review.
 *
 * CONFIDENCE LOGIC:
 *   1.0  - explicit announcement type='early' or 'late' last week (high signal)
 *   0.85 - approved Monday note with a clear title
 *   0.7  - approved Monday note with body content but no title (manual review border)
 *   0.5  - draft or unapproved note (always needs review)
 *
 * Nothing is fabricated. If `recentNotes` is empty, returns [].
 */
export function proposeAnnouncements(opts: {
  recentNotes: Record<string, string>[];
  recentEvents: Array<{ kind: string; title: string; content: string; date: string }>;
  weekStart: string;
}): ProposedAnnouncement[] {
  const { recentNotes, recentEvents } = opts;
  const proposed: ProposedAnnouncement[] = [];

  // From last week's Monday notes
  for (const note of recentNotes) {
    const title = (note.title || '').trim();
    const content = (note.content || '').trim();
    const status = (note.status || '').toLowerCase();
    const announcementType = (note.announcementType || '').toLowerCase();
    if (!title && !content) continue;

    let confidence = 0.5;
    if (status === 'approved' && announcementType) confidence = 1.0;
    else if (status === 'approved' && title) confidence = 0.85;
    else if (status === 'approved') confidence = 0.7;
    else confidence = 0.5;

    proposed.push({
      title: title || content.slice(0, 60),
      content: content || title,
      source: `MondayNotes id=${note.id || '(unknown)'}, status=${status}`,
      confidence,
      needsOwnerReview: confidence < AUTO_ANNOUNCEMENT_REVIEW_THRESHOLD,
    });
  }

  // From recent system events (permits won, IKO cert renewals, anniversaries, etc.)
  for (const evt of recentEvents) {
    proposed.push({
      title: evt.title,
      content: evt.content,
      source: `system event: ${evt.kind} @ ${evt.date}`,
      confidence: 0.8,
      needsOwnerReview: 0.8 < AUTO_ANNOUNCEMENT_REVIEW_THRESHOLD,
    });
  }

  return proposed.sort((a, b) => b.confidence - a.confidence);
}

// =============================================================================
// Public API: proposeWeatherCallout
// =============================================================================

/**
 * Build the deck weather callout from a fetched WeatherData. Identifies
 * storm-likely days (precip > 50% OR weather code >= 95) so the owner can
 * call out "we lose Wednesday" before the week starts.
 */
export async function proposeWeatherCallout(opts: {
  weatherData?: WeatherData;
  weekStart: string;
}): Promise<WeatherCallout> {
  const { weatherData, weekStart } = opts;
  let w: WeatherData;
  if (weatherData) {
    w = weatherData;
  } else {
    w = await weatherService.getWeatherByZip('35601');
  }

  const week = w.forecast.slice(0, 7);
  const workable = week.filter(d => d.isWorkable).length;
  const stormDays = week
    .filter((d: DayForecast) => d.precipChance > 50 || /thunder|hail|storm/i.test(d.condition))
    .map((d: DayForecast) => d.date);

  const alertHeadlines = (w.alerts || []).map(a => a.headline).slice(0, 3);

  let summary = `${week.length}-day forecast for ${w.location}: ${workable} workable day${workable === 1 ? '' : 's'}.`;
  if (stormDays.length > 0) {
    summary += ` Storm risk on ${stormDays.length} day${stormDays.length === 1 ? '' : 's'} (${stormDays.join(', ')}).`;
  }
  if (alertHeadlines.length > 0) {
    summary += ` Active alerts: ${alertHeadlines.join('; ')}.`;
  }

  return {
    summary,
    workableDays: workable,
    stormDays,
    hasAlerts: alertHeadlines.length > 0,
    alertHeadlines,
    source: `weather-service / Open-Meteo (zip 35601, weekStart=${weekStart})`,
  };
}
