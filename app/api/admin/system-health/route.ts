/**
 * System Health Dashboard API
 *
 * GET /api/admin/system-health
 *
 * Owner/admin-gated. Returns a cheap, read-only snapshot of every subsystem
 * the owner setup checklist (OWNER-SETUP.md) wires up. Never sends a test
 * email, never hits JN, never writes to KV, never writes to Sheets. The
 * checks are purely:
 *   - env-var presence
 *   - one cheap read (KV.get, doc.loadInfo, sheet header read)
 *   - lookups in append-only audit tabs that already exist
 *
 * Designed so it can be polled by the dashboard page without burning quota.
 */

import { NextResponse } from 'next/server';
import { requireRoleAtLeast } from '@/lib/auth-service';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ─── Types ────────────────────────────────────────────────────────────────────

type SubsystemStatus = 'healthy' | 'degraded' | 'not_configured' | 'error';
type OverallStatus = 'healthy' | 'degraded' | 'critical';

export interface EnvVarStatus {
  name: string;
  set: boolean;
  /** Masked preview: first 4 + last 4 chars, e.g. "re_1...abcd". null when unset. */
  preview: string | null;
}

export interface SubsystemBase {
  configured: boolean;
  status: SubsystemStatus;
  details: string;
  envVars: EnvVarStatus[];
}

export interface EmailSubsystem extends SubsystemBase {
  lastSendAt: string | null;
  lastSendStatus: string | null;
  fromAddress: string | null;
}

export interface TurnstileSubsystem extends SubsystemBase {}

export interface KvSubsystem extends SubsystemBase {
  pingMs: number | null;
}

export interface SheetsSubsystem extends SubsystemBase {
  lastWriteAt: string | null;
  tabsPresent: string[];
  tabsExpected: string[];
  tabsMissing: string[];
  spreadsheetTitle: string | null;
}

export interface CronInfo {
  path: string;
  schedule: string;
  active: boolean;
  lastRunAt: string | null;
  lastStatus: 'success' | 'error' | 'unknown';
  lastDurationMs: number | null;
}

export interface CronSubsystem {
  /** Mirrors SubsystemBase so the dashboard + smoke checks can render a uniform pill. */
  status: SubsystemStatus;
  details: string;
  activeCount: number;
  disabledCount: number;
  configuredCrons: CronInfo[];
}

export interface JnSubsystem extends SubsystemBase {
  lastSyncAt: string | null;
}

/**
 * LeadFallbackSubsystem — surfaces the state of the Vercel-Blob lead
 * recovery queue (lib/lead-fallback.ts + cron reconcile-leads).
 *
 * Status logic (per owner directive 2026-05-21):
 *   - not_configured if BLOB_READ_WRITE_TOKEN unset
 *   - healthy   if 0 unrecovered fallback blobs in last 7 days
 *   - degraded  if 1-10 unrecovered in last 7 days
 *   - error     if >10 unrecovered in last 7 days (something is broken
 *               or the cron isn't running)
 */
export interface LeadFallbackSubsystem extends SubsystemBase {
  pendingCount: number;
  recoveredCount: number;
  /** Most-recent capture timestamp across pending entries — null when none. */
  lastCaptureAt: string | null;
}

export interface SystemHealthResponse {
  timestamp: string;
  overall: OverallStatus;
  subsystems: {
    email: EmailSubsystem;
    turnstile: TurnstileSubsystem;
    kv: KvSubsystem;
    sheets: SheetsSubsystem;
    crons: CronSubsystem;
    jn: JnSubsystem;
    resend: EmailSubsystem;
    leadFallback: LeadFallbackSubsystem;
    ticketChain?: TicketChainSubsystem;
  };
}

// Read-only view of the last stored ticket-chain self-check run. The scan
// itself runs on the daily stalled-tickets-digest cron (+ on demand via
// /api/admin/ticket-chain-scan); here we just surface its freshness + counts.
interface TicketChainSubsystem {
  status: 'ok' | 'warn' | 'error' | 'unknown';
  lastRunAt: string | null;
  windowDays: number;
  ticketsScanned: number;
  red: number;
  yellow: number;
  proposals: number;
}

// ─── Env masking ──────────────────────────────────────────────────────────────

