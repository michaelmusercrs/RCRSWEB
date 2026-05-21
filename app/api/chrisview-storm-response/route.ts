import { NextRequest, NextResponse } from 'next/server';
import { analyzeStormResponse } from '@/lib/storm-response-analysis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days = Math.min(
    Math.max(parseInt(searchParams.get('days') || '90', 10) || 90, 1),
    365,
  );
  try {
    return NextResponse.json(await analyzeStormResponse({ days }));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
