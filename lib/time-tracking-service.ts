/**
 * RCRS Employee Time Tracking Service
 *
 * Manages clock in/out, breaks, timesheet summaries, and approvals.
 * Supports GPS location tracking, job linking, and overtime calculation.
 *
 * Data stored in data/time-entries.json
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

interface TimeEntryData {
  entries: TimeEntry[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

const REGULAR_HOURS_WEEKLY = 40;
const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

// =============================================================================
// DATA HELPERS
// =============================================================================

const DATA_FILE_PATH = path.join(process.cwd(), 'data', 'time-entries.json');

function readData(): TimeEntryData {
  try {
    if (fs.existsSync(DATA_FILE_PATH)) {
      const content = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('[TimeTrackingService] Error reading data:', error);
  }
  return { entries: [] };
}

function writeData(data: TimeEntryData): void {
  try {
    const dir = path.dirname(DATA_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('[TimeTrackingService] Error writing data:', error);
    throw new Error('Failed to save time entry data');
  }
}

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

  /**
   * Clock in a rep. Fails if they already have an active entry.
   */
  clockIn(
    repSlug: string,
    repName: string,
    category: TimeEntry['category'],
    notes?: string,
    jobId?: string,
    location?: { lat: number; lng: number }
  ): TimeEntry {
    const data = readData();

    // Check for existing active entry
    const active = data.entries.find(
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

    data.entries.push(entry);
    writeData(data);
    return entry;
  }

  /**
   * Clock out. Calculates total hours and net hours.
   */
  clockOut(entryId: string): TimeEntry {
    const data = readData();
    const entry = data.entries.find((e) => e.id === entryId);
    if (!entry) throw new Error(`Time entry ${entryId} not found`);
    if (entry.status !== 'active') throw new Error('Entry is not active');

    const now = new Date().toISOString();

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

    writeData(data);
    return entry;
  }

  /**
   * Start a break on an active entry.
   */
  startBreak(entryId: string): TimeEntry {
    const data = readData();
    const entry = data.entries.find((e) => e.id === entryId);
    if (!entry) throw new Error(`Time entry ${entryId} not found`);
    if (entry.status !== 'active') throw new Error('Entry is not active');
    if (entry.breakStart && !entry.breakEnd) throw new Error('Break already in progress');

    entry.breakStart = new Date().toISOString();
    entry.breakEnd = undefined;
    entry.updatedAt = new Date().toISOString();

    writeData(data);
    return entry;
  }

  /**
   * End a break on an active entry.
   */
  endBreak(entryId: string): TimeEntry {
    const data = readData();
    const entry = data.entries.find((e) => e.id === entryId);
    if (!entry) throw new Error(`Time entry ${entryId} not found`);
    if (entry.status !== 'active') throw new Error('Entry is not active');
    if (!entry.breakStart || entry.breakEnd) throw new Error('No break in progress');

    const now = new Date().toISOString();
    entry.breakEnd = now;
    entry.breakHours += calcHoursBetween(entry.breakStart, now);
    entry.breakHours = Math.round(entry.breakHours * 100) / 100;
    entry.updatedAt = now;

    writeData(data);
    return entry;
  }

  /**
   * Get the currently active entry for a rep, or null.
   */
  getActiveEntry(repSlug: string): TimeEntry | null {
    const data = readData();
    return data.entries.find(
      (e) => e.repSlug === repSlug && e.status === 'active'
    ) || null;
  }

  /**
   * Get entries filtered by various criteria.
   */
  getEntries(options?: {
    repSlug?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
    category?: string;
  }): TimeEntry[] {
    const data = readData();
    let entries = data.entries;

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
    entries.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.clockIn.localeCompare(a.clockIn);
    });

    return entries;
  }

  /**
   * Update an entry's notes, category, or job info.
   */
  updateEntry(entryId: string, updates: {
    notes?: string;
    category?: TimeEntry['category'];
    jobId?: string;
    customerName?: string;
    address?: string;
  }): TimeEntry {
    const data = readData();
    const entry = data.entries.find((e) => e.id === entryId);
    if (!entry) throw new Error(`Time entry ${entryId} not found`);

    if (updates.notes !== undefined) entry.notes = updates.notes;
    if (updates.category !== undefined) entry.category = updates.category;
    if (updates.jobId !== undefined) entry.jobId = updates.jobId;
    if (updates.customerName !== undefined) entry.customerName = updates.customerName;
    if (updates.address !== undefined) entry.address = updates.address;
    entry.updatedAt = new Date().toISOString();

    writeData(data);
    return entry;
  }

  /**
   * Delete an entry (only allowed if it's from today and not approved).
   */
  deleteEntry(entryId: string): void {
    const data = readData();
    const idx = data.entries.findIndex((e) => e.id === entryId);
    if (idx === -1) throw new Error(`Time entry ${entryId} not found`);

    const entry = data.entries[idx];
    const today = getDateString(new Date().toISOString());
    if (entry.date !== today) {
      throw new Error('Can only delete entries from today');
    }
    if (entry.status === 'approved') {
      throw new Error('Cannot delete an approved entry');
    }

    data.entries.splice(idx, 1);
    writeData(data);
  }

  /**
   * Build a timesheet summary for a rep over a date range.
   */
  getTimesheetSummary(repSlug: string, startDate: string, endDate: string): TimesheetSummary {
    const entries = this.getEntries({ repSlug, startDate, endDate });

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
  approveTimesheet(
    repSlug: string,
    period: { start: string; end: string },
    approvedBy: string,
    action: 'approve' | 'reject' = 'approve'
  ): void {
    const data = readData();
    const now = new Date().toISOString();
    let modified = false;

    data.entries.forEach((entry) => {
      if (
        entry.repSlug === repSlug &&
        entry.date >= period.start &&
        entry.date <= period.end &&
        (entry.status === 'completed' || entry.status === 'approved' || entry.status === 'rejected')
      ) {
        entry.status = action === 'approve' ? 'approved' : 'rejected';
        entry.approvedBy = approvedBy;
        entry.approvedAt = now;
        entry.updatedAt = now;
        modified = true;
      }
    });

    if (modified) {
      writeData(data);
    }
  }

  /**
   * Get timesheet summaries for all reps in a date range.
   */
  getTeamTimesheets(startDate: string, endDate: string): TimesheetSummary[] {
    const entries = this.getEntries({ startDate, endDate });

    // Group by rep
    const repMap = new Map<string, TimeEntry[]>();
    entries.forEach((e) => {
      if (!repMap.has(e.repSlug)) repMap.set(e.repSlug, []);
      repMap.get(e.repSlug)!.push(e);
    });

    const summaries: TimesheetSummary[] = [];
    repMap.forEach((repEntries, repSlug) => {
      summaries.push(this.getTimesheetSummary(repSlug, startDate, endDate));
    });

    // Sort by rep name
    summaries.sort((a, b) => a.repName.localeCompare(b.repName));
    return summaries;
  }

  /**
   * Get daily hours for the current week for a rep.
   */
  getWeeklyHours(repSlug: string): WeeklyHours {
    const today = getDateString(new Date().toISOString());
    const start = getWeekStart(today);
    const end = getWeekEnd(today);
    const entries = this.getEntries({ repSlug, startDate: start, endDate: end });

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
