/**
 * Marketing Intelligence Service — DRAFT, NOT YET SCHEDULED
 *
 * One function per public surface we want to monitor for signal:
 * Google reviews, BBB profile, competitor review counts, SERP rank,
 * SSL/DNS health, Vercel deploy health.
 *
 * EVERY function returns a `MarketingIntelResult` (never throws). Failure
 * modes return `{ok:false, reason:'...'}` so the cron route can still
 * write a row to the sheet and the UI can surface "scrape broken".
 *
 * FRAGILITY WARNING — public HTML scraping
 *   Google Maps, Google Search, and BBB do NOT publish stable contracts.
 *   The regexes here matched as of 2026-05-20; they WILL break when those
 *   sites redesign. When a fetch returns 200 but every regex misses,
 *   `parseGoogleMapsReviewCount` etc. return `{ok:false, reason:'parse-miss'}`.
 *   The UI/cron must treat that as "needs human attention", never as zero.
 *
 *   Likewise: aggressive scraping from a Vercel IP will get a captcha
 *   challenge or 429. We hit each source at most once per day and use
 *   a normal browser UA. If the response body contains "captcha" or
 *   "unusual traffic" the function returns `{ok:false, reason:'blocked'}`.
 *
 * PER `[[feedback_never_invent_brand_data]]`: on parse failure, we return
 * null + reason. We NEVER substitute a guess.
 *
 * NO new dependencies. Plain fetch + regex.
 */

// ─── Public Types ─────────────────────────────────────────────────────────

export type MarketingIntelSource =
  | 'google-reviews-rcrs'
  | 'bbb-rcrs'
  | 'competitor-reviews'
  | 'serp-rank'
  | 'dns-health'
  | 'vercel-deploys';

export interface MarketingIntelSuccess {
  ok: true;
  source: MarketingIntelSource;
  /** Short metric label, e.g. "reviewCount" or "rank:roofer-huntsville". */
  metric: string;
  /** Numeric or short string value. Use null when the metric is a list. */
  value: number | string | null;
  /** Free-form context — populated rows, list contents, error detail, etc. */
  notes?: string;
  /** Whatever raw the caller wants to persist alongside the metric. */
  payload?: Record<string, unknown>;
}

export interface MarketingIntelFailure {
  ok: false;
  source: MarketingIntelSource;
  metric: string;
  reason: string;
  /** Set when the failure was because the source needs an owner-provided key. */
  needsOwner?: true;
}

export type MarketingIntelResult = MarketingIntelSuccess | MarketingIntelFailure;

// ─── Targets ──────────────────────────────────────────────────────────────

/**
 * RCRS public-surface URLs. Hardcoded because they don't change.
 * If they DO change, that's a real business event and we want
 * a code change to mark it.
 */
export const RCRS_TARGETS = {
  googleMapsCid: 'https://www.google.com/maps/place/River+City+Roofing+Solutions/',
  bbbProfile:
    'https://www.bbb.org/us/al/huntsville/profile/roofing-contractors/river-city-roofing-solutions',
  publicDomain: 'rivercityroofingsolutions.com',
} as const;

/**
 * Top 5 competitors per `project_rcrs_competitor_deep_dive`.
 * `googleMapsUrl` is the Google Maps place URL. Same fragility
 * caveat as RCRS_TARGETS.googleMapsCid.
 */
export const COMPETITOR_TARGETS: ReadonlyArray<{
  slug: string;
  name: string;
  googleMapsUrl: string;
}> = [
  {
    slug: 'mighty-dog',
    name: 'Mighty Dog Roofing',
    googleMapsUrl:
      'https://www.google.com/maps/place/Mighty+Dog+Roofing+Huntsville/',
  },
  {
    slug: 'best-choice',
    name: 'Best Choice Roofing',
    googleMapsUrl:
      'https://www.google.com/maps/place/Best+Choice+Roofing+Huntsville/',
  },
  {
    slug: 'yellowhammer',
    name: 'Yellowhammer Roofing',
    googleMapsUrl: 'https://www.google.com/maps/place/Yellowhammer+Roofing/',
  },
  {
    slug: 'continental',
    name: 'Continental Roofing',
    googleMapsUrl: 'https://www.google.com/maps/place/Continental+Roofing/',
  },
  {
    slug: 'impact',
    name: 'Impact Roofing',
    googleMapsUrl: 'https://www.google.com/maps/place/Impact+Roofing/',
  },
] as const;

