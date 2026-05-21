/**
 * Chris View - Segmented Customer LTV API (Insurance vs Retail).
 *
 * GET /api/chrisview-segmented-ltv
 *
 * Reads from customer-ltv.json + classifies each customer against JN jobs.
 * Sheet-cached via slug 'segmented-ltv' (90 min max age).
 */
import { NextResponse } from 'next/server';
import { analyzeSegmentedLTV } from '@/lib/segmented-ltv-analysis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const result = await analyzeSegmentedLTV();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
