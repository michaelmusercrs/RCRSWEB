/**
 * RCRS Employee Time Tracking Service
 *
 * Manages clock in/out, breaks, timesheet summaries, and approvals.
 * Supports GPS location tracking, job linking, and overtime calculation.
 *
 * Persisted to the Google Sheets master workbook (Time_Entries tab).
 * The legacy data/time-entries.json file is left in place as a dev seed
 * but no longer read or written at runtime.
 *
 * @author RCRS Development Team
 * @version 2.0.0
 */

import crypto from 'crypto';
import { googleSheetsService, SHEET_NAMES } from './google-sheets-service';

// =============================================================================
// TYPES
// =============================================================================

export interface TimeEntry {
  id: string;
  repSlug: string;
  repName: string;
  date: string; // YYYY-MM-DD

  clockIn: string; // ISO timestamp
  clockOut?: string;
  breakStart?: string;
  breakEnd?: string;

  totalHours: number;
  breakHours: number;
  netHours: number; // totalHours - breakHours

  jobId?: string;
  customerName?: string;
  address?: string;

  category: 'office' | 'field' | 'travel' | 'training' | 'meeting' | 'admin';
  notes: string;

  status: 'active' | 'completed' | 'approved' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;

  location?: { lat: number; lng: number }; // GPS clock-in location

  createdAt: string;
  updatedAt: string;
}

export interface TimesheetSummary {
  repSlug: string;
  repName: string;
  period: { start: string; end: string };
  totalHours: number;
  regularHours: number; // up to 40
  overtimeHours: number; // over 40
  daysWorked: number;
  avgHoursPerDay: number;
  entries: TimeEntry[];
  status: 'pending' | 'submitted' | 'approved' | 'rejected';
}