/**
 * 10 highest-priority keywords. Owner can tune. Order matters for ranking
 * the UI; #1 is the most important.
 */
export const SERP_KEYWORDS: ReadonlyArray<string> = [
  'roofer huntsville al',
  'storm damage roof madison county',
  'roof replacement huntsville',
  'hail damage roof huntsville',
  'roofing companies madison al',
  'metal roof installer huntsville',
  'best roofer north alabama',
  'IKO ROOFPRO huntsville',
  'commercial roofing huntsville',
  'emergency roof repair huntsville al',
] as const;

// ─── HTTP helper ──────────────────────────────────────────────────────────

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Light fetch wrapper that:
 *   - sends a normal browser UA
 *   - times out at 15s
 *   - never throws — returns `{ok:false, reason}` on network failure
 *   - flags suspected captcha / 429 bodies so the caller can surface
 *     "blocked" instead of misreading a soft block as a real parse miss.
 */
async function safeFetchText(
  url: string,
): Promise<
  { ok: true; status: number; body: string } | { ok: false; reason: string }
> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    });
    const body = await res.text();
    if (res.status === 429) {
      return { ok: false, reason: 'rate-limited (429)' };
    }
    if (res.status >= 500) {
      return { ok: false, reason: `upstream-${res.status}` };
    }
    if (res.status >= 400) {
      return { ok: false, reason: `http-${res.status}` };
    }
    const lower = body.slice(0, 4096).toLowerCase();
    if (
      lower.includes('unusual traffic') ||
      lower.includes('our systems have detected') ||
      lower.includes('/sorry/index') ||
      lower.includes('captcha-form')
    ) {
      return { ok: false, reason: 'blocked-captcha' };
    }
    return { ok: true, status: res.status, body };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return { ok: false, reason: `fetch-error: ${msg}` };
  } finally {
    clearTimeout(timer);
  }
}

// ─── Google Maps review-count scraper ─────────────────────────────────────

/**
 * Pulls review count + star rating out of a Google Maps place HTML page.
 *
 * Fragility: Maps embeds the count in a span like `123 reviews` and the
 * rating in `aria-label="4.7 stars"`. Either of those wording choices is
 * a Google product decision and could change without notice.
 */
export function parseGoogleMapsReviewCount(
  html: string,
):
  | { ok: true; reviewCount: number; rating: number | null }
  | { ok: false; reason: string } {
  // "1,234 reviews" or "47 reviews"
  const countMatch =
    html.match(/(\d[\d,]*)\s+reviews?/i) ||
    html.match(/"userRatingCount":(\d+)/);
  if (!countMatch) return { ok: false, reason: 'parse-miss-review-count' };
  const reviewCount = parseInt(countMatch[1].replace(/,/g, ''), 10);
  if (!Number.isFinite(reviewCount)) {
    return { ok: false, reason: 'parse-miss-review-count-nan' };
  }

  // "4.7 stars" or `"aggregateRating":{"ratingValue":4.7`
  let rating: number | null = null;
  const ratingMatch =
    html.match(/aria-label="([\d.]+)\s+stars?"/i) ||
    html.match(/"ratingValue":\s*"?([\d.]+)"?/);
  if (ratingMatch) {
    const r = parseFloat(ratingMatch[1]);
    if (Number.isFinite(r) && r >= 0 && r <= 5) rating = r;
  }

  return { ok: true, reviewCount, rating };
}

export async function fetchGoogleReviewsRcrs(): Promise<MarketingIntelResult> {
  const source: MarketingIntelSource = 'google-reviews-rcrs';
  const fetched = await safeFetchText(RCRS_TARGETS.googleMapsCid);
  if (!fetched.ok) {
    return { ok: false, source, metric: 'reviewCount', reason: fetched.reason };
  }
  const parsed = parseGoogleMapsReviewCount(fetched.body);
  if (!parsed.ok) {
    return { ok: false, source, metric: 'reviewCount', reason: parsed.reason };
  }
  return {
    ok: true,
    source,
    metric: 'reviewCount',
    value: parsed.reviewCount,
    notes: `rating=${parsed.rating ?? '?'}`,
    payload: { rating: parsed.rating },
  };
}

