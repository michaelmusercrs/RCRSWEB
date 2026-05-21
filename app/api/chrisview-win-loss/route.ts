/**
 * Chris View — Estimate Win/Loss per Project API.
 *
 * GET /api/chrisview-win-loss?days=180  (default 180, min 1, max 730)
 *
 * Per Michael's rule: dedupes estimates by project (R-number). Multiple
 * estimates on the same job = 1 project. If the project has any invoice,
 * it's WON; otherwise PENDING (could be lost, could still be in play).
 */
import { NextRequest, NextResponse } from 'next/server';
import { analyzeWinLoss } from '@/lib/win-loss-analysis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days = Math.min(Math.max(parseInt(searchParams.get('days') || '180', 10) || 180, 1), 730);

  try {
    const result = await analyzeWinLoss({ days });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