/**
 * Mask an env var value for safe display in the UI. Shows first 4 + last 4
 * chars only. For values shorter than 12 chars (would leak too much), we
 * collapse the middle to "...". Returns null for unset/empty values so the
 * UI can distinguish "not set" from "set to short string".
 *
 * Examples:
 *   "re_1234567890abcd"  → "re_1...abcd"
 *   "abcd"               → "********"   (too short to mask meaningfully)
 *   ""                   → null
 *   undefined            → null
 */
function maskEnvValue(raw: string | undefined): string | null {
  if (!raw || raw.length === 0) return null;
  // Strip whitespace/newlines that sometimes sneak into env paste (esp. GOOGLE_PRIVATE_KEY)
  const v = raw.trim().replace(/\s+/g, '');
  if (v.length < 12) return '********';
  return `${v.slice(0, 4)}...${v.slice(-4)}`;
}

function envSnapshot(name: string): EnvVarStatus {
  const raw = process.env[name];
  const set = Boolean(raw && raw.length > 0);
  return {
    name,
    set,
    preview: set ? maskEnvValue(raw) : null,
  };
}

// ─── Sheets doc loader (cached per request) ───────────────────────────────────

interface SheetsLoaded {
  doc: GoogleSpreadsheet;
  title: string;
}

async function loadSheetsDoc(): Promise<SheetsLoaded | null> {
  const sheetsId = process.env.GOOGLE_SHEETS_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!sheetsId || !email || !key) return null;

  try {
    const auth = new JWT({
      email,
      key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const doc = new GoogleSpreadsheet(sheetsId, auth);
    await doc.loadInfo();
    return { doc, title: doc.title };
  } catch (err) {
    console.warn('[system-health] sheets loadInfo failed:', err);
    return null;
  }
}

// ─── Email log tail (best-effort, single tail read) ───────────────────────────

/**
 * Read the last row of the "Email Log" tab (if present) and return the
 * timestamp + status. Best-effort; never throws. Returns nulls on any
 * failure so the UI can show "No recent activity".
 */
async function tailEmailLog(
  loaded: SheetsLoaded | null,
): Promise<{ lastSendAt: string | null; lastSendStatus: string | null }> {
  if (!loaded) return { lastSendAt: null, lastSendStatus: null };
  try {
    const sheet = loaded.doc.sheetsByTitle['Email Log'];
    if (!sheet) return { lastSendAt: null, lastSendStatus: null };

    const totalRows = Math.max(0, (sheet.gridProperties.rowCount || 1) - 1);
    if (totalRows === 0) return { lastSendAt: null, lastSendStatus: null };

    // Read only the last row (offset = totalRows-1, limit=1) — cheap.
    const rows = await sheet.getRows({
      limit: 1,
      offset: Math.max(0, totalRows - 1),
    });
    if (rows.length === 0) return { lastSendAt: null, lastSendStatus: null };

    const last = rows[0];
    const ts = last.get('timestamp');
    const status = last.get('status');
    return {
      lastSendAt: typeof ts === 'string' && ts.length > 0 ? ts : null,
      lastSendStatus: typeof status === 'string' && status.length > 0 ? status : null,
    };
  } catch (err) {
    console.warn('[system-health] tailEmailLog failed:', err);
    return { lastSendAt: null, lastSendStatus: null };
  }
}

// ─── Cron heartbeats (from SystemHealth tab) ──────────────────────────────────

interface HeartbeatRow {
  cronName: string;
  lastRunAt: string;
  status: string;
  durationMs: string;
}

async function readHeartbeats(loaded: SheetsLoaded | null): Promise<Map<string, HeartbeatRow>> {
  const map = new Map<string, HeartbeatRow>();
  if (!loaded) return map;
  try {
    const sheet = loaded.doc.sheetsByTitle['SystemHealth'];
    if (!sheet) return map;
    try {
      await sheet.loadHeaderRow();
    } catch {
      return map;
    }
    const rows = await sheet.getRows({ limit: 100000 });
    for (const r of rows) {
      const cronName = r.get('cronName');
      if (typeof cronName === 'string' && cronName.length > 0) {
        map.set(cronName, {
          cronName,
          lastRunAt: r.get('lastRunAt') || '',
          status: r.get('status') || 'unknown',
          durationMs: r.get('durationMs') || '0',
        });
      }
    }
  } catch (err) {
    console.warn('[system-health] readHeartbeats failed:', err);
  }
  return map;
}

// ─── vercel.json cron config ──────────────────────────────────────────────────

interface VercelCronEntry {
  path: string;
  schedule: string;
}

interface VercelConfigShape {
  crons?: VercelCronEntry[];
  _disabledCrons?: VercelCronEntry[];
}

function readVercelConfig(): VercelConfigShape {
  let parsed: VercelConfigShape = {};
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'vercel.json'), 'utf-8');
    parsed = (JSON.parse(raw) as VercelConfigShape) ?? {};
  } catch (err) {
    console.warn('[system-health] failed to read vercel.json:', err);
  }
  // Disabled crons no longer live in vercel.json (Vercel's schema rejects the
  // `_disabledCrons` key), so read them from vercel-disabled-crons.json — else
  // the dashboard's disabledCount is permanently 0.
  if (!parsed._disabledCrons) {
    try {
      const raw = fs.readFileSync(path.join(process.cwd(), 'vercel-disabled-crons.json'), 'utf-8');
      const dc = JSON.parse(raw) as { disabledCrons?: VercelCronEntry[]; _disabledCrons?: VercelCronEntry[] };
      parsed._disabledCrons = dc.disabledCrons ?? dc._disabledCrons ?? [];
    } catch {
      // file optional — leave disabled list empty
    }
  }
  return parsed;
}