export interface WeeklyHours {
  sun: number;
  mon: number;
  tue: number;
  wed: number;
  thu: number;
  fri: number;
  sat: number;
  total: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const REGULAR_HOURS_WEEKLY = 40;
const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

// =============================================================================
// SHEET SCHEMA
// =============================================================================

const TIME_ENTRY_HEADERS: string[] = [
  'id',
  'repSlug',
  'repName',
  'date',
  'clockIn',
  'clockOut',
  'breakStart',
  'breakEnd',
  'totalHours',
  'breakHours',
  'netHours',
  'jobId',
  'customerName',
  'address',
  'category',
  'notes',
  'status',
  'approvedBy',
  'approvedAt',
  'location',      // JSON {lat, lng}
  'createdAt',
  'updatedAt',
];

function parseNumber(raw: string): number {
  if (!raw) return 0;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

function parseLocation(raw: string): { lat: number; lng: number } | undefined {
  if (!raw) return undefined;
  try {
    const v = JSON.parse(raw);
    if (typeof v?.lat === 'number' && typeof v?.lng === 'number') {
      return { lat: v.lat, lng: v.lng };
    }
  } catch {
    // ignore
  }
  return undefined;
}

function rowToEntry(row: Record<string, string>): TimeEntry {
  const entry: TimeEntry = {
    id: row.id || '',
    repSlug: row.repSlug || '',
    repName: row.repName || '',
    date: row.date || '',
    clockIn: row.clockIn || '',
    totalHours: parseNumber(row.totalHours),
    breakHours: parseNumber(row.breakHours),
    netHours: parseNumber(row.netHours),
    category: (row.category as TimeEntry['category']) || 'office',
    notes: row.notes || '',
    status: (row.status as TimeEntry['status']) || 'active',
    createdAt: row.createdAt || '',
    updatedAt: row.updatedAt || '',
  };
  if (row.clockOut) entry.clockOut = row.clockOut;
  if (row.breakStart) entry.breakStart = row.breakStart;
  if (row.breakEnd) entry.breakEnd = row.breakEnd;
  if (row.jobId) entry.jobId = row.jobId;
  if (row.customerName) entry.customerName = row.customerName;
  if (row.address) entry.address = row.address;
  if (row.approvedBy) entry.approvedBy = row.approvedBy;
  if (row.approvedAt) entry.approvedAt = row.approvedAt;
  const loc = parseLocation(row.location);
  if (loc) entry.location = loc;
  return entry;
}

function entryToRow(entry: TimeEntry): Record<string, unknown> {
  return {
    id: entry.id,
    repSlug: entry.repSlug,
    repName: entry.repName,
    date: entry.date,
    clockIn: entry.clockIn,
    clockOut: entry.clockOut || '',
    breakStart: entry.breakStart || '',
    breakEnd: entry.breakEnd || '',
    totalHours: entry.totalHours,
    breakHours: entry.breakHours,
    netHours: entry.netHours,
    jobId: entry.jobId || '',
    customerName: entry.customerName || '',
    address: entry.address || '',
    category: entry.category,
    notes: entry.notes || '',
    status: entry.status,
    approvedBy: entry.approvedBy || '',
    approvedAt: entry.approvedAt || '',
    location: entry.location ? JSON.stringify(entry.location) : '',
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function generateId(): string {
  return crypto.randomBytes(6).toString('hex');
}

function calcHoursBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.round((ms / 3600000) * 100) / 100); // 2 decimal places
}

function getDateString(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  return getDateString(d.toISOString());
}

function getWeekEnd(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  d.setDate(d.getDate() + (6 - day));
  return getDateString(d.toISOString());
}

// =============================================================================
// SERVICE
// =============================================================================

class TimeTrackingService {
  // 60-second in-memory cache
  private cache: TimeEntry[] | null = null;
  private cacheExpiresAt = 0;
  private readonly CACHE_TTL_MS = 60_000;

  private async loadFromSheet(): Promise<TimeEntry[]> {
    const rows = await googleSheetsService.getGenericRows(
      SHEET_NAMES.TIME_ENTRIES,
      TIME_ENTRY_HEADERS
    );
    return rows.map(rowToEntry);
  }

  private async loadCached(): Promise<TimeEntry[]> {
    if (this.cache && Date.now() < this.cacheExpiresAt) {
      return this.cache;
    }
    this.cache = await this.loadFromSheet();
    this.cacheExpiresAt = Date.now() + this.CACHE_TTL_MS;
    return this.cache;
  }

  private invalidateCache(): void {
    this.cache = null;
    this.cacheExpiresAt = 0;
  }

  private async persistEntry(entry: TimeEntry): Promise<void> {
    await googleSheetsService.upsertGenericRow(
      SHEET_NAMES.TIME_ENTRIES,
      TIME_ENTRY_HEADERS,
      'id',
      entryToRow(entry)
    );
    this.invalidateCache();
  }

  /**
   * Clock in a rep. Fails if they already have an active entry.
   */
  async clockIn(
    repSlug: string,
    repName: string,
    category: TimeEntry['category'],
    notes?: string,
    jobId?: string,
    location?: { lat: number; lng: number }
  ): Promise<TimeEntry> {
    const entries = await this.loadCached();

    // Check for existing active entry
    const active = entries.find(
      (e) => e.repSlug === repSlug && e.status === 'active'
    );
    if (active) {
      throw new Error(`${repName} is already clocked in since ${active.clockIn}`);
    }

    const now = new Date().toISOString();
    const entry: TimeEntry = {
      id: generateId(),
      repSlug,
      repName,
      date: getDateString(now),
      clockIn: now,
      totalHours: 0,
      breakHours: 0,
      netHours: 0,
      jobId,
      category,
      notes: notes || '',
      status: 'active',
      location,
      createdAt: now,
      updatedAt: now,
    };

    await this.persistEntry(entry);
    return entry;
  }

  /**
   * Clock out. Calculates total hours and net hours.
   */
  async clockOut(entryId: string): Promise<TimeEntry> {
    const entries = await this.loadCached();
    const existing = entries.find((e) => e.id === entryId);
    if (!existing) throw new Error(`Time entry ${entryId} not found`);
    if (existing.status !== 'active') throw new Error('Entry is not active');

    const now = new Date().toISOString();
    const entry: TimeEntry = { ...existing };

    // End any ongoing break
    if (entry.breakStart && !entry.breakEnd) {
      entry.breakEnd = now;
      entry.breakHours += calcHoursBetween(entry.breakStart, entry.breakEnd);
    }

    entry.clockOut = now;
    entry.totalHours = calcHoursBetween(entry.clockIn, now);
    entry.netHours = Math.max(0, Math.round((entry.totalHours - entry.breakHours) * 100) / 100);
    entry.status = 'completed';
    entry.updatedAt = now;

    await this.persistEntry(entry);
    return entry;
  }

  /**
   * Start a break on an active entry.
   */
  async startBreak(entryId: string): Promise<TimeEntry> {
    const entries = await this.loadCached();
    const existing = entries.find((e) => e.id === entryId);
    if (!existing) throw new Error(`Time entry ${entryId} not found`);
    if (existing.status !== 'active') throw new Error('Entry is not active');
    if (existing.breakStart && !existing.breakEnd) throw new Error('Break already in progress');

    const entry: TimeEntry = { ...existing };
    entry.breakStart = new Date().toISOString();
    entry.breakEnd = undefined;
    entry.updatedAt = new Date().toISOString();

    await this.persistEntry(entry);
    return entry;
  }

  /**
   * End a break on an active entry.
   */
  async endBreak(entryId: string): Promise<TimeEntry> {
    const entries = await this.loadCached();
    const existing = entries.find((e) => e.id === entryId);
    if (!existing) throw new Error(`Time entry ${entryId} not found`);
    if (existing.status !== 'active') throw new Error('Entry is not active');
    if (!existing.breakStart || existing.breakEnd) throw new Error('No break in progress');

    const now = new Date().toISOString();
    const entry: TimeEntry = { ...existing };
    entry.breakEnd = now;
    entry.breakHours += calcHoursBetween(entry.breakStart!, now);
    entry.breakHours = Math.round(entry.breakHours * 100) / 100;
    entry.updatedAt = now;

    await this.persistEntry(entry);
    return entry;
  }

  /**
   * Get the currently active entry for a rep, or null.
   */
  async getActiveEntry(repSlug: string): Promise<TimeEntry | null> {
    const entries = await this.loadCached();
    return entries.find(
      (e) => e.repSlug === repSlug && e.status === 'active'
    ) || null;
  }

  /**
   * Get entries filtered by various criteria.
   */
  async getEntries(options?: {
    repSlug?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    category?: string;
  }): Promise<TimeEntry[]> {
    let entries = await this.loadCached();

    if (options?.repSlug) {
      entries = entries.filter((e) => e.repSlug === options.repSlug);
    }
    if (options?.date) {
      entries = entries.filter((e) => e.date === options.date);
    }
    if (options?.startDate) {
      entries = entries.filter((e) => e.date >= options.startDate!);
    }
    if (options?.endDate) {
      entries = entries.filter((e) => e.date <= options.endDate!);
    }
    if (options?.status) {
      entries = entries.filter((e) => e.status === options.status);
    }
    if (options?.category) {
      entries = entries.filter((e) => e.category === options.category);
    }

    // Sort by date desc, then clockIn desc
    entries = [...entries].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.clockIn.localeCompare(a.clockIn);
    });

    return entries;
  }

