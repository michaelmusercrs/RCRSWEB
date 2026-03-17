/**
 * Storm Events API
 *
 * GET  /api/weather/storms - Storm event history
 *   Query params:
 *   - limit: max number of events (default: 50)
 *   - startDate: ISO date filter start
 *   - endDate: ISO date filter end
 *   - county: filter by county name
 *   - type: filter by storm type
 *   - status: filter by follow-up status (pending, in_progress, completed)
 *
 * POST /api/weather/storms - Log a new storm event manually
 */

import { NextRequest, NextResponse } from 'next/server';
import { weatherAlertService, StormEvent } from '@/lib/weather-alert-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const county = searchParams.get('county') || undefined;
    const type = searchParams.get('type') || undefined;
    const followUpStatus = searchParams.get('status') as StormEvent['followUpStatus'] | undefined;

    const events = weatherAlertService.getStormHistory({
      limit,
      startDate,
      endDate,
      county,
      type,
      followUpStatus,
    });

    // Compute summary stats
    const allEvents = weatherAlertService.getStormHistory();
    const totalLeadsGenerated = allEvents.reduce((sum, e) => sum + e.leadsGenerated, 0);
    const pendingFollowUps = allEvents.filter(e => e.followUpStatus === 'pending').length;
    const inProgressFollowUps = allEvents.filter(e => e.followUpStatus === 'in_progress').length;

    return NextResponse.json({
      success: true,
      events,
      total: events.length,
      totalAllTime: allEvents.length,
      summary: {
        totalLeadsGenerated,
        pendingFollowUps,
        inProgressFollowUps,
      },
    });
  } catch (error) {
    console.error('[Storm Events API] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch storm events' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.date || !body.type || !body.counties || !Array.isArray(body.counties)) {
      return NextResponse.json(
        { success: false, error: 'Required fields: date, type, counties (array)' },
        { status: 400 }
      );
    }

    const event = weatherAlertService.logStormEvent({
      date: body.date,
      type: body.type,
      counties: body.counties,
      severity: body.severity || 'moderate',
      hailSize: body.hailSize || undefined,
      windSpeed: body.windSpeed ? parseInt(body.windSpeed, 10) : undefined,
      description: body.description || '',
      estimatedDamage: body.estimatedDamage || 'minor',
      leadsGenerated: body.leadsGenerated || 0,
      customersAffected: body.customersAffected || 0,
      followUpStatus: body.followUpStatus || 'pending',
      notes: body.notes || '',
    });

    // Generate lead opportunities automatically
    const leadOpportunities = weatherAlertService.generateStormLeadOpportunities(event);

    return NextResponse.json({
      success: true,
      event,
      leadOpportunities,
    });
  } catch (error) {
    console.error('[Storm Events API] POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to log storm event' },
      { status: 500 }
    );
  }
}
