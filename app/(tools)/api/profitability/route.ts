/**
 * Profitability API — /api/profitability
 *
 * GET:  List job costs (query: repSlug, status, limit)
 * POST: Create job cost tracking entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { profitabilityService } from '@/lib/profitability-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/profitability
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const repSlug = searchParams.get('repSlug') || undefined;
    const status = searchParams.get('status') || undefined;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    const jobCosts = await profitabilityService.listJobCosts({
      repSlug,
      status,
      limit,
    });

    return NextResponse.json({
      jobCosts,
      total: jobCosts.length,
    });
  } catch (error: any) {
    console.error('[API] GET /api/profitability error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch job costs' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/profitability
 * Body: { customerName, address, repSlug, repName, contractAmount, ... }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

    const body = await request.json();
    const { customerName, address, repSlug, repName, contractAmount } = body;

    if (!customerName || !address || !repSlug || !repName || contractAmount === undefined) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: customerName, address, repSlug, repName, contractAmount',
        },
        { status: 400 }
      );
    }

    const jobCost = await profitabilityService.createJobCost({
      jobId: body.jobId,
      customerName,
      address,
      repSlug,
      repName,
      contractAmount: Number(contractAmount),
      additionalWork: body.additionalWork ? Number(body.additionalWork) : undefined,
      insurancePayout: body.insurancePayout ? Number(body.insurancePayout) : undefined,
      commissionRate: body.commissionRate ? Number(body.commissionRate) : undefined,
      status: body.status,
      notes: body.notes,
    });

    return NextResponse.json({ jobCost }, { status: 201 });
  } catch (error: any) {
    console.error('[API] POST /api/profitability error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create job cost entry' },
      { status: 500 }
    );
  }
}