  /**
   * Update an entry's notes, category, or job info.
   */
  async updateEntry(entryId: string, updates: {
    notes?: string;
    category?: TimeEntry['category'];
    jobId?: string;
    customerName?: string;
    address?: string;
  }): Promise<TimeEntry> {
    const entries = await this.loadCached();
    const existing = entries.find((e) => e.id === entryId);
    if (!existing) throw new Error(`Time entry ${entryId} not found`);

    const entry: TimeEntry = { ...existing };
    if (updates.notes !== undefined) entry.notes = updates.notes;
    if (updates.category !== undefined) entry.category = updates.category;
    if (updates.jobId !== undefined) entry.jobId = updates.jobId;
    if (updates.customerName !== undefined) entry.customerName = updates.customerName;
    if (updates.address !== undefined) entry.address = updates.address;
    entry.updatedAt = new Date().toISOString();

    await this.persistEntry(entry);
    return entry;
  }

  /**
   * Delete an entry (only allowed if it's from today and not approved).
   */
  async deleteEntry(entryId: string): Promise<void> {
    const entries = await this.loadCached();
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) throw new Error(`Time entry ${entryId} not found`);

    const today = getDateString(new Date().toISOString());
    if (entry.date !== today) {
      throw new Error('Can only delete entries from today');
    }
    if (entry.status === 'approved') {
      throw new Error('Cannot delete an approved entry');
    }

