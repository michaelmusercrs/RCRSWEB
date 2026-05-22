import { NextRequest, NextResponse } from 'next/server';
import { analyzeEstimateDelivery } from '@/lib/estimate-delivery-analysis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days = Math.min(Math.max(parseInt(searchParams.get('days') || '180', 10) || 180, 30), 730);
  try {
    const data = await analyzeEstimateDelivery({ days });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown error' },
      { status: 500 },
    );
  }
}
