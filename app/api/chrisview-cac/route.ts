import { NextRequest, NextResponse } from 'next/server';
import { analyzeCac } from '@/lib/cac-analysis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days = Math.min(Math.max(parseInt(searchParams.get('days') || '365', 10) || 365, 1), 730);
  try {
    return NextResponse.json(await analyzeCac({ days }));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