    await googleSheetsService.deleteGenericRow(
      SHEET_NAMES.TIME_ENTRIES,
      'id',
      entryId
    );
    this.invalidateCache();
  }

  /**
   * Build a timesheet summary for a rep over a date range.
   */
  async getTimesheetSummary(repSlug: string, startDate: string, endDate: string): Promise<TimesheetSummary> {
    const entries = await this.getEntries({ repSlug, startDate, endDate });

    const totalHours = entries.reduce((sum, e) => sum + e.netHours, 0);
    const roundedTotal = Math.round(totalHours * 100) / 100;
    const regularHours = Math.min(roundedTotal, REGULAR_HOURS_WEEKLY);
    const overtimeHours = Math.max(0, Math.round((roundedTotal - REGULAR_HOURS_WEEKLY) * 100) / 100);

    const uniqueDays = new Set(entries.map((e) => e.date));
    const daysWorked = uniqueDays.size;
    const avgHoursPerDay = daysWorked > 0 ? Math.round((roundedTotal / daysWorked) * 100) / 100 : 0;

    // Determine status based on entries
    let status: TimesheetSummary['status'] = 'pending';
    if (entries.length > 0) {
      const allApproved = entries.every((e) => e.status === 'approved');
      const anyRejected = entries.some((e) => e.status === 'rejected');
      if (allApproved) status = 'approved';
      else if (anyRejected) status = 'rejected';
      else if (entries.every((e) => e.status === 'completed' || e.status === 'approved')) {
        status = 'submitted';
      }
    }

    const repName = entries.length > 0 ? entries[0].repName : repSlug;

    return {
      repSlug,
      repName,
      period: { start: startDate, end: endDate },
      totalHours: roundedTotal,
      regularHours,
      overtimeHours,
      daysWorked,
      avgHoursPerDay,
      entries,
      status,
    };
  }

  /**
   * Approve or reject a timesheet for a rep over a period.
   */
  async approveTimesheet(
    repSlug: string,
    period: { start: string; end: string },
    approvedBy: string,
    action: 'approve' | 'reject' = 'approve'
  ): Promise<void> {
    const entries = await this.loadCached();
    const now = new Date().toISOString();
    const toPersist: TimeEntry[] = [];

    for (const existing of entries) {
      if (
        existing.repSlug === repSlug &&
        existing.date >= period.start &&
        existing.date <= period.end &&
        (existing.status === 'completed' || existing.status === 'approved' || existing.status === 'rejected')
      ) {
        const updated: TimeEntry = {
          ...existing,
          status: action === 'approve' ? 'approved' : 'rejected',
          approvedBy,
          approvedAt: now,
          updatedAt: now,
        };
        toPersist.push(updated);
      }
    }

    for (const entry of toPersist) {
      await googleSheetsService.upsertGenericRow(
        SHEET_NAMES.TIME_ENTRIES,
        TIME_ENTRY_HEADERS,
        'id',
        entryToRow(entry)
      );
    }

    if (toPersist.length > 0) {
      this.invalidateCache();
    }
  }

  /**
   * Get timesheet summaries for all reps in a date range.
   */
  async getTeamTimesheets(startDate: string, endDate: string): Promise<TimesheetSummary[]> {
    const entries = await this.getEntries({ startDate, endDate });

    // Group by rep
    const repMap = new Map<string, TimeEntry[]>();
    entries.forEach((e) => {
      if (!repMap.has(e.repSlug)) repMap.set(e.repSlug, []);
      repMap.get(e.repSlug)!.push(e);
    });

    const summaries: TimesheetSummary[] = [];
    for (const repSlug of repMap.keys()) {
      summaries.push(await this.getTimesheetSummary(repSlug, startDate, endDate));
    }

    // Sort by rep name
    summaries.sort((a, b) => a.repName.localeCompare(b.repName));
    return summaries;
  }

  /**
   * Get daily hours for the current week for a rep.
   */
  async getWeeklyHours(repSlug: string): Promise<WeeklyHours> {
    const today = getDateString(new Date().toISOString());
    const start = getWeekStart(today);
    const end = getWeekEnd(today);
    const entries = await this.getEntries({ repSlug, startDate: start, endDate: end });

    const result: WeeklyHours = { sun: 0, mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, total: 0 };

    entries.forEach((e) => {
      const d = new Date(e.date + 'T00:00:00');
      const dayIdx = d.getDay();
      const dayName = DAY_NAMES[dayIdx];
      result[dayName] += e.netHours;
      result.total += e.netHours;
    });

    // Round all values
    for (const key of [...DAY_NAMES, 'total'] as const) {
      result[key] = Math.round(result[key] * 100) / 100;
    }

    return result;
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const timeTrackingService = new TimeTrackingService();
