/**
 * RCRS Command Center - Sales & Commissions API
 *
 * Reads commission data from bundled JSON and provides comprehensive sales analytics.
 * Data source: data/commissions.json (4,199 transactions, $2.6M+ total)
 *
 * GET /api/command-center/sales
 * Query params:
 *   - period: 'week' | 'month' | 'year' | 'all' (default: 'all')
 *   - year: number (for filtering)
 *   - month: number (for filtering)
 *   - rep: string (optional, filter by rep name)
 */

import { NextRequest, NextResponse } from 'next/server';
import commissionsData from '@/data/commissions.json';

// ============================================================================
// TypeScript Types
// ============================================================================

interface CommissionEntry {
  salesRep: string;
  date: Date;
  amount: number;
  balance: number;
  dateString: string;
}

interface RepStats {
  name: string;
  totalCommissions: number;
  transactionCount: number;
  transactions: CommissionEntry[];
}

interface LeaderboardEntry {
  rank: number;
  name: string;
  totalCommissions: number;
  transactionCount: number;
  avgTransaction: number;
  percentOfTotal: number;
}

interface DateRange {
  start: string | null;
  end: string | null;
}

interface PeriodData {
  period: string;
  year?: number;
  month?: number;
  weekStart?: string;
  weekEnd?: string;
  totalCommissions: number;
  transactionCount: number;
  comparisonToPrevious?: {
    commissionChange: number;
    commissionChangePercent: number;
    transactionChange: number;
  };
}

interface SalesSummary {
  totalCommissions: number;
  transactionCount: number;
  dateRange: DateRange;
  avgTransactionValue: number;
  uniqueReps: number;
}

interface SalesApiResponse {
  success: boolean;
  data: {
    summary: SalesSummary;
    leaderboard: LeaderboardEntry[];
    periodData?: PeriodData;
    repDetail?: {
      name: string;
      totalCommissions: number;
      transactionCount: number;
      avgTransaction: number;
      recentTransactions: Array<{
        date: string;
        amount: number;
        balance: number;
      }>;
    };
  };
  cached: boolean;
  timestamp: string;
}

interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  timestamp: string;
}

type ValidPeriod = 'week' | 'month' | 'year' | 'all';

// ============================================================================
// Cache Implementation (5-minute TTL)
// ============================================================================

