/**
 * RCRS Command Center - Rep Comparison API
 *
 * Compare any rep vs team average or vs another rep.
 *
 * GET /api/command-center/rep-comparison
 * Query params:
 *   - rep1: string (required, rep name)
 *   - rep2: string (optional, compare to specific rep; defaults to team average)
 *   - period: 'week' | 'month' | 'quarter' | 'year' | 'all' (default: 'all')
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

interface RepMetrics {
  name: string;
  totalRevenue: number;
  dealCount: number;
  avgDealSize: number;
  bestMonth: string;
  bestMonthRevenue: number;
  recentDeals: number; // last 30 days
  recentRevenue: number;
}

function getWeekBoundaries(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const rep1Name = searchParams.get('rep1');
    const rep2Name = searchParams.get('rep2');
    const period = searchParams.get('period') || 'all';

    if (!rep1Name) {
      return NextResponse.json(
        { success: false, error: 'rep1 parameter is required' },
        { status: 400 }
      );
    }

    const rawData = commissionsData as RawCommissionRecord[];
    const records = rawData
      .map(r => ({
        salesRep: r.salesRep.replace(/\s+/g, ' ').trim(),
        date: parseDate(r.date),
        amount: r.amount,
      }))
      .filter(r => r.date !== null) as Array<{
        salesRep: string;
        date: Date;
        amount: number;
      }>;

    // Apply period filter
    const now = new Date();
    let filterStart: Date | null = null;
    let filterEnd: Date | null = null;

    switch (period) {
      case 'week': {
        const { start, end } = getWeekBoundaries(now);
        filterStart = start;
        filterEnd = end;
        break;
      }
      case 'month': {
        filterStart = new Date(now.getFullYear(), now.getMonth(), 1);
        filterEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      }
      case 'quarter': {
        const qStart = Math.floor(now.getMonth() / 3) * 3;
        filterStart = new Date(now.getFullYear(), qStart, 1);
        filterEnd = new Date(now.getFullYear(), qStart + 3, 0, 23, 59, 59, 999);
        break;
      }
      case 'year': {
        filterStart = new Date(now.getFullYear(), 0, 1);
        filterEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
      }
    }

    const filteredRecords = records.filter(r => {
      if (filterStart && r.date < filterStart) return false;
      if (filterEnd && r.date > filterEnd) return false;
      return true;
    });

    // Helper: compute metrics for a set of records
    const computeMetrics = (recs: typeof filteredRecords, name: string): RepMetrics => {
      const total = recs.reduce((s, r) => s + r.amount, 0);
      const count = recs.length;
      const avg = count > 0 ? total / count : 0;

      // Best month
      const byMonth = new Map<string, number>();
      recs.forEach(r => {
        const key = `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, '0')}`;
        byMonth.set(key, (byMonth.get(key) || 0) + r.amount);
      });
      let bestMonth = '';
      let bestMonthRev = 0;
      byMonth.forEach((rev, month) => {
        if (rev > bestMonthRev) {
          bestMonth = month;
          bestMonthRev = rev;
        }
      });

      // Recent 30 days
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);
      const recentRecs = recs.filter(r => r.date >= thirtyDaysAgo);

      return {
        name,
        totalRevenue: Math.round(total * 100) / 100,
        dealCount: count,
        avgDealSize: Math.round(avg * 100) / 100,
        bestMonth,
        bestMonthRevenue: Math.round(bestMonthRev * 100) / 100,
        recentDeals: recentRecs.length,
        recentRevenue: Math.round(recentRecs.reduce((s, r) => s + r.amount, 0) * 100) / 100,
      };
    };

    // Find rep1
    const rep1Records = filteredRecords.filter(r =>
      r.salesRep.toLowerCase().includes(rep1Name.toLowerCase())
    );
    const actualRep1Name = rep1Records.length > 0 ? rep1Records[0].salesRep : rep1Name;
    const rep1Metrics = computeMetrics(rep1Records, actualRep1Name);

    let rep2Metrics: RepMetrics;
    let comparisonType: 'rep' | 'team';

    if (rep2Name) {
      // Compare to specific rep
      comparisonType = 'rep';
      const rep2Records = filteredRecords.filter(r =>
        r.salesRep.toLowerCase().includes(rep2Name.toLowerCase())
      );
      const actualRep2Name = rep2Records.length > 0 ? rep2Records[0].salesRep : rep2Name;
      rep2Metrics = computeMetrics(rep2Records, actualRep2Name);
    } else {
      // Compare to team average
      comparisonType = 'team';
      const uniqueReps = new Set(filteredRecords.map(r => r.salesRep));
      const repCount = uniqueReps.size || 1;

      const total = filteredRecords.reduce((s, r) => s + r.amount, 0);
      const count = filteredRecords.length;

      rep2Metrics = {
        name: 'Team Average',
        totalRevenue: Math.round((total / repCount) * 100) / 100,
        dealCount: Math.round(count / repCount),
        avgDealSize: count > 0 ? Math.round((total / count) * 100) / 100 : 0,
        bestMonth: '',
        bestMonthRevenue: 0,
        recentDeals: Math.round(filteredRecords.filter(r => {
          const thirtyAgo = new Date(now);
          thirtyAgo.setDate(now.getDate() - 30);
          return r.date >= thirtyAgo;
        }).length / repCount),
        recentRevenue: Math.round(filteredRecords.filter(r => {
          const thirtyAgo = new Date(now);
          thirtyAgo.setDate(now.getDate() - 30);
          return r.date >= thirtyAgo;
        }).reduce((s, r) => s + r.amount, 0) / repCount * 100) / 100,
      };
    }

    // Calculate differences
    const differences = {
      revenue: rep1Metrics.totalRevenue - rep2Metrics.totalRevenue,
      revenuePercent: rep2Metrics.totalRevenue > 0
        ? ((rep1Metrics.totalRevenue - rep2Metrics.totalRevenue) / rep2Metrics.totalRevenue) * 100 : 0,
      dealCount: rep1Metrics.dealCount - rep2Metrics.dealCount,
      avgDealSize: rep1Metrics.avgDealSize - rep2Metrics.avgDealSize,
      avgDealSizePercent: rep2Metrics.avgDealSize > 0
        ? ((rep1Metrics.avgDealSize - rep2Metrics.avgDealSize) / rep2Metrics.avgDealSize) * 100 : 0,
      recentRevenue: rep1Metrics.recentRevenue - rep2Metrics.recentRevenue,
      recentDeals: rep1Metrics.recentDeals - rep2Metrics.recentDeals,
    };

    // Get all unique rep names for the dropdown
    const allReps = Array.from(new Set(records.map(r => r.salesRep))).sort();

    return NextResponse.json({
      success: true,
      data: {
        comparisonType,
        period,
        rep1: rep1Metrics,
        rep2: rep2Metrics,
        differences: {
          revenue: Math.round(differences.revenue * 100) / 100,
          revenuePercent: Math.round(differences.revenuePercent * 10) / 10,
          dealCount: differences.dealCount,
          avgDealSize: Math.round(differences.avgDealSize * 100) / 100,
          avgDealSizePercent: Math.round(differences.avgDealSizePercent * 10) / 10,
          recentRevenue: Math.round(differences.recentRevenue * 100) / 100,
          recentDeals: differences.recentDeals,
        },
        availableReps: allReps,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Rep Comparison API Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate comparison' },
      { status: 500 }
    );
  }
}
