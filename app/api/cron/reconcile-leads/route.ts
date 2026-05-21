/**
 * Reconcile Leads Cron — Lead-fallback Recovery Sweep
 *
 * Owner directive (2026-05-21): "set it up where it has a fallback and a
 * system that checks to make sure no leads fall through." Part A wires
 * Vercel-Blob fallback into every public lead-capture endpoint (lib/lead-
 * fallback.ts). This cron is Part B: it sweeps the fallback blobs, replays
 * the original sheet write, and moves recovered blobs to a separate prefix
 * so the next run doesn't see them.
 *
 * Trigger: GET /api/cron/reconcile-leads
 * Auth: CRON_SECRET header OR admin/owner session (mirrors sync-inventory-tab).
 * Schedule: parked in vercel.json under `_disabledCrons` (every hour at :45).
 *           Owner moves it to `crons` when ready to activate.
 *
 * Recovery flow per blob:
 *   1. List all blobs under `leads-fallback/`.
 *   2. For each, fetch JSON and inspect `recoveredAt`. If non-null, skip
 *      (already recovered — should have been moved but defensively skip).
 *   3. Dispatch to the per-source replay function based on
 *      `FallbackBlobShape.source`. Each replay function writes to the
 *      same sheet tab as the original happy-path writer.
 *   4. On success: write a copy under `leads-recovered/{date}/{name}` and
 *      DELETE the original blob. Move-not-mark keeps the next listing
 *      cheap and makes the fallback queue self-clearing.
 *   5. On replay failure: leave the blob untouched, count it, log a
 *      warning. Owner can investigate via /admin/lead-fallback.
 *
 * Idempotency contract:
 *   - Two back-to-back runs MUST NOT double-write a recovered lead. We
 *     achieve this by deleting the source blob ONLY AFTER the recovery
 *     copy is written. If the delete fails, the next run will see the
 *     blob, attempt to replay it (which will create a duplicate row in
 *     the sheet), then succeed and delete it. That duplicate-on-retry
 *     risk is acceptable because:
 *       (a) sheet-write failures are rare,
 *       (b) the replay is bounded to known sheets where duplicates are
 *           recoverable manually,
 *       (c) the alternative — never replay until owner confirms — is
 *           the exact "leads silently disappearing" outcome the owner
 *           said must not happen.
 *
 * Per-source replays (see replayBlob below):
 *   - email-capture   → "Email Captures" tab
 *   - contact / contact-form / careers / bni-partner → "contact-submissions" tab
 *   - referral        → "referral-submissions" tab
 *   - storm-report    → "Storm_Reports" tab (via storm-report-service.storeReport)
 *   - leads-new       → "All Lead Submissions" tab
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { withCronLock } from '@/lib/cron-lock';
import type { FallbackBlobShape } from '@/lib/lead-fallback';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET;
const FALLBACK_PREFIX = 'leads-fallback/';
const RECOVERED_PREFIX = 'leads-recovered/';

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface SheetsHandle {
  doc: GoogleSpreadsheet;
}

async function loadSheetsDoc(): Promise<SheetsHandle | null> {
  const id = process.env.GOOGLE_SHEETS_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!id || !email || !key) return null;

  const auth = new JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const doc = new GoogleSpreadsheet(id, auth);
  await doc.loadInfo();
  return { doc };
}

/** Format YYYY-MM-DD in UTC (matches lead-fallback.ts). */
function todayPathUtc(d: Date = new Date()): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function sanitize(value: unknown): string {
  if (value == null) return '';
  const s = String(value);
  // Prefix formula-injection vectors with a single quote (mirrors
  // form-service.ts sanitizeForSheets).
  if (/^[=+\-@\t\r]/.test(s)) return `'${s}`;
  return s;
}

async function ensureSheet(
  handle: SheetsHandle,
  title: string,
  headerValues: string[],
): Promise<GoogleSpreadsheetWorksheet> {
  let sheet = handle.doc.sheetsByTitle[title];
  if (!sheet) {
    sheet = await handle.doc.addSheet({ title, headerValues });
  } else {
    try {
      await sheet.loadHeaderRow();
    } catch {
      // Header missing — set it.
      await sheet.setHeaderRow(headerValues);
    }
  }
  return sheet;
}

// ─── Per-source replay functions ──────────────────────────────────────────────

