/**
 * Storm Report Share API
 *
 * POST - Share a storm report with a customer (rep action)
 * GET  - Get shared storm reports for a customer
 *
 * Requires admin/rep authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { stormReportService } from '@/lib/storm-report-service';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();

    const { reportId, sharedBy } = body;

    if (!reportId) {
      return NextResponse.json(
        { success: false, error: 'reportId is required' },
        { status: 400 }
      );
    }

    const success = await stormReportService.shareReport(
      reportId,
      sharedBy || 'Sales Rep'
    );

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Report not found or could not be shared' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Storm report shared with customer successfully',
    });
  } catch (error) {
    console.error('Storm report share error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to share storm report',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    if (!customerId) {
      return NextResponse.json(
        { success: false, error: 'customerId is required' },
        { status: 400 }
      );
    }

    const reports = await stormReportService.getSharedReportsForCustomer(customerId);

    return NextResponse.json({
      success: true,
      data: reports,
      count: reports.length,
    });
  } catch (error) {
    console.error('Storm report fetch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch shared reports',
      },
      { status: 500 }
    );
  }
}
