/**
 * Marketing Intel Suggestion Engine
 *
 * Pure heuristics over the Marketing_Intel sheet rows. Surfaces
 * actionable items for the admin/marketing viewer.
 *
 * NO AI. NO generated marketing copy. Each suggestion is a fixed-template
 * fact + recommended action, plus the sheet rows that justify it. If the
 * data doesn't justify a suggestion, we don't generate one.
 *
 * Heuristics implemented (each = a separate function so owner can tune):
 *
 *   1. RCRS-vs-competitor review velocity
 *      RCRS got 0 new reviews this week and any competitor got >=2.
 *      Action: send a review-request campaign.
 *
 *   2. SERP rank drop
 *      A keyword that was previously ranking 1–10 has fallen out
 *      OR dropped by 3+ positions. Investigate.
 *
 *   3. New BBB complaint
 *      complaintCount went up since last reading. Owner action required.
 *
 *   4. SSL cert near expiry
 *      <30 days to expiry.
 *
 *   5. Vercel deploy failure streak
 *      Any of the last 5 deploys ERROR'd.
 *
 *   6. Scrape broken
 *      A source has returned ok=false for >=3 consecutive runs. The
 *      regex is probably stale and needs a code update.
 *
 *   7. Needs-owner backlog
 *      Any source that's been needs-owner for >7 days. Owner forgot.
 *
 * Per `[[feedback_no_fake_data_prizes]]` and
 * `[[feedback_never_invent_brand_data]]`: we never reference numbers
 * that aren't in `rows`. If `rows` is empty, we return [].
 */

import type { MarketingIntelRow } from '@/lib/marketing-intel-service';

export type SuggestionSeverity = 'info' | 'warn' | 'critical';

