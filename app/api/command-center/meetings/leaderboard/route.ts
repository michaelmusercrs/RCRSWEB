/**
 * RCRS Command Center - Meeting Leaderboard API
 *
 * Provides real-time leaderboard data optimized for Monday meetings.
 * Includes ranking, achievements, streaks, and celebratory triggers.
 *
 * GET /api/command-center/meetings/leaderboard
 * Query params:
 *   - view: 'full' | 'compact' (default: 'full')
 *   - animate: 'true' | 'false' (include animation triggers)
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import commissionsData from '@/data/commissions.json';

// ============================================================================
// Types
// ============================================================================

interface RawCommissionRecord {
  salesRep: string;
  date: string;
  amount: number;
  balance: number;
}

interface LeaderboardRep {
  rank: number;
  name: string;
  initials: string;
  avatarColor: string;

  // Commission data
  totalCommissions: number;
  weeklyCommissions: number;
  monthlyCommissions: number;
  ytdCommissions: number;

  // Transaction counts
  totalTransactions: number;
  weeklyTransactions: number;
  monthlyTransactions: number;

  // Computed metrics
  avgTransaction: number;
  percentOfTeamTotal: number;

  // Status indicators
  streak: 'hot' | 'cold' | 'neutral';
  rankChange: number; // +1, -1, 0
  isTopPerformer: boolean;

  // Achievements
  achievements: Array<{
    id: string;
    icon: string;
    name: string;
    tier: 'legendary' | 'epic' | 'rare' | 'common';
  }>;

  // Animation triggers
  animations: Array<{
    type: 'confetti' | 'fireworks' | 'glow' | 'shake';
    reason: string;
  }>;
}

interface LeaderboardResponse {
  success: boolean;
  data: {
    leaderboard: LeaderboardRep[];
    summary: {
      totalTeamCommissions: number;
      totalTransactions: number;
      weeklyTotal: number;
      monthlyTotal: number;
      ytdTotal: number;
      avgTeamTransaction: number;
      dateGenerated: string;
    };
    celebrationTriggers: Array<{
      type: 'milestone' | 'record' | 'achievement';
      message: string;
      rep?: string;
      value?: number;
      animation: 'confetti' | 'fireworks' | 'spotlight';
    }>;
  };
  timestamp: string;
}

// ============================================================================
// Constants
// ============================================================================

const AVATAR_COLORS = [
  'from-yellow-400 to-amber-500',   // Gold
  'from-gray-400 to-gray-500',      // Silver
  'from-orange-600 to-amber-700',   // Bronze
  'from-blue-500 to-blue-600',
  'from-green-500 to-green-600',
  'from-purple-500 to-purple-600',
  'from-pink-500 to-pink-600',
  'from-red-500 to-red-600',
];

const ACHIEVEMENT_THRESHOLDS = {
  millionaire: 1000000,
  halfMillionaire: 500000,
  quarterMillionaire: 250000,
  centuryClub: 100,
  halfCentury: 50,
  bigTicket: 1000,
  teamMVP: 20,
};

// ============================================================================
// Utility Functions
// ============================================================================

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

function normalizeRepName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

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

function getMonthBoundaries(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function getYTDBoundaries(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), 0, 1);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// ============================================================================
// Achievement Calculator
// ============================================================================

function calculateAchievements(
  totalCommissions: number,
  totalTransactions: number,
  avgTransaction: number,
  percentOfTotal: number
): LeaderboardRep['achievements'] {
  const achievements: LeaderboardRep['achievements'] = [];

  // Legendary tier
  if (totalCommissions >= ACHIEVEMENT_THRESHOLDS.millionaire) {
    achievements.push({
      id: 'millionaire',
      icon: '💰',
      name: 'Millionaire',
      tier: 'legendary',
    });
  }

  // Epic tier
  if (totalCommissions >= ACHIEVEMENT_THRESHOLDS.halfMillionaire && totalCommissions < ACHIEVEMENT_THRESHOLDS.millionaire) {
    achievements.push({
      id: 'half-millionaire',
      icon: '💵',
      name: 'Half-Millionaire',
      tier: 'epic',
    });
  }

  if (totalTransactions >= ACHIEVEMENT_THRESHOLDS.centuryClub) {
    achievements.push({
      id: 'century-club',
      icon: '💯',
      name: 'Century Club',
      tier: 'epic',
    });
  }

  // Rare tier
  if (avgTransaction >= ACHIEVEMENT_THRESHOLDS.bigTicket) {
    achievements.push({
      id: 'big-ticket',
      icon: '🎫',
      name: 'Big Ticket Closer',
      tier: 'rare',
    });
  }

  if (percentOfTotal >= ACHIEVEMENT_THRESHOLDS.teamMVP) {
    achievements.push({
      id: 'team-mvp',
      icon: '🌟',
      name: 'Team MVP',
      tier: 'rare',
    });
  }

  // Common tier
  if (totalTransactions >= ACHIEVEMENT_THRESHOLDS.halfCentury && totalTransactions < ACHIEVEMENT_THRESHOLDS.centuryClub) {
    achievements.push({
      id: 'half-century',
      icon: '🎯',
      name: 'Half Century',
      tier: 'common',
    });
  }

  if (totalCommissions >= ACHIEVEMENT_THRESHOLDS.quarterMillionaire && totalCommissions < ACHIEVEMENT_THRESHOLDS.halfMillionaire) {
    achievements.push({
      id: 'quarter-millionaire',
      icon: '💎',
      name: 'Quarter-Millionaire',
      tier: 'common',
    });
  }

  return achievements;
}

// ============================================================================
// API Handler
// ============================================================================

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();

  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'full';
    const includeAnimations = searchParams.get('animate') === 'true';

    const now = new Date();
    const weekBounds = getWeekBoundaries(now);
    const monthBounds = getMonthBoundaries(now);
    const ytdBounds = getYTDBoundaries(now);

    const rawData = commissionsData as RawCommissionRecord[];

    // Aggregate data by rep
    const repMap = new Map<
      string,
      {
        total: number;
        count: number;
        weekTotal: number;
        weekCount: number;
        monthTotal: number;
        monthCount: number;
        ytdTotal: number;
        ytdCount: number;
        recentTransactions: number;
        previousWeekTotal: number;
      }
    >();

    const prevWeekBounds = {
      start: new Date(weekBounds.start),
      end: new Date(weekBounds.end),
    };
    prevWeekBounds.start.setDate(prevWeekBounds.start.getDate() - 7);
    prevWeekBounds.end.setDate(prevWeekBounds.end.getDate() - 7);

    let grandTotal = 0;
    let totalTransactions = 0;
    let weeklyTotal = 0;
    let monthlyTotal = 0;
    let ytdTotal = 0;

    for (const record of rawData) {
      const salesRep = normalizeRepName(record.salesRep);
      const date = parseDate(record.date);

      if (!date || !salesRep) continue;

      // HARD RULE: Michael, Chris, and Sara are NOT sales reps.
      // NEVER put them on commissions, leaderboards, or sales competition.
      // Subcontractor pay (Diego Garcia, Jesus M Lara, Rogelio Gonzalez-Flores) is NOT commission.
      const EXCLUDED_FROM_LEADERBOARD = [
        // Owners/Management - NOT sales reps
        'michael muse', 'chris muse', 'sara hill',
        // Project managers - NOT sales reps
        'john cordonis', 'bart roberts',
        // Office staff
        'destin mccary', 'tia muse morris', 'tia muse',
        // Subcontractors - labor pay, NOT commission
        'diego garcia', 'jesus m lara', 'jesus lara', 'rogelio gonzalez-flores', 'rogelio gonzalez',
      ];
      if (EXCLUDED_FROM_LEADERBOARD.includes(salesRep.toLowerCase())) continue;

      if (!repMap.has(salesRep)) {
        repMap.set(salesRep, {
          total: 0,
          count: 0,
          weekTotal: 0,
          weekCount: 0,
          monthTotal: 0,
          monthCount: 0,
          ytdTotal: 0,
          ytdCount: 0,
          recentTransactions: 0,
          previousWeekTotal: 0,
        });
      }

      const stats = repMap.get(salesRep)!;
      stats.total += record.amount;
      stats.count++;
      grandTotal += record.amount;
      totalTransactions++;

      // Weekly
      if (date >= weekBounds.start && date <= weekBounds.end) {
        stats.weekTotal += record.amount;
        stats.weekCount++;
        weeklyTotal += record.amount;
      }

      // Previous week (for streak calculation)
      if (date >= prevWeekBounds.start && date <= prevWeekBounds.end) {
        stats.previousWeekTotal += record.amount;
      }

      // Monthly
      if (date >= monthBounds.start && date <= monthBounds.end) {
        stats.monthTotal += record.amount;
        stats.monthCount++;
        monthlyTotal += record.amount;
      }

      // YTD
      if (date >= ytdBounds.start && date <= ytdBounds.end) {
        stats.ytdTotal += record.amount;
        stats.ytdCount++;
        ytdTotal += record.amount;
      }

      // Recent (last 30 days)
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      if (date >= thirtyDaysAgo) {
        stats.recentTransactions++;
      }
    }

    // Build leaderboard
    const leaderboard: LeaderboardRep[] = [];
    let colorIndex = 0;

    for (const [name, stats] of repMap.entries()) {
      const avgTransaction = stats.count > 0 ? stats.total / stats.count : 0;
      const percentOfTotal = grandTotal > 0 ? (stats.total / grandTotal) * 100 : 0;

      // Determine streak
      let streak: 'hot' | 'cold' | 'neutral' = 'neutral';
      if (stats.weekTotal > stats.previousWeekTotal * 1.2) {
        streak = 'hot';
      } else if (stats.weekTotal < stats.previousWeekTotal * 0.8 && stats.previousWeekTotal > 0) {
        streak = 'cold';
      }

      // Calculate achievements
      const achievements = calculateAchievements(
        stats.total,
        stats.count,
        avgTransaction,
        percentOfTotal
      );

      // Animation triggers (only if requested)
      const animations: LeaderboardRep['animations'] = [];
      if (includeAnimations) {
        if (stats.total >= 700000 && stats.total < 710000) {
          animations.push({ type: 'fireworks', reason: 'Approaching $750K milestone!' });
        }
        if (stats.weekTotal > 5000) {
          animations.push({ type: 'confetti', reason: 'Big week!' });
        }
        if (streak === 'hot') {
          animations.push({ type: 'glow', reason: 'On fire!' });
        }
      }

      leaderboard.push({
        rank: 0,
        name,
        initials: getInitials(name),
        avatarColor: AVATAR_COLORS[colorIndex % AVATAR_COLORS.length],
        totalCommissions: Math.round(stats.total * 100) / 100,
        weeklyCommissions: Math.round(stats.weekTotal * 100) / 100,
        monthlyCommissions: Math.round(stats.monthTotal * 100) / 100,
        ytdCommissions: Math.round(stats.ytdTotal * 100) / 100,
        totalTransactions: stats.count,
        weeklyTransactions: stats.weekCount,
        monthlyTransactions: stats.monthCount,
        avgTransaction: Math.round(avgTransaction * 100) / 100,
        percentOfTeamTotal: Math.round(percentOfTotal * 10) / 10,
        streak,
        rankChange: 0,
        isTopPerformer: false,
        achievements,
        animations,
      });

      colorIndex++;
    }

    // Sort by total commissions and assign ranks
    leaderboard.sort((a, b) => b.totalCommissions - a.totalCommissions);
    leaderboard.forEach((rep, index) => {
      rep.rank = index + 1;
      rep.isTopPerformer = index < 3;
      // Assign correct colors based on rank
      if (index === 0) rep.avatarColor = AVATAR_COLORS[0]; // Gold
      else if (index === 1) rep.avatarColor = AVATAR_COLORS[1]; // Silver
      else if (index === 2) rep.avatarColor = AVATAR_COLORS[2]; // Bronze
    });

    // Generate celebration triggers
    const celebrationTriggers: LeaderboardResponse['data']['celebrationTriggers'] = [];

    // Check for milestones
    for (const rep of leaderboard) {
      if (rep.totalCommissions >= 740000 && rep.totalCommissions < 750000) {
        celebrationTriggers.push({
          type: 'milestone',
          message: `${rep.name} is just $${Math.round(750000 - rep.totalCommissions).toLocaleString()} away from $750K!`,
          rep: rep.name,
          value: rep.totalCommissions,
          animation: 'spotlight',
        });
      }

      if (rep.weeklyCommissions > 5000) {
        celebrationTriggers.push({
          type: 'record',
          message: `${rep.name} had a massive week with $${rep.weeklyCommissions.toLocaleString()}!`,
          rep: rep.name,
          value: rep.weeklyCommissions,
          animation: 'confetti',
        });
      }
    }

    // Team milestones
    if (ytdTotal >= 2500000) {
      celebrationTriggers.push({
        type: 'milestone',
        message: `Team has surpassed $2.5M YTD! Total: $${Math.round(ytdTotal).toLocaleString()}`,
        value: ytdTotal,
        animation: 'fireworks',
      });
    }

    const response: LeaderboardResponse = {
      success: true,
      data: {
        leaderboard: view === 'compact' ? leaderboard.slice(0, 6) : leaderboard,
        summary: {
          totalTeamCommissions: Math.round(grandTotal * 100) / 100,
          totalTransactions,
          weeklyTotal: Math.round(weeklyTotal * 100) / 100,
          monthlyTotal: Math.round(monthlyTotal * 100) / 100,
          ytdTotal: Math.round(ytdTotal * 100) / 100,
          avgTeamTransaction:
            totalTransactions > 0 ? Math.round((grandTotal / totalTransactions) * 100) / 100 : 0,
          dateGenerated: now.toISOString(),
        },
        celebrationTriggers,
      },
      timestamp,
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'private, max-age=30',
      },
    });
  } catch (error) {
    console.error('[Leaderboard API Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp,
      },
      { status: 500 }
    );
  }
}
