import { NextRequest, NextResponse } from 'next/server';
import { getThreeLeaderboards } from '@/lib/three-leaderboards';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const months = Math.min(Math.max(parseInt(new URL(request.url).searchParams.get('months') || '12', 10) || 12, 1), 96);
  try {
    return NextResponse.json(await getThreeLeaderboards({ months }));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