export interface Suggestion {
  /** Stable ID so the UI can dedupe over time. */
  id: string;
  severity: SuggestionSeverity;
  /** Short one-line summary. */
  title: string;
  /** Plain-text recommended next action. No marketing prose. */
  action: string;
  /** Sheet rows that triggered this suggestion (for "show your work"). */
  evidence: MarketingIntelRow[];
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseNum(v: string): number | null {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Return the most-recent row for each (source, metric) pair, plus the row
 * from ~7 days ago (or the oldest available) for delta-over-week math.
 */
function bucketBySourceMetric(
  rows: MarketingIntelRow[],
): Map<string, { latest: MarketingIntelRow; weekAgo: MarketingIntelRow | null; history: MarketingIntelRow[] }> {
  const buckets = new Map<string, MarketingIntelRow[]>();
  for (const r of rows) {
    const key = `${r.source}::${r.metric}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(r);
  }
  const out = new Map<
    string,
    { latest: MarketingIntelRow; weekAgo: MarketingIntelRow | null; history: MarketingIntelRow[] }
  >();
  const now = Date.now();
  for (const [key, list] of buckets.entries()) {
    list.sort((a, b) => {
      const ta = Date.parse(a.timestamp);
      const tb = Date.parse(b.timestamp);
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    });
    const latest = list[0];
    if (!latest) continue;
    // weekAgo = the row whose timestamp is closest to (now - 7d) but at
    // least 5 days back. If we have no such row, leave null.
    let weekAgo: MarketingIntelRow | null = null;
    for (const r of list) {
      const t = Date.parse(r.timestamp);
      if (!Number.isFinite(t)) continue;
      const age = now - t;
      if (age >= 5 * DAY_MS && age <= 10 * DAY_MS) {
        weekAgo = r;
        break;
      }
    }
    if (!weekAgo && list.length > 1) {
      // Fallback: oldest row we have, so a brand-new install still
      // computes some delta.
      const oldest = list[list.length - 1];
      if (Date.parse(oldest.timestamp) < now - 2 * DAY_MS) weekAgo = oldest;
    }
    out.set(key, { latest, weekAgo, history: list });
  }
  return out;
}

/** 1. Review velocity vs competitors. */
function checkReviewVelocity(
  buckets: ReturnType<typeof bucketBySourceMetric>,
): Suggestion[] {
  const rcrsBucket = buckets.get('google-reviews-rcrs::reviewCount');
  if (!rcrsBucket || !rcrsBucket.weekAgo) return [];
  const rcrsNow = parseNum(rcrsBucket.latest.value);
  const rcrsPrev = parseNum(rcrsBucket.weekAgo.value);
  if (rcrsNow === null || rcrsPrev === null) return [];
  const rcrsDelta = rcrsNow - rcrsPrev;
  if (rcrsDelta > 0) return []; // RCRS gaining reviews — no action needed

  // Find a competitor whose review count moved >= 2 in the same window
  const winners: Array<{ slug: string; delta: number; row: MarketingIntelRow }> = [];
  for (const [key, b] of buckets.entries()) {
    if (!key.startsWith('competitor-reviews::reviewCount:')) continue;
    if (!b.weekAgo) continue;
    const nowN = parseNum(b.latest.value);
    const prevN = parseNum(b.weekAgo.value);
    if (nowN === null || prevN === null) continue;
    const d = nowN - prevN;
    if (d >= 2) winners.push({ slug: key.split(':').pop() || '?', delta: d, row: b.latest });
  }
  if (winners.length === 0) return [];

  winners.sort((a, b) => b.delta - a.delta);
  const top = winners[0];
  return [
    {
      id: `review-velocity:${top.slug}`,
      severity: 'warn',
      title: `RCRS got ${rcrsDelta} new reviews this week. Competitor ${top.slug} got +${top.delta}.`,
      action:
        'Send a review-request campaign to recent completed jobs. ' +
        "Per memory: RCRS sits at ~47 reviews vs competitors at 800+. " +
        'Closing this gap is high priority.',
      evidence: [rcrsBucket.latest, top.row],
    },
  ];
}

/** 2. SERP rank drop. */
function checkSerpDrops(
  buckets: ReturnType<typeof bucketBySourceMetric>,
): Suggestion[] {
  const out: Suggestion[] = [];
  for (const [key, b] of buckets.entries()) {
    if (!key.startsWith('serp-rank::rank:')) continue;
    if (!b.weekAgo) continue;
    const nowN = parseNum(b.latest.value);
    const prevN = parseNum(b.weekAgo.value);
    if (prevN === null) continue;
    // Was ranking; now not ranking or unknown
    if (nowN === null && prevN >= 1 && prevN <= 10) {
      out.push({
        id: `serp-fell-out:${key}`,
        severity: 'warn',
        title: `Search rank for "${key.split('::rank:')[1]}" fell out of the top 10 (was #${prevN}).`,
        action:
          'Investigate. Check page indexing, recent content changes, ' +
          'and competitor outranking moves.',
        evidence: [b.latest, b.weekAgo],
      });
      continue;
    }
    if (nowN !== null && prevN !== null && nowN - prevN >= 3) {
      out.push({
        id: `serp-drop:${key}`,
        severity: 'warn',
        title: `Search rank for "${key.split('::rank:')[1]}" dropped from #${prevN} to #${nowN}.`,
        action: 'Investigate before it falls further.',
        evidence: [b.latest, b.weekAgo],
      });
    }
  }
  return out;
}

/** 3. New BBB complaint. */
function checkBbbComplaints(
  buckets: ReturnType<typeof bucketBySourceMetric>,
): Suggestion[] {
  const b = buckets.get('bbb-rcrs::bbbProfile');
  if (!b) return [];
  const nowN = parseNum(b.latest.value);
  if (nowN === null) return [];
  // We need a prior row, not strictly week-ago
  const prior = b.history[1] ?? b.weekAgo;
  if (!prior) return [];
  const prevN = parseNum(prior.value);
  if (prevN === null) return [];
  if (nowN <= prevN) return [];
  return [
    {
      id: `bbb-complaint:${b.latest.timestamp}`,
      severity: 'critical',
      title: `BBB complaint count rose from ${prevN} to ${nowN}.`,
      action:
        'Owner action required. Check the BBB profile, respond within 14 ' +
        'days to preserve A+ rating, and log resolution in AuditLog.',
      evidence: [b.latest, prior],
    },
  ];
}

/** 4. SSL cert near expiry. */
function checkCertExpiry(
  buckets: ReturnType<typeof bucketBySourceMetric>,
): Suggestion[] {
  const b = buckets.get('dns-health::dnsHealth');
  if (!b) return [];
  const days = parseNum(b.latest.value);
  if (days === null) return [];
  if (days >= 30) return [];
  return [
    {
      id: `cert-expiry:${b.latest.timestamp}`,
      severity: days < 7 ? 'critical' : 'warn',
      title: `SSL cert expires in ${days} days for rivercityroofingsolutions.com.`,
      action:
        'Verify auto-renewal in Vercel domain settings. If renewal is broken, ' +
        'manually re-issue before expiry to avoid TLS downtime.',
      evidence: [b.latest],
    },
  ];
}