/** Derive a cron's friendly heartbeat name from its path. */
function cronNameFromPath(p: string): string {
  // e.g. "/api/cron/check-lead-timers" → "check-lead-timers"
  const parts = p.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? p;
}

// ─── KV ping (cheap GET only — no writes) ─────────────────────────────────────

async function pingKv(): Promise<{ ok: boolean; ms: number | null; reason: string }> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    return { ok: false, ms: null, reason: 'env vars missing' };
  }
  try {
    const start = Date.now();
    // Dynamic import so a missing @vercel/kv package doesn't crash this
    // module at load time (mirrors lib/rate-limiter-kv.ts pattern).
    const mod = (await import('@vercel/kv')) as typeof import('@vercel/kv');
    // GET only — no write, no quota burn beyond a single command.
    await mod.kv.get('health-check-key');
    return { ok: true, ms: Date.now() - start, reason: 'ok' };
  } catch (err) {
    return {
      ok: false,
      ms: null,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Lead-fallback queue probe ────────────────────────────────────────────────

/**
 * Count fallback blobs in the last 7 days, split into pending/recovered.
 * Cheap operation: a single list() call paginated to ~5k entries max.
 * Never throws — returns null sentinel on any failure so the caller can
 * render "not configured" without blowing up the dashboard.
 */
async function probeLeadFallback(): Promise<{
  pending: number;
  recovered: number;
  lastCaptureAt: string | null;
  configured: boolean;
  reason: string;
} | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { pending: 0, recovered: 0, lastCaptureAt: null, configured: false, reason: 'no-token' };
  }
  try {
    const { list } = await import('@vercel/blob');
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let pending = 0;
    let recovered = 0;
    let lastCaptureAt: string | null = null;

    const sweep = async (prefix: string, isRecoveredBucket: boolean) => {
      let cursor: string | undefined;
      for (let i = 0; i < 50; i++) {
        const page = await list({ prefix, cursor, limit: 100 });
        for (const b of page.blobs) {
          const ts = b.uploadedAt instanceof Date ? b.uploadedAt.getTime() : Date.parse(String(b.uploadedAt));
          if (Number.isNaN(ts) || ts < cutoff) continue;
          if (isRecoveredBucket) {
            recovered++;
          } else {
            pending++;
            const iso = b.uploadedAt instanceof Date ? b.uploadedAt.toISOString() : String(b.uploadedAt);
            if (!lastCaptureAt || iso > lastCaptureAt) lastCaptureAt = iso;
          }
        }
        if (!page.cursor) break;
        cursor = page.cursor;
      }
    };

    await Promise.all([
      sweep('leads-fallback/', false),
      sweep('leads-recovered/', true),
    ]);

    return { pending, recovered, lastCaptureAt, configured: true, reason: 'ok' };
  } catch (err) {
    console.warn('[system-health] probeLeadFallback failed:', err);
    return null;
  }
}

