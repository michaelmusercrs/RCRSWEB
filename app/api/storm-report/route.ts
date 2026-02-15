/**
 * Storm Report API
 *
 * POST - Generate a new storm report for an address
 * GET  - Fetch an existing report by reportId, or check by address/zip
 *
 * This is a PUBLIC endpoint (no auth required) since it powers the
 * "Check My Address" lead capture page.
 */

import { NextRequest, NextResponse } from 'next/server';
import { stormReportService } from '@/lib/storm-report-service';
import { createFormRateLimiter, withRateLimit } from '@/lib/rate-limiter';
import { cache } from '@/lib/cache';

const STORM_REPORT_TTL = 15 * 60 * 1000; // 15 minutes

const formRateLimiter = createFormRateLimiter();

// ---------------------------------------------------------------------------
// POST - Generate storm report
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  return withRateLimit(request, formRateLimiter, async () => {
  try {
    const body = await request.json();

    const { address, city, state, zip, leadId, customerId, daysBack, radiusMiles } = body;

    // Validate required fields
    if (!address || !city || !state || !zip) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: address, city, state, zip',
        },
        { status: 400 }
      );
    }

    // Validate zip format
    const cleanZip = zip.replace(/\D/g, '');
    if (cleanZip.length !== 5) {
      return NextResponse.json(
        { success: false, error: 'Invalid zip code format' },
        { status: 400 }
      );
    }

    // Validate state
    const validStates = ['AL', 'TN', 'GA', 'MS', 'FL', 'KY', 'NC', 'SC'];
    const stateUpper = state.toUpperCase();
    if (!validStates.includes(stateUpper)) {
      return NextResponse.json(
        { success: false, error: 'We currently serve Alabama, Tennessee, and surrounding states' },
        { status: 400 }
      );
    }

    // Generate the report
    const report = await stormReportService.generateReport({
      address,
      city,
      state: stateUpper,
      zip: cleanZip,
      daysBack: daysBack || 90,
      radiusMiles: radiusMiles || 50,
      leadId,
      customerId,
    });

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Storm report generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate storm report',
      },
      { status: 500 }
    );
  }
  });
}

// ---------------------------------------------------------------------------
// GET - Fetch existing report
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  return withRateLimit(request, formRateLimiter, async () => {
  try {
    const { searchParams } = new URL(request.url);

    const reportId = searchParams.get('reportId');
    const address = searchParams.get('address');
    const zip = searchParams.get('zip');
    const leadId = searchParams.get('leadId');
    const customerId = searchParams.get('customerId');

    // Fetch by reportId
    if (reportId) {
      const cacheKey = `storm-report:${reportId}`;
      const cached = cache.get<any>(cacheKey);
      if (cached) return NextResponse.json(cached);

      const report = await stormReportService.getReportById(reportId);
      if (!report) {
        return NextResponse.json(
          { success: false, error: 'Report not found' },
          { status: 404 }
        );
      }
      const response = { success: true, data: report };
      cache.set(cacheKey, response, STORM_REPORT_TTL);
      return NextResponse.json(response);
    }

    // Fetch by leadId
    if (leadId) {
      const reports = await stormReportService.getReportsByLeadId(leadId);
      return NextResponse.json({
        success: true,
        data: reports,
        count: reports.length,
      });
    }

    // Fetch by customerId
    if (customerId) {
      const reports = await stormReportService.getReportsByCustomerId(customerId);
      return NextResponse.json({
        success: true,
        data: reports,
        count: reports.length,
      });
    }

    // Fetch by address + zip
    if (address && zip) {
      const report = await stormReportService.getReportByAddress(address, zip);
      if (!report) {
        return NextResponse.json({
          success: true,
          data: null,
          exists: false,
          message: 'No report found for this address',
        });
      }
      return NextResponse.json({
        success: true,
        data: report,
        exists: true,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Provide reportId, leadId, customerId, or address+zip to look up a report',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Storm report fetch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch storm report',
      },
      { status: 500 }
    );
  }
  });
}
