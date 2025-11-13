/**
 * Dashboard Metrics Calculator
 * Business intelligence metrics for lead management dashboard
 */

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  preferredInspector?: string;
  timestamp: Date;
  status: 'new' | 'contacted' | 'scheduled' | 'quoted' | 'won' | 'lost';
  score: number;
  priority: 'hot' | 'warm' | 'cold';
  source?: string;
  contactedAt?: Date;
  scheduledAt?: Date;
  quotedAt?: Date;
  closedAt?: Date;
  revenue?: number;
  notes?: string;
}

export interface DashboardMetrics {
  // Lead counts
  totalLeads: number;
  newLeads: number;
  contactedLeads: number;
  scheduledInspections: number;
  quotesProvided: number;
  projectsWon: number;
  projectsLost: number;

  // Lead quality
  averageLeadScore: number;
  hotLeadsCount: number;
  warmLeadsCount: number;
  coldLeadsCount: number;
  hotLeadsPercent: number;

  // Response times
  averageResponseTime: number; // in hours
  leadsContactedWithin1Hour: number;
  leadsContactedWithin1HourPercent: number;
  leadsContactedWithin24Hours: number;
  leadsOver24HoursOld: number;

  // Conversion rates
  contactToScheduleRate: number;
  scheduleToQuoteRate: number;
  quoteToWinRate: number;
  overallConversionRate: number;

  // Revenue
  totalRevenue: number;
  averageProjectValue: number;
  revenuePerLead: number;
  projectedMonthlyRevenue: number;

  // Time metrics
  averageTimeToContact: number; // hours
  averageTimeToSchedule: number; // days
  averageTimeToQuote: number; // days
  averageTimeToClose: number; // days

  // Trends
  leadsThisWeek: number;
  leadsLastWeek: number;
  weekOverWeekGrowth: number;
  leadsThisMonth: number;
  leadsLastMonth: number;
  monthOverMonthGrowth: number;
}

export interface LeadsBySource {
  [source: string]: number;
}

export interface LeadsByInspector {
  inspector: string;
  leadsAssigned: number;
  projectsWon: number;
  conversionRate: number;
  revenue: number;
}

export interface TimeSeriesData {
  date: string;
  leads: number;
  conversions: number;
  revenue: number;
}

/**
 * Calculate comprehensive dashboard metrics from leads data
 */