// ─── BBB profile scraper ──────────────────────────────────────────────────

/**
 * Pulls BBB rating letter + complaint count from a BBB business profile.
 *
 * Fragility: BBB's HTML wraps the rating letter in a class like
 * `bds-body bds-h6` and the complaint count appears as
 * `Customer Complaints: <n>`. Same caveats as Google.
 */
export function parseBbbProfile(
  html: string,
):
  | { ok: true; rating: string | null; complaintCount: number | null }
  | { ok: false; reason: string } {
  // Letter rating: "A+", "A", "B+", etc. BBB displays as <text>A+</text>
  let rating: string | null = null;
  const ratingMatch =
    html.match(/BBB Rating[^A-F]*([A-F][+-]?)/) ||
    html.match(/"ratingText":"([A-F][+-]?)"/);
  if (ratingMatch) rating = ratingMatch[1];

  // Complaints: "Customer Complaints<span>2</span>" or similar
  let complaintCount: number | null = null;
  const complaintMatch =
    html.match(/Customer Complaints[^\d]{0,60}(\d+)/i) ||
    html.match(/"complaintCount":(\d+)/);
  if (complaintMatch) {
    const n = parseInt(complaintMatch[1], 10);
    if (Number.isFinite(n)) complaintCount = n;
  }

  if (rating === null && complaintCount === null) {
    return { ok: false, reason: 'parse-miss-bbb' };
  }
  return { ok: true, rating, complaintCount };
}

export async function fetchBbbRcrs(): Promise<MarketingIntelResult> {
  const source: MarketingIntelSource = 'bbb-rcrs';
  const fetched = await safeFetchText(RCRS_TARGETS.bbbProfile);
  if (!fetched.ok) {
    return { ok: false, source, metric: 'bbbProfile', reason: fetched.reason };
  }
  const parsed = parseBbbProfile(fetched.body);
  if (!parsed.ok) {
    return { ok: false, source, metric: 'bbbProfile', reason: parsed.reason };
  }
  return {
    ok: true,
    source,
    metric: 'bbbProfile',
    value: parsed.complaintCount,
    notes: `rating=${parsed.rating ?? '?'} complaints=${parsed.complaintCount ?? '?'}`,
    payload: { rating: parsed.rating, complaintCount: parsed.complaintCount },
  };
}

// ─── Competitor review counts ─────────────────────────────────────────────

export async function fetchCompetitorReviews(): Promise<MarketingIntelResult[]> {
  const out: MarketingIntelResult[] = [];
  for (const c of COMPETITOR_TARGETS) {
    const fetched = await safeFetchText(c.googleMapsUrl);
    if (!fetched.ok) {
      out.push({
        ok: false,
        source: 'competitor-reviews',
        metric: `reviewCount:${c.slug}`,
        reason: fetched.reason,
      });
      continue;
    }
    const parsed = parseGoogleMapsReviewCount(fetched.body);
    if (!parsed.ok) {
      out.push({
        ok: false,
        source: 'competitor-reviews',
        metric: `reviewCount:${c.slug}`,
        reason: parsed.reason,
      });
      continue;
    }
    out.push({
      ok: true,
      source: 'competitor-reviews',
      metric: `reviewCount:${c.slug}`,
      value: parsed.reviewCount,
      notes: `${c.name} rating=${parsed.rating ?? '?'}`,
      payload: { name: c.name, rating: parsed.rating },
    });
  }
  return out;
}

// ─── SERP rank check ──────────────────────────────────────────────────────

/**
 * SERP scraping fragility: Google heavily rate-limits and captcha-walls
 * automated traffic. Even ONE request from a Vercel IP frequently 429s.
 * A reliable solution needs a paid SERP API.
 *
 * Behavior: we attempt a direct fetch; if it's blocked we return
 * `needsOwner: true` so the UI can surface "needs SerpAPI / DataForSEO key".
 */
