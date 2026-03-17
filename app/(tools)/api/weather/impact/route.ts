/**
 * Weather Impact Analysis API
 *
 * GET /api/weather/impact - Get impact analysis for an alert or storm event
 *   Query params:
 *   - alertId: specific alert ID for impact analysis
 *   - stormId: specific storm event ID for impact analysis
 *   - counties: comma-separated county names for general impact query
 *
 * Returns affected customer counts, zip codes, and potential lead opportunities.
 */

import { NextRequest, NextResponse } from 'next/server';
import { weatherAlertService } from '@/lib/weather-alert-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const alertId = searchParams.get('alertId');
    const stormId = searchParams.get('stormId');
    const countiesParam = searchParams.get('counties');

    // If a specific alert or storm ID is given, get its impact
    if (alertId || stormId) {
      const id = alertId || stormId || '';
      const impact = weatherAlertService.getImpactAnalysis(id);

      if (!impact) {
        return NextResponse.json(
          { success: false, error: 'Alert or storm event not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        impact,
        generatedAt: new Date().toISOString(),
      });
    }

    // General county-based impact analysis
    if (countiesParam) {
      const counties = countiesParam.split(',').map(c => c.trim()).filter(Boolean);
      const affectedCustomers = weatherAlertService.getAffectedCustomers(counties);

      // Build a virtual storm event to get lead estimates
      const leadOpportunities = weatherAlertService.generateStormLeadOpportunities({
        id: 'analysis',
        date: new Date().toISOString(),
        type: 'general',
        counties,
        severity: 'moderate',
        description: 'Impact analysis query',
        estimatedDamage: 'moderate',
        leadsGenerated: 0,
        customersAffected: affectedCustomers,
        followUpStatus: 'pending',
        notes: '',
        createdAt: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        impact: {
          affectedCustomers,
          affectedJobs: 0,
          affectedZips: leadOpportunities.affectedZips,
          potentialLeads: leadOpportunities.potentialLeads,
          estimatedHomes: leadOpportunities.estimatedHomes,
          conversionEstimate: leadOpportunities.conversionEstimate,
          counties,
          severity: 'moderate',
        },
        generatedAt: new Date().toISOString(),
      });
    }

    // No parameters: return impact for all current active alerts
    const activeAlerts = weatherAlertService.getActiveAlerts();
    const impactSummaries = activeAlerts.map(alert => ({
      alertId: alert.id,
      title: alert.title,
      type: alert.type,
      severity: alert.severity,
      counties: alert.counties,
      affectedCustomers: alert.affectedCustomers,
      affectedJobs: alert.affectedJobs,
    }));

    const totalCustomers = impactSummaries.reduce((sum, i) => sum + i.affectedCustomers, 0);
    const totalJobs = impactSummaries.reduce((sum, i) => sum + i.affectedJobs, 0);
    const allCounties = [...new Set(impactSummaries.flatMap(i => i.counties))];

    return NextResponse.json({
      success: true,
      activeAlertCount: activeAlerts.length,
      totalAffectedCustomers: totalCustomers,
      totalAffectedJobs: totalJobs,
      allAffectedCounties: allCounties,
      alerts: impactSummaries,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Weather Impact API] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate impact analysis' },
      { status: 500 }
    );
  }
}
