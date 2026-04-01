/**
 * Daily Activity API Route
 *
 * Reps log daily numbers (inspections, signs, revenue, etc.) and the system
 * accumulates them into the weekly total on the RepWeeklyNumbers tab.
 *
 * Uses the same Monday meeting column names:
 * Inspected | Damage | Signed | Repair | Gutter | $$$$$ | Approved | Goal | Referrals | Agents | Present | Home Show
 *
 * GET  - Fetch daily entries for the current week (or specified week/rep)
 * POST - Add a new daily entry and patch the weekly total
 *
 * Saves to the master RCRS Google Sheet (DailyActivity tab)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { googleSheetsService } from '@/lib/google-sheets-service';
import { cache, CACHE_TTL } from '@/lib/cache';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getISOWeekString(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

const NUMERIC_FIELDS = [
  'inspected', 'damage', 'signed', 'repair', 'gutter',
  'revenue', 'approved', 'goal', 'referrals', 'agents', 'homeShow',
] as const;

// ─── GET ────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = await requireAuth().catch(() => ({
    authenticated: false as const,
    response: null as unknown as Response,
  }));

  try {
    const { searchParams } = new URL(request.url);
    const repEmail = searchParams.get('repEmail') || (auth.authenticated ? auth.user.email : '');
    const weekParam = searchParams.get('week') || undefined;
    const allReps = searchParams.get('allReps') === 'true';

    // Determine which week to query
    const week = weekParam || getISOWeekString();

    const cacheKey = `sheets:daily-activity:${allReps ? 'all' : repEmail}:${week}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return NextResponse.json(cachedData, {
        headers: { 'Cache-Control': 'private, s-maxage=30' },
      });
    }

    const entries = await googleSheetsService.getDailyActivity({
      repEmail: allReps ? undefined : repEmail || undefined,
      week,
    });

    // Accumulate weekly totals from the daily entries
    const weeklyTotal: Record<string, number> = {};
    for (const field of NUMERIC_FIELDS) {
      weeklyTotal[field] = 0;
    }
    for (const entry of entries) {
      for (const field of NUMERIC_FIELDS) {
        if (field === 'revenue') {
          weeklyTotal[field] += parseFloat(String(entry[field])) || 0;
        } else {
          weeklyTotal[field] += parseInt(String(entry[field])) || 0;
        }
      }
    }

    const responseData = {
      success: true,
      week,
      entries,
      weeklyTotal,
      totalEntries: entries.length,
    };

    cache.set(cacheKey, responseData, CACHE_TTL.SHORT);
    return NextResponse.json(responseData, {
      headers: { 'Cache-Control': 'private, s-maxage=30' },
    });
  } catch (error) {
    console.error('Error fetching daily activity:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch daily activity' },
      { status: 500 },
    );
  }
}

// ─── POST ───────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();

    // date is required
    if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      return NextResponse.json(
        { success: false, error: 'date is required in YYYY-MM-DD format' },
        { status: 400 },
      );
    }

    const repName = auth.user.name;
    const repEmail = auth.user.email;

    // Calculate week from the submitted date, not from today
    const entryDate = new Date(body.date + 'T12:00:00Z');
    const week = getISOWeekString(entryDate);

    // Check for duplicate (same rep + same date)
    const existing = await googleSheetsService.getDailyActivity({
      repEmail,
      week,
    });
    const duplicate = existing.find(e => e.date === body.date);
    if (duplicate) {
      return NextResponse.json(
        { success: false, error: 'Entry already exists for this date. Only one entry per day.', existingEntry: duplicate },
        { status: 409 },
      );
    }

    // Build the daily activity record
    const record = {
      date: body.date,
      week,
      repName,
      repEmail,
      inspected: parseInt(String(body.inspected)) || 0,
      damage: parseInt(String(body.damage)) || 0,
      signed: parseInt(String(body.signed)) || 0,
      repair: parseInt(String(body.repair)) || 0,
      gutter: parseInt(String(body.gutter)) || 0,
      revenue: parseFloat(String(body.revenue)) || 0,
      approved: parseInt(String(body.approved)) || 0,
      goal: parseInt(String(body.goal)) || 0,
      referrals: parseInt(String(body.referrals)) || 0,
      agents: parseInt(String(body.agents)) || 0,
      present: String(body.present || '1'),
      homeShow: parseInt(String(body.homeShow)) || 0,
      submittedAt: new Date().toISOString(),
    };

    const success = await googleSheetsService.addDailyActivity(record);

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to save daily activity' },
        { status: 500 },
      );
    }

    // Invalidate daily activity cache
    cache.invalidatePattern('^sheets:daily-activity:');

    // Accumulate all daily entries for this week to patch the weekly total
    const allDailyForWeek = await googleSheetsService.getDailyActivity({
      repEmail,
      week,
    });

    const weeklyTotal: Record<string, number> = {};
    for (const field of NUMERIC_FIELDS) {
      weeklyTotal[field] = 0;
    }
    for (const entry of allDailyForWeek) {
      for (const field of NUMERIC_FIELDS) {
        if (field === 'revenue') {
          weeklyTotal[field] += parseFloat(String(entry[field])) || 0;
        } else {
          weeklyTotal[field] += parseInt(String(entry[field])) || 0;
        }
      }
    }

    // Patch the weekly total via the existing weekly-numbers update logic
    // Map new field names to the legacy RepWeeklyNumbers columns
    const legacyUpdates: Record<string, string | number> = {
      doorsKnocked: weeklyTotal.inspected,
      appointmentsSet: weeklyTotal.damage,
      inspectionsCompleted: weeklyTotal.signed,
      estimatesGiven: weeklyTotal.repair,
      contractsSigned: weeklyTotal.gutter,
      revenueClosed: weeklyTotal.revenue,
      leadsGenerated: weeklyTotal.approved,
      followUpsMade: weeklyTotal.goal,
      notes: `Referrals:${weeklyTotal.referrals} Agents:${weeklyTotal.agents} Present:${record.present} HomeShow:${weeklyTotal.homeShow}`,
    };

    const updated = await googleSheetsService.updateRepWeeklyNumbers(week, repEmail, legacyUpdates);

    if (!updated) {
      // No existing weekly row yet -- create one
      await googleSheetsService.addRepWeeklyNumbers({
        week,
        repName,
        repEmail,
        doorsKnocked: weeklyTotal.inspected,
        appointmentsSet: weeklyTotal.damage,
        inspectionsCompleted: weeklyTotal.signed,
        estimatesGiven: weeklyTotal.repair,
        contractsSigned: weeklyTotal.gutter,
        revenueClosed: weeklyTotal.revenue,
        leadsGenerated: weeklyTotal.approved,
        followUpsMade: weeklyTotal.goal,
        notes: `Referrals:${weeklyTotal.referrals} Agents:${weeklyTotal.agents} Present:${record.present} HomeShow:${weeklyTotal.homeShow}`,
        submittedAt: new Date().toISOString(),
      });
    }

    // Invalidate weekly-numbers cache so the leaderboard reflects the new total
    cache.invalidatePattern('^sheets:weekly-numbers:');
    cache.invalidatePattern('^sheets:meeting-data:');

    return NextResponse.json({
      success: true,
      message: 'Daily activity saved and weekly total updated',
      entry: record,
      weeklyTotal,
    });
  } catch (error) {
    console.error('Error submitting daily activity:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit daily activity' },
      { status: 500 },
    );
  }
}
