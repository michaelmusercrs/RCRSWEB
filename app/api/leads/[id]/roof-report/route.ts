/**
 * Lead Roof Report API
 *
 * GET  - Fetch roof measurement reports for a specific lead
 * POST - Manually generate a new roof report for this lead's address
 * PATCH - Toggle public sharing on/off
 */

import { NextRequest, NextResponse } from 'next/server';
import { roofReportService } from '@/lib/roof-report-service';
import { leadPortalService } from '@/lib/lead-portal-service';

export const maxDuration = 900; // roof measurement can take a while

// ---------------------------------------------------------------------------
// GET - Fetch existing roof reports for this lead
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await params;
    if (!leadId) {
      return NextResponse.json({ success: false, error: 'Lead ID is required' }, { status: 400 });
    }

    const reports = await roofReportService.getReportsByLeadId(leadId);

    if (reports.length === 0) {
      return NextResponse.json({
        success: true,
        data: null,
        count: 0,
        message: 'No roof reports found. Use POST to generate one.',
      });
    }

    const latest = reports[0];
    let measurements = {};
    let components = {};
    try { measurements = JSON.parse(latest.measurementsJson); } catch {}
    try { components = JSON.parse(latest.componentsJson); } catch {}

    return NextResponse.json({
      success: true,
      data: {
        latest: {
          reportId: latest.reportId,
          generatedAt: latest.generatedAt,
          address: latest.address,
          lat: latest.lat,
          lng: latest.lng,
          totalRoofAreaSqFt: latest.totalRoofAreaSqFt,
          roofSquares: latest.roofSquares,
          segmentCount: latest.segmentCount,
          primaryPitch: latest.primaryPitch,
          roofStyle: latest.roofStyle,
          totalRidgeFt: latest.totalRidgeFt,
          totalRakeFt: latest.totalRakeFt,
          totalValleyFt: latest.totalValleyFt,
          totalEaveFt: latest.totalEaveFt,
          totalHipFt: latest.totalHipFt,
          perimeterFt: latest.perimeterFt,
          overallConfidence: latest.overallConfidence,
          measurements,
          components,
          satelliteImageUrl: latest.satelliteImageUrl,
          shareToken: latest.shareToken,
          isPublic: latest.isPublic,
          shareUrl: latest.isPublic ? roofReportService.getShareUrl(latest.shareToken) : null,
        },
        allReports: reports.map(r => ({
          reportId: r.reportId,
          generatedAt: r.generatedAt,
          overallConfidence: r.overallConfidence,
          totalRoofAreaSqFt: r.totalRoofAreaSqFt,
        })),
      },
      count: reports.length,
    });
  } catch (error) {
    console.error('Error fetching lead roof reports:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch roof reports' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST - Generate a new roof report for this lead
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await params;
    if (!leadId) {
      return NextResponse.json({ success: false, error: 'Lead ID is required' }, { status: 400 });
    }

    // Get address from body or from lead record
    let body: { address?: string } = {};
    try { body = await request.json(); } catch {}

    let address = body.address || '';
    let customerId = '';

    if (!address) {
      const lead = await leadPortalService.getLeadById(leadId);
      if (lead) {
        address = lead.customerAddress || '';
        customerId = lead.customerId || '';
      }
    }

    if (!address) {
      return NextResponse.json(
        { success: false, error: 'Could not determine address for this lead' },
        { status: 400 }
      );
    }

    const report = await roofReportService.generateReport({
      address,
      leadId,
      customerId,
    });

    let measurements = {};
    let components = {};
    try { measurements = JSON.parse(report.measurementsJson); } catch {}
    try { components = JSON.parse(report.componentsJson); } catch {}

    return NextResponse.json({
      success: true,
      data: {
        reportId: report.reportId,
        generatedAt: report.generatedAt,
        address: report.address,
        totalRoofAreaSqFt: report.totalRoofAreaSqFt,
        roofSquares: report.roofSquares,
        primaryPitch: report.primaryPitch,
        roofStyle: report.roofStyle,
        overallConfidence: report.overallConfidence,
        measurements,
        components,
        shareToken: report.shareToken,
        shareUrl: roofReportService.getShareUrl(report.shareToken),
      },
    });
  } catch (error) {
    console.error('Error generating roof report:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to generate roof report' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH - Toggle public sharing
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { reportId, isPublic, sharedBy } = body;

    if (!reportId) {
      return NextResponse.json({ success: false, error: 'reportId is required' }, { status: 400 });
    }

    const success = await roofReportService.togglePublic(reportId, isPublic, sharedBy);

    if (!success) {
      return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 });
    }

    const report = await roofReportService.getReportById(reportId);

    return NextResponse.json({
      success: true,
      data: {
        reportId,
        isPublic,
        shareUrl: isPublic && report ? roofReportService.getShareUrl(report.shareToken) : null,
      },
    });
  } catch (error) {
    console.error('Error toggling report visibility:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update report' },
      { status: 500 }
    );
  }
}