/**
 * Replay an Email Captures fallback. Original writer:
 * app/api/email-capture/route.ts saveToGoogleSheets.
 */
async function replayEmailCapture(
  handle: SheetsHandle,
  payload: Record<string, unknown>,
): Promise<void> {
  const sheet = await ensureSheet(handle, 'Email Captures', [
    'Timestamp', 'Name', 'Email', 'Phone', 'Address',
    'Source Page', 'UTM Source', 'UTM Medium', 'UTM Campaign',
    'UTM Term', 'UTM Content', 'Status',
  ]);
  await sheet.addRow({
    Timestamp: sanitize(payload.timestamp ?? new Date().toISOString()),
    Name: sanitize(payload.name),
    Email: sanitize(payload.email),
    Phone: sanitize(payload.phone ?? ''),
    Address: sanitize(payload.address ?? ''),
    'Source Page': sanitize(payload.sourcePage ?? ''),
    'UTM Source': sanitize(payload.utmSource ?? ''),
    'UTM Medium': sanitize(payload.utmMedium ?? ''),
    'UTM Campaign': sanitize(payload.utmCampaign ?? ''),
    'UTM Term': sanitize(payload.utmTerm ?? ''),
    'UTM Content': sanitize(payload.utmContent ?? ''),
    Status: sanitize(payload.status ?? 'new'),
  });
}

/**
 * Replay a contact-form (incl. careers / bni-partner / legacy contact)
 * fallback. Original writer: lib/form-service.ts saveToSheet('contact').
 * The legacy /api/contact route delegates to GAS — replays go to the same
 * `contact-submissions` tab directly so the lead lands somewhere
 * recoverable even when GAS itself is down.
 */
async function replayContactForm(
  handle: SheetsHandle,
  payload: Record<string, unknown>,
): Promise<void> {
  const sheet = await ensureSheet(handle, 'contact-submissions', [
    'id', 'timestamp', 'status', 'sourcePage', 'name', 'email', 'phone',
    'subject', 'message', 'preferredInspector', 'serviceType', 'serviceArea',
    'leadSource', 'leadSourceDetail', 'marketingSource',
  ]);
  await sheet.addRow({
    id: `recovered-${Date.now()}`,
    timestamp: new Date().toISOString(),
    status: 'new',
    sourcePage: sanitize(payload.sourcePage ?? ''),
    name: sanitize(payload.name),
    email: sanitize(payload.email ?? ''),
    phone: sanitize(payload.phone ?? ''),
    subject: sanitize(payload.subject ?? ''),
    message: sanitize(payload.message ?? ''),
    preferredInspector: sanitize(payload.preferredInspector ?? 'First Available'),
    serviceType: sanitize(payload.serviceType ?? ''),
    serviceArea: sanitize(payload.serviceArea ?? ''),
    leadSource: sanitize(payload.leadSource ?? 'Direct'),
    leadSourceDetail: sanitize(payload.leadSourceDetail ?? ''),
    marketingSource: sanitize(payload.marketingSource ?? 'Website - Recovered'),
  });
}

/**
 * Replay a referral-form fallback. Original writer:
 * lib/form-service.ts saveToSheet('referral').
 */
async function replayReferral(
  handle: SheetsHandle,
  payload: Record<string, unknown>,
): Promise<void> {
  const sheet = await ensureSheet(handle, 'referral-submissions', [
    'id', 'timestamp', 'status', 'sourcePage', 'referrerName', 'referrerPhone',
    'referrerEmail', 'referralName', 'referralPhone', 'referralEmail',
    'referralAddress', 'salesRep', 'notes',
  ]);
  await sheet.addRow({
    id: `recovered-${Date.now()}`,
    timestamp: new Date().toISOString(),
    status: 'new',
    sourcePage: sanitize(payload.sourcePage ?? ''),
    referrerName: sanitize(payload.referrerName),
    referrerPhone: sanitize(payload.referrerPhone),
    referrerEmail: sanitize(payload.referrerEmail ?? ''),
    referralName: sanitize(payload.referralName),
    referralPhone: sanitize(payload.referralPhone),
    referralEmail: sanitize(payload.referralEmail ?? ''),
    referralAddress: sanitize(payload.referralAddress),
    salesRep: sanitize(payload.salesRep ?? ''),
    notes: sanitize(payload.notes ?? ''),
  });
}

