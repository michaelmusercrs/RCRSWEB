// Lead Enrichment API
// GET: Real-time address enrichment for the new lead wizard
// Returns: geocode result, nearby jobs, storm data, rep recommendations

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { leadPipelineOrchestrator } from '@/lib/lead-pipeline-orchestrator';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address || address.length < 5) {
      return NextResponse.json(
        { success: false, error: 'Address parameter is required (min 5 chars)' },
        { status: 400 }
      );
    }

    const enrichment = await leadPipelineOrchestrator.enrichAddress(address);

    return NextResponse.json({
      success: true,
      data: enrichment,
    });
  } catch (error) {
    console.error('Error enriching lead address:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
