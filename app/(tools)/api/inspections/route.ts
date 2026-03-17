/**
 * Inspections API — /api/inspections
 *
 * GET:  List inspections (query: customerId, inspectorId, status, limit, templateId)
 * POST: Start a new inspection from a template
 */

import { NextRequest, NextResponse } from 'next/server';
import { inspectionService } from '@/lib/inspection-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/inspections
 * Query params: customerId, inspectorId, status, templateId, limit
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId') || undefined;
    const inspectorId = searchParams.get('inspectorId') || undefined;
    const status = searchParams.get('status') || undefined;
    const templateId = searchParams.get('templateId') || undefined;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    const inspections = inspectionService.listInspections({
      customerId,
      inspectorId,
      status,
      templateId,
      limit,
    });

    const stats = inspectionService.getInspectionStats();

    return NextResponse.json({
      inspections,
      stats,
      total: inspections.length,
    });
  } catch (error: any) {
    console.error('[API] GET /api/inspections error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch inspections' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inspections
 * Body: { templateId, customerId, customerName, address, inspectorId, inspectorName, jobId?, leadId? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      templateId,
      customerId,
      customerName,
      address,
      inspectorId,
      inspectorName,
      jobId,
      leadId,
    } = body;

    if (!templateId) {
      return NextResponse.json(
        { error: 'templateId is required' },
        { status: 400 }
      );
    }
    if (!customerId || !customerName) {
      return NextResponse.json(
        { error: 'customerId and customerName are required' },
        { status: 400 }
      );
    }
    if (!address) {
      return NextResponse.json(
        { error: 'address is required' },
        { status: 400 }
      );
    }
    if (!inspectorId || !inspectorName) {
      return NextResponse.json(
        { error: 'inspectorId and inspectorName are required' },
        { status: 400 }
      );
    }

    const inspection = inspectionService.startInspection({
      templateId,
      customerId,
      customerName,
      address,
      inspectorId,
      inspectorName,
      jobId,
      leadId,
    });

    return NextResponse.json(inspection, { status: 201 });
  } catch (error: any) {
    console.error('[API] POST /api/inspections error:', error);
    const status = error.message?.includes('not found') ? 404 : 500;
    return NextResponse.json(
      { error: error.message || 'Failed to create inspection' },
      { status }
    );
  }
}
