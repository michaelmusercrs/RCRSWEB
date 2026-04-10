/**
 * RCRS Single Job Progress API
 *
 * GET   /api/job-progress/[jobId] - Get full timeline for a job
 * PATCH /api/job-progress/[jobId] - Update job progress (add photos, update phase, share)
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { jobProgressService } from '@/lib/job-progress-service';

/**
 * GET /api/job-progress/[jobId]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const timeline = await jobProgressService.getTimeline(params.jobId);

    if (!timeline) {
      return NextResponse.json(
        { error: 'Job timeline not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, timeline });
  } catch (error) {
    console.error('[JobProgress API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job timeline' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/job-progress/[jobId]
 *
 * Actions:
 * - action: "add_photos" - Add photos to an existing entry
 *   - entryId: string
 *   - photos: array
 * - action: "update_phase" - Add a new phase entry
 *   - phase: JobPhase
 *   - notes: string
 *   - photos: array (optional)
 * - action: "share" - Generate share token
 * - action: "notify" - Mark an entry as customer-notified
 *   - entryId: string
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Missing action field' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'add_photos': {
        if (!body.entryId || !body.photos || !Array.isArray(body.photos)) {
          return NextResponse.json(
            { error: 'Missing entryId or photos array' },
            { status: 400 }
          );
        }
        const photos = await jobProgressService.addPhotos(params.jobId, body.entryId, body.photos);
        return NextResponse.json({ success: true, photos });
      }

      case 'update_phase': {
        if (!body.phase || !body.notes) {
          return NextResponse.json(
            { error: 'Missing phase or notes' },
            { status: 400 }
          );
        }
        const entry = await jobProgressService.updatePhase(
          params.jobId,
          body.phase,
          body.notes,
          body.photos
        );
        return NextResponse.json({ success: true, entry });
      }

      case 'share': {
        const shareData = await jobProgressService.shareTimeline(params.jobId);
        return NextResponse.json({ success: true, ...shareData });
      }

      case 'notify': {
        if (!body.entryId) {
          return NextResponse.json(
            { error: 'Missing entryId' },
            { status: 400 }
          );
        }
        await jobProgressService.markCustomerNotified(params.jobId, body.entryId);
        return NextResponse.json({ success: true, message: 'Customer notified' });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[JobProgress API] PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update job progress' },
      { status: 500 }
    );
  }
}
