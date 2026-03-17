/**
 * RCRS Master Report API
 *
 * GET /api/reports/master?type=daily|weekly|monthly|quarterly|annual
 *
 * Aggregates data from ALL data sources into a single comprehensive report.
 * Pulls from: commissions, leads, calls, job-progress, inventory, reviews,
 * storm-events, routes, time-entries, warranties, surveys, and more.
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJsonSafe<T = Record<string, unknown>>(fileName: string): T {
  try {
    const filePath = path.join(dataDir, fileName);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch {
    // Silently fall back
  }
  return {} as T;
}

function getDateRange(type: string): { start: Date; end: Date; label: string } {
  const now = new Date();
  const end = now;

  switch (type) {
    case 'daily': {
      const start = new Date(now);
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      return { start, end, label: 'Last 24 Hours' };
    }
    case 'weekly': {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      return { start, end, label: 'Last 7 Days' };
    }
    case 'monthly': {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      start.setHours(0, 0, 0, 0);
      return { start, end, label: 'Last 30 Days' };
    }
    case 'quarterly': {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 3);
      start.setHours(0, 0, 0, 0);
      return { start, end, label: 'Last Quarter' };
    }
    case 'annual': {
      const start = new Date(now.getFullYear(), 0, 1);
      return { start, end, label: 'Year to Date' };
    }
    default: {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      return { start, end, label: 'Last 7 Days' };
    }
  }
}

function parseDate(val: unknown): Date | null {
  if (!val) return null;
  const str = String(val);
  // Handle M/D/YYYY format from commissions.json
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const parts = str.split('/');
    return new Date(Number(parts[2]), Number(parts[0]) - 1, Number(parts[1]));
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function inRange(dateVal: unknown, start: Date, end: Date): boolean {
  const d = parseDate(dateVal);
  if (!d) return false;
  return d >= start && d <= end;
}

function formatCurrency(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ---------------------------------------------------------------------------
// Section collectors
// ---------------------------------------------------------------------------

interface AnyRecord {
  [key: string]: unknown;
}

function collectRevenue(start: Date, end: Date) {
  // Primary source: commissions.json (real commission transaction data)
  const commissions = readJsonSafe<AnyRecord[]>('commissions.json') || [];
  const commissionsArray = Array.isArray(commissions) ? commissions : [];

  const periodCommissions = commissionsArray.filter((c) => inRange(c.date, start, end));
  const totalCommissions = periodCommissions.reduce(
    (sum, c) => sum + (Number(c.amount) || 0),
    0
  );

  // Group by rep
  const repTotals: Record<string, { amount: number; count: number }> = {};
  periodCommissions.forEach((c) => {
    const rep = String(c.salesRep || 'Unknown');
    if (!repTotals[rep]) repTotals[rep] = { amount: 0, count: 0 };
    repTotals[rep].amount += Number(c.amount) || 0;
    repTotals[rep].count++;
  });

  const topReps = Object.entries(repTotals)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  // All-time totals for context
  const allTimeTotal = commissionsArray.reduce(
    (sum, c) => sum + (Number(c.amount) || 0),
    0
  );

  return {
    periodCommissions: totalCommissions,
    periodTransactions: periodCommissions.length,
    allTimeCommissions: allTimeTotal,
    allTimeTransactions: commissionsArray.length,
    topReps,
    avgCommission:
      periodCommissions.length > 0
        ? Math.round(totalCommissions / periodCommissions.length)
        : 0,
  };
}

function collectLeads(start: Date, end: Date) {
  const data = readJsonSafe<{ leads?: AnyRecord[] }>('leads.json');
  const leads = data.leads || [];

  const periodLeads = leads.filter((l) =>
    inRange(l.createdAt || l.date, start, end)
  );

  const byStatus: Record<string, number> = {};
  periodLeads.forEach((l) => {
    const status = String(l.status || 'unknown');
    byStatus[status] = (byStatus[status] || 0) + 1;
  });

  const converted = periodLeads.filter(
    (l) => l.status === 'closed' || l.status === 'won' || l.status === 'sold'
  );

  // Response times
  const responseTimes = periodLeads
    .filter((l) => l.respondedAt && (l.createdAt || l.date))
    .map((l) => {
      const created = parseDate(l.createdAt || l.date);
      const responded = parseDate(l.respondedAt);
      if (!created || !responded) return null;
      return (responded.getTime() - created.getTime()) / 60000;
    })
    .filter((t): t is number => t !== null);

  const avgResponseTime =
    responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : 0;

  // By source
  const bySource: Record<string, number> = {};
  periodLeads.forEach((l) => {
    const source = String(l.source || l.leadSource || 'Unknown');
    bySource[source] = (bySource[source] || 0) + 1;
  });

  return {
    total: periodLeads.length,
    converted: converted.length,
    conversionRate:
      periodLeads.length > 0
        ? Math.round((converted.length / periodLeads.length) * 100)
        : 0,
    byStatus,
    bySource,
    avgResponseMinutes: avgResponseTime,
    allTimeLeads: leads.length,
  };
}

function collectCalls(start: Date, end: Date) {
  const data = readJsonSafe<{ calls?: AnyRecord[] }>('calls.json');
  const calls = data.calls || [];

  const periodCalls = calls.filter((c) =>
    inRange(c.startTime || c.createdAt || c.date, start, end)
  );

  const inbound = periodCalls.filter((c) => c.direction === 'inbound').length;
  const outbound = periodCalls.filter((c) => c.direction === 'outbound').length;
  const missed = periodCalls.filter(
    (c) => c.status === 'missed' || c.status === 'no_answer'
  ).length;
  const voicemails = periodCalls.filter((c) => c.status === 'voicemail').length;

  const durations = periodCalls
    .filter((c) => typeof c.duration === 'number')
    .map((c) => c.duration as number);
  const avgDuration =
    durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

  // Busiest hour
  const hourCounts = new Array(24).fill(0);
  periodCalls.forEach((c) => {
    const d = parseDate(c.startTime || c.createdAt);
    if (d) hourCounts[d.getHours()]++;
  });
  const busiestHour = hourCounts.indexOf(Math.max(...hourCounts));

  return {
    total: periodCalls.length,
    inbound,
    outbound,
    missed,
    voicemails,
    avgDurationSeconds: avgDuration,
    busiestHour: busiestHour >= 0 ? busiestHour : 10,
    missedRate:
      periodCalls.length > 0
        ? Math.round((missed / periodCalls.length) * 100)
        : 0,
    allTimeCalls: calls.length,
  };
}

function collectJobProgress() {
  const data = readJsonSafe<{
    jobs?: AnyRecord[];
    phases?: AnyRecord[];
  }>('job-progress.json');
  const jobs = data.jobs || [];

  const byPhase: Record<string, number> = {};
  jobs.forEach((j) => {
    const phase = String(j.phase || j.status || 'unknown');
    byPhase[phase] = (byPhase[phase] || 0) + 1;
  });

  const completed = jobs.filter(
    (j) => j.phase === 'completed' || j.status === 'completed' || j.phase === 'done'
  ).length;
  const active = jobs.filter(
    (j) =>
      j.phase !== 'completed' &&
      j.status !== 'completed' &&
      j.phase !== 'done' &&
      j.phase !== 'cancelled'
  ).length;

  return {
    totalJobs: jobs.length,
    activeJobs: active,
    completedJobs: completed,
    byPhase,
  };
}

function collectInventory() {
  const data = readJsonSafe<{
    items?: AnyRecord[];
    products?: AnyRecord[];
  }>('inventory.json');
  const items = data.items || data.products || [];

  const lowStock = items.filter((item) => {
    const current = Number(item.currentQty || item.quantity || 0);
    const min = Number(item.minQty || item.reorderPoint || item.minStock || 10);
    return current <= min;
  });

  const totalValue = items.reduce((sum, item) => {
    const qty = Number(item.currentQty || item.quantity || 0);
    const cost = Number(item.cost || item.unitCost || 0);
    return sum + qty * cost;
  }, 0);

  const reorderNeeded = lowStock
    .map((item) => ({
      name: String(item.productName || item.name || 'Unknown'),
      current: Number(item.currentQty || item.quantity || 0),
      minimum: Number(item.minQty || item.reorderPoint || item.minStock || 10),
    }))
    .slice(0, 15);

  return {
    totalItems: items.length,
    lowStockCount: lowStock.length,
    estimatedValue: Math.round(totalValue),
    reorderNeeded,
  };
}

function collectCustomerSatisfaction() {
  // Reviews
  const reviewData = readJsonSafe<{ reviews?: AnyRecord[] }>('reviews.json');
  const reviews = reviewData.reviews || [];

  const ratings = reviews
    .filter((r) => typeof r.rating === 'number')
    .map((r) => r.rating as number);
  const avgRating =
    ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : 0;

  const fiveStars = ratings.filter((r) => r === 5).length;
  const fourStars = ratings.filter((r) => r === 4).length;

  // Surveys
  const surveyData = readJsonSafe<{ responses?: AnyRecord[] }>('survey-responses.json');
  const responses = surveyData.responses || [];

  const surveyScores = responses
    .filter((r) => typeof r.score === 'number' || typeof r.nps === 'number')
    .map((r) => Number(r.score || r.nps || 0));
  const avgSurveyScore =
    surveyScores.length > 0
      ? Math.round(
          (surveyScores.reduce((a, b) => a + b, 0) / surveyScores.length) * 10
        ) / 10
      : 0;

  return {
    totalReviews: reviews.length,
    avgRating,
    fiveStarCount: fiveStars,
    fourPlusRate:
      ratings.length > 0
        ? Math.round(((fiveStars + fourStars) / ratings.length) * 100)
        : 0,
    surveyResponses: responses.length,
    avgSurveyScore,
  };
}

function collectWeatherEvents(start: Date, end: Date) {
  const data = readJsonSafe<{ events?: AnyRecord[] }>('storm-events.json');
  const events = data.events || [];

  const periodEvents = events.filter((e) =>
    inRange(e.date || e.createdAt || e.eventDate, start, end)
  );

  const activeAlerts = events.filter(
    (e) => e.status === 'active' || e.status === 'warning'
  ).length;

  // By type
  const byType: Record<string, number> = {};
  periodEvents.forEach((e) => {
    const type = String(e.type || e.eventType || 'unknown');
    byType[type] = (byType[type] || 0) + 1;
  });

  return {
    periodEvents: periodEvents.length,
    activeAlerts,
    byType,
    estimatedLeads: Math.round(periodEvents.length * 3.5),
    allTimeEvents: events.length,
  };
}

function collectDeliveries(start: Date, end: Date) {
  const routeData = readJsonSafe<{ routes?: AnyRecord[] }>('routes.json');
  const routes = routeData.routes || [];

  const periodRoutes = routes.filter((r) =>
    inRange(r.date || r.createdAt || r.scheduledDate, start, end)
  );

  const completed = periodRoutes.filter(
    (r) => r.status === 'completed' || r.status === 'delivered'
  ).length;
  const onTime = periodRoutes.filter((r) => r.onTime === true).length;
  const delayed = periodRoutes.filter(
    (r) => r.status === 'delayed' || r.onTime === false
  ).length;

  const totalStops = periodRoutes.reduce(
    (sum, r) => sum + (Number(r.stops) || Number(r.stopCount) || 1),
    0
  );
  const avgStops =
    periodRoutes.length > 0 ? Math.round(totalStops / periodRoutes.length) : 0;

  const onTimeRate =
    completed > 0 ? Math.round((onTime / completed) * 100) : 0;

  return {
    totalRoutes: periodRoutes.length,
    completed,
    delayed,
    onTimeRate,
    avgStopsPerRoute: avgStops,
    totalStops,
    allTimeRoutes: routes.length,
  };
}

function collectTimeTracking(start: Date, end: Date) {
  const data = readJsonSafe<{ entries?: AnyRecord[] }>('time-entries.json');
  const entries = data.entries || [];

  const periodEntries = entries.filter((e) =>
    inRange(e.date || e.createdAt || e.clockIn, start, end)
  );

  // Total hours
  const totalHours = periodEntries.reduce(
    (sum, e) => sum + (Number(e.hours) || Number(e.totalHours) || 0),
    0
  );

  // By employee
  const byEmployee: Record<string, number> = {};
  periodEntries.forEach((e) => {
    const emp = String(e.employee || e.name || e.userId || 'Unknown');
    byEmployee[emp] = (byEmployee[emp] || 0) + (Number(e.hours) || Number(e.totalHours) || 0);
  });

  const topEmployees = Object.entries(byEmployee)
    .map(([name, hours]) => ({ name, hours: Math.round(hours * 10) / 10 }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 10);

  // Overtime (over 8 hours/day or 40/week)
  const overtimeEntries = periodEntries.filter(
    (e) => (Number(e.hours) || 0) > 8 || e.overtime === true
  ).length;

  return {
    totalHours: Math.round(totalHours * 10) / 10,
    totalEntries: periodEntries.length,
    avgHoursPerEntry:
      periodEntries.length > 0
        ? Math.round((totalHours / periodEntries.length) * 10) / 10
        : 0,
    overtimeEntries,
    topEmployees,
    allTimeEntries: entries.length,
  };
}

function collectWarranties() {
  // warranties.json may not exist yet
  const data = readJsonSafe<{ warranties?: AnyRecord[] }>('warranties.json');
  const warranties = data.warranties || [];

  const now = new Date();
  const thirtyDays = new Date();
  thirtyDays.setDate(thirtyDays.getDate() + 30);

  const active = warranties.filter(
    (w) => w.status === 'active' || w.status === 'valid'
  ).length;

  const expiringSoon = warranties.filter((w) => {
    const expiry = parseDate(w.expiryDate || w.endDate);
    if (!expiry) return false;
    return expiry <= thirtyDays && expiry >= now;
  }).length;

  const claims = warranties.filter(
    (w) => w.status === 'claim' || w.status === 'claim_filed' || w.hasClaim === true
  ).length;

  return {
    totalWarranties: warranties.length,
    active,
    expiringSoon,
    activeClaims: claims,
  };
}

function collectSubcontractors() {
  const data = readJsonSafe<{ subcontractors?: AnyRecord[] }>('subcontractors.json');
  const subs = data.subcontractors || [];

  const activeSubs = subs.filter(
    (s) => s.status === 'active' || s.active === true
  ).length;

  const avgRating =
    subs.length > 0
      ? Math.round(
          (subs.reduce((sum, s) => sum + (Number(s.rating) || 0), 0) / subs.length) *
            10
        ) / 10
      : 0;

  return {
    total: subs.length,
    active: activeSubs,
    avgRating,
  };
}

function collectOpenItems() {
  const leadsData = readJsonSafe<{ leads?: AnyRecord[] }>('leads.json');
  const leads = leadsData.leads || [];

  const notificationsData = readJsonSafe<{ notifications?: AnyRecord[] }>(
    'notifications.json'
  );
  const notifications = notificationsData.notifications || [];

  const now = new Date();

  const pendingApprovals = leads.filter(
    (l) => l.status === 'pending_approval' || l.status === 'awaiting_approval'
  ).length;

  const overdueFollowups = leads.filter((l) => {
    if (l.followUpDate) {
      const followUp = parseDate(l.followUpDate);
      return followUp && followUp < now && l.status !== 'closed' && l.status !== 'won';
    }
    return false;
  }).length;

  const unreadMessages = notifications.filter(
    (n) => n.read === false || n.status === 'unread'
  ).length;

  return {
    pendingApprovals,
    overdueFollowups,
    unreadMessages,
    totalNotifications: notifications.length,
  };
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'weekly';

    const validTypes = ['daily', 'weekly', 'monthly', 'quarterly', 'annual'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        {
          error: `Invalid report type. Use: ${validTypes.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const { start, end, label } = getDateRange(type);

    // Collect all sections
    const report = {
      meta: {
        type,
        label,
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
        generatedAt: new Date().toISOString(),
        generatedBy: 'master-report-api',
      },
      revenue: collectRevenue(start, end),
      leads: collectLeads(start, end),
      calls: collectCalls(start, end),
      jobProgress: collectJobProgress(),
      inventory: collectInventory(),
      customerSatisfaction: collectCustomerSatisfaction(),
      weatherEvents: collectWeatherEvents(start, end),
      deliveries: collectDeliveries(start, end),
      timeTracking: collectTimeTracking(start, end),
      warranties: collectWarranties(),
      subcontractors: collectSubcontractors(),
      openItems: collectOpenItems(),
    };

    // Compute summary highlights
    const summary = {
      revenueMTD: formatCurrency(report.revenue.periodCommissions),
      activeJobs: report.jobProgress.activeJobs,
      openLeads: report.leads.total,
      conversionRate: report.leads.conversionRate + '%',
      totalCalls: report.calls.total,
      missedCallRate: report.calls.missedRate + '%',
      lowStockAlerts: report.inventory.lowStockCount,
      deliveriesCompleted: report.deliveries.completed,
      onTimeRate: report.deliveries.onTimeRate + '%',
      avgRating: report.customerSatisfaction.avgRating,
      hoursLogged: report.timeTracking.totalHours,
      weatherAlerts: report.weatherEvents.activeAlerts,
      pendingItems:
        report.openItems.pendingApprovals +
        report.openItems.overdueFollowups +
        report.openItems.unreadMessages,
    };

    return NextResponse.json({
      success: true,
      summary,
      report,
    });
  } catch (error) {
    console.error('[Master Report API] Error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to generate master report';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
