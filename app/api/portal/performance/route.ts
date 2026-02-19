import { requireAuth } from '@/lib/auth-service';
import { apiSuccess, apiError } from '@/lib/api-response';
import { jnSyncEngine } from '@/lib/jn-sync-engine';
import { isJobNimbusConfigured } from '@/lib/jobnimbus-service';
import { TEAM_MEMBERS } from '@/lib/team-roles';
import { analyzeResponseTimes } from '@/lib/lead-response-analysis';
import commissionsData from '@/data/commissions.json';

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

export async function GET() {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const currentUser = TEAM_MEMBERS.find(
      m => m.id === auth.user.userId || m.email === auth.user.email
    );
    const repName = currentUser?.name || auth.user.name;
    const repSlug = currentUser?.slug || '';

    // Commission stats
    const rawData = commissionsData as RawCommission[];
    const repCommissions = rawData.filter(r =>
      r.salesRep.replace(/\s+/g, ' ').trim().toLowerCase() === repName.toLowerCase() ||
      r.salesRep.replace(/\s+/g, ' ').trim().toLowerCase().split(' ')[0] === repName.toLowerCase().split(' ')[0]
    );

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let totalCommissions = 0;
    let monthlyCommissions = 0;
    for (const r of repCommissions) {
      totalCommissions += r.amount;
      const d = parseDate(r.date);
      if (d && d >= monthStart) monthlyCommissions += r.amount;
    }

    // Response time
    let responseGrade = 'N/A';
    let avgResponseMinutes = 0;
    try {
      const responseAnalytics = await analyzeResponseTimes({ rep: repSlug });
      const repSummary = responseAnalytics.byRep.find(
        r => r.repSlug === repSlug || r.repName.toLowerCase() === repName.toLowerCase()
      );
      if (repSummary) {
        responseGrade = repSummary.grade;
        avgResponseMinutes = Math.round(repSummary.avgMinutes * 10) / 10;
      }
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
          totalJobs = metrics.totalJobs;
          winCount = metrics.winCount;
          lossCount = metrics.lossCount;
        }
      } catch {}
    }

    return apiSuccess({
      rep: repName,
      commissions: {
        total: Math.round(totalCommissions * 100) / 100,
        monthly: Math.round(monthlyCommissions * 100) / 100,
        transactions: repCommissions.length,
      },
      responseTime: { grade: responseGrade, avgMinutes: avgResponseMinutes },
      sales: { closeRate, totalRevenue, closedRevenue, totalJobs, winCount, lossCount },
    });
  } catch (error) {
    console.error('Error fetching performance:', error);
    return apiError('Failed to load performance data', 500);
  }
}