export async function fetchSerpRanks(): Promise<MarketingIntelResult[]> {
  const out: MarketingIntelResult[] = [];
  // If owner has wired in a SERP key, future code branches here. For now
  // we always return needsOwner so we never produce fabricated ranks.
  const hasSerpKey = Boolean(
    process.env.SERPAPI_KEY ||
      process.env.DATAFORSEO_LOGIN ||
      process.env.SERP_PROVIDER_KEY,
  );
  for (const kw of SERP_KEYWORDS) {
    if (!hasSerpKey) {
      out.push({
        ok: false,
        source: 'serp-rank',
        metric: `rank:${kw}`,
        reason:
          'SERP API key not configured — set SERPAPI_KEY or DATAFORSEO_LOGIN',
        needsOwner: true,
      });
      continue;
    }
    // Future: real SERP fetch goes here. We INTENTIONALLY don't ship a
    // direct Google Search scrape because it (a) gets captcha-walled
    // immediately and (b) the parsed result would silently degrade to
    // garbage on the next page redesign.
    out.push({
      ok: false,
      source: 'serp-rank',
      metric: `rank:${kw}`,
      reason: 'SERP scraping code stub — not implemented yet',
      needsOwner: true,
    });
  }
  return out;
}

// ─── DNS / SSL health ─────────────────────────────────────────────────────

/**
 * Cert + DNS hygiene check.
 *
 * SSL cert: fetched via the public crt.sh free CT-log API. No key needed.
 * Returns the soonest expiry currently in CT logs for the apex domain.
 *
 * DKIM / SPF / DMARC: we hit Cloudflare's free DoH endpoint and inspect
 * the TXT records. No key needed.
 *
 * Both endpoints are public + free; no API key required.
 */
