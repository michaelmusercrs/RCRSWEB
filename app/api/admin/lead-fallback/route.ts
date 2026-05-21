/**
 * Admin Lead Fallback API
 *
 * Backs the /admin/lead-fallback viewer page. Lists every fallback blob
 * (pending + recovered, latest 100 by uploadedAt) and supports a one-shot
 * replay-now POST. Admin-gated via requireAdmin.
 *
 * GET /api/admin/lead-fallback
 *   - Returns the latest 100 entries from both leads-fallback/ and
 *     leads-recovered/, merged + sorted by uploadedAt desc.
 *
 * POST /api/admin/lead-fallback
 *   - Body: { blobKey: string }  (the pathname, e.g. "leads-fallback/2026-05-21/contact-...")
 *   - Triggers a one-shot replay by calling the same replay logic the
 *     cron uses. Returns { success, recovered, error? }.
 *
 * Auth: requireAdmin — admin + owner roles, plus Richard Geahr by slug
 * (mirrors the wider admin surface convention).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-service';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import type { FallbackBlobShape } from '@/lib/lead-fallback';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const FALLBACK_PREFIX = 'leads-fallback/';
const RECOVERED_PREFIX = 'leads-recovered/';

interface FallbackListEntry {
  blobKey: string;       // pathname (e.g. "leads-fallback/2026-05-21/contact-...")
  url: string;
  source: string;
  reason: string;
  capturedAt: string;
  recoveredAt: string | null;
  recovered: boolean;
  originalError?: string;
  size: number;
}

async function fetchJson(url: string): Promise<FallbackBlobShape | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as FallbackBlobShape;
  } catch {
    return null;
  }
}

async function listPrefix(prefix: string): Promise<Array<{ pathname: string; url: string; uploadedAt: string; size: number }>> {
  const { list } = await import('@vercel/blob');
  const out: Array<{ pathname: string; url: string; uploadedAt: string; size: number }> = [];
  let cursor: string | undefined;
  for (let i = 0; i < 5; i++) {  // cap admin list at ~500 entries — more than enough for UI
    const page = await list({ prefix, cursor, limit: 100 });
    for (const b of page.blobs) {
      out.push({
        pathname: b.pathname,
        url: b.url,
        uploadedAt: b.uploadedAt instanceof Date ? b.uploadedAt.toISOString() : String(b.uploadedAt),
        size: b.size,
      });
    }
    if (!page.cursor) break;
    cursor = page.cursor;
  }
  return out;
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({
      success: true,
      configured: false,
      message: 'BLOB_READ_WRITE_TOKEN not set — fallback storage disabled.',
      entries: [],
    });
  }

  try {
    const [fallback, recovered] = await Promise.all([
      listPrefix(FALLBACK_PREFIX),
      listPrefix(RECOVERED_PREFIX),
    ]);

    // Sort newest-first by uploadedAt, then cap at 100 for the UI.
    const allBlobs = [...fallback, ...recovered].sort((a, b) =>
      b.uploadedAt.localeCompare(a.uploadedAt),
    ).slice(0, 100);

    // Hydrate JSON metadata in parallel. Fetch is cheap because each
    // blob is ~1kb.
    const entries: FallbackListEntry[] = await Promise.all(
      allBlobs.map(async (b): Promise<FallbackListEntry> => {
        const json = await fetchJson(b.url);
        return {
          blobKey: b.pathname,
          url: b.url,
          source: json?.source ?? 'unknown',
          reason: json?.reason ?? 'unknown',
          capturedAt: json?.capturedAt ?? b.uploadedAt,
          recoveredAt: json?.recoveredAt ?? null,
          recovered: b.pathname.startsWith(RECOVERED_PREFIX) || Boolean(json?.recoveredAt),
          originalError: json?.originalError,
          size: b.size,
        };
      }),
    );

    return NextResponse.json({
      success: true,
      configured: true,
      entries,
      counts: {
        pending: entries.filter(e => !e.recovered).length,
        recovered: entries.filter(e => e.recovered).length,
        total: entries.length,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[admin/lead-fallback GET] failed:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// ─── One-shot replay (POST) ───────────────────────────────────────────────────

// Re-import the same per-source replay logic the cron uses. Rather than
// duplicate the replay functions, we lazy-load via the cron route's
// internals. Since route handlers can't share non-export internals, we
// reimplement the dispatch here in-line — the body of each replay is
// thin enough that maintaining two copies is cheaper than refactoring
// into a third shared module. The shape of each tab is enforced once,
// in the cron file's comments — both copies write to identical
// columns/types.

interface SheetsHandle { doc: GoogleSpreadsheet }

async function loadSheetsDoc(): Promise<SheetsHandle | null> {
  const id = process.env.GOOGLE_SHEETS_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!id || !email || !key) return null;
  const jwt = new JWT({ email, key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const doc = new GoogleSpreadsheet(id, jwt);
  await doc.loadInfo();
  return { doc };
}

function sanitize(value: unknown): string {
  if (value == null) return '';
  const s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) return `'${s}`;
  return s;
}

async function ensureSheet(handle: SheetsHandle, title: string, headerValues: string[]) {
  let sheet = handle.doc.sheetsByTitle[title];
  if (!sheet) {
    sheet = await handle.doc.addSheet({ title, headerValues });
  } else {
    try { await sheet.loadHeaderRow(); } catch { await sheet.setHeaderRow(headerValues); }
  }
  return sheet;
}

async function replayBlob(handle: SheetsHandle, blob: FallbackBlobShape): Promise<void> {
  const p = blob.payload;
  switch (blob.source) {
    case 'email-capture': {
      const sheet = await ensureSheet(handle, 'Email Captures', [
        'Timestamp', 'Name', 'Email', 'Phone', 'Address',
        'Source Page', 'UTM Source', 'UTM Medium', 'UTM Campaign',
        'UTM Term', 'UTM Content', 'Status',
      ]);
      await sheet.addRow({
        Timestamp: sanitize(p.timestamp ?? new Date().toISOString()),
        Name: sanitize(p.name), Email: sanitize(p.email),
        Phone: sanitize(p.phone ?? ''), Address: sanitize(p.address ?? ''),
        'Source Page': sanitize(p.sourcePage ?? ''),
        'UTM Source': sanitize(p.utmSource ?? ''),
        'UTM Medium': sanitize(p.utmMedium ?? ''),
        'UTM Campaign': sanitize(p.utmCampaign ?? ''),
        'UTM Term': sanitize(p.utmTerm ?? ''),
        'UTM Content': sanitize(p.utmContent ?? ''),
        Status: sanitize(p.status ?? 'new'),
      });
      return;
    }
    case 'contact':
    case 'contact-form':
    case 'careers':
    case 'bni-partner': {
      const sheet = await ensureSheet(handle, 'contact-submissions', [
        'id', 'timestamp', 'status', 'sourcePage', 'name', 'email', 'phone',
        'subject', 'message', 'preferredInspector', 'serviceType', 'serviceArea',
        'leadSource', 'leadSourceDetail', 'marketingSource',
      ]);
      await sheet.addRow({
        id: `recovered-${Date.now()}`,
        timestamp: new Date().toISOString(),
        status: 'new',
        sourcePage: sanitize(p.sourcePage ?? ''),
        name: sanitize(p.name),
        email: sanitize(p.email ?? ''),
        phone: sanitize(p.phone ?? ''),
        subject: sanitize(p.subject ?? ''),
        message: sanitize(p.message ?? ''),
        preferredInspector: sanitize(p.preferredInspector ?? 'First Available'),
        serviceType: sanitize(p.serviceType ?? ''),
        serviceArea: sanitize(p.serviceArea ?? ''),
        leadSource: sanitize(p.leadSource ?? 'Direct'),
        leadSourceDetail: sanitize(p.leadSourceDetail ?? ''),
        marketingSource: sanitize(p.marketingSource ?? 'Website - Recovered'),
      });
      return;
    }
    case 'referral': {
      const sheet = await ensureSheet(handle, 'referral-submissions', [
        'id', 'timestamp', 'status', 'sourcePage', 'referrerName', 'referrerPhone',
        'referrerEmail', 'referralName', 'referralPhone', 'referralEmail',
        'referralAddress', 'salesRep', 'notes',
      ]);
      await sheet.addRow({
        id: `recovered-${Date.now()}`,
        timestamp: new Date().toISOString(),
        status: 'new',
        sourcePage: sanitize(p.sourcePage ?? ''),
        referrerName: sanitize(p.referrerName),
        referrerPhone: sanitize(p.referrerPhone),
        referrerEmail: sanitize(p.referrerEmail ?? ''),
        referralName: sanitize(p.referralName),
        referralPhone: sanitize(p.referralPhone),
        referralEmail: sanitize(p.referralEmail ?? ''),
        referralAddress: sanitize(p.referralAddress),
        salesRep: sanitize(p.salesRep ?? ''),
        notes: sanitize(p.notes ?? ''),
      });
      return;
    }
    case 'storm-report': {
      const r = p.generatedReport as Record<string, unknown> | undefined;
      if (!r) throw new Error('storm-report fallback missing generatedReport');
      const sheet = await ensureSheet(handle, 'Storm_Reports', [
        'reportId', 'generatedAt', 'address', 'city', 'state', 'zip', 'fullAddress',
        'dateRangeStart', 'dateRangeEnd', 'searchRadiusMiles',
        'hailEventsJson', 'windEventsJson', 'activeAlertsJson',
        'riskLevel', 'riskScore', 'riskFactorsJson', 'recommendation',
        'totalHailReports', 'closestHailMiles', 'largestHailSize', 'largestHailSizeNum',
        'hailReconJson', 'hailReconTotalStorms', 'hailReconLargestSize', 'hailReconLargestSizeLabel',
        'leadId', 'customerId', 'sharedWithCustomer', 'sharedAt', 'sharedBy',
      ]);
      await sheet.addRow({
        reportId: sanitize(r.reportId), generatedAt: sanitize(r.generatedAt),
        address: sanitize(r.address), city: sanitize(r.city),
        state: sanitize(r.state), zip: sanitize(r.zip),
        fullAddress: sanitize(r.fullAddress),
        dateRangeStart: sanitize(r.dateRangeStart),
        dateRangeEnd: sanitize(r.dateRangeEnd),
        searchRadiusMiles: sanitize(r.searchRadiusMiles),
        hailEventsJson: JSON.stringify(r.hailEvents ?? []),
        windEventsJson: JSON.stringify(r.windEvents ?? []),
        activeAlertsJson: JSON.stringify(r.activeAlerts ?? []),
        riskLevel: sanitize(r.riskLevel),
        riskScore: sanitize(r.riskScore),
        riskFactorsJson: JSON.stringify(r.riskFactors ?? []),
        recommendation: sanitize(r.recommendation),
        totalHailReports: sanitize(r.totalHailReports),
        closestHailMiles: r.closestHailMiles != null ? sanitize(r.closestHailMiles) : '',
        largestHailSize: sanitize(r.largestHailSize ?? ''),
        largestHailSizeNum: sanitize(r.largestHailSizeNum),
        hailReconJson: JSON.stringify(r.hailReconEvents ?? []),
        hailReconTotalStorms: sanitize(r.hailReconTotalStorms),
        hailReconLargestSize: sanitize(r.hailReconLargestSize),
        hailReconLargestSizeLabel: sanitize(r.hailReconLargestSizeLabel),
        leadId: sanitize(r.leadId ?? ''),
        customerId: sanitize(r.customerId ?? ''),
        sharedWithCustomer: sanitize(r.sharedWithCustomer ?? false),
        sharedAt: sanitize(r.sharedAt ?? ''),
        sharedBy: sanitize(r.sharedBy ?? ''),
      });
      return;
    }
    case 'leads-new': {
      const meta = (p._meta as Record<string, unknown> | undefined) ?? {};
      const sheet = await ensureSheet(handle, 'All Lead Submissions', [
        'Timestamp', 'Lead ID', 'Name', 'Email', 'Phone', 'Address',
        'City', 'State', 'Zip', 'Source', 'Source Details', 'Source Page',
        'Service Type', 'Message', 'Urgency',
        'Spam Score', 'Spam Reasons', 'Is Spam', 'Passed Filter',
        'IP Address', 'User Agent', 'Referer',
        'JN Match Found', 'JN Match ID', 'JN Match Name', 'JN Match Type',
        'Duplicate Found', 'Duplicate Match By',
        'County', 'Status',
      ]);
      await sheet.addRow({
        Timestamp: sanitize(meta.timestamp ?? new Date().toISOString()),
        'Lead ID': `LEAD-RECOVERED-${Date.now()}`,
        Name: sanitize(p.name), Email: sanitize(p.email),
        Phone: sanitize(p.phone ?? ''), Address: sanitize(p.address ?? ''),
        City: sanitize(p.city ?? ''), State: sanitize(p.state ?? ''),
        Zip: sanitize(p.zip ?? ''),
        Source: sanitize(p.source ?? ''),
        'Source Details': sanitize(p.sourceDetails ?? ''),
        'Source Page': sanitize(p.sourcePage ?? ''),
        'Service Type': sanitize(p.serviceType ?? ''),
        Message: sanitize(p.message ?? ''),
        Urgency: sanitize(p.urgency ?? 'normal'),
        'Spam Score': sanitize(meta.spamScore ?? ''),
        'Spam Reasons': Array.isArray(meta.spamReasons) ? meta.spamReasons.join('; ') : sanitize(meta.spamReasons ?? ''),
        'Is Spam': meta.isSpam ? 'YES' : 'NO',
        'Passed Filter': meta.passedFilter ? 'YES' : 'NO',
        'IP Address': sanitize(meta.ip ?? 'unknown'),
        'User Agent': sanitize(meta.userAgent ?? ''),
        Referer: sanitize(meta.referer ?? ''),
        'JN Match Found': '', 'JN Match ID': '', 'JN Match Name': '', 'JN Match Type': '',
        'Duplicate Found': '', 'Duplicate Match By': '',
        County: '',
        Status: meta.isSpam ? 'spam' : 'new',
      });
      return;
    }
    default:
      throw new Error(`Unknown lead-fallback source: ${blob.source}`);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authenticated) return auth.response;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ success: false, error: 'BLOB_READ_WRITE_TOKEN not set' }, { status: 503 });
  }

  let body: { blobKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
  }
  const blobKey = body.blobKey;
  if (!blobKey || typeof blobKey !== 'string') {
    return NextResponse.json({ success: false, error: 'blobKey required' }, { status: 400 });
  }
  // Guard: only allow keys under the known fallback prefix. A loose
  // accept-anything POST would let an authenticated admin trick the
  // service into reading + writing any blob in the store.
  if (!blobKey.startsWith(FALLBACK_PREFIX)) {
    return NextResponse.json({ success: false, error: 'blobKey must be under leads-fallback/' }, { status: 400 });
  }

  const { list, put, del } = await import('@vercel/blob');
  // Resolve the URL from the blob listing — we don't trust client-provided URLs.
  let foundUrl: string | null = null;
  let cursor: string | undefined;
  // Pull pages until we either find the key or exhaust the listing.
  for (let i = 0; i < 50; i++) {
    const page = await list({ prefix: FALLBACK_PREFIX, cursor, limit: 100 });
    for (const b of page.blobs) {
      if (b.pathname === blobKey) {
        foundUrl = b.url;
        break;
      }
    }
    if (foundUrl) break;
    if (!page.cursor) break;
    cursor = page.cursor;
  }
  if (!foundUrl) {
    return NextResponse.json({ success: false, error: 'blob not found in leads-fallback/' }, { status: 404 });
  }

  const json = await fetchJson(foundUrl);
  if (!json) {
    return NextResponse.json({ success: false, error: 'failed to read blob json' }, { status: 500 });
  }

  const handle = await loadSheetsDoc();
  if (!handle) {
    return NextResponse.json({ success: false, error: 'Google Sheets credentials missing' }, { status: 500 });
  }

  try {
    await replayBlob(handle, json);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: `replay failed: ${message}` }, { status: 500 });
  }

  // Move to recovered prefix + delete original.
  const recoveredPath = blobKey.replace(FALLBACK_PREFIX, RECOVERED_PREFIX);
  const recoveredBlob: FallbackBlobShape = { ...json, recoveredAt: new Date().toISOString() };
  try {
    await put(recoveredPath, JSON.stringify(recoveredBlob, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  } catch (err) {
    console.warn('[admin/lead-fallback POST] failed to write recovered copy:', err);
  }
  try { await del(foundUrl); } catch (err) {
    console.warn('[admin/lead-fallback POST] failed to delete original blob:', err);
  }

  return NextResponse.json({ success: true, blobKey, recoveredAt: recoveredBlob.recoveredAt });
}
