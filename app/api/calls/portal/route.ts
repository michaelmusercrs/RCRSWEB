/**
 * Office Call Portal API — shared-password gated (NOT staff login).
 *
 * Powers the open-link recording portal at rcrsal.com/calls so office staff
 * can reach call history + recordings with a single shared password, without a
 * portal account. Customer PII (recordings, numbers) stays behind this gate.
 *
 * - POST { action: 'login', password }  → validate vs CALLS_PORTAL_PASSWORD,
 *   set an httpOnly cookie, return { ok }.
 * - POST { action: 'logout' }           → clear the cookie.
 * - GET  [?q=&limit=&offset=]           → cookie-gated; returns calls + stats.
 *
 * The cookie is a SHA-256 token derived from the current password, so rotating
 * the password invalidates every existing session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { callsService } from '@/lib/calls-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COOKIE_NAME = 'calls_portal';
// Static salt so the cookie token isn't just sha256(password) — combined with
// the secret password it's not guessable from the cookie alone.
const TOKEN_SALT = 'rcrs-calls-portal-v1';

function expectedToken(): string | null {
  const pw = process.env.CALLS_PORTAL_PASSWORD;
  if (!pw) return null;
  return crypto.createHash('sha256').update(TOKEN_SALT + ':' + pw).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function isAuthed(): boolean {
  const token = expectedToken();
  if (!token) return false;
  const cookie = cookies().get(COOKIE_NAME)?.value;
  if (!cookie) return false;
  return safeEqual(cookie, token);
}

export async function POST(request: NextRequest) {
  let body: { action?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 });
  }

  if (body.action === 'logout') {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, '', { path: '/calls', maxAge: 0 });
    return res;
  }

  // login
  const token = expectedToken();
  if (!token) {
    // Password not configured on the server yet.
    return NextResponse.json(
      { ok: false, error: 'The call portal is not configured yet. Set CALLS_PORTAL_PASSWORD.' },
      { status: 503 }
    );
  }
  const pw = process.env.CALLS_PORTAL_PASSWORD as string;
  const given = typeof body.password === 'string' ? body.password : '';
  if (given.length === 0 || given.length !== pw.length || !safeEqual(given, pw)) {
    return NextResponse.json({ ok: false, error: 'Incorrect password' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/', // sent to both the /calls page and /api/calls/portal
    maxAge: 60 * 60 * 12, // 12 hours
  });
  return res;
}

export async function GET(request: NextRequest) {
  if (!isAuthed()) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim().toLowerCase();
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10) || 100, 1), 500);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

  let calls = await callsService.getCalls();
  // Newest first
  calls.sort((a, b) => (b.startTime || '').localeCompare(a.startTime || ''));

  if (q) {
    calls = calls.filter((c) => {
      const hay = [
        c.customerName,
        c.customerPhone,
        c.repName,
        c.repExtension,
        c.direction,
        c.status,
        c.notes,
        (c.tags || []).join(' '),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }

  const total = calls.length;
  const page = calls.slice(offset, offset + limit);
  const stats = await callsService.getStats();

  return NextResponse.json({
    ok: true,
    total,
    offset,
    limit,
    calls: page,
    stats,
  });
}
