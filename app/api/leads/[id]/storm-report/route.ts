/**
 * Lead Storm Report API
 *
 * GET  - Fetch storm reports for a specific lead
 * POST - Manually generate a new storm report for this lead's address
 *
 * Storm reports are auto-generated when leads are created, but this endpoint
 * allows reps to manually pull a fresh report or view existing ones.
 */

import { NextRequest, NextResponse } from 'next/server';
import { stormReportService, StormReport } from '@/lib/storm-report-service';
import { leadPortalService } from '@/lib/lead-portal-service';

// ---------------------------------------------------------------------------
// GET - Fetch existing storm reports for this lead
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await params;

    if (!leadId) {
      return NextResponse.json(
        { success: false, error: 'Lead ID is required' },
        { status: 400 }
      );
    }

    // Fetch all storm reports linked to this lead
    const reports = await stormReportService.getReportsByLeadId(leadId);

    if (reports.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        count: 0,
        message: 'No storm reports found for this lead. Use POST to generate one.',
      });
    }

    // Return the most recent report as primary, plus all reports
    const latestReport = reports[0];

    return NextResponse.json({
      success: true,
      data: {
        latest: {
          reportId: latestReport.reportId,
          generatedAt: latestReport.generatedAt,
          riskLevel: latestReport.riskLevel,
          riskScore: latestReport.riskScore,
          riskFactors: latestReport.riskFactors,
          recommendation: latestReport.recommendation,
          totalHailReports: latestReport.totalHailReports,
          closestHailMiles: latestReport.closestHailMiles,
          largestHailSize: latestReport.largestHailSize,
          largestHailSizeNum: latestReport.largestHailSizeNum,
          hailReconTotalStorms: latestReport.hailReconTotalStorms,
          hailReconLargestSize: latestReport.hailReconLargestSize,
          hailReconLargestSizeLabel: latestReport.hailReconLargestSizeLabel,
          hailEvents: latestReport.hailEvents,
          windEvents: latestReport.windEvents,
          activeAlerts: latestReport.activeAlerts,
          hailReconEvents: latestReport.hailReconEvents,
          address: latestReport.fullAddress,
          dateRangeStart: latestReport.dateRangeStart,
          dateRangeEnd: latestReport.dateRangeEnd,
          searchRadiusMiles: latestReport.searchRadiusMiles,
          sharedWithCustomer: latestReport.sharedWithCustomer,
        },
        allReports: reports.map(r => ({
          reportId: r.reportId,
          generatedAt: r.generatedAt,
          riskLevel: r.riskLevel,
          riskScore: r.riskScore,
          totalHailReports: r.totalHailReports,
        })),
      },
      count: reports.length,
    });
  } catch (error) {
    console.error('Error fetching lead storm reports:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch storm reports',
      },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST - Generate a new storm report for this lead
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await params;

    if (!leadId) {
      return NextResponse.json(
        { success: false, error: 'Lead ID is required' },
        { status: 400 }
      );
    }

    // Try to get address info from request body or from lead record
    let body: {
      address?: string;
      city?: string;
      state?: string;
      zip?: string;
      daysBack?: number;
      radiusMiles?: number;
    } = {};

    try {
      body = await request.json();
    } catch {
      // Body is optional - we'll try to get address from lead record
    }

    let address = body.address || '';
    let city = body.city || '';
    let state = body.state || 'AL';
    let zip = body.zip || '';

    // If address info not provided, look up the lead record
    if (!address || !city || !zip) {
      try {
        const lead = await leadPortalService.getLeadById(leadId);
        if (lead) {
          address = address || lead.customerAddress || '';
          // Parse city/state/zip from the full address if needed
          if (!city || !zip) {
            const addressParts = (lead.customerAddress || '').split(',').map(s => s.trim());
            if (addressParts.length >= 2) {
              // Try to extract city from address components
              city = city || addressParts[addressParts.length - 2] || '';
              // Try to extract state and zip from last component
              const lastPart = addressParts[addressParts.length - 1] || '';
              const stateZipMatch = lastPart.match(/([A-Z]{2})\s*(\d{5})/);
              if (stateZipMatch) {
                state = state || stateZipMatch[1];
                zip = zip || stateZipMatch[2];
              }
            }
          }
        }
      } catch (err) {
        console.warn(`[StormReport] Could not look up lead ${leadId}:`, err);
      }
    }

    // Validate we have enough address info
    if (!address || !city || !zip) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing address information. Provide address, city, state, and zip in the request body.',
          hint: 'POST with { "address": "123 Main St", "city": "Huntsville", "state": "AL", "zip": "35801" }',
        },
        { status: 400 }
      );
    }

    // Generate the storm report linked to this lead
    const report = await stormReportService.generateReport({
      address,
      city,
      state,
      zip,
      daysBack: body.daysBack || 90,
      radiusMiles: body.radiusMiles || 50,
      leadId,
    });

    console.log(`[Lead ${leadId}] Manual storm report generated: ${report.reportId} - Risk: ${report.riskLevel} (${report.riskScore}/100)`);

    return NextResponse.json({
      success: true,
      data: {
        reportId: report.reportId,
        generatedAt: report.generatedAt,
        riskLevel: report.riskLevel,
        riskScore: report.riskScore,
        riskFactors: report.riskFactors,
        recommendation: report.recommendation,
        totalHailReports: report.totalHailReports,
        closestHailMiles: report.closestHailMiles,
        largestHailSize: report.largestHailSize,
        largestHailSizeNum: report.largestHailSizeNum,
        hailReconTotalStorms: report.hailReconTotalStorms,
        hailReconLargestSize: report.hailReconLargestSize,
        hailReconLargestSizeLabel: report.hailReconLargestSizeLabel,
        hailEvents: report.hailEvents,
        windEvents: report.windEvents,
        activeAlerts: report.activeAlerts,
        hailReconEvents: report.hailReconEvents,
        address: report.fullAddress,
        dateRangeStart: report.dateRangeStart,
        dateRangeEnd: report.dateRangeEnd,
        searchRadiusMiles: report.searchRadiusMiles,
      },
    });
  } catch (error) {
    console.error('Error generating lead storm report:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate storm report',
      },
      { status: 500 }
    );
  }
}
