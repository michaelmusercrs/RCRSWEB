/**
 * PBX bridge liveness heartbeat.
 *
 * The bridge POSTs here each cycle. We persist the last-seen time to Blob so the
 * phone-bridge-watchdog cron can alert if the office bridge goes silent (a dead
 * bridge must never look like "quiet phones"). Auth = CALLS_WEBHOOK_API_KEY.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const HEARTBEAT_BLOB_KEY = 'data/phone-bridge-heartbeat.json';

function validateApiKey(request: NextRequest): boolean {
  const expected = process.env.CALLS_WEBHOOK_API_KEY;
  if (!expected) return false;
  const got = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '');
  return got === expected;
}

export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    /* heartbeat body is optional */
  }

  const record = {
    lastSeen: new Date().toISOString(),
    watermark: body.watermark ?? null,
    meta: body,
  };

  try {
    const { put } = await import('@vercel/blob');
    await put(HEARTBEAT_BLOB_KEY, JSON.stringify(record), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  } catch (error) {
    console.error('[bridge-heartbeat] persist failed:', error);
    // Still 200 — a persistence blip shouldn't make the bridge think it's down.
  }

  return NextResponse.json({ ok: true, lastSeen: record.lastSeen });
}
