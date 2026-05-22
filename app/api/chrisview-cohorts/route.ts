import { NextRequest, NextResponse } from 'next/server';
import { analyzeCohorts } from '@/lib/cohort-analysis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const months = Math.min(Math.max(parseInt(searchParams.get('months') || '18', 10) || 18, 6), 36);
  try {
    const data = await analyzeCohorts({ months });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown error' },
      { status: 500 },
    );
  }
}