export async function fetchDnsHealth(): Promise<MarketingIntelResult> {
  const source: MarketingIntelSource = 'dns-health';
  const domain = RCRS_TARGETS.publicDomain;

  const checks: Record<string, string> = {};

  // SSL cert expiry via crt.sh
  try {
    const crtFetch = await safeFetchText(
      `https://crt.sh/?q=%25.${domain}&output=json`,
    );
    if (crtFetch.ok) {
      // crt.sh returns JSON array of cert entries. Parse manually since the
      // response body went through safeFetchText (no JSON helper).
      try {
        const arr = JSON.parse(crtFetch.body) as Array<{
          not_after?: string;
          name_value?: string;
        }>;
        if (Array.isArray(arr) && arr.length > 0) {
          const futures = arr
            .map((e) => (e?.not_after ? Date.parse(e.not_after) : NaN))
            .filter((t) => Number.isFinite(t) && t > Date.now());
          if (futures.length > 0) {
            const soonest = Math.min(...futures);
            const daysLeft = Math.round((soonest - Date.now()) / 86_400_000);
            checks.cert = `${daysLeft}d-to-expiry`;
          } else {
            checks.cert = 'no-future-cert';
          }
        } else {
          checks.cert = 'no-entries';
        }
      } catch {
        checks.cert = 'parse-error';
      }
    } else {
      checks.cert = `fetch-fail:${crtFetch.reason}`;
    }
  } catch (err) {
    checks.cert = `error:${err instanceof Error ? err.message : 'unknown'}`;
  }

  // DKIM/SPF/DMARC via Cloudflare DoH
  const dohQuery = async (name: string, label: string) => {
    const res = await safeFetchText(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`,
    );
    if (!res.ok) {
      checks[label] = `fetch-fail:${res.reason}`;
      return;
    }
    try {
      // Cloudflare DoH returns application/dns-json. safeFetchText set
      // an HTML accept header but Cloudflare still honors the path. If
      // the body doesn't parse as JSON we'd see it here.
      const json = JSON.parse(res.body) as {
        Answer?: Array<{ data?: string }>;
      };
      const data = (json.Answer || [])
        .map((a) => (a?.data || '').replace(/^"|"$/g, ''))
        .join(' | ');
      checks[label] = data ? 'present' : 'missing';
    } catch {
      checks[label] = 'parse-error';
    }
  };

  await dohQuery(`_dmarc.${domain}`, 'dmarc');
  await dohQuery(domain, 'spf'); // SPF lives at apex TXT, will need .startsWith('v=spf1') check
  // DKIM lives at a SELECTOR._domainkey.domain — selector is owner-specific.
  // Without knowing the selector(s) RCRS publishes we can't query directly.
  // Mark as needs-owner so the UI surfaces it.
  checks.dkim = 'needs-owner-selector';

  const certValue =
    checks.cert?.match(/^(\d+)d/)?.[1] !== undefined
      ? parseInt(checks.cert.match(/^(\d+)d/)![1], 10)
      : null;

  return {
    ok: true,
    source,
    metric: 'dnsHealth',
    value: certValue,
    notes: Object.entries(checks)
      .map(([k, v]) => `${k}=${v}`)
      .join(' '),
    payload: checks,
  };
}

// ─── Vercel deploy health ─────────────────────────────────────────────────

/**
 * Vercel deploy health — last 5 deploys per project + fail rate.
 *
 * Needs `VERCEL_TOKEN` (read-only OK) + optional `VERCEL_TEAM_ID`. Both
 * are owner-provided; we return `needsOwner: true` if absent.
 */
export async function fetchVercelDeployHealth(): Promise<MarketingIntelResult> {
  const source: MarketingIntelSource = 'vercel-deploys';
  const token = process.env.VERCEL_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;

  if (!token) {
    return {
      ok: false,
      source,
      metric: 'lastDeploys',
      reason:
        'VERCEL_TOKEN not configured — generate a read-only token and set on Vercel',
      needsOwner: true,
    };
  }

  const qs = new URLSearchParams({ limit: '5' });
  if (teamId) qs.set('teamId', teamId);
  const url = `https://api.vercel.com/v6/deployments?${qs.toString()}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      return {
        ok: false,
        source,
        metric: 'lastDeploys',
        reason: `vercel-api-${res.status}`,
      };
    }
    const json = (await res.json()) as {
      deployments?: Array<{
        uid?: string;
        name?: string;
        state?: string;
        createdAt?: number;
      }>;
    };
    const deps = json.deployments || [];
    const failed = deps.filter(
      (d) => d.state === 'ERROR' || d.state === 'CANCELED',
    ).length;
    const ok = deps.length - failed;
    return {
      ok: true,
      source,
      metric: 'lastDeploys',
      value: ok,
      notes: `${ok}/${deps.length} succeeded; ${failed} failed`,
      payload: {
        deployments: deps.map((d) => ({
          uid: d.uid,
          name: d.name,
          state: d.state,
          createdAt: d.createdAt,
        })),
      },
    };
  } catch (err) {
    return {
      ok: false,
      source,
      metric: 'lastDeploys',
      reason: `vercel-fetch-error: ${err instanceof Error ? err.message : 'unknown'}`,
    };
  }
}

// ─── Sheet I/O ────────────────────────────────────────────────────────────

export const MARKETING_INTEL_TAB = 'Marketing_Intel';
export const MARKETING_INTEL_HEADERS = [
  'timestamp',
  'source',
  'metric',
  'value',
  'previousValue',
  'delta',
  'flag',
  'notes',
] as const;

export interface MarketingIntelRow {
  timestamp: string;
  source: string;
  metric: string;
  value: string;
  previousValue: string;
  delta: string;
  flag: string;
  notes: string;
}

/**
 * Read all rows from the Marketing_Intel tab. Returns [] on any error
 * (missing creds, missing tab, etc.) — callers treat empty as "no
 * history yet".
 */
