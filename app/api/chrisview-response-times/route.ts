/**
 * Chris View — Lead Response Times (Phase 2).
 *
 * Calls into lib/jn-response-times.ts to get per-rep response-time
 * aggregates for leads created by office staff in JN. Adds a per-rep
 * first-contact METHOD breakdown (phone/text/email/etc) on top of
 * the existing response-time stats.
 *
 * Public read-only. No cost data flows through (jn-response-times
 * runs every JN fetch through redactCostFieldsDeep already).
 *
 * GET /api/chrisview-response-times?days=30  (default 30, max 180)
 */
import { NextRequest, NextResponse } from 'next/server';
import { queryResponseTimes } from '@/lib/jn-response-times';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days = Math.min(Math.max(parseInt(searchParams.get('days') || '30', 10) || 30, 1), 180);

  try {
    const result = await queryResponseTimes({ days });

    // Build per-rep first-contact method breakdown from result.leads
    const byRepMethod: Record<string, Record<string, number>> = {};
    for (const lead of result.leads) {
      if (!lead.repName) continue;
      const method = (lead.firstActionType || 'no-contact').toString();
      if (!byRepMethod[lead.repName]) byRepMethod[lead.repName] = {};
      byRepMethod[lead.repName][method] = (byRepMethod[lead.repName][method] || 0) + 1;
    }

    // Convert to per-rep array with percentages
    const methodBreakdown = Object.entries(byRepMethod).map(([rep, counts]) => {
      const total = Object.values(counts).reduce((s, n) => s + n, 0);
      const methods = Object.entries(counts)
        .map(([method, count]) => ({
          method,
          count,
          pct: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.count - a.count);
      return { rep, total, methods };
    }).sort((a, b) => b.total - a.total);

    // Overall method totals
    const overallMethods: Record<string, number> = {};
    let overallTotal = 0;
    for (const lead of result.leads) {
      const method = (lead.firstActionType || 'no-contact').toString();
      overallMethods[method] = (overallMethods[method] || 0) + 1;
      overallTotal += 1;
    }
    const overallMethodList = Object.entries(overallMethods)
      .map(([method, count]) => ({
        method,
        count,
        pct: overallTotal > 0 ? Math.round((count / overallTotal) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      days,
      ...result,
      methodBreakdown,
      overallMethods: overallMethodList,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
