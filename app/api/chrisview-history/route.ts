import { NextResponse } from 'next/server';
import { getHistoryAnalytics } from '@/lib/history-analytics';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    return NextResponse.json(await getHistoryAnalytics());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
