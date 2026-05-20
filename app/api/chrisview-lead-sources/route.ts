import { NextRequest, NextResponse } from 'next/server';
import { analyzeLeadSources } from '@/lib/jn-lead-sources';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days = Math.min(Math.max(parseInt(searchParams.get('days') || '180', 10) || 180, 1), 730);
  try {
    return NextResponse.json(await analyzeLeadSources({ days }));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
