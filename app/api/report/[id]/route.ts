/**
 * Public Report API
 *
 * GET - Fetch a publicly shared roof report by share token.
 * No authentication required — but report must have isPublic=true.
 * Also fetches associated storm report if available.
 */

import { NextRequest, NextResponse } from 'next/server';
import { roofReportService } from '@/lib/roof-report-service';
import { stormReportService } from '@/lib/storm-report-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: shareToken } = await params;

    if (!shareToken) {
      return NextResponse.json({ success: false, error: 'Report ID is required' }, { status: 400 });
    }

    const report = await roofReportService.getReportByShareToken(shareToken);

    if (!report) {
      return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 });
    }

    if (!report.isPublic) {
      return NextResponse.json(
        { success: false, error: 'This report is not currently shared. Ask your sales rep to enable sharing.' },
        { status: 403 }
      );
    }

    let measurements = {};
    let components = {};
    try { measurements = JSON.parse(report.measurementsJson); } catch {}
    try { components = JSON.parse(report.componentsJson); } catch {}

    // Try to fetch associated storm report
    let stormReport = null;
    if (report.leadId) {
      try {
        const stormReports = await stormReportService.getReportsByLeadId(report.leadId);
        if (stormReports.length > 0) {
          const sr = stormReports[0];
          stormReport = {
            riskLevel: sr.riskLevel,
            riskScore: sr.riskScore,
            totalHailReports: sr.totalHailReports,
            closestHailMiles: sr.closestHailMiles,
            largestHailSize: sr.largestHailSize,
            recommendation: sr.recommendation,
            riskFactors: sr.riskFactors,
          };
        }
      } catch {
        // Storm report fetch failed, that's fine
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        reportId: report.reportId,
        generatedAt: report.generatedAt,
        address: report.address,
        lat: report.lat,
        lng: report.lng,
        totalRoofAreaSqFt: report.totalRoofAreaSqFt,
        roofSquares: report.roofSquares,
        segmentCount: report.segmentCount,
        primaryPitch: report.primaryPitch,
        roofStyle: report.roofStyle,
        totalRidgeFt: report.totalRidgeFt,
        totalRakeFt: report.totalRakeFt,
        totalValleyFt: report.totalValleyFt,
        totalEaveFt: report.totalEaveFt,
        totalHipFt: report.totalHipFt,
        perimeterFt: report.perimeterFt,
        overallConfidence: report.overallConfidence,
        measurements,
        components,
        satelliteImageUrl: report.satelliteImageUrl,
        stormReport,
      },
    });
  } catch (error) {
    console.error('Error fetching public report:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load report' },
      { status: 500 }
    );
  }
}
