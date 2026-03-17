import { requireAuth } from '@/lib/auth-service';
import { apiSuccess, apiError } from '@/lib/api-response';
import { jnSyncEngine } from '@/lib/jn-sync-engine';
import { isJobNimbusConfigured } from '@/lib/jobnimbus-service';
import { TEAM_MEMBERS, resolveCommissionName } from '@/lib/team-roles';
import { analyzeResponseTimes } from '@/lib/lead-response-analysis';
import commissionsRaw from '@/data/commissions.json';
import competitionConfigRaw from '@/data/competition-config.json';

interface RawCommission {
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
  return new Date(year, month - 1, day);
}

// NON_SALES: excluded from team comparison
const NON_SALES = ['michael muse', 'chris muse', 'sara hill', 'john cordonis', 'bart roberts',
  'destin mccary', 'tia muse morris', 'richard geahr', 'travis wages'];

export async function GET() {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const currentUser = TEAM_MEMBERS.find(
      m => m.id === auth.user.userId || m.email === auth.user.email
    );
    const repName = currentUser?.name || auth.user.name;
    const repSlug = currentUser?.slug || '';

    const rawData = commissionsRaw as RawCommission[];

    // Resolve entity names and find this rep's data
    const repCommissions = rawData.filter(r => {
      const resolved = resolveCommissionName(r.salesRep);
      return resolved.toLowerCase() === repName.toLowerCase();
    });

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const isH1 = now.getMonth() <= 5;
    const biannualStart = isH1 ? new Date(now.getFullYear(), 0, 1) : new Date(now.getFullYear(), 6, 1);

    let totalCommissions = 0;
    let monthlyCommissions = 0;
    let weeklyCommissions = 0;
    let quarterlyCommissions = 0;
    let yearlyCommissions = 0;
    let biannualCommissions = 0;
    let monthlyDeals = 0, weeklyDeals = 0, quarterlyDeals = 0, yearlyDeals = 0, biannualDeals = 0;

    // Monthly trend (last 12 months)
    const monthlyTrend: { month: string; amount: number; deals: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthlyTrend.push({ month: m.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }), amount: 0, deals: 0 });
    }

    for (const r of repCommissions) {
      totalCommissions += r.amount;
      const d = parseDate(r.date);
      if (!d) continue;
      if (d >= monthStart) { monthlyCommissions += r.amount; monthlyDeals++; }
      if (d >= weekStart) { weeklyCommissions += r.amount; weeklyDeals++; }
      if (d >= quarterStart) { quarterlyCommissions += r.amount; quarterlyDeals++; }
      if (d >= yearStart) { yearlyCommissions += r.amount; yearlyDeals++; }
      if (d >= biannualStart) { biannualCommissions += r.amount; biannualDeals++; }
      // Trend
      for (let i = 11; i >= 0; i--) {
        const trendMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const trendEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        if (d >= trendMonth && d <= trendEnd) { monthlyTrend[11 - i].amount += r.amount; monthlyTrend[11 - i].deals++; break; }
      }
    }

    // Team comparison
    const teamByRep: Record<string, { monthly: number; yearly: number; deals: number }> = {};
    for (const r of rawData) {
      const resolved = resolveCommissionName(r.salesRep);
      if (NON_SALES.includes(resolved.toLowerCase())) continue;
      const d = parseDate(r.date);
      if (!d) continue;
      if (!teamByRep[resolved]) teamByRep[resolved] = { monthly: 0, yearly: 0, deals: 0 };
      if (d >= monthStart) teamByRep[resolved].monthly += r.amount;
      if (d >= yearStart) { teamByRep[resolved].yearly += r.amount; teamByRep[resolved].deals++; }
    }
    const teamNames = Object.keys(teamByRep);
    const teamAvgMonthly = teamNames.length > 0 ? teamNames.reduce((s, n) => s + teamByRep[n].monthly, 0) / teamNames.length : 0;
    const teamAvgYearly = teamNames.length > 0 ? teamNames.reduce((s, n) => s + teamByRep[n].yearly, 0) / teamNames.length : 0;
    const monthlyRanks = teamNames.map(n => ({ name: n, amount: teamByRep[n].monthly })).sort((a, b) => b.amount - a.amount);
    const myRank = monthlyRanks.findIndex(r => r.name.toLowerCase() === repName.toLowerCase()) + 1;

    // Competition tiers
    let currentTier = null;
    let nextTier = null;
    try {
      const config = competitionConfigRaw as Record<string, unknown>;
      const tiers = (config.monthlyBonusTiers || config.bonusTiers || []) as Array<{ threshold: number; bonus: number; label: string }>;
      currentTier = [...tiers].reverse().find((t: { threshold: number }) => monthlyCommissions >= t.threshold) || null;
      nextTier = tiers.find((t: { threshold: number }) => monthlyCommissions < t.threshold) || null;
    } catch {}

    // Projections
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const projectedMonthly = dayOfMonth > 0 ? (monthlyCommissions / dayOfMonth) * daysInMonth : 0;

    // Response time
    let responseGrade = 'N/A';
    let avgResponseMinutes = 0;
    try {
      const responseAnalytics = await analyzeResponseTimes({ rep: repSlug });
      const repSummary = responseAnalytics.byRep.find(
        (r: { repSlug: string; repName: string; grade: string; avgMinutes: number }) =>
          r.repSlug === repSlug || r.repName.toLowerCase() === repName.toLowerCase()
      );
      if (repSummary) { responseGrade = repSummary.grade; avgResponseMinutes = Math.round(repSummary.avgMinutes * 10) / 10; }
    } catch {}

    // JN metrics
    let closeRate = 0, totalRevenue = 0, closedRevenue = 0, totalJobs = 0, winCount = 0, lossCount = 0;
    if (isJobNimbusConfigured()) {
      try {
        const metrics = await jnSyncEngine.getRepSalesMetrics(repName, 12).catch(() => null);
        if (metrics) {
          closeRate = Math.round(metrics.winRate * 10) / 10;
          totalRevenue = Math.round(metrics.totalRevenue * 100) / 100;
          closedRevenue = Math.round(metrics.closedRevenue * 100) / 100;
          totalJobs = metrics.totalJobs; winCount = metrics.winCount; lossCount = metrics.lossCount;
        }
      } catch {}
    }

    return apiSuccess({
      rep: repName,
      commissions: {
        total: Math.round(totalCommissions * 100) / 100,
        weekly: Math.round(weeklyCommissions * 100) / 100,
        monthly: Math.round(monthlyCommissions * 100) / 100,
        quarterly: Math.round(quarterlyCommissions * 100) / 100,
        biannual: Math.round(biannualCommissions * 100) / 100,
        yearly: Math.round(yearlyCommissions * 100) / 100,
        transactions: repCommissions.length,
        weeklyDeals, monthlyDeals, quarterlyDeals, biannualDeals, yearlyDeals,
      },
      trends: monthlyTrend,
      teamComparison: {
        teamAvgMonthly: Math.round(teamAvgMonthly * 100) / 100,
        teamAvgYearly: Math.round(teamAvgYearly * 100) / 100,
        rank: myRank || teamNames.length,
        totalReps: teamNames.length,
        vsTeamMonthly: Math.round((monthlyCommissions - teamAvgMonthly) * 100) / 100,
      },
      competition: {
        currentTier, nextTier,
        amountToNext: nextTier ? Math.round((nextTier.threshold - monthlyCommissions) * 100) / 100 : 0,
        projectedMonthly: Math.round(projectedMonthly * 100) / 100,
      },
      responseTime: { grade: responseGrade, avgMinutes: avgResponseMinutes },
      sales: { closeRate, totalRevenue, closedRevenue, totalJobs, winCount, lossCount },
    });
  } catch (error) {
    console.error('Error fetching performance:', error);
    return apiError('Failed to load performance data', 500);
  }
}
