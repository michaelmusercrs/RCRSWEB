/**
 * Authenticated recording playback.
 *
 * Streams a call's audio ONLY to someone allowed to hear it — a participant on
 * the call (their extension appears on it) or a manager+. The underlying Blob
 * URL is never handed to the browser; bytes are proxied through this route with
 * Range support so the player can seek.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { callsService } from '@/lib/calls-service';
import { getPhoneScope, scopeAllowsCall } from '@/lib/phone-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { callId: string } },
) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const call = await callsService.getCallById(params.callId);
  if (!call || !scopeAllowsCall(getPhoneScope(auth.user), call)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const src = call.recordingUrl || '';
  if (!src || !call.recordingAvailable) {
    return NextResponse.json({ error: 'No recording' }, { status: 404 });
  }

  const range = request.headers.get('range');
  const upstream = await fetch(src, { headers: range ? { Range: range } : {} });
  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json({ error: 'Recording unavailable' }, { status: 502 });
  }

  const headers = new Headers();
  headers.set('content-type', upstream.headers.get('content-type') || 'audio/ogg');
  headers.set('accept-ranges', 'bytes');
  headers.set('cache-control', 'private, no-store');
  const len = upstream.headers.get('content-length');
  if (len) headers.set('content-length', len);
  const cr = upstream.headers.get('content-range');
  if (cr) headers.set('content-range', cr);

  return new Response(upstream.body, { status: upstream.status, headers });
}
