/**
 * JobNimbus Job Search — autocomplete endpoint.
 *
 * GET /api/portal/jobnimbus/search?q=<query>&limit=10
 *
 * Powers JobSearchAutocomplete: as the user types, return up to N jobs that
 * prefix-match the query against any of {number, name, address_line1, city}.
 *
 * Uses JN's ES-style `should` filter with `prefix` clauses. Verified working
 * against live JN 2026-05-19 (scripts/test-jn-search-shapes.mjs). JN does NOT
 * support `query_string`, `multi_match`, or `match_all`, so we union prefix
 * queries per field instead.
 *
 * Returns normalized job records so every form that consumes this gets the
 * same shape regardless of how the JN job is structured upstream.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const JOBNIMBUS_API_KEY = process.env.JOBNIMBUS_API_KEY;
const JOBNIMBUS_API_URL =
  process.env.JOBNIMBUS_API_URL || 'https://app.jobnimbus.com/api1';

export interface JobSearchHit {
  jnid: string;
  rNumber: string;
  jobName: string;
  customerName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  salesRep: string;
  status: string;
}

interface JNJobRow {
  jnid: string;
  number?: string;
  name?: string;
  description?: string;
  status_name?: string;
  sales_rep_name?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state_text?: string;
  zip?: string;
  // JN puts customer phone/email on the parent job itself, not the contact
  parent_email?: string;
  parent_home_phone?: string;
  parent_mobile_phone?: string;
  parent_work_phone?: string;
  primary?: { id?: string; display_name?: string };
}

function normalizeHit(j: JNJobRow): JobSearchHit {
  const phone =
    j.parent_mobile_phone ||
    j.parent_home_phone ||
    j.parent_work_phone ||
    '';
  return {
    jnid: j.jnid,
    rNumber: j.number || '',
    jobName: j.name || '',
    customerName: j.primary?.display_name || j.name || '',
    address: [j.address_line1, j.address_line2].filter(Boolean).join(' '),
    city: j.city || '',
    state: j.state_text || '',
    zip: j.zip || '',
    phone,
    email: j.parent_email || '',
    salesRep: j.sales_rep_name || '',
    status: j.status_name || '',
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  if (!JOBNIMBUS_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'JobNimbus not configured' },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get('q') || '').trim();
  const limit = Math.min(
    Math.max(parseInt(searchParams.get('limit') || '10', 10) || 10, 1),
    25,
  );

  if (raw.length < 2) {
    return NextResponse.json({ success: true, hits: [] });
  }

  // Build prefix variants the user may have typed:
  //  - "10997"   -> also try "R-10997"
  //  - "r-10"    -> also try "R-10"
  //  - "leanna"  -> use as-is for name/address/city
  const variants = new Set<string>([raw]);
  if (/^\d+$/.test(raw)) variants.add(`R-${raw}`);
  if (/^r-?\d+$/i.test(raw)) {
    variants.add(raw.toUpperCase().replace(/^R-?/, 'R-'));
  }

  const shouldClauses: Array<Record<string, unknown>> = [];
  for (const v of variants) {
    shouldClauses.push(
      { prefix: { number: v } },
      { prefix: { name: v } },
      { prefix: { address_line1: v } },
      { prefix: { city: v } },
    );
  }

  const filter = { should: shouldClauses };
  const url = `${JOBNIMBUS_API_URL}/jobs?filter=${encodeURIComponent(
    JSON.stringify(filter),
  )}&limit=${limit}`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${JOBNIMBUS_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      const body = await res.text();
      console.warn('[jn-search] non-200', res.status, body.slice(0, 200));
      return NextResponse.json(
        { success: false, error: `JN ${res.status}` },
        { status: 502 },
      );
    }
    const data = (await res.json()) as { results?: JNJobRow[] };
    const hits = (data.results || []).map(normalizeHit);

    // R-number prefix match is the strongest signal — bubble those up first.
    // Stable sort keeps JN's own order within each bucket. JN ignores the
    // URL `limit` param on filter queries (verified 2026-05-19), so we cap
    // here instead.
    const rawLower = raw.toLowerCase();
    const ranked = hits.sort((a, b) => {
      const aR = a.rNumber.toLowerCase().startsWith(rawLower);
      const bR = b.rNumber.toLowerCase().startsWith(rawLower);
      if (aR && !bR) return -1;
      if (bR && !aR) return 1;
      return 0;
    });

    return NextResponse.json({ success: true, hits: ranked.slice(0, limit) });
  } catch (err) {
    console.error('[jn-search] error', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
