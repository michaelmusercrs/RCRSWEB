/**
 * Marketing Intel Viewer API
 *
 * GET /api/admin/marketing-intel
 *
 * Owner/admin-gated. Returns every row from the Marketing_Intel sheet
 * tab, plus the suggestion list generated from those rows.
 *
 * Read-only. Never writes. Filtering is done in-memory after the read
 * because the row volume is tiny (one row per source per day).
 *
 * Query params (all optional):
 *   source     — restrict to one source slug
 *   flag       — '' | 'fail' | 'needs-owner' | 'changed'
 *   since      — ISO timestamp lower bound
 *   limit      — max rows returned (default 500, hard cap 2000)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import {
  readMarketingIntelRows,
  type MarketingIntelRow,
} from '@/lib/marketing-intel-service';
import { generateSuggestions } from '@/lib/marketing-intel-suggestions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 2000;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const sourceFilter = searchParams.get('source')?.trim() || '';
    const flagFilter = searchParams.get('flag')?.trim() || '';
    const sinceParam = searchParams.get('since')?.trim() || '';
    const limitRaw = parseInt(
      searchParams.get('limit') || String(DEFAULT_LIMIT),
      10,
    );
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number.isFinite(limitRaw) ? limitRaw : DEFAULT_LIMIT),
    );
    const sinceTs = sinceParam ? Date.parse(sinceParam) : NaN;

    let rows: MarketingIntelRow[] = await readMarketingIntelRows();

    // Suggestions run against the FULL row set (need history) — not the
    // filtered slice. Compute before we filter.
    const suggestions = generateSuggestions(rows);

    rows.sort((a, b) => {
      const at = Date.parse(a.timestamp);
      const bt = Date.parse(b.timestamp);
      if (Number.isNaN(at) && Number.isNaN(bt)) return 0;
      if (Number.isNaN(at)) return 1;
      if (Number.isNaN(bt)) return -1;
      return bt - at;
    });

    if (sourceFilter) rows = rows.filter((r) => r.source === sourceFilter);
    if (flagFilter) rows = rows.filter((r) => r.flag === flagFilter);
    if (!Number.isNaN(sinceTs)) {
      rows = rows.filter((r) => {
        const t = Date.parse(r.timestamp);
        return !Number.isNaN(t) && t >= sinceTs;
      });
    }

    const sources = Array.from(
      new Set(rows.map((r) => r.source).filter(Boolean)),
    ).sort();
    const total = rows.length;
    const limited = rows.slice(0, limit);

    // Trend lines per (source, metric). Most recent 30 readings.
    // We compute against the FULL set (pre-filter) so the trend doesn't
    // disappear when a user filters by flag.
    const trendBuckets = new Map<string, MarketingIntelRow[]>();
    const allRows = await readMarketingIntelRows(); // cheap: same fetch already cached in v8
    for (const r of allRows) {
      const key = `${r.source}::${r.metric}`;
      if (!trendBuckets.has(key)) trendBuckets.set(key, []);
      trendBuckets.get(key)!.push(r);
    }
    const trends: Record<
      string,
      Array<{ timestamp: string; value: string }>
    > = {};
    for (const [key, list] of trendBuckets.entries()) {
      list.sort((a, b) => {
        const at = Date.parse(a.timestamp);
        const bt = Date.parse(b.timestamp);
        return (Number.isFinite(at) ? at : 0) - (Number.isFinite(bt) ? bt : 0);
      });
      trends[key] = list
        .slice(-30)
        .map((r) => ({ timestamp: r.timestamp, value: r.value }));
    }

    return NextResponse.json({
      success: true,
      data: {
        rows: limited,
        total,
        limit,
        sources,
        suggestions,
        trends,
        configured: Boolean(
          process.env.GOOGLE_SHEETS_ID &&
            process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
            process.env.GOOGLE_PRIVATE_KEY,
        ),
      },
    });
  } catch (error) {
    console.error('GET /api/admin/marketing-intel error:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to read marketing intel',
      },
      { status: 500 },
    );
  }
}