export function calculateDashboardMetrics(leads: Lead[]): DashboardMetrics {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // Basic counts
  const totalLeads = leads.length;
  const newLeads = leads.filter((l) => l.status === 'new').length;
  const contactedLeads = leads.filter((l) =>
    ['contacted', 'scheduled', 'quoted', 'won', 'lost'].includes(l.status)
  ).length;
  const scheduledInspections = leads.filter((l) =>
    ['scheduled', 'quoted', 'won', 'lost'].includes(l.status)
  ).length;
  const quotesProvided = leads.filter((l) =>
    ['quoted', 'won', 'lost'].includes(l.status)
  ).length;
  const projectsWon = leads.filter((l) => l.status === 'won').length;
  const projectsLost = leads.filter((l) => l.status === 'lost').length;

  // Lead quality metrics
  const leadScores = leads.map((l) => l.score).filter((s) => s > 0);
  const averageLeadScore =
    leadScores.length > 0
      ? leadScores.reduce((sum, score) => sum + score, 0) / leadScores.length
      : 0;

  const hotLeadsCount = leads.filter((l) => l.priority === 'hot').length;
  const warmLeadsCount = leads.filter((l) => l.priority === 'warm').length;
  const coldLeadsCount = leads.filter((l) => l.priority === 'cold').length;
  const hotLeadsPercent = totalLeads > 0 ? (hotLeadsCount / totalLeads) * 100 : 0;

  // Response time metrics
  const contactedLeadsWithTime = leads.filter(
    (l) => l.contactedAt && l.timestamp
  );
  const responseTimes = contactedLeadsWithTime.map((l) => {
    const responseTime =
      (new Date(l.contactedAt!).getTime() - new Date(l.timestamp).getTime()) /
      (1000 * 60 * 60); // hours
    return responseTime;
  });
  const averageResponseTime =
    responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) /
        responseTimes.length
      : 0;

  const leadsContactedWithin1Hour = contactedLeadsWithTime.filter((l) => {
    const responseTime =
      (new Date(l.contactedAt!).getTime() - new Date(l.timestamp).getTime()) /
      (1000 * 60 * 60);
    return responseTime <= 1;
  }).length;

  const leadsContactedWithin1HourPercent =
    contactedLeads > 0 ? (leadsContactedWithin1Hour / contactedLeads) * 100 : 0;

  const leadsContactedWithin24Hours = contactedLeadsWithTime.filter((l) => {
    const responseTime =
      (new Date(l.contactedAt!).getTime() - new Date(l.timestamp).getTime()) /
      (1000 * 60 * 60);
    return responseTime <= 24;
  }).length;

  const leadsOver24HoursOld = leads.filter((l) => {
    return (
      l.status === 'new' &&
      new Date(l.timestamp).getTime() < oneDayAgo.getTime()
    );
  }).length;

  // Conversion rates
  const contactToScheduleRate =
    contactedLeads > 0 ? (scheduledInspections / contactedLeads) * 100 : 0;
  const scheduleToQuoteRate =
    scheduledInspections > 0 ? (quotesProvided / scheduledInspections) * 100 : 0;
  const quoteToWinRate =
    quotesProvided > 0 ? (projectsWon / quotesProvided) * 100 : 0;
  const overallConversionRate =
    totalLeads > 0 ? (projectsWon / totalLeads) * 100 : 0;

  // Revenue metrics
  const wonLeads = leads.filter((l) => l.status === 'won' && l.revenue);
  const totalRevenue = wonLeads.reduce((sum, l) => sum + (l.revenue || 0), 0);
  const averageProjectValue = wonLeads.length > 0 ? totalRevenue / wonLeads.length : 0;
  const revenuePerLead = totalLeads > 0 ? totalRevenue / totalLeads : 0;

  // Projected revenue based on current pipeline
  const quotedValue = leads
    .filter((l) => l.status === 'quoted')
    .reduce((sum, l) => sum + (l.revenue || averageProjectValue), 0);
  const projectedMonthlyRevenue = totalRevenue + quotedValue * (quoteToWinRate / 100);

  // Time to action metrics
  const avgTimeToContact = averageResponseTime;

  const scheduledLeadsWithTime = leads.filter((l) => l.scheduledAt && l.contactedAt);
  const timeToSchedule = scheduledLeadsWithTime.map((l) => {
    return (
      (new Date(l.scheduledAt!).getTime() - new Date(l.contactedAt!).getTime()) /
      (1000 * 60 * 60 * 24)
    ); // days
  });
  const averageTimeToSchedule =
    timeToSchedule.length > 0
      ? timeToSchedule.reduce((sum, time) => sum + time, 0) / timeToSchedule.length
      : 0;

  const quotedLeadsWithTime = leads.filter((l) => l.quotedAt && l.scheduledAt);
  const timeToQuote = quotedLeadsWithTime.map((l) => {
    return (
      (new Date(l.quotedAt!).getTime() - new Date(l.scheduledAt!).getTime()) /
      (1000 * 60 * 60 * 24)
    ); // days
  });
  const averageTimeToQuote =
    timeToQuote.length > 0
      ? timeToQuote.reduce((sum, time) => sum + time, 0) / timeToQuote.length
      : 0;

  const closedLeadsWithTime = wonLeads.filter((l) => l.closedAt && l.quotedAt);
  const timeToClose = closedLeadsWithTime.map((l) => {
    return (
      (new Date(l.closedAt!).getTime() - new Date(l.quotedAt!).getTime()) /
      (1000 * 60 * 60 * 24)
    ); // days
  });
  const averageTimeToClose =
    timeToClose.length > 0
      ? timeToClose.reduce((sum, time) => sum + time, 0) / timeToClose.length
      : 0;

  // Trend analysis
  const leadsThisWeek = leads.filter(
    (l) => new Date(l.timestamp) >= oneWeekAgo
  ).length;
  const leadsLastWeek = leads.filter(
    (l) =>
      new Date(l.timestamp) >= twoWeeksAgo &&
      new Date(l.timestamp) < oneWeekAgo
  ).length;
  const weekOverWeekGrowth =
    leadsLastWeek > 0 ? ((leadsThisWeek - leadsLastWeek) / leadsLastWeek) * 100 : 0;

  const leadsThisMonth = leads.filter(
    (l) => new Date(l.timestamp) >= oneMonthAgo
  ).length;
  const leadsLastMonth = leads.filter(
    (l) =>
      new Date(l.timestamp) >= twoMonthsAgo &&
      new Date(l.timestamp) < oneMonthAgo
  ).length;
  const monthOverMonthGrowth =
    leadsLastMonth > 0
      ? ((leadsThisMonth - leadsLastMonth) / leadsLastMonth) * 100
      : 0;

  return {
    totalLeads,
    newLeads,
    contactedLeads,
    scheduledInspections,
    quotesProvided,
    projectsWon,
    projectsLost,
    averageLeadScore: Math.round(averageLeadScore),
    hotLeadsCount,
    warmLeadsCount,
    coldLeadsCount,
    hotLeadsPercent: Math.round(hotLeadsPercent),
    averageResponseTime: Math.round(averageResponseTime * 10) / 10,
    leadsContactedWithin1Hour,
    leadsContactedWithin1HourPercent: Math.round(leadsContactedWithin1HourPercent),
    leadsContactedWithin24Hours,
    leadsOver24HoursOld,
    contactToScheduleRate: Math.round(contactToScheduleRate),
    scheduleToQuoteRate: Math.round(scheduleToQuoteRate),
    quoteToWinRate: Math.round(quoteToWinRate),
    overallConversionRate: Math.round(overallConversionRate),
    totalRevenue,
    averageProjectValue: Math.round(averageProjectValue),
    revenuePerLead: Math.round(revenuePerLead),
    projectedMonthlyRevenue: Math.round(projectedMonthlyRevenue),
    averageTimeToContact: Math.round(avgTimeToContact * 10) / 10,
    averageTimeToSchedule: Math.round(averageTimeToSchedule * 10) / 10,
    averageTimeToQuote: Math.round(averageTimeToQuote * 10) / 10,
    averageTimeToClose: Math.round(averageTimeToClose * 10) / 10,
    leadsThisWeek,
    leadsLastWeek,
    weekOverWeekGrowth: Math.round(weekOverWeekGrowth),
    leadsThisMonth,
    leadsLastMonth,
    monthOverMonthGrowth: Math.round(monthOverMonthGrowth),
  };
}

