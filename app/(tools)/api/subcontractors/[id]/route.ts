/**
 * RCRS Single Subcontractor API
 *
 * GET    /api/subcontractors/[id] - Get subcontractor details with job history
 * PATCH  /api/subcontractors/[id] - Update subcontractor
 * DELETE /api/subcontractors/[id] - Deactivate subcontractor (soft delete)
 *
 * @author RCRS Development Team
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { subcontractorService } from '@/lib/subcontractor-service';

/**
 * GET /api/subcontractors/[id]
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

    // Compute some quick stats for this sub
    const completedJobs = sub.jobHistory.filter((j) => j.status === 'completed');
    const activeJobs = sub.jobHistory.filter(
      (j) => j.status === 'in_progress' || j.status === 'scheduled'
    );
    const totalEarned = completedJobs.reduce((sum, j) => sum + j.totalCost, 0);
    const pendingInvoices = sub.jobHistory.filter(
      (j) => j.status === 'completed' && !j.invoicePaid
    ).length;

    return NextResponse.json({
      success: true,
      subcontractor: sub,
      stats: {
        totalJobs: sub.jobHistory.length,
        completedJobs: completedJobs.length,
        activeJobs: activeJobs.length,
        totalEarned,
        pendingInvoices,
      },
    });
  } catch (error) {
    console.error('[Subcontractors API] GET [id] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subcontractor' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/subcontractors/[id]
 *
 * Body: partial subcontractor fields to update
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

    const body = await request.json();
    const sub = await subcontractorService.updateSubcontractor(params.id, body);

    return NextResponse.json({ success: true, subcontractor: sub });
  } catch (error) {
    console.error('[Subcontractors API] PATCH error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update subcontractor';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * DELETE /api/subcontractors/[id]
 *
 * Soft-deletes by setting status to 'inactive'
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

    const sub = await subcontractorService.deactivate(params.id);

    return NextResponse.json({
      success: true,
      message: `Subcontractor "${sub.companyName}" deactivated`,
      subcontractor: sub,
    });
  } catch (error) {
    console.error('[Subcontractors API] DELETE error:', error);
    const message = error instanceof Error ? error.message : 'Failed to deactivate subcontractor';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