interface CacheEntry {
  data: CommissionEntry[];
  timestamp: number;
  rawRepData: Map<string, RepStats>;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let csvCache: CacheEntry | null = null;

function isCacheValid(): boolean {
  if (!csvCache) return false;
  return Date.now() - csvCache.timestamp < CACHE_TTL_MS;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse date string in MM/DD/YY or MM/DD/YYYY format
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const trimmed = dateStr.trim();
  const parts = trimmed.split('/');

  if (parts.length !== 3) return null;

  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  let year = parseInt(parts[2], 10);

  // Validate components
  if (isNaN(month) || isNaN(day) || isNaN(year)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  // Handle 2-digit year (YY format)
  if (year < 100) {
    // Assume 2000s for years 00-99
    year = 2000 + year;
  }

  // Validate year range (reasonable bounds for this data: 2019-2030)
  if (year < 2019 || year > 2030) return null;

  const date = new Date(year, month - 1, day);

  // Verify the date is valid (handles edge cases like Feb 30)
  if (date.getMonth() !== month - 1) return null;

  return date;
}

/**
 * Parse money string, removing $ and commas, handling negatives
 */
function parseMoney(value: string): number {
  if (!value || typeof value !== 'string') return 0;

  const cleaned = value.replace(/[$,]/g, '').trim();
  const num = parseFloat(cleaned);

  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

/**
 * Format date to ISO string (YYYY-MM-DD)
 */
function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Normalize sales rep name (handle double spaces, trim)
 */
function normalizeRepName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

/**
 * Get week boundaries for a given date
 */
function getWeekBoundaries(date: Date): { start: Date; end: Date } {
  const dayOfWeek = date.getDay();
  const start = new Date(date);
  start.setDate(date.getDate() - dayOfWeek);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

// ============================================================================
// JSON Data Loading
// ============================================================================

// Raw commission record from JSON file
interface RawCommissionRecord {
  salesRep: string;
  date: string;
  amount: number;
  balance: number;
}

function loadCommissionData(): CacheEntry {
  // Return cached data if valid
  if (isCacheValid() && csvCache) {
    return csvCache;
  }

  const rawData = commissionsData as RawCommissionRecord[];

  const entries: CommissionEntry[] = [];
  const repDataMap = new Map<string, RepStats>();
  let parseErrors = 0;

  for (const record of rawData) {
    const salesRep = normalizeRepName(record.salesRep);
    const date = parseDate(record.date);
    const amount = record.amount;
    const balance = record.balance;

    if (!date || !salesRep) {
      parseErrors++;
      continue;
    }

    const entry: CommissionEntry = {
      salesRep,
      date,
      amount,
      balance,
      dateString: record.date,
    };

    entries.push(entry);

    // Aggregate by rep
    if (!repDataMap.has(salesRep)) {
      repDataMap.set(salesRep, {
        name: salesRep,
        totalCommissions: 0,
        transactionCount: 0,
        transactions: [],
      });
    }

    const repStats = repDataMap.get(salesRep)!;
    repStats.totalCommissions += amount;
    repStats.transactionCount++;
    repStats.transactions.push(entry);
  }

  // Log parsing stats (for debugging)
  if (parseErrors > 0) {
    console.warn(`[Sales API] Skipped ${parseErrors} malformed rows during JSON parsing`);
  }

  // Sort entries by date
  entries.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Sort transactions within each rep by date
  for (const repStats of repDataMap.values()) {
    repStats.transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
    // Round total to 2 decimal places
    repStats.totalCommissions = Math.round(repStats.totalCommissions * 100) / 100;
  }

  // Update cache
  csvCache = {
    data: entries,
    timestamp: Date.now(),
    rawRepData: repDataMap,
  };

  return csvCache;
}

// ============================================================================
// Query Parameter Validation
// ============================================================================

function validatePeriod(value: string | null): ValidPeriod {
  const valid: ValidPeriod[] = ['week', 'month', 'year', 'all'];
  if (value && valid.includes(value as ValidPeriod)) {
    return value as ValidPeriod;
  }
  return 'all';
}

function validateYear(value: string | null): number | null {
  if (!value) return null;
  const num = parseInt(value, 10);
  if (isNaN(num) || num < 2019 || num > 2030) return null;
  return num;
}

function validateMonth(value: string | null): number | null {
  if (!value) return null;
  const num = parseInt(value, 10);
  if (isNaN(num) || num < 1 || num > 12) return null;
  return num;
}

// ============================================================================
// Data Filtering and Analysis
// ============================================================================

interface FilterOptions {
  period: ValidPeriod;
  year: number | null;
  month: number | null;
  rep: string | null;
}

function filterEntries(entries: CommissionEntry[], options: FilterOptions): CommissionEntry[] {
  const now = new Date();
  let filterStart: Date | null = null;
  let filterEnd: Date | null = null;

  const targetYear = options.year ?? now.getFullYear();
  const targetMonth = options.month ?? (now.getMonth() + 1);

  switch (options.period) {
    case 'week': {
      const { start, end } = getWeekBoundaries(now);
      filterStart = start;
      filterEnd = end;
      break;
    }
    case 'month': {
      filterStart = new Date(targetYear, targetMonth - 1, 1);
      filterEnd = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);
      break;
    }
    case 'year': {
      filterStart = new Date(targetYear, 0, 1);
      filterEnd = new Date(targetYear, 11, 31, 23, 59, 59, 999);
      break;
    }
    case 'all':
    default:
      // No date filtering
      break;
  }

  return entries.filter((entry) => {
    // Date filtering
    if (filterStart && entry.date < filterStart) return false;
    if (filterEnd && entry.date > filterEnd) return false;

    // Rep filtering (case-insensitive partial match)
    if (options.rep) {
      const repLower = options.rep.toLowerCase();
      if (!entry.salesRep.toLowerCase().includes(repLower)) return false;
    }

    return true;
  });
}

function buildLeaderboard(entries: CommissionEntry[]): LeaderboardEntry[] {
  const repMap = new Map<string, { total: number; count: number }>();
  let grandTotal = 0;

  for (const entry of entries) {
    if (!repMap.has(entry.salesRep)) {
      repMap.set(entry.salesRep, { total: 0, count: 0 });
    }
    const stats = repMap.get(entry.salesRep)!;
    stats.total += entry.amount;
    stats.count++;
    grandTotal += entry.amount;
  }

  const leaderboard: LeaderboardEntry[] = [];

  for (const [name, stats] of repMap.entries()) {
    const totalCommissions = Math.round(stats.total * 100) / 100;
    const avgTransaction = stats.count > 0 ? Math.round((stats.total / stats.count) * 100) / 100 : 0;
    const percentOfTotal = grandTotal > 0 ? Math.round((stats.total / grandTotal) * 10000) / 100 : 0;

    leaderboard.push({
      rank: 0, // Will be set after sorting
      name,
      totalCommissions,
      transactionCount: stats.count,
      avgTransaction,
      percentOfTotal,
    });
  }

  // Sort by total commissions descending
  leaderboard.sort((a, b) => b.totalCommissions - a.totalCommissions);

  // Assign ranks
  leaderboard.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return leaderboard;
}

function buildSummary(entries: CommissionEntry[]): SalesSummary {
  let totalCommissions = 0;
  let minDate: Date | null = null;
  let maxDate: Date | null = null;
  const uniqueReps = new Set<string>();

  for (const entry of entries) {
    totalCommissions += entry.amount;
    uniqueReps.add(entry.salesRep);

    if (!minDate || entry.date < minDate) minDate = entry.date;
    if (!maxDate || entry.date > maxDate) maxDate = entry.date;
  }

  const transactionCount = entries.length;
  const avgTransactionValue = transactionCount > 0
    ? Math.round((totalCommissions / transactionCount) * 100) / 100
    : 0;

  return {
    totalCommissions: Math.round(totalCommissions * 100) / 100,
    transactionCount,
    dateRange: {
      start: minDate ? formatDateISO(minDate) : null,
      end: maxDate ? formatDateISO(maxDate) : null,
    },
    avgTransactionValue,
    uniqueReps: uniqueReps.size,
  };
}

function buildPeriodData(
  entries: CommissionEntry[],
  options: FilterOptions
): PeriodData | undefined {
  if (options.period === 'all') return undefined;

  const now = new Date();
  const targetYear = options.year ?? now.getFullYear();
  const targetMonth = options.month ?? (now.getMonth() + 1);

  let totalCommissions = 0;
  for (const entry of entries) {
    totalCommissions += entry.amount;
  }
  totalCommissions = Math.round(totalCommissions * 100) / 100;

  const periodData: PeriodData = {
    period: options.period,
    totalCommissions,
    transactionCount: entries.length,
  };

  switch (options.period) {
    case 'week': {
      const { start, end } = getWeekBoundaries(now);
      periodData.weekStart = formatDateISO(start);
      periodData.weekEnd = formatDateISO(end);
      break;
    }
    case 'month': {
      periodData.year = targetYear;
      periodData.month = targetMonth;
      break;
    }
    case 'year': {
      periodData.year = targetYear;
      break;
    }
  }

  return periodData;
}

function buildRepDetail(
  entries: CommissionEntry[],
  repName: string
): SalesApiResponse['data']['repDetail'] | undefined {
  if (!repName) return undefined;

  const repEntries = entries.filter(
    (e) => e.salesRep.toLowerCase().includes(repName.toLowerCase())
  );

  if (repEntries.length === 0) return undefined;

  // Get the actual rep name from the first entry
  const actualName = repEntries[0].salesRep;

  let totalCommissions = 0;
  for (const entry of repEntries) {
    totalCommissions += entry.amount;
  }
  totalCommissions = Math.round(totalCommissions * 100) / 100;

  const avgTransaction = repEntries.length > 0
    ? Math.round((totalCommissions / repEntries.length) * 100) / 100
    : 0;

  // Get 10 most recent transactions
  const sortedByDate = [...repEntries].sort((a, b) => b.date.getTime() - a.date.getTime());
  const recentTransactions = sortedByDate.slice(0, 10).map((e) => ({
    date: formatDateISO(e.date),
    amount: e.amount,
    balance: e.balance,
  }));

  return {
    name: actualName,
    totalCommissions,
    transactionCount: repEntries.length,
    avgTransaction,
    recentTransactions,
  };
}

// ============================================================================
// API Route Handler
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse<SalesApiResponse | ErrorResponse>> {
  const timestamp = new Date().toISOString();

  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);

    const period = validatePeriod(searchParams.get('period'));
    const year = validateYear(searchParams.get('year'));
    const month = validateMonth(searchParams.get('month'));
    const rep = searchParams.get('rep')?.trim() || null;

    // Load data (from cache or bundled JSON)
    const wasCached = isCacheValid();
    const cacheEntry = loadCommissionData();

    // Filter entries based on query params
    const filterOptions: FilterOptions = { period, year, month, rep };
    const filteredEntries = filterEntries(cacheEntry.data, filterOptions);

    // Build response data
    const summary = buildSummary(filteredEntries);
    const leaderboard = buildLeaderboard(filteredEntries);
    const periodData = buildPeriodData(filteredEntries, filterOptions);
    const repDetail = rep ? buildRepDetail(cacheEntry.data, rep) : undefined;

    const response: SalesApiResponse = {
      success: true,
      data: {
        summary,
        leaderboard,
        ...(periodData && { periodData }),
        ...(repDetail && { repDetail }),
      },
      cached: wasCached,
      timestamp,
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'private, max-age=60',
        'X-Data-Source': 'commissions.json',
      },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorCode = errorMessage.includes('Failed to read') ? 'DATA_FILE_ERROR' : 'INTERNAL_ERROR';

    console.error('[Sales API Error]', errorMessage);

    const errorResponse: ErrorResponse = {
      success: false,
      error: errorMessage,
      code: errorCode,
      timestamp,
    };

    const statusCode = errorCode === 'DATA_FILE_ERROR' ? 503 : 500;

    return NextResponse.json(errorResponse, { status: statusCode });
  }
}
