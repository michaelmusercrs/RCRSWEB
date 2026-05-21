import { NextRequest, NextResponse } from 'next/server';
import { analyzeDeepFunnel } from '@/lib/jn-deep-funnel';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days = Math.min(Math.max(parseInt(searchParams.get('days') || '30', 10) || 30, 1), 365);
  try {
    return NextResponse.json(await analyzeDeepFunnel({ days }));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
