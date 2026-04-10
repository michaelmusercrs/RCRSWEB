/**
 * Roof Measurement API — /api/roof-measure
 *
 * POST: Run a full roof measurement for an address
 * GET:  Retrieve measurement by ID or address
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { roofMeasureService } from '@/lib/roof-measure-service';
import { roofReportService } from '@/lib/roof-report-service';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * POST /api/roof-measure
 * Body: { address, latLng?, images?, selectedStreetViewHeadings?, structures? }
 * Runs the full measurement pipeline and saves to Google Sheets automatically.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

    const body = await request.json();
    const { address, latLng, images, selectedStreetViewHeadings, structures, leadId } = body;

    if (!address) {
      return NextResponse.json(
        { error: "Missing required 'address' field" },
        { status: 400 }
      );
    }

    const result = await roofMeasureService.measureRoof(address, {
      latLng: latLng ?? undefined,
      images: images ?? undefined,
      selectedStreetViewHeadings: selectedStreetViewHeadings ?? undefined,
      structures: structures ?? undefined,
    });

    // Auto-save to Google Sheets
    let reportId: string | null = null;
    try {
      reportId = await roofMeasureService.saveMeasurement(result, leadId);
    } catch (saveErr: any) {
      console.warn('Failed to auto-save measurement to Sheets:', saveErr.message);
    }

    return NextResponse.json({
      ...result,
      reportId,
      savedToSheets: !!reportId,
    });
  } catch (err: any) {
    console.error('Roof measurement pipeline error:', err);
    return NextResponse.json(
      { error: err.message ?? 'Measurement pipeline failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/roof-measure?id=ROOF-20260312-ABC123 or ?address=123+Main+St
 * Retrieve a saved measurement.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');
    const address = searchParams.get('address');

    if (id) {
      const report = await roofReportService.getReportById(id);
      if (!report) {
        return NextResponse.json({ error: 'Report not found' }, { status: 404 });
      }
      return NextResponse.json(report);
    }

    if (address) {
      // Run a new measurement for the address
      const result = await roofMeasureService.measureRoof(address);

      let reportId: string | null = null;
      try {
        reportId = await roofMeasureService.saveMeasurement(result);
      } catch (saveErr: any) {
        console.warn('Failed to auto-save measurement:', saveErr.message);
      }

      return NextResponse.json({
        ...result,
        reportId,
        savedToSheets: !!reportId,
      });
    }

    return NextResponse.json(
      { error: "Missing 'id' or 'address' query parameter" },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('Roof measurement error:', err);
    return NextResponse.json(
      { error: err.message ?? 'Failed to retrieve measurement' },
      { status: 500 }
    );
  }
}
