// Job Breakdown Search API
// GET: Search breakdowns by customer name, address, or R-number

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { jobBreakdownService } from '@/lib/job-breakdown-service';

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const rep = searchParams.get('rep');

    if (query) {
      const results = await jobBreakdownService.searchBreakdowns(query);
      return NextResponse.json({ success: true, count: results.length, data: results });
    }

    if (rep) {
      const results = await jobBreakdownService.getBreakdownsByRep(rep);
      return NextResponse.json({ success: true, count: results.length, data: results });
    }

    return NextResponse.json(
      { success: false, error: 'Provide ?q=search or ?rep=slug parameter' },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
