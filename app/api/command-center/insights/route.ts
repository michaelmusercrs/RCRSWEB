/**
 * RCRS Command Center - Insights & Recommendations API
 *
 * Auto-generates actionable insights based on sales data:
 * - Revenue comparisons (month-over-month, year-over-year)
 * - Top performer identification
 * - Underperformance alerts
 * - Seasonal observations
 * - Practical recommendations
 *
 * GET /api/command-center/insights
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

interface Insight {
  id: string;
  type: 'positive' | 'warning' | 'info' | 'tip';
  category: 'revenue' | 'performance' | 'team' | 'seasonal' | 'recommendation';
  title: string;
  message: string;
  metric?: string;
  value?: string;
  icon: string;
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

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
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

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const twoMonthsAgoStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const twoMonthsAgoEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0);
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay());
    thisWeekStart.setHours(0, 0, 0, 0);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);

    // Calculate metrics
    const thisMonthRecords = records.filter(r => r.date >= thisMonthStart);
    const lastMonthRecords = records.filter(r => r.date >= lastMonthStart && r.date <= lastMonthEnd);
    const twoMonthsAgoRecords = records.filter(r => r.date >= twoMonthsAgoStart && r.date <= twoMonthsAgoEnd);
    const thisWeekRecords = records.filter(r => r.date >= thisWeekStart);
    const lastWeekRecords = records.filter(r => r.date >= lastWeekStart && r.date <= lastWeekEnd);

    const thisMonthRevenue = thisMonthRecords.reduce((s, r) => s + r.amount, 0);
    const lastMonthRevenue = lastMonthRecords.reduce((s, r) => s + r.amount, 0);
    const twoMonthsAgoRevenue = twoMonthsAgoRecords.reduce((s, r) => s + r.amount, 0);
    const thisWeekRevenue = thisWeekRecords.reduce((s, r) => s + r.amount, 0);
    const lastWeekRevenue = lastWeekRecords.reduce((s, r) => s + r.amount, 0);

    // Rep stats this month
    const repThisMonth = new Map<string, { total: number; count: number }>();
    thisMonthRecords.forEach(r => {
      const existing = repThisMonth.get(r.salesRep) || { total: 0, count: 0 };
      existing.total += r.amount;
      existing.count++;
      repThisMonth.set(r.salesRep, existing);
    });

    // Rep stats last month
    const repLastMonth = new Map<string, { total: number; count: number }>();
    lastMonthRecords.forEach(r => {
      const existing = repLastMonth.get(r.salesRep) || { total: 0, count: 0 };
      existing.total += r.amount;
      existing.count++;
      repLastMonth.set(r.salesRep, existing);
    });

    // All-time rep stats
    const repAllTime = new Map<string, { total: number; count: number }>();
    records.forEach(r => {
      const existing = repAllTime.get(r.salesRep) || { total: 0, count: 0 };
      existing.total += r.amount;
      existing.count++;
      repAllTime.set(r.salesRep, existing);
    });

    // Day of week analysis
    const byDayOfWeek = new Map<number, number>();
    records.forEach(r => {
      const day = r.date.getDay();
      byDayOfWeek.set(day, (byDayOfWeek.get(day) || 0) + 1);
    });

    const insights: Insight[] = [];
    let insightCounter = 0;
    const makeId = () => `insight-${++insightCounter}`;

    // 1. Month-over-month revenue comparison
    if (lastMonthRevenue > 0) {
      const momChange = ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100;
      if (momChange > 0) {
        insights.push({
          id: makeId(),
          type: 'positive',
          category: 'revenue',
          title: 'Revenue Growing',
          message: `Revenue is up ${momChange.toFixed(1)}% compared to last month ($${Math.round(thisMonthRevenue).toLocaleString()} vs $${Math.round(lastMonthRevenue).toLocaleString()}).`,
          metric: 'MoM Growth',
          value: `+${momChange.toFixed(1)}%`,
          icon: 'TrendingUp',
        });
      } else if (momChange < -10) {
        insights.push({
          id: makeId(),
          type: 'warning',
          category: 'revenue',
          title: 'Revenue Declining',
          message: `Revenue is down ${Math.abs(momChange).toFixed(1)}% vs last month. Consider increasing lead generation or follow-up cadence.`,
          metric: 'MoM Change',
          value: `${momChange.toFixed(1)}%`,
          icon: 'TrendingDown',
        });
      }
    }

    // 2. Week-over-week comparison
    if (lastWeekRevenue > 0) {
      const wowChange = ((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100;
      insights.push({
        id: makeId(),
        type: wowChange >= 0 ? 'positive' : 'warning',
        category: 'revenue',
        title: wowChange >= 0 ? 'Strong Week' : 'Slower Week',
        message: `This week's revenue is ${wowChange >= 0 ? 'up' : 'down'} ${Math.abs(wowChange).toFixed(0)}% vs last week ($${Math.round(thisWeekRevenue).toLocaleString()} vs $${Math.round(lastWeekRevenue).toLocaleString()}).`,
        metric: 'WoW Change',
        value: `${wowChange >= 0 ? '+' : ''}${wowChange.toFixed(0)}%`,
        icon: wowChange >= 0 ? 'TrendingUp' : 'TrendingDown',
      });
    }

    // 3. Top performer this month
    const sortedRepsThisMonth = Array.from(repThisMonth.entries())
      .sort(([, a], [, b]) => b.total - a.total);

    if (sortedRepsThisMonth.length > 0) {
      const [topRepName, topRepData] = sortedRepsThisMonth[0];
      const totalTeamThisMonth = thisMonthRevenue;
      const topRepPercent = totalTeamThisMonth > 0 ? (topRepData.total / totalTeamThisMonth) * 100 : 0;

      insights.push({
        id: makeId(),
        type: 'positive',
        category: 'performance',
        title: `${topRepName} Leads This Month`,
        message: `${topRepName} has the highest revenue this month with $${Math.round(topRepData.total).toLocaleString()} (${topRepPercent.toFixed(0)}% of team total, ${topRepData.count} deals).`,
        metric: 'Top Producer',
        value: `$${Math.round(topRepData.total).toLocaleString()}`,
        icon: 'Trophy',
      });
    }

    // 4. Highest close rate (avg deal value) this month
    if (sortedRepsThisMonth.length > 1) {
      const repsByAvgDeal = Array.from(repThisMonth.entries())
        .filter(([, data]) => data.count >= 2)
        .sort(([, a], [, b]) => (b.total / b.count) - (a.total / a.count));

      if (repsByAvgDeal.length > 0) {
        const [highAvgRep, highAvgData] = repsByAvgDeal[0];
        const avg = highAvgData.total / highAvgData.count;
        insights.push({
          id: makeId(),
          type: 'info',
          category: 'performance',
          title: `${highAvgRep} Has Highest Avg Deal`,
          message: `${highAvgRep}'s average deal size is $${Math.round(avg).toLocaleString()} this month - the highest on the team.`,
          metric: 'Avg Deal',
          value: `$${Math.round(avg).toLocaleString()}`,
          icon: 'Target',
        });
      }
    }

    // 5. Rep momentum (improving vs declining)
    for (const [repName, thisData] of repThisMonth.entries()) {
      const lastData = repLastMonth.get(repName);
      if (lastData && lastData.total > 0) {
        const change = ((thisData.total - lastData.total) / lastData.total) * 100;
        if (change > 50 && thisData.count >= 3) {
          insights.push({
            id: makeId(),
            type: 'positive',
            category: 'team',
            title: `${repName} on a Hot Streak`,
            message: `${repName}'s revenue is up ${change.toFixed(0)}% vs last month. Keep the momentum going!`,
            metric: 'Rep Growth',
            value: `+${change.toFixed(0)}%`,
            icon: 'Flame',
          });
        } else if (change < -40 && lastData.count >= 3) {
          insights.push({
            id: makeId(),
            type: 'warning',
            category: 'team',
            title: `${repName} Needs Attention`,
            message: `${repName}'s revenue dropped ${Math.abs(change).toFixed(0)}% vs last month. Check in to identify blockers.`,
            metric: 'Rep Change',
            value: `${change.toFixed(0)}%`,
            icon: 'AlertTriangle',
          });
        }
      }
    }

    // 6. Best day of week
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let bestDay = 0;
    let bestDayCount = 0;
    byDayOfWeek.forEach((count, day) => {
      if (count > bestDayCount) {
        bestDay = day;
        bestDayCount = count;
      }
    });
    insights.push({
      id: makeId(),
      type: 'info',
      category: 'seasonal',
      title: `${dayNames[bestDay]} is the Best Day`,
      message: `${dayNames[bestDay]} has the most deals historically (${bestDayCount} total). Schedule important presentations on this day.`,
      metric: 'Best Day',
      value: dayNames[bestDay],
      icon: 'Calendar',
    });

    // 7. Team size insight
    const activeRepsThisMonth = repThisMonth.size;
    const activeRepsLastMonth = repLastMonth.size;
    if (activeRepsThisMonth > activeRepsLastMonth) {
      insights.push({
        id: makeId(),
        type: 'positive',
        category: 'team',
        title: 'Team Activity Up',
        message: `${activeRepsThisMonth} reps active this month vs ${activeRepsLastMonth} last month. Broader team engagement.`,
        metric: 'Active Reps',
        value: `${activeRepsThisMonth}`,
        icon: 'Users',
      });
    }

    // 8. Actionable recommendations
    // Find reps with no activity this month who had activity last month
    for (const [repName] of repLastMonth.entries()) {
      if (!repThisMonth.has(repName)) {
        insights.push({
          id: makeId(),
          type: 'tip',
          category: 'recommendation',
          title: `Check on ${repName}`,
          message: `${repName} was active last month but has no deals this month yet. A quick check-in could help.`,
          icon: 'UserCheck',
        });
      }
    }

    // Average deal size recommendation
    const teamAvgDeal = thisMonthRecords.length > 0
      ? thisMonthRevenue / thisMonthRecords.length : 0;
    if (teamAvgDeal > 0) {
      const lowAvgReps = Array.from(repThisMonth.entries())
        .filter(([, data]) => data.count >= 2 && (data.total / data.count) < teamAvgDeal * 0.7);

      for (const [repName, data] of lowAvgReps) {
        const repAvg = data.total / data.count;
        insights.push({
          id: makeId(),
          type: 'tip',
          category: 'recommendation',
          title: `${repName} - Focus on Deal Value`,
          message: `${repName}'s avg deal ($${Math.round(repAvg).toLocaleString()}) is ${Math.round((1 - repAvg / teamAvgDeal) * 100)}% below team avg ($${Math.round(teamAvgDeal).toLocaleString()}). Consider upselling training.`,
          icon: 'Lightbulb',
        });
      }
    }

    // Sort: positive first, then info, then tips, then warnings
    const typeOrder: Record<string, number> = { positive: 0, info: 1, tip: 2, warning: 3 };
    insights.sort((a, b) => (typeOrder[a.type] || 4) - (typeOrder[b.type] || 4));

    return NextResponse.json({
      success: true,
      data: {
        insights: insights.slice(0, 15),
        summary: {
          thisMonthRevenue: Math.round(thisMonthRevenue * 100) / 100,
          lastMonthRevenue: Math.round(lastMonthRevenue * 100) / 100,
          thisWeekRevenue: Math.round(thisWeekRevenue * 100) / 100,
          lastWeekRevenue: Math.round(lastWeekRevenue * 100) / 100,
          activeRepsThisMonth,
          totalInsights: insights.length,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Insights API Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate insights' },
      { status: 500 }
    );
  }
}