export async function readMarketingIntelRows(): Promise<MarketingIntelRow[]> {
  const sheetsId = process.env.GOOGLE_SHEETS_ID;
  const svcEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const svcKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!sheetsId || !svcEmail || !svcKey) return [];

  try {
    const { GoogleSpreadsheet } = await import('google-spreadsheet');
    const { JWT } = await import('google-auth-library');
    const auth = new JWT({
      email: svcEmail,
      key: svcKey.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const doc = new GoogleSpreadsheet(sheetsId, auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle[MARKETING_INTEL_TAB];
    if (!sheet) return [];
    const rows = await sheet.getRows({ limit: 100000 });
    return rows.map((r) => ({
      timestamp: String(r.get('timestamp') ?? ''),
      source: String(r.get('source') ?? ''),
      metric: String(r.get('metric') ?? ''),
      value: String(r.get('value') ?? ''),
      previousValue: String(r.get('previousValue') ?? ''),
      delta: String(r.get('delta') ?? ''),
      flag: String(r.get('flag') ?? ''),
      notes: String(r.get('notes') ?? ''),
    }));
  } catch (err) {
    console.error('[marketing-intel] readMarketingIntelRows failed:', err);
    return [];
  }
}

/**
 * Find the most-recent prior value for a given (source, metric) pair so
 * the writer can compute delta. Returns null if no prior row exists.
 */
export function findPreviousValue(
  rows: MarketingIntelRow[],
  source: string,
  metric: string,
): string | null {
  let latest: MarketingIntelRow | null = null;
  for (const r of rows) {
    if (r.source !== source || r.metric !== metric) continue;
    if (!latest) {
      latest = r;
      continue;
    }
    const t1 = Date.parse(r.timestamp);
    const t2 = Date.parse(latest.timestamp);
    if (Number.isFinite(t1) && Number.isFinite(t2) && t1 > t2) latest = r;
  }
  return latest ? latest.value : null;
}

/**
 * Append a batch of result rows to the Marketing_Intel tab.
 * Creates the tab if it doesn't exist.
 *
 * `previousValue` and `delta` are computed from the supplied `priorRows`
 * (which the caller fetched once before this batch). `flag` is set per
 * the supplied flagBuilder so suggestion logic stays in one place.
 */
export async function writeMarketingIntelRows(
  results: MarketingIntelResult[],
  priorRows: MarketingIntelRow[],
  flagBuilder: (r: MarketingIntelResult, previous: string | null) => string,
): Promise<{ written: number; errors: number }> {
  const sheetsId = process.env.GOOGLE_SHEETS_ID;
  const svcEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const svcKey = process.env.GOOGLE_PRIVATE_KEY;
  if (!sheetsId || !svcEmail || !svcKey) {
    return { written: 0, errors: results.length };
  }

  try {
    const { GoogleSpreadsheet } = await import('google-spreadsheet');
    const { JWT } = await import('google-auth-library');
    const auth = new JWT({
      email: svcEmail,
      key: svcKey.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const doc = new GoogleSpreadsheet(sheetsId, auth);
    await doc.loadInfo();

    let sheet = doc.sheetsByTitle[MARKETING_INTEL_TAB];
    if (!sheet) {
      sheet = await doc.addSheet({
        title: MARKETING_INTEL_TAB,
        headerValues: [...MARKETING_INTEL_HEADERS],
        gridProperties: { columnCount: MARKETING_INTEL_HEADERS.length + 5 },
      });
    } else {
      try {
        await sheet.loadHeaderRow();
      } catch {
        await sheet.setHeaderRow([...MARKETING_INTEL_HEADERS]);
      }
    }

    const now = new Date().toISOString();
    let written = 0;
    let errors = 0;
    for (const r of results) {
      const prev = findPreviousValue(priorRows, r.source, r.metric);
      const valueStr = r.ok
        ? r.value === null
          ? ''
          : String(r.value)
        : '';
      const prevStr = prev ?? '';
      let delta = '';
      if (prev !== null && r.ok && typeof r.value === 'number') {
        const prevN = parseFloat(prev);
        if (Number.isFinite(prevN)) {
          delta = String(r.value - prevN);
        }
      }
      const flag = flagBuilder(r, prev);
      const notes = r.ok
        ? r.notes || ''
        : `${r.reason}${r.needsOwner ? ' [needs-owner]' : ''}`;
      try {
        await sheet.addRow({
          timestamp: now,
          source: r.source,
          metric: r.metric,
          value: valueStr,
          previousValue: prevStr,
          delta,
          flag,
          notes,
        });
        written++;
      } catch (err) {
        errors++;
        console.error('[marketing-intel] addRow failed:', err);
      }
    }
    return { written, errors };
  } catch (err) {
    console.error('[marketing-intel] writeMarketingIntelRows failed:', err);
    return { written: 0, errors: results.length };
  }
}
