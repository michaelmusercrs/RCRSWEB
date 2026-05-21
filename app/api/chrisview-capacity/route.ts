/**
 * Chris View — Crew / Production Capacity API.
 *
 * GET /api/chrisview-capacity
 *   ?pastDays=60   (default 60, max 365)
 *   &futureDays=30 (default 30, max 365)
 *
 * Returns TeamUp-backed capacity analytics: events-per-week, byRep,
 * gap days, avg installs per business day, upcoming installations.
 */
import { NextRequest, NextResponse } from 'next/server';
import { analyzeCapacity } from '@/lib/capacity-analysis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pastDays = Math.min(
    Math.max(parseInt(searchParams.get('pastDays') || '60', 10) || 60, 1),
    365,
  );
  const futureDays = Math.min(
    Math.max(parseInt(searchParams.get('futureDays') || '30', 10) || 30, 1),
    365,
  );
  try {
    return NextResponse.json(await analyzeCapacity({ pastDays, futureDays }));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
