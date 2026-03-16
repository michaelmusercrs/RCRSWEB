/**
 * RCRS Monday Meeting Numbers Service
 *
 * Reads/writes rep performance numbers tracked in weekly Monday meeting Google Sheets.
 * Each year has its own spreadsheet with ~52 tabs (one per Monday), named M.DD.YYYY.
 * Data is cached locally in data/meeting-numbers-{year}.json for fast reads.
 *
 * @author RCRS Development Team
 */

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// TYPES
// =============================================================================

export interface MeetingRecord {
  meetingDate: string;   // YYYY-MM-DD
  repName: string;
  inspected: number;
  damage: number;
  signed: number;
  repair: number;
  gutter: number;
  revenue: number;       // parsed from "$17,000.00" or plain number strings
  approved: number;
  goal: number;
  referrals: number;
  agents: number;
  present: string;       // raw value: '1', '0', '', 'E', 'EX', etc.
  homeShow: number;
}

/** Raw JSON record shape from the cached data files */
interface RawMeetingRecord {
  meetingDate: string;
  tabName: string;
  repName: string;
  Inspected: string;
  Damage: string;
  Signed: string;
  Repair: string;
  Gutter: string;
  '$$$$$': string;
  Approved: string;
  Goal: string;
  Referrals: string;
  Agents: string;
  Present: string;
  'Home Show': string;
}

export type MeetingMetric =
  | 'inspected'
  | 'damage'
  | 'signed'
  | 'repair'
  | 'gutter'
  | 'revenue'
  | 'approved'
  | 'goal'
  | 'referrals'
  | 'agents'
  | 'homeShow';

/** Column display names - MUST match the Google Sheet headers exactly */
export const MEETING_COLUMNS = {
  inspected: 'Inspected',
  damage: 'Damage',
  signed: 'Signed',
  repair: 'Repair',
  gutter: 'Gutter',
  revenue: '$$$$$',
  approved: 'Approved',
  goal: 'Goal',
  referrals: 'Referrals',
  agents: 'Agents',
  present: 'Present',
  homeShow: 'Home Show',
} as const;

export const METRIC_KEYS: MeetingMetric[] = [
  'inspected',
  'damage',
  'signed',
  'repair',
  'gutter',
  'revenue',
  'approved',
  'goal',
  'referrals',
  'agents',
  'homeShow',
];

/** All sheet headers in column order (A through M) */
const SHEET_HEADERS = [
  'Rep',
  'Inspected',
  'Damage',
  'Signed',
  'Repair',
  'Gutter',
  '$$$$$',
  'Approved',
  'Goal',
  'Referrals',
  'Agents',
  'Present',
  'Home Show',
];

export interface LeaderboardEntry {
  rank: number;
  repName: string;
  value: number;        // value of the ranked metric
  totals: Record<MeetingMetric, number>;
  weeksPresent: number;
}

export interface RepStats {
  repName: string;
  totalWeeks: number;
  totals: Record<MeetingMetric, number>;
  averages: Record<MeetingMetric, number>;
  ratios: {
    revenuePerInspection: number;
    signedPerDamage: number;
    damagePerInspection: number;
    approvalRate: number;       // approved / signed
    referralsPerWeek: number;
    agentsPerWeek: number;
  };
  attendance: AttendanceInfo;
}

export interface AttendanceInfo {
  totalWeeks: number;
  excusedWeeks: number;
  presentWeeks: number;
  absentWeeks: number;
  attendanceRate: number;   // presentWeeks / (totalWeeks - excusedWeeks)
}

