/**
 * Portal Messaging — Group conversations
 *
 * GET  /api/portal/messages/groups        — list the logged-in user's groups
 * POST /api/portal/messages/groups        — send a message to a group
 *
 * Both endpoints route through lib/portal-messaging-service.ts which
 * enforces the master kill-switch and quiet-hours guards. No automatic
 * sends — every POST is an explicit user click from the portal UI.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-service';
import {
  listConversations,
  sendGroupMessage,
} from '@/lib/portal-messaging-service';

export async function GET() {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const result = await listConversations(auth.user.userId);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error || 'Failed to list groups' },
      { status: 500 },
    );
  }

  // Filter to just groups (DMs are handled by /api/portal/messages/dms).
  const groups = result.conversations.filter((c) => c.kind === 'group');
  return NextResponse.json({ success: true, conversations: groups });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  let body: { groupId?: string; body?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.groupId || !body.body) {
    return NextResponse.json(
      { success: false, error: 'groupId and body are required' },
      { status: 400 },
    );
  }

  const result = await sendGroupMessage({
    groupId: body.groupId,
    fromUserId: auth.user.userId,
    fromUserName: auth.user.name,
    body: body.body,
  });

  if (!result.ok) {
    // Distinguish guard-skipped (202) from hard failure (500/400).
    if (result.skipped) {
      return NextResponse.json(
        { success: false, skipped: true, reason: result.reason, error: result.error },
        { status: 202 },
      );
    }
    return NextResponse.json(
      { success: false, error: result.error || 'Send failed' },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, data: result.data });
}
