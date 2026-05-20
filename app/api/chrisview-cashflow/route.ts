/**
 * Chris View — Cash Flow Forecast API.
 *
 * Pre-computed: re-run `node scripts/compute-cashflow-forecast.mjs` to refresh.
 */
import { NextResponse } from 'next/server';
import data from '@/data/cashflow-forecast.json';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(data);
}
