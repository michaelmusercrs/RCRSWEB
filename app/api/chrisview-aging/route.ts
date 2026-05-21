/**
 * Chris View — Estimate Aging Queue API.
 *
 * GET /api/chrisview-aging?days=180  (default 180, max 365)
 *
 * Returns every OPEN estimate (not signed, not rejected) bucketed by days
 * idle since last manual activity. Same JN filter discipline as the rest of
 * the chrisview routes — all filters JSON-encoded, all responses redacted.
 */
import { NextRequest, NextResponse } from 'next/server';
import { analyzeEstimateAging } from '@/lib/jn-estimate-aging';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days = Math.min(Math.max(parseInt(searchParams.get('days') || '180', 10) || 180, 1), 365);
  try {
    return NextResponse.json(await analyzeEstimateAging({ days }));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
