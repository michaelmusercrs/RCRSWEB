/**
 * /api/portal/settings/push-notifications — ntfy.sh config + test send.
 *
 * GET  returns the base URL + per-role topic names so the settings UI can
 *      render subscription instructions.
 * POST sends a test notification to a chosen role's topic.
 *
 * Available to any signed-in user — they can only push to topics they
 * already know exist, and ntfy topics are public by design.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import { getBaseUrl, topicForRole, pushNotification, NtfyRoleTopic } from '@/lib/ntfy-service';
import { auditLog } from '@/lib/audit-logger';

const ROLES: NtfyRoleTopic[] = ['office', 'warehouse', 'drivers', 'admin', 'billing'];

export async function GET() {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;
  const topics: Record<string, string> = {};
  for (const r of ROLES) topics[r] = topicForRole(r);
  return NextResponse.json({
    baseUrl: getBaseUrl(),
    topics,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;
  try {
    const body = await request.json();
    const role = body.role as NtfyRoleTopic | undefined;
    if (!role || !ROLES.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }
    const title = String(body.title || 'Test from RCRS');
    const message = String(body.message || 'Test push from RCRS settings.');
    const topic = topicForRole(role);
    const ok = await pushNotification(topic, title, message, { tags: ['bell'], priority: 3 });
    auditLog('PUSH_TEST', auth.user.email, `Sent test push to ${role} (topic: ${topic}) — ${ok ? 'ok' : 'failed'}`, request);
    return NextResponse.json({ ok, topic });
  } catch (err) {
    console.error('[push-notifications api] POST error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
