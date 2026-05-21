/**
 * Marketing Intelligence Daily Cron — DRAFT, NOT YET SCHEDULED
 *
 * Pulls signal from every public surface that affects RCRS's marketing
 * footprint (Google reviews, BBB, competitors, SERP, DNS, deploys), then
 * appends one row per metric to the `Marketing_Intel` Google Sheet tab.
 *
 * Schedule (to be wired into vercel.json by owner): `0 8 * * *`
 *   = 8:00 UTC = 3:00 AM CT — runs before business hours so the morning
 *   admin review has fresh data.
 *
 * Auth: CRON_SECRET bearer header (same pattern as the other crons in
 * this repo) OR admin/owner session for manual runs.
 *
 * The cron NEVER hits an external scrape from build time — `dynamic` is
 * forced and runtime is nodejs. If a source is misconfigured (no API
 * key, etc.) the per-source function returns `{ok:false, needsOwner:true}`
 * and we still write that row so the UI can surface it.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  fetchGoogleReviewsRcrs,
  fetchBbbRcrs,
  fetchCompetitorReviews,
  fetchSerpRanks,
  fetchDnsHealth,
  fetchVercelDeployHealth,
  readMarketingIntelRows,
  writeMarketingIntelRows,
  type MarketingIntelResult,
} from '@/lib/marketing-intel-service';
import { withCronLock } from '@/lib/cron-lock';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Compute the `flag` column for a result row. This is the single place
 * where "is this row interesting?" is decided. The full suggestion
 * engine in lib/marketing-intel-suggestions.ts does the cross-row logic;
 * `flag` is just a per-row marker for filtering in the UI.
 *
 * Values:
 *   ''             — normal, nothing notable
 *   'fail'         — scrape returned ok=false
 *   'needs-owner'  — source needs owner-provided credentials
 *   'changed'      — numeric value differs from prior reading
 */
function buildFlag(r: MarketingIntelResult, previous: string | null): string {
  if (!r.ok) return r.needsOwner ? 'needs-owner' : 'fail';
  if (previous === null) return '';
  if (typeof r.value !== 'number') return previous !== String(r.value) ? 'changed' : '';
  const prevN = parseFloat(previous);
  if (!Number.isFinite(prevN)) return '';
  return prevN !== r.value ? 'changed' : '';
}

export async function GET(request: NextRequest) {
  // Auth
  const authHeader = request.headers.get('authorization') || '';
  const isVercelCron = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;
  if (!isVercelCron) {
    const { requireAuth } = await import('@/lib/auth-service');
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;
    if (!['admin', 'owner'].includes(auth.user.role)) {
      return NextResponse.json(
        { error: 'CRON_SECRET header or admin/owner role required' },
        { status: 403 },
      );
    }
  }

  return withCronLock('marketing-intel', { staleMinutes: 60 }, async () => {
  const _hbStart = Date.now();
  console.log('[marketing-intel] starting daily run');

  // Collect — each source has its own try/catch envelope (the service
  // functions already swallow errors, but be paranoid).
  const results: MarketingIntelResult[] = [];

  try {
    results.push(await fetchGoogleReviewsRcrs());
  } catch (err) {
    results.push({
      ok: false,
      source: 'google-reviews-rcrs',
      metric: 'reviewCount',
      reason: `uncaught: ${err instanceof Error ? err.message : 'unknown'}`,
    });
  }

  try {
    results.push(await fetchBbbRcrs());
  } catch (err) {
    results.push({
      ok: false,
      source: 'bbb-rcrs',
      metric: 'bbbProfile',
      reason: `uncaught: ${err instanceof Error ? err.message : 'unknown'}`,
    });
  }

  try {
    const compResults = await fetchCompetitorReviews();
    results.push(...compResults);
  } catch (err) {
    results.push({
      ok: false,
      source: 'competitor-reviews',
      metric: 'reviewCount:*',
      reason: `uncaught: ${err instanceof Error ? err.message : 'unknown'}`,
    });
  }

  try {
    const serpResults = await fetchSerpRanks();
    results.push(...serpResults);
  } catch (err) {
    results.push({
      ok: false,
      source: 'serp-rank',
      metric: 'rank:*',
      reason: `uncaught: ${err instanceof Error ? err.message : 'unknown'}`,
    });
  }

  try {
    results.push(await fetchDnsHealth());
  } catch (err) {
    results.push({
      ok: false,
      source: 'dns-health',
      metric: 'dnsHealth',
      reason: `uncaught: ${err instanceof Error ? err.message : 'unknown'}`,
    });
  }

  try {
    results.push(await fetchVercelDeployHealth());
  } catch (err) {
    results.push({
      ok: false,
      source: 'vercel-deploys',
      metric: 'lastDeploys',
      reason: `uncaught: ${err instanceof Error ? err.message : 'unknown'}`,
    });
  }

  // Write — one batch, computing per-row delta against prior history.
  const priorRows = await readMarketingIntelRows();
  const writeResult = await writeMarketingIntelRows(
    results,
    priorRows,
    buildFlag,
  );

  // Heartbeat — same shape as the other crons in this repo
  try {
    const { recordCronHeartbeat } = await import('@/lib/cron-heartbeat');
    const okCount = results.filter((r) => r.ok).length;
    const failCount = results.length - okCount;
    await recordCronHeartbeat(
      'marketing-intel',
      writeResult.errors > 0 ? 'error' : 'success',
      Date.now() - _hbStart,
      `${okCount}/${results.length} sources ok; wrote ${writeResult.written} rows; ${failCount} source failures`,
    );
  } catch {
    /* heartbeat must not mask the real result */
  }

  return NextResponse.json({
    success: true,
    results: results.map((r) => ({
      source: r.source,
      metric: r.metric,
      ok: r.ok,
      value: r.ok ? r.value : null,
      reason: r.ok ? undefined : r.reason,
      needsOwner: r.ok ? undefined : r.needsOwner,
    })),
    wrote: writeResult.written,
    writeErrors: writeResult.errors,
    sources: results.length,
    okSources: results.filter((r) => r.ok).length,
  });
  });
}

// ─── TODO before scheduling ──────────────────────────────────────────────
// 1. Move the entry below from `_disabledCrons` to `crons` in vercel.json:
//      { "path": "/api/cron/marketing-intel", "schedule": "0 8 * * *" }
//    (0800 UTC = 0300 CT)
// 2. Confirm CRON_SECRET is set in Vercel env (already used by other crons).
// 3. Verify the Marketing_Intel sheet tab gets created on first run; check
//    that header row matches MARKETING_INTEL_HEADERS in the service module.
// 4. Set the optional needs-owner env vars when ready to enable those sources:
//      VERCEL_TOKEN (read-only) — enables vercel-deploys
//      VERCEL_TEAM_ID           — only if RCRS account is a team, not personal
//      SERPAPI_KEY or DATAFORSEO_LOGIN — enables serp-rank (paid; owner approves)
// 5. After 7+ days of data, check the /admin/marketing-intel viewer suggestion
//    list looks sane before relying on it for action items.
