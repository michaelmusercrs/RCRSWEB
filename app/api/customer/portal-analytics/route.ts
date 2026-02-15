/**
 * Customer Portal Analytics API
 *
 * GET /api/customer/portal-analytics
 *
 * Returns aggregated analytics for the customer portal:
 * - Total portal opens this week/month
 * - Most active customers
 * - Average engagement per customer
 * - Documents most viewed
 * - Action breakdown
 * - Recent activity feed
 *
 * All data sourced from the CustomerPortalLog and CustomerPortalData Google Sheets tabs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { googleSheetsService } from '@/lib/google-sheets-service';
import { requireAdmin } from '@/lib/auth-service';
import { cache, CACHE_TTL } from '@/lib/cache';

export async function GET(request: NextRequest) {
  // SECURITY: Portal analytics is admin-only. Contains aggregated data across all customers.
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month'; // 'week' | 'month' | 'all'

    const cacheKey = `customer:portal-analytics:${period}`;
    const cached = cache.get(cacheKey);
    if (cached) return NextResponse.json(cached);

    // Calculate date boundaries
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch all portal logs (we filter in memory for analytics)
    const allLogs = await googleSheetsService.getPortalLogs({ limit: 10000 });

    // Fetch all customer portal data records
    const allPortalData = await googleSheetsService.getPortalData();

    // -- Filter logs by time period --
    const periodStart = period === 'week' ? weekAgo : period === 'month' ? monthAgo : new Date(0);
    const periodLogs = allLogs.filter(l => new Date(l.timestamp) >= periodStart);

    // -- 1. Portal Opens --
    const portalOpens = periodLogs.filter(l => l.action === 'portal_opened');
    const opensThisWeek = allLogs.filter(
      l => l.action === 'portal_opened' && new Date(l.timestamp) >= weekAgo
    ).length;
    const opensThisMonth = allLogs.filter(
      l => l.action === 'portal_opened' && new Date(l.timestamp) >= monthAgo
    ).length;

    // -- 2. Most Active Customers --
    const customerActivityMap = new Map<string, {
      name: string;
      email: string;
      actionCount: number;
      lastActive: string;
      actions: Record<string, number>;
    }>();

    for (const log of periodLogs) {
      const key = log.customerEmail || log.customerName || 'unknown';
      const existing = customerActivityMap.get(key);
      if (existing) {
        existing.actionCount++;
        if (log.timestamp > existing.lastActive) existing.lastActive = log.timestamp;
        existing.actions[log.action] = (existing.actions[log.action] || 0) + 1;
      } else {
        customerActivityMap.set(key, {
          name: log.customerName,
          email: log.customerEmail,
          actionCount: 1,
          lastActive: log.timestamp,
          actions: { [log.action]: 1 },
        });
      }
    }

    const mostActiveCustomers = Array.from(customerActivityMap.values())
      .sort((a, b) => b.actionCount - a.actionCount)
      .slice(0, 20)
      .map(c => ({
        name: c.name,
        email: c.email,
        actionCount: c.actionCount,
        lastActive: c.lastActive,
        topAction: Object.entries(c.actions).sort(([, a], [, b]) => b - a)[0]?.[0] || '',
      }));

    // -- 3. Average Engagement Per Customer --
    const uniqueCustomers = customerActivityMap.size;
    const totalActions = periodLogs.length;
    const averageActionsPerCustomer = uniqueCustomers > 0
      ? Math.round((totalActions / uniqueCustomers) * 10) / 10
      : 0;

    // From CustomerPortalData: average visits, messages, docs
    const avgVisits = allPortalData.length > 0
      ? Math.round((allPortalData.reduce((sum, r) => sum + r.totalVisits, 0) / allPortalData.length) * 10) / 10
      : 0;
    const avgMessages = allPortalData.length > 0
      ? Math.round((allPortalData.reduce((sum, r) => sum + r.messagesSent, 0) / allPortalData.length) * 10) / 10
      : 0;
    const avgDocs = allPortalData.length > 0
      ? Math.round((allPortalData.reduce((sum, r) => sum + r.documentsViewed, 0) / allPortalData.length) * 10) / 10
      : 0;

    // -- 4. Documents Most Viewed --
    const docViewLogs = periodLogs.filter(
      l => l.action === 'document_viewed' || l.action === 'document_downloaded'
    );

    const docViewMap = new Map<string, { name: string; type: string; views: number; downloads: number }>();
    for (const log of docViewLogs) {
      try {
        const details = JSON.parse(log.details);
        const docName = details.documentName || details.originalName || details.title || 'Unknown';
        const docType = details.documentType || details.type || 'unknown';
        const key = `${docName}__${docType}`;
        const existing = docViewMap.get(key);
        if (existing) {
          if (log.action === 'document_viewed') existing.views++;
          if (log.action === 'document_downloaded') existing.downloads++;
        } else {
          docViewMap.set(key, {
            name: docName,
            type: docType,
            views: log.action === 'document_viewed' ? 1 : 0,
            downloads: log.action === 'document_downloaded' ? 1 : 0,
          });
        }
      } catch {
        // Skip logs with invalid details
      }
    }

    const documentsMostViewed = Array.from(docViewMap.values())
      .sort((a, b) => (b.views + b.downloads) - (a.views + a.downloads))
      .slice(0, 15);

    // -- 5. Action Breakdown --
    const actionBreakdown: Record<string, number> = {};
    for (const log of periodLogs) {
      actionBreakdown[log.action] = (actionBreakdown[log.action] || 0) + 1;
    }

    // -- 6. Daily Activity (for charting) --
    const dailyActivity: Record<string, number> = {};
    for (const log of periodLogs) {
      const day = log.timestamp.substring(0, 10);
      dailyActivity[day] = (dailyActivity[day] || 0) + 1;
    }

    const dailyActivitySorted = Object.entries(dailyActivity)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    // -- 7. Recent Activity Feed --
    const recentActivity = periodLogs.slice(0, 50).map(l => ({
      logId: l.logId,
      customerName: l.customerName,
      customerEmail: l.customerEmail,
      action: l.action,
      timestamp: l.timestamp,
      details: (() => {
        try { return JSON.parse(l.details); } catch { return {}; }
      })(),
    }));

    // -- 8. Customer Portal Data Summary --
    const totalPortalCustomers = allPortalData.length;
    const activeThisMonth = allPortalData.filter(
      r => r.lastAccessed && new Date(r.lastAccessed) >= monthAgo
    ).length;
    const totalVisitsAllTime = allPortalData.reduce((sum, r) => sum + r.totalVisits, 0);
    const totalMessagesAllTime = allPortalData.reduce((sum, r) => sum + r.messagesSent, 0);
    const totalDocsViewedAllTime = allPortalData.reduce((sum, r) => sum + r.documentsViewed, 0);

    const response = {
      success: true,
      period,
      generatedAt: now.toISOString(),
      summary: {
        opensThisWeek,
        opensThisMonth,
        uniqueCustomersInPeriod: uniqueCustomers,
        totalActionsInPeriod: totalActions,
        averageActionsPerCustomer,
      },
      engagement: {
        averageVisitsPerCustomer: avgVisits,
        averageMessagesPerCustomer: avgMessages,
        averageDocsViewedPerCustomer: avgDocs,
      },
      portalData: {
        totalPortalCustomers,
        activeThisMonth,
        totalVisitsAllTime,
        totalMessagesAllTime,
        totalDocsViewedAllTime,
      },
      mostActiveCustomers,
      documentsMostViewed,
      actionBreakdown,
      dailyActivity: dailyActivitySorted,
      recentActivity,
    };
    cache.set(cacheKey, response, CACHE_TTL.MEDIUM);
    return NextResponse.json(response);
  } catch (error) {
    console.error('Portal analytics error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate portal analytics' },
      { status: 500 }
    );
  }
}
