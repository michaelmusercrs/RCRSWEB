/**
 * Chris View — Estimate Close-Rate Analysis API (Phase 3).
 *
 * GET /api/chrisview-close-rates?days=90  (default 90, max 365)
 */
import { NextRequest, NextResponse } from 'next/server';
import { analyzeCloseRates } from '@/lib/jn-close-rate-analysis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days = Math.min(Math.max(parseInt(searchParams.get('days') || '90', 10) || 90, 1), 365);

  try {
    const result = await analyzeCloseRates({ days });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
