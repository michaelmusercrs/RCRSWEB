/**
 * Gamification Contests API
 *
 * GET /api/gamification/contests
 * Query params:
 *   - status: 'upcoming' | 'active' | 'completed' (optional, returns all if omitted)
 *
 * POST /api/gamification/contests
 * Body: { name, description, type, metric, startDate, endDate, prize, createdBy }
 */

import { NextRequest, NextResponse } from 'next/server';
import { gamificationService } from '@/lib/gamification-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as 'upcoming' | 'active' | 'completed' | null;

    // Update contest scores for active contests (async - fetches real data from Sheets/JN)
    await gamificationService.updateContestScores();

    const contests = status
      ? await gamificationService.getContests(status)
      : await gamificationService.getContests();

    return NextResponse.json({
      success: true,
      data: { contests },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Gamification Contests API Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load contests',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const required = ['name', 'description', 'type', 'metric', 'startDate', 'endDate', 'prize', 'createdBy'];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json(
          { success: false, error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate type
    if (!['individual', 'team'].includes(body.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid type. Must be "individual" or "team".' },
        { status: 400 }
      );
    }

    // Validate metric
    const validMetrics = ['revenue', 'deals', 'leads_contacted', 'response_time', 'reviews'];
    if (!validMetrics.includes(body.metric)) {
      return NextResponse.json(
        { success: false, error: `Invalid metric. Must be one of: ${validMetrics.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate dates
    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Invalid date format. Use ISO 8601 (YYYY-MM-DD).' },
        { status: 400 }
      );
    }
    if (endDate <= startDate) {
      return NextResponse.json(
        { success: false, error: 'End date must be after start date.' },
        { status: 400 }
      );
    }

    const contest = await gamificationService.createContest({
      name: body.name,
      description: body.description,
      type: body.type,
      metric: body.metric,
      startDate: body.startDate,
      endDate: body.endDate,
      prize: body.prize,
      createdBy: body.createdBy,
    });

    return NextResponse.json(
      {
        success: true,
        data: { contest },
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Gamification Contests API Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create contest',
      },
      { status: 500 }
    );
  }
}
