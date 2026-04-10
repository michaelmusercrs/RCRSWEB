/**
 * Weather Alerts API
 *
 * GET /api/weather/alerts - Fetch current weather alerts
 *   Query params:
 *   - counties: comma-separated county names (e.g., "Morgan,Madison")
 *   - type: filter by alert type (e.g., "hail", "tornado")
 *   - active: 'true' to show only active alerts (default: all)
 *
 * Fetches live data from the NWS API and merges with any manual alerts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { weatherAlertService } from '@/lib/weather-alert-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const countiesParam = searchParams.get('counties');
    const typeFilter = searchParams.get('type');
    const activeOnly = searchParams.get('active') === 'true';

    const counties = countiesParam
      ? countiesParam.split(',').map(c => c.trim()).filter(Boolean)
      : undefined;

    // Fetch live NWS alerts (with caching)
    const nwsAlerts = await weatherAlertService.fetchNWSAlerts(counties);

    // Get any manual alerts from persistent storage
    const allAlerts = await weatherAlertService.getAllAlerts();
    const manualAlerts = allAlerts.filter(a => a.source === 'manual');

    // Merge: NWS alerts + manual alerts that are not duplicates
    const nwsIds = new Set(nwsAlerts.map(a => a.id));
    const merged = [
      ...nwsAlerts,
      ...manualAlerts.filter(a => !nwsIds.has(a.id)),
    ];

    // Apply filters
    let filtered = merged;

    if (typeFilter) {
      const type = typeFilter.toLowerCase();
      filtered = filtered.filter(a => a.type === type);
    }

    if (activeOnly) {
      const now = new Date();
      filtered = filtered.filter(a => a.isActive && new Date(a.endTime) > now);
    }

    // Filter by counties if specified and not already filtered from NWS
    if (counties && counties.length > 0) {
      filtered = filtered.filter(a =>
        a.counties.some(c =>
          counties.some(sc => c.toLowerCase().includes(sc.toLowerCase()))
        )
      );
    }

    // Sort: severity (extreme first), then most recent
    const severityOrder = { extreme: 0, severe: 1, moderate: 2, minor: 3 };
    filtered.sort((a, b) => {
      const severityDiff = (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4);
      if (severityDiff !== 0) return severityDiff;
      return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
    });

    // Summary stats
    const activeAlerts = filtered.filter(a => a.isActive && new Date(a.endTime) > new Date());
    const totalAffectedCustomers = activeAlerts.reduce((sum, a) => sum + a.affectedCustomers, 0);
    const totalAffectedJobs = activeAlerts.reduce((sum, a) => sum + a.affectedJobs, 0);
    const hasSevere = activeAlerts.some(a => a.severity === 'severe' || a.severity === 'extreme');

    return NextResponse.json({
      success: true,
      alerts: filtered,
      total: filtered.length,
      activeCount: activeAlerts.length,
      summary: {
        totalAffectedCustomers,
        totalAffectedJobs,
        hasSevereAlert: hasSevere,
        highestSeverity: activeAlerts.length > 0
          ? activeAlerts.reduce((max, a) =>
              (severityOrder[a.severity] ?? 4) < (severityOrder[max.severity] ?? 4) ? a : max
            ).severity
          : null,
      },
      lastFetched: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Weather Alerts API] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch weather alerts' },
      { status: 500 }
    );
  }
}
