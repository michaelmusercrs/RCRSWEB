/**
 * Cron Job: Chris View Precompute
 *
 * Runs the 6 heavy JN-backed analytics libs (funnel, response-times,
 * close-rates, insurance, lifecycle, lead-sources) and writes each
 * result to the `chrisview_cache` tab in the master sheet. Pages then
 * read instantly from the cache instead of hitting JN at request time.
 *
 * Schedule (Vercel cron): every hour, e.g. `0 * * * *`.
 *
 * Best-effort per-page: a failure on one slug never blocks the others.
 * Returns 200 if at least one page succeeded; 500 if every page failed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCronLock } from '@/lib/cron-lock';
import { writeChrisviewCache } from '@/lib/chrisview-sheet-cache';
import { analyzeDeepFunnel } from '@/lib/jn-deep-funnel';
import { queryResponseTimes } from '@/lib/jn-response-times';
import { analyzeCloseRates } from '@/lib/jn-close-rate-analysis';
import { analyzeInsurance } from '@/lib/jn-insurance-analysis';
import { analyzeJobLifecycle } from '@/lib/jn-job-lifecycle';
import { analyzeLeadSources } from '@/lib/jn-lead-sources';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 800; // Vercel pro: 800s. All 6 pages together can run 5-8 min.

function verifyCronAuth(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${cronSecret}`;
}

type Page = {
  slug: string;
  compute: () => Promise<unknown>;
};

// Day windows match each chrisview page's default (the no-args case
// users see when visiting the URL). Custom windows fall through to live
// compute — the cache only covers default visits.
const PAGES: Page[] = [
  { slug: 'funnel',         compute: () => analyzeDeepFunnel({ days: 30 }) },
  { slug: 'response-times', compute: () => queryResponseTimes({ days: 30 }) },
  { slug: 'close-rates',    compute: () => analyzeCloseRates({ days: 90 }) },
  { slug: 'insurance',      compute: () => analyzeInsurance({ days: 180 }) },
  { slug: 'lifecycle',      compute: () => analyzeJobLifecycle({ days: 180 }) },
  { slug: 'lead-sources',   compute: () => analyzeLeadSources({ days: 180 }) },
];

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 });
  }

  return withCronLock('chrisview-precompute', { staleMinutes: 30 }, async () => {
    const startedAt = Date.now();
    const results: Array<{ slug: string; ok: boolean; ms: number; error?: string }> = [];

    for (const { slug, compute } of PAGES) {
      const t0 = Date.now();
      try {
        const payload = await compute();
        const computeMs = Date.now() - t0;
        const w = await writeChrisviewCache(slug, payload, computeMs);
        if (!w.success) throw new Error(w.error || 'write failed');
        results.push({ slug, ok: true, ms: computeMs });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        results.push({ slug, ok: false, ms: Date.now() - t0, error });
      }
    }

    const totalMs = Date.now() - startedAt;
    const okCount = results.filter(r => r.ok).length;

    return NextResponse.json(
      {
        success: okCount > 0,
        totalMs,
        cached: okCount,
        attempted: PAGES.length,
        results,
      },
      { status: okCount > 0 ? 200 : 500 },
    );
  });
}
