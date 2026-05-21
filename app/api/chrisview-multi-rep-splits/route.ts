/**
 * Chris View — Multi-Rep Commission Splits API.
 *
 * Returns every commission job where 2+ reps were paid, plus per-rep
 * split stats and rep-pair counts. Sheet-cache aware via slug
 * `multi-rep-splits`. Public read-only — only aggregated commission
 * amounts flow through, no purchase-price/cost data.
 *
 * GET /api/chrisview-multi-rep-splits
 */
import { NextResponse } from 'next/server';
import { getMultiRepSplits } from '@/lib/multi-rep-splits';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const result = await getMultiRepSplits();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
