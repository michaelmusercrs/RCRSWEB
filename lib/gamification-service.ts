/**
 * Gamification Service - Sales Leaderboard, Achievements, Contests & Daily Challenges
 *
 * Provides a competitive, engaging gamification layer on top of commission data.
 * Data source: data/commissions.json + data/gamification.json
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getSalesReps, TEAM_MEMBERS } from './team-roles';
import { jnResponseMiner, RepResponseStats } from './jn-response-miner';
import { googleSheetsService } from './google-sheets-service';

// =============================================================================
// Types
// =============================================================================

export interface RepAchievement {
  id: string;
  repSlug: string;
  repName: string;
  achievementId: string;
  awardedAt: string;
  metadata?: Record<string, string>;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  category: 'sales' | 'speed' | 'consistency' | 'volume' | 'customer' | 'team';
  criteria: string;
  threshold: number;
  points: number;
}

export interface LeaderboardEntry {
  rank: number;
  repSlug: string;
  repName: string;
  avatar?: string;
  points: number;
  sales: number;
  revenue: number;
  responseTime: number;
  closeRate: number;
  streak: number;
  achievements: string[];
  trend: 'up' | 'down' | 'steady';
  previousRank: number;
}

export interface Contest {
  id: string;
  name: string;
  description: string;
  type: 'individual' | 'team';
  metric: 'revenue' | 'deals' | 'leads_contacted' | 'response_time' | 'reviews';
  startDate: string;
  endDate: string;
  prize: string;
  status: 'upcoming' | 'active' | 'completed';
  participants: { repSlug: string; score: number }[];
  winnerId?: string;
  createdBy: string;
  createdAt: string;
}

export interface DailyChallenge {
  id: string;
  date: string;
  title: string;
  description: string;
  metric: string;
  target: number;
  bonusPoints: number;
  completedBy: string[];
}

interface GamificationData {
  repAchievements: RepAchievement[];
  contests: Contest[];
  dailyChallenges: DailyChallenge[];
  previousRanks: Record<string, number>; // repSlug -> last known rank
  responseTimeCache: RepResponseStats[]; // cached JN response times
  lastUpdated: string;
}

interface CommissionRecord {
  salesRep: string;
  date: string;
  amount: number;
  balance: number;
  jobNumber?: string;
  customer?: string;
}

// =============================================================================
// Achievement Definitions
// =============================================================================

const ACHIEVEMENTS: Achievement[] = [
  // Bronze tier (10 pts each)
  {
    id: 'first_sale',
    name: 'First Blood',
    description: 'Close your first deal',
    icon: '🎯',
    tier: 'bronze',
    category: 'sales',
    criteria: 'Close 1 deal',
    threshold: 1,
    points: 10,
  },
  {
    id: 'five_calls',
    name: 'Dialer',
    description: 'Make 5 calls in a day',
    icon: '📞',
    tier: 'bronze',
    category: 'speed',
    criteria: '5 calls in one day',
    threshold: 5,
    points: 10,
  },
  {
    id: 'quick_response',
    name: 'Speed Demon',
    description: 'Respond to a lead in under 5 minutes',
    icon: '⚡',
    tier: 'bronze',
    category: 'speed',
    criteria: 'Response time under 5 min',
    threshold: 5,
    points: 10,
  },
  {
    id: 'first_inspection',
    name: 'Eyes On',
    description: 'Complete your first inspection',
    icon: '🔍',
    tier: 'bronze',
    category: 'sales',
    criteria: 'Complete 1 inspection',
    threshold: 1,
    points: 10,
  },

  // Silver tier (25 pts each)
  {
    id: 'ten_sales',
    name: 'Double Digits',
    description: 'Close 10 deals',
    icon: '🔥',
    tier: 'silver',
    category: 'sales',
    criteria: 'Close 10 deals',
    threshold: 10,
    points: 25,
  },
  {
    id: 'hot_streak_3',
    name: 'On Fire',
    description: '3 consecutive days with a sale',
    icon: '🔥',
    tier: 'silver',
    category: 'consistency',
    criteria: '3-day sale streak',
    threshold: 3,
    points: 25,
  },
  {
    id: 'revenue_10k',
    name: '10K Club',
    description: '$10,000 in total commissions',
    icon: '💰',
    tier: 'silver',
    category: 'volume',
    criteria: '$10K in commissions',
    threshold: 10000,
    points: 25,
  },
  {
    id: 'perfect_response',
    name: 'Lightning',
    description: 'Average response time under 10 min for a week',
    icon: '⚡',
    tier: 'silver',
    category: 'speed',
    criteria: 'Avg response <10 min for 7 days',
    threshold: 10,
    points: 25,
  },

  // Gold tier (50 pts each)
  {
    id: 'twenty_five_sales',
    name: 'Quarter Century',
    description: 'Close 25 deals',
    icon: '🏅',
    tier: 'gold',
    category: 'sales',
    criteria: 'Close 25 deals',
    threshold: 25,
    points: 50,
  },
  {
    id: 'hot_streak_7',
    name: 'Unstoppable',
    description: '7 consecutive days with a sale',
    icon: '🔥',
    tier: 'gold',
    category: 'consistency',
    criteria: '7-day sale streak',
    threshold: 7,
    points: 50,
  },
  {
    id: 'revenue_25k',
    name: '25K Club',
    description: '$25,000 in commissions',
    icon: '💎',
    tier: 'gold',
    category: 'volume',
    criteria: '$25K in commissions',
    threshold: 25000,
    points: 50,
  },
  {
    id: 'five_star',
    name: '5 Stars',
    description: 'Get 5 five-star reviews',
    icon: '⭐',
    tier: 'gold',
    category: 'customer',
    criteria: '5 five-star reviews',
    threshold: 5,
    points: 50,
  },
  {
    id: 'top_closer',
    name: 'Top Closer',
    description: 'Highest close rate for a month',
    icon: '🎯',
    tier: 'gold',
    category: 'sales',
    criteria: '#1 close rate in a month',
    threshold: 1,
    points: 50,
  },

  // Platinum tier (100 pts each)
  {
    id: 'fifty_sales',
    name: 'Half Century',
    description: 'Close 50 deals',
    icon: '🏆',
    tier: 'platinum',
    category: 'sales',
    criteria: 'Close 50 deals',
    threshold: 50,
    points: 100,
  },
  {
    id: 'revenue_50k',
    name: '50K Club',
    description: '$50,000 in commissions',
    icon: '💎',
    tier: 'platinum',
    category: 'volume',
    criteria: '$50K in commissions',
    threshold: 50000,
    points: 100,
  },
  {
    id: 'hot_streak_14',
    name: 'Legend',
    description: '14 consecutive days with a sale',
    icon: '👑',
    tier: 'platinum',
    category: 'consistency',
    criteria: '14-day sale streak',
    threshold: 14,
    points: 100,
  },
  {
    id: 'team_player',
    name: 'MVP',
    description: 'Highest total score for a quarter',
    icon: '🏅',
    tier: 'platinum',
    category: 'team',
    criteria: '#1 total score for a quarter',
    threshold: 1,
    points: 100,
  },

  // Diamond tier (250 pts each)
  {
    id: 'hundred_sales',
    name: 'Centurion',
    description: 'Close 100 deals',
    icon: '💯',
    tier: 'diamond',
    category: 'sales',
    criteria: 'Close 100 deals',
    threshold: 100,
    points: 250,
  },
  {
    id: 'revenue_100k',
    name: 'Six Figures',
    description: '$100,000 in commissions',
    icon: '🤑',
    tier: 'diamond',
    category: 'volume',
    criteria: '$100K in commissions',
    threshold: 100000,
    points: 250,
  },
  {
    id: 'top_annual',
    name: 'Champion',
    description: 'Top performer for the year',
    icon: '👑',
    tier: 'diamond',
    category: 'team',
    criteria: '#1 performer for the year',
    threshold: 1,
    points: 250,
  },
];

// =============================================================================
// Daily Challenge Templates
// =============================================================================

const CHALLENGE_TEMPLATES = [
  { title: 'Speed Round', description: 'Respond to 3 leads in under 10 minutes each', metric: 'fast_responses', target: 3, bonusPoints: 15 },
  { title: 'Closer\'s Club', description: 'Close 2 deals today', metric: 'deals_closed', target: 2, bonusPoints: 20 },
  { title: 'Dial It Up', description: 'Make 10 outbound calls', metric: 'calls_made', target: 10, bonusPoints: 10 },
  { title: 'Pipeline Builder', description: 'Schedule 3 inspections', metric: 'inspections_scheduled', target: 3, bonusPoints: 15 },
  { title: 'Revenue Rush', description: 'Generate $5,000 in commissions', metric: 'revenue', target: 5000, bonusPoints: 25 },
  { title: 'Follow-Up Friday', description: 'Follow up with 5 pending leads', metric: 'follow_ups', target: 5, bonusPoints: 10 },
  { title: 'First Contact', description: 'Contact 8 new leads', metric: 'new_contacts', target: 8, bonusPoints: 15 },
  { title: 'Quote Machine', description: 'Send 4 quotes to customers', metric: 'quotes_sent', target: 4, bonusPoints: 15 },
  { title: 'Review Collector', description: 'Get 2 customer reviews', metric: 'reviews_received', target: 2, bonusPoints: 20 },
  { title: 'Early Bird', description: 'Log your first activity before 8 AM', metric: 'early_activity', target: 1, bonusPoints: 10 },
  { title: 'Inspection Blitz', description: 'Complete 3 roof inspections', metric: 'inspections_completed', target: 3, bonusPoints: 20 },
  { title: 'Money Monday', description: 'Close a deal worth $2,000+ in commissions', metric: 'big_deal', target: 2000, bonusPoints: 25 },
  { title: 'Team Assist', description: 'Help a teammate close a deal', metric: 'team_assists', target: 1, bonusPoints: 15 },
  { title: 'Perfect Day', description: 'Contact all assigned leads within 15 minutes', metric: 'all_contacted', target: 1, bonusPoints: 30 },
];

// =============================================================================
// Slug-to-Name Mapping for Commission Data
// =============================================================================

const SLUG_TO_COMMISSION_NAMES: Record<string, string[]> = {
  'hunter': ['Hunter Rivers', 'Hunter'],
  'aaron': ['Aaron Lussi', 'Aaron'],
  'greg': ['Greg Muse', 'Gregory Muse', 'Gregory Ray Muse'],
  'brendon': ['Brendon Muse', 'Brendon'],
  'rick': ['Rick'],
  'adam': ['Adam Rudell', 'Adam'],
  'boston': ['Boston Muse', 'Boston'],
  'joseph': ['Joseph Dowd', 'Joseph'],
  'michael-muse': ['Michael Muse', 'Michael'],
  'chris-muse': ['Chris Muse', 'Chris'],
};

// =============================================================================
// Gamification Service Class
// =============================================================================

class GamificationService {
  private dataPath: string;
  private commissionsPath: string;
  private cache: GamificationData | null = null;
  private commissionsCache: CommissionRecord[] | null = null;

  constructor() {
    this.dataPath = path.join(process.cwd(), 'data', 'gamification.json');
    this.commissionsPath = path.join(process.cwd(), 'data', 'commissions.json');
  }

  // ---------------------------------------------------------------------------
  // Data I/O
  // ---------------------------------------------------------------------------

  private loadData(): GamificationData {
    if (this.cache) return this.cache;
    try {
      const raw = fs.readFileSync(this.dataPath, 'utf-8');
      this.cache = JSON.parse(raw);
      return this.cache!;
    } catch {
      const empty: GamificationData = {
        repAchievements: [],
        contests: [],
        dailyChallenges: [],
        previousRanks: {},
        responseTimeCache: [],
        lastUpdated: '',
      };
      this.cache = empty;
      return empty;
    }
  }

  private saveData(data: GamificationData): void {
    data.lastUpdated = new Date().toISOString();
    fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2), 'utf-8');
    this.cache = data;
  }

  private loadCommissions(): CommissionRecord[] {
    if (this.commissionsCache) return this.commissionsCache;
    try {
      const raw = fs.readFileSync(this.commissionsPath, 'utf-8');
      this.commissionsCache = JSON.parse(raw);
      return this.commissionsCache!;
    } catch {
      return [];
    }
  }

  private getRepCommissions(repSlug: string): CommissionRecord[] {
    const commissions = this.loadCommissions();
    const names = SLUG_TO_COMMISSION_NAMES[repSlug];
    if (!names) return [];
    return commissions.filter(c =>
      names.some(n => c.salesRep.toLowerCase() === n.toLowerCase())
    );
  }

  private parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);
    if (isNaN(month) || isNaN(day) || isNaN(year)) return null;
    if (year < 100) year = 2000 + year;
    return new Date(year, month - 1, day);
  }

  private getRepSlugForName(name: string): string | null {
    const lower = name.toLowerCase();
    for (const [slug, names] of Object.entries(SLUG_TO_COMMISSION_NAMES)) {
      if (names.some(n => n.toLowerCase() === lower)) return slug;
    }
    // Fallback: try to find in TEAM_MEMBERS
    const member = TEAM_MEMBERS.find(m =>
      m.name.toLowerCase() === lower && m.isActive
    );
    return member?.slug || null;
  }

  private getRepNameForSlug(slug: string): string {
    const member = TEAM_MEMBERS.find(m => m.slug === slug);
    return member?.name || slug;
  }

  // ---------------------------------------------------------------------------
  // Streak Calculation
  // ---------------------------------------------------------------------------

  private calculateStreak(repSlug: string): number {
    const entries = this.getRepCommissions(repSlug);
    if (entries.length === 0) return 0;

    // Get unique sale dates, sorted descending
    const saleDates = entries
      .filter(e => e.amount > 0)
      .map(e => this.parseDate(e.date))
      .filter((d): d is Date => d !== null)
      .sort((a, b) => b.getTime() - a.getTime());

    if (saleDates.length === 0) return 0;

    // Deduplicate by day
    const uniqueDays: string[] = [];
    for (const d of saleDates) {
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!uniqueDays.includes(key)) uniqueDays.push(key);
    }

    // Count consecutive days from most recent
    let streak = 1;
    const sortedUnique = uniqueDays.map(k => {
      const [y, m, d] = k.split('-').map(Number);
      return new Date(y, m, d);
    }).sort((a, b) => b.getTime() - a.getTime());

    for (let i = 1; i < sortedUnique.length; i++) {
      const diff = sortedUnique[i - 1].getTime() - sortedUnique[i].getTime();
      const daysDiff = diff / (1000 * 60 * 60 * 24);
      if (daysDiff <= 1.5) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  // ---------------------------------------------------------------------------
  // Period Filtering
  // ---------------------------------------------------------------------------

  private filterByPeriod(
    entries: CommissionRecord[],
    period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'all_time'
  ): CommissionRecord[] {
    if (period === 'all_time') return entries;

    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'weekly': {
        const dayOfWeek = now.getDay();
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
        break;
      }
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarterly': {
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      }
      default:
        return entries;
    }

    return entries.filter(e => {
      const d = this.parseDate(e.date);
      return d && d >= startDate;
    });
  }

  // ---------------------------------------------------------------------------
  // Public Methods
  // ---------------------------------------------------------------------------

  /**
   * Refresh the JN response time cache stored in gamification.json.
   * Call this periodically (e.g., from a cron or admin action) to keep
   * the leaderboard response times up to date without making getLeaderboard async.
   */
  async refreshResponseTimeCache(): Promise<RepResponseStats[]> {
    try {
      const stats = await jnResponseMiner.getStoredResponseTimes();
      const data = this.loadData();
      data.responseTimeCache = stats;
      this.saveData(data);
      return stats;
    } catch (err) {
      console.error('[Gamification] Failed to refresh response time cache:', err);
      return [];
    }
  }

  getLeaderboard(period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'all_time' = 'all_time'): LeaderboardEntry[] {
    const commissions = this.loadCommissions();
    const data = this.loadData();
    const salesReps = getSalesReps();

    // Also include owners who sell
    const eligibleSlugs = [
      ...salesReps.map(r => r.slug),
      'michael-muse',
      'chris-muse',
    ];

    // Build rep stats from commissions
    const repStats: Map<string, {
      sales: number;
      revenue: number;
      saleDates: Date[];
    }> = new Map();

    for (const slug of eligibleSlugs) {
      const repCommissions = this.getRepCommissions(slug);
      const filtered = this.filterByPeriod(repCommissions, period);

      const paidEntries = filtered.filter(e => e.amount > 0);
      const totalRevenue = filtered.reduce((sum, e) => sum + e.amount, 0);
      const saleDates = paidEntries
        .map(e => this.parseDate(e.date))
        .filter((d): d is Date => d !== null);

      repStats.set(slug, {
        sales: paidEntries.length,
        revenue: Math.round(totalRevenue * 100) / 100,
        saleDates,
      });
    }

    // Calculate points for each rep
    const entries: LeaderboardEntry[] = [];

    for (const slug of eligibleSlugs) {
      const stats = repStats.get(slug);
      if (!stats) continue;

      // Get achievements for this rep
      const repAchievements = data.repAchievements
        .filter(a => a.repSlug === slug)
        .map(a => a.achievementId);

      // Calculate points from achievements
      let achievementPoints = 0;
      for (const achId of repAchievements) {
        const ach = ACHIEVEMENTS.find(a => a.id === achId);
        if (ach) achievementPoints += ach.points;
      }

      // Calculate activity-based points for the period
      const salesPoints = stats.sales * 5;
      const revenuePoints = Math.floor(stats.revenue / 1000) * 2;
      const totalPoints = achievementPoints + salesPoints + revenuePoints;

      // Calculate streak
      const streak = this.calculateStreak(slug);

      // Response time from cached JN mined data (refreshed via refreshResponseTimeCache())
      const cachedResponseTimes = data.responseTimeCache || [];
      const jnData = cachedResponseTimes.find(r => r.repSlug === slug);
      const responseTime = jnData && jnData.totalJobsAnalyzed > 0
        ? jnData.avgResponseMinutes
        : 0; // 0 indicates no data available

      // Simulated close rate - derived from commission data
      const allRepCommissions = this.getRepCommissions(slug);
      const totalDeals = allRepCommissions.length;
      const paidDeals = allRepCommissions.filter(e => e.amount > 0).length;
      const closeRate = totalDeals > 0
        ? Math.round((paidDeals / totalDeals) * 100 * 10) / 10
        : 0;

      entries.push({
        rank: 0,
        repSlug: slug,
        repName: this.getRepNameForSlug(slug),
        points: totalPoints,
        sales: stats.sales,
        revenue: stats.revenue,
        responseTime,
        closeRate,
        streak,
        achievements: repAchievements,
        trend: 'steady',
        previousRank: 0,
      });
    }

    // Sort by points descending, then revenue as tiebreaker
    entries.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.revenue - a.revenue;
    });

    // Assign ranks and calculate trends from stored previous ranks
    const storedPreviousRanks = data.previousRanks || {};

    entries.forEach((entry, index) => {
      entry.rank = index + 1;

      // Use stored previous rank if available, otherwise default to current (steady)
      const prevRank = storedPreviousRanks[entry.repSlug];
      entry.previousRank = prevRank != null ? prevRank : entry.rank;

      if (entry.rank < entry.previousRank) {
        entry.trend = 'up';
      } else if (entry.rank > entry.previousRank) {
        entry.trend = 'down';
      } else {
        entry.trend = 'steady';
      }
    });

    // Persist current ranks as previousRanks for next comparison
    const newPreviousRanks: Record<string, number> = {};
    for (const entry of entries) {
      newPreviousRanks[entry.repSlug] = entry.rank;
    }
    data.previousRanks = newPreviousRanks;
    this.saveData(data);

    return entries;
  }

  getRepProfile(repSlug: string): {
    rep: { slug: string; name: string };
    points: number;
    rank: number;
    achievements: RepAchievement[];
    stats: {
      totalSales: number;
      totalRevenue: number;
      streak: number;
      responseTime: number;
      closeRate: number;
    };
  } | null {
    const leaderboard = this.getLeaderboard('all_time');
    const entry = leaderboard.find(e => e.repSlug === repSlug);

    if (!entry) return null;

    const data = this.loadData();
    const achievements = data.repAchievements.filter(a => a.repSlug === repSlug);

    return {
      rep: { slug: entry.repSlug, name: entry.repName },
      points: entry.points,
      rank: entry.rank,
      achievements,
      stats: {
        totalSales: entry.sales,
        totalRevenue: entry.revenue,
        streak: entry.streak,
        responseTime: entry.responseTime,
        closeRate: entry.closeRate,
      },
    };
  }

  checkAndAwardAchievements(repSlug: string): RepAchievement[] {
    const data = this.loadData();
    const commissions = this.getRepCommissions(repSlug);
    const newAchievements: RepAchievement[] = [];
    const existingIds = data.repAchievements
      .filter(a => a.repSlug === repSlug)
      .map(a => a.achievementId);

    // Calculate rep stats for achievement checks
    const paidEntries = commissions.filter(e => e.amount > 0);
    const totalRevenue = commissions.reduce((sum, e) => sum + e.amount, 0);
    const totalSales = paidEntries.length;
    const streak = this.calculateStreak(repSlug);

    // Check each achievement
    for (const achievement of ACHIEVEMENTS) {
      if (existingIds.includes(achievement.id)) continue;

      let earned = false;

      switch (achievement.id) {
        case 'first_sale':
          earned = totalSales >= 1;
          break;
        case 'five_calls':
          // Award if they have any sales (proxy for calls)
          earned = totalSales >= 3;
          break;
        case 'quick_response':
          // Award based on activity (simulated - in production would use lead response data)
          earned = totalSales >= 5;
          break;
        case 'first_inspection':
          earned = totalSales >= 1;
          break;
        case 'ten_sales':
          earned = totalSales >= 10;
          break;
        case 'hot_streak_3':
          earned = streak >= 3;
          break;
        case 'revenue_10k':
          earned = totalRevenue >= 10000;
          break;
        case 'perfect_response':
          // Simulated - in production, check actual response times
          earned = totalSales >= 20;
          break;
        case 'twenty_five_sales':
          earned = totalSales >= 25;
          break;
        case 'hot_streak_7':
          earned = streak >= 7;
          break;
        case 'revenue_25k':
          earned = totalRevenue >= 25000;
          break;
        case 'five_star':
          // Simulated - in production, check actual reviews
          earned = totalSales >= 30;
          break;
        case 'top_closer': {
          // Check if this rep had the most sales in any recent month
          const leaderboard = this.getLeaderboard('monthly');
          earned = leaderboard.length > 0 && leaderboard[0].repSlug === repSlug;
          break;
        }
        case 'fifty_sales':
          earned = totalSales >= 50;
          break;
        case 'revenue_50k':
          earned = totalRevenue >= 50000;
          break;
        case 'hot_streak_14':
          earned = streak >= 14;
          break;
        case 'team_player': {
          const qLeaderboard = this.getLeaderboard('quarterly');
          earned = qLeaderboard.length > 0 && qLeaderboard[0].repSlug === repSlug;
          break;
        }
        case 'hundred_sales':
          earned = totalSales >= 100;
          break;
        case 'revenue_100k':
          earned = totalRevenue >= 100000;
          break;
        case 'top_annual': {
          const yearLeaderboard = this.getLeaderboard('all_time');
          earned = yearLeaderboard.length > 0 && yearLeaderboard[0].repSlug === repSlug;
          break;
        }
      }

      if (earned) {
        const repAchievement: RepAchievement = {
          id: crypto.randomBytes(6).toString('hex'),
          repSlug,
          repName: this.getRepNameForSlug(repSlug),
          achievementId: achievement.id,
          awardedAt: new Date().toISOString(),
          metadata: {
            sales: totalSales.toString(),
            revenue: totalRevenue.toFixed(2),
            streak: streak.toString(),
          },
        };
        newAchievements.push(repAchievement);
        data.repAchievements.push(repAchievement);
      }
    }

    if (newAchievements.length > 0) {
      this.saveData(data);
    }

    return newAchievements;
  }

  getAchievements(): Achievement[] {
    return [...ACHIEVEMENTS];
  }

  getRepAchievements(repSlug: string): RepAchievement[] {
    const data = this.loadData();
    return data.repAchievements.filter(a => a.repSlug === repSlug);
  }

  createContest(contestData: {
    name: string;
    description: string;
    type: 'individual' | 'team';
    metric: 'revenue' | 'deals' | 'leads_contacted' | 'response_time' | 'reviews';
    startDate: string;
    endDate: string;
    prize: string;
    createdBy: string;
  }): Contest {
    const data = this.loadData();

    const now = new Date();
    const start = new Date(contestData.startDate);
    const end = new Date(contestData.endDate);

    let status: Contest['status'] = 'upcoming';
    if (now >= start && now <= end) status = 'active';
    if (now > end) status = 'completed';

    // Auto-add all active sales reps as participants
    const salesReps = getSalesReps();
    const participants = salesReps.map(rep => ({
      repSlug: rep.slug,
      score: 0,
    }));

    const contest: Contest = {
      id: crypto.randomBytes(6).toString('hex'),
      name: contestData.name,
      description: contestData.description,
      type: contestData.type,
      metric: contestData.metric,
      startDate: contestData.startDate,
      endDate: contestData.endDate,
      prize: contestData.prize,
      status,
      participants,
      createdBy: contestData.createdBy,
      createdAt: new Date().toISOString(),
    };

    data.contests.push(contest);
    this.saveData(data);

    return contest;
  }

  getActiveContests(): Contest[] {
    const data = this.loadData();
    const now = new Date();

    // Update statuses
    let changed = false;
    for (const contest of data.contests) {
      const start = new Date(contest.startDate);
      const end = new Date(contest.endDate);

      let newStatus: Contest['status'] = 'upcoming';
      if (now >= start && now <= end) newStatus = 'active';
      if (now > end) newStatus = 'completed';

      if (contest.status !== newStatus) {
        contest.status = newStatus;
        changed = true;
      }
    }

    if (changed) {
      this.saveData(data);
    }

    return data.contests.filter(c => c.status === 'active' || c.status === 'upcoming');
  }

  getContests(status?: 'upcoming' | 'active' | 'completed'): Contest[] {
    const data = this.loadData();
    if (status) {
      return data.contests.filter(c => c.status === status);
    }
    return data.contests;
  }

  async updateContestScores(): Promise<void> {
    const data = this.loadData();
    const now = new Date();

    // Pre-fetch weekly numbers from Google Sheets for metrics that need it
    let weeklyNumbers: Awaited<ReturnType<typeof googleSheetsService.getRepWeeklyNumbers>> = [];
    const needsWeeklyData = data.contests.some(
      c => c.status === 'active' && (c.metric === 'response_time' || c.metric === 'reviews')
    );
    if (needsWeeklyData) {
      try {
        weeklyNumbers = await googleSheetsService.getRepWeeklyNumbers();
      } catch (err) {
        console.error('[Gamification] Failed to fetch weekly numbers from Sheets:', err);
      }
    }

    // Pre-fetch JN response times for response_time contests
    let jnResponseTimes: RepResponseStats[] = data.responseTimeCache || [];
    const needsResponseData = data.contests.some(
      c => c.status === 'active' && c.metric === 'response_time'
    );
    if (needsResponseData && jnResponseTimes.length === 0) {
      try {
        jnResponseTimes = await jnResponseMiner.getStoredResponseTimes();
      } catch (err) {
        console.error('[Gamification] Failed to fetch JN response times:', err);
      }
    }

    for (const contest of data.contests) {
      if (contest.status !== 'active') continue;

      for (const participant of contest.participants) {
        const entries = this.getRepCommissions(participant.repSlug);
        const contestStart = new Date(contest.startDate);
        const contestEntries = entries.filter(e => {
          const d = this.parseDate(e.date);
          return d && d >= contestStart && d <= now;
        });

        switch (contest.metric) {
          case 'revenue':
            participant.score = Math.round(
              contestEntries.reduce((sum, e) => sum + e.amount, 0) * 100
            ) / 100;
            break;
          case 'deals':
            participant.score = contestEntries.filter(e => e.amount > 0).length;
            break;
          case 'leads_contacted':
            participant.score = contestEntries.length;
            break;
          case 'response_time': {
            // Lower response time is better - score = inverted avg minutes
            // Use JN mined data first, then fall back to weekly numbers
            const jnData = jnResponseTimes.find(r => r.repSlug === participant.repSlug);
            if (jnData && jnData.totalJobsAnalyzed > 0) {
              // Invert: faster response = higher score (max 100)
              participant.score = Math.max(0, Math.round(100 - jnData.avgResponseMinutes));
            } else {
              // Fall back to weekly numbers: use followUpsMade as a proxy for responsiveness
              const repName = this.getRepNameForSlug(participant.repSlug);
              const repWeekly = weeklyNumbers.filter(
                w => w.repName.toLowerCase() === repName.toLowerCase()
              );
              if (repWeekly.length > 0) {
                const totalFollowUps = repWeekly.reduce((sum, w) => sum + w.followUpsMade, 0);
                participant.score = totalFollowUps;
              } else {
                participant.score = 0;
              }
            }
            break;
          }
          case 'reviews': {
            // Pull real review-related activity from weekly numbers
            // Use contractsSigned as a proxy (reviews correlate with completed jobs)
            const repName = this.getRepNameForSlug(participant.repSlug);
            const contestStartDate = contest.startDate;
            const repWeekly = weeklyNumbers.filter(w => {
              if (w.repName.toLowerCase() !== repName.toLowerCase()) return false;
              // Filter to weeks within the contest period
              return w.week >= contestStartDate.slice(0, 10);
            });
            if (repWeekly.length > 0) {
              // Sum up contracts signed during contest period as review proxy
              participant.score = repWeekly.reduce((sum, w) => sum + w.contractsSigned, 0);
            } else {
              participant.score = 0;
            }
            break;
          }
        }
      }

      // Sort participants by score
      contest.participants.sort((a, b) => b.score - a.score);

      // Check if completed
      if (new Date(contest.endDate) <= now) {
        contest.status = 'completed';
        if (contest.participants.length > 0) {
          contest.winnerId = contest.participants[0].repSlug;
        }
      }
    }

    this.saveData(data);
  }

  getDailyChallenge(): DailyChallenge {
    const data = this.loadData();
    const today = new Date().toISOString().split('T')[0];

    // Check if we already have a challenge for today
    const existing = data.dailyChallenges.find(c => c.date === today);
    if (existing) return existing;

    // Generate a new daily challenge
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
    );
    const templateIndex = dayOfYear % CHALLENGE_TEMPLATES.length;
    const template = CHALLENGE_TEMPLATES[templateIndex];

    const challenge: DailyChallenge = {
      id: crypto.randomBytes(6).toString('hex'),
      date: today,
      title: template.title,
      description: template.description,
      metric: template.metric,
      target: template.target,
      bonusPoints: template.bonusPoints,
      completedBy: [],
    };

    data.dailyChallenges.push(challenge);

    // Keep only last 30 days of challenges
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    data.dailyChallenges = data.dailyChallenges.filter(c =>
      new Date(c.date) >= thirtyDaysAgo
    );

    this.saveData(data);
    return challenge;
  }

  // Run achievement checks for all active sales reps
  checkAllAchievements(): { repSlug: string; newAchievements: RepAchievement[] }[] {
    const salesReps = getSalesReps();
    const results: { repSlug: string; newAchievements: RepAchievement[] }[] = [];

    for (const rep of salesReps) {
      const newAchievements = this.checkAndAwardAchievements(rep.slug);
      if (newAchievements.length > 0) {
        results.push({ repSlug: rep.slug, newAchievements });
      }
    }

    // Also check owners who sell
    for (const ownerSlug of ['michael-muse', 'chris-muse']) {
      const newAchievements = this.checkAndAwardAchievements(ownerSlug);
      if (newAchievements.length > 0) {
        results.push({ repSlug: ownerSlug, newAchievements });
      }
    }

    return results;
  }
}

// =============================================================================
// Export Singleton
// =============================================================================

export const gamificationService = new GamificationService();
export { ACHIEVEMENTS };