/**
 * Replay a storm-report fallback. The original payload embeds the FULL
 * generated StormReport under `generatedReport` so we can re-run the
 * exact storeReport row without re-fetching hail/wind data.
 */
async function replayStormReport(
  handle: SheetsHandle,
  payload: Record<string, unknown>,
): Promise<void> {
  // The fallback intentionally serialized the generated report. If it's
  // missing for some reason (older fallback format), skip — the customer
  // already got the report on screen; we don't try to regenerate it.
  const generatedReport = payload.generatedReport as Record<string, unknown> | undefined;
  if (!generatedReport) {
    throw new Error('storm-report fallback missing generatedReport — cannot replay');
  }

  // Mirror storm-report-service.STORM_REPORT_HEADERS order.
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
    reportId: sanitize(generatedReport.reportId),
    generatedAt: sanitize(generatedReport.generatedAt),
    address: sanitize(generatedReport.address),
    city: sanitize(generatedReport.city),
    state: sanitize(generatedReport.state),
    zip: sanitize(generatedReport.zip),
    fullAddress: sanitize(generatedReport.fullAddress),
    dateRangeStart: sanitize(generatedReport.dateRangeStart),
    dateRangeEnd: sanitize(generatedReport.dateRangeEnd),
    searchRadiusMiles: sanitize(generatedReport.searchRadiusMiles),
    hailEventsJson: JSON.stringify(generatedReport.hailEvents ?? []),
    windEventsJson: JSON.stringify(generatedReport.windEvents ?? []),
    activeAlertsJson: JSON.stringify(generatedReport.activeAlerts ?? []),
    riskLevel: sanitize(generatedReport.riskLevel),
    riskScore: sanitize(generatedReport.riskScore),
    riskFactorsJson: JSON.stringify(generatedReport.riskFactors ?? []),
    recommendation: sanitize(generatedReport.recommendation),
    totalHailReports: sanitize(generatedReport.totalHailReports),
    closestHailMiles: generatedReport.closestHailMiles != null ? sanitize(generatedReport.closestHailMiles) : '',
    largestHailSize: sanitize(generatedReport.largestHailSize ?? ''),
    largestHailSizeNum: sanitize(generatedReport.largestHailSizeNum),
    hailReconJson: JSON.stringify(generatedReport.hailReconEvents ?? []),
    hailReconTotalStorms: sanitize(generatedReport.hailReconTotalStorms),
    hailReconLargestSize: sanitize(generatedReport.hailReconLargestSize),
    hailReconLargestSizeLabel: sanitize(generatedReport.hailReconLargestSizeLabel),
    leadId: sanitize(generatedReport.leadId ?? ''),
    customerId: sanitize(generatedReport.customerId ?? ''),
    sharedWithCustomer: sanitize(generatedReport.sharedWithCustomer ?? false),
    sharedAt: sanitize(generatedReport.sharedAt ?? ''),
    sharedBy: sanitize(generatedReport.sharedBy ?? ''),
  });
}

/**
 * Replay a leads-new fallback. Original writer: app/api/leads/new
 * inline write to 'All Lead Submissions'. The fallback embedded
 * the computed meta fields under `_meta` so we restore them exactly.
 */
async function replayLeadsNew(
  handle: SheetsHandle,
  payload: Record<string, unknown>,
): Promise<void> {
  const meta = (payload._meta as Record<string, unknown> | undefined) ?? {};
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
    Name: sanitize(payload.name),
    Email: sanitize(payload.email),
    Phone: sanitize(payload.phone ?? ''),
    Address: sanitize(payload.address ?? ''),
    City: sanitize(payload.city ?? ''),
    State: sanitize(payload.state ?? ''),
    Zip: sanitize(payload.zip ?? ''),
    Source: sanitize(payload.source ?? ''),
    'Source Details': sanitize(payload.sourceDetails ?? ''),
    'Source Page': sanitize(payload.sourcePage ?? ''),
    'Service Type': sanitize(payload.serviceType ?? ''),
    Message: sanitize(payload.message ?? ''),
    Urgency: sanitize(payload.urgency ?? 'normal'),
    'Spam Score': sanitize(meta.spamScore ?? ''),
    'Spam Reasons': Array.isArray(meta.spamReasons) ? meta.spamReasons.join('; ') : sanitize(meta.spamReasons ?? ''),
    'Is Spam': meta.isSpam ? 'YES' : 'NO',
    'Passed Filter': meta.passedFilter ? 'YES' : 'NO',
    'IP Address': sanitize(meta.ip ?? 'unknown'),
    'User Agent': sanitize(meta.userAgent ?? ''),
    Referer: sanitize(meta.referer ?? ''),
    'JN Match Found': '',
    'JN Match ID': '',
    'JN Match Name': '',
    'JN Match Type': '',
    'Duplicate Found': '',
    'Duplicate Match By': '',
    County: '',
    Status: meta.isSpam ? 'spam' : 'new',
  });
}

