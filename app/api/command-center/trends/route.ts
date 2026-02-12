/**
 * RCRS Command Center - Trends API
 *
 * Provides trend data for dashboards:
 * - Monthly revenue trend (last 12 months)
 * - Lead conversion rate trend
 * - Average deal size trend
 * - Job count trend by type
 * - Seasonal patterns
 *
 * GET /api/command-center/trends
 * Query params:
 *   - type: 'revenue' | 'deals' | 'conversion' | 'seasonal' | 'all' (default: 'all')
 *   - months: number (default: 12)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import commissionsData from '@/data/commissions.json';

interface RawCommissionRecord {
  salesRep: string;
  date: string;
  amount: number;
  balance: number;
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.trim().split('/');
  if (parts.length !== 3) return null;
  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  let year = parseInt(parts[2], 10);
  if (isNaN(month) || isNaN(day) || isNaN(year)) return null;
  if (year < 100) year = 2000 + year;
  if (year < 2019 || year > 2030) return null;
  const date = new Date(year, month - 1, day);
  if (date.getMonth() !== month - 1) return null;
  return date;
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(key: string): string {
  const [year, month] = key.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function getDayOfWeek(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';
    const months = parseInt(searchParams.get('months') || '12');

    const rawData = commissionsData as RawCommissionRecord[];

    // Parse all records
    const records = rawData
      .map(r => ({
        salesRep: r.salesRep.replace(/\s+/g, ' ').trim(),
        date: parseDate(r.date),
        amount: r.amount,
        dateString: r.date,
      }))
      .filter(r => r.date !== null) as Array<{
        salesRep: string;
        date: Date;
        amount: number;
        dateString: string;
      }>;

    const now = new Date();
    const cutoffDate = new Date(now.getFullYear(), now.getMonth() - months, 1);

    // Filter to requested period
    const filtered = records.filter(r => r.date >= cutoffDate);

    const result: Record<string, unknown> = {};

    // Revenue trend by month
    if (type === 'all' || type === 'revenue') {
      const byMonth = new Map<string, { revenue: number; count: number }>();
      filtered.forEach(r => {
        const key = getMonthKey(r.date);
        const existing = byMonth.get(key) || { revenue: 0, count: 0 };
        existing.revenue += r.amount;
        existing.count++;
        byMonth.set(key, existing);
      });

      const revenueTrend = Array.from(byMonth.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, data]) => ({
          period: key,
          label: getMonthLabel(key),
          revenue: Math.round(data.revenue * 100) / 100,
          dealCount: data.count,
        }));

      result.revenueTrend = revenueTrend;
    }

    // Deal size trend by month
    if (type === 'all' || type === 'deals') {
      const byMonth = new Map<string, { total: number; count: number }>();
      filtered.forEach(r => {
        const key = getMonthKey(r.date);
        const existing = byMonth.get(key) || { total: 0, count: 0 };
        existing.total += r.amount;
        existing.count++;
        byMonth.set(key, existing);
      });

      const dealSizeTrend = Array.from(byMonth.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, data]) => ({
          period: key,
          label: getMonthLabel(key),
          avgDealSize: data.count > 0 ? Math.round((data.total / data.count) * 100) / 100 : 0,
          dealCount: data.count,
        }));

      result.dealSizeTrend = dealSizeTrend;
    }

    // Conversion / rep performance trend
    if (type === 'all' || type === 'conversion') {
      const byMonth = new Map<string, Map<string, number>>();
      filtered.forEach(r => {
        const key = getMonthKey(r.date);
        if (!byMonth.has(key)) byMonth.set(key, new Map());
        const repMap = byMonth.get(key)!;
        repMap.set(r.salesRep, (repMap.get(r.salesRep) || 0) + r.amount);
      });

      const repActivityTrend = Array.from(byMonth.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, repMap]) => ({
          period: key,
          label: getMonthLabel(key),
          activeReps: repMap.size,
          topRep: Array.from(repMap.entries())
            .sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A',
        }));

      result.repActivityTrend = repActivityTrend;
    }

    // Seasonal patterns
    if (type === 'all' || type === 'seasonal') {
      // Revenue by day of week
      const byDayOfWeek = new Map<string, { total: number; count: number }>();
      records.forEach(r => {
        const day = getDayOfWeek(r.date);
        const existing = byDayOfWeek.get(day) || { total: 0, count: 0 };
        existing.total += r.amount;
        existing.count++;
        byDayOfWeek.set(day, existing);
      });

      const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const byDayOfWeekData = dayOrder.map(day => {
        const data = byDayOfWeek.get(day) || { total: 0, count: 0 };
        return {
          day,
          totalRevenue: Math.round(data.total * 100) / 100,
          dealCount: data.count,
          avgDeal: data.count > 0 ? Math.round((data.total / data.count) * 100) / 100 : 0,
        };
      });

      // Revenue by month of year
      const byMonthOfYear = new Map<number, { total: number; count: number }>();
      records.forEach(r => {
        const m = r.date.getMonth();
        const existing = byMonthOfYear.get(m) || { total: 0, count: 0 };
        existing.total += r.amount;
        existing.count++;
        byMonthOfYear.set(m, existing);
      });

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const byMonthOfYearData = monthNames.map((name, i) => {
        const data = byMonthOfYear.get(i) || { total: 0, count: 0 };
        return {
          month: name,
          totalRevenue: Math.round(data.total * 100) / 100,
          dealCount: data.count,
          avgDeal: data.count > 0 ? Math.round((data.total / data.count) * 100) / 100 : 0,
        };
      });

      result.seasonal = {
        byDayOfWeek: byDayOfWeekData,
        byMonthOfYear: byMonthOfYearData,
      };
    }

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Trends API Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate trends data' },
      { status: 500 }
    );
  }
}
