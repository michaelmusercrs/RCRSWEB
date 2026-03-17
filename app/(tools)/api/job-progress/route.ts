/**
 * RCRS Job Progress API
 *
 * GET  /api/job-progress - List job timelines (query: jobId, phase, repSlug, limit)
 * POST /api/job-progress - Add a progress entry
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { jobProgressService, JobPhase } from '@/lib/job-progress-service';

/**
 * GET /api/job-progress
 *
 * Query params:
 * - jobId: get a specific job timeline
 * - phase: filter by current phase
 * - repSlug: filter by assigned rep
 * - limit: max results
 * - recent: if "true", returns recent progress entries instead of timelines
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const phase = searchParams.get('phase') as JobPhase | null;
    const repSlug = searchParams.get('repSlug') || undefined;
    const limitStr = searchParams.get('limit');
    const limit = limitStr ? parseInt(limitStr, 10) : undefined;
    const recent = searchParams.get('recent');

    // Single job lookup
    if (jobId) {
      const timeline = jobProgressService.getTimeline(jobId);
      if (!timeline) {
        return NextResponse.json(
          { error: 'Job timeline not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, timeline });
    }

    // Recent progress entries
    if (recent === 'true') {
      const entries = jobProgressService.getRecentProgress(limit || 20);
      return NextResponse.json({ success: true, entries, total: entries.length });
    }

    // List timelines with filters
    const timelines = jobProgressService.getAllTimelines({
      phase: phase || undefined,
      repSlug,
      limit,
    });

    const stats = jobProgressService.getProgressStats();

    return NextResponse.json({
      success: true,
      timelines,
      total: timelines.length,
      stats,
    });
  } catch (error) {
    console.error('[JobProgress API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job progress data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/job-progress
 *
 * Add a new progress entry to a job.
 *
 * Body:
 * - jobId: string (required)
 * - phase: JobPhase (required)
 * - notes: string (required)
 * - customerName: string (required)
 * - address: string (required)
 * - completedBy: string (rep slug, required)
 * - completedByName: string
 * - photos: array of { url, caption, category, uploadedBy, isCustomerVisible }
 * - weather: string
 * - crewMembers: string[]
 * - jobNimbusId: string
 * - customerNotified: boolean
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const required = ['jobId', 'phase', 'notes', 'customerName', 'address', 'completedBy'];
    const missing = required.filter(f => !body[f]);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    const entry = jobProgressService.addProgressEntry(body.jobId, {
      phase: body.phase,
      notes: body.notes,
      photos: body.photos || [],
      weather: body.weather,
      crewMembers: body.crewMembers,
      customerName: body.customerName,
      address: body.address,
      completedBy: body.completedBy,
      completedByName: body.completedByName || body.completedBy,
      jobNimbusId: body.jobNimbusId,
      customerNotified: body.customerNotified || false,
    });

    return NextResponse.json({
      success: true,
      entry,
    }, { status: 201 });
  } catch (error) {
    console.error('[JobProgress API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to add progress entry' },
      { status: 500 }
    );
  }
}