/**
 * Top-level replay dispatch. Throws on dispatch failure so the caller
 * can record it (and leave the blob intact for the next run).
 */
async function replayBlob(
  handle: SheetsHandle,
  blob: FallbackBlobShape,
): Promise<void> {
  switch (blob.source) {
    case 'email-capture':
      return replayEmailCapture(handle, blob.payload);
    case 'contact':
    case 'contact-form':
    case 'careers':
    case 'bni-partner':
      return replayContactForm(handle, blob.payload);
    case 'referral':
      return replayReferral(handle, blob.payload);
    case 'storm-report':
      return replayStormReport(handle, blob.payload);
    case 'leads-new':
      return replayLeadsNew(handle, blob.payload);
    default:
      throw new Error(`Unknown lead-fallback source: ${blob.source}`);
  }
}

// ─── Blob list/fetch/move helpers ─────────────────────────────────────────────

interface FallbackBlobEntry {
  pathname: string;
  url: string;
  uploadedAt: string;
  size: number;
}

async function listFallbackBlobs(): Promise<FallbackBlobEntry[]> {
  const { list } = await import('@vercel/blob');
  const out: FallbackBlobEntry[] = [];
  let cursor: string | undefined;
  // Defensive cap: a single sweep handles up to ~5k blobs. If the queue
  // grows beyond that the next cron run picks up the remainder.
  for (let i = 0; i < 50; i++) {
    const page = await list({ prefix: FALLBACK_PREFIX, cursor, limit: 100 });
    for (const b of page.blobs) {
      out.push({
        pathname: b.pathname,
        url: b.url,
        uploadedAt: typeof b.uploadedAt === 'string' ? b.uploadedAt : new Date(b.uploadedAt).toISOString(),
        size: b.size,
      });
    }
    if (!page.cursor) break;
    cursor = page.cursor;
  }
  return out;
}

async function fetchBlobJson(url: string): Promise<FallbackBlobShape | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as FallbackBlobShape;
  } catch {
    return null;
  }
}

/**
 * Move a recovered blob to the `leads-recovered/{date}/...` prefix.
 * Writes a NEW blob under the recovered prefix (preserving the original
 * filename + appending the recoveredAt timestamp), then deletes the
 * original. The new blob has `recoveredAt` set so the admin viewer can
 * tell it's done. Returns true if both write+delete succeeded.
 */
