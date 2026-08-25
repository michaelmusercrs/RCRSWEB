/**
 * PBX bridge → recording/voicemail audio upload.
 *
 * The bridge (on Boston) POSTs transcoded audio bytes here; we store them in
 * Blob under an unguessable key and hand back the pathname + url. The Blob
 * token NEVER leaves the portal. Auth is the shared CALLS_WEBHOOK_API_KEY (same
 * secret as the webhook), so only the office bridge can upload.
 *
 * Access model: stored public-but-unguessable (matches the rest of this repo)
 * and served ONLY through the authenticated /api/calls/[callId]/recording
 * stream — raw URLs are never returned to browsers. FOLLOW-UP: switch to
 * access:'private' once the private-Blob read path is verified in this app.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function validateApiKey(request: NextRequest): 'ok' | 'not_configured' | 'invalid' {
  const expected = process.env.CALLS_WEBHOOK_API_KEY;
  if (!expected) return 'not_configured';
  const got = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '');
  return got === expected ? 'ok' : 'invalid';
}

export async function POST(request: NextRequest) {
  const auth = validateApiKey(request);
  if (auth === 'not_configured') {
    return NextResponse.json({ error: 'Upload not configured' }, { status: 503 });
  }
  if (auth === 'invalid') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const kind = searchParams.get('kind') === 'voicemail' ? 'voicemail' : 'recording';
  const callUuid = (searchParams.get('callUuid') || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
  const ext = (searchParams.get('ext') || 'opus').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'opus';

  const buf = Buffer.from(await request.arrayBuffer());
  if (buf.length === 0) {
    return NextResponse.json({ error: 'Empty body' }, { status: 400 });
  }

  const ym = new Date().toISOString().slice(0, 7);
  const key = `phone/${kind}s/${ym}/${callUuid}.${ext}`;
  const contentType = request.headers.get('content-type') || 'application/octet-stream';

  try {
    const { put } = await import('@vercel/blob');
    const res = await put(key, buf, {
      access: 'public',
      contentType,
      addRandomSuffix: true,
      allowOverwrite: true,
    });
    return NextResponse.json({ ok: true, pathname: res.pathname, url: res.url, bytes: buf.length });
  } catch (error) {
    console.error('[recording-upload] error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
