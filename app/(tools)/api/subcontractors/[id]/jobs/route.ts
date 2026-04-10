/**
 * RCRS Subcontractor Jobs API
 *
 * GET  /api/subcontractors/[id]/jobs - Get job history for a subcontractor
 * POST /api/subcontractors/[id]/jobs - Assign a new job to a subcontractor
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { subcontractorService } from '@/lib/subcontractor-service';

/**
 * GET /api/subcontractors/[id]/jobs
 *
 * Query params:
 * - status: filter by job status (scheduled, in_progress, completed, issue, cancelled)
 * - limit: number of jobs to return
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sub = await subcontractorService.getSubcontractor(params.id);

    if (!sub) {
      return NextResponse.json(
        { error: 'Subcontractor not found' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limitStr = searchParams.get('limit');

    let jobs = [...sub.jobHistory];

    // Filter by status
    if (status) {
      jobs = jobs.filter((j) => j.status === status);
    }

    // Sort by most recent first
    jobs.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Limit
    if (limitStr) {
      const limit = parseInt(limitStr, 10);
      if (limit > 0) {
        jobs = jobs.slice(0, limit);
      }
    }

    return NextResponse.json({
      success: true,
      subcontractorId: params.id,
      companyName: sub.companyName,
      jobs,
      total: jobs.length,
    });
  } catch (error) {
    console.error('[Subcontractors API] Jobs GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch job history' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/subcontractors/[id]/jobs
 *
 * Body: Job assignment data
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

    const body = await request.json();

    if (!body.customerName || !body.address) {
      return NextResponse.json(
        { error: 'Customer name and address are required' },
        { status: 400 }
      );
    }

    if (!body.scope) {
      return NextResponse.json(
        { error: 'Job scope description is required' },
        { status: 400 }
      );
    }

    if (!body.startDate) {
      return NextResponse.json(
        { error: 'Start date is required' },
        { status: 400 }
      );
    }

    const job = await subcontractorService.assignJob(params.id, {
      jobId: body.jobId || '',
      customerName: body.customerName,
      address: body.address,
      scope: body.scope,
      startDate: body.startDate,
      endDate: body.endDate,
      agreedRate: body.agreedRate || 0,
      rateType: body.rateType || 'flat_rate',
      totalCost: body.totalCost || 0,
      status: body.status || 'scheduled',
      qualityRating: body.qualityRating,
      timelinessRating: body.timelinessRating,
      notes: body.notes || '',
      photos: body.photos || [],
      invoiceReceived: body.invoiceReceived || false,
      invoicePaid: body.invoicePaid || false,
    });

    return NextResponse.json({ success: true, job }, { status: 201 });
  } catch (error) {
    console.error('[Subcontractors API] Jobs POST error:', error);
    const message = error instanceof Error ? error.message : 'Failed to assign job';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