async function moveToRecovered(
  source: FallbackBlobEntry,
  blob: FallbackBlobShape,
): Promise<boolean> {
  const { put, del } = await import('@vercel/blob');
  // Original path: leads-fallback/{date}/{source}-{ts}-{rand}.json
  // Recovered path: leads-recovered/{date}/{source}-{ts}-{rand}.json
  const recoveredPath = source.pathname.replace(FALLBACK_PREFIX, RECOVERED_PREFIX);
  const recoveredBlob: FallbackBlobShape = {
    ...blob,
    recoveredAt: new Date().toISOString(),
  };
  try {
    await put(recoveredPath, JSON.stringify(recoveredBlob, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  } catch (err) {
    console.error('[reconcile-leads] failed to write recovered blob:', err);
    return false;
  }
  try {
    await del(source.url);
  } catch (err) {
    // The recovery blob is written but the original couldn't be deleted.
    // Next run will see the original AGAIN and replay it — that's the
    // documented duplicate-on-retry risk in the file header.
    console.warn('[reconcile-leads] failed to delete original blob (next run will re-attempt):', err);
    // Still return true — the recovery copy IS persisted. The follow-up
    // delete will eventually succeed or stale-out into an obvious blob
    // list discrepancy for the operator.
    return true;
  }
  return true;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Auth: same pattern as sync-inventory-tab — CRON_SECRET header OR
  // admin/owner session. Defense-in-depth: a misconfigured cron config
  // can still be hit manually by an operator.
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

  return withCronLock('reconcile-leads', { staleMinutes: 30 }, async () => {
    const start = Date.now();
    const today = todayPathUtc();

    // If blob token is missing, this cron is a no-op — there's nothing
    // to recover (lead-fallback would have failed at capture time too).
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({
        success: true,
        configured: false,
        message: 'BLOB_READ_WRITE_TOKEN not set — fallback storage disabled.',
        scanned: 0,
        recovered: 0,
        stillFailing: 0,
      });
    }

    let handle: SheetsHandle | null;
    try {
      handle = await loadSheetsDoc();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      try {
        const { recordCronHeartbeat } = await import('@/lib/cron-heartbeat');
        await recordCronHeartbeat('reconcile-leads', 'error', Date.now() - start, `sheets load failed: ${message}`);
      } catch { /* ignore */ }
      return NextResponse.json({ success: false, error: `sheets load failed: ${message}` }, { status: 500 });
    }

    if (!handle) {
      try {
        const { recordCronHeartbeat } = await import('@/lib/cron-heartbeat');
        await recordCronHeartbeat('reconcile-leads', 'error', Date.now() - start, 'Google Sheets credentials missing');
      } catch { /* ignore */ }
      return NextResponse.json({
        success: false,
        configured: false,
        message: 'Google Sheets credentials missing — cannot replay writes.',
        scanned: 0,
        recovered: 0,
        stillFailing: 0,
      }, { status: 500 });
    }

    // List + process.
    let blobs: FallbackBlobEntry[];
    try {
      blobs = await listFallbackBlobs();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      try {
        const { recordCronHeartbeat } = await import('@/lib/cron-heartbeat');
        await recordCronHeartbeat('reconcile-leads', 'error', Date.now() - start, `blob list failed: ${message}`);
      } catch { /* ignore */ }
      return NextResponse.json({ success: false, error: `blob list failed: ${message}` }, { status: 500 });
    }

    let scanned = 0;
    let recovered = 0;
    let stillFailing = 0;
    const failures: Array<{ pathname: string; source: string; error: string }> = [];

    for (const entry of blobs) {
      scanned++;
      const blob = await fetchBlobJson(entry.url);
      if (!blob) {
        stillFailing++;
        failures.push({ pathname: entry.pathname, source: 'unknown', error: 'failed to fetch/parse blob json' });
        continue;
      }
      // Defensive: skip if somehow already marked recovered but not moved.
      if (blob.recoveredAt) {
        // Try to move (no-op if already moved). Skip count.
        try { await moveToRecovered(entry, blob); } catch { /* ignore */ }
        continue;
      }

      try {
        await replayBlob(handle, blob);
        const moved = await moveToRecovered(entry, blob);
        if (moved) {
          recovered++;
        } else {
          // Replay succeeded but recovery-move failed. Count as recovered
          // (the sheet write happened), but warn — next run will replay
          // this AGAIN if the move never succeeds.
          recovered++;
          console.warn('[reconcile-leads] replayed but failed to archive:', entry.pathname);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        stillFailing++;
        failures.push({ pathname: entry.pathname, source: blob.source, error: message });
        console.warn(`[reconcile-leads] replay failed for ${entry.pathname}:`, message);
      }
    }

    const durationMs = Date.now() - start;
    const status: 'success' | 'error' = stillFailing > 0 && recovered === 0 ? 'error' : 'success';
    try {
      const { recordCronHeartbeat } = await import('@/lib/cron-heartbeat');
      await recordCronHeartbeat(
        'reconcile-leads',
        status,
        durationMs,
        `scanned=${scanned} recovered=${recovered} stillFailing=${stillFailing}`,
      );
    } catch { /* heartbeat failure shouldn't mask the result */ }

    return NextResponse.json({
      success: status === 'success',
      configured: true,
      date: today,
      scanned,
      recovered,
      stillFailing,
      failures: failures.length > 0 ? failures.slice(0, 20) : undefined,
      durationMs,
    });
  });
}
