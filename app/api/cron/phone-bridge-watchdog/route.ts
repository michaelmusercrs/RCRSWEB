/**
 * PBX Bridge Watchdog
 *
 * The office bridge (on Boston) POSTs /api/calls/bridge-heartbeat every cycle.
 * If those stop, the call log silently freezes — which looks identical to a
 * quiet phone day. This cron watches the last heartbeat and alerts if it goes
 * stale.
 *
 * Trigger: GET /api/cron/phone-bridge-watchdog
 * Schedule (vercel.json): every 15 min.
 * Auth: CRON_SECRET bearer (Vercel) or admin/owner/manager session.
 * Query: ?dryRun=1 → compute + report, send NO email.
 *
 * GATED: does nothing until PHONE_BRIDGE_MONITOR_ENABLED=true (so it stays
 * dormant until the bridge is actually installed and expected to be alive).
 * Debounced: at most one alert email per 2 hours while down.
 */

import { NextRequest, NextResponse } from 'next/server';
import { emailService } from '@/lib/email-service';
import { HEARTBEAT_BLOB_KEY } from '@/app/api/calls/bridge-heartbeat/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;
const ALERT_TO = 'rivercityroofingsolutions@gmail.com';
const STALE_MINUTES = 20;
const ALERT_DEBOUNCE_HOURS = 2;
const WATCHDOG_STATE_KEY = 'data/phone-bridge-watchdog-state.json';

async function readBlobJson<T>(prefix: string): Promise<T | null> {
  try {
    const { list } = await import('@vercel/blob');
    const { blobs } = await list({ prefix });
    if (!blobs.length) return null;
    const res = await fetch(blobs[0].url, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function writeBlobJson(key: string, data: unknown): Promise<void> {
  try {
    const { put } = await import('@vercel/blob');
    await put(key, JSON.stringify(data), {
      access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true,
    });
  } catch (err) {
    console.error('[bridge-watchdog] state write failed:', err);
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || '';
  const isVercelCron = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;
  if (!isVercelCron) {
    const { requireAuth } = await import('@/lib/auth-service');
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;
    if (!['admin', 'owner', 'manager'].includes(auth.user.role)) {
      return NextResponse.json(
        { error: 'CRON_SECRET header or admin/owner/manager role required' },
        { status: 403 },
      );
    }
  }

  const dryRun = request.nextUrl.searchParams.get('dryRun') === '1';
  const enabled = /^true$/i.test(process.env.PHONE_BRIDGE_MONITOR_ENABLED || '');

  const hb = await readBlobJson<{ lastSeen?: string; watermark?: unknown }>(HEARTBEAT_BLOB_KEY);
  const now = Date.now();
  const lastSeenMs = hb?.lastSeen ? new Date(hb.lastSeen).getTime() : null;
  const ageMinutes = lastSeenMs ? Math.round((now - lastSeenMs) / 60000) : null;
  const stale = lastSeenMs === null || ageMinutes! > STALE_MINUTES;

  const summary = {
    success: true,
    enabled,
    dryRun,
    lastSeen: hb?.lastSeen ?? null,
    watermark: hb?.watermark ?? null,
    ageMinutes,
    staleThresholdMinutes: STALE_MINUTES,
    stale,
  };

  // Not enabled, or healthy → report and leave.
  if (!enabled || !stale) {
    return NextResponse.json({ ...summary, emailSent: false });
  }

  // Debounce: at most one email per ALERT_DEBOUNCE_HOURS.
  const wstate = await readBlobJson<{ lastAlertAt?: string }>(WATCHDOG_STATE_KEY);
  const lastAlertMs = wstate?.lastAlertAt ? new Date(wstate.lastAlertAt).getTime() : 0;
  const debounced = now - lastAlertMs < ALERT_DEBOUNCE_HOURS * 3600_000;

  if (dryRun || debounced) {
    return NextResponse.json({
      ...summary,
      emailSent: false,
      message: dryRun ? 'DRY RUN — would alert.' : 'Stale but within alert debounce window.',
    });
  }

  const lastSeenTxt = hb?.lastSeen || 'never';
  const body = `
<div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:#c0392b;color:#fff;padding:18px;">
    <h1 style="margin:0;font-size:19px;">Phone bridge is not reporting in</h1>
    <p style="margin:6px 0 0;font-size:14px;">No heartbeat from the office PBX bridge for ${ageMinutes ?? '∞'} minutes (threshold ${STALE_MINUTES}m).</p>
  </div>
  <div style="padding:18px;color:#222;">
    <p>The call log stops updating when the bridge is down — it does not mean the
       phones are quiet. Check the bridge process on Boston.</p>
    <p style="color:#666;">Last heartbeat: <strong>${lastSeenTxt}</strong></p>
    <ol style="line-height:1.6;padding-left:20px;">
      <li>On Boston (WSL): <code>systemctl status rcr-pbx-bridge</code></li>
      <li>Logs: <code>journalctl -u rcr-pbx-bridge -n 100 --no-pager</code></li>
      <li>Confirm WSL + MariaDB are up and the portal is reachable from the office.</li>
    </ol>
    <p style="font-size:12px;color:#888;">Failure-only alert, debounced to once per ${ALERT_DEBOUNCE_HOURS}h.</p>
  </div>
</div>`;

  const res = await emailService.send({
    template: 'stalled-tickets-digest',
    to: ALERT_TO,
    subject: '[RCRS] Phone bridge is not reporting in',
    body,
  });

  if (res.success) await writeBlobJson(WATCHDOG_STATE_KEY, { lastAlertAt: new Date().toISOString() });

  return NextResponse.json({ ...summary, emailSent: res.success, emailError: res.success ? undefined : res.error });
}