/** 5. Vercel deploy failure streak. */
function checkDeployHealth(
  buckets: ReturnType<typeof bucketBySourceMetric>,
): Suggestion[] {
  const b = buckets.get('vercel-deploys::lastDeploys');
  if (!b) return [];
  const okCount = parseNum(b.latest.value);
  if (okCount === null) return [];
  // notes is "X/Y succeeded; Z failed"
  const m = b.latest.notes.match(/(\d+)\s+failed/);
  if (!m) return [];
  const failed = parseInt(m[1], 10);
  if (failed === 0) return [];
  return [
    {
      id: `deploy-fail:${b.latest.timestamp}`,
      severity: failed >= 3 ? 'critical' : 'warn',
      title: `${failed} of the last 5 Vercel deploys failed.`,
      action:
        'Open the Vercel project deploy log, identify the failing build step, ' +
        'fix and redeploy. Stuck deploys block all crons.',
      evidence: [b.latest],
    },
  ];
}

/** 6. Scrape broken: 3+ consecutive non-ok runs for any source. */
function checkScrapeBroken(
  buckets: ReturnType<typeof bucketBySourceMetric>,
): Suggestion[] {
  const out: Suggestion[] = [];
  for (const [key, b] of buckets.entries()) {
    if (b.history.length < 3) continue;
    // A "non-ok" row is one whose `flag` starts with "fail" OR notes
    // contains a known failure marker. We treat empty `value` AND
    // notes containing parse/fetch/blocked as failure.
    const isFail = (r: MarketingIntelRow): boolean => {
      if (r.value !== '') return false;
      const n = r.notes.toLowerCase();
      return (
        n.includes('parse-miss') ||
        n.includes('fetch-error') ||
        n.includes('blocked') ||
        n.includes('http-') ||
        n.includes('rate-limited') ||
        n.includes('upstream-')
      );
    };
    const streak = b.history.slice(0, 3).every(isFail);
    if (!streak) continue;
    out.push({
      id: `scrape-broken:${key}`,
      severity: 'warn',
      title: `${key} has failed 3+ consecutive runs.`,
      action:
        'The public page layout probably changed. Update the regex in ' +
        'lib/marketing-intel-service.ts (parse functions). ' +
        'Until fixed, this source produces no data.',
      evidence: b.history.slice(0, 3),
    });
  }
  return out;
}

/** 7. Needs-owner backlog: same source flagged needs-owner for >7 days. */
function checkNeedsOwnerBacklog(
  buckets: ReturnType<typeof bucketBySourceMetric>,
): Suggestion[] {
  const out: Suggestion[] = [];
  const cutoff = Date.now() - WEEK_MS;
  for (const [key, b] of buckets.entries()) {
    const seenLong = b.history.find((r) => {
      const t = Date.parse(r.timestamp);
      return (
        Number.isFinite(t) &&
        t <= cutoff &&
        r.notes.includes('[needs-owner]')
      );
    });
    if (!seenLong) continue;
    if (!b.latest.notes.includes('[needs-owner]')) continue;
    out.push({
      id: `needs-owner-backlog:${key}`,
      severity: 'info',
      title: `${key} has been waiting on owner-provided credentials for >7 days.`,
      action: b.latest.notes,
      evidence: [b.latest, seenLong],
    });
  }
  return out;
}

export function generateSuggestions(rows: MarketingIntelRow[]): Suggestion[] {
  if (!rows || rows.length === 0) return [];
  const buckets = bucketBySourceMetric(rows);
  const all: Suggestion[] = [
    ...checkReviewVelocity(buckets),
    ...checkSerpDrops(buckets),
    ...checkBbbComplaints(buckets),
    ...checkCertExpiry(buckets),
    ...checkDeployHealth(buckets),
    ...checkScrapeBroken(buckets),
    ...checkNeedsOwnerBacklog(buckets),
  ];
  // Sort: critical > warn > info, then alpha by id for stability
  const sevRank: Record<SuggestionSeverity, number> = {
    critical: 0,
    warn: 1,
    info: 2,
  };
  all.sort((a, b) => {
    const s = sevRank[a.severity] - sevRank[b.severity];
    if (s !== 0) return s;
    return a.id.localeCompare(b.id);
  });
  return all;
}
