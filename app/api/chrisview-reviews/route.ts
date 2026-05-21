import { NextResponse } from 'next/server';
import { getReviewsQuality } from '@/lib/reviews-quality';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    return NextResponse.json(await getReviewsQuality());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
