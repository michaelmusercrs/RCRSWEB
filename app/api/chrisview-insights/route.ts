/**
 * Chris View — Meeting Insights API.
 *
 * Returns the pre-computed pattern / correlation / attendance / prediction
 * stats from data/meeting-insights.json. Refresh by running
 * `node scripts/compute-meeting-insights.mjs`.
 */
import { NextResponse } from 'next/server';
import data from '@/data/meeting-insights.json';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(data);
}
