/**
 * Chris View — Insurance Job Deep Dive API (Phase 4).
 *
 * GET /api/chrisview-insurance?days=180  (default 180, max 730)
 */
import { NextRequest, NextResponse } from 'next/server';
import { analyzeInsurance } from '@/lib/jn-insurance-analysis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days = Math.min(Math.max(parseInt(searchParams.get('days') || '180', 10) || 180, 1), 730);
  try {
    const result = await analyzeInsurance({ days });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