// ─── Overall rollup ───────────────────────────────────────────────────────────

function rollupOverall(subsystems: SystemHealthResponse['subsystems']): OverallStatus {
  // CRITICAL: sheets is the only system that, if broken, takes everything
  // down (it's the source of truth). Email being not_configured is yellow.
  // Crons are independent — if some are unknown but the platform is up,
  // that's degraded not critical.
  const all: SubsystemBase[] = [
    subsystems.email,
    subsystems.turnstile,
    subsystems.kv,
    subsystems.sheets,
    subsystems.jn,
    subsystems.resend,
    subsystems.leadFallback,
  ];

  if (subsystems.sheets.status === 'error') return 'critical';

  const anyError = all.some((s) => s.status === 'error');
  if (anyError) return 'degraded';

  const anyDegraded = all.some(
    (s) => s.status === 'degraded' || s.status === 'not_configured',
  );
  if (anyDegraded) return 'degraded';

  // Crons: if any active cron has never reported, that's degraded.
  const anyUnknownCron = subsystems.crons.configuredCrons.some(
    (c) => c.active && c.lastStatus === 'unknown',
  );
  if (anyUnknownCron) return 'degraded';

  const anyFailedCron = subsystems.crons.configuredCrons.some(
    (c) => c.active && c.lastStatus === 'error',
  );
  if (anyFailedCron) return 'degraded';

  return 'healthy';
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const auth = await requireRoleAtLeast(['owner', 'admin']);
  if (!auth.authenticated) return auth.response;

  const timestamp = new Date().toISOString();

  // Run independent checks in parallel.
  const [
    loaded,
    kvPing,
    leadFallbackProbe,
  ] = await Promise.all([
    loadSheetsDoc(),
    pingKv(),
    probeLeadFallback(),
  ]);

  const [emailLogTail, heartbeats] = await Promise.all([
    tailEmailLog(loaded),
    readHeartbeats(loaded),
  ]);

  // ── Email / Resend (same backend; we surface as two cards) ─────────────────
  const emailEnvs = [
    envSnapshot('RESEND_API_KEY'),
    envSnapshot('EMAIL_FROM'),
    envSnapshot('EMAIL_FROM_NAME'),
  ];
  const resendKeySet = emailEnvs[0].set;
  const fromSet = emailEnvs[1].set;
  const fromAddress = fromSet ? process.env.EMAIL_FROM || null : null;

  const emailConfigured = resendKeySet && fromSet;
  const emailStatus: SubsystemStatus = emailConfigured ? 'healthy' : 'not_configured';
  const emailDetails = emailConfigured
    ? `Sending from ${fromAddress}. Last activity${emailLogTail.lastSendAt ? `: ${emailLogTail.lastSendAt} (${emailLogTail.lastSendStatus})` : ': none recorded'}.`
    : `Missing ${!resendKeySet ? 'RESEND_API_KEY' : ''}${!resendKeySet && !fromSet ? ' + ' : ''}${!fromSet ? 'EMAIL_FROM' : ''}. See OWNER-SETUP.md §1.`;

  const emailSubsystem: EmailSubsystem = {
    configured: emailConfigured,
    status: emailStatus,
    details: emailDetails,
    envVars: emailEnvs,
    lastSendAt: emailLogTail.lastSendAt,
    lastSendStatus: emailLogTail.lastSendStatus,
    fromAddress,
  };

  // Resend mirrors email — kept as a separate card so the operator can spot
  // an API-key revocation independent of EMAIL_FROM/transport setup.
  const resendSubsystem: EmailSubsystem = {
    configured: resendKeySet,
    status: resendKeySet ? 'healthy' : 'not_configured',
    details: resendKeySet
      ? 'Resend API key present. No live ping (would burn quota).'
      : 'RESEND_API_KEY missing. See OWNER-SETUP.md §1.',
    envVars: [emailEnvs[0]],
    lastSendAt: emailLogTail.lastSendAt,
    lastSendStatus: emailLogTail.lastSendStatus,
    fromAddress,
  };

  // ── Turnstile ──────────────────────────────────────────────────────────────
  const turnstileEnvs = [
    envSnapshot('NEXT_PUBLIC_TURNSTILE_SITE_KEY'),
    envSnapshot('TURNSTILE_SECRET_KEY'),
  ];
  const turnstileBothSet = turnstileEnvs.every((e) => e.set);
  const turnstileEitherSet = turnstileEnvs.some((e) => e.set);
  let turnstileStatus: SubsystemStatus;
  let turnstileDetails: string;
  if (turnstileBothSet) {
    turnstileStatus = 'healthy';
    turnstileDetails = 'Both keys present. Widget active; bots blocked at gate.';
  } else if (turnstileEitherSet) {
    turnstileStatus = 'degraded';
    turnstileDetails =
      'Only one of site/secret key is set — system fails open (Turnstile inert) until both are present.';
  } else {
    turnstileStatus = 'not_configured';
    turnstileDetails =
      'Neither key set. Forms work but receive no bot challenge. See OWNER-SETUP.md §2.';
  }
  const turnstileSubsystem: TurnstileSubsystem = {
    configured: turnstileBothSet,
    status: turnstileStatus,
    details: turnstileDetails,
    envVars: turnstileEnvs,
  };

  // ── KV ─────────────────────────────────────────────────────────────────────
  const kvEnvs = [
    envSnapshot('KV_REST_API_URL'),
    envSnapshot('KV_REST_API_TOKEN'),
    envSnapshot('KV_REST_API_READ_ONLY_TOKEN'),
  ];
  const kvBothCoreSet = kvEnvs[0].set && kvEnvs[1].set;
  let kvStatus: SubsystemStatus;
  let kvDetails: string;
  if (!kvBothCoreSet) {
    kvStatus = 'not_configured';
    kvDetails =
      'KV env vars not set. Rate limiter falls back to in-memory (per-Lambda only). See OWNER-SETUP.md §3.';
  } else if (kvPing.ok) {
    kvStatus = 'healthy';
    kvDetails = `KV ping OK (${kvPing.ms}ms). Rate limit counters persist across cold starts.`;
  } else {
    kvStatus = 'error';
    kvDetails = `KV configured but ping failed: ${kvPing.reason}. Rate limiter falling back to in-memory.`;
  }
  const kvSubsystem: KvSubsystem = {
    configured: kvBothCoreSet,
    status: kvStatus,
    details: kvDetails,
    envVars: kvEnvs,
    pingMs: kvPing.ms,
  };

  // ── Sheets ─────────────────────────────────────────────────────────────────
  const sheetsEnvs = [
    envSnapshot('GOOGLE_SHEETS_ID'),
    envSnapshot('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
    envSnapshot('GOOGLE_PRIVATE_KEY'),
  ];
  const sheetsAllSet = sheetsEnvs.every((e) => e.set);
  // Tracking tabs the operator cares about (per brief). Some are aspirational —
  // they appear missing until the operator (or a cron) creates them.
  const tabsExpected = [
    'Email Log',
    'Spam Log',
    'Storm_Reports',
    'ReviewRequests',
    'SystemHealth',
    'CanvassRoutes',
    'MondayPrep',
  ];
  let sheetsStatus: SubsystemStatus;
  let sheetsDetails: string;
  let tabsPresent: string[] = [];
  let tabsMissing: string[] = [];
  let spreadsheetTitle: string | null = null;
  let lastWriteAt: string | null = null;

  if (!sheetsAllSet) {
    sheetsStatus = 'not_configured';
    sheetsDetails =
      'Google Sheets credentials incomplete. Most write paths will silently no-op.';
    tabsMissing = tabsExpected;
  } else if (!loaded) {
    sheetsStatus = 'error';
    sheetsDetails =
      'Credentials present but doc.loadInfo() failed. Check service account has share access.';
    tabsMissing = tabsExpected;
  } else {
    spreadsheetTitle = loaded.title;
    const titlesByName = new Set<string>();
    for (const s of loaded.doc.sheetsByIndex) {
      titlesByName.add(s.title);
    }
    tabsPresent = tabsExpected.filter((t) => titlesByName.has(t));
    tabsMissing = tabsExpected.filter((t) => !titlesByName.has(t));

    // Approximate "last write" via the Email Log tail (the chattiest tab).
    lastWriteAt = emailLogTail.lastSendAt;

    if (tabsMissing.length === 0) {
      sheetsStatus = 'healthy';
      sheetsDetails = `Connected to "${spreadsheetTitle}". All ${tabsExpected.length} tracking tabs present.`;
    } else {
      sheetsStatus = 'degraded';
      sheetsDetails = `Connected to "${spreadsheetTitle}". ${tabsMissing.length}/${tabsExpected.length} tracking tabs missing (auto-created on first write).`;
    }
  }
  const sheetsSubsystem: SheetsSubsystem = {
    configured: sheetsAllSet,
    status: sheetsStatus,
    details: sheetsDetails,
    envVars: sheetsEnvs,
    lastWriteAt,
    tabsPresent,
    tabsExpected,
    tabsMissing,
    spreadsheetTitle,
  };

  // ── Crons ──────────────────────────────────────────────────────────────────
  const vc = readVercelConfig();
  const activeCronEntries = vc.crons ?? [];
  const disabledCronEntries = vc._disabledCrons ?? [];

  const configuredCrons: CronInfo[] = [];
  for (const entry of activeCronEntries) {
    const name = cronNameFromPath(entry.path);
    const hb = heartbeats.get(name);
    configuredCrons.push({
      path: entry.path,
      schedule: entry.schedule,
      active: true,
      lastRunAt: hb?.lastRunAt || null,
      lastStatus:
        hb?.status === 'success' || hb?.status === 'error'
          ? hb.status
          : 'unknown',
      lastDurationMs: hb ? parseInt(hb.durationMs, 10) || null : null,
    });
  }
  for (const entry of disabledCronEntries) {
    const name = cronNameFromPath(entry.path);
    const hb = heartbeats.get(name);
    configuredCrons.push({
      path: entry.path,
      schedule: entry.schedule,
      active: false,
      lastRunAt: hb?.lastRunAt || null,
      lastStatus:
        hb?.status === 'success' || hb?.status === 'error'
          ? hb.status
          : 'unknown',
      lastDurationMs: hb ? parseInt(hb.durationMs, 10) || null : null,
    });
  }

  // Compute aggregate cron status from per-cron heartbeats.
  const activeConfigured = configuredCrons.filter((c) => c.active);
  const errorCount = activeConfigured.filter((c) => c.lastStatus === 'error').length;
  const unknownCount = activeConfigured.filter((c) => c.lastStatus === 'unknown').length;
  const successCount = activeConfigured.filter((c) => c.lastStatus === 'success').length;
  let cronsStatus: SubsystemStatus;
  let cronsDetails: string;
  if (activeConfigured.length === 0) {
    cronsStatus = 'not_configured';
    cronsDetails = 'No active crons configured in vercel.json.';
  } else if (errorCount > 0) {
    cronsStatus = 'degraded';
    cronsDetails = `${errorCount}/${activeConfigured.length} active crons reporting errors on last run.`;
  } else if (unknownCount === activeConfigured.length) {
    cronsStatus = 'degraded';
    cronsDetails = `${activeConfigured.length} active crons have no heartbeat yet — none have run successfully or this environment lacks heartbeat data.`;
  } else if (unknownCount > 0) {
    cronsStatus = 'degraded';
    cronsDetails = `${successCount}/${activeConfigured.length} active crons healthy, ${unknownCount} without recent heartbeats.`;
  } else {
    cronsStatus = 'healthy';
    cronsDetails = `${successCount}/${activeConfigured.length} active crons reporting success.`;
  }

  const cronsSubsystem: CronSubsystem = {
    status: cronsStatus,
    details: cronsDetails,
    activeCount: activeCronEntries.length,
    disabledCount: disabledCronEntries.length,
    configuredCrons,
  };

  // ── JobNimbus ──────────────────────────────────────────────────────────────
  const jnEnvs = [envSnapshot('JOBNIMBUS_API_KEY')];
  const jnConfigured = jnEnvs[0].set;
  // Last sync timestamp: best signal is the SystemHealth heartbeat for any
  // JN-related cron we have. We don't HAVE one today (the engine runs on
  // request, not on cron), so we surface "no recent sync" and let the
  // operator know that's expected.
  const jnSubsystem: JnSubsystem = {
    configured: jnConfigured,
    status: jnConfigured ? 'healthy' : 'not_configured',
    details: jnConfigured
      ? 'JOBNIMBUS_API_KEY present. Live API call skipped to avoid quota burn.'
      : 'JOBNIMBUS_API_KEY missing. CRM sync paths will throw on first use.',
    envVars: jnEnvs,
    lastSyncAt: null,
  };

  // ── Lead-fallback queue ────────────────────────────────────────────────────
  const leadFallbackEnvs = [envSnapshot('BLOB_READ_WRITE_TOKEN')];
  let leadFallbackStatus: SubsystemStatus;
  let leadFallbackDetails: string;
  let leadFallbackPending = 0;
  let leadFallbackRecovered = 0;
  let leadFallbackLastCapture: string | null = null;
  if (!leadFallbackProbe) {
    leadFallbackStatus = 'error';
    leadFallbackDetails = 'Lead-fallback probe failed — see server logs.';
  } else if (!leadFallbackProbe.configured) {
    leadFallbackStatus = 'not_configured';
    leadFallbackDetails =
      'BLOB_READ_WRITE_TOKEN not set. Public lead-capture sheet-write failures will be logged but not recoverable.';
  } else {
    leadFallbackPending = leadFallbackProbe.pending;
    leadFallbackRecovered = leadFallbackProbe.recovered;
    leadFallbackLastCapture = leadFallbackProbe.lastCaptureAt;
    if (leadFallbackPending === 0) {
      leadFallbackStatus = 'healthy';
      leadFallbackDetails =
        leadFallbackRecovered === 0
          ? 'No fallback writes in the last 7 days — every primary sheet write has succeeded.'
          : `0 pending. ${leadFallbackRecovered} recovered in the last 7 days (reconcile-leads cron working).`;
    } else if (leadFallbackPending <= 10) {
      leadFallbackStatus = 'degraded';
      leadFallbackDetails =
        `${leadFallbackPending} pending fallback ${leadFallbackPending === 1 ? 'lead' : 'leads'} in the last 7 days. Run the reconcile-leads cron (or replay manually).`;
    } else {
      leadFallbackStatus = 'error';
      leadFallbackDetails =
        `${leadFallbackPending} pending fallback leads in the last 7 days — something is broken (cron stopped, sheets credentials, etc).`;
    }
  }
  const leadFallbackSubsystem: LeadFallbackSubsystem = {
    configured: leadFallbackProbe?.configured ?? false,
    status: leadFallbackStatus,
    details: leadFallbackDetails,
    envVars: leadFallbackEnvs,
    pendingCount: leadFallbackPending,
    recoveredCount: leadFallbackRecovered,
    lastCaptureAt: leadFallbackLastCapture,
  };

  // Ticket-chain self-check — cheap read of the last stored scan summary.
  let ticketChainSubsystem: TicketChainSubsystem = {
    status: 'unknown', lastRunAt: null, windowDays: 0, ticketsScanned: 0, red: 0, yellow: 0, proposals: 0,
  };
  try {
    const { getLastChainScanSummary } = await import('@/lib/ticket-chain-scan');
    const s = await getLastChainScanSummary();
    if (s) {
      ticketChainSubsystem = {
        status: s.red > 0 ? 'error' : s.yellow > 0 ? 'warn' : 'ok',
        lastRunAt: s.generatedAt || null,
        windowDays: s.windowDays,
        ticketsScanned: s.ticketsScanned,
        red: s.red, yellow: s.yellow, proposals: s.proposals,
      };
    }
  } catch (e) {
    console.warn('[system-health] ticket-chain summary read failed:', e);
  }

  const subsystems: SystemHealthResponse['subsystems'] = {
    email: emailSubsystem,
    turnstile: turnstileSubsystem,
    kv: kvSubsystem,
    sheets: sheetsSubsystem,
    crons: cronsSubsystem,
    jn: jnSubsystem,
    resend: resendSubsystem,
    leadFallback: leadFallbackSubsystem,
    ticketChain: ticketChainSubsystem,
  };

  const response: SystemHealthResponse = {
    timestamp,
    overall: rollupOverall(subsystems),
    subsystems,
  };

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'no-store, must-revalidate' },
  });
}