/**
 * Group leads by source
 */
export function groupLeadsBySource(leads: Lead[]): LeadsBySource {
  const grouped: LeadsBySource = {};

  leads.forEach((lead) => {
    const source = lead.source || 'Direct';
    grouped[source] = (grouped[source] || 0) + 1;
  });

  return grouped;
}

/**
 * Calculate metrics by inspector
 */
export function calculateInspectorMetrics(leads: Lead[]): LeadsByInspector[] {
  const byInspector: { [key: string]: Lead[] } = {};

  leads.forEach((lead) => {
    const inspector = lead.preferredInspector || 'First Available';
    if (!byInspector[inspector]) {
      byInspector[inspector] = [];
    }
    byInspector[inspector].push(lead);
  });

  return Object.entries(byInspector).map(([inspector, inspectorLeads]) => {
    const projectsWon = inspectorLeads.filter((l) => l.status === 'won').length;
    const conversionRate =
      inspectorLeads.length > 0 ? (projectsWon / inspectorLeads.length) * 100 : 0;
    const revenue = inspectorLeads
      .filter((l) => l.status === 'won')
      .reduce((sum, l) => sum + (l.revenue || 0), 0);

    return {
      inspector,
      leadsAssigned: inspectorLeads.length,
      projectsWon,
      conversionRate: Math.round(conversionRate),
      revenue,
    };
  });
}

/**
 * Generate time series data for charts
 */
export function generateTimeSeriesData(
  leads: Lead[],
  days: number = 30
): TimeSeriesData[] {
  const data: TimeSeriesData[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];

    const dayLeads = leads.filter((l) => {
      const leadDate = new Date(l.timestamp).toISOString().split('T')[0];
      return leadDate === dateStr;
    });

    const conversions = dayLeads.filter((l) => l.status === 'won').length;
    const revenue = dayLeads
      .filter((l) => l.status === 'won')
      .reduce((sum, l) => sum + (l.revenue || 0), 0);

    data.push({
      date: dateStr,
      leads: dayLeads.length,
      conversions,
      revenue,
    });
  }

  return data;
}

/**
 * Get urgent actions needed
 */
export function getUrgentActions(leads: Lead[]): string[] {
  const actions: string[] = [];
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const oldNewLeads = leads.filter(
    (l) => l.status === 'new' && new Date(l.timestamp) < oneDayAgo
  );

  if (oldNewLeads.length > 0) {
    actions.push(
      `🚨 URGENT: ${oldNewLeads.length} lead${
        oldNewLeads.length > 1 ? 's' : ''
      } over 24 hours old - call immediately!`
    );
  }

  const hotLeads = leads.filter((l) => l.priority === 'hot' && l.status === 'new');
  if (hotLeads.length > 0) {
    actions.push(
      `🔥 ${hotLeads.length} HOT lead${
        hotLeads.length > 1 ? 's' : ''
      } waiting - call within 1 hour for 7x conversion!`
    );
  }

  const scheduledNoQuote = leads.filter(
    (l) => l.status === 'scheduled' && l.scheduledAt
  );
  if (scheduledNoQuote.length > 5) {
    actions.push(
      `📋 ${scheduledNoQuote.length} inspections scheduled - ensure quotes are provided promptly`
    );
  }

  const quotedNoClose = leads.filter(
    (l) => l.status === 'quoted' && l.quotedAt
  );
  if (quotedNoClose.length > 10) {
    actions.push(
      `💰 ${quotedNoClose.length} quotes pending - follow up to close deals`
    );
  }

  return actions;
}
