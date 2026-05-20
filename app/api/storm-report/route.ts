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
import {
  createStormReportRateLimiter,
  createGlobalFormRateLimiter,
  withRateLimit,
} from '@/lib/rate-limiter-kv';
import { cache } from '@/lib/cache';
import { checkHoneypot } from '@/lib/honeypot';
import { verifyTurnstileToken, getRequestIp } from '@/lib/turnstile';

const STORM_REPORT_TTL = 15 * 60 * 1000; // 15 minutes

const formRateLimiter = createStormReportRateLimiter();
const globalFormRateLimiter = createGlobalFormRateLimiter();

// ---------------------------------------------------------------------------
// POST - Generate storm report
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // Check the cross-form global cap first so a hot IP can't burn its
  // per-form budget before tripping the global cap.
  return withRateLimit(request, globalFormRateLimiter, async () =>
    withRateLimit(request, formRateLimiter, async () => {
  let body: any = {};
  try {
    body = await request.json();

    // Honeypot check — silently drop bot submissions before any real work.
    // Mirror the legit success envelope so bots can't probe what worked.
    const hp = checkHoneypot(body);
    if (hp.triggered) {
      console.warn('[HONEYPOT TRIGGERED route=storm-report]', { value: hp.value });
      return NextResponse.json({ success: true, data: null });
    }

    // Cloudflare Turnstile — bot fingerprint challenge. INERT until env vars
    // are set (see lib/turnstile.ts header). Explicit 400 on failure so
    // legit users on flaky networks can retry.
    const turnstile = await verifyTurnstileToken(body.turnstileToken, getRequestIp(request));
    if (!turnstile.valid) {
      console.warn('[TURNSTILE FAILED route=storm-report]', { reason: turnstile.reason });
      return NextResponse.json(
        { success: false, message: 'Verification failed. Please try again.' },
        { status: 400 }
      );
    }

    const { address, city, state, zip, leadId, customerId, daysBack, radiusMiles } = body;

    // Validate required fields - be lenient, never turn away a lead
    if (!address && !zip) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please enter your address to get started',
        },
        { status: 400 }
      );
    }

    // Clean zip if provided, but don't reject if missing - use city/state to geocode
    const cleanZip = zip ? zip.replace(/\D/g, '') : '';
    const stateUpper = state ? state.toUpperCase() : 'AL';

    // Generate the report - never fail, always produce something useful
    const report = await stormReportService.generateReport({
      address: address || '',
      city: city || '',
      state: stateUpper,
      zip: cleanZip || '35601', // Default to Decatur AL if no zip
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
    // Never show an error to the customer — return a safe fallback report
    const fallbackReport = {
      reportId: `SR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-FALLBACK`,
      generatedAt: new Date().toISOString(),
      address: body?.address || '',
      city: body?.city || '',
      state: body?.state || '',
      zip: body?.zip || '',
      fullAddress: [body?.address, body?.city, body?.state, body?.zip].filter(Boolean).join(', '),
      dateRangeStart: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      dateRangeEnd: new Date().toISOString().slice(0, 10),
      hailEvents: [],
      windEvents: [],
      riskLevel: 'Moderate' as const,
      riskScore: 45,
      riskFactors: [
        'North Alabama experiences an average of 8-12 significant hail events per year',
        'Storm damage is often invisible from the ground and requires professional inspection',
        'Insurance claims for storm damage have time limits — early inspection is recommended',
      ],
      recommendation: 'We recommend a free professional roof inspection to check for any hidden storm damage. Our certified inspectors can identify issues that aren\'t visible from the ground and help you understand your options. Call us at (256) 274-8530 to schedule your no-obligation inspection.',
      totalHailReports: 0,
      closestHailMiles: null,
      largestHailSize: null,
      largestHailSizeNum: 0,
      hailReconEvents: [],
      hailReconTotalStorms: 0,
      hailReconLargestSize: 0,
      hailReconLargestSizeLabel: 'None',
      hailReconDataRange: { start: '2011-01-01', end: new Date().toISOString().slice(0, 10) },
    };
    return NextResponse.json({
      success: true,
      data: fallbackReport,
    });
  }
  })
  );
}

// ---------------------------------------------------------------------------
// GET - Fetch existing report
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // Check the cross-form global cap first so a hot IP can't burn its
  // per-form budget before tripping the global cap.
  return withRateLimit(request, globalFormRateLimiter, async () =>
    withRateLimit(request, formRateLimiter, async () => {
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
  })
  );
}
