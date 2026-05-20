/**
 * Chris View — Job Lifecycle API (Phase 5).
 * GET /api/chrisview-lifecycle?days=180  (default 180, max 730)
 */
import { NextRequest, NextResponse } from 'next/server';
import { analyzeJobLifecycle } from '@/lib/jn-job-lifecycle';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days = Math.min(Math.max(parseInt(searchParams.get('days') || '180', 10) || 180, 1), 730);
  try {
    return NextResponse.json(await analyzeJobLifecycle({ days }));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
