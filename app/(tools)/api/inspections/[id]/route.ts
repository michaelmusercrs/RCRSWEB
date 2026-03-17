/**
 * Inspection Detail API — /api/inspections/[id]
 *
 * GET:    Get inspection details
 * PATCH:  Update inspection (add responses, change status, complete)
 * DELETE: Delete draft/in-progress inspection
 */

import { NextRequest, NextResponse } from 'next/server';
import { inspectionService } from '@/lib/inspection-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/inspections/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const inspection = inspectionService.getInspection(params.id);
    if (!inspection) {
      return NextResponse.json(
        { error: 'Inspection not found' },
        { status: 404 }
      );
    }

    // Attach template for reference and completion %
    const template = inspectionService.getTemplate(inspection.templateId);
    const completionPercent =
      inspectionService.getCompletionPercent(inspection);

    return NextResponse.json({
      inspection,
      template,
      completionPercent,
    });
  } catch (error: any) {
    console.error('[API] GET /api/inspections/[id] error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch inspection' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/inspections/[id]
 * Body: {
 *   action?: 'update' | 'complete' | 'share',
 *   responses?, photos?, overallCondition?, summary?,
 *   recommendations?, estimatedRepairCost?, urgencyLevel?,
 *   jobId?, leadId?
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const action = body.action || 'update';

    // Verify inspection exists
    const existing = inspectionService.getInspection(params.id);
    if (!existing) {
      return NextResponse.json(
        { error: 'Inspection not found' },
        { status: 404 }
      );
    }

    if (action === 'share') {
      const result = inspectionService.shareInspection(params.id);
      return NextResponse.json(result);
    }

    if (action === 'complete') {
      if (!body.summary) {
        return NextResponse.json(
          { error: 'summary is required to complete an inspection' },
          { status: 400 }
        );
      }
      const inspection = inspectionService.completeInspection(params.id, {
        summary: body.summary,
        recommendations: body.recommendations || [],
        overallCondition: body.overallCondition || 'good',
        urgencyLevel: body.urgencyLevel || 'none',
        estimatedRepairCost: body.estimatedRepairCost,
      });
      const completionPercent =
        inspectionService.getCompletionPercent(inspection);
      return NextResponse.json({ inspection, completionPercent });
    }

    // Default: update
    const inspection = inspectionService.updateInspection(params.id, {
      responses: body.responses,
      photos: body.photos,
      overallCondition: body.overallCondition,
      summary: body.summary,
      recommendations: body.recommendations,
      estimatedRepairCost: body.estimatedRepairCost,
      urgencyLevel: body.urgencyLevel,
      jobId: body.jobId,
      leadId: body.leadId,
    });

    const completionPercent =
      inspectionService.getCompletionPercent(inspection);
    return NextResponse.json({ inspection, completionPercent });
  } catch (error: any) {
    console.error('[API] PATCH /api/inspections/[id] error:', error);
    const status = error.message?.includes('not found') ? 404 : 500;
    return NextResponse.json(
      { error: error.message || 'Failed to update inspection' },
      { status }
    );
  }
}

/**
 * DELETE /api/inspections/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deleted = inspectionService.deleteInspection(params.id);
    if (!deleted) {
      return NextResponse.json(
        { error: 'Inspection not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, message: 'Inspection deleted' });
  } catch (error: any) {
    console.error('[API] DELETE /api/inspections/[id] error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete inspection' },
      { status: 500 }
    );
  }
}