export interface DateRangeOptions {
  startDate?: string;   // YYYY-MM-DD
  endDate?: string;     // YYYY-MM-DD
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const DEFAULT_SHEET_ID = '1tEbMVUrvrRIkptISumvIrcgUhSWN5X2ldYro9ADTXF0';

function getSheetId(): string {
  return process.env.MONDAY_MEETING_SHEET_ID || DEFAULT_SHEET_ID;
}

function getDataDir(): string {
  return path.join(process.cwd(), 'data');
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Parse a dollar/number string into a float.
 * Handles: "$17,000.00", "17000", "17,000", "$500", "", undefined
 */
function parseDollarValue(val: string | undefined | null): number {
  if (!val || val.trim() === '') return 0;
  const cleaned = val.replace(/[$,]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Parse a numeric string into a number. Empty/invalid returns 0.
 */
function parseNum(val: string | undefined | null): number {
  if (!val || val.trim() === '') return 0;
  const num = parseFloat(val.replace(/,/g, '').trim());
  return isNaN(num) ? 0 : num;
}

/**
 * Convert a raw JSON record to a typed MeetingRecord.
 */
function parseRawRecord(raw: RawMeetingRecord): MeetingRecord {
  return {
    meetingDate: raw.meetingDate,
    repName: raw.repName,
    inspected: parseNum(raw.Inspected),
    damage: parseNum(raw.Damage),
    signed: parseNum(raw.Signed),
    repair: parseNum(raw.Repair),
    gutter: parseNum(raw.Gutter),
    revenue: parseDollarValue(raw['$$$$$']),
    approved: parseNum(raw.Approved),
    goal: parseNum(raw.Goal),
    referrals: parseNum(raw.Referrals),
    agents: parseNum(raw.Agents),
    present: (raw.Present || '').trim(),
    homeShow: parseNum(raw['Home Show']),
  };
}

/**
 * Convert a Date or YYYY-MM-DD string to the tab name format: M.D.YYYY
 * No leading zeros on month or day.
 */
function dateToTabName(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const year = d.getFullYear();
  return `${month}.${day}.${year}`;
}

/**
 * Convert a tab name (M.D.YYYY) to YYYY-MM-DD.
 */
function tabNameToDate(tabName: string): string | null {
  const parts = tabName.split('.');
  if (parts.length !== 3) return null;
  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  if (isNaN(month) || isNaN(day) || isNaN(year)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Filter records by optional date range.
 */
function filterByDateRange(records: MeetingRecord[], options: DateRangeOptions): MeetingRecord[] {
  let filtered = records;
  if (options.startDate) {
    filtered = filtered.filter(r => r.meetingDate >= options.startDate!);
  }
  if (options.endDate) {
    filtered = filtered.filter(r => r.meetingDate <= options.endDate!);
  }
  return filtered;
}

/**
 * Safe division that returns 0 instead of NaN/Infinity.
 */
function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Sum a specific metric across records.
 */
function sumMetric(records: MeetingRecord[], metric: MeetingMetric): number {
  return records.reduce((sum, r) => sum + r[metric], 0);
}

/**
 * Build a totals object for all metrics from a set of records.
 */
function buildTotals(records: MeetingRecord[]): Record<MeetingMetric, number> {
  const totals = {} as Record<MeetingMetric, number>;
  for (const key of METRIC_KEYS) {
    totals[key] = sumMetric(records, key);
  }
  return totals;
}

// =============================================================================
// SERVICE CLASS
// =============================================================================

class MeetingNumbersService {
  private cache: MeetingRecord[] = [];
  private cacheLoaded = false;
  private lastCacheLoad = 0;
  private cacheTTL = 30_000; // 30 seconds in-memory TTL

  // ---------------------------------------------------------------------------
  // DATA LOADING
  // ---------------------------------------------------------------------------

  /**
   * Load all meeting data from data/meeting-numbers-*.json files.
   * Parses raw records into typed MeetingRecord[]. Cached in memory.
   */
  loadAllData(): MeetingRecord[] {
    const now = Date.now();
    if (this.cacheLoaded && now - this.lastCacheLoad < this.cacheTTL) {
      return this.cache;
    }

    const dataDir = getDataDir();
    const allRecords: MeetingRecord[] = [];

    try {
      if (!fs.existsSync(dataDir)) {
        console.warn('[MeetingNumbers] Data directory not found:', dataDir);
        this.cache = [];
        this.cacheLoaded = true;
        this.lastCacheLoad = now;
        return [];
      }

      const files = fs.readdirSync(dataDir).filter(
        f => f.startsWith('meeting-numbers-') && f.endsWith('.json')
      );

      for (const file of files) {
        try {
          // Use readFileSync to avoid Next.js import caching
          const filePath = path.join(dataDir, file);
          const raw = fs.readFileSync(filePath, 'utf-8');
          const records: RawMeetingRecord[] = JSON.parse(raw);

          for (const rec of records) {
            // Skip Total rows
            if (rec.repName?.toLowerCase() === 'total') continue;
            // Skip empty rep names
            if (!rec.repName || rec.repName.trim() === '') continue;
            allRecords.push(parseRawRecord(rec));
          }
        } catch (err) {
          console.error(`[MeetingNumbers] Error reading ${file}:`, err);
        }
      }
    } catch (err) {
      console.error('[MeetingNumbers] Error loading data:', err);
    }

    // Sort by date then rep name
    allRecords.sort((a, b) => {
      const dateCmp = a.meetingDate.localeCompare(b.meetingDate);
      if (dateCmp !== 0) return dateCmp;
      return a.repName.localeCompare(b.repName);
    });

    this.cache = allRecords;
    this.cacheLoaded = true;
    this.lastCacheLoad = now;
    return allRecords;
  }

  /**
   * Force cache refresh on next access.
   */
  invalidateCache(): void {
    this.cacheLoaded = false;
    this.lastCacheLoad = 0;
  }

  // ---------------------------------------------------------------------------
  // LEADERBOARD
  // ---------------------------------------------------------------------------

  /**
   * Get a leaderboard ranked by the specified metric.
   * Groups by rep, sums the metric, sorts descending.
   * Returns ranked entries with all metric totals.
   */
  getLeaderboard(
    metric: MeetingMetric,
    options: DateRangeOptions = {}
  ): LeaderboardEntry[] {
    const data = this.loadAllData();
    const filtered = filterByDateRange(data, options);

    // Group by rep
    const byRep = new Map<string, MeetingRecord[]>();
    for (const rec of filtered) {
      const existing = byRep.get(rec.repName) || [];
      existing.push(rec);
      byRep.set(rec.repName, existing);
    }

    // Build entries
    const entries: Omit<LeaderboardEntry, 'rank'>[] = [];
    byRep.forEach((records, repName) => {
      const totals = buildTotals(records);
      const weeksPresent = records.filter(r => r.present === '1').length;
      entries.push({
        repName,
        value: totals[metric],
        totals,
        weeksPresent,
      });
    });

    // Sort descending by metric value, then alphabetically by name for ties
    entries.sort((a, b) => {
      const diff = b.value - a.value;
      if (diff !== 0) return diff;
      return a.repName.localeCompare(b.repName);
    });

    // Assign ranks (tied values get the same rank)
    const ranked: LeaderboardEntry[] = [];
    let currentRank = 1;
    for (let i = 0; i < entries.length; i++) {
      if (i > 0 && entries[i].value < entries[i - 1].value) {
        currentRank = i + 1;
      }
      ranked.push({ ...entries[i], rank: currentRank });
    }

    return ranked;
  }

  // ---------------------------------------------------------------------------
  // REP STATS
  // ---------------------------------------------------------------------------

  /**
   * Get aggregated stats for one rep: totals, weekly averages, key ratios,
   * and attendance info.
   */
  getRepStats(repName: string, options: DateRangeOptions = {}): RepStats | null {
    const data = this.loadAllData();
    const filtered = filterByDateRange(data, options);
    const repRecords = filtered.filter(
      r => r.repName.toLowerCase() === repName.toLowerCase()
    );

    if (repRecords.length === 0) return null;

    const totals = buildTotals(repRecords);
    const totalWeeks = repRecords.length;

    // Averages per week
    const averages = {} as Record<MeetingMetric, number>;
    for (const key of METRIC_KEYS) {
      averages[key] = totalWeeks > 0 ? Math.round((totals[key] / totalWeeks) * 100) / 100 : 0;
    }

    const attendance = this.calculateAttendance(repName, options);

    return {
      repName: repRecords[0].repName, // preserve original casing
      totalWeeks,
      totals,
      averages,
      ratios: {
        revenuePerInspection: safeDivide(totals.revenue, totals.inspected),
        signedPerDamage: safeDivide(totals.signed, totals.damage),
        damagePerInspection: safeDivide(totals.damage, totals.inspected),
        approvalRate: safeDivide(totals.approved, totals.signed),
        referralsPerWeek: safeDivide(totals.referrals, totalWeeks),
        agentsPerWeek: safeDivide(totals.agents, totalWeeks),
      },
      attendance,
    };
  }

  // ---------------------------------------------------------------------------
  // ATTENDANCE
  // ---------------------------------------------------------------------------

  /**
   * Calculate attendance for a rep.
   *
   * Present column values:
   *   '1'                        -> present (counts toward attended)
   *   '0', '', blank, 'absent'   -> absent
   *   'E', 'EX', 'excused'       -> excluded from total (case-insensitive)
   *
   * attendanceRate = presentWeeks / (totalWeeks - excusedWeeks)
   */
  calculateAttendance(repName: string, options: DateRangeOptions = {}): AttendanceInfo {
    const data = this.loadAllData();
    const filtered = filterByDateRange(data, options);
    const repRecords = filtered.filter(
      r => r.repName.toLowerCase() === repName.toLowerCase()
    );

    let presentWeeks = 0;
    let excusedWeeks = 0;
    let absentWeeks = 0;
    const totalWeeks = repRecords.length;

    for (const rec of repRecords) {
      const val = rec.present.toLowerCase().trim();
      if (val === 'e' || val === 'ex' || val === 'excused') {
        excusedWeeks++;
      } else if (val === '1') {
        presentWeeks++;
      } else {
        // '0', '', 'absent', or any other value = absent
        absentWeeks++;
      }
    }

    const eligibleWeeks = totalWeeks - excusedWeeks;
    const attendanceRate = eligibleWeeks > 0
      ? Math.round((presentWeeks / eligibleWeeks) * 10000) / 10000
      : 0;

    return {
      totalWeeks,
      excusedWeeks,
      presentWeeks,
      absentWeeks,
      attendanceRate,
    };
  }

  // ---------------------------------------------------------------------------
  // SYNC FROM GOOGLE SHEET
  // ---------------------------------------------------------------------------

  /**
   * Read ALL tabs from the Google Sheet for the given year, parse cell data,
   * and save to data/meeting-numbers-{year}.json.
   *
   * Uses google-spreadsheet + google-auth-library with the same auth pattern
   * as lib/google-sheets-service.ts.
   */
  async syncFromSheet(year?: number): Promise<{ success: boolean; recordCount: number; error?: string }> {
    const targetYear = year || new Date().getFullYear();

    const privateKey = process.env.GOOGLE_PRIVATE_KEY
      ?.replace(/\\n/g, '\n')
      ?.replace(/\r\n/g, '\n');

    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

    if (!email || !privateKey) {
      return {
        success: false,
        recordCount: 0,
        error: 'Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY environment variables',
      };
    }

    const auth = new JWT({
      email,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheetId = getSheetId();

    try {
      const doc = new GoogleSpreadsheet(sheetId, auth);
      await doc.loadInfo();

      const allRecords: RawMeetingRecord[] = [];

      // Iterate all sheets (tabs)
      for (const sheet of doc.sheetsByIndex) {
        const tabName = sheet.title;
        const meetingDate = tabNameToDate(tabName);

        // Skip tabs that don't match M.D.YYYY format or wrong year
        if (!meetingDate) continue;
        if (!meetingDate.startsWith(String(targetYear))) continue;

        try {
          // Load all cells in the used range
          await sheet.loadCells();

          const rowCount = sheet.rowCount;
          const colCount = Math.min(sheet.columnCount, 13); // A through M

          // Row 0 is the header row - find the header mapping
          // Column A = Rep name, B-M = metrics
          // We expect headers in row 0: Rep, Inspected, Damage, Signed, ...
          // But some sheets may have the rep name in A with no "Rep" header

          // Read header row to determine column mapping
          const headerMap: Record<number, string> = {};
          for (let col = 0; col < colCount; col++) {
            const cell = sheet.getCell(0, col);
            const val = String(cell.value || '').trim();
            if (val) headerMap[col] = val;
          }

          // Determine if row 0 is a header or data
          // If column 0 header matches a known header name, it's a header row
          const knownHeaders = ['rep', 'name', 'inspected', 'damage', 'signed'];
          const firstCellLower = (headerMap[0] || '').toLowerCase();
          const hasHeaderRow = knownHeaders.includes(firstCellLower) ||
            Object.values(headerMap).some(h => h.toLowerCase() === 'inspected');

          // Build column index for metrics
          // Default layout: A=Rep, B=Inspected, C=Damage, D=Signed, E=Repair,
          //   F=Gutter, G=$$$$$, H=Approved, I=Goal, J=Referrals, K=Agents,
          //   L=Present, M=Home Show
          const defaultMetricColumns: Record<number, string> = {
            1: 'Inspected',
            2: 'Damage',
            3: 'Signed',
            4: 'Repair',
            5: 'Gutter',
            6: '$$$$$',
            7: 'Approved',
            8: 'Goal',
            9: 'Referrals',
            10: 'Agents',
            11: 'Present',
            12: 'Home Show',
          };

          // If we have a header row, use it for mapping; otherwise use defaults
          const metricColumns: Record<number, string> = hasHeaderRow ? {} : defaultMetricColumns;
          if (hasHeaderRow) {
            for (let col = 1; col < colCount; col++) {
              if (headerMap[col]) {
                metricColumns[col] = headerMap[col];
              }
            }
          }

          const startRow = hasHeaderRow ? 1 : 0;

          for (let row = startRow; row < rowCount; row++) {
            const repCell = sheet.getCell(row, 0);
            const repName = String(repCell.value || '').trim();

            // Skip empty rows and the Total row
            if (!repName) continue;
            if (repName.toLowerCase() === 'total') continue;

            const record: RawMeetingRecord = {
              meetingDate,
              tabName,
              repName,
              Inspected: '',
              Damage: '',
              Signed: '',
              Repair: '',
              Gutter: '',
              '$$$$$': '',
              Approved: '',
              Goal: '',
              Referrals: '',
              Agents: '',
              Present: '',
              'Home Show': '',
            };

            // Map cell values to record fields
            for (let col = 1; col < colCount; col++) {
              const header = metricColumns[col];
              if (!header) continue;

              const cell = sheet.getCell(row, col);
              let val = '';

              if (cell.value !== null && cell.value !== undefined) {
                // Use formattedValue for dollar amounts to preserve formatting,
                // otherwise use raw value
                if (header === '$$$$$' && cell.formattedValue) {
                  // Strip dollar formatting and store as plain number
                  val = String(parseDollarValue(cell.formattedValue));
                  if (val === '0' && cell.formattedValue.trim() === '') val = '';
                } else {
                  val = String(cell.value);
                }
              }

              // Map header to record field
              const headerLower = header.toLowerCase();
              if (headerLower === 'inspected') record.Inspected = val;
              else if (headerLower === 'damage') record.Damage = val;
              else if (headerLower === 'signed') record.Signed = val;
              else if (headerLower === 'repair') record.Repair = val;
              else if (headerLower === 'gutter') record.Gutter = val;
              else if (header === '$$$$$' || headerLower === 'revenue') record['$$$$$'] = val;
              else if (headerLower === 'approved') record.Approved = val;
              else if (headerLower === 'goal') record.Goal = val;
              else if (headerLower === 'referrals') record.Referrals = val;
              else if (headerLower === 'agents') record.Agents = val;
              else if (headerLower === 'present') record.Present = val;
              else if (headerLower === 'home show') record['Home Show'] = val;
            }

            allRecords.push(record);
          }
        } catch (tabErr) {
          console.error(`[MeetingNumbers] Error reading tab "${tabName}":`, tabErr);
          // Continue with other tabs
        }
      }

      // Sort by date, then rep name
      allRecords.sort((a, b) => {
        const dateCmp = a.meetingDate.localeCompare(b.meetingDate);
        if (dateCmp !== 0) return dateCmp;
        return a.repName.localeCompare(b.repName);
      });

      // Save to JSON file
      const dataDir = getDataDir();
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const outPath = path.join(dataDir, `meeting-numbers-${targetYear}.json`);
      fs.writeFileSync(outPath, JSON.stringify(allRecords, null, 2), 'utf-8');

      // Invalidate in-memory cache so next read picks up fresh data
      this.invalidateCache();

      console.log(`[MeetingNumbers] Synced ${allRecords.length} records for ${targetYear} -> ${outPath}`);

      return { success: true, recordCount: allRecords.length };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[MeetingNumbers] syncFromSheet failed:', message);
      return { success: false, recordCount: 0, error: message };
    }
  }

  // ---------------------------------------------------------------------------
  // SUBMIT NUMBERS (write to sheet + update local cache)
  // ---------------------------------------------------------------------------

  /**
   * Write a rep's numbers to the Google Sheet for a given meeting date.
   * Finds or creates the tab, finds or adds the rep's row, writes values.
   * Also updates the local JSON cache file.
   */
  async submitNumbers(
    repName: string,
    meetingDate: string,
    data: Partial<Record<MeetingMetric | 'present', number | string>>
  ): Promise<{ success: boolean; error?: string }> {
    const privateKey = process.env.GOOGLE_PRIVATE_KEY
      ?.replace(/\\n/g, '\n')
      ?.replace(/\r\n/g, '\n');
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

    if (!email || !privateKey) {
      return { success: false, error: 'Missing Google auth environment variables' };
    }

    const auth = new JWT({
      email,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheetId = getSheetId();
    const tabName = dateToTabName(meetingDate);

    try {
      const doc = new GoogleSpreadsheet(sheetId, auth);
      await doc.loadInfo();

      // Find or create the tab
      let sheet = doc.sheetsByTitle[tabName];
      if (!sheet) {
        sheet = await doc.addSheet({
          title: tabName,
          headerValues: SHEET_HEADERS,
          gridProperties: { columnCount: SHEET_HEADERS.length + 2 },
        });
      }

      // Load cells to find or add the rep's row
      await sheet.loadCells();

      const rowCount = sheet.rowCount;
      let repRow = -1;
      let lastDataRow = 0; // track last row with data
      let totalRow = -1;

      // Scan column A for the rep name and the Total row
      for (let row = 0; row < rowCount; row++) {
        const cell = sheet.getCell(row, 0);
        const val = String(cell.value || '').trim();
        if (val.toLowerCase() === repName.toLowerCase()) {
          repRow = row;
        }
        if (val.toLowerCase() === 'total') {
          totalRow = row;
        }
        if (val && val.toLowerCase() !== 'total') {
          lastDataRow = row;
        }
      }

      // If rep not found, add a new row
      if (repRow === -1) {
        // Insert before Total row, or after last data row
        if (totalRow > 0) {
          // We need to insert a row before the Total row.
          // Since loadCells doesn't support insertions directly,
          // we'll add the rep after lastDataRow and shift Total down if needed.
          repRow = totalRow;
          // Shift total row down by 1
          if (repRow >= sheet.rowCount - 1) {
            await sheet.resize({ rowCount: sheet.rowCount + 1, columnCount: sheet.columnCount });
            await sheet.loadCells();
          }
          // Copy Total row content down
          for (let col = 0; col < Math.min(sheet.columnCount, 13); col++) {
            const srcCell = sheet.getCell(totalRow, col);
            const dstCell = sheet.getCell(totalRow + 1, col);
            if (srcCell.formula) {
              dstCell.formula = srcCell.formula;
            } else {
              dstCell.value = srcCell.value;
            }
          }
          // Clear the old total row and write rep name
          const repCell = sheet.getCell(repRow, 0);
          repCell.value = repName;
          // Clear metric cells in the rep row
          for (let col = 1; col < Math.min(sheet.columnCount, 13); col++) {
            const cell = sheet.getCell(repRow, col);
            cell.value = '';
          }
        } else {
          // No total row - just add after last data
          repRow = lastDataRow + 1;
          if (repRow >= sheet.rowCount) {
            await sheet.resize({ rowCount: sheet.rowCount + 2, columnCount: sheet.columnCount });
            await sheet.loadCells();
          }
          const repCell = sheet.getCell(repRow, 0);
          repCell.value = repName;
        }
      }

      // Map metric keys to column indices (1-indexed matching SHEET_HEADERS)
      const metricToCol: Record<string, number> = {
        inspected: 1,
        damage: 2,
        signed: 3,
        repair: 4,
        gutter: 5,
        revenue: 6,
        approved: 7,
        goal: 8,
        referrals: 9,
        agents: 10,
        present: 11,
        homeShow: 12,
      };

      // Write the values
      for (const [key, value] of Object.entries(data)) {
        const col = metricToCol[key];
        if (col === undefined) continue;
        const cell = sheet.getCell(repRow, col);
        cell.value = value !== undefined && value !== null ? value : '';
      }

      // Save all cell changes
      await sheet.saveUpdatedCells();

      // Update local JSON cache
      this.updateLocalCache(repName, meetingDate, tabName, data);

      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[MeetingNumbers] submitNumbers failed:', message);
      return { success: false, error: message };
    }
  }

  /**
   * Update the local JSON cache file after a submit.
   */
  private updateLocalCache(
    repName: string,
    meetingDate: string,
    tabName: string,
    data: Partial<Record<MeetingMetric | 'present', number | string>>
  ): void {
    const year = meetingDate.split('-')[0];
    const filePath = path.join(getDataDir(), `meeting-numbers-${year}.json`);

    try {
      let records: RawMeetingRecord[] = [];
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        records = JSON.parse(raw);
      }

      // Find existing record for this rep + date
      let existing = records.find(
        r => r.repName.toLowerCase() === repName.toLowerCase() &&
             r.meetingDate === meetingDate
      );

      if (!existing) {
        existing = {
          meetingDate,
          tabName,
          repName,
          Inspected: '',
          Damage: '',
          Signed: '',
          Repair: '',
          Gutter: '',
          '$$$$$': '',
          Approved: '',
          Goal: '',
          Referrals: '',
          Agents: '',
          Present: '',
          'Home Show': '',
        };
        records.push(existing);
      }

      // Map metric keys to raw record fields
      const keyToField: Record<string, keyof RawMeetingRecord> = {
        inspected: 'Inspected',
        damage: 'Damage',
        signed: 'Signed',
        repair: 'Repair',
        gutter: 'Gutter',
        revenue: '$$$$$',
        approved: 'Approved',
        goal: 'Goal',
        referrals: 'Referrals',
        agents: 'Agents',
        present: 'Present',
        homeShow: 'Home Show',
      };

      for (const [key, value] of Object.entries(data)) {
        const field = keyToField[key];
        if (field && field !== 'meetingDate' && field !== 'tabName' && field !== 'repName') {
          (existing as unknown as Record<string, unknown>)[field] = value !== undefined && value !== null
            ? String(value)
            : '';
        }
      }

      // Sort and save
      records.sort((a, b) => {
        const dateCmp = a.meetingDate.localeCompare(b.meetingDate);
        if (dateCmp !== 0) return dateCmp;
        return a.repName.localeCompare(b.repName);
      });

      fs.writeFileSync(filePath, JSON.stringify(records, null, 2), 'utf-8');
      this.invalidateCache();
    } catch (err) {
      console.error('[MeetingNumbers] Failed to update local cache:', err);
    }
  }

  // ---------------------------------------------------------------------------
  // UTILITY METHODS
  // ---------------------------------------------------------------------------

  /**
   * Returns a sorted list of unique rep names across all loaded data.
   */
  getAllReps(): string[] {
    const data = this.loadAllData();
    const reps = new Set<string>();
    for (const rec of data) {
      reps.add(rec.repName);
    }
    return Array.from(reps).sort((a, b) => a.localeCompare(b));
  }

  /**
   * Returns all unique meeting dates (YYYY-MM-DD) that have data, sorted ascending.
   */
  getWeekDates(): string[] {
    const data = this.loadAllData();
    const dates = new Set<string>();
    for (const rec of data) {
      dates.add(rec.meetingDate);
    }
    return Array.from(dates).sort();
  }

  /**
   * Get records for a specific meeting date.
   */
  getByDate(meetingDate: string): MeetingRecord[] {
    const data = this.loadAllData();
    return data.filter(r => r.meetingDate === meetingDate);
  }

  /**
   * Get all records for a specific rep.
   */
  getByRep(repName: string, options: DateRangeOptions = {}): MeetingRecord[] {
    const data = this.loadAllData();
    const filtered = filterByDateRange(data, options);
    return filtered.filter(
      r => r.repName.toLowerCase() === repName.toLowerCase()
    );
  }

  /**
   * Get the most recent meeting date that has actual data (at least one non-zero metric).
   */
  getLatestMeetingDate(): string | null {
    const dates = this.getWeekDates();
    if (dates.length === 0) return null;

    // Walk backwards from the latest date to find one with actual data
    for (let i = dates.length - 1; i >= 0; i--) {
      const records = this.getByDate(dates[i]);
      const hasData = records.some(r =>
        r.inspected > 0 || r.damage > 0 || r.signed > 0 ||
        r.revenue > 0 || r.approved > 0 || r.referrals > 0
      );
      if (hasData) return dates[i];
    }

    return dates[dates.length - 1];
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const meetingNumbersService = new MeetingNumbersService();
