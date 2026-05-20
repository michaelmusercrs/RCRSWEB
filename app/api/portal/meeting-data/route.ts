/**
 * Meeting Auto-Generation API
 *
 * GET - Generates meeting slide data from portal data:
 *   - Weekly numbers aggregated across all reps
 *   - Commission standings / leaderboard
 *   - Anonymized response time & close rate charts
 *   - Employee of the month
 *   - Announcements from Monday notes
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRoleAtLeast } from '@/lib/auth-service';
import { googleSheetsService } from '@/lib/google-sheets-service';
import { cache, CACHE_TTL } from '@/lib/cache';
import { promises as fs } from 'fs';
import path from 'path';

function getISOWeekString(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function getPreviousWeek(weekStr: string): string {
  const match = weekStr.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return weekStr;
  let year = parseInt(match[1]);
  let weekNum = parseInt(match[2]);
  weekNum--;
  if (weekNum < 1) { year--; weekNum = 52; }
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

interface CommissionEntry {
  salesRep: string;
  date: string;
  amount: number;
  balance: number;
}

export async function GET(request: NextRequest) {
  // SECURITY 2026-05-20: leaks full sales leaderboard with real commission
  // totals + per-rep weekly numbers — owner/admin/office/manager tier only
  // per cost-visibility rule. Richard ('driver') allowed by slug.
  const auth = await requireRoleAtLeast(['owner', 'admin', 'office', 'manager']);
  if (!auth.authenticated) return auth.response;

  try {
    const currentWeek = getISOWeekString();
    const prevWeek = getPreviousWeek(currentWeek);

    const cacheKey = `sheets:meeting-data:${currentWeek}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'private, s-maxage=30' },
      });
    }

    // Fetch all reps' weekly numbers for current + previous week
    const [currentWeekNumbers, prevWeekNumbers] = await Promise.all([
      googleSheetsService.getRepWeeklyNumbers({ weekStart: currentWeek, weekEnd: currentWeek }),
      googleSheetsService.getRepWeeklyNumbers({ weekStart: prevWeek, weekEnd: prevWeek }),
    ]);

    // Load commissions data for leaderboard
    let commissions: CommissionEntry[] = [];
    try {
      const commissionsPath = path.join(process.cwd(), 'data', 'commissions.json');
      const raw = await fs.readFile(commissionsPath, 'utf-8');
      commissions = JSON.parse(raw);
    } catch { /* no commissions file */ }

    // Build leaderboard from commissions (REAL numbers)
    const repTotals: Record<string, number> = {};
    for (const c of commissions) {
      if (c.amount > 0) {
        repTotals[c.salesRep] = (repTotals[c.salesRep] || 0) + c.amount;
      }
    }
    const leaderboard = Object.entries(repTotals)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // Aggregate weekly numbers (ESTIMATED - rep-entered)
    const weeklyAggregates = {
      totalDoorsKnocked: 0,
      totalAppointmentsSet: 0,
      totalInspectionsCompleted: 0,
      totalEstimatesGiven: 0,
      totalContractsSigned: 0,
      totalEstimatedRevenue: 0,
      totalLeadsGenerated: 0,
      totalFollowUpsMade: 0,
      repCount: currentWeekNumbers.length,
    };

    const perRepData = currentWeekNumbers.map(r => {
      weeklyAggregates.totalDoorsKnocked += r.doorsKnocked;
      weeklyAggregates.totalAppointmentsSet += r.appointmentsSet;
      weeklyAggregates.totalInspectionsCompleted += r.inspectionsCompleted;
      weeklyAggregates.totalEstimatesGiven += r.estimatesGiven;
      weeklyAggregates.totalContractsSigned += r.contractsSigned;
      weeklyAggregates.totalEstimatedRevenue += r.revenueClosed;
      weeklyAggregates.totalLeadsGenerated += r.leadsGenerated;
      weeklyAggregates.totalFollowUpsMade += r.followUpsMade;

      return {
        repName: r.repName,
        doorsKnocked: r.doorsKnocked,
        appointmentsSet: r.appointmentsSet,
        inspectionsCompleted: r.inspectionsCompleted,
        estimatesGiven: r.estimatesGiven,
        contractsSigned: r.contractsSigned,
        estimatedRevenue: r.revenueClosed, // Rep-entered = estimated
        leadsGenerated: r.leadsGenerated,
        followUpsMade: r.followUpsMade,
      };
    });

    // Build anonymized chart data (rep names replaced with Rep 1, Rep 2, etc.)
    // Sorted by performance for charts
    const anonymizedResponseData = currentWeekNumbers
      .filter(r => r.repName)
      .map((r, i) => ({
        label: `Rep ${i + 1}`,
        avgResponseMinutes: 0, // Would come from JN data in full implementation
      }));

    const anonymizedCloseData = currentWeekNumbers
      .filter(r => r.repName)
      .map((r, i) => ({
        label: `Rep ${i + 1}`,
        estimatesGiven: r.estimatesGiven,
        contractsSigned: r.contractsSigned,
        closeRate: r.estimatesGiven > 0
          ? Math.round((r.contractsSigned / r.estimatesGiven) * 100)
          : 0,
      }));

    // Meeting notes/announcements
    const notes = await googleSheetsService.getMondayNotes({ status: 'approved' });

    // Build slide data structure matching the meeting-data.ts slides
    const meetingDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const slideData = {
      generatedAt: new Date().toISOString(),
      meetingDate,
      currentWeek,

      // Slide 6: Rep Numbers
      repNumbers: {
        aggregates: weeklyAggregates,
        perRep: perRepData,
        prevWeekPerRep: prevWeekNumbers.map(r => ({
          repName: r.repName,
          doorsKnocked: r.doorsKnocked,
          contractsSigned: r.contractsSigned,
          estimatedRevenue: r.revenueClosed,
        })),
      },

      // Slide 8: Sales Overview — REAL numbers from commissions
      salesOverview: {
        leaderboard,
        totalRealRevenue: Object.values(repTotals).reduce((a, b) => a + b, 0),
        totalEstimatedRevenue: weeklyAggregates.totalEstimatedRevenue,
      },

      // Slide 10: Leaders & Stats — anonymized charts
      charts: {
        responseTime: anonymizedResponseData,
        closeRates: anonymizedCloseData,
      },

      // Announcements
      announcements: notes.filter(n => n.category === 'announcement').map(n => ({
        title: n.title,
        content: n.content,
      })),
    };

    const response = { success: true, data: slideData };
    cache.set(cacheKey, response, CACHE_TTL.MEETING);
    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'private, s-maxage=30' },
    });
  } catch (error) {
    console.error('Error generating meeting data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate meeting data' },
      { status: 500 }
    );
  }
}
